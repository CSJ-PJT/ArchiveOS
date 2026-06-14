import "dotenv/config";
import { execFile, spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import cors from "cors";
import express from "express";
import {
  getLatestArchitectureReview,
  getRecentArchitectureReviews,
  runArchitectReview,
} from "./architect/index.js";
import { runDailyReportBatch } from "./batches/dailyReport.js";
import { runNightlyReviewBatch } from "./batches/nightlyReview.js";
import {
  getLatestBatchRuns,
  getLatestDailyReport,
  getLatestHistorianExport,
  getRecentBatchRuns,
  getRecentDailyReports,
  getRecentRuntimeSnapshots,
} from "./batches/store.js";
import { findProject, projects } from "./config/projects.js";
import {
  getKnowledgeNode,
  getKnowledgeGraph,
  getKnowledgeGraphInsights,
  getKnowledgeOverview,
  getRecentKnowledgeNodes,
  getRelatedKnowledge,
  isHistorianConfigured,
  searchKnowledge,
} from "./historian/index.js";
import { getLocalRuntimeStatus } from "./lib/localRuntime.js";
import { getKpiOverview, normalizeRange } from "./kpi/index.js";
import { getAgentMeshOverview } from "./mesh/index.js";
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

const logTypes = new Set(["summary", "decision", "error", "review"]);
const commandStatuses = new Set(["pending", "running", "succeeded", "failed"]);
const localActionTypes = new Set([
  "git_status",
  "git_branch",
  "git_log_recent",
  "frontend_build",
  "backend_typecheck",
  "backend_build",
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
  | "backend"
  | "runtime"
  | "knowledge"
  | "mesh"
  | "kpi"
  | "architect"
  | "dailyReport";

type EndpointRegistration = {
  name: string;
  method: "GET" | "POST";
  path: string;
  service: HealthServiceKey;
  description: string;
};

const endpointRegistry: EndpointRegistration[] = [
  { name: "Health", method: "GET", path: "/health", service: "backend", description: "Legacy backend liveness check." },
  { name: "API Health", method: "GET", path: "/api/health", service: "backend", description: "ArchiveOS service health summary." },
  { name: "Endpoint Matrix", method: "GET", path: "/api/health/endpoints", service: "backend", description: "Registered endpoint coverage." },
  { name: "Dashboard", method: "GET", path: "/api/dashboard", service: "dailyReport", description: "Supabase dashboard data." },
  { name: "Work Logs", method: "GET", path: "/api/work-logs/recent", service: "dailyReport", description: "Recent work logs." },
  { name: "Record Work Log", method: "POST", path: "/api/work-logs", service: "dailyReport", description: "Recording-only work log write." },
  { name: "Commands", method: "GET", path: "/api/commands/recent", service: "dailyReport", description: "Recent recorded commands." },
  { name: "Record Command", method: "POST", path: "/api/commands", service: "dailyReport", description: "Recording-only command write." },
  { name: "Local Projects", method: "GET", path: "/api/local-actions/projects", service: "backend", description: "Allowlisted local project registry." },
  { name: "Local Diagnostics", method: "POST", path: "/api/local-actions/run", service: "backend", description: "Allowlisted diagnostics endpoint." },
  { name: "Runtime Status", method: "GET", path: "/api/local-runtime/status", service: "runtime", description: "Local MCP runtime status." },
  { name: "Runtime Events", method: "GET", path: "/api/runtime/events/recent", service: "runtime", description: "Derived runtime events." },
  { name: "Runtime Version", method: "GET", path: "/api/runtime/version", service: "backend", description: "Backend git/runtime version." },
  { name: "Public Access", method: "GET", path: "/api/runtime/public-access", service: "backend", description: "Remote/ngrok runtime URL configuration." },
  { name: "Batch Runs", method: "GET", path: "/api/batches/recent", service: "dailyReport", description: "Recent batch runs." },
  { name: "Latest Batch", method: "GET", path: "/api/batches/latest", service: "dailyReport", description: "Latest nightly/daily batch state." },
  { name: "Run Nightly Review", method: "POST", path: "/api/batches/nightly-review/run", service: "dailyReport", description: "Manual nightly batch trigger." },
  { name: "Run Daily Report", method: "POST", path: "/api/batches/daily-report/run", service: "dailyReport", description: "Manual daily report trigger." },
  { name: "Latest Daily Report", method: "GET", path: "/api/reports/daily/latest", service: "dailyReport", description: "Latest daily report." },
  { name: "Recent Daily Reports", method: "GET", path: "/api/reports/daily/recent", service: "dailyReport", description: "Recent daily reports." },
  { name: "Runtime Snapshots", method: "GET", path: "/api/runtime/snapshots/recent", service: "runtime", description: "Recent runtime snapshots." },
  { name: "Historian", method: "GET", path: "/api/historian/status", service: "knowledge", description: "Historian export status." },
  { name: "Knowledge Overview", method: "GET", path: "/api/knowledge/overview", service: "knowledge", description: "Knowledge Graph overview." },
  { name: "Recent Knowledge", method: "GET", path: "/api/knowledge/recent", service: "knowledge", description: "Recent knowledge nodes." },
  { name: "Knowledge Search", method: "GET", path: "/api/knowledge/search", service: "knowledge", description: "Knowledge text search." },
  { name: "Related Knowledge", method: "GET", path: "/api/knowledge/related", service: "knowledge", description: "Related knowledge lookup." },
  { name: "Knowledge Graph", method: "GET", path: "/api/knowledge/graph", service: "knowledge", description: "Knowledge Graph visualization data." },
  { name: "Knowledge Graph Insights", method: "GET", path: "/api/knowledge/graph/insights", service: "knowledge", description: "Knowledge Graph importance and decision chain insights." },
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

function readOptionalUrlEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

app.use(
  cors({
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
      runtime: services.runtime,
      knowledge: services.knowledge,
      mesh: services.mesh,
      kpi: services.kpi,
      architect: services.architect,
      dailyReport: services.dailyReport,
    },
  });
});

app.get("/api/health/endpoints", async (_request, response) => {
  response.json(await getEndpointHealthSnapshot());
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
  const frontendPublicUrl = readOptionalUrlEnv("ARCHIVEOS_PUBLIC_URL");
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

app.get("/api/work-logs/recent", async (_request, response) => {
  const { data, error } = await supabaseAdmin
    .from("work_logs")
    .select("*, task:tasks(title), agent:agents(name)")
    .not("id", "in", `(${seedWorkLogIds.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    response.status(500).json({ error: "Failed to fetch recent work logs." });
    return;
  }

  response.json({ data });
});

app.get("/api/dashboard", async (_request, response) => {
  const [agentsResult, tasksResult, logsResult, decisionsResult] = await Promise.all([
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
  ]);

  const firstError =
    agentsResult.error ?? tasksResult.error ?? logsResult.error ?? decisionsResult.error;

  if (firstError) {
    response.status(500).json({ error: "Failed to fetch dashboard data." });
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
});

app.post("/api/work-logs", async (request, response) => {
  const validation = validateWorkLogBody(request.body);

  if (!validation.ok) {
    response.status(400).json({ error: validation.error });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("work_logs")
    .insert(validation.value)
    .select()
    .single();

  if (error) {
    response.status(500).json({ error: "Failed to create work log." });
    return;
  }

  response.status(201).json({ data });
});

app.get("/api/commands/recent", async (_request, response) => {
  const { data, error } = await supabaseAdmin
    .from("command_runs")
    .select("*")
    .not("id", "in", `(${seedCommandRunIds.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    response.status(500).json({ error: "Failed to fetch recent commands." });
    return;
  }

  response.json({ data });
});

app.post("/api/commands", async (request, response) => {
  const validation = validateCommandBody(request.body);

  if (!validation.ok) {
    response.status(400).json({ error: validation.error });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("command_runs")
    .insert(validation.value)
    .select()
    .single();

  if (error) {
    response.status(500).json({ error: "Failed to record command." });
    return;
  }

  response.status(201).json({ data });
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
app.post("/api/batches/nightly-review/run", async (_request, response) => {
  const result = await runNightlyReviewBatch();
  response.json({ data: result });
});

// Local/admin/testing endpoint only. This may send Discord only when the Korea business-day rule passes.
app.post("/api/batches/daily-report/run", async (_request, response) => {
  const result = await runDailyReportBatch();
  response.json({ data: result });
});

app.get("/api/batches/recent", async (_request, response) => {
  try {
    response.json({ data: await getRecentBatchRuns() });
  } catch {
    response.status(500).json({ error: "Failed to fetch recent batch runs." });
  }
});

app.get("/api/batches/latest", async (_request, response) => {
  try {
    response.json({
      data: {
        ...(await getLatestBatchRuns()),
        discord_webhook_configured: Boolean(process.env.DISCORD_WEBHOOK_URL?.trim()),
        archiveos_public_url_configured: Boolean(process.env.ARCHIVEOS_PUBLIC_URL?.trim()),
        holiday_years: [2026],
      },
    });
  } catch {
    response.status(500).json({ error: "Failed to fetch latest batch status." });
  }
});

app.get("/api/reports/daily/latest", async (_request, response) => {
  try {
    response.json({ data: await getLatestDailyReport() });
  } catch {
    response.status(500).json({ error: "Failed to fetch latest daily report." });
  }
});

app.get("/api/reports/daily/recent", async (_request, response) => {
  try {
    response.json({ data: await getRecentDailyReports() });
  } catch {
    response.status(500).json({ error: "Failed to fetch recent daily reports." });
  }
});

app.get("/api/runtime/snapshots/recent", async (_request, response) => {
  try {
    response.json({ data: await getRecentRuntimeSnapshots() });
  } catch {
    response.status(500).json({ error: "Failed to fetch recent runtime snapshots." });
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
  try {
    response.json({ data: await getKnowledgeOverview() });
  } catch {
    response.status(500).json({ error: "Failed to fetch knowledge overview." });
  }
});

app.get("/api/knowledge/recent", async (request, response) => {
  try {
    response.json({ data: await getRecentKnowledgeNodes(readLimit(request.query.limit)) });
  } catch {
    response.status(500).json({ error: "Failed to fetch recent knowledge nodes." });
  }
});

app.get("/api/knowledge/search", async (request, response) => {
  const query = typeof request.query.q === "string" ? request.query.q : "";

  try {
    response.json({ data: await searchKnowledge(query, readLimit(request.query.limit)) });
  } catch {
    response.status(500).json({ error: "Failed to search knowledge nodes." });
  }
});

app.get("/api/knowledge/related", async (request, response) => {
  try {
    response.json({
      data: await getRelatedKnowledge({
        external_ref: typeof request.query.external_ref === "string" ? request.query.external_ref : null,
        node_type: typeof request.query.node_type === "string" ? request.query.node_type : null,
      }),
    });
  } catch {
    response.status(500).json({ error: "Failed to fetch related knowledge." });
  }
});

app.get("/api/knowledge/graph", async (request, response) => {
  try {
    response.json({ data: await getKnowledgeGraph(readGraphLimit(request.query.limit ?? "100")) });
  } catch {
    response.status(500).json({ error: "Failed to fetch knowledge graph." });
  }
});

app.get("/api/knowledge/graph/insights", async (request, response) => {
  try {
    response.json({ data: await getKnowledgeGraphInsights(readGraphLimit(request.query.limit ?? "100")) });
  } catch {
    response.status(500).json({ error: "Failed to fetch knowledge graph insights." });
  }
});

app.get("/api/knowledge/node/:id", async (request, response) => {
  try {
    response.json({ data: await getKnowledgeNode(request.params.id) });
  } catch {
    response.status(404).json({ error: "Knowledge node not found." });
  }
});

// Local/admin/manual-test endpoint only. It records a deterministic architecture review and does not execute commands.
app.post("/api/architect/review", async (request, response) => {
  const validation = validateArchitectReviewBody(request.body);

  if (!validation.ok) {
    response.status(400).json({ error: validation.error });
    return;
  }

  try {
    response.status(201).json({ data: await runArchitectReview(validation.value) });
  } catch {
    response.status(500).json({ error: "Failed to record architecture review." });
  }
});

app.get("/api/architect/reviews/recent", async (request, response) => {
  try {
    response.json({ data: await getRecentArchitectureReviews(readLimit(request.query.limit)) });
  } catch {
    response.status(500).json({ error: "Failed to fetch architecture reviews." });
  }
});

app.get("/api/architect/reviews/latest", async (_request, response) => {
  try {
    response.json({ data: await getLatestArchitectureReview() });
  } catch {
    response.status(500).json({ error: "Failed to fetch latest architecture review." });
  }
});

app.get("/api/mesh/overview", async (_request, response) => {
  try {
    response.json({ data: await getAgentMeshOverview() });
  } catch {
    response.status(500).json({ error: "Failed to fetch agent mesh overview." });
  }
});

app.get("/api/kpi/overview", async (request, response) => {
  try {
    response.json({ data: await getKpiOverview(normalizeRange(request.query.range)) });
  } catch {
    response.status(500).json({ error: "Failed to fetch KPI overview." });
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

type WorkLogBody = {
  task_id: string | null;
  agent_id: string | null;
  log_type: "summary" | "decision" | "error" | "review";
  content: string;
};

type CommandBody = {
  command: string;
  command_type: string | null;
  status: "pending" | "running" | "succeeded" | "failed";
  result: string | null;
};

type LocalAction = "git_status" | "git_branch" | "git_log_recent" | "frontend_build" | "backend_typecheck" | "backend_build";

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
  type: "queue" | "builder" | "reviewer" | "command" | "decision" | "warning" | "batch";
  title: string;
  description: string;
  status: "info" | "success" | "warning" | "error";
  source: "mcp" | "supabase" | "backend";
  created_at: string;
};

type ValidationResult =
  | { ok: true; value: WorkLogBody }
  | { ok: false; error: string };

type CommandValidationResult =
  | { ok: true; value: CommandBody }
  | { ok: false; error: string };

type LocalActionValidationResult =
  | { ok: true; value: LocalActionBody }
  | { ok: false; error: string };

type ArchitectReviewValidationResult =
  | { ok: true; value: ArchitectReviewBody }
  | { ok: false; error: string };

function validateWorkLogBody(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const candidate = body as Record<string, unknown>;

  if (candidate.task_id !== null && candidate.task_id !== undefined && typeof candidate.task_id !== "string") {
    return { ok: false, error: "task_id must be a string or null." };
  }

  if (candidate.agent_id !== null && candidate.agent_id !== undefined && typeof candidate.agent_id !== "string") {
    return { ok: false, error: "agent_id must be a string or null." };
  }

  if (typeof candidate.log_type !== "string" || !logTypes.has(candidate.log_type)) {
    return { ok: false, error: "log_type must be one of summary, decision, error, review." };
  }

  if (typeof candidate.content !== "string" || candidate.content.trim().length === 0) {
    return { ok: false, error: "content must not be empty." };
  }

  return {
    ok: true,
    value: {
      task_id: candidate.task_id ?? null,
      agent_id: candidate.agent_id ?? null,
      log_type: candidate.log_type as WorkLogBody["log_type"],
      content: candidate.content.trim(),
    },
  };
}

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

async function getServiceHealth() {
  const checks = await Promise.allSettled([
    getLocalRuntimeStatus(),
    getKnowledgeOverview(),
    getAgentMeshOverview(),
    getKpiOverview("7d"),
    getLatestArchitectureReview(),
    getLatestDailyReport(),
  ]);

  return {
    backend: true,
    runtime: checks[0].status === "fulfilled",
    knowledge: checks[1].status === "fulfilled",
    mesh: checks[2].status === "fulfilled",
    kpi: checks[3].status === "fulfilled",
    architect: checks[4].status === "fulfilled",
    dailyReport: checks[5].status === "fulfilled",
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
    getKnowledgeOverview().catch(() => null),
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
  const [runtime, commandsResult, decisionsResult, batchRuns] = await Promise.all([
    getLocalRuntimeStatus(),
    supabaseAdmin
      .from("command_runs")
      .select("id, command, command_type, status, result, created_at")
      .not("id", "in", `(${seedCommandRunIds.join(",")})`)
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("work_logs")
      .select("id, log_type, content, created_at, task:tasks(title), agent:agents(name)")
      .eq("log_type", "decision")
      .not("id", "in", `(${seedWorkLogIds.join(",")})`)
      .order("created_at", { ascending: false })
      .limit(5),
    getRecentBatchRuns(5).catch(() => []),
  ]);

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

  return events
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 20);
}

function summarizeEventDescription(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > 180 ? `${clean.slice(0, 180)}...` : clean;
}

function validateCommandBody(body: unknown): CommandValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const candidate = body as Record<string, unknown>;

  if (typeof candidate.command !== "string" || candidate.command.trim().length === 0) {
    return { ok: false, error: "command must not be empty." };
  }

  if (
    candidate.command_type !== null &&
    candidate.command_type !== undefined &&
    typeof candidate.command_type !== "string"
  ) {
    return { ok: false, error: "command_type must be a string or null." };
  }

  if (
    candidate.status !== undefined &&
    (typeof candidate.status !== "string" || !commandStatuses.has(candidate.status))
  ) {
    return { ok: false, error: "status must be one of pending, running, succeeded, failed." };
  }

  if (candidate.result !== null && candidate.result !== undefined && typeof candidate.result !== "string") {
    return { ok: false, error: "result must be a string or null." };
  }

  const requestedStatus = typeof candidate.status === "string" ? candidate.status : "pending";
  const status = requestedStatus === "succeeded" ? "succeeded" : "pending";

  return {
    ok: true,
    value: {
      command: candidate.command.trim(),
      command_type: candidate.command_type ?? null,
      status,
      result:
        candidate.result ??
        (status === "succeeded"
          ? "Command intent recorded as succeeded. Real execution is not enabled yet."
          : "Command recorded as pending. Real execution is not enabled yet."),
    },
  };
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
      error: "action must be one of git_status, git_branch, git_log_recent, frontend_build, backend_typecheck, backend_build.",
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

function runLocalAction(projectPath: string, action: LocalAction): Promise<LocalActionResult> {
  const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
  const backendPath = path.join(projectPath, "backend");
  const definitions: Record<LocalAction, { command: string; args: string[]; cwd: string }> = {
    git_status: { command: "git", args: ["status", "--short"], cwd: projectPath },
    git_branch: { command: "git", args: ["branch", "--show-current"], cwd: projectPath },
    git_log_recent: { command: "git", args: ["log", "--oneline", "-5"], cwd: projectPath },
    frontend_build: { command: npmExecutable, args: ["run", "build"], cwd: projectPath },
    backend_typecheck: { command: npmExecutable, args: ["run", "typecheck"], cwd: backendPath },
    backend_build: { command: npmExecutable, args: ["run", "build"], cwd: backendPath },
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
    }, 60000);

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
