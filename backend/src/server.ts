import "dotenv/config";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { promisify } from "node:util";
import cors from "cors";
import express from "express";
import {
  getLatestArchitectureReview,
  getRecentArchitectureReviews,
  runArchitectReview,
} from "./architect/index.js";
import { getAxReadiness, getAxRoadmap } from "./ax/axReadiness.js";
import { getLatestDailyReport, getLatestHistorianExport, getRecentBatchRuns } from "./batches/store.js";
import { findProject, projects } from "./config/projects.js";
import {
  isHistorianConfigured,
} from "./historian/index.js";
import { getLocalRuntimeStatus } from "./lib/localRuntime.js";
import { getKpiOverview, normalizeRange } from "./kpi/index.js";
import { getAgentMeshOverview } from "./mesh/index.js";
import { getSecurityStatus, notifySecurityEvent } from "./security/securityModel.js";
import {
  getTaskEvents,
  runNightlyQueueSummary,
  runQueueOnce,
} from "./queue/index.js";
import { supabaseAdmin } from "./lib/supabaseAdmin.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const startedAt = new Date().toISOString();
const execFileAsync = promisify(execFile);
const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...parseCsvEnv(process.env.CORS_ALLOWED_ORIGINS),
]);

const localActionTypes = new Set([
  "git_status",
  "git_branch",
  "git_log_recent",
  "frontend_build",
  "backend_typecheck",
  "backend_build",
  "runtime_status",
  "runtime_start_all",
  "runtime_stop_all",
  "runtime_restart_all",
]);
const seedWorkLogIds = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
  "10000000-0000-4000-8000-000000000004",
];
const seedCommandRunIds = [
  "20000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
];

type HealthServiceKey =
  | "ax"
  | "backend"
  | "runtime"
  | "knowledge"
  | "mesh"
  | "kpi"
  | "architect"
  | "dailyReport"
  | "queue"
  | "security";

type EndpointRegistration = {
  name: string;
  method: "GET" | "POST" | "PATCH";
  path: string;
  service: HealthServiceKey;
  description: string;
};

