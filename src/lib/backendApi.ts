import type { BatchRun, CommandRun, DailyReport, PmDecisionAction, PmTask, RuntimeSnapshot } from "../types/database";
import type { Agent, Task, WorkLog } from "../types/database";

const configuredBackendUrlFromEnv = ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "").trim();
const isBrowser = typeof window !== "undefined";
const isRemoteHttps = isBrowser && window.location.protocol === "https:";
const isLocalDevOrigin =
  isBrowser &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
  window.location.port === "5173";
const configuredBackendIsLocalhost = /^(http:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?/i.test(configuredBackendUrlFromEnv);
const backendUrl = (isRemoteHttps || isLocalDevOrigin) && configuredBackendIsLocalhost ? "" : configuredBackendUrlFromEnv;

export const configuredBackendUrl = backendUrl || (isBrowser ? window.location.origin : "");

type ApiEnvelope<T> = {
  data: T;
};

export type PlatformRole = "PUBLIC" | "OPERATOR" | "PM" | "ADMIN";
export type AuthSession = {
  actor: string;
  role: PlatformRole;
  authenticated: boolean;
  createdAt?: string;
  expiresAt?: string;
};

export type McpRegistryEntry = {
  id: string;
  tool: string;
  provider: string;
  capability: string;
  permission: string;
  approval_required: boolean;
  health: string;
  last_run: string | null;
  enabled: boolean;
};

export type RuntimeTimelineEntry = {
  id: string;
  occurred_at: string;
  event_type: "task" | "workflow" | "approval" | "knowledge" | "slack_notification" | "agent" | "batch";
  status: string;
  title: string;
  summary: string | null;
  correlation_id: string | null;
  project_id: string | null;
  source: string;
  reference_id: string | null;
};

export type AtlasManagedSystem = {
  system_id: string;
  name: string;
  environment: string;
  provider: string;
  public_base_url: string;
  role: string;
  current_status: string;
  reason: string | null;
  updated_at?: string | null;
};

export type AtlasManagedService = {
  service_id: string;
  system_id: string;
  name: string;
  url_path: string;
  healthcheck_url: string;
  service_type: string;
  criticality: "Critical" | "High" | "Medium" | string;
  current_status: string;
  repository: string;
  note: string | null;
  expected_status: number;
  timeout_ms: number;
  retry_count: number;
  enabled: boolean;
  updated_at?: string | null;
};

export type AtlasEnvironmentRequirement = {
  id: string;
  system_id: string;
  service_id: string | null;
  env_name: string;
  required: boolean;
  secret: boolean;
  description: string | null;
};

export type AtlasHealthcheckResult = {
  id: string;
  service_id: string;
  checked_at: string;
  status: string;
  http_status: number | null;
  latency_ms: number | null;
  expected_status: number;
  error_message: string | null;
  response_excerpt: string | null;
};

export type AtlasCodexWorkLog = {
  id: string;
  work_title: string;
  target_system_id: string;
  target_service_id: string | null;
  repository: string | null;
  started_at: string | null;
  finished_at: string | null;
  actor: string | null;
  agent: string | null;
  model: string | null;
  reasoning_level: string | null;
  task_summary: string | null;
  changed_files: unknown[];
  test_results: unknown[];
  failure_reason: string | null;
  next_actions: unknown[];
  committed: boolean;
  pushed: boolean;
  deployed: boolean;
  rollback_plan: string | null;
  created_at: string;
  updated_at: string;
};

export type AtlasOverview = {
  system: AtlasManagedSystem;
  services: AtlasManagedService[];
  environment_requirements: AtlasEnvironmentRequirement[];
  recent_healthchecks: AtlasHealthcheckResult[];
  recent_work_logs: AtlasCodexWorkLog[];
};

export type ManagedSystemStatus = "normal" | "degraded" | "down_candidate" | "unavailable" | "not_connected" | string;

export type ManagedSystemSummary = {
  systemId: string;
  name: string;
  type: "PLATFORM" | "INDUSTRY_APP" | "SERVICE_PORTAL" | "GAME_PROJECT" | "PLACEHOLDER" | string;
  environment: "local" | "development" | "production" | string;
  provider: "local" | "OCI" | "unknown" | string;
  status: ManagedSystemStatus;
  statusReason: string | null;
  lastCheckedAt: string | null;
  serviceCount: number;
  normalServiceCount: number;
  degradedServiceCount: number;
  downServiceCount: number;
  pendingApprovalCount: number;
  openIncidentCount: number;
  latestWorkflowId: string | null;
  latestAuditEventId: string | null;
  latestWorkLogId: string | null;
  publicUrl: string | null;
  repository: string | null;
  source: "archiveos" | "nexus" | "atlas" | "manual" | string;
  role?: string;
  baseUrlConfigured?: boolean;
  approvalCallbackConfigured?: boolean;
  integrationEnabled?: boolean;
  secrets?: "hidden" | string;
  environmentRequirements?: Array<{ name: string; secret: boolean }>;
  marketSummary?: {
    orders?: Record<string, unknown>;
    totalRevenue?: string | number;
    totalCost?: string | number;
    profit?: string | number;
    cashBalance?: string | number;
    bankruptcyRisk?: string;
    returnRate?: string | number;
    claimRate?: string | number;
    highRiskOrders?: string | number;
    outbox?: Record<string, unknown>;
  };
};

export type PmInboxItem = {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info" | string;
  sourceSystemId: string;
  sourceType: "workflow" | "approval" | "healthcheck" | "audit" | "work_log" | "daily_report" | "security" | "integration" | string;
  title: string;
  summary: string;
  recommendedAction: string;
  status: "open" | "acknowledged" | "resolved" | string;
  createdAt: string;
  updatedAt: string;
  relatedWorkflowId: string | null;
  relatedApprovalId: string | null;
  relatedServiceId: string | null;
  relatedAuditEventId: string | null;
  relatedWorkLogId: string | null;
};

export type ManagedSystemsOverview = {
  summary: {
    managedSystemsCount: number;
    normalCount: number;
    degradedCount: number;
    downCandidateCount: number;
    notConnectedCount: number;
    pendingApprovals: number;
    openPmInboxItems: number;
    criticalInboxCount: number;
    highInboxCount: number;
    mediumInboxCount: number;
    lowInboxCount: number;
    infoInboxCount: number;
    latestCriticalItem: PmInboxItem | null;
    recommendedPmAction: {
      title: string;
      reason: string;
      itemId?: string;
      severity?: string;
    };
    generatedAt: string;
  };
  systems: ManagedSystemSummary[];
  pmInbox: PmInboxItem[];
};

export type EcosystemServiceView = {
  status: string;
  name: string;
  baseUrl: string | null;
  lastCheckedAt: string | null;
  summary: Record<string, unknown>;
  errorMessage: string | null;
};

export type EcosystemSummary = {
  traceId: string;
  status: string;
  checkedAt: string;
  services: Record<"market" | "nexus" | "logitics" | "ledger", EcosystemServiceView>;
  approval: Record<string, number>;
};

export type EcosystemTopology = {
  nodes: Array<{ id: string; label: string; type: string; status: string }>;
  edges: Array<{ from: string; to: string; label: string }>;
};

export type EcosystemTimeline = {
  traceId: string;
  events: Array<Record<string, unknown>>;
};

export type EcosystemDryRun = {
  traceId: string;
  status: string;
  safeMode: boolean;
  allowExternalWrite: boolean;
  steps: Array<{ order: number; service: string; action: string; mode: string }>;
};

export type EcosystemBalanceService = {
  serviceId: string;
  serviceName: string;
  status: string;
  revenue: string | number;
  cost: string | number;
  profit: string | number;
  cashBalance: string | number;
  backlog: string | number;
  operatingMargin: string | number;
  revenueShare: string | number;
  expenseShare: string | number;
  profitShare: string | number;
  balance: "WITHIN_RANGE" | "CONCENTRATED" | "UNDER_PRESSURE" | string;
};

export type EcosystemBalanceSummary = {
  syntheticData: true;
  targetMargins: Record<string, string>;
  totals: { revenue: string | number; cost: string | number; profit: string | number };
  services: EcosystemBalanceService[];
  balanceStatus: string;
  reviewReason?: string;
};

export type EcosystemBalanceRecommendations = {
  syntheticData: true;
  recommendations: Array<{ serviceId: string; title: string; reason: string; mode: string }>;
};

export type LiveFlowEvent = {
  id: number | string;
  event_id: string;
  correlation_id: string | null;
  source_system_id: string;
  source_service_id: string | null;
  domain: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  from_node: string;
  to_node: string;
  status: string;
  severity: string;
  display_label: string;
  amount_bucket: string | null;
  occurred_at: string;
  received_at: string;
  metadata: Record<string, unknown>;
};

export type LiveFlowSummary = {
  active_flows?: number;
  recent_events?: number;
  pending_approvals?: number;
  delayed_shipments?: number;
  failed_callbacks?: number;
  degraded_systems?: number;
  latest_event_at?: string | null;
  mode: "LIVE" | "REPLAY" | "DEMO" | string;
  dataPolicy: string;
  warning: string;
  recent: LiveFlowEvent[];
  traceId?: string;
  collected?: number;
  runtime?: {
    activeServices?: string[];
    stalledServices?: string[];
    latestEventAt?: string | null;
    staleThresholdSeconds?: number;
    freshnessStatus?: "LIVE" | "SLOW" | "STALE" | "NO_RUNTIME_EVENTS" | string;
    pipelineStatus?: string;
    reason?: string;
    services?: Array<{
      serviceId: string;
      serviceName: string;
      serviceStatus: string;
      runtimeStatus: string;
      lastEventAt?: string | null;
      lastWorkAt?: string | null;
      runtimeActive?: boolean;
      autoRunEnabled?: boolean;
      eventsProducedLastTick?: number;
      eventsConsumedLastTick?: number;
      backlogCount?: number;
      schedulerStatus?: string;
      pipelineStatus?: string;
      reason?: string;
    }>;
  };
  /** Current queue count; unlike pending_approvals this is not a historic event snapshot count. */
  approvalBacklog?: number | null;
  approvalBacklogSource?: string;
  processingBacklog?: number | null;
  processingBacklogSource?: string;
};

export type LiveFlowTopology = {
  nodes: Array<{ id: string; label: string; type: string; x: number; y: number }>;
  lanes: string[];
  edges: Array<{ from: string; to: string; label: string }>;
};

export type LiveFlowReplay = {
  mode: "REPLAY" | string;
  data: LiveFlowEvent[];
};

export type WorkforceServiceSummary = {
  serviceId: string;
  serviceName: string;
  serviceType: string;
  status: string;
  headcount: number;
  effectiveCapacity: number | string;
  usedCapacity: number | string;
  backlog: number;
  payrollCost: number | string;
  productivityScore: number | string;
  bottleneckRole: string;
  capacityShortage: boolean;
  source?: Record<string, unknown>;
};

export type WorkforceRecommendation = {
  serviceId: string;
  serviceName: string;
  severity: string;
  bottleneckRole: string;
  title: string;
  reason: string;
  mode: string;
  externalWrite: string;
};

export type WorkforceOverview = {
  generatedAt: string;
  dataPolicy: string;
  summary: {
    totalHeadcount: number;
    averageProductivity: number | string;
    largestBottleneck: string;
    largestBottleneckService: string;
    totalBacklog: number;
    payrollBurn: number | string;
    recommendedAction: string;
  };
  services: WorkforceServiceSummary[];
  recommendations: WorkforceRecommendation[];
};

export type SettlementGameServiceEconomics = {
  service: string;
  cashBefore: number | string;
  revenue: number | string;
  cost: number | string;
  profit: number | string;
  cashAfter: number | string;
  burnRate: number | string;
  bankruptcyRisk: "LOW" | "WARNING" | "CRITICAL" | string;
  explanation: string;
};

export type SettlementGameEvent = {
  eventId: string;
  idempotencyKey: string;
  eventType: string;
  source: string;
  target: string;
  simulationRunId: string;
  settlementCycleId: string;
  tickId: string;
  day: number;
  correlationId: string;
  hop: number;
  maxHop: number;
  payload: Record<string, unknown>;
};

export type SettlementGameProposal = {
  proposalId: string;
  agentName: string;
  targetService: string;
  actionType: string;
  summary: string;
  expectedCashImpact: number | string;
  confidence: number;
  safeModeRequired: boolean;
  approvalRequired: boolean;
  evidence: string[];
};

export type GameFinanceTrade = {
  trade_id: string;
  simulation_run_id: string;
  settlement_cycle_id: string;
  tick_id: string;
  day: number;
  correlation_id: string | null;
  source_system_id: string;
  target_system_id: string;
  trade_type: string;
  amount: number | string;
  currency: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type GameFinanceSnapshot = {
  simulation_run_id: string;
  settlement_cycle_id: string;
  tick_id: string;
  day: number;
  correlation_id: string | null;
  system_id: string;
  service_name: string;
  cash_balance: number | string;
  revenue_amount: number | string;
  cost_amount: number | string;
  profit_amount: number | string;
  burn_rate: number | string;
  bankruptcy_risk: string;
  created_at: string;
  exports?: GameFinanceTrade[];
  imports?: GameFinanceTrade[];
};

export type GameFinanceSummary = {
  systems: Record<string, GameFinanceSnapshot>;
  recentTrades: GameFinanceTrade[];
  error?: string;
};

export type SettlementAgencyGameSummary = {
  simulationRunId: string;
  settlementCycleId: string;
  tickId: string;
  day: number;
  correlationId: string;
  maxHop: number;
  status: "RUNNING" | "ATTENTION" | "BANKRUPTCY_RISK" | string;
  ecosystemCashBalance: number | string;
  ecosystemDailyProfit: number | string;
  bankruptcyRisk: "LOW" | "WARNING" | "CRITICAL" | string;
  services: Record<"market" | "nexus" | "logistics" | "ledger" | string, SettlementGameServiceEconomics>;
  events: SettlementGameEvent[];
  proposals: SettlementGameProposal[];
  createdAt: string;
  simulationSource: "Archive-Ledger" | "ArchiveOS fallback" | string;
  syntheticData: boolean;
  dryRun: boolean;
  gameNamespace: "GAME/SIMULATION" | string;
  safeMode: boolean;
  allowExternalWrite: boolean;
  agentMode: "PROPOSAL_ONLY" | string;
  writePolicy: string;
  processedEventGuard: Record<string, unknown>;
  ledgerSimulationError?: string;
};

export type ExternalApprovalEvidence = {
  id: string;
  approval_request_id: string;
  evidence_type: "RAG" | "RULE_FALLBACK" | "POLICY" | "SYSTEM" | string;
  title: string;
  content: string;
  source_path: string | null;
  confidence: number | null;
  created_at: string;
};

export type ExternalApprovalDecision = {
  id: string;
  approval_request_id: string;
  decision: "APPROVED" | "REJECTED" | "HOLD" | string;
  decided_by: string;
  comment: string | null;
  decided_at: string;
};

export type ExternalApprovalCallback = {
  id: string;
  approval_request_id: string;
  target_system_id: string;
  callback_url_masked: string | null;
  status: string;
  attempt_count: number;
  last_error: string | null;
  requested_at: string;
  completed_at: string | null;
};

export type ExternalApprovalRequest = {
  id: string;
  approval_request_id: string;
  source: string;
  target_system_id: string;
  correlation_id: string;
  transaction_id: string;
  amount: number;
  currency: string;
  reason: string;
  policy_question: string | null;
  metadata: Record<string, unknown>;
  status: "PENDING" | "APPROVED" | "REJECTED" | "HOLD" | "CALLBACK_PENDING" | "CALLBACK_SUCCEEDED" | "CALLBACK_FAILED" | string;
  callback_path: string | null;
  callback_status: string | null;
  source_service?: string | null;
  callback_target?: string | null;
  route_plan_id?: string | null;
  event_id?: string | null;
  policy_evidence_id?: string | null;
  callback_attempt_count: number;
  callback_last_error: string | null;
  created_at: string;
  updated_at: string;
  decided_at: string | null;
  decided_by: string | null;
  priority?: "critical" | "high" | "medium" | string;
  evidence_type?: string;
  evidence?: ExternalApprovalEvidence[];
  decisions?: ExternalApprovalDecision[];
  callbacks?: ExternalApprovalCallback[];
  ledger_config?: {
    enabled: boolean;
    baseUrlConfigured: boolean;
    callbackTokenConfigured: boolean;
    secrets: "hidden" | string;
  };
};

export async function getAuthSession() {
  const response = await request<ApiEnvelope<AuthSession>>("/api/auth/session");
  return response.data;
}

export async function loginAdmin(password: string, role: Exclude<PlatformRole, "PUBLIC"> = "ADMIN", username = "admin") {
  const response = await request<ApiEnvelope<AuthSession>>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, role }),
  });
  return response.data;
}