const endpointRegistry: EndpointRegistration[] = [
  { name: "Health", method: "GET", path: "/health", service: "backend", description: "Legacy backend liveness check." },
  { name: "API Health", method: "GET", path: "/api/health", service: "backend", description: "ArchiveOS service health summary." },
  { name: "Endpoint Matrix", method: "GET", path: "/api/health/endpoints", service: "backend", description: "Registered endpoint coverage." },
  { name: "AX Readiness", method: "GET", path: "/api/ax/readiness", service: "ax", description: "AX platform transition readiness from architecture document." },
  { name: "AX Roadmap", method: "GET", path: "/api/ax/roadmap", service: "ax", description: "AX architecture roadmap phases." },
  { name: "Obsidian Sync", method: "POST", path: "/api/obsidian/sync", service: "knowledge", description: "Spring AI Obsidian vault sync proxy." },
  { name: "Spring AI Runtime", method: "GET", path: "/api/ai/runtime", service: "knowledge", description: "archiveos-ai runtime telemetry proxy." },
  { name: "Spring AI Runtime Check", method: "POST", path: "/api/ai/runtime/check", service: "knowledge", description: "Manual ChatModel and EmbeddingModel smoke check proxy." },
  { name: "Obsidian Documents", method: "GET", path: "/api/obsidian/documents", service: "knowledge", description: "Spring AI indexed Obsidian document proxy." },
  { name: "RAG Search", method: "GET", path: "/api/rag/search", service: "knowledge", description: "Spring AI pgvector similarity search proxy." },
  { name: "RAG Ask", method: "POST", path: "/api/rag/ask", service: "knowledge", description: "Spring AI ChatModel grounded RAG answer proxy." },
  { name: "Spring Batch Jobs", method: "GET", path: "/api/batch/jobs", service: "ax", description: "Spring Batch job catalog proxy." },
  { name: "Spring Batch Run", method: "POST", path: "/api/batch/jobs/:jobName/run", service: "ax", description: "Manual Spring Batch job launch proxy." },
  { name: "Spring Batch Executions", method: "GET", path: "/api/batch/executions", service: "ax", description: "Spring Batch execution history proxy." },
  { name: "Spring Batch Execution Detail", method: "GET", path: "/api/batch/executions/:id", service: "ax", description: "Spring Batch execution detail proxy." },
  { name: "RPA Classify", method: "POST", path: "/api/rpa/classify", service: "ax", description: "Spring Batch Intelligent RPA classification proxy." },
  { name: "RPA Tasks", method: "GET", path: "/api/rpa/tasks/recent", service: "ax", description: "Recent Spring Batch RPA task records." },
  { name: "RPA Task Detail", method: "GET", path: "/api/rpa/tasks/:id", service: "ax", description: "Spring Batch RPA task detail." },
  { name: "RPA PM Decision", method: "POST", path: "/api/rpa/tasks/:id/decision", service: "ax", description: "Spring DB PM approval/rejection/hold record." },
  { name: "Dashboard", method: "GET", path: "/api/dashboard", service: "dailyReport", description: "Supabase dashboard data." },
  { name: "Work Logs", method: "GET", path: "/api/work-logs/recent", service: "dailyReport", description: "Recent work logs." },
  { name: "Record Work Log", method: "POST", path: "/api/work-logs", service: "dailyReport", description: "Recording-only work log write." },
  { name: "Commands", method: "GET", path: "/api/commands/recent", service: "dailyReport", description: "Recent recorded commands." },
  { name: "Record Command", method: "POST", path: "/api/commands", service: "dailyReport", description: "Recording-only command write." },
  { name: "PM Tasks", method: "GET", path: "/api/tasks", service: "queue", description: "PM-controlled task queue." },
  { name: "Create PM Task", method: "POST", path: "/api/tasks", service: "queue", description: "Recording-only queue task creation." },
  { name: "Update PM Task", method: "PATCH", path: "/api/tasks/:id", service: "queue", description: "Queue task metadata update." },
  { name: "PM Task Decision", method: "POST", path: "/api/tasks/:id/decision", service: "queue", description: "PM approval/rejection/hold recording." },
  { name: "PM Task Retry", method: "POST", path: "/api/tasks/:id/retry", service: "queue", description: "PM retry recording without execution." },
  { name: "PM Task Callback", method: "POST", path: "/api/tasks/:id/callback", service: "queue", description: "Archive-Nexus action result callback." },
  { name: "PM Task Events", method: "GET", path: "/api/tasks/:id/events", service: "queue", description: "Workflow event history." },
  { name: "Atlas Overview", method: "GET", path: "/api/atlas/overview", service: "runtime", description: "Atlas managed-system dashboard data." },
  { name: "Atlas Services", method: "GET", path: "/api/atlas/services", service: "runtime", description: "Atlas service registry." },
  { name: "Atlas Healthcheck Results", method: "GET", path: "/api/atlas/healthchecks/recent", service: "runtime", description: "Recent Atlas healthcheck monitor results." },
  { name: "Run Atlas Healthchecks", method: "POST", path: "/api/atlas/healthchecks/run", service: "runtime", description: "Read-only Atlas healthcheck collector." },
  { name: "Atlas Codex Work Logs", method: "GET", path: "/api/atlas/work-logs", service: "runtime", description: "Atlas Codex work log records." },
  { name: "Record Atlas Codex Work Log", method: "POST", path: "/api/atlas/work-logs", service: "runtime", description: "Manual Atlas Codex work log recorder." },
  { name: "Managed Systems Overview", method: "GET", path: "/api/managed-systems/overview", service: "runtime", description: "Control Tower managed systems and PM inbox summary." },
  { name: "Managed Systems", method: "GET", path: "/api/managed-systems", service: "runtime", description: "Aggregated external managed systems list." },
  { name: "Managed System Detail", method: "GET", path: "/api/managed-systems/:systemId", service: "runtime", description: "Managed system detail." },
  { name: "Managed System Events", method: "GET", path: "/api/managed-systems/:systemId/events", service: "runtime", description: "Cross-system events for a managed system." },
  { name: "Managed System Workflows", method: "GET", path: "/api/managed-systems/:systemId/workflows", service: "runtime", description: "Workflows related to a managed system." },
  { name: "Managed System Work Logs", method: "GET", path: "/api/managed-systems/:systemId/work-logs", service: "runtime", description: "Work logs related to a managed system." },
  { name: "PM Inbox", method: "GET", path: "/api/pm-inbox", service: "runtime", description: "Recommended PM action inbox." },
  { name: "PM Inbox Acknowledge", method: "POST", path: "/api/pm-inbox/:id/acknowledge", service: "runtime", description: "Admin acknowledgement for a PM inbox item." },
  { name: "PM Inbox Resolve", method: "POST", path: "/api/pm-inbox/:id/resolve", service: "runtime", description: "Admin resolution for a PM inbox item." },
  { name: "Ecosystem Services", method: "GET", path: "/api/ecosystem/services", service: "runtime", description: "Archive Platform external service registry." },
  { name: "Ecosystem Summary", method: "GET", path: "/api/ecosystem/summary", service: "runtime", description: "Market, Nexus, Logistics, Ledger integrated operations status." },
  { name: "Ecosystem Topology", method: "GET", path: "/api/ecosystem/topology", service: "runtime", description: "Control Tower topology nodes and edges." },
  { name: "Ecosystem Timeline", method: "GET", path: "/api/ecosystem/timeline", service: "runtime", description: "Cross-service timeline events." },
  { name: "Ecosystem Balance Summary", method: "GET", path: "/api/ecosystem/balance/summary", service: "runtime", description: "Read-only synthetic service balance analysis." },
  { name: "Ecosystem Balance Recommendations", method: "GET", path: "/api/ecosystem/balance/recommendations", service: "runtime", description: "Read-only synthetic balance recommendations." },
  { name: "Ecosystem Balance Simulation", method: "POST", path: "/api/ecosystem/balance/simulate", service: "runtime", description: "Admin safe dry-run balance simulation." },
  { name: "Refresh Ecosystem", method: "POST", path: "/api/ecosystem/refresh", service: "runtime", description: "Read-only external service health refresh." },
  { name: "Ecosystem Demo Dry-run", method: "POST", path: "/api/ecosystem/demo/dry-run", service: "runtime", description: "Safe dry-run ecosystem scenario." },
  { name: "Ecosystem Demo Run", method: "POST", path: "/api/ecosystem/demo/run", service: "runtime", description: "Blocked unless external writes are explicitly enabled." },
  { name: "Settlement Game Summary", method: "GET", path: "/api/game/settlement-agency/summary", service: "runtime", description: "Synthetic settlement agency revenue and bankruptcy risk summary." },
  { name: "Settlement Game Preset", method: "GET", path: "/api/game/settlement-agency/preset", service: "runtime", description: "Synthetic settlement simulation preset." },
  { name: "Settlement Game Simulate", method: "POST", path: "/api/game/settlement-agency/simulate", service: "runtime", description: "Read-only dry-run bankruptcy prevention simulation." },
  { name: "Survival Mode Summary", method: "GET", path: "/api/game/survival/summary", service: "runtime", description: "Ecosystem survival mode summary (alias to settlement simulation engine)." },
  { name: "Survival Mode Preset", method: "GET", path: "/api/game/survival/preset", service: "runtime", description: "Ecosystem survival mode preset (alias to settlement simulation engine)." },
  { name: "Survival Mode Simulate", method: "POST", path: "/api/game/survival/simulate", service: "runtime", description: "Read-only dry-run survival simulation (alias to settlement simulation engine)." },
  { name: "Survival Finance", method: "GET", path: "/api/game/survival/finance", service: "runtime", description: "Persisted system cash, exports, and imports for survival mode." },
  { name: "Survival System Finance", method: "GET", path: "/api/game/survival/finance/:systemId", service: "runtime", description: "Persisted cash, exports, and imports for one managed system." },
  { name: "Nexus Outbox", method: "GET", path: "/api/integrations/nexus/outbox", service: "runtime", description: "Archive-Nexus outbox summary proxy." },
  { name: "Nexus Generate", method: "POST", path: "/api/integrations/nexus/outbox/generate", service: "runtime", description: "Safe-mode guarded Nexus event generation." },
  { name: "Nexus Publish", method: "POST", path: "/api/integrations/nexus/outbox/publish", service: "runtime", description: "Safe-mode guarded Nexus outbox publish." },
  { name: "Market Summary", method: "GET", path: "/api/integrations/market/summary", service: "runtime", description: "Archive-Market operations summary proxy." },
  { name: "Market Economy", method: "GET", path: "/api/integrations/market/economy", service: "runtime", description: "Archive-Market synthetic economy summary proxy." },
  { name: "Market Outbox", method: "GET", path: "/api/integrations/market/outbox", service: "runtime", description: "Archive-Market outbox summary proxy." },
  { name: "Market Orders", method: "GET", path: "/api/integrations/market/orders", service: "runtime", description: "Archive-Market synthetic order list proxy." },
  { name: "Market Claims", method: "GET", path: "/api/integrations/market/claims", service: "runtime", description: "Archive-Market synthetic claim list proxy." },
  { name: "Market Returns", method: "GET", path: "/api/integrations/market/returns", service: "runtime", description: "Archive-Market synthetic return list proxy." },
  { name: "Market Review Event Ingest", method: "POST", path: "/api/integrations/market/events/review", service: "runtime", description: "Consumes ORDER_REQUIRES_REVIEW, LOW_MARGIN_ORDER_DETECTED, HIGH_RISK_ORDER_DETECTED into approval queue." },
  { name: "Live Flow Summary", method: "GET", path: "/api/live-flow/summary", service: "runtime", description: "Operational Twin summary from runtime flow events." },
  { name: "Live Flow Topology", method: "GET", path: "/api/live-flow/topology", service: "runtime", description: "Operational Twin node and lane topology." },
  { name: "Live Flow Recent Events", method: "GET", path: "/api/live-flow/events/recent", service: "runtime", description: "Recent normalized runtime flow events." },
  { name: "Live Flow Stream", method: "GET", path: "/api/live-flow/stream", service: "runtime", description: "Unbuffered SSE stream of persisted normalized flow events." },
  { name: "Live Flow Replay", method: "GET", path: "/api/live-flow/replay", service: "runtime", description: "Replay normalized runtime flow events by time window." },
  { name: "Live Flow Correlation", method: "GET", path: "/api/live-flow/correlation/:id", service: "runtime", description: "Trace one runtime correlation chain." },
  { name: "Live Flow Entity", method: "GET", path: "/api/live-flow/entity/:id", service: "runtime", description: "Trace one entity through the flow." },
  { name: "Live Flow Refresh", method: "POST", path: "/api/live-flow/refresh", service: "runtime", description: "Admin-only read-only collection from Archive services." },
  { name: "World Assets", method: "GET", path: "/api/world/assets", service: "runtime", description: "Read-only Archive-World manifest adapter." },
  { name: "World Layout", method: "GET", path: "/api/world/layout", service: "runtime", description: "Digital Twin district and route DTO." },
  { name: "World Events", method: "GET", path: "/api/world/events", service: "runtime", description: "Timeline-derived viewer event DTO." },
  { name: "World State", method: "GET", path: "/api/world/state", service: "runtime", description: "Read-only Digital Twin adapter status." },
  { name: "World Stream", method: "GET", path: "/api/world/stream", service: "runtime", description: "SSE viewer event adapter." },
  { name: "Workforce Overview", method: "GET", path: "/api/workforce/overview", service: "runtime", description: "Synthetic workforce, capacity, productivity, and cashflow overview." },
  { name: "Workforce Bottlenecks", method: "GET", path: "/api/workforce/bottlenecks", service: "runtime", description: "Service bottleneck and backlog summary." },
  { name: "Workforce Recommendations", method: "GET", path: "/api/workforce/recommendations", service: "runtime", description: "Recommendation-only workforce actions." },
  { name: "Workforce Productivity Trend", method: "GET", path: "/api/workforce/productivity-trend", service: "runtime", description: "Current productivity trend points by service." },
  { name: "Logistics Summary", method: "GET", path: "/api/integrations/logitics/summary", service: "runtime", description: "Archive-Logistics operations summary proxy." },
  { name: "Logistics Outbox", method: "GET", path: "/api/integrations/logitics/outbox", service: "runtime", description: "Archive-Logistics outbox summary proxy." },
  { name: "Logistics Publish", method: "POST", path: "/api/integrations/logitics/outbox/publish", service: "runtime", description: "Safe-mode guarded Logistics outbox publish." },
  { name: "Ledger Summary", method: "GET", path: "/api/integrations/ledger/summary", service: "runtime", description: "Archive-Ledger operations summary proxy." },
  { name: "Ledger Approval Required", method: "GET", path: "/api/integrations/ledger/approval-required", service: "runtime", description: "Archive-Ledger APPROVAL_REQUIRED transaction proxy." },
  { name: "Approval Callback Outbox", method: "GET", path: "/api/approvals/callbacks", service: "runtime", description: "Approval callback outbox queue." },
  { name: "Retry Approval Callback", method: "POST", path: "/api/approvals/callbacks/:callbackId/retry", service: "runtime", description: "Retry one callback outbox item." },
  { name: "Retry Failed Callbacks", method: "POST", path: "/api/approvals/callbacks/retry-failed", service: "runtime", description: "Retry failed callback outbox items." },
  { name: "External Approvals", method: "GET", path: "/api/approvals/external", service: "runtime", description: "Archive-Ledger external approval request queue." },
  { name: "External Approval Summary", method: "GET", path: "/api/approvals/external/summary", service: "runtime", description: "External approval aggregate status." },
  { name: "External Approval Detail", method: "GET", path: "/api/approvals/external/:id", service: "runtime", description: "Archive-Ledger external approval detail." },
  { name: "Create External Approval", method: "POST", path: "/api/approvals/external", service: "runtime", description: "Archive-Ledger synthetic approval request ingress." },
  { name: "Approve External Approval", method: "POST", path: "/api/approvals/external/:id/approve", service: "runtime", description: "PM/Admin approval decision for Ledger callback." },
  { name: "Reject External Approval", method: "POST", path: "/api/approvals/external/:id/reject", service: "runtime", description: "PM/Admin rejection decision for Ledger callback." },
  { name: "Hold External Approval", method: "POST", path: "/api/approvals/external/:id/hold", service: "runtime", description: "PM/Admin hold decision without Ledger mutation." },
  { name: "Queue Summary", method: "GET", path: "/api/queue/summary", service: "queue", description: "Semi-auto queue summary." },
  { name: "Queue Run Once", method: "POST", path: "/api/queue/run-once", service: "queue", description: "State transition and instruction generation only." },
  { name: "Queue Nightly Summary", method: "POST", path: "/api/queue/nightly-summary", service: "queue", description: "Slack queue summary without execution." },
  { name: "Local Projects", method: "GET", path: "/api/local-actions/projects", service: "backend", description: "Allowlisted local project registry." },
  { name: "Local Diagnostics", method: "POST", path: "/api/local-actions/run", service: "backend", description: "Allowlisted diagnostics endpoint." },
  { name: "Runtime Status", method: "GET", path: "/api/local-runtime/status", service: "runtime", description: "Local MCP runtime status." },
  { name: "Runtime Events", method: "GET", path: "/api/runtime/events/recent", service: "runtime", description: "Derived runtime events." },
  { name: "Runtime Version", method: "GET", path: "/api/runtime/version", service: "backend", description: "Backend git/runtime version." },
  { name: "Public Access", method: "GET", path: "/api/runtime/public-access", service: "backend", description: "Remote/ngrok runtime URL configuration." },
  { name: "Runtime Security", method: "GET", path: "/api/security/status", service: "security", description: "ngrok OAuth readiness, role model, and device approval status." },
  { name: "Batch Runs", method: "GET", path: "/api/batches/recent", service: "dailyReport", description: "Recent batch runs." },
  { name: "Latest Batch", method: "GET", path: "/api/batches/latest", service: "dailyReport", description: "Latest nightly/daily batch state." },
  { name: "Run Nightly Review", method: "POST", path: "/api/batches/nightly-review/run", service: "dailyReport", description: "Manual nightly batch trigger." },
  { name: "Run Daily Report", method: "POST", path: "/api/batches/daily-report/run", service: "dailyReport", description: "Manual daily report trigger." },
  { name: "Latest Daily Report", method: "GET", path: "/api/reports/daily/latest", service: "dailyReport", description: "Latest daily report." },
  { name: "Recent Daily Reports", method: "GET", path: "/api/reports/daily/recent", service: "dailyReport", description: "Recent daily reports." },
  { name: "Runtime Snapshots", method: "GET", path: "/api/runtime/snapshots/recent", service: "runtime", description: "Recent runtime snapshots." },
  { name: "Historian", method: "GET", path: "/api/historian/status", service: "knowledge", description: "Historian export status." },
  { name: "Knowledge Health", method: "GET", path: "/api/knowledge/health", service: "knowledge", description: "Spring Knowledge repository health proxy." },
  { name: "Knowledge Overview", method: "GET", path: "/api/knowledge/overview", service: "knowledge", description: "Knowledge Graph overview." },
  { name: "Recent Knowledge", method: "GET", path: "/api/knowledge/recent", service: "knowledge", description: "Recent knowledge nodes." },
  { name: "Knowledge Search", method: "GET", path: "/api/knowledge/search", service: "knowledge", description: "Knowledge text search." },
  { name: "Related Knowledge", method: "GET", path: "/api/knowledge/related", service: "knowledge", description: "Related knowledge lookup." },
  { name: "Knowledge Graph", method: "GET", path: "/api/knowledge/graph", service: "knowledge", description: "Knowledge Graph visualization data." },
  { name: "Knowledge Graph Insights", method: "GET", path: "/api/knowledge/graph/insights", service: "knowledge", description: "Knowledge Graph importance and decision chain insights." },
  { name: "Knowledge Map", method: "GET", path: "/api/knowledge/map", service: "knowledge", description: "Knowledge Graph visualization data via browser-safe alias." },
  { name: "Knowledge Map Insights", method: "GET", path: "/api/knowledge/map/insights", service: "knowledge", description: "Knowledge Graph insights via browser-safe alias." },
  { name: "Knowledge Node", method: "GET", path: "/api/knowledge/node/:id", service: "knowledge", description: "Knowledge node detail." },
  { name: "Architect Review", method: "POST", path: "/api/architect/review", service: "architect", description: "Rule-based Architect review recorder." },
  { name: "Architect Reviews", method: "GET", path: "/api/architect/reviews/recent", service: "architect", description: "Recent Architect reviews." },
  { name: "Latest Architect", method: "GET", path: "/api/architect/reviews/latest", service: "architect", description: "Latest Architect review." },
  { name: "Agent Mesh", method: "GET", path: "/api/mesh/overview", service: "mesh", description: "Agent Mesh overview." },
  { name: "KPI", method: "GET", path: "/api/kpi/overview", service: "kpi", description: "KPI overview." },
  { name: "Readiness", method: "GET", path: "/api/platform/readiness", service: "backend", description: "Portfolio readiness score." },
];

function parseCsvEnv(value: string | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeApiPath(value: string) {
  const pathOnly = value.split("?")[0] || "/";
  const normalized = pathOnly.replace(/\/+$/, "");
  return normalized || "/";
}

function readOptionalUrlEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS."));
    },
  }),
);
app.use(express.json());

app.post("/api/auth/login", async (request, response) => {
  await relayArchiveOsAi(response, "/api/auth/login", jsonProxyRequest("POST", request.body), undefined, request);
});

app.get("/api/auth/session", async (request, response) => {
  await relayArchiveOsAi(response, "/api/auth/session", undefined, undefined, request);
});

app.post("/api/auth/logout", async (request, response) => {
  await relayArchiveOsAi(response, "/api/auth/logout", { method: "POST" }, undefined, request);
});

app.use("/api", async (request, response, next) => {
  const requestPath = normalizeApiPath(String(request.originalUrl ?? request.path));
  const adminRead = ["/api/security/status", "/api/runtime/public-access", "/api/audit/logs"].includes(requestPath);
  const readOnlyPost = new Set(["/api/rag/ask", "/api/ecosystem/demo/dry-run", "/api/game/settlement-agency/simulate", "/api/game/survival/simulate", "/api/integrations/market/events/review"]);
  if (request.method === "POST" && readOnlyPost.has(requestPath)) {
    next();
    return;
  }
  if (["HEAD", "OPTIONS"].includes(request.method) || (request.method === "GET" && !adminRead)) {
    next();
    return;
  }
  try {
    const session = await readJavaSession(request);
    const role = String(session.role ?? "PUBLIC").toUpperCase();
    const pmAction = /^\/api\/(tasks|rpa\/tasks)\/[^/]+\/(decision|retry|approve|reject|hold|request_retry)$/.test(requestPath)
      || /^\/api\/approvals\/external\/[^/]+\/(approve|reject|hold)$/.test(requestPath)
      || /^\/api\/ai\/decisions\/[^/]+\/(approve|reject)$/.test(requestPath)
      || /^\/api\/memory\/drafts\/[^/]+\/approve$/.test(requestPath);
    if (role === "PUBLIC") {
      response.status(401).json({ error: "Authentication required." });
      return;
    }
    if (adminRead && role !== "ADMIN") {
      response.status(403).json({ error: "Admin role required." });
      return;
    }
    if (!adminRead && (role === "OPERATOR" || (role === "PM" && !pmAction))) {
      response.status(403).json({ error: "Insufficient role." });
      return;
    }
    const legacyMutation = new Set(["/api/queue/run-once", "/api/queue/nightly-summary", "/api/local-actions/run"]);
    if (legacyMutation.has(requestPath)) {
      const correlationId = request.header("x-correlation-id") || randomUUID();
      response.setHeader("x-correlation-id", correlationId);
      response.on("finish", () => void recordCompatibilityAudit(request, requestPath, response.statusCode, correlationId));
    }
    next();
  } catch {
    response.status(503).json({ error: "Authorization service is unavailable." });
  }
});

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "archiveos-backend",
  });
});

app.get("/api/health", async (_request, response) => {
  const services = await getServiceHealth();
  response.json({
    status: "ok",
    services: {
      ax: services.ax,
      runtime: services.runtime,
      knowledge: services.knowledge,
      mesh: services.mesh,
      kpi: services.kpi,
      architect: services.architect,
      dailyReport: services.dailyReport,
      queue: services.queue,
      security: services.security,
    },
  });
});

app.get("/api/health/endpoints", async (_request, response) => {
  response.json(await getEndpointHealthSnapshot());
});

app.get("/api/ax/readiness", (_request, response) => {
  response.json({ data: getAxReadiness() });
});

app.get("/api/ax/roadmap", (_request, response) => {
  response.json({ data: getAxRoadmap() });
});

app.post("/api/obsidian/sync", async (request, response) => {
  await relayArchiveOsAi(response, "/api/obsidian/sync", { method: "POST" }, undefined, request);
});

app.post("/api/ai/decisions/analyze", async (request, response) => {
  await relayArchiveOsAi(response, "/api/ai/decisions/analyze", jsonProxyRequest("POST", request.body), undefined, request);
});
app.get("/api/ai/decisions", async (request, response) => {
  const limit = request.query.limit ? `?limit=${encodeURIComponent(String(request.query.limit))}` : "";
  await relayArchiveOsAi(response, `/api/ai/decisions${limit}`, undefined, undefined, request);
});
app.get("/api/ai/decisions/:id", async (request, response) => {
  await relayArchiveOsAi(response, `/api/ai/decisions/${encodeURIComponent(request.params.id)}`, undefined, undefined, request);
});
app.post("/api/ai/decisions/:id/:action(approve|reject)", async (request, response) => {
  await relayArchiveOsAi(response, `/api/ai/decisions/${encodeURIComponent(request.params.id)}/${request.params.action}`, jsonProxyRequest("POST", request.body), undefined, request);
});
app.post("/api/memory/drafts", async (request, response) => { await relayArchiveOsAi(response, "/api/memory/drafts", jsonProxyRequest("POST", request.body), undefined, request); });
app.get("/api/memory/records", async (_request, response) => { await relayArchiveOsAi(response, "/api/memory/records"); });
app.get("/api/memory/:kind/:id", async (request, response) => { await relayArchiveOsAi(response, `/api/memory/${encodeURIComponent(request.params.kind)}/${encodeURIComponent(request.params.id)}`, undefined, undefined, request); });
app.post("/api/memory/drafts/:id/:action(approve|write)", async (request, response) => { await relayArchiveOsAi(response, `/api/memory/drafts/${encodeURIComponent(request.params.id)}/${request.params.action}`, jsonProxyRequest("POST", request.body), undefined, request); });
app.get("/api/correlation-timeline/:id", async (request, response) => { await relayArchiveOsAi(response, `/api/correlation-timeline/${encodeURIComponent(request.params.id)}`, undefined, undefined, request); });
app.post("/api/correlation-timeline/:id/explain", async (request, response) => { await relayArchiveOsAi(response, `/api/correlation-timeline/${encodeURIComponent(request.params.id)}/explain`, jsonProxyRequest("POST", request.body), undefined, request); });
app.get("/api/pm-attention", async (_request, response) => { await relayArchiveOsAi(response, "/api/pm-attention"); });
app.get("/api/incidents", async (_request, response) => { await relayArchiveOsAi(response, "/api/incidents"); });
app.post("/api/incidents/detect", async (request, response) => { await relayArchiveOsAi(response, "/api/incidents/detect", { method: "POST" }, undefined, request); });
app.post("/api/incidents/:id/:action(analyze|acknowledge|resolve)", async (request, response) => { await relayArchiveOsAi(response, `/api/incidents/${encodeURIComponent(request.params.id)}/${request.params.action}`, jsonProxyRequest("POST", request.body), undefined, request); });

app.get("/api/ai/runtime", async (_request, response) => {
  try {
    response.status(200).json({ data: await proxyArchiveOsAi("/api/ai/runtime") });
  } catch (error) {
    sendProxyError(response, error, "ArchiveOS AI runtime is unavailable.");
  }
});

app.post("/api/ai/runtime/check", async (request, response) => {
  await relayArchiveOsAi(response, "/api/ai/runtime/check", { method: "POST" }, undefined, request);
});

app.get("/api/obsidian/documents", async (request, response) => {
  try {
    const limit = Number(request.query.limit ?? 100);
    response.status(200).json(await proxyArchiveOsAi(`/api/obsidian/documents?limit=${encodeURIComponent(String(limit))}`));
  } catch (error) {
    sendProxyError(response, error, "Obsidian documents unavailable.");
  }
});

app.get("/api/rag/search", async (request, response) => {
  const query = String(request.query.query ?? "").trim();
  if (!query) {
    response.status(400).json({ error: "query is required." });
    return;
  }

  try {
    const params = new URLSearchParams({ query, limit: String(Number(request.query.limit ?? 10)) });
    response.status(200).json(await proxyArchiveOsAi(`/api/rag/search?${params.toString()}`));
  } catch (error) {
    sendProxyError(response, error, "RAG search failed.");
  }
});

app.post("/api/rag/ask", async (request, response) => {
  const question = typeof request.body?.question === "string" ? request.body.question.trim() : "";
  if (!question) {
    response.status(400).json({ error: "question is required." });
    return;
  }

  try {
    const context = request.body?.context && typeof request.body.context === "object" && !Array.isArray(request.body.context)
      ? request.body.context
      : undefined;
    response.status(200).json(await proxyArchiveOsAi("/api/rag/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, ...(context ? { context } : {}) }),
    }));
  } catch (error) {
    sendProxyError(response, error, "RAG ask failed.");
  }
});

app.get("/api/batch/jobs", async (_request, response) => {
  try {
    response.status(200).json(await proxyArchiveOsAi("/api/batch/jobs"));
  } catch (error) {
    sendProxyError(response, error, "Spring Batch jobs are unavailable.");
  }
});

app.post("/api/batch/jobs/:jobName/run", async (request, response) => {
  await relayArchiveOsAi(response, `/api/batch/jobs/${encodeURIComponent(request.params.jobName)}/run`, { method: "POST" }, undefined, request);
});

app.get("/api/batch/executions", async (request, response) => {
  try {
    const limit = Number(request.query.limit ?? 20);
    response.status(200).json(await proxyArchiveOsAi(`/api/batch/executions?limit=${encodeURIComponent(String(limit))}`));
  } catch (error) {
    sendProxyError(response, error, "Spring Batch executions are unavailable.");
  }
});

app.get("/api/batch/executions/:id", async (request, response) => {
  try {
    response.status(200).json(await proxyArchiveOsAi(`/api/batch/executions/${encodeURIComponent(request.params.id)}`));
  } catch (error) {
    sendProxyError(response, error, "Spring Batch execution detail is unavailable.");
  }
});

app.post("/api/rpa/classify", async (request, response) => {
  const title = typeof request.body?.title === "string" ? request.body.title.trim() : "";
  const description = typeof request.body?.description === "string" ? request.body.description.trim() : "";
  if (!title || !description) {
    response.status(400).json({ error: "title and description are required." });
    return;
  }

  await relayArchiveOsAi(response, "/api/rpa/classify", jsonProxyRequest("POST", {
    title,
    description,
    targetProject: typeof request.body?.targetProject === "string" ? request.body.targetProject : undefined,
    requestedBy: typeof request.body?.requestedBy === "string" ? request.body.requestedBy : "archiveos-node-proxy",
    metadata: typeof request.body?.metadata === "object" && request.body.metadata !== null ? request.body.metadata : {},
  }), undefined, request);
});

app.get("/api/rpa/tasks/recent", async (request, response) => {
  try {
    const limit = Number(request.query.limit ?? 20);
    response.status(200).json(await proxyArchiveOsAi(`/api/rpa/tasks/recent?limit=${encodeURIComponent(String(limit))}`));
  } catch (error) {
    sendProxyError(response, error, "Spring Batch RPA tasks are unavailable.");
  }
});

app.get("/api/rpa/tasks/:id", async (request, response) => {
  try {
    response.status(200).json(await proxyArchiveOsAi(`/api/rpa/tasks/${encodeURIComponent(request.params.id)}`));
  } catch (error) {
    sendProxyError(response, error, "Spring Batch RPA task is unavailable.");
  }
});

app.post("/api/rpa/tasks/:id/decision", async (request, response) => {
  const action = typeof request.body?.action === "string" ? request.body.action.trim() : "";
  if (!["approve", "reject", "hold", "request_retry"].includes(action)) {
    response.status(400).json({ error: "action must be approve, reject, hold, or request_retry." });
    return;
  }
  if (action === "reject" && (typeof request.body?.reason !== "string" || !request.body.reason.trim())) {
    response.status(400).json({ error: "reason is required when rejecting an RPA task." });
    return;
  }

  await relayArchiveOsAi(response, `/api/rpa/tasks/${encodeURIComponent(request.params.id)}/decision`, jsonProxyRequest("POST", {
    action,
    reason: typeof request.body?.reason === "string" ? request.body.reason : null,
    decidedBy: typeof request.body?.decidedBy === "string" ? request.body.decidedBy : "archiveos-node-proxy",
  }), undefined, request);
});

app.get("/api/platform/readiness", async (_request, response) => {
  response.json({ data: await getPlatformReadiness() });
});

app.get("/api/runtime/version", async (_request, response) => {
  response.json({ data: await getRuntimeVersion() });
});