export async function logoutAdmin() {
  const response = await request<ApiEnvelope<{ loggedOut: boolean }>>("/api/auth/logout", { method: "POST" });
  return response.data;
}

export async function getMcpRegistry() {
  const response = await request<ApiEnvelope<McpRegistryEntry[]>>("/api/mcp/registry");
  return response.data;
}

export async function getRuntimeTimeline(limit = 100) {
  const response = await request<ApiEnvelope<RuntimeTimelineEntry[]>>(`/api/runtime/timeline?limit=${limit}`);
  return response.data;
}

export async function getAtlasOverview() {
  const response = await request<ApiEnvelope<AtlasOverview>>("/api/atlas/overview");
  return response.data;
}

export async function getManagedSystemsOverview() {
  const response = await request<ApiEnvelope<ManagedSystemsOverview>>("/api/managed-systems/overview");
  return response.data;
}

export async function getManagedSystems() {
  const response = await request<ApiEnvelope<ManagedSystemSummary[]>>("/api/managed-systems");
  return response.data;
}

export async function getPmInbox() {
  const response = await request<ApiEnvelope<PmInboxItem[]>>("/api/pm-inbox");
  return response.data;
}

export async function acknowledgePmInboxItem(id: string) {
  const response = await request<ApiEnvelope<Record<string, unknown>>>(`/api/pm-inbox/${encodeURIComponent(id)}/acknowledge`, {
    method: "POST",
  });
  return response.data;
}