app.get("/api/runtime/public-access", (request, response) => {
  const forwardedProto = request.header("x-forwarded-proto");
  const forwardedHost = request.header("x-forwarded-host");
  const requestOrigin =
    forwardedProto && forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : request.get("host")
        ? `${request.protocol}://${request.get("host")}`
        : null;
  const frontendPublicUrl = readOptionalUrlEnv("ARCHIVEOS_PUBLIC_URL") ?? readOptionalUrlEnv("ARCHIVEOS_NGROK_URL");
  const backendPublicUrl = readOptionalUrlEnv("ARCHIVEOS_BACKEND_PUBLIC_URL");

  response.json({
    data: {
      backendBaseUrlConfigured: Boolean(backendPublicUrl),
      frontendPublicUrlConfigured: Boolean(frontendPublicUrl),
      backendUrlSource: backendPublicUrl ? "env" : requestOrigin ? "request" : "unknown",
      frontendPublicUrl,
      backendPublicUrl: backendPublicUrl ?? requestOrigin,
      checkedAt: new Date().toISOString(),
    },
  });
});

app.get("/api/security/status", async (request, response) => {
  try {
    response.json({ data: await getSecurityStatus(request) });
  } catch {
    response.status(500).json({ error: "Failed to fetch runtime security status." });
  }
});

app.get("/api/work-logs/recent", async (request, response) => {
  await relayArchiveOsAi(response, "/api/work-logs/recent", undefined, undefined, request);
});

app.get("/api/dashboard", async (_request, response) => {
  try {
    const [agentsResult, tasksResult, logsResult, decisionsResult] = await withTimeout(
      Promise.all([
        supabaseAdmin.from("agents").select("*").order("name", { ascending: true }),
        supabaseAdmin
          .from("tasks")
          .select("*, agent:agents(name,status)")
          .order("updated_at", { ascending: false }),
        supabaseAdmin
          .from("work_logs")
          .select("*, task:tasks(title,status), agent:agents(name,role)")
          .order("created_at", { ascending: false })
          .limit(8),
        supabaseAdmin
          .from("work_logs")
          .select("*, task:tasks(title,status), agent:agents(name,role)")
          .eq("log_type", "decision")
          .order("created_at", { ascending: false })
          .limit(20),
      ]),
      4500,
      "Dashboard Supabase query timed out.",
    );

    const firstError =
      agentsResult.error ?? tasksResult.error ?? logsResult.error ?? decisionsResult.error;

    if (firstError) {
      response.json({
        data: {
          agents: [],
          tasks: [],
          logs: [],
          decisions: [],
        },
        warning: "Supabase dashboard data is temporarily unavailable.",
      });
      return;
    }

    response.json({
      data: {
        agents: agentsResult.data ?? [],
        tasks: tasksResult.data ?? [],
        logs: logsResult.data ?? [],
        decisions: decisionsResult.data ?? [],
      },
    });
  } catch {
    response.json({
      data: {
        agents: [],
        tasks: [],
        logs: [],
        decisions: [],
      },
      warning: "Supabase dashboard data timed out. ArchiveOS is running in visibility fallback mode.",
    });
  }
});

app.post("/api/work-logs", async (request, response) => {
  await relayArchiveOsAi(response, "/api/work-logs", jsonProxyRequest("POST", request.body), undefined, request);
});

app.get("/api/commands/recent", async (request, response) => {
  await relayArchiveOsAi(response, "/api/commands/recent", undefined, undefined, request);
});

app.post("/api/commands", async (request, response) => {
  await relayArchiveOsAi(response, "/api/commands", jsonProxyRequest("POST", request.body), undefined, request);
});

app.get("/api/tasks", async (_request, response) => {
  await relayArchiveOsAi(response, "/api/tasks");
});

app.get("/api/tasks/:id", async (request, response) => {
  await relayArchiveOsAi(response, `/api/tasks/${encodeURIComponent(request.params.id)}`);
});

app.post("/api/tasks", async (request, response) => {
  await relayArchiveOsAi(response, "/api/tasks", jsonProxyRequest("POST", request.body), undefined, request);
});

app.patch("/api/tasks/:id", async (request, response) => {
  await relayArchiveOsAi(response, `/api/tasks/${encodeURIComponent(request.params.id)}`, jsonProxyRequest("PATCH", request.body), undefined, request);
});

app.post("/api/tasks/:id/decision", async (request, response) => {
  await relayArchiveOsAi(
    response,
    `/api/tasks/${encodeURIComponent(request.params.id)}/decision`,
    jsonProxyRequest("POST", request.body),
    (payload) => {
      const result = payload as { data?: { task?: { status?: string } } };
      void notifySecurityEvent({
        type: "pm_decision_executed",
        title: "PM decision recorded",
        summary: "A PM decision changed ArchiveOS task state. This did not execute Codex, MCP, shell, or deployment.",
        metadata: {
          task_id: request.params.id,
          action: typeof request.body?.action === "string" ? request.body.action : null,
          status: result.data?.task?.status ?? null,
        },
      });
    },
    request,
  );
});

app.post("/api/tasks/:id/retry", async (request, response) => {
  await relayArchiveOsAi(
    response,
    `/api/tasks/${encodeURIComponent(request.params.id)}/retry`,
    jsonProxyRequest("POST", request.body),
    (payload) => {
      const result = payload as { data?: { task?: { status?: string; current_iteration?: number } } };
      void notifySecurityEvent({
        type: "pm_decision_executed",
        title: "PM retry requested",
        summary: "A PM retry request was recorded. This does not directly execute Codex, MCP, shell, or process control.",
        metadata: {
          task_id: request.params.id,
          status: result.data?.task?.status ?? null,
          current_iteration: result.data?.task?.current_iteration ?? null,
        },
      });
    },
    request,
  );
});

app.post("/api/tasks/:id/callback", async (request, response) => {
  await relayArchiveOsAi(response, `/api/tasks/${encodeURIComponent(request.params.id)}/callback`, jsonProxyRequest("POST", request.body), undefined, request);
});

app.get("/api/tasks/:id/events", async (request, response) => {
  await relayArchiveOsAi(response, `/api/tasks/${encodeURIComponent(request.params.id)}/events`, undefined, undefined, request);
});

app.get("/api/mcp/registry", async (request, response) => {
  await relayArchiveOsAi(response, "/api/mcp/registry", undefined, undefined, request);
});

app.get("/api/runtime/timeline", async (request, response) => {
  const params = new URLSearchParams();
  if (request.query.limit) params.set("limit", String(request.query.limit));
  if (request.query.correlationId) params.set("correlationId", String(request.query.correlationId));
  await relayArchiveOsAi(response, `/api/runtime/timeline?${params.toString()}`, undefined, undefined, request);
});

app.get("/api/contracts/workflow/schema", async (request, response) => {
  await relayArchiveOsAi(response, "/api/contracts/workflow/schema", undefined, undefined, request);
});

app.get("/api/contracts/workflow", async (request, response) => {
  const limit = request.query.limit ? Number(request.query.limit) : 20;
  await relayArchiveOsAi(response, `/api/contracts/workflow?limit=${encodeURIComponent(String(limit))}`, undefined, undefined, request);
});

app.get("/api/contracts/workflow/:correlationId", async (request, response) => {
  await relayArchiveOsAi(response, `/api/contracts/workflow/${encodeURIComponent(request.params.correlationId)}`, undefined, undefined, request);
});

app.get("/api/audit/logs", async (request, response) => {
  const limit = Number(request.query.limit ?? 50);
  await relayArchiveOsAi(response, `/api/audit/logs?limit=${encodeURIComponent(String(limit))}`, undefined, undefined, request);
});

app.get("/api/atlas/overview", async (request, response) => {
  await relayArchiveOsAi(response, "/api/atlas/overview", undefined, undefined, request);
});

app.get("/api/atlas/services", async (request, response) => {
  await relayArchiveOsAi(response, "/api/atlas/services", undefined, undefined, request);
});

app.get("/api/atlas/healthchecks/recent", async (request, response) => {
  const limit = Number(request.query.limit ?? 20);
  await relayArchiveOsAi(response, `/api/atlas/healthchecks/recent?limit=${encodeURIComponent(String(limit))}`, undefined, undefined, request);
});

app.post("/api/atlas/healthchecks/run", async (request, response) => {
  await relayArchiveOsAi(response, "/api/atlas/healthchecks/run", { method: "POST" }, undefined, request);
});

app.get("/api/atlas/work-logs", async (request, response) => {
  const limit = Number(request.query.limit ?? 20);
  await relayArchiveOsAi(response, `/api/atlas/work-logs?limit=${encodeURIComponent(String(limit))}`, undefined, undefined, request);
});

app.post("/api/atlas/work-logs", async (request, response) => {
  await relayArchiveOsAi(response, "/api/atlas/work-logs", jsonProxyRequest("POST", request.body), undefined, request);
});

app.get("/api/managed-systems/overview", async (request, response) => {
  await relayArchiveOsAi(response, "/api/managed-systems/overview", undefined, undefined, request);
});

app.get("/api/managed-systems", async (request, response) => {
  await relayArchiveOsAi(response, "/api/managed-systems", undefined, undefined, request);
});

app.get("/api/managed-systems/:systemId", async (request, response) => {
  await relayArchiveOsAi(response, `/api/managed-systems/${encodeURIComponent(request.params.systemId)}`, undefined, undefined, request);
});

app.get("/api/managed-systems/:systemId/events", async (request, response) => {
  await relayArchiveOsAi(response, `/api/managed-systems/${encodeURIComponent(request.params.systemId)}/events`, undefined, undefined, request);
});

app.get("/api/managed-systems/:systemId/workflows", async (request, response) => {
  await relayArchiveOsAi(response, `/api/managed-systems/${encodeURIComponent(request.params.systemId)}/workflows`, undefined, undefined, request);
});

app.get("/api/managed-systems/:systemId/work-logs", async (request, response) => {
  await relayArchiveOsAi(response, `/api/managed-systems/${encodeURIComponent(request.params.systemId)}/work-logs`, undefined, undefined, request);
});

app.get("/api/pm-inbox", async (request, response) => {
  await relayArchiveOsAi(response, "/api/pm-inbox", undefined, undefined, request);
});

app.post("/api/pm-inbox/:id/acknowledge", async (request, response) => {
  await relayArchiveOsAi(response, `/api/pm-inbox/${encodeURIComponent(request.params.id)}/acknowledge`, { method: "POST" }, undefined, request);
});

app.post("/api/pm-inbox/:id/resolve", async (request, response) => {
  await relayArchiveOsAi(response, `/api/pm-inbox/${encodeURIComponent(request.params.id)}/resolve`, { method: "POST" }, undefined, request);
});

app.get("/api/ecosystem/services", async (request, response) => {
  await relayArchiveOsAi(response, "/api/ecosystem/services", undefined, undefined, request);
});

app.get("/api/ecosystem/summary", async (request, response) => {
  await relayArchiveOsAi(response, "/api/ecosystem/summary", undefined, undefined, request);
});

app.get("/api/ecosystem/topology", async (request, response) => {
  await relayArchiveOsAi(response, "/api/ecosystem/topology", undefined, undefined, request);
});

app.get("/api/ecosystem/timeline", async (request, response) => {
  const limit = Number(request.query.limit ?? 50);
  await relayArchiveOsAi(response, `/api/ecosystem/timeline?limit=${encodeURIComponent(String(limit))}`, undefined, undefined, request);
});

app.get("/api/ecosystem/balance/summary", async (request, response) => {
  await relayArchiveOsAi(response, "/api/ecosystem/balance/summary", undefined, undefined, request);
});

app.get("/api/ecosystem/balance/recommendations", async (request, response) => {
  await relayArchiveOsAi(response, "/api/ecosystem/balance/recommendations", undefined, undefined, request);
});

app.post("/api/ecosystem/balance/simulate", async (request, response) => {
  await relayArchiveOsAi(response, "/api/ecosystem/balance/simulate", jsonProxyRequest("POST", request.body), undefined, request);
});

app.post("/api/ecosystem/refresh", async (request, response) => {
  await relayArchiveOsAi(response, "/api/ecosystem/refresh", { method: "POST" }, undefined, request);
});

app.post("/api/ecosystem/demo/dry-run", async (request, response) => {
  await relayArchiveOsAi(response, "/api/ecosystem/demo/dry-run", { method: "POST" }, undefined, request);
});

app.post("/api/ecosystem/demo/run", async (request, response) => {
  await relayArchiveOsAi(response, "/api/ecosystem/demo/run", { method: "POST" }, undefined, request);
});

app.get("/api/game/settlement-agency/summary", async (request, response) => {
  await relayArchiveOsAi(response, "/api/game/settlement-agency/summary", undefined, undefined, request);
});

app.get("/api/game/settlement-agency/preset", async (request, response) => {
  await relayArchiveOsAi(response, "/api/game/settlement-agency/preset", undefined, undefined, request);
});

app.post("/api/game/settlement-agency/simulate", async (request, response) => {
  const dryRun = request.query.dryRun === undefined ? "true" : String(request.query.dryRun);
  await relayArchiveOsAi(
    response,
    `/api/game/settlement-agency/simulate?dryRun=${encodeURIComponent(dryRun)}`,
    jsonProxyRequest("POST", typeof request.body === "object" && request.body !== null ? request.body : {}),
    undefined,
    request,
  );
});

app.get("/api/game/survival/summary", async (request, response) => {
  await relayArchiveOsAi(response, "/api/game/settlement-agency/summary", undefined, undefined, request);
});

app.get("/api/game/survival/preset", async (request, response) => {
  await relayArchiveOsAi(response, "/api/game/settlement-agency/preset", undefined, undefined, request);
});

app.post("/api/game/survival/simulate", async (request, response) => {
  const dryRun = request.query.dryRun === undefined ? "true" : String(request.query.dryRun);
  await relayArchiveOsAi(
    response,
    `/api/game/settlement-agency/simulate?dryRun=${encodeURIComponent(dryRun)}`,
    jsonProxyRequest("POST", typeof request.body === "object" && request.body !== null ? request.body : {}),
    undefined,
    request,
  );
});

app.get("/api/game/survival/finance", async (request, response) => {
  await relayArchiveOsAi(response, "/api/game/settlement-agency/finance", undefined, undefined, request);
});

app.get("/api/game/survival/finance/:systemId", async (request, response) => {
  await relayArchiveOsAi(response, `/api/game/settlement-agency/finance/${encodeURIComponent(request.params.systemId)}`, undefined, undefined, request);
});

app.get("/api/integrations/nexus/outbox", async (request, response) => {
  await relayArchiveOsAi(response, "/api/integrations/nexus/outbox", undefined, undefined, request);
});

app.post("/api/integrations/nexus/outbox/generate", async (request, response) => {
  const count = Number(request.query.count ?? 100);
  await relayArchiveOsAi(response, `/api/integrations/nexus/outbox/generate?count=${encodeURIComponent(String(count))}`, { method: "POST" }, undefined, request);
});

app.post("/api/integrations/nexus/outbox/publish", async (request, response) => {
  await relayArchiveOsAi(response, "/api/integrations/nexus/outbox/publish", { method: "POST" }, undefined, request);
});

app.get("/api/integrations/market/summary", async (request, response) => {
  await relayArchiveOsAi(response, "/api/integrations/market/summary", undefined, undefined, request);
});

app.get("/api/integrations/market/economy", async (request, response) => {
  await relayArchiveOsAi(response, "/api/integrations/market/economy", undefined, undefined, request);
});

app.get("/api/integrations/market/outbox", async (request, response) => {
  await relayArchiveOsAi(response, "/api/integrations/market/outbox", undefined, undefined, request);
});

app.get("/api/integrations/market/orders", async (request, response) => {
  await relayArchiveOsAi(response, "/api/integrations/market/orders", undefined, undefined, request);
});

app.get("/api/integrations/market/claims", async (request, response) => {
  await relayArchiveOsAi(response, "/api/integrations/market/claims", undefined, undefined, request);
});

app.get("/api/integrations/market/returns", async (request, response) => {
  await relayArchiveOsAi(response, "/api/integrations/market/returns", undefined, undefined, request);
});

app.post("/api/integrations/market/events/review", async (request, response) => {
  await relayArchiveOsAi(response, "/api/integrations/market/events/review", jsonProxyRequest("POST", request.body), undefined, request);
});

app.get("/api/live-flow/summary", async (request, response) => {
  await relayArchiveOsAi(response, "/api/live-flow/summary", undefined, undefined, request);
});

app.get("/api/live-flow/topology", async (request, response) => {
  await relayArchiveOsAi(response, "/api/live-flow/topology", undefined, undefined, request);
});

app.get("/api/live-flow/events/recent", async (request, response) => {
  const limit = request.query.limit ? `?limit=${encodeURIComponent(String(request.query.limit))}` : "";
  await relayArchiveOsAi(response, `/api/live-flow/events/recent${limit}`, undefined, undefined, request);
});

// Backward-compatible short alias used by console smoke checks and read-only clients.
app.get("/api/live-flow/recent", async (request, response) => {
  const limit = request.query.limit ? `?limit=${encodeURIComponent(String(request.query.limit))}` : "";
  await relayArchiveOsAi(response, `/api/live-flow/events/recent${limit}`, undefined, undefined, request);
});

app.get("/api/live-flow/stream", async (request, response) => {
  await relayArchiveOsAiSse(request, response, "/api/live-flow/stream");
});

app.get("/api/live-flow/replay", async (request, response) => {
  const params = new URLSearchParams();
  for (const key of ["from", "to", "limit"]) {
    if (request.query[key]) params.set(key, String(request.query[key]));
  }
  const query = params.toString();
  await relayArchiveOsAi(response, `/api/live-flow/replay${query ? `?${query}` : ""}`, undefined, undefined, request);
});

app.get("/api/live-flow/correlation/:id", async (request, response) => {
  await relayArchiveOsAi(response, `/api/live-flow/correlation/${encodeURIComponent(request.params.id)}`, undefined, undefined, request);
});

app.get("/api/live-flow/entity/:id", async (request, response) => {
  await relayArchiveOsAi(response, `/api/live-flow/entity/${encodeURIComponent(request.params.id)}`, undefined, undefined, request);
});

app.post("/api/live-flow/refresh", async (request, response) => {
  await relayArchiveOsAi(response, "/api/live-flow/refresh", { method: "POST" }, undefined, request);
});

app.get("/api/world/assets", async (request, response) => {
  await relayArchiveOsAi(response, "/api/world/assets", undefined, undefined, request);
});
app.get("/api/world/layout", async (request, response) => {
  await relayArchiveOsAi(response, "/api/world/layout", undefined, undefined, request);
});
app.get("/api/world/events", async (request, response) => {
  const params = new URLSearchParams();
  if (request.query.limit) params.set("limit", String(request.query.limit));
  if (request.query.correlationId) params.set("correlationId", String(request.query.correlationId));
  await relayArchiveOsAi(response, `/api/world/events${params.size ? `?${params.toString()}` : ""}`, undefined, undefined, request);
});
app.get("/api/world/state", async (request, response) => {
  await relayArchiveOsAi(response, "/api/world/state", undefined, undefined, request);
});
app.get("/api/world/stream", async (request, response) => {
  await relayArchiveOsAiSse(request, response, "/api/world/stream");
});

app.get("/api/workforce/overview", async (request, response) => {
  await relayArchiveOsAi(response, "/api/workforce/overview", undefined, undefined, request);
});

app.get("/api/workforce/bottlenecks", async (request, response) => {
  await relayArchiveOsAi(response, "/api/workforce/bottlenecks", undefined, undefined, request);
});

app.get("/api/workforce/recommendations", async (request, response) => {
  await relayArchiveOsAi(response, "/api/workforce/recommendations", undefined, undefined, request);
});

app.get("/api/workforce/productivity-trend", async (request, response) => {
  await relayArchiveOsAi(response, "/api/workforce/productivity-trend", undefined, undefined, request);
});

app.get("/api/integrations/logitics/summary", async (request, response) => {
  await relayArchiveOsAi(response, "/api/integrations/logitics/summary", undefined, undefined, request);
});

app.get("/api/integrations/logitics/outbox", async (request, response) => {
  await relayArchiveOsAi(response, "/api/integrations/logitics/outbox", undefined, undefined, request);
});

app.get("/api/integrations/logitics/routes", async (request, response) => {
  await relayArchiveOsAi(response, "/api/integrations/logitics/routes", undefined, undefined, request);
});

app.post("/api/integrations/logitics/outbox/publish", async (request, response) => {
  await relayArchiveOsAi(response, "/api/integrations/logitics/outbox/publish", { method: "POST" }, undefined, request);
});

app.get("/api/integrations/ledger/summary", async (request, response) => {
  await relayArchiveOsAi(response, "/api/integrations/ledger/summary", undefined, undefined, request);
});

app.get("/api/integrations/ledger/approval-required", async (request, response) => {
  await relayArchiveOsAi(response, "/api/integrations/ledger/approval-required", undefined, undefined, request);
});

app.get("/api/integrations/ledger/reconciliation", async (request, response) => {
  await relayArchiveOsAi(response, "/api/integrations/ledger/reconciliation", undefined, undefined, request);
});

app.get("/api/approvals/callbacks", async (request, response) => {
  const limit = Number(request.query.limit ?? 50);
  await relayArchiveOsAi(response, `/api/approvals/callbacks?limit=${encodeURIComponent(String(limit))}`, undefined, undefined, request);
});

app.post("/api/approvals/callbacks/retry-failed", async (request, response) => {
  await relayArchiveOsAi(response, "/api/approvals/callbacks/retry-failed", { method: "POST" }, undefined, request);
});

app.get("/api/approvals/callbacks/:callbackId", async (request, response) => {
  await relayArchiveOsAi(response, `/api/approvals/callbacks/${encodeURIComponent(request.params.callbackId)}`, undefined, undefined, request);
});

app.post("/api/approvals/callbacks/:callbackId/retry", async (request, response) => {
  await relayArchiveOsAi(response, `/api/approvals/callbacks/${encodeURIComponent(request.params.callbackId)}/retry`, { method: "POST" }, undefined, request);
});

app.get("/api/approvals/external/summary", async (request, response) => {
  await relayArchiveOsAi(response, "/api/approvals/external/summary", undefined, undefined, request);
});

app.get("/api/approvals/external", async (request, response) => {
  const params = new URLSearchParams();
  params.set("limit", String(Number(request.query.limit ?? 50)));
  if (typeof request.query.status === "string") params.set("status", request.query.status);
  if (typeof request.query.source === "string") params.set("source", request.query.source);
  await relayArchiveOsAi(response, `/api/approvals/external?${params.toString()}`, undefined, undefined, request);
});

app.post("/api/approvals/external", async (request, response) => {
  await relayArchiveOsAi(response, "/api/approvals/external", jsonProxyRequest("POST", request.body), undefined, request);
});

app.get("/api/approvals/external/:id", async (request, response) => {
  await relayArchiveOsAi(response, `/api/approvals/external/${encodeURIComponent(request.params.id)}`, undefined, undefined, request);
});

app.post("/api/approvals/external/:id/approve", async (request, response) => {
  await relayArchiveOsAi(response, `/api/approvals/external/${encodeURIComponent(request.params.id)}/approve`, jsonProxyRequest("POST", request.body), undefined, request);
});

app.post("/api/approvals/external/:id/reject", async (request, response) => {
  await relayArchiveOsAi(response, `/api/approvals/external/${encodeURIComponent(request.params.id)}/reject`, jsonProxyRequest("POST", request.body), undefined, request);
});