export async function resolvePmInboxItem(id: string) {
  const response = await request<ApiEnvelope<Record<string, unknown>>>(`/api/pm-inbox/${encodeURIComponent(id)}/resolve`, {
    method: "POST",
  });
  return response.data;
}

export async function getExternalApprovals(limit = 50) {
  const response = await request<ApiEnvelope<ExternalApprovalRequest[]>>(`/api/approvals/external?limit=${limit}`);
  return response.data;
}

export async function getExternalApprovalSummary() {
  const response = await request<ApiEnvelope<Record<string, number>>>("/api/approvals/external/summary");
  return response.data;
}

export async function getExternalApproval(id: string) {
  const response = await request<ApiEnvelope<ExternalApprovalRequest>>(`/api/approvals/external/${encodeURIComponent(id)}`);
  return response.data;
}

export async function decideExternalApproval(id: string, action: "approve" | "reject" | "hold", comment: string) {
  const response = await request<ApiEnvelope<ExternalApprovalRequest>>(`/api/approvals/external/${encodeURIComponent(id)}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment }),
  });
  return response.data;
}

export async function getApprovalCallbacks(limit = 50) {
  const response = await request<ApiEnvelope<Array<Record<string, unknown>>>>(`/api/approvals/callbacks?limit=${limit}`);
  return response.data;
}

export async function retryApprovalCallback(callbackId: string) {
  const response = await request<ApiEnvelope<Record<string, unknown>>>(`/api/approvals/callbacks/${encodeURIComponent(callbackId)}/retry`, {
    method: "POST",
  });
  return response.data;
}

export async function getEcosystemSummary() {
  const response = await request<ApiEnvelope<EcosystemSummary>>("/api/ecosystem/summary");
  return response.data;
}

export async function getEcosystemTopology() {
  const response = await request<ApiEnvelope<EcosystemTopology>>("/api/ecosystem/topology");
  return response.data;
}

export async function getEcosystemTimeline(limit = 50) {
  const response = await request<ApiEnvelope<EcosystemTimeline>>(`/api/ecosystem/timeline?limit=${limit}`);
  return response.data;
}

export async function getEcosystemBalanceSummary() {
  const response = await request<ApiEnvelope<EcosystemBalanceSummary>>("/api/ecosystem/balance/summary");
  return response.data;
}

export async function getEcosystemBalanceRecommendations() {
  const response = await request<ApiEnvelope<EcosystemBalanceRecommendations>>("/api/ecosystem/balance/recommendations");
  return response.data;
}

export async function simulateEcosystemBalance(input: Record<string, unknown> = {}) {
  const response = await request<ApiEnvelope<Record<string, unknown>>>("/api/ecosystem/balance/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function getMarketIntegrationSummary() {
  const response = await request<ApiEnvelope<Record<string, unknown>>>("/api/integrations/market/summary");
  return response.data;
}

export async function getMarketEconomySummary() {
  const response = await request<ApiEnvelope<Record<string, unknown>>>("/api/integrations/market/economy");
  return response.data;
}

export async function refreshEcosystem() {
  const response = await request<ApiEnvelope<EcosystemSummary>>("/api/ecosystem/refresh", { method: "POST" });
  return response.data;
}

export async function runEcosystemDryRun() {
  const response = await request<ApiEnvelope<EcosystemDryRun>>("/api/ecosystem/demo/dry-run", { method: "POST" });
  return response.data;
}

export async function getSettlementAgencyGameSummary() {
  const response = await request<ApiEnvelope<SettlementAgencyGameSummary>>("/api/game/survival/summary");
  return response.data;
}

export async function simulateSettlementAgencyGame(input: Record<string, unknown> = {}, dryRun = true) {
  const response = await request<ApiEnvelope<SettlementAgencyGameSummary>>(`/api/game/survival/simulate?dryRun=${dryRun}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function getGameFinanceSummary() {
  const response = await request<ApiEnvelope<GameFinanceSummary>>("/api/game/survival/finance");
  return response.data;
}

export async function getGameSystemFinance(systemId: string) {
  const response = await request<ApiEnvelope<{
    systemId: string;
    latest: GameFinanceSnapshot | null;
    snapshots: GameFinanceSnapshot[];
    exports: GameFinanceTrade[];
    imports: GameFinanceTrade[];
    error?: string;
  }>>(`/api/game/survival/finance/${encodeURIComponent(systemId)}`);
  return response.data;
}

export async function getEcosystemSurvivalSummary() {
  return getSettlementAgencyGameSummary();
}

export async function simulateEcosystemSurvival(input: Record<string, unknown> = {}, dryRun = true) {
  return simulateSettlementAgencyGame(input, dryRun);
}

export async function getLiveFlowSummary() {
  const response = await request<ApiEnvelope<LiveFlowSummary>>("/api/live-flow/summary");
  return response.data;
}

export async function getLiveFlowTopology() {
  const response = await request<ApiEnvelope<LiveFlowTopology>>("/api/live-flow/topology");
  return response.data;
}

export async function getLiveFlowRecentEvents(limit = 100) {
  const response = await request<ApiEnvelope<{ data: LiveFlowEvent[] }>>(`/api/live-flow/events/recent?limit=${limit}`);
  return response.data.data;
}

export async function getLiveFlowReplay(limit = 200) {
  const response = await request<ApiEnvelope<LiveFlowReplay>>(`/api/live-flow/replay?limit=${limit}`);
  return response.data;
}

export async function refreshLiveFlow() {
  const response = await request<ApiEnvelope<LiveFlowSummary>>("/api/live-flow/refresh", { method: "POST" });
  return response.data;
}

export async function getLiveFlowCorrelation(correlationId: string) {
  const response = await request<ApiEnvelope<{ correlationId: string; data: LiveFlowEvent[] }>>(`/api/live-flow/correlation/${encodeURIComponent(correlationId)}`);
  return response.data;
}

export async function getLiveFlowEntity(entityId: string) {
  const response = await request<ApiEnvelope<{ entityId: string; data: LiveFlowEvent[] }>>(`/api/live-flow/entity/${encodeURIComponent(entityId)}`);
  return response.data;
}

export function liveFlowStreamUrl() {
  return `${configuredBackendUrl}/api/live-flow/stream`;
}

export async function getWorkforceOverview() {
  const response = await request<ApiEnvelope<WorkforceOverview> | WorkforceOverview>("/api/workforce/overview");
  return "data" in response ? response.data : response;
}

export async function getWorkforceBottlenecks() {
  const response = await request<ApiEnvelope<{ generatedAt: string; items: WorkforceServiceSummary[] }>>("/api/workforce/bottlenecks");
  return response.data;
}

export async function getWorkforceRecommendations() {
  const response = await request<ApiEnvelope<{ generatedAt: string; items: WorkforceRecommendation[] }>>("/api/workforce/recommendations");
  return response.data;
}

export async function getWorkforceProductivityTrend() {
  const response = await request<ApiEnvelope<{ generatedAt: string; points: Array<Record<string, unknown>> }>>("/api/workforce/productivity-trend");
  return response.data;
}

export async function getAtlasServices() {
  const response = await request<ApiEnvelope<AtlasManagedService[]>>("/api/atlas/services");
  return response.data;
}

export async function getAtlasHealthchecks(limit = 20) {
  const response = await request<ApiEnvelope<AtlasHealthcheckResult[]>>(`/api/atlas/healthchecks/recent?limit=${limit}`);
  return response.data;
}

export async function runAtlasHealthchecks() {
  const response = await request<ApiEnvelope<{ system_status: string; reason: string; results: AtlasHealthcheckResult[] }>>(
    "/api/atlas/healthchecks/run",
    { method: "POST" },
  );
  return response.data;
}

export async function getAtlasWorkLogs(limit = 20) {
  const response = await request<ApiEnvelope<AtlasCodexWorkLog[]>>(`/api/atlas/work-logs?limit=${limit}`);
  return response.data;
}

export type CreateAtlasWorkLogInput = {
  workTitle: string;
  targetServiceId?: string | null;
  repository?: string | null;
  actor?: string | null;
  agent?: string | null;
  model?: string | null;
  reasoningLevel?: string | null;
  taskSummary?: string | null;
  changedFiles?: string[];
  testResults?: string[];
  failureReason?: string | null;
  nextActions?: string[];
  committed?: boolean;
  pushed?: boolean;
  deployed?: boolean;
  rollbackPlan?: string | null;
};

export async function createAtlasWorkLog(input: CreateAtlasWorkLogInput) {
  const response = await request<ApiEnvelope<AtlasCodexWorkLog>>("/api/atlas/work-logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.data;
}

export type DashboardData = {
  agents: Agent[];
  tasks: Task[];
  logs: WorkLog[];
  decisions: WorkLog[];
};

type HealthResponse = {
  status: "ok";
  service: "archiveos-backend";
};

export type PlatformHealth = {
  status: "ok";
  services: {
    ax: boolean;
    runtime: boolean;
    knowledge: boolean;
    mesh: boolean;
    kpi: boolean;
    architect: boolean;
    dailyReport: boolean;
    queue: boolean;
    security: boolean;
  };
};

export type AxPhaseStatus = "implemented" | "partial" | "planned" | "blocked";

export type AxRoadmapPhase = {
  id: string;
  title: string;
  status: AxPhaseStatus;
  summary: string;
  capabilities: Array<{
    label: string;
    status: AxPhaseStatus;
    evidence: string;
  }>;
  risks: string[];
  nextActions: string[];
};

export type AxReadiness = {
  generatedAt: string;
  architectureCommit: string;
  architectureSource: string;
  score: number;
  grade: string;
  currentMode: "node_visibility_platform" | "spring_ai_target";
  targetMode: "spring_ai_ax_platform";
  summary: string;
  phases: AxRoadmapPhase[];
  guardrails: string[];
  recommendedNextStep: string;
};

export type EndpointHealthStatus = "ok" | "missing" | "error" | "unknown";

export type EndpointHealth = {
  checkedAt: string;
  endpoints: Array<{
    name: string;
    method: "GET" | "POST" | "PATCH";
    path: string;
    service: string;
    description: string;
    status: EndpointHealthStatus;
    httpStatus: number | null;
    message: string;
  }>;
  summary: {
    total: number;
    online: number;
    failed: number;
    missing: number;
    ok: number;
    error: number;
    unknown: number;
  };
};

export type PublicAccessStatus = {
  backendBaseUrlConfigured: boolean;
  frontendPublicUrlConfigured: boolean;
  backendUrlSource: "env" | "request" | "unknown";
  frontendPublicUrl: string | null;
  backendPublicUrl: string | null;
  checkedAt: string;
};

export type RuntimeVersion = {
  commitSha: string | null;
  branch: string | null;
  startedAt: string;
  backendVersion: string | null;
  checkedAt: string;
};

export type AiRuntimeStatus = "healthy" | "degraded" | "unavailable" | "unknown";

export type AiRuntime = {
  status: AiRuntimeStatus;
  checkedAt: string;
  springBoot: {
    status: "up" | "down" | "unknown";
    version: string;
  };
  springAi: {
    status: "up" | "down" | "unknown";
    version: string;
  };
  chatModel: {
    configured: boolean;
    beanAvailable: boolean;
    lastCallSucceeded: boolean;
    available: boolean;
    provider: string;
    model: string;
    lastSuccessAt: string | null;
    lastError: string | null;
  };
  embeddingModel: {
    configured: boolean;
    beanAvailable: boolean;
    lastCallSucceeded: boolean;
    available: boolean;
    provider: string;
    model: string;
    dimensions: number;
    lastSuccessAt: string | null;
    lastError: string | null;
  };
  vectorStore: {
    available: boolean;
    type: "pgvector" | string;
    databaseConnected: boolean;
    extensionInstalled: boolean;
    indexType: string;
    indexReady: boolean;
    lastError: string | null;
  };
  knowledge: {
    documents: number;
    chunks: number;
    embeddedChunks: number;
    pendingEmbeddings: number;
    failedEmbeddings: number;
    lastSyncAt: string | null;
    lastError: string | null;
  };
  rag: {
    ready: boolean;
    lastSearchAt: string | null;
    lastAskAt: string | null;
    lastSyncAt: string | null;
    lastSuccessAt: string | null;
    lastLatencyMs: number | null;
    lastReferenceCount: number;
    lastSearchResultCount: number;
    lastError: string | null;
  };
  obsidian: {
    configured: boolean;
    reachable: boolean;
    documentCount: number;
    lastSyncAt: string | null;
  };
};

export type SpringBatchExecution = {
  id: number;
  jobName: string | null;
  status: string;
  exitCode: string;
  exitDescription: string;
  createTime: string | null;
  startTime: string | null;
  endTime: string | null;
  running: boolean;
  parameters: Record<string, unknown>;
  executionContext: Record<string, unknown>;
  steps?: Array<{
    stepName: string;
    status: string;
    exitCode: string;
    readCount: number;
    writeCount: number;
    commitCount: number;
    rollbackCount: number;
    startTime: string | null;
    endTime: string | null;
    executionContext: Record<string, unknown>;
  }>;
};

export type SpringBatchJob = {
  name: string;
  launchable: boolean;
  manualRunAllowed: boolean;
  description: string;
  recentExecutions: SpringBatchExecution[];
};

export type RpaTaskRecord = {
  id: string;
  title: string;
  description: string;
  targetProject: string | null;
  requestedBy: string | null;
  status: string;
  category: string | null;
  riskLevel: string | null;
  recommendation: string | null;
  approvalRequired: boolean;
  summary: string | null;
  classificationSource: string | null;
  error: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type RpaDecisionRecord = {
  id: string;
  taskId: string;
  action: "approve" | "reject" | "hold" | "request_retry";
  reason: string | null;
  decidedBy: string | null;
  previousStatus: string;
  nextStatus: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type RpaTaskDetail = {
  task: RpaTaskRecord;
  decisions: RpaDecisionRecord[];
  safety: string;
};

export type SecurityStatus = {
  checkedAt: string;
  authentication: {
    enabled: boolean;
    provider: string | null;
    status: "configured" | "not_configured" | "enabled" | "disabled" | "protected" | "read_only" | "unknown";
  };
  oauth: {
    provider: string | null;
    allowedEmailsConfigured: boolean;
    allowedDomainsConfigured: boolean;
    allowedEmailCount: number;
    allowedDomainCount: number;
    status: "configured" | "not_configured" | "enabled" | "disabled" | "protected" | "read_only" | "unknown";
  };
  deviceApproval: {
    enabled: boolean;
    status: "configured" | "not_configured" | "enabled" | "disabled" | "protected" | "read_only" | "unknown";
    approvedDevicesCount: number;
    knownDevicesCount: number;
    lastSeenAt: string | null;
    lastLogin: string | null;
  };
  roles: {
    viewer: SecurityRoleCapability;
    pm: SecurityRoleCapability & { enabled: boolean };
    admin: SecurityRoleCapability & { enabled: boolean };
  };
  protectedEndpoints: Array<{
    method: "POST" | "PATCH";
    path: string;
    action: string;
    requiredRole: "viewer" | "pm" | "admin";
    enforcement: "report_only" | "enforced";
    description: string;
  }>;
  securityLevel: "open_read_only" | "configured_read_only" | "protected" | "needs_setup";
  warnings: string[];
  notes: string[];
};

export type SecurityRoleCapability = {
  role: "viewer" | "pm" | "admin";
  canRead: boolean;
  canDecide: boolean;
  canRetry: boolean;
  canAdmin: boolean;
  description: string;
};

export type PlatformReadiness = {
  score: number;
  grade: string;
  generatedAt: string;
  coverage: {
    endpoint: number;
    dashboard: number;
    knowledge: number;
    mesh: number;
    architect: number;
  };
  issues: string[];
  notes: string[];
};

export type LocalAction =
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

export type LocalActionProject = {
  id: string;
  name: string;
  path: string;
  repo: string;
};

export type LocalActionResult = {
  action: LocalAction;
  status: "succeeded" | "failed";
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type LocalRuntimeProcess = {
  pid: number;
  name: string;
  parentProcessId: number | null;
  commandLine: string;
  cpu: number | null;
  startTime: string | null;
};

export type LocalRuntimeQueueFile = {
  name: string;
  updated_at: string;
};

export type LocalRuntimeStatus = {
  checked_at: string;
  status: "working" | "idle" | "unknown";
  queue: {
    path: string | null;
    inbox: number;
    processing: number;
    outbox: number;
    reviews: number;
  };
  active_task: string | null;
  processes: {
    implementer: LocalRuntimeProcess | null;
    reviewer: LocalRuntimeProcess | null;
    loop: LocalRuntimeProcess | null;
    reviewer_bridge: LocalRuntimeProcess | null;
  };
  latest: {
    inbox: LocalRuntimeQueueFile | null;
    processing: LocalRuntimeQueueFile | null;
    outbox: LocalRuntimeQueueFile | null;
    review: LocalRuntimeQueueFile | null;
  };
  latest_details: {
    builder: {
      task_id: string | null;
      status: string | null;
      exit_code: number | null;
      finished_at: string | null;
      summary: string | null;
      image_ref: string | null;
    } | null;
    reviewer: {
      reviewed_task_id: string | null;
      verdict: string | null;
      reviewed_at: string | null;
      summary: string | null;
      next_task_id: string | null;
      image_ref: string | null;
    } | null;
  };
  judgement: string;
};

export type RuntimeEvent = {
  id: string;
  type: "queue" | "builder" | "reviewer" | "command" | "decision" | "warning" | "batch" | "task";
  title: string;
  description: string;
  status: "info" | "success" | "warning" | "error";
  source: "mcp" | "supabase" | "backend";
  created_at: string;
};

export type QueueSummary = {
  queued: number;
  in_progress: number;
  pm_decision_required: number;
  done_today: number;
  failed_today: number;
  current_task: Pick<PmTask, "id" | "title" | "priority" | "status" | "current_iteration" | "max_iterations"> | null;
  recommended_pm_action: string;
  updated_at: string;
};

export type QueueRunOnceResult = {
  status: string;
  message?: string;
  summary?: QueueSummary;
  task?: PmTask;
};

export type LatestBatchStatus = {
  nightly_review: BatchRun | null;
  daily_report: BatchRun | null;
  discord_webhook_configured: boolean;
  slack_webhook_configured: boolean;
  notification_channel?: "slack";
  archiveos_public_url_configured: boolean;
  holiday_years: number[];
};

export type HistorianStatus = {
  configured: boolean;
  enabled: boolean;
  lastExport: {
    type: string;
    status: "success" | "skipped" | "failed";
    notePath: string | null;
    createdAt: string;
    reason: string | null;
  } | null;
};

export type KnowledgeNode = {
  id: string;
  node_type: string;
  title: string;
  summary: string | null;
  source: string | null;
  external_ref: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type KnowledgeEdge = {
  id: string;
  from_node_id: string;
  to_node_id: string;
  edge_type: string;
  confidence: number;
  metadata: Record<string, unknown>;
  created_at: string;
  from_node?: KnowledgeNode;
  to_node?: KnowledgeNode;
};

export type KnowledgeOverview = {
  totalNodes: number;
  totalEdges: number;
  countsByType: Record<string, number>;
  latestNodes: KnowledgeNode[];
  latestEdges: KnowledgeEdge[];
};

export type RelatedKnowledgeGroup = {
  node: KnowledgeNode;
  outgoing: KnowledgeEdge[];
  incoming: KnowledgeEdge[];
  related: KnowledgeEdge[];
};

export type KnowledgeGraphNode = {
  id: string;
  type: string;
  label: string;
  title: string;
  summary: string | null;
  source: string | null;
  externalRef: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
  importanceScore: number;
  importanceLevel: ImportanceLevel;
  degree: number;
  inDegree: number;
  outDegree: number;
  lastReferencedAt: string | null;
  isRecent: boolean;
  isHub: boolean;
  isDecisionRelevant: boolean;
};

export type KnowledgeGraphEdge = {
  id: string;
  from: string;
  to: string;
  type: string;
  label: string;
  confidence: number | null;
  createdAt: string;
  metadata: Record<string, unknown>;
  importanceScore: number;
  importanceLevel: ImportanceLevel;
  isRecent: boolean;
  isDecisionPath: boolean;
  isArchitectPath: boolean;
  isIncidentPath: boolean;
};

export type ImportanceLevel = "low" | "medium" | "high" | "critical";

export type KnowledgeGraph = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    types: Record<string, number>;
  };
};

export type KnowledgeGraphInsights = {
  topNodes: Array<{
    id: string;
    label: string;
    type: string;
    importanceScore: number;
    importanceLevel: ImportanceLevel;
    reason: string;
    degree: number;
  }>;
  topEdges: Array<{
    id: string;
    from: string;
    to: string;
    type: string;
    importanceScore: number;
    importanceLevel: ImportanceLevel;
    reason: string;
  }>;
  decisionChains: Array<{
    decisionNodeId: string;
    decisionLabel: string;
    relatedReviews: KnowledgeGraphInsightNode[];
    relatedCommands: KnowledgeGraphInsightNode[];
    relatedReports: KnowledgeGraphInsightNode[];
    relatedIncidents: KnowledgeGraphInsightNode[];
    relatedArchitectReviews: KnowledgeGraphInsightNode[];
  }>;
  graphHealth: {
    nodeCount: number;
    edgeCount: number;
    hubCount: number;
    criticalCount: number;
    recentCount: number;
    isolatedNodeCount: number;
  };
  notes: string[];
};

export type KnowledgeGraphInsightNode = {
  id: string;
  label: string;
  type: string;
  importanceLevel: ImportanceLevel;
};

export type ArchitectureReview = {
  id: string;
  target_type: string;
  target_ref: string;
  status: "pending" | "reviewed" | "warning" | "blocked";
  summary: string | null;
  findings: Array<{
    rule?: string;
    ruleId?: string;
    severity?: "info" | "warning" | "blocked";
    message?: string;
    title?: string;
    evidence?: string;
    detail?: string;
  }>;
  recommendations: Array<{
    rule?: string;
    message?: string;
    title?: string;
    detail?: string;
    priority?: "low" | "medium" | "high";
  }>;
  related_nodes: KnowledgeNode[];
  created_at: string;
};

export type MeshAgent = {
  id: string;
  label: string;
  role: string;
  status:
    | "detected"
    | "not_detected"
    | "working"
    | "idle"
    | "warning"
    | "clear"
    | "blocked"
    | "pending"
    | "no_review"
    | "enabled"
    | "disabled";
  source: "runtime" | "architect" | "historian" | "static";
  summary: string;
  metadata: Record<string, unknown>;
};

export type MeshLink = {
  from: string;
  to: string;
  type: string;
  label: string;
  strength: number;
  recent: boolean;
  source: "runtime" | "knowledge_graph" | "architect" | "historian" | "derived";
};

export type MeshInteraction = {
  time: string;
  from: string;
  to: string;
  type: string;
  summary: string;
  source: "runtime" | "knowledge_graph" | "architect" | "historian" | "derived";
};

export type MeshOverview = {
  agents: MeshAgent[];
  links: MeshLink[];
  recentInteractions: MeshInteraction[];
  health: {
    status: "healthy" | "warning" | "blocked";
    summary: string;
  };
};

export type KpiRange = "today" | "7d" | "30d";

export type KpiTrendPoint = {
  date: string;
  count: number;
};

export type KpiOverview = {
  range: KpiRange;
  generatedAt: string;
  productivity: {
    tasksCompleted: number | null;
    reviewsCompleted: number | null;
    decisionsRecorded: number | null;
    commandsRecorded: number | null;
    dailyReportsSent: number | null;
    nightlyReviewsCompleted: number | null;
  };
  quality: {
    reviewApproveCount: number | null;
    reviewRejectCount: number | null;
    reviewStopCount: number | null;
    approvalRate: number | null;
    architectReviewCount: number | null;
    architectWarningCount: number | null;
    architectBlockedCount: number | null;
  };
  runtime: {
    latestInbox: number | null;
    latestProcessing: number | null;
    latestOutbox: number | null;
    latestReviews: number | null;
    latestStatus: "healthy" | "warning" | "blocked" | "unknown";
    warningCount: number | null;
    loopDetectedRate: number | null;
  };
  knowledge: {
    totalNodes: number | null;
    totalEdges: number | null;
    nodesCreatedInRange: number | null;
    edgesCreatedInRange: number | null;
    obsidianExports: number | null;
    graphDensity: number | null;
  };
  trends: {
    dailyReports: KpiTrendPoint[];
    decisions: KpiTrendPoint[];
    knowledgeNodes: KpiTrendPoint[];
    warnings: KpiTrendPoint[];
  };
  notes: string[];
};

export async function getBackendHealth() {
  return request<HealthResponse>("/health");
}

export async function getPlatformHealth() {
  return request<PlatformHealth>("/api/health");
}

export async function getAxReadiness() {
  const response = await request<ApiEnvelope<AxReadiness>>("/api/ax/readiness");
  return response.data;
}

export async function getEndpointHealth() {
  return request<EndpointHealth>("/api/health/endpoints");
}

export async function getPublicAccessStatus() {
  const response = await request<ApiEnvelope<PublicAccessStatus>>("/api/runtime/public-access");
  return response.data;
}

export async function getRuntimeVersion() {
  const response = await request<ApiEnvelope<RuntimeVersion>>("/api/runtime/version");
  return response.data;
}

export async function getAiRuntime() {
  const response = await request<ApiEnvelope<AiRuntime>>("/api/ai/runtime");
  return response.data;
}

export async function checkAiRuntime() {
  const response = await request<ApiEnvelope<Record<string, unknown>>>("/api/ai/runtime/check", {
    method: "POST",
  });
  return response.data;
}

export async function getSpringBatchJobs() {
  const response = await request<ApiEnvelope<SpringBatchJob[]>>("/api/batch/jobs");
  return response.data;
}

export async function runSpringBatchJob(jobName: string) {
  const response = await request<ApiEnvelope<SpringBatchExecution>>(`/api/batch/jobs/${encodeURIComponent(jobName)}/run`, {
    method: "POST",
  });
  return response.data;
}

export async function getSpringBatchExecutions(limit = 20) {
  const response = await request<ApiEnvelope<SpringBatchExecution[]>>(`/api/batch/executions?limit=${limit}`);
  return response.data;
}

export async function getSpringBatchExecution(id: number) {
  const response = await request<ApiEnvelope<SpringBatchExecution>>(`/api/batch/executions/${id}`);
  return response.data;
}

export async function getRpaTasks(limit = 20) {
  const response = await request<ApiEnvelope<RpaTaskRecord[]>>(`/api/rpa/tasks/recent?limit=${limit}`);
  return response.data;
}

export async function getRpaTaskDetail(id: string) {
  const response = await request<ApiEnvelope<RpaTaskDetail>>(`/api/rpa/tasks/${encodeURIComponent(id)}`);
  return response.data;
}

export async function classifyRpaTask(input: {
  title: string;
  description: string;
  targetProject?: string | null;
  requestedBy?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const response = await request<ApiEnvelope<{ task: RpaTaskRecord; jobExecutionId?: number; batchStatus: string; safety: string; error?: string }>>("/api/rpa/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function decideRpaTask(
  id: string,
  input: { action: "approve" | "reject" | "hold" | "request_retry"; reason?: string | null; decidedBy?: string | null },
) {
  const response = await request<ApiEnvelope<{ task: RpaTaskRecord; decision: RpaDecisionRecord }>>(`/api/rpa/tasks/${encodeURIComponent(id)}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function getSecurityStatus() {
  const response = await request<ApiEnvelope<SecurityStatus>>("/api/security/status");
  return response.data;
}

export async function getPlatformReadiness() {
  const response = await request<ApiEnvelope<PlatformReadiness>>("/api/platform/readiness");
  return response.data;
}

export async function getDashboardData() {
  const response = await request<ApiEnvelope<DashboardData>>("/api/dashboard");
  return response.data;
}

export async function getRecentCommands() {
  const response = await request<ApiEnvelope<CommandRun[]>>("/api/commands/recent");
  return response.data;
}

export async function createCommandRun(input: {
  command: string;
  command_type?: string | null;
  status?: "pending" | "succeeded";
  result?: string | null;
}) {
  const response = await request<ApiEnvelope<CommandRun>>("/api/commands", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return response.data;
}

export async function getPmTasks() {
  const response = await request<ApiEnvelope<PmTask[]>>("/api/tasks");
  return response.data;
}

export async function createPmTask(input: {
  title: string;
  description: string;
  priority?: "high" | "medium" | "low";
  target_project?: string;
  scope_files?: string[] | null;
  max_iterations?: number;
  cost_budget?: number | null;
}) {
  const response = await request<ApiEnvelope<PmTask>>("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function decidePmTask(taskId: string, input: { action: PmDecisionAction; reason?: string | null }) {
  const response = await request<ApiEnvelope<{ task: PmTask }>>(`/api/tasks/${taskId}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function retryPmTask(taskId: string, reason?: string | null) {
  const response = await request<ApiEnvelope<{ task: PmTask }>>(`/api/tasks/${taskId}/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  return response.data;
}

export async function getQueueSummary() {
  const response = await request<ApiEnvelope<QueueSummary>>("/api/queue/summary");
  return response.data;
}

export async function runQueueOnce() {
  const response = await request<ApiEnvelope<QueueRunOnceResult>>("/api/queue/run-once", {
    method: "POST",
  });
  return response.data;
}

export async function createWorkLog(input: {
  task_id?: string | null;
  agent_id?: string | null;
  log_type: "summary" | "decision" | "error" | "review";
  content: string;
}) {
  const response = await request<ApiEnvelope<WorkLog>>("/api/work-logs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      task_id: input.task_id ?? null,
      agent_id: input.agent_id ?? null,
      log_type: input.log_type,
      content: input.content,
    }),
  });

  return response.data;
}

export async function getLocalActionProjects() {
  const response = await request<ApiEnvelope<LocalActionProject[]>>("/api/local-actions/projects");
  return response.data;
}

export async function runLocalAction(input: { project_id: string; action: LocalAction }) {
  return request<LocalActionResult>("/api/local-actions/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function getLocalRuntimeStatus() {
  const response = await request<ApiEnvelope<LocalRuntimeStatus>>("/api/local-runtime/status");
  return response.data;
}

export async function getRecentRuntimeEvents() {
  const response = await request<ApiEnvelope<RuntimeEvent[]>>("/api/runtime/events/recent");
  return response.data;
}

export async function getRecentBatchRuns() {
  const response = await request<ApiEnvelope<BatchRun[]>>("/api/batches/recent");
  return response.data;
}

export async function getLatestBatchStatus() {
  const response = await request<ApiEnvelope<LatestBatchStatus>>("/api/batches/latest");
  return response.data;
}

export async function getLatestDailyReport() {
  const response = await request<ApiEnvelope<DailyReport | null>>("/api/reports/daily/latest");
  return response.data;
}

export async function getRecentDailyReports() {
  const response = await request<ApiEnvelope<DailyReport[]>>("/api/reports/daily/recent");
  return response.data;
}

export async function getRecentRuntimeSnapshots() {
  const response = await request<ApiEnvelope<RuntimeSnapshot[]>>("/api/runtime/snapshots/recent");
  return response.data;
}

export async function getHistorianStatus() {
  const response = await request<ApiEnvelope<HistorianStatus>>("/api/historian/status");
  return response.data;
}

export async function getKnowledgeOverview() {
  const response = await request<ApiEnvelope<KnowledgeOverview>>("/api/knowledge/overview");
  return response.data;
}

export async function getRecentKnowledgeNodes(limit = 20) {
  const response = await request<ApiEnvelope<KnowledgeNode[]>>(`/api/knowledge/recent?limit=${limit}`);
  return response.data;
}

export async function searchKnowledgeNodes(query: string, limit = 20) {
  const response = await request<ApiEnvelope<KnowledgeNode[]>>(
    `/api/knowledge/search?q=${encodeURIComponent(query)}&limit=${limit}`,
  );
  return response.data;
}

export async function getRelatedKnowledge(input: { external_ref?: string | null; node_type?: string | null }) {
  const params = new URLSearchParams();
  if (input.external_ref) params.set("external_ref", input.external_ref);
  if (input.node_type) params.set("node_type", input.node_type);
  const response = await request<ApiEnvelope<RelatedKnowledgeGroup[]>>(`/api/knowledge/related?${params}`);
  return response.data;
}

export async function getKnowledgeGraph(limit = 100) {
  const response = await request<ApiEnvelope<KnowledgeGraph>>(`/api/knowledge/map?limit=${limit}`);
  return response.data;
}

export async function getKnowledgeGraphInsights(limit = 100) {
  const response = await request<ApiEnvelope<KnowledgeGraphInsights>>(`/api/knowledge/map/insights?limit=${limit}`);
  return response.data;
}

export async function getLatestArchitectureReview() {
  const response = await request<ApiEnvelope<ArchitectureReview | null>>("/api/architect/reviews/latest");
  return response.data;
}

export async function getRecentArchitectureReviews(limit = 10) {
  const response = await request<ApiEnvelope<ArchitectureReview[]>>(`/api/architect/reviews/recent?limit=${limit}`);
  return response.data;
}

export async function getMeshOverview() {
  const response = await request<ApiEnvelope<MeshOverview>>("/api/mesh/overview");
  return response.data;
}

export async function getKpiOverview(range: KpiRange = "7d") {
  const response = await request<ApiEnvelope<KpiOverview>>(`/api/kpi/overview?range=${range}`);
  return response.data;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${backendUrl}${path}`, { credentials: "include", ...init });
  } catch {
    throw new Error(
      `Backend is unreachable at ${backendUrl}. Start the ArchiveOS backend and refresh the dashboard.`,
    );
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as T;
}

async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Backend request failed with status ${response.status}.`;
  } catch {
    return `Backend request failed with status ${response.status}.`;
  }
}