app.post("/api/approvals/external/:id/hold", async (request, response) => {
  await relayArchiveOsAi(response, `/api/approvals/external/${encodeURIComponent(request.params.id)}/hold`, jsonProxyRequest("POST", request.body), undefined, request);
});

app.get("/api/queue/summary", async (_request, response) => {
  await relayArchiveOsAi(response, "/api/queue/summary");
});

// Local/admin/testing endpoint only. This does not execute Codex, MCP, shell, deployment, git, or process control.
app.post("/api/queue/run-once", async (_request, response) => {
  try {
    response.json({ data: await runQueueOnce() });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : "Failed to run queue once." });
  }
});

// Local/admin/testing endpoint only. Spring owns Slack delivery and configuration.
app.post("/api/queue/nightly-summary", async (_request, response) => {
  try {
    response.json({ data: await runNightlyQueueSummary() });
  } catch {
    response.status(500).json({ error: "Failed to create queue nightly summary." });
  }
});

app.get("/api/local-actions/projects", (_request, response) => {
  response.json({
    data: projects.map((project) => ({
      id: project.id,
      name: project.name,
      path: project.path,
      repo: project.repo,
    })),
  });
});

app.post("/api/local-actions/run", async (request, response) => {
  const validation = validateLocalActionBody(request.body);

  if (!validation.ok) {
    response.status(400).json({ error: validation.error });
    return;
  }

  const project = findProject(validation.value.project_id);

  if (!project) {
    response.status(400).json({ error: "Unknown project_id." });
    return;
  }

  const result = await runLocalAction(project.path, validation.value.action);
  const commandStatus = result.status;
  const commandResult = summarizeCommandOutput(result.stdout, result.stderr);

  const { error } = await supabaseAdmin.from("command_runs").insert({
    command: result.action,
    command_type: "local_action",
    status: commandStatus,
    result: commandResult,
  });

  if (error) {
    response.status(500).json({ error: "Local action ran but failed to record command result." });
    return;
  }

  response.json(result);
});

app.get("/api/local-runtime/status", async (_request, response) => {
  try {
    const status = await getLocalRuntimeStatus();
    response.json({ data: status });
  } catch {
    response.status(500).json({ error: "Failed to read local runtime status." });
  }
});

app.get("/api/runtime/events/recent", async (_request, response) => {
  try {
    const events = await getRecentRuntimeEvents();
    response.json({ data: events });
  } catch {
    response.status(500).json({ error: "Failed to fetch runtime events." });
  }
});

// Local/admin/testing endpoint only. This records a read-only batch summary and does not trigger agent execution.
app.post("/api/batches/nightly-review/run", async (request, response) => {
  await relayArchiveOsAi(response, "/api/batches/nightly-review/run", { method: "POST" }, undefined, request);
});

// Local/admin/testing endpoint only. This may send Slack only when the Korea business-day rule passes.
app.post("/api/batches/daily-report/run", async (request, response) => {
  await relayArchiveOsAi(response, "/api/batches/daily-report/run", { method: "POST" }, undefined, request);
});

app.get("/api/batches/recent", async (request, response) => {
  try {
    const limit = Number(request.query.limit ?? 20);
    response.status(200).json(await proxyArchiveOsAi(`/api/batches/recent?limit=${encodeURIComponent(String(limit))}`));
  } catch (error) {
    sendProxyError(response, error, "Recent batch runs are unavailable.");
  }
});

app.get("/api/batches/latest", async (_request, response) => {
  try {
    response.status(200).json(await proxyArchiveOsAi("/api/batches/latest"));
  } catch (error) {
    sendProxyError(response, error, "Latest batch status is unavailable.");
  }
});

app.get("/api/reports/daily/latest", async (_request, response) => {
  try {
    response.status(200).json(await proxyArchiveOsAi("/api/reports/daily/latest"));
  } catch (error) {
    sendProxyError(response, error, "Latest daily report is unavailable.");
  }
});

app.get("/api/reports/daily/recent", async (request, response) => {
  try {
    const limit = Number(request.query.limit ?? 20);
    response.status(200).json(await proxyArchiveOsAi(`/api/reports/daily/recent?limit=${encodeURIComponent(String(limit))}`));
  } catch (error) {
    sendProxyError(response, error, "Recent daily reports are unavailable.");
  }
});

app.get("/api/runtime/snapshots/recent", async (request, response) => {
  try {
    const limit = Number(request.query.limit ?? 20);
    response.status(200).json(await proxyArchiveOsAi(`/api/runtime/snapshots/recent?limit=${encodeURIComponent(String(limit))}`));
  } catch (error) {
    sendProxyError(response, error, "Runtime snapshots are unavailable.");
  }
});

app.get("/api/historian/status", async (_request, response) => {
  try {
    const configured = isHistorianConfigured();
    const lastExport = await getLatestHistorianExport().catch(() => null);
    response.json({
      data: {
        configured,
        enabled: configured,
        lastExport: lastExport
          ? {
              type: lastExport.note_type,
              status: lastExport.status,
              notePath: lastExport.note_path,
              createdAt: lastExport.created_at,
              reason: lastExport.reason,
            }
          : null,
      },
    });
  } catch {
    response.status(500).json({ error: "Failed to fetch Historian status." });
  }
});

app.get("/api/knowledge/overview", async (_request, response) => {
  await relayArchiveOsAi(response, "/api/knowledge/overview");
});

app.get("/api/knowledge/health", async (_request, response) => {
  await relayArchiveOsAi(response, "/api/knowledge/health");
});

app.get("/api/knowledge/recent", async (request, response) => {
  const limit = readLimit(request.query.limit);
  await relayArchiveOsAi(response, `/api/knowledge/recent?limit=${encodeURIComponent(String(limit))}`);
});

app.get("/api/knowledge/search", async (request, response) => {
  const query = typeof request.query.q === "string" ? request.query.q : "";
  const limit = readLimit(request.query.limit);
  await relayArchiveOsAi(response, `/api/knowledge/search?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(String(limit))}`);
});

app.get("/api/knowledge/related", async (request, response) => {
  const params = new URLSearchParams();
  if (typeof request.query.external_ref === "string") params.set("external_ref", request.query.external_ref);
  if (typeof request.query.node_type === "string") params.set("node_type", request.query.node_type);
  await relayArchiveOsAi(response, `/api/knowledge/related?${params}`);
});

app.get("/api/knowledge/graph", async (request, response) => {
  const limit = readGraphLimit(request.query.limit ?? "100");
  await relayArchiveOsAi(response, `/api/knowledge/graph?limit=${encodeURIComponent(String(limit))}`);
});

app.get("/api/knowledge/map", async (request, response) => {
  const limit = readGraphLimit(request.query.limit ?? "100");
  await relayArchiveOsAi(response, `/api/knowledge/map?limit=${encodeURIComponent(String(limit))}`);
});

app.get("/api/knowledge/graph/insights", async (request, response) => {
  const limit = readGraphLimit(request.query.limit ?? "100");
  await relayArchiveOsAi(response, `/api/knowledge/graph/insights?limit=${encodeURIComponent(String(limit))}`);
});

app.get("/api/knowledge/map/insights", async (request, response) => {
  const limit = readGraphLimit(request.query.limit ?? "100");
  await relayArchiveOsAi(response, `/api/knowledge/map/insights?limit=${encodeURIComponent(String(limit))}`);
});

app.get("/api/knowledge/node/:id", async (request, response) => {
  await relayArchiveOsAi(response, `/api/knowledge/node/${encodeURIComponent(request.params.id)}`);
});

// Local/admin/manual-test endpoint only. It records a deterministic architecture review and does not execute commands.
app.post("/api/architect/review", async (request, response) => {
  await relayArchiveOsAi(response, "/api/architect/review", jsonProxyRequest("POST", request.body), undefined, request);
});

app.get("/api/architect/reviews/recent", async (request, response) => {
  const limit = readLimit(request.query.limit);
  await relayArchiveOsAi(response, `/api/architect/reviews/recent?limit=${encodeURIComponent(String(limit))}`);
});

app.get("/api/architect/reviews/latest", async (_request, response) => {
  await relayArchiveOsAi(response, "/api/architect/reviews/latest");
});

app.get("/api/mesh/overview", async (_request, response) => {
  try {
    response.json({ data: await withTimeout(getAgentMeshOverview(), 4500, "Agent Mesh overview timed out.") });
  } catch {
    response.json({
      data: {
        agents: [],
        links: [],
        recentInteractions: [],
        health: {
          status: "warning",
          summary: "Agent Mesh data is temporarily unavailable. Runtime remains read-only.",
        },
      },
    });
  }
});

app.get("/api/kpi/overview", async (request, response) => {
  try {
    response.json({ data: await withTimeout(getKpiOverview(normalizeRange(request.query.range)), 4500, "KPI overview timed out.") });
  } catch {
    const range = normalizeRange(request.query.range);
    response.json({ data: createEmptyKpiOverview(range, "KPI data is temporarily unavailable. Run batches or check Supabase connectivity.") });
  }
});

app.use(
  (
    error: Error,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error.message === "Origin not allowed by CORS.") {
      response.status(400).json({ error: "Origin not allowed by CORS." });
      return;
    }

    if ((error as { status?: number }).status === 400) {
      response.status(400).json({ error: "Invalid JSON request body." });
      return;
    }

    response.status(500).json({ error: "Internal server error." });
  },
);

app.listen(port, () => {
  console.log(`archiveos-backend listening on port ${port}`);
});

type LocalAction =
  | "git_status"
  | "git_branch"
  | "git_log_recent"
  | "frontend_build"
  | "backend_typecheck"
  | "backend_build"
  | "runtime_status"
  | "runtime_start_all"
  | "runtime_stop_all"
  | "runtime_restart_all";

type LocalActionBody = {
  project_id: string;
  action: LocalAction;
};

type ArchitectReviewBody = {
  targetType: string;
  targetRef: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
};

type LocalActionResult = {
  action: LocalAction;
  status: "succeeded" | "failed";
  stdout: string;
  stderr: string;
  exitCode: number;
};

type RuntimeEvent = {
  id: string;
  type: "queue" | "builder" | "reviewer" | "command" | "decision" | "warning" | "batch" | "task";
  title: string;
  description: string;
  status: "info" | "success" | "warning" | "error";
  source: "mcp" | "supabase" | "backend";
  created_at: string;
};

type LocalActionValidationResult =
  | { ok: true; value: LocalActionBody }
  | { ok: false; error: string };

type ArchitectReviewValidationResult =
  | { ok: true; value: ArchitectReviewBody }
  | { ok: false; error: string };

function validateArchitectReviewBody(body: unknown): ArchitectReviewValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const candidate = body as Record<string, unknown>;
  const targetType = readRequiredString(candidate.targetType, "targetType");
  const targetRef = readRequiredString(candidate.targetRef, "targetRef");
  const title = readRequiredString(candidate.title, "title");
  const description = readRequiredString(candidate.description, "description");

  if (!targetType.ok) return targetType;
  if (!targetRef.ok) return targetRef;
  if (!title.ok) return title;
  if (!description.ok) return description;

  if (candidate.metadata !== undefined && (candidate.metadata === null || typeof candidate.metadata !== "object" || Array.isArray(candidate.metadata))) {
    return { ok: false, error: "metadata must be a JSON object when provided." };
  }

  return {
    ok: true,
    value: {
      targetType: targetType.value,
      targetRef: targetRef.value,
      title: title.value,
      description: description.value,
      metadata: candidate.metadata as Record<string, unknown> | undefined,
    },
  };
}

function readRequiredString(value: unknown, name: string): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { ok: false, error: `${name} is required.` };
  }

  return { ok: true, value: value.trim() };
}

function readLimit(value: unknown) {
  const numeric = typeof value === "string" ? Number(value) : 20;
  return Number.isFinite(numeric) ? Math.min(Math.max(Math.floor(numeric), 1), 100) : 20;
}

function readGraphLimit(value: unknown) {
  const numeric = typeof value === "string" ? Number(value) : 100;
  return Number.isFinite(numeric) ? Math.min(Math.max(Math.floor(numeric), 1), 300) : 100;
}

function createEmptyKpiOverview(range: ReturnType<typeof normalizeRange>, note: string) {
  return {
    range,
    generatedAt: new Date().toISOString(),
    productivity: {
      tasksCompleted: null,
      reviewsCompleted: null,
      decisionsRecorded: null,
      commandsRecorded: null,
      dailyReportsSent: null,
      nightlyReviewsCompleted: null,
    },
    quality: {
      reviewApproveCount: null,
      reviewRejectCount: null,
      reviewStopCount: null,
      approvalRate: null,
      architectReviewCount: null,
      architectWarningCount: null,
      architectBlockedCount: null,
    },
    runtime: {
      latestInbox: null,
      latestProcessing: null,
      latestOutbox: null,
      latestReviews: null,
      latestStatus: "unknown",
      warningCount: null,
      loopDetectedRate: null,
    },
    knowledge: {
      totalNodes: null,
      totalEdges: null,
      nodesCreatedInRange: null,
      edgesCreatedInRange: null,
      obsidianExports: null,
      graphDensity: null,
    },
    trends: {
      dailyReports: [],
      decisions: [],
      knowledgeNodes: [],
      warnings: [],
    },
    notes: [note],
  };
}

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function getServiceHealth() {
  const checks = await Promise.allSettled([
    withTimeout(getLocalRuntimeStatus(), 2500, "Runtime status check timed out."),
    withTimeout(getJavaKnowledgeHealth(), 2500, "Knowledge health check timed out."),
    withTimeout(getAgentMeshOverview(), 2500, "Agent Mesh check timed out."),
    withTimeout(getKpiOverview("7d"), 2500, "KPI check timed out."),
    withTimeout(getLatestArchitectureReview(), 2500, "Architect check timed out."),
    withTimeout(getLatestDailyReport(), 2500, "Daily report check timed out."),
    withTimeout(proxyArchiveOsAi("/api/queue/summary"), 2500, "Queue summary check timed out."),
    withTimeout(getSecurityStatus(), 2500, "Security status check timed out."),
    withTimeout(Promise.resolve(getAxReadiness()), 2500, "AX readiness check timed out."),
  ]);

  return {
    ax: checks[8].status === "fulfilled",
    backend: true,
    runtime: checks[0].status === "fulfilled",
    knowledge: checks[1].status === "fulfilled" && checks[1].value === true,
    mesh: checks[2].status === "fulfilled",
    kpi: checks[3].status === "fulfilled",
    architect: checks[4].status === "fulfilled",
    dailyReport: checks[5].status === "fulfilled",
    queue: checks[6].status === "fulfilled",
    security: checks[7].status === "fulfilled",
  } satisfies Record<HealthServiceKey, boolean>;
}

async function getEndpointHealthSnapshot() {
  const checkedAt = new Date().toISOString();
  const services = await getServiceHealth();
  const endpoints = endpointRegistry.map((endpoint) => {
    const online = services[endpoint.service];
    return {
      ...endpoint,
      status: online ? "ok" : "error",
      httpStatus: online ? 200 : 503,
      message: online
        ? "Registered and service dependency check passed."
        : `${endpoint.service} dependency check failed.`,
    };
  });
  const failed = endpoints.filter((endpoint) => endpoint.status === "error").length;

  return {
    checkedAt,
    endpoints,
    summary: {
      total: endpoints.length,
      online: endpoints.length - failed,
      failed,
      missing: 0,
      ok: endpoints.length - failed,
      error: failed,
      unknown: 0,
    },
  };
}

async function getRuntimeVersion() {
  const [commitSha, branch] = await Promise.all([
    readGitValue(["rev-parse", "--short", "HEAD"]),
    readGitValue(["branch", "--show-current"]),
  ]);

  return {
    commitSha,
    branch,
    startedAt,
    backendVersion: process.env.npm_package_version ?? null,
    checkedAt: new Date().toISOString(),
  };
}

async function readGitValue(args: string[]) {
  try {
    const result = await execFileAsync("git", args, {
      cwd: process.cwd(),
      windowsHide: true,
      timeout: 5000,
    });
    const value = result.stdout.trim();
    return value.length ? value : null;
  } catch {
    return null;
  }
}

async function getPlatformReadiness() {
  const [endpointHealth, knowledge, mesh, latestArchitect, latestDailyReport, kpi] = await Promise.all([
    getEndpointHealthSnapshot(),
    getJavaKnowledgeOverview().catch(() => null),
    getAgentMeshOverview().catch(() => null),
    getLatestArchitectureReview().catch(() => null),
    getLatestDailyReport().catch(() => null),
    getKpiOverview("7d").catch(() => null),
  ]);

  const notes: string[] = [];
  const issues: string[] = [];
  const endpointCoverage = Math.round(
    (endpointHealth.summary.online / Math.max(endpointHealth.summary.total, 1)) * 100,
  );

  if (endpointHealth.summary.failed > 0) {
    issues.push(`${endpointHealth.summary.failed} registered endpoint groups have failed dependencies.`);
  }

  const dashboardCoverage = averageScore([
    endpointHealth.endpoints.some((endpoint) => endpoint.path === "/api/local-runtime/status" && endpoint.status === "ok") ? 100 : 0,
    latestDailyReport ? 100 : 70,
    mesh ? 100 : 0,
    kpi ? 100 : 0,
    knowledge ? 100 : 0,
  ]);

  if (!latestDailyReport) {
    notes.push("No stored daily report exists yet; dashboard uses an empty state.");
  }

  const knowledgeCoverage = knowledge
    ? Math.min(100, (knowledge.totalNodes > 0 ? 45 : 0) + (knowledge.totalEdges > 0 ? 45 : 0) + (knowledge.latestNodes.length > 0 ? 10 : 0))
    : 0;

  if (!knowledge || knowledge.totalNodes === 0) {
    issues.push("Knowledge Graph has no nodes yet.");
  }

  const meshCoverage = mesh
    ? Math.min(
        100,
        (mesh.agents.length >= 6 ? 45 : mesh.agents.length > 0 ? 30 : 0) +
          (mesh.links.length > 0 ? 35 : 0) +
          (mesh.recentInteractions.length > 0 ? 20 : 10),
      )
    : 0;

  if (!mesh) {
    issues.push("Agent Mesh overview is unavailable.");
  }

  const architectCoverage = latestArchitect ? 100 : endpointHealth.endpoints.some(
    (endpoint) => endpoint.service === "architect" && endpoint.status === "ok",
  )
    ? 65
    : 0;

  if (!latestArchitect) {
    notes.push("Architect endpoint is registered, but no architecture review has been recorded yet.");
  }

  const score = Math.round(
    endpointCoverage * 0.35 +
      dashboardCoverage * 0.2 +
      knowledgeCoverage * 0.15 +
      meshCoverage * 0.15 +
      architectCoverage * 0.15,
  );

  if (kpi?.notes.length) {
    notes.push(...kpi.notes.slice(0, 3));
  }

  return {
    score,
    grade: scoreToGrade(score),
    generatedAt: new Date().toISOString(),
    coverage: {
      endpoint: endpointCoverage,
      dashboard: dashboardCoverage,
      knowledge: knowledgeCoverage,
      mesh: meshCoverage,
      architect: architectCoverage,
    },
    issues,
    notes,
  };
}

function averageScore(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function scoreToGrade(score: number) {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "B+";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  return "Needs work";
}

async function getRecentRuntimeEvents(): Promise<RuntimeEvent[]> {
  const checkedAt = new Date().toISOString();
  const [runtimeResult, commandsResult, decisionsResult, batchRuns, taskEvents] = await Promise.all([
    withTimeout(getLocalRuntimeStatus(), 2500, "Runtime status timed out.").catch(() => null),
    withTimeout(
      supabaseAdmin
        .from("command_runs")
        .select("id, command, command_type, status, result, created_at")
        .not("id", "in", `(${seedCommandRunIds.join(",")})`)
        .order("created_at", { ascending: false })
        .limit(5),
      2500,
      "command_runs query timed out.",
    ).catch(() => ({ data: [], error: null })),
    withTimeout(
      supabaseAdmin
        .from("work_logs")
        .select("id, log_type, content, created_at, task:tasks(title), agent:agents(name)")
        .eq("log_type", "decision")
        .not("id", "in", `(${seedWorkLogIds.join(",")})`)
        .order("created_at", { ascending: false })
        .limit(5),
      2500,
      "decision work_logs query timed out.",
    ).catch(() => ({ data: [], error: null })),
    withTimeout(getRecentBatchRuns(5), 2500, "Batch runs timed out.").catch(() => []),
    withTimeout(getTaskEvents(10), 2500, "Task events timed out.").catch(() => []),
  ]);
  const runtime =
    runtimeResult ??
    ({
      checked_at: checkedAt,
      status: "unknown",
      queue: { path: null, inbox: 0, processing: 0, outbox: 0, reviews: 0 },
      active_task: null,
      processes: { implementer: null, reviewer: null, loop: null, reviewer_bridge: null },
      latest: { inbox: null, processing: null, outbox: null, review: null },
      latest_details: { builder: null, reviewer: null },
      judgement: "Runtime status timed out.",
    } as Awaited<ReturnType<typeof getLocalRuntimeStatus>>);

  const events: RuntimeEvent[] = [];

  events.push({
    id: `queue-${runtime.checked_at}`,
    type: "queue",
    title: runtime.status === "working" ? "Queue is processing" : "Queue snapshot updated",
    description: `Inbox ${runtime.queue.inbox}, processing ${runtime.queue.processing}, outbox ${runtime.queue.outbox}, reviews ${runtime.queue.reviews}.`,
    status: runtime.status === "unknown" ? "warning" : "info",
    source: "mcp",
    created_at: runtime.checked_at,
  });

  if (runtime.latest.processing) {
    events.push({
      id: `processing-${runtime.latest.processing.name}`,
      type: "queue",
      title: "Processing task active",
      description: runtime.active_task ?? runtime.latest.processing.name,
      status: runtime.processes.implementer ? "info" : "warning",
      source: "mcp",
      created_at: runtime.latest.processing.updated_at,
    });
  }

  if (runtime.latest_details.builder) {
    const builder = runtime.latest_details.builder;
    events.push({
      id: `builder-${builder.task_id ?? runtime.latest.outbox?.name ?? builder.finished_at ?? checkedAt}`,
      type: "builder",
      title: builder.status === "done" ? "Builder result completed" : "Builder result recorded",
      description: summarizeEventDescription(builder.summary ?? runtime.latest.outbox?.name ?? "No builder summary captured."),
      status: builder.status === "done" ? "success" : builder.status === "failed" ? "error" : "info",
      source: "mcp",
      created_at: builder.finished_at ?? runtime.latest.outbox?.updated_at ?? checkedAt,
    });
  }

  if (runtime.latest_details.reviewer) {
    const reviewer = runtime.latest_details.reviewer;
    events.push({
      id: `reviewer-${reviewer.reviewed_task_id ?? runtime.latest.review?.name ?? reviewer.reviewed_at ?? checkedAt}`,
      type: "reviewer",
      title: reviewer.verdict === "stop" ? "Reviewer stopped pipeline" : "Reviewer decision recorded",
      description: summarizeEventDescription(
        reviewer.next_task_id
          ? `${reviewer.summary ?? "Reviewer queued next task."} Next: ${reviewer.next_task_id}`
          : reviewer.summary ?? runtime.latest.review?.name ?? "No reviewer summary captured.",
      ),
      status: reviewer.verdict === "stop" ? "warning" : reviewer.verdict === "request_changes" ? "error" : "success",
      source: "mcp",
      created_at: reviewer.reviewed_at ?? runtime.latest.review?.updated_at ?? checkedAt,
    });
  }

  if (runtime.judgement) {
    events.push({
      id: `judgement-${runtime.checked_at}`,
      type: runtime.status === "working" ? "queue" : "warning",
      title: runtime.status === "working" ? "Runtime judgement: work in progress" : "Runtime judgement",
      description: runtime.judgement,
      status: runtime.status === "working" ? "info" : runtime.queue.processing > 0 ? "warning" : "info",
      source: "backend",
      created_at: runtime.checked_at,
    });
  }

  for (const command of commandsResult.data ?? []) {
    events.push({
      id: `command-${command.id}`,
      type: "command",
      title: `Command recorded: ${command.command}`,
      description: summarizeEventDescription(command.result ?? command.command_type ?? "Command intent recorded."),
      status: command.status === "failed" ? "error" : command.status === "succeeded" ? "success" : "info",
      source: "supabase",
      created_at: command.created_at,
    });
  }

  for (const decision of decisionsResult.data ?? []) {
    events.push({
      id: `decision-${decision.id}`,
      type: "decision",
      title: "Decision recorded",
      description: summarizeEventDescription(decision.content),
      status: "info",
      source: "supabase",
      created_at: decision.created_at,
    });
  }

  for (const batch of batchRuns) {
    events.push({
      id: `batch-${batch.id}`,
      type: "batch",
      title:
        batch.batch_type === "nightly_review"
          ? "nightly_review_completed"
          : batch.status === "sent"
            ? "daily_report_sent"
            : batch.status === "skipped"
              ? "daily_report_skipped"
              : "daily_report_failed",
      description: summarizeEventDescription(batch.summary),
      status: batch.status === "failed" ? "error" : batch.status === "skipped" ? "warning" : "success",
      source: "backend",
      created_at: batch.created_at,
    });
  }

  for (const event of taskEvents) {
    events.push({
      id: `pm-task-${event.id}`,
      type: "task",
      title: event.event_type,
      description: summarizeEventDescription(event.description ?? event.title),
      status: event.event_type.includes("failed") ? "error" : event.event_type.includes("held") ? "warning" : "info",
      source: "backend",
      created_at: event.created_at,
    });
  }

  return events
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 20);
}

function summarizeEventDescription(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > 180 ? `${clean.slice(0, 180)}...` : clean;
}

function validateLocalActionBody(body: unknown): LocalActionValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const candidate = body as Record<string, unknown>;

  if (typeof candidate.project_id !== "string" || candidate.project_id.trim().length === 0) {
    return { ok: false, error: "project_id is required." };
  }

  if (typeof candidate.action !== "string" || !localActionTypes.has(candidate.action)) {
    return {
      ok: false,
      error: `action must be one of ${Array.from(localActionTypes).join(", ")}.`,
    };
  }

  return {
    ok: true,
    value: {
      project_id: candidate.project_id,
      action: candidate.action as LocalAction,
    },
  };
}

function resolveProjectRoot(projectPath: string) {
  return path.basename(projectPath).toLowerCase() === "backend" ? path.dirname(projectPath) : projectPath;
}

function runLocalAction(projectPath: string, action: LocalAction): Promise<LocalActionResult> {
  const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
  const rootPath = resolveProjectRoot(projectPath);
  const backendPath = path.join(rootPath, "backend");
  const runtimeDir = path.join(rootPath, "tools", "runtime");
  const runtimeScript = (name: string) => path.join(runtimeDir, name);
  const powershell = process.platform === "win32" ? "powershell.exe" : "pwsh";
  const definitions: Record<LocalAction, { command: string; args: string[]; cwd: string; timeoutMs?: number }> = {
    git_status: { command: "git", args: ["status", "--short"], cwd: rootPath },
    git_branch: { command: "git", args: ["branch", "--show-current"], cwd: rootPath },
    git_log_recent: { command: "git", args: ["log", "--oneline", "-5"], cwd: rootPath },
    frontend_build: { command: npmExecutable, args: ["run", "build"], cwd: rootPath, timeoutMs: 120000 },
    backend_typecheck: { command: npmExecutable, args: ["run", "typecheck"], cwd: backendPath },
    backend_build: { command: npmExecutable, args: ["run", "build"], cwd: backendPath },
    runtime_status: { command: powershell, args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", runtimeScript("status.ps1")], cwd: rootPath },
    runtime_start_all: { command: powershell, args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", runtimeScript("start-all.ps1")], cwd: rootPath },
    runtime_stop_all: { command: powershell, args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", runtimeScript("stop-all.ps1")], cwd: rootPath },
    runtime_restart_all: { command: powershell, args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", `& '${runtimeScript("stop-all.ps1").replace(/'/g, "''")}'; & '${runtimeScript("start-all.ps1").replace(/'/g, "''")}'`], cwd: rootPath },
  };

  const definition = definitions[action];

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const child = spawn(definition.command, definition.args, {
      cwd: definition.cwd,
      shell: false,
      windowsHide: true,
    });

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      child.kill("SIGTERM");
      resolve({
        action,
        status: "failed",
        stdout: truncateOutput(stdout),
        stderr: truncateOutput(`${stderr}\nCommand timed out after 60000ms.`.trim()),
        exitCode: -1,
      });
    }, definition.timeoutMs ?? 60000);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve({
        action,
        status: "failed",
        stdout: truncateOutput(stdout),
        stderr: truncateOutput(`${stderr}\n${error.message}`.trim()),
        exitCode: -1,
      });
    });

    child.on("close", (exitCode) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve({
        action,
        status: exitCode === 0 ? "succeeded" : "failed",
        stdout: truncateOutput(stdout),
        stderr: truncateOutput(stderr),
        exitCode: exitCode ?? -1,
      });
    });
  });
}

function summarizeCommandOutput(stdout: string, stderr: string) {
  return truncateOutput([stdout.trim(), stderr.trim()].filter(Boolean).join("\n\n"));
}

function truncateOutput(value: string) {
  const maxLength = 12000;

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n[output truncated]`;
}

async function proxyArchiveOsAi(path: string, init?: RequestInit) {
  const baseUrl = process.env.ARCHIVEOS_AI_BASE_URL?.trim() || "http://localhost:4100";
  const response = await fetch(`${baseUrl}${path}`, init);
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const message = typeof payload?.error === "string" ? payload.error : `ArchiveOS AI request failed with status ${response.status}.`;
    throw new ArchiveOsAiProxyError(message, response.status, payload);
  }

  return payload;
}

type JavaKnowledgeOverview = {
  totalNodes: number;
  totalEdges: number;
  latestNodes: unknown[];
};

async function getJavaKnowledgeOverview(): Promise<JavaKnowledgeOverview> {
  const payload = await proxyArchiveOsAi("/api/knowledge/overview");
  const data = payload.data as Partial<JavaKnowledgeOverview> | undefined;
  return {
    totalNodes: Number(data?.totalNodes ?? 0),
    totalEdges: Number(data?.totalEdges ?? 0),
    latestNodes: Array.isArray(data?.latestNodes) ? data.latestNodes : [],
  };
}

async function getJavaKnowledgeHealth() {
  const payload = await proxyArchiveOsAi("/api/knowledge/health");
  const data = payload.data as { available?: boolean; databaseConnected?: boolean } | undefined;
  return data?.available === true && data.databaseConnected === true;
}

function jsonProxyRequest(method: "POST" | "PATCH", body: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? null),
  };
}

async function readJavaSession(request: any) {
  const baseUrl = process.env.ARCHIVEOS_AI_BASE_URL?.trim() || "http://localhost:4100";
  const headers = new Headers();
  const cookie = request?.header?.("cookie");
  const integrationToken = request?.header?.("x-archiveos-integration-token");
  if (cookie) headers.set("cookie", cookie);
  if (integrationToken) headers.set("x-archiveos-integration-token", integrationToken);
  const upstream = await fetch(`${baseUrl}/api/auth/session`, { headers });
  if (!upstream.ok) throw new Error(`Session validation failed with ${upstream.status}.`);
  const payload = await upstream.json() as { data?: Record<string, unknown> };
  return payload.data ?? { role: "PUBLIC", authenticated: false };
}

async function recordCompatibilityAudit(request: any, path: string, status: number, correlationId: string) {
  const baseUrl = process.env.ARCHIVEOS_AI_BASE_URL?.trim() || "http://localhost:4100";
  const headers = new Headers({ "content-type": "application/json" });
  const cookie = request?.header?.("cookie");
  const integrationToken = request?.header?.("x-archiveos-integration-token");
  if (cookie) headers.set("cookie", cookie);
  if (integrationToken) headers.set("x-archiveos-integration-token", integrationToken);
  await fetch(`${baseUrl}/api/audit/compatibility`, {
    method: "POST",
    headers,
    body: JSON.stringify({ method: request.method, path, status, correlationId, oldValue: null, newValue: request.body ?? null }),
  }).catch(() => undefined);
}

async function relayArchiveOsAi(
  response: any,
  path: string,
  init?: RequestInit,
  onSuccess?: (payload: unknown) => void,
  request?: any,
) {
  const baseUrl = process.env.ARCHIVEOS_AI_BASE_URL?.trim() || "http://localhost:4100";
  try {
    const headers = new Headers(init?.headers);
    const cookie = request?.header?.("cookie");
    const correlationId = request?.header?.("x-correlation-id");
    const integrationToken = request?.header?.("x-archiveos-integration-token");
    if (cookie) headers.set("cookie", cookie);
    if (correlationId) headers.set("x-correlation-id", correlationId);
    if (integrationToken) headers.set("x-archiveos-integration-token", integrationToken);
    const upstream = await fetch(`${baseUrl}${path}`, { ...init, headers });
    const payload = await upstream.json().catch(() => ({}));
    const setCookie = upstream.headers.get("set-cookie");
    if (setCookie) response.setHeader("set-cookie", setCookie);
    const upstreamCorrelation = upstream.headers.get("x-correlation-id");
    if (upstreamCorrelation) response.setHeader("x-correlation-id", upstreamCorrelation);
    if (upstream.ok) onSuccess?.(payload);
    response.status(upstream.status).json(payload);
  } catch (error) {
    response.status(503).json({
      error: error instanceof Error ? error.message : "ArchiveOS AI module is unavailable.",
      details: "ArchiveOS AI module is unavailable or not configured.",
    });
  }
}

async function relayArchiveOsAiSse(request: any, response: any, path: string) {
  const baseUrl = process.env.ARCHIVEOS_AI_BASE_URL?.trim() || "http://localhost:4100";
  const headers = new Headers({ accept: "text/event-stream" });
  const cookie = request?.header?.("cookie");
  const lastEventId = request?.header?.("last-event-id");
  if (cookie) headers.set("cookie", cookie);
  if (lastEventId) headers.set("Last-Event-ID", lastEventId);
  try {
    const upstream = await fetch(`${baseUrl}${path}`, { headers });
    if (!upstream.ok || !upstream.body) {
      response.status(upstream.status || 503).json({ error: "Live Flow stream is unavailable." });
      return;
    }
    response.status(200);
    response.setHeader("content-type", "text/event-stream; charset=utf-8");
    response.setHeader("cache-control", "no-cache, no-transform");
    response.setHeader("connection", "keep-alive");
    response.setHeader("x-accel-buffering", "no");
    response.flushHeaders?.();
    const reader = upstream.body.getReader();
    request.on("close", () => reader.cancel().catch(() => undefined));
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      response.write(Buffer.from(value));
    }
    response.end();
  } catch {
    if (!response.headersSent) response.status(503).json({ error: "Live Flow stream is unavailable." });
    else response.end();
  }
}

function sendProxyError(response: any, error: unknown, fallback: string) {
  if (error instanceof ArchiveOsAiProxyError) {
    response.status(error.statusCode).json({ error: error.message, details: error.payload });
    return;
  }

  response.status(503).json({
    error: error instanceof Error ? error.message : fallback,
    details: "ArchiveOS AI module is unavailable or not configured.",
  });
}

class ArchiveOsAiProxyError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly payload: unknown,
  ) {
    super(message);
  }
}
