import { useCallback, useEffect, useMemo, useState } from "react";
import {
  configuredBackendUrl,
  createCommandRun,
  createWorkLog,
  getDashboardData,
  getBackendHealth,
  getEndpointHealth,
  getHistorianStatus,
  getKnowledgeGraph,
  getKnowledgeGraphInsights,
  getKnowledgeOverview,
  getKpiOverview,
  getPlatformHealth,
  getPlatformReadiness,
  getPublicAccessStatus,
  getRuntimeVersion,
  getRelatedKnowledge,
  getLatestBatchStatus,
  getLatestDailyReport,
  getLatestArchitectureReview,
  getLocalActionProjects,
  getLocalRuntimeStatus,
  getMeshOverview,
  getRecentArchitectureReviews,
  getRecentCommands,
  getRecentKnowledgeNodes,
  getRecentRuntimeEvents,
  runLocalAction,
  searchKnowledgeNodes,
  type LocalAction,
  type LocalActionProject,
  type LocalActionResult,
  type LocalRuntimeStatus,
  type LatestBatchStatus,
  type HistorianStatus,
  type ArchitectureReview,
  type KnowledgeNode,
  type KnowledgeGraph,
  type KnowledgeGraphNode,
  type KnowledgeGraphEdge,
  type KnowledgeGraphInsights,
  type ImportanceLevel,
  type KnowledgeOverview,
  type KpiOverview,
  type KpiRange,
  type MeshAgent,
  type MeshLink,
  type MeshOverview,
  type EndpointHealth,
  type RelatedKnowledgeGroup,
  type PlatformHealth,
  type PlatformReadiness,
  type PublicAccessStatus,
  type RuntimeVersion,
  type RuntimeEvent,
} from "./lib/backendApi";
import type {
  Agent,
  AgentStatus,
  CommandRun,
  CommandStatus,
  DailyReport,
  LogType,
  Task,
  TaskStatus,
  WorkLog,
} from "./types/database";

type DashboardData = {
  agents: Agent[];
  tasks: Task[];
  logs: WorkLog[];
  decisions: WorkLog[];
};

type AppView = "dashboard" | "decisions" | "operators" | "timeline" | "knowledge" | "mesh" | "kpi" | "settings";

type PipelineStage = {
  id: string;
  kicker: string;
  label: string;
  value: string;
  detail: string;
  active: boolean;
  pulse: boolean;
  className: string;
  dotClassName: string;
};

type PipelineConnectorState = "idle" | "current" | "success";

type ConsistencyStatus = "matched" | "missing" | "stale" | "unknown" | "error";
type RemoteAccessStatus = "online" | "offline" | "not configured";

const taskStatuses: TaskStatus[] = ["todo", "in_progress", "review", "done", "failed"];
const statusLabels: Record<TaskStatus, string> = {
  todo: "Todo",
  in_progress: "In progress",
  review: "Review",
  done: "Done",
  failed: "Failed",
};

const agentStatusStyles: Record<AgentStatus, string> = {
  idle: "bg-slate-500/15 text-slate-200 ring-slate-400/20",
  working: "bg-cyan-500/15 text-cyan-200 ring-cyan-400/25",
  reviewing: "bg-amber-500/15 text-amber-200 ring-amber-400/25",
  failed: "bg-rose-500/15 text-rose-200 ring-rose-400/25",
  waiting: "bg-violet-500/15 text-violet-200 ring-violet-400/25",
};

const logTypeStyles: Record<LogType, string> = {
  summary: "border-cyan-400/30 bg-cyan-400/5",
  decision: "border-emerald-400/30 bg-emerald-400/5",
  error: "border-rose-400/30 bg-rose-400/5",
  review: "border-amber-400/30 bg-amber-400/5",
};

const commandStatusStyles: Record<CommandStatus, string> = {
  pending: "bg-slate-500/15 text-slate-200 ring-slate-400/20",
  running: "bg-cyan-500/15 text-cyan-200 ring-cyan-400/25",
  succeeded: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25",
  failed: "bg-rose-500/15 text-rose-200 ring-rose-400/25",
};

const runtimeStatusStyles: Record<LocalRuntimeStatus["status"], string> = {
  working: "bg-cyan-500/15 text-cyan-200 ring-cyan-400/25",
  idle: "bg-slate-500/15 text-slate-200 ring-slate-400/20",
  unknown: "bg-amber-500/15 text-amber-200 ring-amber-400/25",
};

const runtimeEventStatusStyles: Record<RuntimeEvent["status"], string> = {
  info: "bg-cyan-500/15 text-cyan-200 ring-cyan-400/25",
  success: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25",
  warning: "bg-amber-500/15 text-amber-200 ring-amber-400/25",
  error: "bg-rose-500/15 text-rose-200 ring-rose-400/25",
};

const runtimeEventTypeStyles: Record<RuntimeEvent["type"], string> = {
  queue: "border-cyan-300/30 bg-cyan-300/[0.04]",
  builder: "border-emerald-300/30 bg-emerald-300/[0.04]",
  reviewer: "border-amber-300/30 bg-amber-300/[0.05]",
  command: "border-violet-300/30 bg-violet-300/[0.04]",
  decision: "border-sky-300/30 bg-sky-300/[0.04]",
  warning: "border-rose-300/30 bg-rose-300/[0.05]",
  batch: "border-emerald-300/30 bg-emerald-300/[0.04]",
};

const consistencyStatusStyles: Record<ConsistencyStatus, string> = {
  matched: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25",
  missing: "bg-slate-500/15 text-slate-200 ring-slate-400/20",
  stale: "bg-amber-500/15 text-amber-200 ring-amber-400/25",
  unknown: "bg-violet-500/15 text-violet-200 ring-violet-400/25",
  error: "bg-rose-500/15 text-rose-200 ring-rose-400/25",
};

const remoteAccessStatusStyles: Record<RemoteAccessStatus, string> = {
  online: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25",
  offline: "bg-rose-500/15 text-rose-200 ring-rose-400/25",
  "not configured": "bg-slate-500/15 text-slate-200 ring-slate-400/20",
};

const operationStatusStyles: Record<DailyReport["status"], string> = {
  normal: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25",
  warning: "bg-amber-500/15 text-amber-200 ring-amber-400/25",
  problem: "bg-rose-500/15 text-rose-200 ring-rose-400/25",
};

const architectStatusStyles: Record<ArchitectureReview["status"], string> = {
  pending: "bg-slate-500/15 text-slate-200 ring-slate-400/20",
  reviewed: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25",
  warning: "bg-amber-500/15 text-amber-200 ring-amber-400/25",
  blocked: "bg-rose-500/15 text-rose-200 ring-rose-400/25",
};

const quickActions = [
  "Record Work Log",
  "Record Decision",
  "Queue Review Request",
  "Record GitHub Sync Request",
  "Run Read-only Health Check",
];

const localActionButtons: { label: string; action: LocalAction }[] = [
  { label: "Git Status", action: "git_status" },
  { label: "Current Branch", action: "git_branch" },
  { label: "Recent Commits", action: "git_log_recent" },
  { label: "Frontend Build Check", action: "frontend_build" },
  { label: "Backend Typecheck", action: "backend_typecheck" },
  { label: "Backend Build Check", action: "backend_build" },
];

const seedAgentIds = new Set([
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
]);

const seedTaskIds = new Set([
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
]);

const seedWorkLogIds = new Set([
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
  "10000000-0000-4000-8000-000000000004",
]);

const seedCommandRunIds = new Set([
  "20000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
]);

const frontendBuildMetadata = {
  buildTime: __ARCHIVEOS_BUILD_TIME__ || "unknown",
  commitSha: __ARCHIVEOS_COMMIT_SHA__ || null,
  version: __ARCHIVEOS_FRONTEND_VERSION__ || null,
};

function App() {
  const [view, setView] = useState<AppView>("dashboard");
  const [data, setData] = useState<DashboardData>({
    agents: [],
    tasks: [],
    logs: [],
    decisions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const dashboardData = await getDashboardData();
      const agents = dashboardData.agents.filter((agent) => !seedAgentIds.has(agent.id));
      const tasks = dashboardData.tasks.filter((task) => !seedTaskIds.has(task.id));
      const logs = dashboardData.logs.filter((log) => !seedWorkLogIds.has(log.id));
      const decisions = dashboardData.decisions.filter((log) => !seedWorkLogIds.has(log.id));

      setData({
        agents,
        tasks,
        logs,
        decisions,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard data.");
    }

    if (!options.silent) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const taskCounts = useMemo(
    () =>
      taskStatuses.map((status) => ({
        status,
        label: statusLabels[status],
        count: data.tasks.filter((task) => task.status === status).length,
      })),
    [data.tasks],
  );

  return (
    <main className="min-h-screen bg-[#07090d] text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-3 py-4 sm:gap-8 sm:px-8 sm:py-6 lg:px-10">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <img
                src="/favicon.svg"
                alt="ArchiveOS"
                className="h-10 w-10 rounded-xl border border-cyan-300/30 bg-slate-950/80 p-1.5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
              />
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
                  Agent operations
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-normal text-white sm:text-4xl">ArchiveOS</h1>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              A read-only PM operations dashboard for agent workflow visibility, safe command recording,
              and decision history.
            </p>
          </div>
        </header>

        {error ? (
          <section className="rounded-md border border-rose-400/30 bg-rose-500/10 p-5 text-rose-100">
            <h2 className="text-lg font-semibold">Supabase query failed</h2>
            <p className="mt-2 text-sm text-rose-100/80">{error}</p>
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-md border border-white/10 bg-white/[0.03] p-8 text-sm text-slate-300">
            Loading operations data...
          </section>
        ) : (
          <OperationsLayout
            data={data}
            taskCounts={taskCounts}
            view={view}
            setView={setView}
            reloadDashboard={loadDashboard}
          />
        )}
      </div>
    </main>
  );
}

function OperationsLayout({
  data,
  taskCounts,
  view,
  setView,
  reloadDashboard,
}: {
  data: DashboardData;
  taskCounts: { status: TaskStatus; label: string; count: number }[];
  view: AppView;
  setView: (view: AppView) => void;
  reloadDashboard: (options?: { silent?: boolean }) => void;
}) {
  const [runtimeStatus, setRuntimeStatus] = useState<LocalRuntimeStatus | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [runtimeEvents, setRuntimeEvents] = useState<RuntimeEvent[]>([]);
  const [runtimeEventsError, setRuntimeEventsError] = useState<string | null>(null);
  const [isRefreshingEvents, setIsRefreshingEvents] = useState(true);
  const [isRefreshingRuntime, setIsRefreshingRuntime] = useState(true);
  const [backendReachability, setBackendReachability] = useState<ConsistencyStatus>("unknown");
  const [commandRunsReachability, setCommandRunsReachability] = useState<ConsistencyStatus>("unknown");
  const [consistencyError, setConsistencyError] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<LatestBatchStatus | null>(null);
  const [latestDailyReport, setLatestDailyReport] = useState<DailyReport | null>(null);
  const [batchStatusError, setBatchStatusError] = useState<string | null>(null);
  const [historianStatus, setHistorianStatus] = useState<HistorianStatus | null>(null);
  const [historianError, setHistorianError] = useState<string | null>(null);
  const [knowledgeOverview, setKnowledgeOverview] = useState<KnowledgeOverview | null>(null);
  const [recentKnowledgeNodes, setRecentKnowledgeNodes] = useState<KnowledgeNode[]>([]);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
  const [latestArchitectureReview, setLatestArchitectureReview] = useState<ArchitectureReview | null>(null);
  const [recentArchitectureReviews, setRecentArchitectureReviews] = useState<ArchitectureReview[]>([]);
  const [architectureReviewError, setArchitectureReviewError] = useState<string | null>(null);
  const [meshOverview, setMeshOverview] = useState<MeshOverview | null>(null);
  const [meshError, setMeshError] = useState<string | null>(null);
  const [kpiOverview, setKpiOverview] = useState<KpiOverview | null>(null);
  const [kpiRange, setKpiRange] = useState<KpiRange>("7d");
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [platformHealth, setPlatformHealth] = useState<PlatformHealth | null>(null);
  const [endpointHealth, setEndpointHealth] = useState<EndpointHealth | null>(null);
  const [platformReadiness, setPlatformReadiness] = useState<PlatformReadiness | null>(null);
  const [publicAccessStatus, setPublicAccessStatus] = useState<PublicAccessStatus | null>(null);
  const [runtimeVersion, setRuntimeVersion] = useState<RuntimeVersion | null>(null);
  const [platformHealthError, setPlatformHealthError] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const runtimeAgents = getRuntimeAgents(runtimeStatus);

  useEffect(() => {
    refreshRuntime();
    refreshRuntimeEvents();
    refreshConsistency();
    refreshBatchStatus();
    refreshHistorianStatus();
    refreshKnowledge();
    refreshArchitectureReviews();
    refreshMesh();
    refreshKpi({ range: kpiRange });
    refreshPlatformHealth();
    const timer = window.setInterval(() => {
      refreshRuntime({ silent: true });
      refreshRuntimeEvents({ silent: true });
      refreshConsistency({ silent: true });
      refreshBatchStatus({ silent: true });
      refreshHistorianStatus({ silent: true });
      refreshKnowledge({ silent: true });
      refreshArchitectureReviews({ silent: true });
      refreshMesh({ silent: true });
      refreshKpi({ silent: true, range: kpiRange });
      refreshPlatformHealth({ silent: true });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [kpiRange]);

  async function refreshRuntime(options: { silent?: boolean } = {}) {
    if (!options.silent) {
      setIsRefreshingRuntime(true);
    }
    setRuntimeError(null);

    try {
      setRuntimeStatus(await getLocalRuntimeStatus());
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : "Could not load local runtime status.");
    } finally {
      if (!options.silent) {
        setIsRefreshingRuntime(false);
      }
    }
  }

  async function refreshRuntimeEvents(options: { silent?: boolean } = {}) {
    if (!options.silent) {
      setIsRefreshingEvents(true);
    }
    setRuntimeEventsError(null);

    try {
      setRuntimeEvents(await getRecentRuntimeEvents());
    } catch (error) {
      setRuntimeEventsError(error instanceof Error ? error.message : "Could not load runtime events.");
    } finally {
      if (!options.silent) {
        setIsRefreshingEvents(false);
      }
    }
  }

  async function refreshConsistency(options: { silent?: boolean } = {}) {
    if (!options.silent) {
      setConsistencyError(null);
    }

    try {
      await getBackendHealth();
      setBackendReachability("matched");
    } catch (error) {
      setBackendReachability("error");
      setConsistencyError(error instanceof Error ? error.message : "Backend health check failed.");
    }

    try {
      await getRecentCommands();
      setCommandRunsReachability("matched");
    } catch (error) {
      setCommandRunsReachability("error");
      setConsistencyError(error instanceof Error ? error.message : "command_runs table is not reachable.");
    }
  }

  async function refreshBatchStatus(options: { silent?: boolean } = {}) {
    if (!options.silent) {
      setBatchStatusError(null);
    }

    try {
      const [latestBatchStatus, dailyReport] = await Promise.all([
        getLatestBatchStatus(),
        getLatestDailyReport(),
      ]);
      setBatchStatus(latestBatchStatus);
      setLatestDailyReport(dailyReport);
    } catch (error) {
      setBatchStatusError(error instanceof Error ? error.message : "Batch status is not reachable.");
    }
  }

  async function refreshHistorianStatus(options: { silent?: boolean } = {}) {
    if (!options.silent) {
      setHistorianError(null);
    }

    try {
      setHistorianStatus(await getHistorianStatus());
    } catch (error) {
      setHistorianError(error instanceof Error ? error.message : "Historian status is not reachable.");
    }
  }

  async function refreshKnowledge(options: { silent?: boolean } = {}) {
    if (!options.silent) {
      setKnowledgeError(null);
    }

    try {
      const [overview, recent] = await Promise.all([
        getKnowledgeOverview(),
        getRecentKnowledgeNodes(12),
      ]);
      setKnowledgeOverview(overview);
      setRecentKnowledgeNodes(recent);
    } catch (error) {
      setKnowledgeError(error instanceof Error ? error.message : "Knowledge graph is not reachable.");
    }
  }

  async function refreshArchitectureReviews(options: { silent?: boolean } = {}) {
    if (!options.silent) {
      setArchitectureReviewError(null);
    }

    try {
      const [latest, recent] = await Promise.all([
        getLatestArchitectureReview(),
        getRecentArchitectureReviews(8),
      ]);
      setLatestArchitectureReview(latest);
      setRecentArchitectureReviews(recent);
    } catch (error) {
      setArchitectureReviewError(error instanceof Error ? error.message : "Architect reviews are not reachable.");
    }
  }

  async function refreshMesh(options: { silent?: boolean } = {}) {
    if (!options.silent) {
      setMeshError(null);
    }

    try {
      setMeshOverview(await getMeshOverview());
    } catch (error) {
      setMeshError(error instanceof Error ? error.message : "Agent mesh overview is not reachable.");
    }
  }

  async function refreshKpi(options: { silent?: boolean; range?: KpiRange } = {}) {
    if (!options.silent) {
      setKpiError(null);
    }

    try {
      setKpiOverview(await getKpiOverview(options.range ?? kpiRange));
    } catch (error) {
      setKpiError(error instanceof Error ? error.message : "KPI overview is not reachable.");
    }
  }

  async function refreshPlatformHealth(options: { silent?: boolean } = {}) {
    if (!options.silent) {
      setPlatformHealthError(null);
    }

    try {
      const [health, endpoints, readiness] = await Promise.all([
        getPlatformHealth(),
        getEndpointHealth(),
        getPlatformReadiness(),
      ]);
      setPlatformHealth(health);
      setEndpointHealth(endpoints);
      setPlatformReadiness(readiness);
      const [publicAccess, version] = await Promise.all([
        getPublicAccessStatus(),
        getRuntimeVersion(),
      ]);
      setPublicAccessStatus(publicAccess);
      setRuntimeVersion(version);
    } catch (error) {
      setPlatformHealthError(error instanceof Error ? error.message : "Platform health is not reachable.");
    }
  }

  const warningCount = getPipelineWarningMessages(runtimeStatus).length;
  const operatorActive = Boolean(runtimeStatus?.queue.processing || runtimeStatus?.processes.implementer || runtimeStatus?.processes.reviewer || runtimeStatus?.processes.reviewer_bridge);

  return (
    <div className="grid gap-5">
      <FloatingRuntimeControls
        focusMode={focusMode}
        onToggleFocus={() => setFocusMode((current) => !current)}
      />

      <OperationsNav
        view={view}
        setView={setView}
        decisionsCount={data.decisions.length}
        warningsCount={warningCount}
        operatorActive={operatorActive}
      />

      {view === "dashboard" ? (
        <DashboardView
          runtimeStatus={runtimeStatus}
          runtimeError={runtimeError}
          runtimeEvents={runtimeEvents}
          isRefreshingRuntime={isRefreshingRuntime}
          refreshRuntime={refreshRuntime}
          refreshRuntimeEvents={refreshRuntimeEvents}
          focusMode={focusMode}
          batchStatus={batchStatus}
          latestDailyReport={latestDailyReport}
          batchStatusError={batchStatusError}
          latestArchitectureReview={latestArchitectureReview}
          meshOverview={meshOverview}
          meshError={meshError}
          kpiOverview={kpiOverview}
          kpiError={kpiError}
          knowledgeOverview={knowledgeOverview}
          platformHealth={platformHealth}
          endpointHealth={endpointHealth}
          platformReadiness={platformReadiness}
          platformHealthError={platformHealthError}
          publicAccessStatus={publicAccessStatus}
        />
      ) : null}

      {view === "decisions" ? (
        <DecisionsView
          decisions={data.decisions}
          runtimeStatus={runtimeStatus}
          latestArchitectureReview={latestArchitectureReview}
          onRecorded={() => {
            refreshRuntimeEvents({ silent: true });
            reloadDashboard({ silent: true });
          }}
        />
      ) : null}

      {view === "operators" ? (
        <OperatorsView
          runtimeStatus={runtimeStatus}
          runtimeError={runtimeError}
          data={data}
          taskCounts={taskCounts}
          backendReachability={backendReachability}
          commandRunsReachability={commandRunsReachability}
          consistencyError={consistencyError}
          latestArchitectureReview={latestArchitectureReview}
          architectureReviewError={architectureReviewError}
          onOpenMesh={() => setView("mesh")}
          onRecorded={refreshRuntimeEvents}
        />
      ) : null}

      {view === "timeline" ? (
        <TimelineView
          events={runtimeEvents}
          error={runtimeEventsError}
          isRefreshing={isRefreshingEvents}
          refresh={refreshRuntimeEvents}
        />
      ) : null}

      {view === "knowledge" ? (
        <KnowledgeView
          historianStatus={historianStatus}
          historianError={historianError}
          knowledgeOverview={knowledgeOverview}
          recentNodes={recentKnowledgeNodes}
          knowledgeError={knowledgeError}
          recentArchitectureReviews={recentArchitectureReviews}
        />
      ) : null}

      {view === "mesh" ? (
        <MeshView
          meshOverview={meshOverview}
          error={meshError}
          knowledgeOverview={knowledgeOverview}
        />
      ) : null}

      {view === "kpi" ? (
        <KpiView
          kpiOverview={kpiOverview}
          range={kpiRange}
          error={kpiError}
          onRangeChange={setKpiRange}
        />
      ) : null}

      {view === "settings" ? (
        <SettingsView
          backendReachability={backendReachability}
          commandRunsReachability={commandRunsReachability}
          runtimeStatus={runtimeStatus}
          batchStatus={batchStatus}
          latestDailyReport={latestDailyReport}
          historianStatus={historianStatus}
          historianError={historianError}
          batchStatusError={batchStatusError}
          endpointHealth={endpointHealth}
          platformReadiness={platformReadiness}
          publicAccessStatus={publicAccessStatus}
          platformHealthError={platformHealthError}
          runtimeVersion={runtimeVersion}
        />
      ) : null}
    </div>
  );
}

function OperationsNav({
  view,
  setView,
  decisionsCount,
  warningsCount,
  operatorActive,
}: {
  view: AppView;
  setView: (view: AppView) => void;
  decisionsCount: number;
  warningsCount: number;
  operatorActive: boolean;
}) {
  const items: { id: AppView; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "decisions", label: "Decisions" },
    { id: "operators", label: "Operators" },
    { id: "timeline", label: "Timeline" },
    { id: "knowledge", label: "Knowledge" },
    { id: "mesh", label: "Mesh" },
    { id: "kpi", label: "KPI" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <nav className="flex gap-2 overflow-x-auto rounded-md border border-white/10 bg-white/[0.03] p-2 sm:flex-wrap">
      {items.map((item) => {
        const active = view === item.id;
        return (
          <button
            key={item.id}
            className={`inline-flex shrink-0 items-center gap-2 rounded px-3 py-2 text-sm font-medium transition ${
              active ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:bg-white/10"
            }`}
            onClick={() => setView(item.id)}
            type="button"
          >
            {item.id === "operators" ? (
              <span
                className={`h-2 w-2 rounded-full ${operatorActive ? "bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]" : "bg-slate-600"}`}
                title={operatorActive ? "Operator runtime detected" : "No operator runtime detected"}
              />
            ) : null}
            <span>{item.label}</span>
            {item.id === "decisions" && decisionsCount ? (
              <span className={`rounded px-1.5 py-0.5 text-xs ${active ? "bg-slate-950/15 text-slate-950" : "bg-cyan-400/15 text-cyan-200"}`}>
                {decisionsCount}
              </span>
            ) : null}
            {item.id === "dashboard" && warningsCount ? (
              <span className={`rounded px-1.5 py-0.5 text-xs ${active ? "bg-amber-950/15 text-amber-950" : "bg-amber-400/15 text-amber-200"}`}>
                {warningsCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

function DashboardView({
  runtimeStatus,
  runtimeError,
  runtimeEvents,
  isRefreshingRuntime,
  refreshRuntime,
  refreshRuntimeEvents,
  focusMode,
  batchStatus,
  latestDailyReport,
  batchStatusError,
  latestArchitectureReview,
  meshOverview,
  meshError,
  kpiOverview,
  kpiError,
  knowledgeOverview,
  platformHealth,
  endpointHealth,
  platformReadiness,
  platformHealthError,
  publicAccessStatus,
}: {
  runtimeStatus: LocalRuntimeStatus | null;
  runtimeError: string | null;
  runtimeEvents: RuntimeEvent[];
  isRefreshingRuntime: boolean;
  refreshRuntime: (options?: { silent?: boolean }) => void;
  refreshRuntimeEvents: (options?: { silent?: boolean }) => void;
  focusMode: boolean;
  batchStatus: LatestBatchStatus | null;
  latestDailyReport: DailyReport | null;
  batchStatusError: string | null;
  latestArchitectureReview: ArchitectureReview | null;
  meshOverview: MeshOverview | null;
  meshError: string | null;
  kpiOverview: KpiOverview | null;
  kpiError: string | null;
  knowledgeOverview: KnowledgeOverview | null;
  platformHealth: PlatformHealth | null;
  endpointHealth: EndpointHealth | null;
  platformReadiness: PlatformReadiness | null;
  platformHealthError: string | null;
  publicAccessStatus: PublicAccessStatus | null;
}) {
  return (
    <div className="grid gap-5">
      <DashboardHero
        runtimeStatus={runtimeStatus}
        runtimeError={runtimeError}
        latestArchitectureReview={latestArchitectureReview}
        readiness={platformReadiness}
        endpointHealth={endpointHealth}
        kpiOverview={kpiOverview}
        meshOverview={meshOverview}
        latestDailyReport={latestDailyReport}
      />

      {focusMode ? null : (
        <>
          <DashboardMetricStrip
            endpointHealth={endpointHealth}
            knowledgeOverview={knowledgeOverview}
            meshOverview={meshOverview}
            kpiOverview={kpiOverview}
            latestDailyReport={latestDailyReport}
          />

          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <DashboardAlerts
              runtimeStatus={runtimeStatus}
              runtimeError={runtimeError}
              endpointHealth={endpointHealth}
              platformHealthError={platformHealthError}
              kpiError={kpiError}
              meshError={meshError}
              batchStatusError={batchStatusError}
            />
            <DashboardLatestEvidence runtimeStatus={runtimeStatus} />
          </div>

          <Panel title="Recent Activity">
            <TimelinePreview events={runtimeEvents} />
          </Panel>
        </>
      )}
    </div>
  );
}

function DashboardHero({
  runtimeStatus,
  runtimeError,
  latestArchitectureReview,
  readiness,
  endpointHealth,
  kpiOverview,
  meshOverview,
  latestDailyReport,
}: {
  runtimeStatus: LocalRuntimeStatus | null;
  runtimeError: string | null;
  latestArchitectureReview: ArchitectureReview | null;
  readiness: PlatformReadiness | null;
  endpointHealth: EndpointHealth | null;
  kpiOverview: KpiOverview | null;
  meshOverview: MeshOverview | null;
  latestDailyReport: DailyReport | null;
}) {
  const bottleneck = getPipelineBottleneck(runtimeStatus);
  const warnings = getDashboardWarningMessages(runtimeStatus, runtimeError, endpointHealth, kpiOverview, meshOverview, latestDailyReport);
  const systemState = runtimeError ? "offline" : runtimeStatus?.queue.processing ? "working" : runtimeStatus?.queue.inbox ? "waiting" : "idle";
  const activeTask = runtimeStatus?.active_task ?? runtimeStatus?.latest_details.builder?.task_id ?? "No active task";
  const currentWorker = getCurrentWorker(runtimeStatus);
  const latestVerdict = runtimeStatus?.latest_details.reviewer?.verdict ?? "none";
  const recommendedAction = getRecommendedPmAction(runtimeStatus, runtimeError, latestArchitectureReview, endpointHealth);

  return (
    <section className="rounded-lg border border-cyan-300/20 bg-gradient-to-br from-[#0e1824] via-[#0b1119] to-[#080b11] p-5 shadow-2xl shadow-cyan-950/20 sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge className={getDashboardStateStyle(systemState)}>{systemState}</StatusBadge>
            <StatusBadge className={readiness ? "bg-cyan-500/15 text-cyan-200 ring-cyan-400/25" : "bg-slate-500/15 text-slate-200 ring-slate-400/20"}>
              readiness {readiness ? `${readiness.score} ${readiness.grade}` : "unknown"}
            </StatusBadge>
            <StatusBadge className={warnings.length ? "bg-amber-500/15 text-amber-200 ring-amber-400/25" : "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25"}>
              {warnings.length ? `${warnings.length} alerts` : "no critical alerts"}
            </StatusBadge>
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-white sm:text-3xl">ArchiveOS PM Operations Overview</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Read-only AI operations visibility. Decisions are recorded as PM memory; no Codex, MCP, OpenAI, or shell execution is triggered from the UI.
          </p>
        </div>
        <div className="rounded-md border border-white/10 bg-black/25 p-4 xl:w-80">
          <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">Recommended PM action</p>
          <p className="mt-2 text-sm leading-6 text-slate-100">{recommendedAction}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <RuntimeMetric label="Active task" value={activeTask} copyable={activeTask !== "No active task"} emphasized />
        <RuntimeMetric label="Current worker" value={currentWorker} />
        <RuntimeMetric label="Latest verdict" value={latestVerdict} />
        <RuntimeMetric label="Runtime health" value={bottleneck.label} />
        <RuntimeMetric label="Architect" value={getArchitectStatusLabel(latestArchitectureReview)} />
        <RuntimeMetric label="Endpoint health" value={endpointHealth ? `${endpointHealth.summary.ok}/${endpointHealth.summary.total} online` : "unknown"} />
      </div>
    </section>
  );
}

function DashboardMetricStrip({
  endpointHealth,
  knowledgeOverview,
  meshOverview,
  kpiOverview,
  latestDailyReport,
}: {
  endpointHealth: EndpointHealth | null;
  knowledgeOverview: KnowledgeOverview | null;
  meshOverview: MeshOverview | null;
  kpiOverview: KpiOverview | null;
  latestDailyReport: DailyReport | null;
}) {
  const activeAgents = meshOverview?.agents.filter((agent) => ["working", "detected", "enabled", "clear"].includes(agent.status)).length ?? 0;
  const offlineAgents = meshOverview?.agents.filter((agent) => ["not_detected", "disabled", "offline"].includes(agent.status)).length ?? 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <RuntimeMetric label="Agents active/offline" value={meshOverview ? `${activeAgents}/${offlineAgents}` : "unknown"} />
      <RuntimeMetric label="Knowledge nodes" value={String(knowledgeOverview?.totalNodes ?? 0)} />
      <RuntimeMetric label="Knowledge edges" value={String(knowledgeOverview?.totalEdges ?? 0)} />
      <RuntimeMetric label="Approval rate" value={kpiOverview ? formatKpiPercent(kpiOverview.quality.approvalRate) : "insufficient data"} />
      <RuntimeMetric label="Warnings" value={kpiOverview ? formatKpiValue(kpiOverview.runtime.warningCount) : String(endpointHealth?.summary.error ?? 0)} />
      <RuntimeMetric label="Daily report" value={latestDailyReport?.status ?? "not recorded"} />
    </div>
  );
}

function DashboardAlerts({
  runtimeStatus,
  runtimeError,
  endpointHealth,
  platformHealthError,
  kpiError,
  meshError,
  batchStatusError,
}: {
  runtimeStatus: LocalRuntimeStatus | null;
  runtimeError: string | null;
  endpointHealth: EndpointHealth | null;
  platformHealthError: string | null;
  kpiError: string | null;
  meshError: string | null;
  batchStatusError: string | null;
}) {
  const warnings = [
    ...getPipelineWarningMessages(runtimeStatus),
    runtimeError ? "Runtime backend is unreachable. Check Operators and Settings diagnostics." : null,
    platformHealthError ? "Endpoint health is unavailable. Restart backend from latest main if this persists." : null,
    kpiError ? "KPI data is not available yet. Check KPI tab after batches run." : null,
    meshError ? "Mesh data is not available yet. Check Mesh tab after backend sync." : null,
    batchStatusError ? "Daily/Nightly batch status is not available yet." : null,
    endpointHealth && endpointHealth.summary.missing + endpointHealth.summary.error > 0
      ? `${endpointHealth.summary.missing + endpointHealth.summary.error} endpoint checks need attention.`
      : null,
  ].filter(Boolean).slice(0, 3) as string[];

  return (
    <Panel title="Critical Alerts">
      {warnings.length ? (
        <div className="grid gap-2">
          {warnings.map((warning) => (
            <p key={warning} className="rounded border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm leading-6 text-amber-100">
              {warning}
            </p>
          ))}
          <p className="text-xs text-slate-500">Open Timeline for history or Settings for endpoint diagnostics.</p>
        </div>
      ) : (
        <EmptyState title="No critical alerts" detail="No stale runtime, endpoint, or batch warning is currently visible." muted />
      )}
    </Panel>
  );
}

function DashboardLatestEvidence({ runtimeStatus }: { runtimeStatus: LocalRuntimeStatus | null }) {
  const builder = runtimeStatus?.latest_details.builder ?? null;
  const reviewer = runtimeStatus?.latest_details.reviewer ?? null;

  return (
    <Panel title="Latest Evidence">
      <div className="grid gap-3 md:grid-cols-2">
        <EvidenceTile
          kind="Builder"
          title={builder?.task_id ?? runtimeStatus?.latest.outbox?.name ?? "No builder result"}
          status={builder?.status ?? "none"}
          timestamp={builder?.finished_at ?? runtimeStatus?.latest.outbox?.updated_at ?? null}
          summary={builder?.summary ?? "No builder summary captured yet."}
          externalRef={runtimeStatus?.latest.outbox?.name ?? builder?.task_id ?? null}
        />
        <EvidenceTile
          kind="Reviewer"
          title={reviewer?.reviewed_task_id ?? runtimeStatus?.latest.review?.name ?? "No reviewer result"}
          status={reviewer?.verdict ?? "none"}
          timestamp={reviewer?.reviewed_at ?? runtimeStatus?.latest.review?.updated_at ?? null}
          summary={reviewer?.summary ?? "No reviewer summary captured yet."}
          externalRef={runtimeStatus?.latest.review?.name ?? reviewer?.reviewed_task_id ?? null}
        />
      </div>
    </Panel>
  );
}

function EvidenceTile({
  kind,
  title,
  status,
  timestamp,
  summary,
  externalRef,
}: {
  kind: string;
  title: string;
  status: string;
  timestamp: string | null;
  summary: string;
  externalRef: string | null;
}) {
  return (
    <article className="rounded-md border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{kind}</p>
          <CompactValue value={title} className="mt-2 text-sm font-semibold text-white" copyable={title !== `No ${kind.toLowerCase()} result`} />
        </div>
        <StatusBadge className={getResultStatusStyle(status)}>{status}</StatusBadge>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300" title={summary}>{summary}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500" title={timestamp ? formatExactDate(timestamp) : "No timestamp available"}>
          {timestamp ? formatRelativeTime(timestamp) : "unknown time"}
        </span>
        <RelatedKnowledgeCount externalRef={externalRef} />
      </div>
    </article>
  );
}

function RelatedKnowledgeCount({ externalRef }: { externalRef: string | null }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCount() {
      if (!externalRef) {
        setCount(0);
        return;
      }
      try {
        const relatedGroups = await getRelatedKnowledge({ external_ref: externalRef });
        if (!cancelled) {
          setCount(relatedGroups.reduce((total, group) => total + group.related.length, 0));
        }
      } catch {
        if (!cancelled) {
          setCount(null);
        }
      }
    }

    loadCount();
    return () => {
      cancelled = true;
    };
  }, [externalRef]);

  return (
    <span className="rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-slate-400">
      related {count ?? "unknown"}
    </span>
  );
}

function DecisionsView({
  decisions,
  runtimeStatus,
  latestArchitectureReview,
  onRecorded,
}: {
  decisions: WorkLog[];
  runtimeStatus: LocalRuntimeStatus | null;
  latestArchitectureReview: ArchitectureReview | null;
  onRecorded: (options?: { silent?: boolean }) => void;
}) {
  const targetTask =
    runtimeStatus?.active_task ??
    runtimeStatus?.latest_details.reviewer?.reviewed_task_id ??
    runtimeStatus?.latest_details.builder?.task_id ??
    runtimeStatus?.latest.outbox?.name ??
    null;
  const latestDecisionTime = decisions[0]?.created_at ?? null;
  const pendingCount = targetTask ? 1 : 0;
  const architectWarnings = latestArchitectureReview?.findings.length ?? 0;
  const recommendedAction = latestArchitectureReview?.status === "blocked"
    ? "Architect blocked this target. Record rejection or request decomposition before implementation continues."
    : targetTask
      ? "Review the latest evidence and record approval or rejection."
      : "No active runtime target is available. Wait for a builder/reviewer result before recording a PM decision.";

  return (
    <div className="grid gap-5">
      <Panel title="PM Decision Center">
        <SourceLabel label="Writes real PM decisions to Supabase work_logs with log_type=decision. No agent execution is triggered." />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <RuntimeMetric label="Pending decision targets" value={String(pendingCount)} emphasized={pendingCount > 0} />
          <RuntimeMetric label="Recorded decisions" value={String(decisions.length)} />
          <RuntimeMetric label="Architect warnings" value={String(architectWarnings)} />
          <RuntimeMetric label="Related knowledge" value={targetTask ? "linked by target" : "none"} />
          <RuntimeMetric label="Last decision" value={latestDecisionTime ? formatRelativeTime(latestDecisionTime) : "none"} />
        </div>
        <div className="mt-4 rounded-md border border-cyan-300/20 bg-cyan-300/[0.04] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">Current recommended action</p>
          <p className="mt-2 text-sm leading-6 text-slate-100">{recommendedAction}</p>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.1fr]">
          <div className="grid gap-3">
            <DecisionTargetCard runtimeStatus={runtimeStatus} targetTask={targetTask} />
            <RelatedArchitectReviewMini review={latestArchitectureReview} targetRef={targetTask} />
            <RelatedKnowledgeMini externalRef={targetTask} />
          </div>
          <div className="rounded-md border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-semibold text-white">Record PM decision</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              This stores PM intent as operational memory only. It does not approve, reject, or execute MCP/Codex work automatically.
            </p>
            <ApprovalRecorder targetTask={targetTask} onRecorded={onRecorded} />
          </div>
        </div>
      </Panel>
      <Panel title="Recorded Decisions">
        <SourceLabel label="non-seed Supabase work_logs where log_type=decision" />
        <div className="mt-3">
          {decisions.length ? (
            <LogList logs={decisions} />
          ) : (
            <EmptyState
              title="No PM decisions recorded yet"
              detail="Use Record Approval or Record Rejection above when a real runtime target is ready. Seed/demo decisions remain hidden."
              muted
            />
          )}
        </div>
      </Panel>
    </div>
  );
}

function DecisionTargetCard({
  runtimeStatus,
  targetTask,
}: {
  runtimeStatus: LocalRuntimeStatus | null;
  targetTask: string | null;
}) {
  return (
    <article className="rounded-md border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Decision target</p>
          <p className="mt-1 text-xs text-slate-500">Current task/result/review context</p>
        </div>
        <StatusBadge className={targetTask ? "bg-cyan-500/15 text-cyan-200 ring-cyan-400/25" : "bg-slate-500/15 text-slate-200 ring-slate-400/20"}>
          {targetTask ? "ready" : "empty"}
        </StatusBadge>
      </div>
      <div className="mt-4 grid gap-3">
        <RuntimeMetric label="Target task" value={targetTask ?? "No linked runtime task"} copyable={Boolean(targetTask)} emphasized={Boolean(targetTask)} />
        <RuntimeMetric label="Builder result" value={runtimeStatus?.latest.outbox?.name ?? "No linked result file"} copyable={Boolean(runtimeStatus?.latest.outbox?.name)} />
        <RuntimeMetric label="Reviewer result" value={runtimeStatus?.latest.review?.name ?? "No linked review file"} copyable={Boolean(runtimeStatus?.latest.review?.name)} />
      </div>
    </article>
  );
}

function DailyReportStatusCard({
  batchStatus,
  latestDailyReport,
  error,
}: {
  batchStatus: LatestBatchStatus | null;
  latestDailyReport: DailyReport | null;
  error: string | null;
}) {
  const nightly = batchStatus?.nightly_review ?? null;
  const daily = batchStatus?.daily_report ?? null;
  const dailyReason = readBatchReason(daily);

  if (error) {
    return (
      <EmptyState
        title="No daily report data available yet"
        detail="Daily Report endpoints are not returning usable data. Check System Health for endpoint-level status."
        muted
      />
    );
  }

  return (
    <div className="grid gap-3">
      {latestDailyReport ? (
        <div className="rounded-md border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">Korean PM Daily Report</p>
              <p className="mt-1 text-xs text-slate-500">target {latestDailyReport.target_date} / {formatDate(latestDailyReport.created_at)}</p>
            </div>
            <StatusBadge className={operationStatusStyles[latestDailyReport.status]}>
              {getOperationStatusLabelKo(latestDailyReport.status)}
            </StatusBadge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <RuntimeMetric label="Discord sent" value={latestDailyReport.discord_sent ? "yes" : "no"} />
            <RuntimeMetric label="Decisions" value={String(latestDailyReport.decisions_count)} />
            <RuntimeMetric label="Commands" value={String(latestDailyReport.commands_count)} />
            <RuntimeMetric
              label="Dashboard link"
              value={batchStatus?.archiveos_public_url_configured ? "configured" : "not configured"}
            />
            <RuntimeMetric
              label="Historian export"
              value={latestDailyReport.historian_exported ? "exported" : "not exported"}
            />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">{latestDailyReport.status_reason}</p>
          {latestDailyReport.discord_skipped_reason ? (
            <p className="mt-2 text-xs leading-5 text-amber-200">Discord skip/failure reason: {latestDailyReport.discord_skipped_reason}</p>
          ) : null}
          {latestDailyReport.historian_note_path ? (
            <CompactValue
              value={latestDailyReport.historian_note_path}
              className="mt-2 text-xs text-emerald-200"
              copyable
            />
          ) : latestDailyReport.historian_export_reason ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">Historian: {latestDailyReport.historian_export_reason}</p>
          ) : null}
          <RelatedKnowledgeMini externalRef={`daily_report:${latestDailyReport.target_date}`} />
        </div>
      ) : (
        <EmptyState
          title="No stored daily report"
          detail="Run the backend daily report batch after the daily_reports table exists."
          muted
        />
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <BatchStatusTile
          title="Nightly Review"
          run={nightly}
          emptyDetail="No nightly review batch has been recorded yet."
        />
        <BatchStatusTile
          title="Daily Discord Report"
          run={daily}
          emptyDetail="No daily report batch has been recorded yet."
          extra={dailyReason ? `Skip/failure reason: ${dailyReason}` : undefined}
        />
      </div>
    </div>
  );
}

function SystemHealthCard({
  platformHealth,
  endpointHealth,
  error,
}: {
  platformHealth: PlatformHealth | null;
  endpointHealth: EndpointHealth | null;
  error: string | null;
}) {
  if (error) {
    return (
      <EmptyState
        title="System health check unavailable"
        detail="The backend health center could not be reached. Confirm the backend is restarted with the latest build."
      />
    );
  }

  if (!endpointHealth) {
    return <EmptyState title="System health loading" detail="Checking registered ArchiveOS endpoints." muted />;
  }

  const failedEndpoints = endpointHealth.endpoints.filter((endpoint) => endpoint.status === "error");
  const missingEndpoints = endpointHealth.endpoints.filter((endpoint) => endpoint.status === "missing");
  const failedServices = platformHealth
    ? Object.entries(platformHealth.services).filter(([, online]) => !online).map(([service]) => service)
    : [];

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <RuntimeMetric label="Online endpoints" value={String(endpointHealth.summary.online)} />
        <RuntimeMetric label="Failed endpoints" value={String(endpointHealth.summary.failed)} />
        <RuntimeMetric label="Missing endpoints" value={String(endpointHealth.summary.missing)} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge className={endpointHealth.summary.failed ? "bg-amber-500/15 text-amber-200 ring-amber-400/25" : "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25"}>
          {endpointHealth.summary.failed ? "warning" : "healthy"}
        </StatusBadge>
        <span className="text-xs text-slate-500" title={formatExactDate(endpointHealth.checkedAt)}>
          Last check {formatRelativeTime(endpointHealth.checkedAt)}
        </span>
      </div>
      {failedServices.length ? (
        <div className="rounded-md border border-amber-400/25 bg-amber-500/10 p-3 text-sm text-amber-100">
          Failed services: {failedServices.join(", ")}
        </div>
      ) : null}
      {failedEndpoints.length || missingEndpoints.length ? (
        <div className="grid gap-2">
          {[...failedEndpoints, ...missingEndpoints].slice(0, 5).map((endpoint) => (
            <div key={`${endpoint.method}-${endpoint.path}`} className="flex items-center justify-between gap-3 rounded border border-white/10 bg-black/20 px-3 py-2 text-xs">
              <span className="truncate text-slate-300" title={`${endpoint.method} ${endpoint.path}`}>
                {endpoint.name}: {endpoint.method} {endpoint.path}
              </span>
              <StatusBadge className="bg-rose-500/15 text-rose-200 ring-rose-400/25">{endpoint.status}</StatusBadge>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReadinessScoreCard({
  readiness,
  error,
}: {
  readiness: PlatformReadiness | null;
  error: string | null;
}) {
  if (error) {
    return (
      <EmptyState
        title="Readiness score unavailable"
        detail="ArchiveOS can still run, but the readiness endpoint needs the latest backend."
        muted
      />
    );
  }

  if (!readiness) {
    return <EmptyState title="Readiness score loading" detail="Calculating endpoint, dashboard, knowledge, mesh, and architect coverage." muted />;
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-4xl font-semibold text-white">{readiness.score}</p>
          <p className="mt-1 text-sm text-slate-400">Portfolio readiness score</p>
        </div>
        <StatusBadge className={readiness.score >= 85 ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25" : readiness.score >= 70 ? "bg-amber-500/15 text-amber-200 ring-amber-400/25" : "bg-rose-500/15 text-rose-200 ring-rose-400/25"}>
          {readiness.grade}
        </StatusBadge>
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        {Object.entries(readiness.coverage).map(([label, value]) => (
          <RuntimeMetric key={label} label={label} value={`${value}%`} />
        ))}
      </div>
      {readiness.issues.length ? (
        <div className="rounded-md border border-amber-400/25 bg-amber-500/10 p-3 text-sm text-amber-100">
          {readiness.issues.slice(0, 2).join(" ")}
        </div>
      ) : (
        <p className="text-sm text-emerald-200">No hard readiness blockers detected.</p>
      )}
      <p className="text-xs text-slate-500" title={formatExactDate(readiness.generatedAt)}>
        Generated {formatRelativeTime(readiness.generatedAt)}
      </p>
    </div>
  );
}

function BatchStatusTile({
  title,
  run,
  emptyDetail,
  extra,
}: {
  title: string;
  run: LatestBatchStatus["nightly_review"];
  emptyDetail: string;
  extra?: string;
}) {
  if (!run) {
    return (
      <div className="rounded-md border border-white/10 bg-black/20 p-4">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-2 text-sm text-slate-500">{emptyDetail}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">{title}</p>
        <StatusBadge className={getBatchStatusStyle(run.status)}>{run.status}</StatusBadge>
      </div>
      <p className="mt-2 text-xs text-slate-500">target {run.target_date} / {formatDate(run.created_at)}</p>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300" title={run.summary}>
        {run.summary}
      </p>
      {extra ? <p className="mt-2 text-xs leading-5 text-amber-200">{extra}</p> : null}
    </div>
  );
}

function OperatorsView({
  runtimeStatus,
  runtimeError,
  data,
  taskCounts,
  backendReachability,
  commandRunsReachability,
  consistencyError,
  latestArchitectureReview,
  architectureReviewError,
  onOpenMesh,
  onRecorded,
}: {
  runtimeStatus: LocalRuntimeStatus | null;
  runtimeError: string | null;
  data: DashboardData;
  taskCounts: { status: TaskStatus; label: string; count: number }[];
  backendReachability: ConsistencyStatus;
  commandRunsReachability: ConsistencyStatus;
  consistencyError: string | null;
  latestArchitectureReview: ArchitectureReview | null;
  architectureReviewError: string | null;
  onOpenMesh: () => void;
  onRecorded: (options?: { silent?: boolean }) => void;
}) {
  return (
    <div className="grid gap-5">
      <Panel title="Operators">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SourceLabel label="live MCP + backend-derived process detection" />
          <button
            className="rounded border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15"
            onClick={onOpenMesh}
            type="button"
          >
            Open Mesh View
          </button>
        </div>
        {runtimeError ? (
          <EmptyState title="Operator runtime unavailable" detail={runtimeError} />
        ) : runtimeStatus ? (
          <NowWorkingPanel runtimeStatus={runtimeStatus} onRecorded={onRecorded} showRecorder={false} />
        ) : (
          <EmptyState title="Loading operators" detail="Reading local runtime process state." />
        )}
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <ProcessCard title="MCP Loop" process={runtimeStatus?.processes.loop ?? null} interpretation={getLoopInterpretation(runtimeStatus)} />
        <ProcessCard title="Reviewer Bridge" process={runtimeStatus?.processes.reviewer_bridge ?? null} interpretation={getBridgeInterpretation(runtimeStatus)} />
      </div>

      <Panel title="Architect">
        <ArchitectStatusCard review={latestArchitectureReview} error={architectureReviewError} />
      </Panel>

      <PipelineOverview runtimeStatus={runtimeStatus} runtimeError={runtimeError} />

      <QueueDetailsPanel runtimeStatus={runtimeStatus} taskCounts={taskCounts} />

      <DataConsistencyPanel
        runtimeStatus={runtimeStatus}
        runtimeError={runtimeError}
        data={data}
        backendReachability={backendReachability}
        commandRunsReachability={commandRunsReachability}
        consistencyError={consistencyError}
      />
    </div>
  );
}

function TimelineView({
  events,
  error,
  isRefreshing,
  refresh,
}: {
  events: RuntimeEvent[];
  error: string | null;
  isRefreshing: boolean;
  refresh: (options?: { silent?: boolean }) => void;
}) {
  return <EventTimeline events={events} error={error} isRefreshing={isRefreshing} refresh={refresh} />;
}

function KnowledgeView({
  historianStatus,
  historianError,
  knowledgeOverview,
  recentNodes,
  knowledgeError,
  recentArchitectureReviews,
}: {
  historianStatus: HistorianStatus | null;
  historianError: string | null;
  knowledgeOverview: KnowledgeOverview | null;
  recentNodes: KnowledgeNode[];
  knowledgeError: string | null;
  recentArchitectureReviews: ArchitectureReview[];
}) {
  const memoryTypes = [
    { label: "Decisions", type: "decision" },
    { label: "Incidents", type: "incident" },
    { label: "Daily Reports", type: "daily_report" },
    { label: "Nightly Reviews", type: "nightly_review" },
    { label: "Builder Results", type: "builder_result" },
    { label: "Reviewer Results", type: "reviewer_result" },
    { label: "Obsidian Notes", type: "obsidian_note" },
    { label: "Architecture Reviews", type: "architecture_review" },
  ];

  return (
    <div className="grid gap-5">
      <Panel title="Knowledge Health">
        {historianError || knowledgeError ? (
          <EmptyState
            title="Knowledge status needs backend sync"
            detail="Historian or Knowledge endpoints are missing, stale, or unreachable. Check Settings > Endpoint Health Matrix."
          />
        ) : (
          <div className="grid gap-4">
            <SourceLabel label="metadata-only Supabase relationships + backend/local Obsidian export" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <RuntimeMetric
                label="Historian"
                value={historianStatus?.configured ? "yes" : "no"}
              />
              <RuntimeMetric
                label="Obsidian export"
                value={historianStatus?.enabled ? "yes" : "no"}
              />
              <RuntimeMetric
                label="Nodes"
                value={String(knowledgeOverview?.totalNodes ?? 0)}
              />
              <RuntimeMetric
                label="Edges"
                value={String(knowledgeOverview?.totalEdges ?? 0)}
              />
              <RuntimeMetric
                label="Last export"
                value={historianStatus?.lastExport?.status ?? "none"}
              />
              <RuntimeMetric
                label="Last note"
                value={historianStatus?.lastExport?.notePath ?? "none"}
                copyable={Boolean(historianStatus?.lastExport?.notePath)}
              />
            </div>
            {historianStatus?.lastExport?.reason ? (
              <p className="rounded border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                {historianStatus.lastExport.reason}
              </p>
            ) : null}
          </div>
        )}
      </Panel>

      <KnowledgeGraphPanel />

      <KnowledgeSearchPanel />

      <Panel title="Memory Types">
        <div className="flex flex-wrap gap-2">
          {memoryTypes.map((item) => (
            <span key={item.type} className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200">
              <span>{item.label}</span>
              <span className="rounded bg-cyan-400/15 px-2 py-0.5 text-xs text-cyan-200">{knowledgeOverview?.countsByType?.[item.type] ?? 0}</span>
            </span>
          ))}
        </div>
      </Panel>

      <details className="rounded-md border border-white/10 bg-[#0d1117] p-4 sm:p-5">
        <summary className="cursor-pointer text-lg font-semibold text-white">Recent Memory</summary>
        <div className="mt-4">
          <KnowledgeNodeList nodes={recentNodes} />
        </div>
      </details>

      <details className="rounded-md border border-white/10 bg-[#0d1117] p-4 sm:p-5">
        <summary className="cursor-pointer text-lg font-semibold text-white">Architecture Reviews</summary>
        <div className="mt-4">
          <ArchitectureReviewList reviews={recentArchitectureReviews} />
        </div>
      </details>

      <details className="rounded-md border border-white/10 bg-[#0d1117] p-4 sm:p-5">
        <summary className="cursor-pointer text-lg font-semibold text-white">Graph Edge Fallback</summary>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          Compact relationship list only. No force graph, embeddings, vector search, or graph database is enabled.
        </p>
        <div className="mt-4">
          <KnowledgeEdgeTable edges={knowledgeOverview?.latestEdges ?? []} />
        </div>
      </details>
    </div>
  );
}

function KnowledgeNodeList({ nodes }: { nodes: KnowledgeNode[] }) {
  if (!nodes.length) {
    return <EmptyState title="No memory nodes yet" detail="Run Nightly Review or Daily Report after the knowledge graph schema is applied." muted />;
  }

  return (
    <div className="grid gap-3">
      {nodes.map((node) => (
        <article key={node.id} className="rounded-md border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge className="bg-cyan-500/15 text-cyan-200 ring-cyan-400/25">{node.node_type}</StatusBadge>
            <span className="rounded bg-black/20 px-2 py-1 text-xs text-slate-400">{node.source ?? "unknown"}</span>
            <span className="text-xs text-slate-500" title={formatExactDate(node.created_at)}>{formatRelativeTime(node.created_at)}</span>
          </div>
          <p className="mt-3 truncate text-sm font-semibold text-white" title={node.title}>{node.title}</p>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400" title={node.summary ?? ""}>{node.summary ?? "No summary."}</p>
          {node.external_ref ? (
            <CompactValue value={node.external_ref} className="mt-2 text-xs text-slate-500" copyable />
          ) : null}
        </article>
      ))}
    </div>
  );
}

function KnowledgeGraphPanel() {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [insights, setInsights] = useState<KnowledgeGraphInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(100);
  const [nodeType, setNodeType] = useState("all");
  const [edgeType, setEdgeType] = useState("all");
  const [importanceFilter, setImportanceFilter] = useState<"all" | "medium" | "high" | "critical">("all");
  const [recentOnly, setRecentOnly] = useState(false);
  const [decisionPathOnly, setDecisionPathOnly] = useState(false);
  const [architectPathOnly, setArchitectPathOnly] = useState(false);
  const [hideLowImportance, setHideLowImportance] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadGraph() {
      setLoading(true);
      setError(null);

      try {
        const [nextGraph, nextInsights] = await Promise.all([
          getKnowledgeGraph(limit),
          getKnowledgeGraphInsights(limit),
        ]);
        if (!cancelled) {
          setGraph(nextGraph);
          setInsights(nextInsights);
          setHideLowImportance((current) => current || nextGraph.nodes.length > 20);
          setImportanceFilter((current) => (current === "all" && nextGraph.nodes.length > 20 ? "medium" : current));
          setSelectedNodeId((current) =>
            current && nextGraph.nodes.some((node) => node.id === current) ? current : nextGraph.nodes[0]?.id ?? null,
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setGraph(null);
          setError(loadError instanceof Error ? loadError.message : "Knowledge Graph API를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadGraph();

    return () => {
      cancelled = true;
    };
  }, [limit]);

  const nodeTypes = useMemo(() => ["all", ...Object.keys(graph?.stats.types ?? {}).sort()], [graph]);
  const edgeTypes = useMemo(() => ["all", ...Array.from(new Set((graph?.edges ?? []).map((edge) => edge.type))).sort()], [graph]);
  const filtered = useMemo(
    () => filterKnowledgeGraph(graph, { nodeType, edgeType, query, importanceFilter, recentOnly, decisionPathOnly, architectPathOnly, hideLowImportance }),
    [graph, nodeType, edgeType, query, importanceFilter, recentOnly, decisionPathOnly, architectPathOnly, hideLowImportance],
  );
  const selectedNode = filtered.nodes.find((node) => node.id === selectedNodeId) ?? filtered.nodes[0] ?? null;
  const selectedEdges = selectedNode ? filtered.edges.filter((edge) => edge.from === selectedNode.id || edge.to === selectedNode.id) : [];
  const topTypes = Object.entries(graph?.stats.types ?? {})
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4);

  return (
    <Panel title="Knowledge Graph">
      <div className="grid gap-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <RuntimeMetric label="Nodes" value={String(graph?.stats.nodeCount ?? 0)} />
          <RuntimeMetric label="Edges" value={String(graph?.stats.edgeCount ?? 0)} />
          <RuntimeMetric label="Visible nodes" value={String(filtered.nodes.length)} />
          <RuntimeMetric label="Top types" value={topTypes.map(([type, count]) => `${type} ${count}`).join(", ") || "none"} />
        </div>

        <KnowledgeGraphInsightsPanel insights={insights} />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select className="min-h-11 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" onChange={(event) => setNodeType(event.target.value)} value={nodeType}>
            {nodeTypes.map((type) => <option key={type} value={type}>{type === "all" ? "All node types" : type}</option>)}
          </select>
          <select className="min-h-11 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" onChange={(event) => setEdgeType(event.target.value)} value={edgeType}>
            {edgeTypes.map((type) => <option key={type} value={type}>{type === "all" ? "All edge types" : type}</option>)}
          </select>
          <select className="min-h-11 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" onChange={(event) => setLimit(Number(event.target.value))} value={limit}>
            {[50, 100, 200].map((value) => <option key={value} value={value}>Limit {value}</option>)}
          </select>
          <select className="min-h-11 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none" onChange={(event) => setImportanceFilter(event.target.value as "all" | "medium" | "high" | "critical")} value={importanceFilter}>
            <option value="all">All importance</option>
            <option value="medium">Medium+</option>
            <option value="high">High+</option>
            <option value="critical">Critical only</option>
          </select>
          <input
            className="min-h-11 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 xl:col-span-2"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search label, title, external ref"
            value={query}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <GraphToggle label="Recent only" checked={recentOnly} onChange={setRecentOnly} />
          <GraphToggle label="Decision paths" checked={decisionPathOnly} onChange={setDecisionPathOnly} />
          <GraphToggle label="Architect paths" checked={architectPathOnly} onChange={setArchitectPathOnly} />
          <GraphToggle label="Hide low importance" checked={hideLowImportance} onChange={setHideLowImportance} />
        </div>

        <KnowledgeGraphLegend />

        {error ? (
          <EmptyState
            title="Knowledge Graph API를 불러오지 못했습니다."
            detail="백엔드 엔드포인트가 누락되었거나 오래된 프로세스일 수 있습니다. Settings > Endpoint Health Matrix를 확인하고 백엔드를 최신 main으로 재시작하세요."
          />
        ) : loading ? (
          <EmptyState title="Loading graph" detail="Reading knowledge_nodes and knowledge_edges." muted />
        ) : !filtered.nodes.length ? (
          <EmptyState
            title="아직 Knowledge Graph 데이터가 충분하지 않습니다."
            detail="Daily Report, Nightly Review, Architect Review, Historian Export가 실행되면 노드와 엣지가 생성됩니다."
            muted
          />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.7fr)]">
            <div className="overflow-x-auto rounded-md border border-white/10 bg-[#070d14] p-3">
              <KnowledgeGraphSvg graph={filtered} selectedNodeId={selectedNode?.id ?? null} onSelectNode={setSelectedNodeId} />
            </div>
            <KnowledgeGraphNodeDetail node={selectedNode} edges={selectedEdges} nodes={filtered.nodes} />
          </div>
        )}

        <DecisionChainsPanel insights={insights} />

        <KnowledgeGraphEdgeList edges={filtered.edges} nodes={filtered.nodes} />
      </div>
    </Panel>
  );
}

function GraphToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200">
      <input
        checked={checked}
        className="accent-cyan-300"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );
}

function KnowledgeGraphInsightsPanel({ insights }: { insights: KnowledgeGraphInsights | null }) {
  const mostImportant = insights?.topNodes[0] ?? null;
  const mostConnected = insights?.topNodes.slice().sort((left, right) => right.degree - left.degree)[0] ?? null;
  const latestImportant = insights?.topNodes.find((node) => node.importanceLevel === "critical" || node.importanceLevel === "high") ?? null;
  const activeChain = insights?.decisionChains[0] ?? null;

  return (
    <div className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Graph Insights</p>
          <p className="mt-1 text-xs text-slate-500">Rule-based importance from degree, recency, node type, and decision/Architect/incident paths.</p>
        </div>
        <StatusBadge className="bg-cyan-500/15 text-cyan-200 ring-cyan-400/25">
          {insights ? `${insights.graphHealth.criticalCount} critical / ${insights.graphHealth.hubCount} hubs` : "loading"}
        </StatusBadge>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <RuntimeMetric label="Most important" value={mostImportant ? `${mostImportant.label} (${mostImportant.importanceScore})` : "none"} />
        <RuntimeMetric label="Most connected" value={mostConnected ? `${mostConnected.label} (${mostConnected.degree})` : "none"} />
        <RuntimeMetric label="Latest important" value={latestImportant?.label ?? "none"} />
        <RuntimeMetric label="Active decision chain" value={activeChain?.decisionLabel ?? "none"} />
        <RuntimeMetric label="Critical/high nodes" value={String(insights?.topNodes.filter((node) => node.importanceLevel === "critical" || node.importanceLevel === "high").length ?? 0)} />
        <RuntimeMetric label="Isolated nodes" value={String(insights?.graphHealth.isolatedNodeCount ?? 0)} />
      </div>
      {insights?.notes.length ? (
        <div className="mt-3 grid gap-2">
          {insights.notes.slice(0, 2).map((note) => (
            <p key={note} className="rounded border border-white/10 bg-black/20 p-2 text-xs leading-5 text-slate-400">{note}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function KnowledgeGraphLegend() {
  const items = [
    ["Decision path", "bg-cyan-300"],
    ["Architect path", "bg-amber-300"],
    ["Incident path", "bg-rose-300"],
    ["Recent node", "bg-emerald-300"],
  ];

  return (
    <div className="flex flex-wrap gap-2 rounded-md border border-white/10 bg-black/20 p-3">
      {items.map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-2 text-xs text-slate-300">
          <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
          {label}
        </span>
      ))}
      <span className="text-xs text-slate-500">Node size = importance level. Edge thickness = trace importance.</span>
    </div>
  );
}

function DecisionChainsPanel({ insights }: { insights: KnowledgeGraphInsights | null }) {
  const chains = insights?.decisionChains.slice(0, 3) ?? [];

  return (
    <details className="rounded-md border border-white/10 bg-black/20 p-4" open={Boolean(chains.length)}>
      <summary className="cursor-pointer text-sm font-semibold text-white">Decision Chains</summary>
      <div className="mt-4 grid gap-3">
        {chains.length ? chains.map((chain) => (
          <article key={chain.decisionNodeId} className="rounded border border-white/10 bg-white/[0.03] p-3">
            <p className="text-sm font-semibold text-cyan-100" title={chain.decisionLabel}>{chain.decisionLabel}</p>
            <div className="mt-3 grid gap-2 text-sm text-slate-300">
              <ChainRow label="Command / Result" nodes={[...chain.relatedCommands, ...chain.relatedReviews]} />
              <ChainRow label="Architect Review" nodes={chain.relatedArchitectReviews} />
              <ChainRow label="Decision" nodes={[{ id: chain.decisionNodeId, label: chain.decisionLabel, type: "decision", importanceLevel: "high" }]} />
              <ChainRow label="Daily / Nightly Report" nodes={chain.relatedReports} />
              <ChainRow label="Incident" nodes={chain.relatedIncidents} />
            </div>
          </article>
        )) : (
          <EmptyState
            title="아직 Decision Chain이 완성되지 않았습니다."
            detail="Command, Review, Decision, Report가 연결되면 추적 경로가 표시됩니다."
            muted
          />
        )}
      </div>
    </details>
  );
}

function ChainRow({ label, nodes }: { label: string; nodes: Array<{ id: string; label: string; type: string; importanceLevel: ImportanceLevel }> }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
      <span className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <div className="flex flex-wrap gap-2">
        {nodes.length ? nodes.slice(0, 3).map((node) => (
          <StatusBadge key={node.id} className={getImportanceBadgeStyle(node.importanceLevel)}>
            {node.type}: {truncateGraphLabel(node.label, 26)}
          </StatusBadge>
        )) : <span className="text-xs text-slate-500">missing</span>}
      </div>
    </div>
  );
}

function KnowledgeGraphSvg({
  graph,
  selectedNodeId,
  onSelectNode,
}: {
  graph: Pick<KnowledgeGraph, "nodes" | "edges">;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}) {
  const width = 920;
  const height = 560;
  const positions = useMemo(() => layoutGraphNodes(graph.nodes, width, height), [graph.nodes]);

  return (
    <svg className="min-w-[56rem] max-w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Knowledge Graph visualization">
      <defs>
        <marker id="kg-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="8" refY="4">
          <path d="M0,0 L8,4 L0,8 Z" fill="rgba(148,163,184,0.75)" />
        </marker>
      </defs>
      <rect width={width} height={height} rx="10" fill="rgba(2,6,23,0.55)" />
      {graph.edges.map((edge) => {
        const from = positions.get(edge.from);
        const to = positions.get(edge.to);
        if (!from || !to) return null;
        return (
          <line
            key={edge.id}
            markerEnd="url(#kg-arrow)"
            stroke={getKnowledgeEdgeColor(edge)}
            strokeOpacity={edge.importanceLevel === "low" ? 0.35 : 0.72}
            strokeWidth={getKnowledgeEdgeWidth(edge)}
            x1={from.x}
            x2={to.x}
            y1={from.y}
            y2={to.y}
          >
            <title>{edge.type}: {edge.label} / importance {edge.importanceScore}</title>
          </line>
        );
      })}
      {graph.nodes.map((node) => {
        const position = positions.get(node.id);
        if (!position) return null;
        const selected = node.id === selectedNodeId;
        const radius = getKnowledgeNodeRadius(node, selected);
        return (
          <g key={node.id} className="cursor-pointer" onClick={() => onSelectNode(node.id)} role="button" tabIndex={0}>
            {node.importanceLevel === "critical" || node.isRecent ? (
              <circle cx={position.x} cy={position.y} fill={getKnowledgeNodeColor(node.type)} opacity={node.importanceLevel === "critical" ? 0.16 : 0.1} r={radius + 10} />
            ) : null}
            <circle
              cx={position.x}
              cy={position.y}
              fill={getKnowledgeNodeColor(node.type)}
              opacity={selected ? 1 : 0.86}
              r={radius}
              stroke={selected ? "white" : getKnowledgeNodeStroke(node)}
              strokeWidth={selected ? 3.5 : getKnowledgeNodeStrokeWidth(node)}
            />
            <text fill="white" fontSize="11" fontWeight="700" textAnchor="middle" x={position.x} y={position.y - radius - 11}>{node.type}</text>
            <text fill="rgba(226,232,240,0.92)" fontSize="12" textAnchor="middle" x={position.x} y={position.y + radius + 18}>{truncateGraphLabel(node.label, 18)}</text>
            <title>{node.title} / {node.importanceLevel} / score {node.importanceScore}</title>
          </g>
        );
      })}
    </svg>
  );
}

function KnowledgeGraphNodeDetail({ node, edges, nodes }: { node: KnowledgeGraphNode | null; edges: KnowledgeGraphEdge[]; nodes: KnowledgeGraphNode[] }) {
  if (!node) return <EmptyState title="No selected node" detail="Select a node to inspect graph context." muted />;

  return (
    <aside className="rounded-md border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge className="bg-cyan-500/15 text-cyan-200 ring-cyan-400/25">{node.type}</StatusBadge>
        <StatusBadge className={getImportanceBadgeStyle(node.importanceLevel)}>{node.importanceLevel} {node.importanceScore}</StatusBadge>
        {node.isRecent ? <StatusBadge className="bg-emerald-500/15 text-emerald-200 ring-emerald-400/25">recent</StatusBadge> : null}
        {node.isHub ? <StatusBadge className="bg-violet-500/15 text-violet-200 ring-violet-400/25">hub</StatusBadge> : null}
        <span className="rounded bg-white/[0.04] px-2 py-1 text-xs text-slate-400">{node.source ?? "unknown"}</span>
      </div>
      <h3 className="mt-3 text-base font-semibold text-white" title={node.title}>{node.title}</h3>
      <p className="mt-2 text-xs text-slate-500" title={formatExactDate(node.createdAt)}>{formatRelativeTime(node.createdAt)}</p>
      {node.externalRef ? <CompactValue value={node.externalRef} className="mt-3 text-xs text-slate-500" copyable /> : null}
      <p className="mt-3 max-h-32 overflow-y-auto text-sm leading-6 text-slate-300">{node.summary ?? "No summary."}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <RuntimeMetric label="Degree" value={String(node.degree)} />
        <RuntimeMetric label="In / Out" value={`${node.inDegree} / ${node.outDegree}`} />
        <RuntimeMetric label="Last referenced" value={node.lastReferencedAt ? formatRelativeTime(node.lastReferencedAt) : "none"} />
      </div>
      <p className="mt-3 rounded border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-slate-300">
        {getGraphNodeImportanceReason(node, edges, nodes)}
      </p>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Related edges</p>
        <div className="mt-2 grid gap-2">
          {edges.length ? edges.slice(0, 8).map((edge) => {
            const otherId = edge.from === node.id ? edge.to : edge.from;
            const other = nodes.find((item) => item.id === otherId);
            return (
              <div key={edge.id} className="rounded border border-white/10 bg-white/[0.03] p-2 text-xs">
                <StatusBadge className="bg-violet-500/15 text-violet-200 ring-violet-400/25">{edge.type}</StatusBadge>
                <p className="mt-2 truncate text-slate-300" title={other?.title ?? otherId}>{other?.label ?? otherId}</p>
                <p className="mt-1 truncate text-slate-500" title={readEdgeReason(edge)}>{readEdgeReason(edge)}</p>
              </div>
            );
          }) : <p className="text-sm text-slate-500">No related edges in current filters.</p>}
        </div>
      </div>
    </aside>
  );
}

function KnowledgeGraphEdgeList({ edges, nodes }: { edges: KnowledgeGraphEdge[]; nodes: KnowledgeGraphNode[] }) {
  if (!edges.length) return <EmptyState title="No visible edges" detail="Adjust filters or run batches that create knowledge relationships." muted />;

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  return (
    <div className="overflow-x-auto rounded-md border border-white/10 bg-black/20">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
          <tr>
            <th className="px-3 py-2">From</th>
            <th className="px-3 py-2">Edge</th>
            <th className="px-3 py-2">To</th>
            <th className="px-3 py-2">Importance</th>
            <th className="px-3 py-2">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {edges.slice(0, 20).map((edge) => (
            <tr key={edge.id}>
              <td className="max-w-[14rem] truncate px-3 py-2 text-slate-300" title={nodeMap.get(edge.from)?.title ?? edge.from}>{nodeMap.get(edge.from)?.label ?? edge.from}</td>
              <td className="px-3 py-2"><StatusBadge className="bg-violet-500/15 text-violet-200 ring-violet-400/25">{edge.type}</StatusBadge></td>
              <td className="max-w-[14rem] truncate px-3 py-2 text-slate-300" title={nodeMap.get(edge.to)?.title ?? edge.to}>{nodeMap.get(edge.to)?.label ?? edge.to}</td>
              <td className="px-3 py-2"><StatusBadge className={getImportanceBadgeStyle(edge.importanceLevel)}>{edge.importanceLevel} {edge.importanceScore}</StatusBadge></td>
              <td className="max-w-[16rem] truncate px-3 py-2 text-slate-500" title={readEdgeReason(edge)}>{readEdgeReason(edge)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KnowledgeSearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgeNode[]>([]);
  const [related, setRelated] = useState<RelatedKnowledgeGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function search() {
    const clean = query.trim();
    if (!clean) {
      setResults([]);
      setRelated([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nodes = await searchKnowledgeNodes(clean, 12);
      setResults(nodes);
      if (nodes[0]?.external_ref) {
        setRelated(await getRelatedKnowledge({ external_ref: nodes[0].external_ref }));
      } else {
        setRelated([]);
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Knowledge search failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel title="Related Context">
      <div className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="min-h-11 flex-1 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") search();
            }}
            placeholder="Search task filename, result filename, review filename, note path, or keyword"
            value={query}
          />
          <button
            className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
            onClick={search}
            type="button"
          >
            {loading ? "Searching" : "Search"}
          </button>
        </div>
        {error ? (
          <EmptyState
            title="Related context needs backend sync"
            detail="Related Knowledge endpoint is missing, stale, or unreachable. Check Endpoint Health Matrix."
          />
        ) : null}
        <KnowledgeNodeList nodes={results} />
        {related.length ? (
          <div className="grid gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Related groups</p>
            {related.map((group) => (
              <div key={group.node.id} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                <p className="text-sm font-semibold text-white">{group.node.title}</p>
                <KnowledgeEdgeTable edges={group.related} />
              </div>
            ))}
          </div>
        ) : results.length ? (
          <p className="text-sm text-slate-500">No related memory yet.</p>
        ) : null}
      </div>
    </Panel>
  );
}

function KnowledgeEdgeTable({ edges }: { edges: Array<KnowledgeOverview["latestEdges"][number]> }) {
  if (!edges.length) {
    return <EmptyState title="No graph relationships yet" detail="Edges will appear after report/export batches create conservative links." muted />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[42rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
          <tr>
            <th className="px-3 py-2">From</th>
            <th className="px-3 py-2">Edge</th>
            <th className="px-3 py-2">To</th>
            <th className="px-3 py-2">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {edges.map((edge) => (
            <tr key={edge.id}>
              <td className="max-w-[14rem] truncate px-3 py-2 text-slate-300" title={edge.from_node?.title ?? edge.from_node_id}>
                {edge.from_node?.title ?? edge.from_node_id}
              </td>
              <td className="px-3 py-2">
                <StatusBadge className="bg-violet-500/15 text-violet-200 ring-violet-400/25">{edge.edge_type}</StatusBadge>
              </td>
              <td className="max-w-[14rem] truncate px-3 py-2 text-slate-300" title={edge.to_node?.title ?? edge.to_node_id}>
                {edge.to_node?.title ?? edge.to_node_id}
              </td>
              <td className="max-w-[16rem] truncate px-3 py-2 text-slate-500" title={readEdgeReason(edge)}>
                {readEdgeReason(edge)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RelatedKnowledgeMini({ externalRef }: { externalRef: string | null }) {
  const [groups, setGroups] = useState<RelatedKnowledgeGroup[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!externalRef) {
        setGroups([]);
        setLoaded(true);
        return;
      }

      try {
        const relatedGroups = await getRelatedKnowledge({ external_ref: externalRef });
        if (!cancelled) {
          setGroups(relatedGroups);
        }
      } catch {
        if (!cancelled) {
          setGroups([]);
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    }

    setLoaded(false);
    load();

    return () => {
      cancelled = true;
    };
  }, [externalRef]);

  const relatedItems = groups.flatMap((group) =>
    group.related.map((edge) => ({
      edge,
      node: edge.from_node?.id === group.node.id ? edge.to_node : edge.from_node,
    })),
  ).slice(0, 3);

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Related Knowledge</p>
      {!externalRef ? (
        <p className="mt-2 text-sm text-slate-500">No related memory yet</p>
      ) : !loaded ? (
        <p className="mt-2 text-sm text-slate-500">Loading related memory...</p>
      ) : relatedItems.length ? (
        <div className="mt-3 grid gap-2">
          {relatedItems.map((item) => (
            <div key={item.edge.id} className="flex min-w-0 items-center gap-2 text-sm">
              <StatusBadge className="bg-violet-500/15 text-violet-200 ring-violet-400/25">{item.edge.edge_type}</StatusBadge>
              <span className="min-w-0 truncate text-slate-300" title={item.node?.title ?? "Unknown node"}>
                {item.node?.title ?? "Unknown node"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No related memory yet</p>
      )}
    </div>
  );
}

function RelatedArchitectReviewMini({
  review,
  targetRef,
}: {
  review: ArchitectureReview | null;
  targetRef: string | null;
}) {
  const directlyRelated = review && targetRef ? review.target_ref === targetRef : false;

  if (!review) {
    return (
      <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Related Architect Review</p>
        <p className="mt-2 text-sm text-slate-500">No architecture review yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Related Architect Review</p>
        <StatusBadge className={getArchitectStatusStyle(review.status)}>{review.status}</StatusBadge>
      </div>
      <p className="mt-2 text-sm text-slate-300">
        {directlyRelated ? "This runtime target has an architecture review." : "Latest architecture review shown for context."}
      </p>
      <CompactValue value={review.target_ref} className="mt-2 text-xs text-slate-500" copyable />
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400" title={review.summary ?? ""}>
        {review.summary ?? "No review summary."}
      </p>
    </div>
  );
}

function ArchitectStatusCard({
  review,
  error,
}: {
  review: ArchitectureReview | null;
  error: string | null;
}) {
  if (error) {
    return (
      <EmptyState
        title="Architect status needs backend sync"
        detail="Architect endpoints are missing, stale, or unreachable. Check Settings > Endpoint Health Matrix."
      />
    );
  }

  if (!review) {
    return (
      <div className="grid gap-3">
        <SourceLabel label="backend-derived, rule-based, non-executing planning role" />
        <EmptyState
          title="Architect available, no review yet"
          detail="Run a manual architecture review from the backend to record design/scope/security findings."
          muted
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <SourceLabel label="backend-derived + knowledge graph linked. Read-only visibility." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <RuntimeMetric label="State" value={getArchitectStatusLabel(review)} />
        <RuntimeMetric label="Findings" value={String(review.findings.length)} />
        <RuntimeMetric label="Recommendations" value={String(review.recommendations.length)} />
        <RuntimeMetric label="Target" value={review.target_type} />
        <RuntimeMetric label="Last reviewed" value={formatRelativeTime(review.created_at)} />
      </div>
      <div className="rounded-md border border-white/10 bg-black/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Latest architecture review</p>
            <CompactValue value={review.target_ref} className="mt-2 text-xs text-slate-500" copyable />
          </div>
          <StatusBadge className={getArchitectStatusStyle(review.status)}>{review.status}</StatusBadge>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-300">{review.summary ?? "No summary."}</p>
        {review.findings.length ? (
          <div className="mt-4 grid gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Findings</p>
            {review.findings.slice(0, 4).map((finding, index) => (
              <div key={`${finding.rule ?? finding.ruleId ?? "finding"}-${index}`} className="rounded border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge className={getArchitectStatusStyle(finding.severity === "blocked" ? "blocked" : finding.severity === "warning" ? "warning" : "reviewed")}>
                    {finding.severity ?? "info"}
                  </StatusBadge>
                  <p className="text-sm font-medium text-white">{finding.title ?? finding.rule ?? finding.ruleId ?? "Finding"}</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{finding.detail ?? finding.message ?? "No detail."}</p>
                {finding.evidence ? <p className="mt-2 text-[0.68rem] text-slate-600">Evidence: {finding.evidence}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ArchitectureReviewList({ reviews }: { reviews: ArchitectureReview[] }) {
  if (!reviews.length) {
    return <EmptyState title="No architecture reviews yet" detail="Architect review nodes will appear after the backend demo or manual review endpoint records one." muted />;
  }

  return (
    <div className="grid gap-3">
      {reviews.map((review) => (
        <article key={review.id} className="rounded-md border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge className={getArchitectStatusStyle(review.status)}>{review.status}</StatusBadge>
              <span className="rounded bg-black/20 px-2 py-1 text-xs text-slate-400">{review.target_type}</span>
              <span className="text-xs text-slate-500" title={formatExactDate(review.created_at)}>{formatRelativeTime(review.created_at)}</span>
            </div>
            <span className="text-xs text-slate-500">{review.findings.length} findings</span>
          </div>
          <CompactValue value={review.target_ref} className="mt-3 text-xs text-slate-500" copyable />
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300" title={review.summary ?? ""}>
            {review.summary ?? "No summary."}
          </p>
        </article>
      ))}
    </div>
  );
}

function MeshSummaryCard({ meshOverview, error }: { meshOverview: MeshOverview | null; error: string | null }) {
  if (error) {
    return (
      <EmptyState
        title="No mesh data available yet"
        detail="Agent Mesh data will appear after the backend mesh endpoint is available and runtime/knowledge sources respond."
        muted
      />
    );
  }

  if (!meshOverview) {
    return <EmptyState title="Mesh summary loading" detail="Reading derived agent relationships from the backend." muted />;
  }

  const activeAgents = meshOverview.agents.filter((agent) =>
    ["working", "detected", "enabled", "clear"].includes(agent.status),
  ).length;
  const warningCount = meshOverview.agents.filter((agent) =>
    ["warning", "blocked", "no_review"].includes(agent.status),
  ).length;
  const latestInteraction = meshOverview.recentInteractions[0]?.time ?? null;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <RuntimeMetric label="Mesh health" value={meshOverview.health.status} />
      <RuntimeMetric label="Agents active" value={String(activeAgents)} />
      <RuntimeMetric label="Warnings" value={String(warningCount)} />
      <RuntimeMetric label="Latest interaction" value={latestInteraction ? formatRelativeTime(latestInteraction) : "none"} />
      <RuntimeMetric
        label="Architect / Historian"
        value={`${findMeshAgent(meshOverview, "architect")?.status ?? "unknown"} / ${findMeshAgent(meshOverview, "historian")?.status ?? "unknown"}`}
      />
    </div>
  );
}

function KpiSummaryCard({ kpiOverview, error }: { kpiOverview: KpiOverview | null; error: string | null }) {
  if (error) {
    return (
      <EmptyState
        title="Insufficient historical data"
        detail="KPI metrics will appear after the backend KPI endpoint is available and operational history exists."
        muted
      />
    );
  }

  if (!kpiOverview) {
    return <EmptyState title="KPI summary loading" detail="Computing read-only operational metrics." muted />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <RuntimeMetric label="7d approval rate" value={formatKpiPercent(kpiOverview.quality.approvalRate)} />
      <RuntimeMetric label="Knowledge nodes" value={formatKpiValue(kpiOverview.knowledge.nodesCreatedInRange)} />
      <RuntimeMetric label="Warnings" value={formatKpiValue(kpiOverview.runtime.warningCount)} />
      <RuntimeMetric label="Runtime status" value={kpiOverview.runtime.latestStatus} />
    </div>
  );
}

function KnowledgeGraphSummaryCard({ knowledgeOverview }: { knowledgeOverview: KnowledgeOverview | null }) {
  const latestNodeType = knowledgeOverview?.latestNodes[0]?.node_type ?? "none";
  const latestEdgeType = knowledgeOverview?.latestEdges[0]?.edge_type ?? "none";

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <RuntimeMetric label="Nodes" value={String(knowledgeOverview?.totalNodes ?? 0)} />
      <RuntimeMetric label="Edges" value={String(knowledgeOverview?.totalEdges ?? 0)} />
      <RuntimeMetric label="Latest node type" value={latestNodeType} />
      <RuntimeMetric label="Latest edge type" value={latestEdgeType} />
    </div>
  );
}

function ArchitectSummaryCard({ review }: { review: ArchitectureReview | null }) {
  if (!review) {
    return (
      <EmptyState
        title="Architect review not recorded yet"
        detail="Run the rule-based Architect review demo or record a review to populate this PM guardrail summary."
        muted
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <RuntimeMetric label="Architect status" value={review.status} />
      <RuntimeMetric label="Findings" value={String(review.findings.length)} />
      <RuntimeMetric label="Recommendations" value={String(review.recommendations.length)} />
      <div className="md:col-span-3">
        <p className="line-clamp-2 text-sm leading-6 text-slate-300" title={review.summary ?? ""}>
          {review.summary ?? "No architecture summary."}
        </p>
      </div>
    </div>
  );
}

function PortfolioSnapshotCard({
  readiness,
  endpointHealth,
  knowledgeOverview,
  kpiOverview,
  meshOverview,
  latestDailyReport,
  publicAccessStatus,
}: {
  readiness: PlatformReadiness | null;
  endpointHealth: EndpointHealth | null;
  knowledgeOverview: KnowledgeOverview | null;
  kpiOverview: KpiOverview | null;
  meshOverview: MeshOverview | null;
  latestDailyReport: DailyReport | null;
  publicAccessStatus: PublicAccessStatus | null;
}) {
  const implementedModules = [
    "Runtime",
    "Decisions",
    "Operators",
    "Timeline",
    "Knowledge",
    "Mesh",
    "KPI",
    "Batches",
    "Historian",
    "Architect",
  ];
  const enabledModules = [
    Boolean(endpointHealth),
    Boolean(knowledgeOverview),
    Boolean(meshOverview),
    Boolean(kpiOverview),
    Boolean(latestDailyReport),
    Boolean(publicAccessStatus),
  ].filter(Boolean).length;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <RuntimeMetric label="Implemented modules" value={String(implementedModules.length)} />
      <RuntimeMetric label="Enabled signals" value={`${enabledModules}/6`} />
      <RuntimeMetric label="Endpoint health" value={endpointHealth ? `${endpointHealth.summary.ok}/${endpointHealth.summary.total}` : "unknown"} />
      <RuntimeMetric label="Readiness" value={readiness ? `${readiness.score} ${readiness.grade}` : "unknown"} />
      <RuntimeMetric label="Knowledge graph" value={`${knowledgeOverview?.totalNodes ?? 0} nodes / ${knowledgeOverview?.totalEdges ?? 0} edges`} />
      <RuntimeMetric label="KPI available" value={kpiOverview ? "yes" : "no"} />
      <RuntimeMetric label="Daily report" value={latestDailyReport?.status ?? "none"} />
      <RuntimeMetric label="Mesh health" value={meshOverview?.health.status ?? "unknown"} />
    </div>
  );
}

function KpiView({
  kpiOverview,
  range,
  error,
  onRangeChange,
}: {
  kpiOverview: KpiOverview | null;
  range: KpiRange;
  error: string | null;
  onRangeChange: (range: KpiRange) => void;
}) {
  if (error) {
    return (
      <Panel title="KPI Dashboard">
        <EmptyState
          title="KPI data needs backend sync"
          detail="KPI endpoint is missing, stale, or unreachable. Check Settings > Endpoint Health Matrix."
        />
      </Panel>
    );
  }

  if (!kpiOverview) {
    return (
      <Panel title="KPI Dashboard">
        <EmptyState title="Loading KPI" detail="Computing read-only analytics from existing ArchiveOS records." muted />
      </Panel>
    );
  }

  return (
    <div className="grid gap-5">
      <Panel title="KPI Header">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <SourceLabel label="read-only analytics from Supabase history + current runtime status" />
            <p className="mt-3 text-sm text-slate-400">
              Generated {formatRelativeTime(kpiOverview.generatedAt)} / {formatExactDate(kpiOverview.generatedAt)}
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              {getKpiInterpretation(kpiOverview)}
            </p>
          </div>
          <div className="inline-flex rounded-md border border-white/10 bg-black/20 p-1">
            {(["today", "7d", "30d"] as KpiRange[]).map((item) => (
              <button
                key={item}
                className={`rounded px-3 py-2 text-sm font-medium transition ${
                  range === item ? "bg-cyan-300 text-slate-950" : "text-slate-300 hover:bg-white/10"
                }`}
                onClick={() => onRangeChange(item)}
                type="button"
              >
                {item === "today" ? "Today" : item === "7d" ? "7 days" : "30 days"}
              </button>
            ))}
          </div>
        </div>
        {kpiOverview.notes.length ? (
          <div className="mt-4 rounded-md border border-amber-400/30 bg-amber-500/10 p-3">
            <p className="text-sm font-semibold text-amber-100">Data quality notes</p>
            <ul className="mt-2 grid gap-1 text-sm leading-6 text-amber-100/85">
              {kpiOverview.notes.map((note) => <li key={note}>- {note}</li>)}
            </ul>
          </div>
        ) : null}
      </Panel>

      <KpiMetricSection
        title="Productivity"
        metrics={[
          ["Tasks completed", kpiOverview.productivity.tasksCompleted],
          ["Reviews completed", kpiOverview.productivity.reviewsCompleted],
          ["Decisions recorded", kpiOverview.productivity.decisionsRecorded],
          ["Commands recorded", kpiOverview.productivity.commandsRecorded],
          ["Daily reports sent", kpiOverview.productivity.dailyReportsSent],
          ["Nightly reviews completed", kpiOverview.productivity.nightlyReviewsCompleted],
        ]}
      />

      <KpiMetricSection
        title="Quality"
        metrics={[
          ["Approval rate", formatKpiPercent(kpiOverview.quality.approvalRate)],
          ["Approve count", kpiOverview.quality.reviewApproveCount],
          ["Reject count", kpiOverview.quality.reviewRejectCount],
          ["Stop count", kpiOverview.quality.reviewStopCount],
          ["Architect warnings", kpiOverview.quality.architectWarningCount],
          ["Architect blocked", kpiOverview.quality.architectBlockedCount],
        ]}
      />

      <KpiMetricSection
        title="Runtime Health"
        metrics={[
          ["Latest queue", `${formatKpiValue(kpiOverview.runtime.latestInbox)} / ${formatKpiValue(kpiOverview.runtime.latestProcessing)} / ${formatKpiValue(kpiOverview.runtime.latestOutbox)} / ${formatKpiValue(kpiOverview.runtime.latestReviews)}`],
          ["Latest status", kpiOverview.runtime.latestStatus],
          ["Warning count", kpiOverview.runtime.warningCount],
          ["Loop detected rate", formatKpiPercent(kpiOverview.runtime.loopDetectedRate)],
          ["Current processing", kpiOverview.runtime.latestProcessing],
        ]}
      />

      <KpiMetricSection
        title="Knowledge Growth"
        metrics={[
          ["Total nodes", kpiOverview.knowledge.totalNodes],
          ["Total edges", kpiOverview.knowledge.totalEdges],
          ["Nodes in range", kpiOverview.knowledge.nodesCreatedInRange],
          ["Edges in range", kpiOverview.knowledge.edgesCreatedInRange],
          ["Obsidian exports", kpiOverview.knowledge.obsidianExports],
          ["Graph density", kpiOverview.knowledge.graphDensity],
        ]}
      />

      <Panel title="Trends">
        <div className="grid gap-4 xl:grid-cols-2">
          <TrendMiniBars title="Daily reports" points={kpiOverview.trends.dailyReports} />
          <TrendMiniBars title="Decisions" points={kpiOverview.trends.decisions} />
          <TrendMiniBars title="Knowledge nodes" points={kpiOverview.trends.knowledgeNodes} />
          <TrendMiniBars title="Warnings" points={kpiOverview.trends.warnings} />
        </div>
      </Panel>
    </div>
  );
}

function KpiMetricSection({
  title,
  metrics,
}: {
  title: string;
  metrics: Array<[string, string | number | null]>;
}) {
  return (
    <Panel title={title}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {metrics.map(([label, value]) => (
          <RuntimeMetric key={label} label={label} value={formatKpiMetric(value)} />
        ))}
      </div>
    </Panel>
  );
}

function TrendMiniBars({ title, points }: { title: string; points: KpiOverview["trends"]["dailyReports"] }) {
  const max = Math.max(1, ...points.map((point) => point.count));

  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{title}</p>
        <span className="text-xs text-slate-500">{points.length ? `${points.length} days` : "insufficient data"}</span>
      </div>
      <div className="mt-4 grid gap-2">
        {points.length ? points.map((point) => (
          <div key={`${title}-${point.date}`} className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-2 text-xs">
            <span className="text-slate-500">{point.date}</span>
            <div className="h-2 rounded-full bg-white/[0.06]">
              <div
                className="h-2 rounded-full bg-cyan-300"
                style={{ width: `${Math.max(6, (point.count / max) * 100)}%` }}
              />
            </div>
            <span className="text-right text-slate-300">{point.count}</span>
          </div>
        )) : (
          <p className="text-sm text-slate-500">No trend data in this range.</p>
        )}
      </div>
    </div>
  );
}

function MeshView({
  meshOverview,
  error,
  knowledgeOverview,
}: {
  meshOverview: MeshOverview | null;
  error: string | null;
  knowledgeOverview: KnowledgeOverview | null;
}) {
  if (error) {
    return (
      <Panel title="Agent Mesh">
        <EmptyState
          title="Agent Mesh needs backend sync"
          detail="Mesh endpoint is missing, stale, or unreachable. Check Settings > Endpoint Health Matrix."
        />
      </Panel>
    );
  }

  if (!meshOverview) {
    return (
      <Panel title="Agent Mesh">
        <EmptyState title="Loading mesh" detail="Reading runtime, Architect, Historian, and Knowledge Graph state." muted />
      </Panel>
    );
  }

  const activeAgents = meshOverview.agents.filter((agent) =>
    ["working", "detected", "enabled", "clear"].includes(agent.status),
  ).length;
  const warningCount = meshOverview.agents.filter((agent) =>
    ["warning", "blocked", "no_review"].includes(agent.status),
  ).length;
  const latestInteraction = meshOverview.recentInteractions[0]?.time ?? null;

  return (
    <div className="grid gap-5">
      <Panel title="Mesh Health">
        <SourceLabel label="read-only derived view from runtime, Architect, Historian, and Knowledge Graph" />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <RuntimeMetric label="Overall status" value={meshOverview.health.status} />
          <RuntimeMetric label="Active agents" value={String(activeAgents)} />
          <RuntimeMetric label="Warnings" value={String(warningCount)} />
          <RuntimeMetric label="Latest interaction" value={latestInteraction ? formatRelativeTime(latestInteraction) : "none"} />
        </div>
        <p className="mt-4 rounded-md border border-white/10 bg-black/20 p-3 text-sm leading-6 text-slate-300">
          {meshOverview.health.summary}
        </p>
      </Panel>

      <Panel title="Agent Mesh Map">
        <AgentMeshMap agents={meshOverview.agents} links={meshOverview.links} />
      </Panel>

      <Panel title="Recent Interactions">
        <MeshInteractionList interactions={meshOverview.recentInteractions.slice(0, 5)} />
      </Panel>

      <details className="rounded-md border border-white/10 bg-[#0d1117] p-4 sm:p-5">
        <summary className="cursor-pointer text-lg font-semibold text-white">Relationship List</summary>
        <div className="mt-4">
          <MeshRelationshipList links={meshOverview.links} />
        </div>
      </details>

      <details className="rounded-md border border-white/10 bg-[#0d1117] p-4 sm:p-5">
        <summary className="cursor-pointer text-lg font-semibold text-white">Related Knowledge</summary>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          Latest Knowledge Graph edges involving builder, reviewer, Architect, Historian, reports, and Obsidian notes.
        </p>
        <div className="mt-4">
          <KnowledgeEdgeTable edges={knowledgeOverview?.latestEdges ?? []} />
        </div>
      </details>
    </div>
  );
}

function AgentMeshMap({ agents, links }: { agents: MeshAgent[]; links: MeshLink[] }) {
  const pmAgent: MeshAgent = {
    id: "human_pm",
    label: "Human PM",
    role: "Approval, direction, and priority judgement",
    status: "detected",
    source: "static",
    summary: "Human operator remains the control point. Mesh is visibility-only.",
    metadata: {},
  };
  const byId = new Map([...agents, pmAgent].map((agent) => [agent.id, agent]));
  const slots = [
    ["", "architect", ""],
    ["historian", "human_pm", "reviewer"],
    ["", "implementer", ""],
    ["", "loop", ""],
    ["", "bridge", ""],
  ];

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-3">
        {slots.flat().map((id, index) => (
          id ? (
            <MeshNode key={id} agent={byId.get(id) ?? pmAgent} active={links.some((link) => link.recent && (link.from === id || link.to === id))} />
          ) : (
            <div key={`empty-${index}`} className="hidden md:block" />
          )
        ))}
      </div>
      <div className="rounded-md border border-white/10 bg-black/20 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Active / recent links</p>
        <div className="mt-3 grid gap-2">
          {links.filter((link) => link.recent).slice(0, 6).map((link) => (
            <div key={`${link.from}-${link.to}-${link.type}`} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-cyan-200">{byId.get(link.from)?.label ?? link.from}</span>
              <span className="h-px min-w-10 flex-1 bg-gradient-to-r from-cyan-300/70 to-emerald-300/40" />
              <StatusBadge className="bg-cyan-500/15 text-cyan-200 ring-cyan-400/25">{link.type}</StatusBadge>
              <span className="text-emerald-200">{byId.get(link.to)?.label ?? link.to}</span>
            </div>
          ))}
          {!links.some((link) => link.recent) ? (
            <p className="text-sm text-slate-500">No recent mesh link activity.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MeshNode({ agent, active }: { agent: MeshAgent; active: boolean }) {
  return (
    <article className={`min-h-40 rounded-md border p-4 ${active ? "border-cyan-300/35 bg-cyan-300/[0.05]" : "border-white/10 bg-black/20"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{agent.source}</p>
          <h3 className="mt-2 truncate text-base font-semibold text-white" title={agent.label}>{agent.label}</h3>
        </div>
        <span
          className={`mt-1 h-3 w-3 rounded-full ${active ? "animate-pulse bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.75)]" : "bg-slate-600"}`}
          title={active ? `${agent.label} has recent mesh activity` : `${agent.label} has no recent mesh activity`}
        />
      </div>
      <StatusBadge className={`${getMeshStatusStyle(agent.status)} mt-3`}>{agent.status}</StatusBadge>
      <p className="mt-3 text-sm leading-6 text-slate-300">{agent.role}</p>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500" title={agent.summary}>{agent.summary}</p>
    </article>
  );
}

function MeshRelationshipList({ links }: { links: MeshLink[] }) {
  if (!links.length) {
    return <EmptyState title="No mesh relationships" detail="No runtime or Knowledge Graph relationship was derived yet." muted />;
  }

  return (
    <div className="grid gap-2">
      {links.map((link) => (
        <article key={`${link.from}-${link.to}-${link.type}-${link.source}`} className="rounded-md border border-white/10 bg-black/20 p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_auto] md:items-center">
            <CompactValue value={link.from} className="text-sm font-medium text-cyan-100" />
            <StatusBadge className="bg-violet-500/15 text-violet-200 ring-violet-400/25">{link.type}</StatusBadge>
            <CompactValue value={link.to} className="text-sm font-medium text-emerald-100" />
            <StatusBadge className={link.recent ? commandStatusStyles.running : commandStatusStyles.pending}>
              {link.recent ? "recent" : "not recent"}
            </StatusBadge>
            <span className="rounded bg-white/[0.04] px-2 py-1 text-xs text-slate-400">{link.source}</span>
          </div>
          <p className="mt-2 text-xs text-slate-500" title={link.label}>{link.label}</p>
        </article>
      ))}
    </div>
  );
}

function MeshInteractionList({ interactions }: { interactions: MeshOverview["recentInteractions"] }) {
  if (!interactions.length) {
    return <EmptyState title="No recent mesh interactions" detail="Interactions appear after runtime or Knowledge Graph relationships are derived." muted />;
  }

  return (
    <div className="grid gap-3">
      {interactions.map((interaction, index) => (
        <article key={`${interaction.time}-${interaction.from}-${interaction.to}-${index}`} className="rounded-md border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500" title={formatExactDate(interaction.time)}>{formatRelativeTime(interaction.time)}</span>
            <StatusBadge className="bg-cyan-500/15 text-cyan-200 ring-cyan-400/25">{interaction.source}</StatusBadge>
            <StatusBadge className="bg-violet-500/15 text-violet-200 ring-violet-400/25">{interaction.type}</StatusBadge>
          </div>
          <p className="mt-3 text-sm font-medium text-white">
            {interaction.from} <span className="text-slate-500">{"->"}</span> {interaction.to}
          </p>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400" title={interaction.summary}>{interaction.summary}</p>
        </article>
      ))}
    </div>
  );
}

function GitHubIntegrationCard({
  runtimeStatus,
  runtimeVersion,
}: {
  runtimeStatus: LocalRuntimeStatus | null;
  runtimeVersion: RuntimeVersion | null;
}) {
  return (
    <article className="rounded-md border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">GitHub</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Read-only integration placeholder. No GitHub API write actions are enabled.</p>
        </div>
        <StatusBadge className="bg-slate-500/15 text-slate-200 ring-slate-400/20">not_configured</StatusBadge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <RuntimeMetric label="Repository" value="CSJ-PJT/ArchiveOS" copyable />
        <RuntimeMetric label="Branch" value={runtimeVersion?.branch ?? "main"} />
        <RuntimeMetric label="Latest commit" value={runtimeVersion?.commitSha ?? "not connected"} copyable={Boolean(runtimeVersion?.commitSha)} />
        <RuntimeMetric label="Recent PR count" value="not connected" />
        <RuntimeMetric label="CI status" value="not connected" />
      </div>
      <p className="mt-3 rounded border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-slate-500">
        Runtime source remains local MCP/backend. Latest MCP result: {runtimeStatus?.latest.outbox?.name ?? "none"}.
      </p>
    </article>
  );
}

function IntegrationCard({
  title,
  status,
  detail,
}: {
  title: string;
  status: "configured" | "not_configured" | "unknown";
  detail: string;
}) {
  return (
    <article className="rounded-md border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{title}</p>
        <StatusBadge className={getIntegrationStatusStyle(status)}>{status}</StatusBadge>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

function SettingsView({
  backendReachability,
  commandRunsReachability,
  runtimeStatus,
  batchStatus,
  latestDailyReport,
  historianStatus,
  historianError,
  batchStatusError,
  endpointHealth,
  platformReadiness,
  publicAccessStatus,
  platformHealthError,
  runtimeVersion,
}: {
  backendReachability: ConsistencyStatus;
  commandRunsReachability: ConsistencyStatus;
  runtimeStatus: LocalRuntimeStatus | null;
  batchStatus: LatestBatchStatus | null;
  latestDailyReport: DailyReport | null;
  historianStatus: HistorianStatus | null;
  historianError: string | null;
  batchStatusError: string | null;
  endpointHealth: EndpointHealth | null;
  platformReadiness: PlatformReadiness | null;
  publicAccessStatus: PublicAccessStatus | null;
  platformHealthError: string | null;
  runtimeVersion: RuntimeVersion | null;
}) {
  const supabaseConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
  const currentFrontendUrl = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:5173";
  const remoteFrontendUrl = (import.meta.env.VITE_REMOTE_FRONTEND_URL as string | undefined) ?? currentFrontendUrl;
  const remoteBackendUrl = (import.meta.env.VITE_REMOTE_BACKEND_URL as string | undefined) ?? configuredBackendUrl;
  const frontendIsRemote = /^https:\/\//.test(remoteFrontendUrl) && !remoteFrontendUrl.includes("127.0.0.1") && !remoteFrontendUrl.includes("localhost");
  const currentLocationIsRemote = /^https:\/\//.test(currentFrontendUrl) && !currentFrontendUrl.includes("127.0.0.1") && !currentFrontendUrl.includes("localhost");
  const frontendUsesLocalBackend = /^(http:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?/i.test(configuredBackendUrl);
  const versionSyncStatus = getVersionSyncStatus(runtimeVersion);

  return (
    <div className="grid gap-5">
      <Panel title="Runtime & URLs">
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <RuntimeMetric label="Frontend origin" value={currentFrontendUrl} copyable />
            <RuntimeMetric label="Backend origin" value={publicAccessStatus?.backendPublicUrl ?? configuredBackendUrl} copyable />
            <RuntimeMetric label="Current VITE_BACKEND_URL" value={configuredBackendUrl} copyable />
            <RuntimeMetric label="Frontend public URL" value={publicAccessStatus?.frontendPublicUrl ?? "not configured"} copyable={Boolean(publicAccessStatus?.frontendPublicUrl)} />
            <RuntimeMetric label="Backend public URL" value={publicAccessStatus?.backendPublicUrl ?? "not configured"} copyable={Boolean(publicAccessStatus?.backendPublicUrl)} />
            <RuntimeMetric label="Backend checkedAt" value={publicAccessStatus?.checkedAt ?? runtimeVersion?.checkedAt ?? "unknown"} copyable={Boolean(publicAccessStatus?.checkedAt ?? runtimeVersion?.checkedAt)} />
            <RuntimeMetric label="Frontend build time" value={frontendBuildMetadata.buildTime} copyable />
            <RuntimeMetric label="Frontend version" value={frontendBuildMetadata.version ?? "unknown"} />
            <RuntimeMetric label="Backend version" value={runtimeVersion?.backendVersion ?? "unknown"} />
            <RuntimeMetric label="Frontend commit" value={frontendBuildMetadata.commitSha ?? "unknown"} copyable={Boolean(frontendBuildMetadata.commitSha)} />
            <RuntimeMetric label="Backend commit" value={runtimeVersion?.commitSha ?? "unknown"} copyable={Boolean(runtimeVersion?.commitSha)} />
            <RuntimeMetric label="Version sync" value={versionSyncStatus} />
          </div>
          <p className="text-sm leading-6 text-slate-400">
            Version sync compares frontend build metadata and backend git metadata when both are available. Unknown means one side did not expose commit metadata.
          </p>
        </div>
      </Panel>

      <Panel title="Remote Access">
        <div className="grid gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Mobile visibility via ngrok or HTTPS tunnel</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Use these URLs on Galaxy Fold, Android Chrome, or iPhone Safari. This section is visibility-only and does not start ngrok or expose execution controls.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <RemoteAccessCard
              label="Frontend URL"
              value={publicAccessStatus?.frontendPublicUrl ?? remoteFrontendUrl}
              status={publicAccessStatus?.frontendPublicUrlConfigured || frontendIsRemote ? "online" : "not configured"}
              detail={publicAccessStatus?.frontendPublicUrlConfigured ? "ARCHIVEOS_PUBLIC_URL is configured on backend." : "Set ARCHIVEOS_PUBLIC_URL to display the latest ngrok frontend URL."}
            />
            <RemoteAccessCard
              label="Backend URL"
              value={publicAccessStatus?.backendPublicUrl ?? remoteBackendUrl}
              status={backendReachability === "matched" ? "online" : "offline"}
              detail={publicAccessStatus?.backendBaseUrlConfigured ? "ARCHIVEOS_BACKEND_PUBLIC_URL is configured on backend." : "Set ARCHIVEOS_BACKEND_PUBLIC_URL when mobile/ngrok must call backend directly."}
            />
          </div>
          <div className="grid gap-2">
            {currentLocationIsRemote && frontendUsesLocalBackend ? (
              <p className="rounded border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                Current frontend is remote, but VITE_BACKEND_URL resolves to localhost. Restart frontend with the backend ngrok URL.
              </p>
            ) : null}
            {platformHealthError ? (
              <p className="rounded border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                Endpoint health is not reachable. Restart backend from latest main before using mobile/ngrok.
              </p>
            ) : null}
          </div>
        </div>
      </Panel>

      <Panel title="Integrations">
        <div className="grid gap-4">
          <GitHubIntegrationCard runtimeStatus={runtimeStatus} runtimeVersion={runtimeVersion} />
          <div className="grid gap-3 md:grid-cols-3">
            <IntegrationCard
              title="Discord"
              status={batchStatus?.discord_webhook_configured ? "configured" : "not_configured"}
              detail="Korean daily reports use backend-only DISCORD_WEBHOOK_URL."
            />
            <IntegrationCard
              title="Supabase"
              status={supabaseConfigured ? "configured" : "unknown"}
              detail="Frontend uses publishable key. Service role remains backend-only."
            />
            <IntegrationCard
              title="Obsidian"
              status={historianStatus?.configured ? "configured" : "not_configured"}
              detail="Historian exports relative Markdown note paths only."
            />
          </div>
        </div>
      </Panel>

      <Panel title="Environment & Rules">
        <div className="grid gap-4">
          {batchStatusError ? (
            <p className="rounded border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              {batchStatusError}
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <RuntimeMetric
              label="Discord webhook"
              value={batchStatus?.discord_webhook_configured ? "configured: yes" : "configured: no"}
            />
            <RuntimeMetric
              label="Obsidian export"
              value={historianStatus?.configured ? "configured: yes" : "configured: no"}
            />
            <RuntimeMetric
              label="Supabase"
              value={supabaseConfigured ? "configured: yes" : "unknown / env missing"}
            />
            <RuntimeMetric
              label="ArchiveOS public URL"
              value={batchStatus?.archiveos_public_url_configured ? "configured: yes" : "configured: no"}
            />
            <RuntimeMetric
              label="Business day rule"
              value="Korea weekdays excluding public/substitute holidays"
            />
            <RuntimeMetric
              label="Holiday list years"
              value={batchStatus?.holiday_years?.join(", ") || "2026"}
            />
            <RuntimeMetric label="Timezone" value="Asia/Seoul" />
            <RuntimeMetric label="Batch schedule" value="Nightly 23:50 / Daily 09:00 KST" />
            <RuntimeMetric
              label="Last batch run"
              value={batchStatus?.daily_report?.created_at ?? batchStatus?.nightly_review?.created_at ?? "none"}
              copyable
            />
            <RuntimeMetric
              label="Latest report stored"
              value={latestDailyReport?.created_at ?? "none"}
              copyable={Boolean(latestDailyReport?.created_at)}
            />
          </div>
          <p className="text-sm leading-6 text-slate-400">
            Nightly Review and Daily Report batches are backend/local-worker controlled. The UI is read-only and does not expose scheduling, webhook values, or execution controls.
          </p>
        </div>
      </Panel>

      <Panel title="Security Principles">
        <ul className="grid gap-2 text-sm leading-6 text-slate-400">
          <li>Service role key stays backend-only and is never exposed in frontend UI.</li>
          <li>Command Center records intent; it does not execute arbitrary typed shell commands.</li>
          <li>Local diagnostics are allowlisted checks only.</li>
          <li>No OpenAI API, MCP execution, Codex direct control, or GitHub automation is enabled from the UI.</li>
        </ul>
      </Panel>

      <details className="rounded-md border border-white/10 bg-[#0d1117] p-4 sm:p-5">
        <summary className="cursor-pointer text-lg font-semibold text-white">Developer Diagnostics</summary>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Endpoint Health Matrix is intentionally tucked away for debugging stale backend/frontend/ngrok processes.
        </p>
        <div className="mt-4">
          <EndpointHealthMatrix endpointHealth={endpointHealth} />
        </div>
      </details>
    </div>
  );
}

function RuntimeSummary({
  runtimeStatus,
  runtimeError,
  isRefreshing,
  refresh,
  onRecorded,
  showNowWorking = true,
}: {
  runtimeStatus: LocalRuntimeStatus | null;
  runtimeError: string | null;
  isRefreshing: boolean;
  refresh: (options?: { silent?: boolean }) => void;
  onRecorded: (options?: { silent?: boolean }) => void;
  showNowWorking?: boolean;
}) {
  const bottleneck = getPipelineBottleneck(runtimeStatus);
  const latestVerdict = runtimeStatus?.latest_details.reviewer?.verdict ?? "none";
  const queueStatus = runtimeStatus
    ? `${runtimeStatus.queue.inbox} inbox / ${runtimeStatus.queue.processing} processing / ${runtimeStatus.queue.outbox} outbox / ${runtimeStatus.queue.reviews} reviews`
    : "not loaded";
  const liveState = getLiveLoopState(runtimeStatus);

  return (
    <section className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <LiveIndicator active={liveState.active} title={liveState.title} />
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Live MCP Queue</p>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-white">Current Workflow State</h2>
          <SourceLabel label="live MCP + backend-derived" />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <LastUpdatedIndicator value={runtimeStatus?.checked_at ?? null} label="Last Updated" />
          <button
            className="rounded border border-cyan-300/30 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isRefreshing}
            onClick={() => refresh()}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {runtimeError ? (
        <p className="mt-4 rounded border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
          {runtimeError}
        </p>
      ) : runtimeStatus ? (
        <div className="mt-4 grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge className={runtimeStatusStyles[runtimeStatus.status]}>
              {runtimeStatus.status}
            </StatusBadge>
            <StatusBadge className={bottleneck.className}>{bottleneck.label}</StatusBadge>
            <span className="text-xs text-slate-500">checked {formatDate(runtimeStatus.checked_at)}</span>
            <span className="text-xs text-slate-500">{runtimeStatus.queue.path ? "queue connected" : "queue not configured"}</span>
          </div>
          <div className="grid gap-2 lg:grid-cols-4">
            <RuntimeMetric label="Active task" value={runtimeStatus.active_task ?? "none"} copyable emphasized />
            <RuntimeMetric label="Bottleneck" value={bottleneck.severity} />
            <RuntimeMetric label="Latest verdict" value={latestVerdict} />
            <RuntimeMetric label="Queue status" value={queueStatus} copyable />
          </div>
          {showNowWorking ? <NowWorkingPanel runtimeStatus={runtimeStatus} onRecorded={onRecorded} /> : null}
          <p className="rounded border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-400">
            {runtimeStatus.judgement}
          </p>
        </div>
      ) : (
        <EmptyState
          title={isRefreshing ? "Loading local workflow state" : "No local workflow state loaded"}
          detail={
            isRefreshing
              ? "Reading backend runtime status and MCP queue files."
              : "Start the backend and refresh runtime status."
          }
        />
      )}
    </section>
  );
}

function FloatingRuntimeControls({
  focusMode,
  onToggleFocus,
}: {
  focusMode: boolean;
  onToggleFocus: () => void;
}) {
  return (
    <aside className="fixed right-3 top-1/2 z-40 grid w-24 -translate-y-1/2">
      <button
        className="rounded-l-md border border-cyan-300/30 border-r-cyan-300/60 bg-[#07121d]/95 px-2 py-2 text-[0.68rem] font-semibold text-cyan-100 shadow-2xl shadow-cyan-950/40 backdrop-blur transition hover:bg-cyan-300/15 focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
        onClick={onToggleFocus}
        title={
          focusMode
            ? "Show all PM dashboard panels"
            : "Show only Current Workflow State and Live Pipeline Map"
        }
        type="button"
      >
        <span className="block text-[0.56rem] uppercase tracking-[0.12em] text-cyan-300">
          {focusMode ? "Max" : "Min"}
        </span>
        <span>{focusMode ? "Full" : "Focus"}</span>
      </button>
    </aside>
  );
}

function TopStatusStrip({
  runtimeStatus,
  runtimeError,
  latestArchitectureReview,
}: {
  runtimeStatus: LocalRuntimeStatus | null;
  runtimeError: string | null;
  latestArchitectureReview: ArchitectureReview | null;
}) {
  const bottleneck = getPipelineBottleneck(runtimeStatus);
  const worker = getCurrentWorkerSummary(runtimeStatus);
  const latestVerdict = runtimeStatus?.latest_details.reviewer?.verdict ?? "none";
  const blocked = runtimeError
    ? "Backend runtime unavailable"
    : getRuntimeStopReason(runtimeStatus) || bottleneck.detail;
  const systemClass = runtimeError
    ? commandStatusStyles.failed
    : runtimeStatus?.status === "working"
      ? commandStatusStyles.running
      : runtimeStatus?.processes.loop
        ? runtimeStatusStyles.idle
        : commandStatusStyles.failed;

  return (
    <section className="rounded-md border border-cyan-300/25 bg-[#08111a] p-4 shadow-lg shadow-cyan-950/10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">PM Status Snapshot</p>
          <p className="mt-1 text-xs text-slate-500">live MCP, backend-derived runtime state. Seed/demo data hidden.</p>
        </div>
        <StatusBadge className={systemClass}>{runtimeError ? "offline" : runtimeStatus?.status ?? "loading"}</StatusBadge>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
        <StatusTile label="System state" value={runtimeError ? "runtime error" : runtimeStatus?.status ?? "loading"} strong />
        <StatusTile label="Active task" value={runtimeStatus?.active_task ?? "none"} strong copyable />
        <StatusTile label="Current worker" value={worker.label} detail={worker.detail} />
        <StatusTile label="Latest verdict" value={latestVerdict} />
        <StatusTile
          label="Architect"
          value={getArchitectStatusLabel(latestArchitectureReview)}
          detail={latestArchitectureReview?.summary ?? "No architecture review yet"}
          warning={latestArchitectureReview?.status === "warning" || latestArchitectureReview?.status === "blocked"}
        />
        <StatusTile label="Bottleneck / warning" value={bottleneck.label} detail={blocked} warning={bottleneck.severity !== "clear"} />
      </div>
    </section>
  );
}

function StatusTile({
  label,
  value,
  detail,
  strong = false,
  warning = false,
  copyable = false,
}: {
  label: string;
  value: string;
  detail?: string;
  strong?: boolean;
  warning?: boolean;
  copyable?: boolean;
}) {
  return (
    <article className={`min-w-0 rounded-md border p-3 ${warning ? "border-amber-300/30 bg-amber-300/[0.07]" : "border-white/10 bg-black/20"}`}>
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <CompactValue
        value={value}
        className={`mt-2 ${strong ? "text-base font-semibold text-white" : "text-sm font-medium text-slate-200"}`}
        copyable={copyable}
      />
      {detail ? <p className="mt-1 truncate text-xs text-slate-500" title={detail}>{detail}</p> : null}
    </article>
  );
}

function LiveIndicator({ active, title }: { active: boolean; title: string }) {
  return (
    <span
      className={`inline-flex h-3 w-3 rounded-full ${
        active ? "animate-pulse bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.85)]" : "bg-slate-600"
      }`}
      title={title}
      aria-label={title}
    />
  );
}

function NowWorkingPanel({
  runtimeStatus,
  onRecorded,
  showRecorder = true,
}: {
  runtimeStatus: LocalRuntimeStatus;
  onRecorded: (options?: { silent?: boolean }) => void;
  showRecorder?: boolean;
}) {
  const targetTask =
    runtimeStatus.active_task ??
    runtimeStatus.latest_details.reviewer?.reviewed_task_id ??
    runtimeStatus.latest_details.builder?.task_id ??
    runtimeStatus.latest.outbox?.name ??
    null;

  return (
    <div className="rounded-md border border-cyan-300/20 bg-[#07121d] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Now Working</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Concrete local worker state from live MCP runtime detection.
          </p>
          <SourceLabel label="live MCP + backend-derived" />
        </div>
        {showRecorder ? <ApprovalRecorder targetTask={targetTask} onRecorded={onRecorded} /> : null}
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <WorkerStatusCard
          title="Implementer"
          detected={Boolean(runtimeStatus.processes.implementer)}
          process={runtimeStatus.processes.implementer}
          status={runtimeStatus.queue.processing > 0 ? "working" : runtimeStatus.processes.implementer ? "detected" : "not detected"}
          primary={runtimeStatus.active_task ?? "No active processing task"}
          secondary={runtimeStatus.latest.outbox?.name ?? "No builder result yet"}
          updatedAt={runtimeStatus.latest_details.builder?.finished_at ?? runtimeStatus.latest.outbox?.updated_at ?? null}
          interpretation={getImplementerInterpretation(runtimeStatus)}
        />
        <WorkerStatusCard
          title="Reviewer"
          detected={Boolean(runtimeStatus.processes.reviewer || runtimeStatus.processes.reviewer_bridge)}
          process={runtimeStatus.processes.reviewer ?? runtimeStatus.processes.reviewer_bridge}
          status={runtimeStatus.processes.reviewer_bridge ? "bridge detected" : runtimeStatus.processes.reviewer ? "manual detected" : "not detected"}
          primary={runtimeStatus.latest_details.reviewer?.verdict ?? "No verdict yet"}
          secondary={runtimeStatus.latest.review?.name ?? "No review file yet"}
          updatedAt={runtimeStatus.latest_details.reviewer?.reviewed_at ?? runtimeStatus.latest.review?.updated_at ?? null}
          interpretation={getReviewerInterpretation(runtimeStatus)}
        />
      </div>
    </div>
  );
}

function WorkerStatusCard({
  title,
  detected,
  process,
  status,
  primary,
  secondary,
  updatedAt,
  interpretation,
}: {
  title: string;
  detected: boolean;
  process: LocalRuntimeStatus["processes"]["implementer"];
  status: string;
  primary: string;
  secondary: string;
  updatedAt: string | null;
  interpretation: string;
}) {
  return (
    <article className={`rounded-md border p-4 ${detected ? "border-cyan-300/20 bg-cyan-300/[0.04]" : "border-white/10 bg-black/20"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{detected ? "detected" : "not detected"}</p>
        </div>
        <StatusBadge className={detected ? commandStatusStyles.running : consistencyStatusStyles.missing}>{status}</StatusBadge>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <RuntimeMetric label="PID" value={process ? String(process.pid) : "not detected"} />
        <RuntimeMetric label="CPU" value={process?.cpu !== null && process?.cpu !== undefined ? process.cpu.toFixed(1) : "unknown"} />
      </div>
      <RuntimeMetric label={title === "Implementer" ? "Current active task" : "Latest verdict"} value={primary} copyable emphasized />
      <RuntimeMetric label={title === "Implementer" ? "Latest builder result" : "Latest review file"} value={secondary} copyable />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded border border-white/10 bg-black/20 p-3">
        <p className="text-xs leading-5 text-slate-300">{interpretation}</p>
        <LastUpdatedIndicator value={updatedAt} label={title === "Implementer" ? "Latest result" : "Latest review"} />
      </div>
    </article>
  );
}

function ApprovalRecorder({
  targetTask,
  onRecorded,
}: {
  targetTask: string | null;
  onRecorded: (options?: { silent?: boolean }) => void;
}) {
  const [rejectReason, setRejectReason] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function record(action: "approve" | "reject") {
    setIsRecording(true);
    setMessage(null);

    try {
      const note = action === "approve" ? approvalNote.trim() : rejectReason.trim();
      const reason = note ? `\nReason: ${note}` : "";
      const target = targetTask ?? "current-runtime-state";
      const decisionLabel = action === "approve" ? "APPROVED" : "REJECTED";
      const content = [
        `PM Decision: ${decisionLabel}`,
        `Target: ${target}`,
        `Source: ArchiveOS Decisions tab`,
        reason.trim(),
      ].filter(Boolean).join("\n");

      await createWorkLog({
        task_id: null,
        agent_id: null,
        log_type: "decision",
        content,
      });

      await createCommandRun({
        command: `${action} ${target}`,
        command_type: `pm_${action}`,
        status: "succeeded",
        result: `PM decision saved to work_logs. Target: ${target}.${reason ? ` ${reason.replace(/\s+/g, " ").trim()}` : ""}`,
      });
      setMessage(action === "approve" ? "Approval decision saved." : "Rejection decision saved.");
      setApprovalNote("");
      if (action === "reject") {
        setRejectReason("");
      }
      onRecorded({ silent: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not record PM action.");
    } finally {
      setIsRecording(false);
    }
  }

  return (
    <div className="grid min-w-64 gap-2">
      <div className="rounded border border-white/10 bg-black/20 p-3">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Decision target</p>
        <CompactValue value={targetTask ?? "current-runtime-state"} className="mt-2 text-sm text-slate-200" copyable={Boolean(targetTask)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded border border-emerald-300/30 bg-emerald-300/[0.08] px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isRecording}
          onClick={() => record("approve")}
          type="button"
        >
          Approve Decision
        </button>
        <button
          className="rounded border border-rose-300/30 bg-rose-300/[0.08] px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isRecording}
          onClick={() => record("reject")}
          type="button"
        >
          Reject Decision
        </button>
      </div>
      <textarea
        className="min-h-16 rounded border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-emerald-300/60"
        value={approvalNote}
        onChange={(event) => setApprovalNote(event.target.value)}
        placeholder="Optional approval note"
      />
      <textarea
        className="min-h-16 rounded border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60"
        value={rejectReason}
        onChange={(event) => setRejectReason(event.target.value)}
        placeholder="Optional rejection reason"
      />
      {message ? <p className="text-xs text-slate-400">{message}</p> : null}
    </div>
  );
}

function PipelineOverview({
  runtimeStatus,
  runtimeError,
}: {
  runtimeStatus: LocalRuntimeStatus | null;
  runtimeError: string | null;
}) {
  const stages = getPipelineStages(runtimeStatus);
  const activeConnectorIndex = getActivePipelineConnectorIndex(runtimeStatus);
  const bottleneck = getPipelineBottleneck(runtimeStatus);
  const liveState = getLiveLoopState(runtimeStatus);

  return (
    <Panel title="Live Pipeline Map" className="overflow-hidden">
      {runtimeError ? (
        <EmptyState title="Pipeline offline" detail={runtimeError} />
      ) : runtimeStatus ? (
        <div className="grid gap-5">
          <div className="rounded-md border border-cyan-300/20 bg-[#07121d] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <LiveIndicator active={liveState.active} title={liveState.title} />
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
                    Runtime Flow
                  </p>
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  PM queue to builder, reviewer, and next decision.
                </p>
                <SourceLabel label="live MCP" />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <LastUpdatedIndicator value={runtimeStatus.checked_at} label="Last Updated" />
                <StatusBadge className={bottleneck.className}>{bottleneck.label}</StatusBadge>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
              {stages.map((stage, index) => (
                <div key={stage.id} className="contents">
                  <PipelineNode stage={stage} />
                  {index < stages.length - 1 ? (
                    <PipelineConnector state={getPipelineConnectorState(index, activeConnectorIndex, stages)} />
                  ) : null}
                </div>
              ))}
            </div>

            <CurrentHandoffLine runtimeStatus={runtimeStatus} />
          </div>

          <div className="rounded border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-400">
            {bottleneck.detail}
          </div>
        </div>
      ) : (
        <EmptyState title="Loading pipeline" detail="Reading live MCP queue and local process state." />
      )}
    </Panel>
  );
}

function CurrentHandoffLine({ runtimeStatus }: { runtimeStatus: LocalRuntimeStatus }) {
  const hasCurrentWork = runtimeStatus.queue.processing > 0 && Boolean(runtimeStatus.active_task);
  const previousSucceeded = runtimeStatus.latest_details.builder?.status === "done";

  return (
    <div className="mt-4 rounded-md border border-white/10 bg-black/20 p-3">
      <div className="grid gap-3 lg:grid-cols-[1fr_8rem_1fr] lg:items-center">
        <div className={`rounded border p-3 ${previousSucceeded ? "border-emerald-300/30 bg-emerald-300/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Previous</p>
          <CompactValue
            value={runtimeStatus.latest.outbox?.name ?? "No previous builder result"}
            className="mt-2 text-sm font-medium text-slate-200"
            copyable={Boolean(runtimeStatus.latest.outbox?.name)}
          />
        </div>
        <div className="hidden lg:block" title={hasCurrentWork ? "Current handoff active" : "No active handoff"}>
          <div
            className={`h-2 w-full ${
              hasCurrentWork && previousSucceeded
                ? "pipeline-flow-line pipeline-flow-line-current"
                : "rounded-full bg-white/[0.07]"
            }`}
          />
        </div>
        <div className={`rounded border p-3 ${hasCurrentWork ? "border-cyan-300/30 bg-cyan-300/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Current</p>
          <CompactValue
            value={runtimeStatus.active_task ?? "No active processing task"}
            className="mt-2 text-sm font-medium text-slate-200"
            copyable={Boolean(runtimeStatus.active_task)}
          />
        </div>
      </div>
    </div>
  );
}

function EventTimeline({
  events,
  error,
  isRefreshing,
  refresh,
}: {
  events: RuntimeEvent[];
  error: string | null;
  isRefreshing: boolean;
  refresh: (options?: { silent?: boolean }) => void;
}) {
  const [showAllToday, setShowAllToday] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const eventTypes = useMemo(() => ["all", ...Array.from(new Set(events.map((event) => event.type))).sort()], [events]);
  const eventStatuses = useMemo(() => ["all", ...Array.from(new Set(events.map((event) => event.status))).sort()], [events]);
  const todayEvents = events
    .filter((event) => isToday(event.created_at))
    .filter((event) => typeFilter === "all" || event.type === typeFilter)
    .filter((event) => statusFilter === "all" || event.status === statusFilter);
  const visibleEvents = showAllToday ? todayEvents : todayEvents.slice(0, 6);
  const hiddenCount = Math.max(todayEvents.length - visibleEvents.length, 0);
  const groupedEvents = groupEventsByDay(visibleEvents);

  return (
    <Panel title="Event Timeline">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
            Derived from live runtime state
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Read-only events normalized from MCP files, Supabase command/decision rows, and backend runtime judgement.
          </p>
        </div>
        <button
          className="rounded border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-300/50 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isRefreshing}
          onClick={() => refresh()}
        >
          {isRefreshing ? "Refreshing..." : "Refresh Timeline"}
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select
          className="min-h-10 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
          onChange={(event) => setTypeFilter(event.target.value)}
          value={typeFilter}
        >
          {eventTypes.map((type) => <option key={type} value={type}>{type === "all" ? "All event types" : type}</option>)}
        </select>
        <select
          className="min-h-10 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
          onChange={(event) => setStatusFilter(event.target.value)}
          value={statusFilter}
        >
          {eventStatuses.map((status) => <option key={status} value={status}>{status === "all" ? "All statuses" : status}</option>)}
        </select>
        <StatusBadge className="bg-slate-500/15 text-slate-200 ring-slate-400/20">today only</StatusBadge>
        <StatusBadge className="bg-cyan-500/15 text-cyan-200 ring-cyan-400/25">compact mode</StatusBadge>
      </div>

      {error ? (
        <EmptyState
          title="Event timeline needs backend sync"
          detail="Runtime event endpoint is missing, stale, or unreachable. Check Settings > Endpoint Health Matrix."
        />
      ) : todayEvents.length ? (
        <div className="grid gap-4">
          {groupedEvents.map((group) => (
            <section key={group.label} className="grid gap-3">
              <div className="flex items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{group.label}</p>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <div className="relative grid gap-3">
                <div className="absolute bottom-3 left-[5.5rem] top-3 hidden w-px bg-white/10 sm:block" />
                {group.events.map((event) => (
                  <article
                    key={event.id}
                    className={`relative grid gap-3 rounded-md border p-3 sm:grid-cols-[4.75rem_1fr] ${getEventCardClassName(event)}`}
                  >
                    <time className="text-xs leading-5 text-slate-500" title={formatExactDate(event.created_at)}>
                      {formatRelativeTime(event.created_at)}
                    </time>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge className={getEventTypeBadgeClassName(event)}>{getEventTypeLabel(event)}</StatusBadge>
                        <StatusBadge className={runtimeEventStatusStyles[event.status]}>{event.status}</StatusBadge>
                        <span className="rounded bg-black/20 px-2 py-1 text-xs text-slate-400">{event.source}</span>
                      </div>
                      <h3 className="mt-3 truncate text-sm font-semibold text-white" title={`${event.title} / ${formatExactDate(event.created_at)}`}>{event.title}</h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400" title={event.description}>{event.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
          {todayEvents.length > 6 ? (
            <button
              className="justify-self-start rounded border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-300/50 hover:bg-cyan-300/10"
              onClick={() => setShowAllToday((current) => !current)}
              type="button"
            >
              {showAllToday ? "Show less" : `Show ${hiddenCount} more today`}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4">
          <EmptyState
            title="No runtime events today"
            detail={events.length ? "Older derived events exist, but the timeline only shows today's events by default." : "No MCP, Supabase, or backend runtime events were derived today."}
          />
          {events.length ? (
            <div className="grid gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Older events hidden by default</p>
              {events.slice(0, 3).map((event) => (
                <article key={event.id} className={`rounded border p-3 ${getEventCardClassName(event)}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge className={getEventTypeBadgeClassName(event)}>{getEventTypeLabel(event)}</StatusBadge>
                    <span className="text-xs text-slate-500" title={formatExactDate(event.created_at)}>{formatRelativeTime(event.created_at)}</span>
                  </div>
                  <p className="mt-2 truncate text-sm text-slate-300" title={event.title}>{event.title}</p>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

function TimelinePreview({ events }: { events: RuntimeEvent[] }) {
  const todayEvents = events.filter((event) => isToday(event.created_at)).slice(0, 3);

  if (!todayEvents.length) {
    return <EmptyState title="No recent runtime events today" detail="Open the Timeline tab for older operational history." muted />;
  }

  return (
    <div className="grid gap-2">
      {todayEvents.map((event) => (
        <article key={event.id} className={`rounded border p-3 ${getEventCardClassName(event)}`}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge className={getEventTypeBadgeClassName(event)}>{getEventTypeLabel(event)}</StatusBadge>
            <span className="text-xs text-slate-500" title={formatExactDate(event.created_at)}>{formatRelativeTime(event.created_at)}</span>
            <span className="rounded bg-black/20 px-2 py-1 text-xs text-slate-400">{event.source}</span>
          </div>
          <p className="mt-2 truncate text-sm font-medium text-white" title={event.title}>{event.title}</p>
        </article>
      ))}
    </div>
  );
}

function DataConsistencyPanel({
  runtimeStatus,
  runtimeError,
  data,
  backendReachability,
  commandRunsReachability,
  consistencyError,
}: {
  runtimeStatus: LocalRuntimeStatus | null;
  runtimeError: string | null;
  data: DashboardData;
  backendReachability: ConsistencyStatus;
  commandRunsReachability: ConsistencyStatus;
  consistencyError: string | null;
}) {
  const runtimeQueue = runtimeStatus ? formatQueueCounts(runtimeStatus.queue) : "not loaded";
  const frontendQueue = runtimeStatus ? formatQueueCounts(runtimeStatus.queue) : "not displayed";
  const queueStatus = runtimeError ? "error" : runtimeStatus ? "matched" : "unknown";
  const builderStatus = runtimeStatus?.latest.outbox?.name ? "matched" : runtimeStatus ? "missing" : "unknown";
  const reviewerStatus = runtimeStatus?.latest.review?.name ? "matched" : runtimeStatus ? "missing" : "unknown";
  const stopReason = getRuntimeStopReason(runtimeStatus);

  const rows: { label: string; source: string; value: string; status: ConsistencyStatus; detail: string; copyable?: boolean }[] = [
    {
      label: "MCP queue counts",
      source: "runtime source",
      value: runtimeQueue,
      status: queueStatus,
      detail: runtimeStatus?.queue.path ? `Read from ${runtimeStatus.queue.path}` : runtimeError ?? "Runtime queue has not loaded yet.",
      copyable: Boolean(runtimeStatus?.queue.path),
    },
    {
      label: "Backend API queue counts",
      source: "backend",
      value: runtimeQueue,
      status: queueStatus,
      detail: runtimeError ? "Backend runtime endpoint failed." : "Loaded from GET /api/local-runtime/status.",
    },
    {
      label: "Frontend displayed queue counts",
      source: "frontend",
      value: frontendQueue,
      status: queueStatus,
      detail: "Dashboard panels render from the same backend runtime snapshot.",
    },
    {
      label: "Latest builder result",
      source: "mcp",
      value: runtimeStatus?.latest.outbox?.name ?? "none",
      status: builderStatus,
      detail: runtimeStatus?.latest_details.builder?.status
        ? `Builder payload status: ${runtimeStatus.latest_details.builder.status}.`
        : "No builder result filename is currently known.",
      copyable: Boolean(runtimeStatus?.latest.outbox?.name),
    },
    {
      label: "Latest reviewer result",
      source: "mcp",
      value: runtimeStatus?.latest.review?.name ?? "none",
      status: reviewerStatus,
      detail: runtimeStatus?.latest_details.reviewer?.verdict
        ? `Reviewer verdict: ${runtimeStatus.latest_details.reviewer.verdict}. ${stopReason}`
        : "No reviewer result filename is currently known.",
      copyable: Boolean(runtimeStatus?.latest.review?.name),
    },
    {
      label: "command_runs reachability",
      source: "supabase via backend",
      value: commandRunsReachability === "matched" ? "reachable" : "not confirmed",
      status: commandRunsReachability,
      detail: commandRunsReachability === "matched" ? "GET /api/commands/recent returned successfully." : consistencyError ?? "Waiting for command history check.",
    },
    {
      label: "work_logs / decisions reachability",
      source: "supabase frontend",
      value: `${data.logs.length} logs / ${data.decisions.length} decisions`,
      status: "matched",
      detail: data.logs.length || data.decisions.length
        ? "Supabase read succeeded and non-seed rows are available."
        : "Supabase read succeeded. No non-seed work logs or decisions are present yet.",
    },
  ];

  const checklist: { label: string; status: ConsistencyStatus; detail: string }[] = [
    {
      label: "backend online",
      status: backendReachability,
      detail: backendReachability === "matched" ? "Health endpoint responded." : consistencyError ?? "Backend has not been confirmed.",
    },
    {
      label: "Supabase reachable",
      status: "matched" as ConsistencyStatus,
      detail: "Frontend agent/task/work_log queries loaded without a Supabase error.",
    },
    {
      label: "command_runs table reachable",
      status: commandRunsReachability,
      detail: commandRunsReachability === "matched" ? "Command history can be read." : "Command history is not reachable yet.",
    },
    {
      label: "MCP queue readable",
      status: runtimeError ? "error" as ConsistencyStatus : runtimeStatus?.queue.path ? "matched" as ConsistencyStatus : "missing" as ConsistencyStatus,
      detail: runtimeStatus?.queue.path ?? runtimeError ?? "No queue path has been detected.",
    },
    {
      label: "implementer detected",
      status: runtimeStatus?.processes.implementer ? "matched" as ConsistencyStatus : "missing" as ConsistencyStatus,
      detail: runtimeStatus?.processes.implementer ? `PID ${runtimeStatus.processes.implementer.pid}` : "Manual implementer PID is not visible.",
    },
    {
      label: "reviewer detected",
      status: runtimeStatus?.processes.reviewer || runtimeStatus?.processes.reviewer_bridge ? "matched" as ConsistencyStatus : "missing" as ConsistencyStatus,
      detail: runtimeStatus?.processes.reviewer
        ? `Reviewer PID ${runtimeStatus.processes.reviewer.pid}`
        : runtimeStatus?.processes.reviewer_bridge
          ? `Reviewer bridge PID ${runtimeStatus.processes.reviewer_bridge.pid}`
          : "Reviewer session or bridge is not visible.",
    },
    {
      label: "loop status known",
      status: runtimeStatus?.processes.loop ? (runtimeStatus.queue.inbox || runtimeStatus.queue.processing ? "matched" : "stale") as ConsistencyStatus : "missing" as ConsistencyStatus,
      detail: runtimeStatus?.processes.loop
        ? runtimeStatus.queue.inbox || runtimeStatus.queue.processing
          ? `Loop PID ${runtimeStatus.processes.loop.pid} with active queue movement.`
          : `Loop PID ${runtimeStatus.processes.loop.pid}; queue is idle, not failed.`
        : "Loop process is not detected.",
    },
    {
      label: "latest result path known",
      status: builderStatus,
      detail: runtimeStatus?.latest.outbox?.name ?? "No latest outbox result filename.",
    },
    {
      label: "latest review path known",
      status: reviewerStatus,
      detail: runtimeStatus?.latest.review?.name ?? "No latest review filename.",
    },
  ];

  return (
    <Panel title="Data Consistency">
      <div className="grid gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Read-only consistency checks</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Compares the live runtime snapshot, backend reachability, and displayed PM data before an end-to-end visibility test.
          </p>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          {rows.map((row) => (
            <ConsistencyRow key={row.label} {...row} />
          ))}
        </div>

        <div className="rounded-md border border-white/10 bg-black/20 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">E2E Test Readiness</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">Checklist only. It does not start tasks or control the MCP loop.</p>
            </div>
            <StatusBadge className={getReadinessStatus(checklist).className}>{getReadinessStatus(checklist).label}</StatusBadge>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {checklist.map((item) => (
              <div key={item.label} className="rounded border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-200">{item.label}</p>
                  <StatusBadge className={consistencyStatusStyles[item.status]}>{item.status}</StatusBadge>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500" title={item.detail}>{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {stopReason ? (
          <p className="rounded border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm leading-6 text-amber-100">
            {stopReason}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function ProcessCard({
  title,
  process,
  interpretation,
}: {
  title: string;
  process: LocalRuntimeStatus["processes"]["implementer"];
  interpretation: string;
}) {
  const content = (
    <>
      <SourceLabel label="backend-derived process detection" />
      <div className="mt-3 grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge className={process ? commandStatusStyles.running : consistencyStatusStyles.missing}>
            {process ? "detected" : "not detected"}
          </StatusBadge>
          <LastUpdatedIndicator value={process?.startTime ?? null} label="Started" />
        </div>
        <p className="rounded border border-white/10 bg-black/20 p-3 text-sm leading-6 text-slate-300">{interpretation}</p>
        <details className="rounded border border-white/10 bg-white/[0.03] p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Technical Details
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <RuntimeMetric label="PID" value={process ? String(process.pid) : "not detected"} />
            <RuntimeMetric label="CPU" value={process?.cpu !== null && process?.cpu !== undefined ? process.cpu.toFixed(1) : "unknown"} />
            <div className="sm:col-span-2">
              <RuntimeMetric label="Command" value={process?.commandLine ?? "not detected"} copyable />
            </div>
          </div>
        </details>
      </div>
    </>
  );

  return (
    <>
      <details className="rounded-md border border-white/10 bg-white/[0.03] p-4 md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-white">
          <span>{title}</span>
          <StatusBadge className={process ? commandStatusStyles.running : consistencyStatusStyles.missing}>
            {process ? "detected" : "not detected"}
          </StatusBadge>
        </summary>
        <div className="mt-4">{content}</div>
      </details>
      <div className="hidden md:block">
        <Panel title={title}>{content}</Panel>
      </div>
    </>
  );
}

function QueueDetailsPanel({
  runtimeStatus,
  taskCounts,
}: {
  runtimeStatus: LocalRuntimeStatus | null;
  taskCounts: { status: TaskStatus; label: string; count: number }[];
}) {
  return (
    <Panel title="Queue Details">
      <SourceLabel label="live MCP queue + non-seed Supabase task counts" />
      {runtimeStatus ? (
        <div className="mt-3 grid gap-3">
          <div className="grid gap-3 md:grid-cols-4">
            <RuntimeMetric label="Inbox" value={String(runtimeStatus.queue.inbox)} />
            <RuntimeMetric label="Processing" value={String(runtimeStatus.queue.processing)} />
            <RuntimeMetric label="Outbox" value={String(runtimeStatus.queue.outbox)} />
            <RuntimeMetric label="Reviews" value={String(runtimeStatus.queue.reviews)} />
          </div>
          <RuntimeMetric label="Active MCP task" value={runtimeStatus.active_task ?? "none"} copyable emphasized />
          <RuntimeMetric label="Queue path" value={runtimeStatus.queue.path ?? "not configured"} copyable={Boolean(runtimeStatus.queue.path)} />
        </div>
      ) : (
        <EmptyState title="Queue not loaded" detail="Backend runtime status has not returned MCP queue details yet." />
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-5">
        {taskCounts.map((item) => (
          <div key={item.status} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{item.count}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ConsistencyMini({ label, status }: { label: string; status: ConsistencyStatus }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        <StatusBadge className={consistencyStatusStyles[status]}>{status}</StatusBadge>
      </div>
    </div>
  );
}

function RemoteAccessCard({
  label,
  value,
  status,
  detail,
}: {
  label: string;
  value: string;
  status: RemoteAccessStatus;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <CompactValue value={value} className="mt-2 text-sm font-medium text-white" copyable />
        </div>
        <StatusBadge className={remoteAccessStatusStyles[status]}>{status}</StatusBadge>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function EndpointHealthMatrix({ endpointHealth }: { endpointHealth: EndpointHealth | null }) {
  if (!endpointHealth) {
    return <EmptyState title="Endpoint health not loaded" detail="Restart backend from latest main and refresh Settings." muted />;
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <RuntimeMetric label="Checked" value={formatRelativeTime(endpointHealth.checkedAt)} />
        <RuntimeMetric label="OK" value={String(endpointHealth.summary.ok)} />
        <RuntimeMetric label="Error" value={String(endpointHealth.summary.error)} />
        <RuntimeMetric label="Missing" value={String(endpointHealth.summary.missing)} />
      </div>
      <div className="grid gap-2">
        {endpointHealth.endpoints.map((endpoint) => (
          <article key={`${endpoint.method}-${endpoint.path}`} className="grid gap-2 rounded-md border border-white/10 bg-black/20 p-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-white">{endpoint.name}</span>
                <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-slate-400">{endpoint.service}</span>
                <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-slate-400">{endpoint.httpStatus ?? "n/a"}</span>
              </div>
              <CompactValue value={`${endpoint.method} ${endpoint.path}`} className="mt-2 text-xs text-slate-400" copyable />
              <p className="mt-1 text-xs leading-5 text-slate-500">{endpoint.message}</p>
            </div>
            <StatusBadge className={getEndpointStatusStyle(endpoint.status)}>{endpoint.status}</StatusBadge>
          </article>
        ))}
      </div>
    </div>
  );
}

function ConsistencyRow({
  label,
  source,
  value,
  status,
  detail,
  copyable = false,
}: {
  label: string;
  source: string;
  value: string;
  status: ConsistencyStatus;
  detail: string;
  copyable?: boolean;
}) {
  return (
    <article className="rounded-md border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{source}</p>
          <h3 className="mt-1 text-sm font-semibold text-white">{label}</h3>
        </div>
        <StatusBadge className={consistencyStatusStyles[status]}>{status}</StatusBadge>
      </div>
      <CompactValue value={value} className="mt-3 text-sm font-medium text-slate-200" copyable={copyable} />
      <p className="mt-2 text-xs leading-5 text-slate-500" title={detail}>{detail}</p>
    </article>
  );
}

function PipelineNode({ stage }: { stage: PipelineStage }) {
  return (
    <article className={`min-h-36 rounded-md border p-3 ${stage.className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{stage.kicker}</p>
          <h3 className="mt-2 truncate text-sm font-semibold text-white" title={stage.label}>{stage.label}</h3>
        </div>
        <span
          className={`h-3 w-3 rounded-full ${stage.dotClassName} ${
            stage.pulse ? "animate-pulse shadow-[0_0_14px_rgba(103,232,249,0.75)]" : ""
          }`}
          title={stage.pulse ? `${stage.label} active` : `${stage.label} idle`}
          aria-label={stage.pulse ? `${stage.label} active` : `${stage.label} idle`}
        />
      </div>
      <p className="mt-4 truncate text-3xl font-semibold text-white" title={stage.value}>{stage.value}</p>
      <CompactValue value={stage.detail} className="mt-3 min-h-10 text-xs leading-5 text-slate-400" copyable />
    </article>
  );
}

function PipelineConnector({ state }: { state: PipelineConnectorState }) {
  return (
    <div className="hidden min-w-8 items-center lg:flex" aria-hidden="true">
      <div
        className={`h-2 w-full ${
          state === "current"
            ? "pipeline-flow-line pipeline-flow-line-current"
            : state === "success"
              ? "pipeline-flow-line pipeline-flow-line-success"
              : "rounded-full bg-white/[0.07]"
        }`}
      />
    </div>
  );
}

function CommandCenter() {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<CommandRun[]>([]);
  const [health, setHealth] = useState<"checking" | "online" | "offline">("checking");
  const [commandError, setCommandError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    refreshHealth();
    refreshHistory();
  }, []);

  async function refreshHealth() {
    setHealth("checking");

    try {
      await getBackendHealth();
      setHealth("online");
    } catch {
      setHealth("offline");
    }
  }

  async function refreshHistory() {
    try {
      const commands = await getRecentCommands();
      setHistory(commands.filter((commandRun) => !seedCommandRunIds.has(commandRun.id)));
    } catch {
      setCommandError("Could not load backend command history.");
    }
  }

  async function submitCommand(commandText: string, commandType = "typed") {
    const trimmed = commandText.trim();

    if (!trimmed) {
      return;
    }

    setIsSubmitting(true);
    setCommandError(null);
    setCommand("");

    try {
      if (commandType.includes("health_check")) {
        await refreshHealth();
      }

      const savedRun = await createCommandRun({
        command: trimmed,
        command_type: commandType,
        status: commandType.includes("health_check") ? "succeeded" : "pending",
      });

      setHistory((current) => [savedRun, ...current].slice(0, 8));
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : "Command request failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const healthStyles =
    health === "online"
      ? "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25"
      : health === "offline"
        ? "bg-rose-500/15 text-rose-200 ring-rose-400/25"
        : "bg-slate-500/15 text-slate-200 ring-slate-400/20";

  const healthLabel =
    health === "online" ? "backend online" : health === "offline" ? "backend offline" : "checking backend";

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge className={healthStyles}>{healthLabel}</StatusBadge>
          <span className="text-xs text-slate-500">
            {health === "offline" ? "Commands cannot be recorded while the backend is offline." : "Visibility and recording only"}
          </span>
        </div>
        <button
          className="rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-300/50 hover:bg-cyan-300/10"
          onClick={refreshHealth}
        >
          Refresh Health
        </button>
      </div>

      <div>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-300">Recorded Quick Actions</h3>
          <p className="mt-1 text-xs text-slate-500">
            These buttons only record PM intent. They do not trigger external automation.
          </p>
        </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {quickActions.map((action) => (
          <button
            key={action}
            className="rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-300/50 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
            onClick={() => submitCommand(action, toCommandType(action))}
          >
            {action}
          </button>
        ))}
      </div>
      </div>

      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          submitCommand(command);
        }}
      >
        <input
          className="min-h-11 flex-1 rounded border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          placeholder="Type a command to record, e.g. summarize current queue"
        />
        <button
          className="min-h-11 rounded bg-cyan-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting}
        >
          Record Command
        </button>
      </form>

      {commandError ? (
        <p className="rounded border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
          {commandError}
        </p>
      ) : null}

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-300">Command History</h3>
          <button
            className="rounded border border-white/10 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-cyan-300/50 hover:bg-cyan-300/10"
            onClick={refreshHistory}
          >
            Refresh
          </button>
        </div>
        {history.length ? (
          <div className="grid gap-2">
            {history.map((run) => (
              <article
                key={run.id}
                className="rounded-md border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{run.command}</p>
                  <StatusBadge className={commandStatusStyles[run.status]}>{run.status}</StatusBadge>
                </div>
                <p className="mt-2 text-xs text-slate-500">{formatDate(run.created_at)}</p>
                {run.result ? <p className="mt-2 text-xs text-slate-400">{run.result}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No live command records"
            detail="Seed/demo commands are hidden. Newly recorded PM commands and allowlisted diagnostics will appear here."
          />
        )}
      </div>
    </div>
  );
}

function LocalDiagnostics() {
  const [projects, setProjects] = useState<LocalActionProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("archiveos");
  const [localActionResult, setLocalActionResult] = useState<LocalActionResult | null>(null);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [isRunningLocalAction, setIsRunningLocalAction] = useState(false);

  useEffect(() => {
    refreshProjects();
  }, []);

  async function refreshProjects() {
    try {
      const configuredProjects = await getLocalActionProjects();
      setProjects(configuredProjects);
      setSelectedProjectId(configuredProjects[0]?.id ?? "archiveos");
    } catch {
      setDiagnosticsError("Could not load local action projects.");
    }
  }

  async function submitLocalAction(action: LocalAction) {
    setIsRunningLocalAction(true);
    setDiagnosticsError(null);
    setLocalActionResult(null);

    try {
      const result = await runLocalAction({
        project_id: selectedProjectId,
        action,
      });
      setLocalActionResult(result);
    } catch (error) {
      setDiagnosticsError(error instanceof Error ? error.message : "Local action request failed.");
    } finally {
      setIsRunningLocalAction(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">Allowlisted checks</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Read-only diagnostics and build checks only. No arbitrary shell input is accepted.
          </p>
        </div>
        <select
          className="max-w-44 rounded border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-200 outline-none"
          value={selectedProjectId}
          onChange={(event) => setSelectedProjectId(event.target.value)}
        >
          {projects.length ? (
            projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))
          ) : (
            <option value="archiveos">No project</option>
          )}
        </select>
      </div>

      {diagnosticsError ? (
        <p className="rounded border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
          {diagnosticsError}
        </p>
      ) : null}

      {projects.length ? (
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
          {projects.map((project) => (
            <p key={project.id} className="truncate" title={`${project.name} / ${project.repo} / ${project.path}`}>
              {project.name} / {project.repo}
            </p>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No local project configured"
          detail="The backend did not return an allowlisted project registry."
          muted
        />
      )}

      {projects.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {localActionButtons.map((item) => (
            <button
              key={item.action}
              className="rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-300/50 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isRunningLocalAction}
              onClick={() => submitLocalAction(item.action)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {localActionResult ? (
        <div className="rounded-md border border-white/10 bg-black/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="truncate text-sm font-medium text-white" title={localActionResult.action}>
              {localActionResult.action}
            </p>
            <StatusBadge className={commandStatusStyles[localActionResult.status]}>
              {localActionResult.status}
            </StatusBadge>
          </div>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-3 text-xs leading-5 text-slate-300">
            {[localActionResult.stdout, localActionResult.stderr].filter(Boolean).join("\n\n") ||
              `Exit code ${localActionResult.exitCode}`}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function Decisions({ decisions }: { decisions: WorkLog[] }) {
  return (
    <Panel title="Memory / Decisions">
      <div className="grid gap-3">
        {decisions.length ? (
          decisions.map((decision) => <LogItem key={decision.id} log={decision} />)
        ) : (
          <p className="text-sm text-slate-400">No live saved decisions yet. Seed/demo decisions are hidden.</p>
        )}
      </div>
    </Panel>
  );
}

function RuntimeResult({
  title,
  status,
  timestamp,
  lastUpdated,
  sourceLabel,
  body,
  imageRef,
}: {
  title: string;
  status: string;
  timestamp: string | null;
  lastUpdated: string | null;
  sourceLabel: string;
  body: string;
  imageRef: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const shouldCollapse = body.length > 260;
  const visibleBody = !expanded && shouldCollapse ? `${body.slice(0, 260)}...` : body;

  return (
    <article className="rounded-md border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <CompactValue value={title} className="text-sm font-semibold text-white" copyable />
          {timestamp ? <p className="mt-1 text-xs text-slate-500">{formatDate(timestamp)}</p> : null}
          <SourceLabel label={sourceLabel} />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <LastUpdatedIndicator value={lastUpdated} label="Last Updated" />
          <StatusBadge className={getResultStatusStyle(status)}>
            {status}
          </StatusBadge>
        </div>
      </div>
      <div className="mt-4">
        {imageRef ? (
          <div className="mb-4 rounded-md border border-white/10 bg-black/30 p-2">
            {imageFailed ? (
              <p className="text-xs leading-5 text-slate-500" title={imageRef}>
                Screenshot reference found, but the image could not be previewed.
              </p>
            ) : (
              <img
                className="max-h-44 w-full rounded object-contain"
                src={imageRef}
                alt="Attached runtime result screenshot"
                title={imageRef}
                onError={() => setImageFailed(true)}
              />
            )}
            <CompactValue value={imageRef} className="mt-2 text-xs text-slate-500" copyable />
          </div>
        ) : (
          <p className="mb-3 rounded border border-white/10 bg-black/20 p-2 text-xs text-slate-500">
            No screenshot attached
          </p>
        )}
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Summary</p>
        <p className="text-sm leading-6 text-slate-300" title={body}>{visibleBody}</p>
        {shouldCollapse ? (
          <button
            className="mt-3 rounded border border-white/10 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-cyan-300/50 hover:bg-cyan-300/10"
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            {expanded ? "Show less" : "Show full text"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function PipelineWarnings({ runtimeStatus }: { runtimeStatus: LocalRuntimeStatus | null }) {
  if (!runtimeStatus) {
    return <EmptyState title="No runtime signal" detail="Backend runtime status has not loaded yet." />;
  }

  const bottleneck = getPipelineBottleneck(runtimeStatus);
  const warnings = getPipelineWarningMessages(runtimeStatus);

  if (!warnings.length) {
    return (
      <div className="rounded-md border border-emerald-400/20 bg-emerald-400/[0.04] p-4">
        <p className="text-sm font-medium text-emerald-100">{bottleneck.label}</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">{bottleneck.detail}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {warnings.map((warning) => (
        <p key={warning} className="rounded border border-amber-300/20 bg-amber-300/[0.06] p-3 text-sm leading-6 text-amber-100">
          {warning}
        </p>
      ))}
    </div>
  );
}

function RuntimeMetric({
  label,
  value,
  copyable = false,
  emphasized = false,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  emphasized?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-md border p-3 ${emphasized ? "border-cyan-300/25 bg-cyan-300/[0.05]" : "border-white/10 bg-black/20"}`}>
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <CompactValue value={value} className={`mt-2 ${emphasized ? "text-base font-semibold text-white" : "text-sm font-medium text-slate-200"}`} copyable={copyable} />
    </div>
  );
}

function CompactValue({
  value,
  className = "",
  copyable = false,
}: {
  value: string;
  className?: string;
  copyable?: boolean;
}) {
  const compact = compactValue(value);

  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      <span className="min-w-0 flex-1 break-all" title={value}>
        {compact}
      </span>
      {copyable && value !== "none" && value !== "not loaded" ? (
        <button
          className="shrink-0 rounded border border-white/10 px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:border-cyan-300/50 hover:text-cyan-100"
          onClick={() => copyText(value)}
          title="Copy full value"
          type="button"
        >
          Copy
        </button>
      ) : null}
    </div>
  );
}

function EmptyState({ title, detail, muted = false }: { title: string; detail: string; muted?: boolean }) {
  return (
    <div className={`rounded-md border border-dashed p-4 ${muted ? "border-white/5 bg-black/5" : "border-white/10 bg-black/10"}`}>
      <p className="text-sm font-medium text-slate-300">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{detail}</p>
    </div>
  );
}

function LastUpdatedIndicator({ value, label = "Last Updated" }: { value: string | null; label?: string }) {
  return (
    <span
      className="inline-flex rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-slate-400"
      title={value ? formatExactDate(value) : "No timestamp available"}
    >
      {label}: {value ? formatRelativeTime(value) : "unknown"}
    </span>
  );
}

function SourceLabel({ label }: { label: string }) {
  return (
    <p className="mt-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-600">
      Source: {label}
    </p>
  );
}

function Panel({
  title,
  className = "",
  muted = false,
  children,
}: {
  title: string;
  className?: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-md border p-4 sm:p-5 ${muted ? "border-white/5 bg-[#0a0d12]" : "border-white/10 bg-[#0d1117]"} ${className}`}>
      <h2 className="mb-4 text-lg font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

function LogList({ logs }: { logs: WorkLog[] }) {
  if (!logs.length) {
    return <EmptyState title="No live work logs" detail="Seed/demo work logs are hidden from PM operations views." />;
  }

  return (
    <div className="grid gap-3">
      {logs.map((log) => (
        <LogItem key={log.id} log={log} />
      ))}
    </div>
  );
}

function LogItem({ log }: { log: WorkLog }) {
  return (
    <article className={`rounded-md border p-4 ${logTypeStyles[log.log_type]}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <StatusBadge>{log.log_type}</StatusBadge>
        <span>{formatDate(log.created_at)}</span>
        {log.agent?.name ? <span>{log.agent.name}</span> : null}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-200">{log.content}</p>
      {log.task?.title ? <p className="mt-3 text-xs text-slate-500">Task: {log.task.title}</p> : null}
    </article>
  );
}

function getDashboardStateStyle(state: string) {
  switch (state) {
    case "working":
      return "bg-cyan-500/15 text-cyan-200 ring-cyan-400/25";
    case "waiting":
      return "bg-amber-500/15 text-amber-200 ring-amber-400/25";
    case "offline":
      return "bg-rose-500/15 text-rose-200 ring-rose-400/25";
    case "idle":
    default:
      return "bg-slate-500/15 text-slate-200 ring-slate-400/20";
  }
}

function getCurrentWorker(runtimeStatus: LocalRuntimeStatus | null) {
  if (!runtimeStatus) return "unknown";
  if (runtimeStatus.queue.processing > 0 && runtimeStatus.processes.implementer) return "Implementer";
  if (runtimeStatus.processes.reviewer || runtimeStatus.processes.reviewer_bridge) return "Reviewer / Bridge";
  if (runtimeStatus.processes.loop) return "MCP Loop";
  return "none detected";
}

function getRecommendedPmAction(
  runtimeStatus: LocalRuntimeStatus | null,
  runtimeError: string | null,
  latestArchitectureReview: ArchitectureReview | null,
  endpointHealth: EndpointHealth | null,
) {
  if (runtimeError) return "Backend runtime is unreachable. Check Operators and Settings diagnostics before making a decision.";
  if (endpointHealth && endpointHealth.summary.error + endpointHealth.summary.missing > 0) {
    return "Resolve stale or missing backend endpoints in Settings before portfolio/demo review.";
  }
  if (latestArchitectureReview?.status === "blocked") {
    return "Architect marked a blocking risk. Record rejection or split the task before continuing.";
  }
  if (runtimeStatus?.queue.processing) return "Monitor the active task. Wait for builder/reviewer evidence before recording a PM decision.";
  if (runtimeStatus?.queue.inbox && !runtimeStatus.processes.loop) return "Inbox has work but the loop is not detected. Treat this as an operations warning.";
  if (runtimeStatus?.latest_details.reviewer?.verdict && runtimeStatus.latest_details.reviewer.verdict !== "none") {
    return "Review latest builder/reviewer evidence and record approval or rejection in Decisions.";
  }
  return "No immediate PM action required. Continue monitoring or create the next reviewed task outside the UI.";
}

function getDashboardWarningMessages(
  runtimeStatus: LocalRuntimeStatus | null,
  runtimeError: string | null,
  endpointHealth: EndpointHealth | null,
  kpiOverview: KpiOverview | null,
  meshOverview: MeshOverview | null,
  latestDailyReport: DailyReport | null,
) {
  return [
    ...getPipelineWarningMessages(runtimeStatus),
    runtimeError ? "runtime offline" : null,
    endpointHealth && endpointHealth.summary.error + endpointHealth.summary.missing > 0 ? "endpoint warning" : null,
    kpiOverview?.runtime.latestStatus === "blocked" ? "KPI runtime blocked" : null,
    meshOverview?.health.status === "blocked" ? "mesh blocked" : null,
    latestDailyReport?.status === "problem" ? "daily report problem" : null,
  ].filter(Boolean) as string[];
}

function getKpiInterpretation(kpiOverview: KpiOverview) {
  const approval = kpiOverview.quality.approvalRate;
  const warnings = kpiOverview.runtime.warningCount;
  const knowledgeNodes = kpiOverview.knowledge.nodesCreatedInRange;

  if (warnings !== null && warnings > 0) {
    return `Operational attention is needed: ${warnings} warning signal(s) were found in this range. Check Runtime Health and Timeline before treating the trend as stable.`;
  }
  if (approval !== null && approval >= 80 && knowledgeNodes !== null && knowledgeNodes > 0) {
    return "Operations look healthy: approvals are high and operational memory is being captured.";
  }
  if (approval === null && knowledgeNodes === null) {
    return "Historical data is still thin. Run daily/nightly batches to make KPI trends meaningful.";
  }
  return "Use this view as directional analytics only; metrics are derived from existing ArchiveOS records and may be incomplete.";
}

function StatusBadge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatExactDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (diffSeconds < 45) return "just now";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function groupEventsByDay(events: RuntimeEvent[]) {
  const groups = new Map<string, RuntimeEvent[]>();

  for (const event of events) {
    const label = isToday(event.created_at) ? "Today" : formatEventDay(event.created_at);
    groups.set(label, [...(groups.get(label) ?? []), event]);
  }

  return Array.from(groups.entries()).map(([label, groupEvents]) => ({
    label,
    events: groupEvents,
  }));
}

function formatEventDay(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function compactValue(value: string) {
  if (value.length <= 48) {
    return value;
  }

  const fileLike = value.split(/[\\/]/).pop() ?? value;
  if (fileLike.length <= 48 && fileLike.length >= 12) {
    return fileLike;
  }

  return `${value.slice(0, 24)}...${value.slice(-16)}`;
}

function copyText(value: string) {
  void navigator.clipboard?.writeText(value);
}

function formatProcess(processItem: LocalRuntimeStatus["processes"]["implementer"], includeCpu = false) {
  if (!processItem) {
    return "not detected";
  }

  const cpu = includeCpu && processItem.cpu !== null ? ` / CPU ${processItem.cpu.toFixed(1)}` : "";
  return `PID ${processItem.pid}${cpu}`;
}

function getResultStatusStyle(status: string) {
  if (["done", "approved", "approve", "approve_next", "succeeded", "success"].includes(status)) {
    return commandStatusStyles.succeeded;
  }

  if (["review", "reviewing", "request_changes"].includes(status)) {
    return "bg-amber-500/15 text-amber-200 ring-amber-400/25";
  }

  if (["failed", "error", "stop"].includes(status)) {
    return commandStatusStyles.failed;
  }

  if (["idle", "none", "unknown"].includes(status)) {
    return "bg-slate-500/15 text-slate-200 ring-slate-400/20";
  }

  return commandStatusStyles.running;
}

function getEventTypeLabel(event: RuntimeEvent) {
  if (event.type === "builder") return "builder completed";
  if (event.type === "reviewer") return "reviewer verdict";
  if (event.type === "queue") return "queue changed";
  if (event.type === "command") return "command recorded";
  if (event.type === "warning") return "warning detected";
  if (event.type === "batch") return "batch event";
  return event.type;
}

function getEventTypeBadgeClassName(event: RuntimeEvent) {
  if (event.type === "builder") return commandStatusStyles.succeeded;
  if (event.type === "reviewer") return event.status === "error" ? commandStatusStyles.failed : "bg-amber-500/15 text-amber-200 ring-amber-400/25";
  if (event.type === "queue") return commandStatusStyles.running;
  if (event.type === "command") return "bg-violet-500/15 text-violet-200 ring-violet-400/25";
  if (event.type === "warning") return commandStatusStyles.failed;
  if (event.type === "batch") return runtimeEventStatusStyles[event.status];
  return runtimeEventStatusStyles[event.status];
}

function getEventCardClassName(event: RuntimeEvent) {
  if (event.type === "builder") return "border-emerald-300/30 bg-emerald-300/[0.05]";
  if (event.type === "reviewer") return "border-amber-300/30 bg-amber-300/[0.06]";
  if (event.type === "queue") return "border-cyan-300/30 bg-cyan-300/[0.05]";
  if (event.type === "command") return "border-violet-300/30 bg-violet-300/[0.05]";
  if (event.type === "warning") return "border-rose-300/40 bg-rose-300/[0.07]";
  if (event.type === "batch") return "border-emerald-300/30 bg-emerald-300/[0.05]";
  return runtimeEventTypeStyles[event.type];
}

function getBatchStatusStyle(status: string) {
  if (status === "sent" || status === "completed") return commandStatusStyles.succeeded;
  if (status === "skipped") return "bg-amber-500/15 text-amber-200 ring-amber-400/25";
  if (status === "failed") return commandStatusStyles.failed;
  return commandStatusStyles.pending;
}

function getArchitectStatusStyle(status: ArchitectureReview["status"]) {
  return architectStatusStyles[status] ?? architectStatusStyles.pending;
}

function getEndpointStatusStyle(status: EndpointHealth["endpoints"][number]["status"]) {
  if (status === "ok") return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25";
  if (status === "missing") return "bg-amber-500/15 text-amber-200 ring-amber-400/25";
  if (status === "unknown") return "bg-slate-500/15 text-slate-200 ring-slate-400/20";
  return "bg-rose-500/15 text-rose-200 ring-rose-400/25";
}

function getIntegrationStatusStyle(status: "configured" | "not_configured" | "unknown") {
  if (status === "configured") return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25";
  if (status === "not_configured") return "bg-slate-500/15 text-slate-200 ring-slate-400/20";
  return "bg-amber-500/15 text-amber-200 ring-amber-400/25";
}

function getVersionSyncStatus(runtimeVersion: RuntimeVersion | null) {
  if (!runtimeVersion?.commitSha || !frontendBuildMetadata.commitSha) {
    return "unknown";
  }

  return runtimeVersion.commitSha === frontendBuildMetadata.commitSha ? "synced" : "version mismatch";
}

function getArchitectStatusLabel(review: ArchitectureReview | null) {
  if (!review) return "no review";
  if (review.status === "reviewed") return "clear";
  return review.status;
}

function getMeshStatusStyle(status: MeshAgent["status"]) {
  if (["working", "detected", "enabled", "clear"].includes(status)) {
    return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25";
  }

  if (status === "idle") {
    return "bg-slate-500/15 text-slate-200 ring-slate-400/20";
  }

  if (status === "blocked") {
    return commandStatusStyles.failed;
  }

  if (["warning", "no_review"].includes(status)) {
    return "bg-amber-500/15 text-amber-200 ring-amber-400/25";
  }

  return consistencyStatusStyles.missing;
}

function findMeshAgent(meshOverview: MeshOverview, id: string) {
  return meshOverview.agents.find((agent) => agent.id === id) ?? null;
}

function filterKnowledgeGraph(
  graph: KnowledgeGraph | null,
  filters: {
    nodeType: string;
    edgeType: string;
    query: string;
    importanceFilter: "all" | "medium" | "high" | "critical";
    recentOnly: boolean;
    decisionPathOnly: boolean;
    architectPathOnly: boolean;
    hideLowImportance: boolean;
  },
): KnowledgeGraph {
  if (!graph) {
    return {
      nodes: [],
      edges: [],
      stats: { nodeCount: 0, edgeCount: 0, types: {} },
    };
  }

  const cleanQuery = filters.query.trim().toLowerCase();
  const nodes = graph.nodes.filter((node) => {
    const typeMatch = filters.nodeType === "all" || node.type === filters.nodeType;
    const importanceMatch = importancePasses(node.importanceLevel, filters.importanceFilter) && (!filters.hideLowImportance || node.importanceLevel !== "low");
    const recentMatch = !filters.recentOnly || node.isRecent;
    const queryMatch =
      !cleanQuery ||
      [node.label, node.title, node.externalRef ?? "", node.summary ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(cleanQuery);
    return typeMatch && importanceMatch && recentMatch && queryMatch;
  });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter((edge) => {
    const typeMatch = filters.edgeType === "all" || edge.type === filters.edgeType;
    const decisionMatch = !filters.decisionPathOnly || edge.isDecisionPath;
    const architectMatch = !filters.architectPathOnly || edge.isArchitectPath;
    return typeMatch && decisionMatch && architectMatch && nodeIds.has(edge.from) && nodeIds.has(edge.to);
  });

  return {
    nodes,
    edges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      types: nodes.reduce<Record<string, number>>((acc, node) => {
        acc[node.type] = (acc[node.type] ?? 0) + 1;
        return acc;
      }, {}),
    },
  };
}

function importancePasses(level: ImportanceLevel, filter: "all" | "medium" | "high" | "critical") {
  const order: Record<ImportanceLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  if (filter === "all") return true;
  return order[level] >= order[filter];
}

function layoutGraphNodes(nodes: KnowledgeGraphNode[], width: number, height: number) {
  const centerX = width / 2;
  const centerY = height / 2;
  const radiusX = width * 0.36;
  const radiusY = height * 0.34;
  const groups = groupGraphNodes(nodes);
  const positions = new Map<string, { x: number; y: number }>();
  const typeCount = groups.length || 1;

  groups.forEach(([type, group], typeIndex) => {
    const typeAngle = (Math.PI * 2 * typeIndex) / typeCount - Math.PI / 2;
    const groupCenterX = centerX + Math.cos(typeAngle) * radiusX * 0.55;
    const groupCenterY = centerY + Math.sin(typeAngle) * radiusY * 0.55;
    const localRadius = Math.max(34, Math.min(84, 22 + group.length * 5));

    group.forEach((node, nodeIndex) => {
      const angle = group.length === 1 ? typeAngle : (Math.PI * 2 * nodeIndex) / group.length + typeAngle;
      positions.set(node.id, {
        x: clampGraphPosition(groupCenterX + Math.cos(angle) * localRadius, 70, width - 70),
        y: clampGraphPosition(groupCenterY + Math.sin(angle) * localRadius, 70, height - 70),
      });
    });
  });

  return positions;
}

function groupGraphNodes(nodes: KnowledgeGraphNode[]) {
  const byType = nodes.reduce<Record<string, KnowledgeGraphNode[]>>((acc, node) => {
    acc[node.type] = acc[node.type] ?? [];
    acc[node.type].push(node);
    return acc;
  }, {});

  return Object.entries(byType).sort(([left], [right]) => left.localeCompare(right));
}

function clampGraphPosition(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getKnowledgeNodeColor(type: string) {
  const colors: Record<string, string> = {
    decision: "#22c55e",
    incident: "#f97316",
    daily_report: "#38bdf8",
    nightly_review: "#0ea5e9",
    architecture_review: "#a855f7",
    obsidian_note: "#8b5cf6",
    builder_result: "#06b6d4",
    reviewer_result: "#f59e0b",
    command: "#64748b",
    task: "#14b8a6",
  };

  return colors[type] ?? "#94a3b8";
}

function getKnowledgeNodeRadius(node: KnowledgeGraphNode, selected: boolean) {
  const sizes: Record<ImportanceLevel, number> = {
    low: 17,
    medium: 22,
    high: 28,
    critical: 34,
  };
  return sizes[node.importanceLevel] + (selected ? 4 : 0);
}

function getKnowledgeNodeStroke(node: KnowledgeGraphNode) {
  if (node.type === "decision") return "rgba(34,211,238,0.95)";
  if (node.type === "architecture_review") return "rgba(251,191,36,0.95)";
  if (node.type === "incident") return "rgba(251,113,133,0.95)";
  if (node.type === "daily_report" || node.type === "nightly_review") return "rgba(96,165,250,0.9)";
  if (node.importanceLevel === "critical") return "rgba(255,255,255,0.9)";
  return "rgba(255,255,255,0.35)";
}

function getKnowledgeNodeStrokeWidth(node: KnowledgeGraphNode) {
  if (node.importanceLevel === "critical") return 3;
  if (node.importanceLevel === "high") return 2.4;
  if (["decision", "architecture_review", "incident"].includes(node.type)) return 2.2;
  return 1.2;
}

function getKnowledgeEdgeColor(edge: KnowledgeGraphEdge) {
  if (edge.isDecisionPath) return "rgba(34,211,238,0.92)";
  if (edge.isArchitectPath) return "rgba(251,191,36,0.9)";
  if (edge.isIncidentPath) return "rgba(251,113,133,0.9)";
  if (edge.type === "exported_to") return "rgba(139,92,246,0.9)";
  if (edge.type === "reviewed_by" || edge.type === "reviewed_architecture_of") return "rgba(245,158,11,0.9)";
  if (edge.type === "mentioned_in") return "rgba(56,189,248,0.82)";
  if (edge.type === "references_memory") return "rgba(168,85,247,0.8)";
  return "rgba(148,163,184,0.72)";
}

function getKnowledgeEdgeWidth(edge: KnowledgeGraphEdge) {
  if (edge.importanceLevel === "critical") return 4;
  if (edge.importanceLevel === "high") return 3;
  if (edge.importanceLevel === "medium") return 2;
  return 1.1;
}

function getImportanceBadgeStyle(level: ImportanceLevel) {
  if (level === "critical") return "bg-rose-500/15 text-rose-200 ring-rose-400/25";
  if (level === "high") return "bg-amber-500/15 text-amber-200 ring-amber-400/25";
  if (level === "medium") return "bg-cyan-500/15 text-cyan-200 ring-cyan-400/25";
  return "bg-slate-500/15 text-slate-200 ring-slate-400/20";
}

function getGraphNodeImportanceReason(node: KnowledgeGraphNode, edges: KnowledgeGraphEdge[], nodes: KnowledgeGraphNode[]) {
  const relatedTypes = new Set(edges.map((edge) => nodes.find((item) => item.id === (edge.from === node.id ? edge.to : edge.from))?.type).filter(Boolean));
  const reasons = [];
  if (node.type === "decision") reasons.push("it records a PM decision");
  if (node.type === "architecture_review") reasons.push("it contains Architect risk review");
  if (node.type === "incident") reasons.push("it marks an operational incident");
  if (node.isHub) reasons.push(`it connects ${node.degree} graph relationships`);
  if (node.isRecent) reasons.push("it was created or referenced recently");
  if (node.isDecisionRelevant || relatedTypes.has("decision")) reasons.push("it is connected to decision context");
  if (relatedTypes.has("architecture_review")) reasons.push("it is connected to an Architect review");
  if (relatedTypes.has("incident")) reasons.push("it is connected to an incident");
  return reasons.length
    ? `This node matters because ${reasons.join(", ")}.`
    : "This node is currently low-importance operational memory with few graph relationships.";
}

function truncateGraphLabel(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function formatKpiValue(value: number | null) {
  return value === null ? "insufficient data" : String(value);
}

function formatKpiPercent(value: number | null) {
  return value === null ? "insufficient data" : `${value}%`;
}

function formatKpiMetric(value: string | number | null) {
  if (typeof value === "string") return value;
  return formatKpiValue(value);
}

function getOperationStatusLabelKo(status: DailyReport["status"]) {
  if (status === "problem") return "문제";
  if (status === "warning") return "주의";
  return "정상";
}

function getOperationStatusLabel(status: DailyReport["status"]) {
  if (status === "problem") return "문제";
  if (status === "warning") return "주의";
  return "정상";
}

function readBatchReason(run: LatestBatchStatus["daily_report"]) {
  const reason = run?.metadata?.reason;
  return typeof reason === "string" ? reason : "";
}

function readEdgeReason(edge: { metadata?: Record<string, unknown> }) {
  const reason = edge.metadata?.reason;
  return typeof reason === "string" ? reason : "metadata relationship";
}

function getLiveLoopState(runtimeStatus: LocalRuntimeStatus | null) {
  const active = Boolean(runtimeStatus && (runtimeStatus.status === "working" || runtimeStatus.processes.loop));

  if (active) {
    const title =
      runtimeStatus?.queue.inbox || runtimeStatus?.queue.processing
        ? "Live loop active"
        : "Loop process active; queue idle";
    return { active: true, title };
  }

  if (runtimeStatus?.processes.loop) {
    return { active: false, title: "Loop idle" };
  }

  return { active: false, title: runtimeStatus ? "Loop offline" : "Runtime not loaded" };
}

function formatQueueCounts(queue: LocalRuntimeStatus["queue"]) {
  return `inbox=${queue.inbox}, processing=${queue.processing}, outbox=${queue.outbox}, reviews=${queue.reviews}`;
}

function getRuntimeStopReason(runtimeStatus: LocalRuntimeStatus | null) {
  if (runtimeStatus?.latest_details.reviewer?.verdict !== "stop") {
    return "";
  }

  const summary = runtimeStatus.latest_details.reviewer.summary ?? "";
  if (/usage limit/i.test(summary)) {
    return "Latest reviewer verdict is stop because Codex reported a usage limit. This is a usage-limit stop, not a runtime crash.";
  }

  if (runtimeStatus.queue.inbox === 0 && runtimeStatus.queue.processing === 0) {
    return "Latest reviewer verdict is stop and the queue is empty. This means PM input is required before more work starts.";
  }

  return "Latest reviewer verdict is stop. Review the latest reviewer result before queueing more work.";
}

function getPipelineWarningMessages(runtimeStatus: LocalRuntimeStatus | null) {
  if (!runtimeStatus) return [];

  return [
    runtimeStatus.queue.processing > 0 && !runtimeStatus.processes.implementer
      ? "Processing has a task, but the implementer PID is not detected."
      : null,
    runtimeStatus.latest_details.reviewer?.verdict === "stop" && runtimeStatus.queue.inbox === 0
      ? getRuntimeStopReason(runtimeStatus) || "Reviewer verdict is stop and inbox is empty. PM must decide the next task."
      : null,
    runtimeStatus.queue.inbox > 0 && !runtimeStatus.processes.loop
      ? "Inbox has queued work, but the loop process is not detected."
      : null,
    runtimeStatus.queue.outbox > runtimeStatus.queue.reviews && runtimeStatus.latest.review?.updated_at && runtimeStatus.latest.outbox?.updated_at && runtimeStatus.latest.outbox.updated_at > runtimeStatus.latest.review.updated_at
      ? "Latest outbox is newer than latest review. Reviewer bridge may be behind."
      : null,
  ].filter((warning): warning is string => Boolean(warning));
}

function getCurrentWorkerSummary(runtimeStatus: LocalRuntimeStatus | null) {
  if (!runtimeStatus) return { label: "unknown", detail: "Runtime has not loaded." };
  if (runtimeStatus.queue.processing > 0) {
    return {
      label: "Implementer",
      detail: runtimeStatus.processes.implementer ? formatProcess(runtimeStatus.processes.implementer, true) : "PID not detected",
    };
  }
  if (runtimeStatus.latest_details.reviewer?.verdict === "stop") {
    return { label: "PM decision", detail: getRuntimeStopReason(runtimeStatus) || "Reviewer stopped the loop." };
  }
  if (runtimeStatus.processes.loop && runtimeStatus.queue.inbox === 0) {
    return { label: "Loop idle", detail: "Loop is idle because inbox=0." };
  }
  if (runtimeStatus.queue.inbox > 0) {
    return { label: "Queue loop", detail: `${runtimeStatus.queue.inbox} inbox task waiting.` };
  }
  return { label: "No active worker", detail: "No active processing task." };
}

function getLoopInterpretation(runtimeStatus: LocalRuntimeStatus | null) {
  if (!runtimeStatus?.processes.loop) return "MCP queue loop is not detected.";
  if (runtimeStatus.queue.processing > 0) return "Loop is feeding an active implementer task.";
  if (runtimeStatus.queue.inbox > 0) return "Loop is visible and inbox has work waiting.";
  return "Loop is idle because inbox=0.";
}

function getBridgeInterpretation(runtimeStatus: LocalRuntimeStatus | null) {
  if (!runtimeStatus?.processes.reviewer_bridge) return "Reviewer bridge process is not detected.";
  if (runtimeStatus.latest_details.reviewer?.verdict) return `Reviewer bridge produced ${runtimeStatus.latest_details.reviewer.verdict}.`;
  return "Reviewer bridge is detected and waiting for a builder result.";
}

function getImplementerInterpretation(runtimeStatus: LocalRuntimeStatus) {
  if (runtimeStatus.queue.processing > 0) return "Builder is busy on active task.";
  if (runtimeStatus.processes.implementer && runtimeStatus.queue.inbox === 0) return "Implementer is detected and waiting; loop is idle because inbox=0.";
  if (!runtimeStatus.processes.implementer) return "Implementer process is not detected.";
  return "No failure detected.";
}

function getReviewerInterpretation(runtimeStatus: LocalRuntimeStatus) {
  const verdict = runtimeStatus.latest_details.reviewer?.verdict;
  if (verdict === "stop") return getRuntimeStopReason(runtimeStatus) || "Reviewer produced stop.";
  if (verdict) return `Reviewer produced ${verdict}.`;
  if (runtimeStatus.processes.reviewer || runtimeStatus.processes.reviewer_bridge) return "Reviewer is detected and waiting for a new builder result.";
  return "Reviewer process is not detected.";
}

function getReadinessStatus(items: { status: ConsistencyStatus }[]) {
  if (items.some((item) => item.status === "error")) {
    return { label: "error", className: consistencyStatusStyles.error };
  }

  if (items.some((item) => item.status === "missing")) {
    return { label: "missing items", className: consistencyStatusStyles.missing };
  }

  if (items.some((item) => item.status === "stale")) {
    return { label: "idle but ready", className: consistencyStatusStyles.stale };
  }

  if (items.some((item) => item.status === "unknown")) {
    return { label: "checking", className: consistencyStatusStyles.unknown };
  }

  return { label: "ready", className: consistencyStatusStyles.matched };
}

function getPipelineStages(runtimeStatus: LocalRuntimeStatus | null): PipelineStage[] {
  const inactive = "border-white/10 bg-white/[0.03]";
  const live = "border-cyan-300/30 bg-cyan-300/[0.06]";
  const success = "border-emerald-300/30 bg-emerald-300/[0.06]";
  const warning = "border-amber-300/30 bg-amber-300/[0.07]";
  const stopped = "border-rose-300/30 bg-rose-300/[0.07]";

  if (!runtimeStatus) {
    return ["Input", "Loop", "Builder", "Result", "Reviewer", "Decision"].map((label, index) => ({
      id: label.toLowerCase(),
      kicker: `Stage ${index + 1}`,
      label,
      value: "-",
      detail: "Waiting for runtime status.",
      active: false,
      pulse: false,
      className: inactive,
      dotClassName: "bg-slate-500",
    }));
  }

  const reviewerVerdict = runtimeStatus.latest_details.reviewer?.verdict ?? "none";
  const hasPendingInput = runtimeStatus.queue.inbox > 0;
  const hasProcessing = runtimeStatus.queue.processing > 0;
  const loopRunning = Boolean(runtimeStatus.processes.loop);
  const loopWaiting = loopRunning && !hasPendingInput && !hasProcessing;
  const reviewerStopped = reviewerVerdict === "stop";
  const builderSucceeded = runtimeStatus.latest_details.builder?.status === "done";
  const reviewerApproved = reviewerVerdict === "approve_next";
  const resultNewerThanReview =
    runtimeStatus.latest.outbox?.updated_at &&
    runtimeStatus.latest.review?.updated_at &&
    runtimeStatus.latest.outbox.updated_at > runtimeStatus.latest.review.updated_at;

  const waitingClass = loopWaiting ? live : inactive;
  const waitingDot = loopWaiting ? "bg-cyan-300" : "bg-slate-500";

  return [
    {
      id: "input",
      kicker: "Queue",
      label: "Inbox",
      value: String(runtimeStatus.queue.inbox),
      detail: hasPendingInput ? "Queued work is waiting for the loop." : "No queued input.",
      active: hasPendingInput,
      pulse: hasPendingInput || loopWaiting,
      className: hasPendingInput ? live : waitingClass,
      dotClassName: hasPendingInput ? "bg-cyan-300" : waitingDot,
    },
    {
      id: "loop",
      kicker: "Runner",
      label: "Loop",
      value: runtimeStatus.processes.loop ? "on" : "off",
      detail: runtimeStatus.processes.loop
        ? `PID ${runtimeStatus.processes.loop.pid}`
        : "Loop process not detected.",
      active: loopRunning,
      pulse: loopRunning,
      className: loopRunning ? live : stopped,
      dotClassName: loopRunning ? "bg-cyan-300" : "bg-rose-300",
    },
    {
      id: "builder",
      kicker: "Worker",
      label: "Implementer",
      value: hasProcessing ? "busy" : runtimeStatus.processes.implementer ? "ready" : "off",
      detail: runtimeStatus.processes.implementer
        ? `PID ${runtimeStatus.processes.implementer.pid}${runtimeStatus.active_task ? ` / ${runtimeStatus.active_task}` : ""}`
        : "Implementer process not detected.",
      active: hasProcessing,
      pulse: hasProcessing || loopWaiting,
      className: hasProcessing || loopWaiting ? live : runtimeStatus.processes.implementer ? inactive : stopped,
      dotClassName: hasProcessing || loopWaiting ? "bg-cyan-300" : runtimeStatus.processes.implementer ? "bg-slate-400" : "bg-rose-300",
    },
    {
      id: "result",
      kicker: "Output",
      label: "Outbox",
      value: String(runtimeStatus.queue.outbox),
      detail: runtimeStatus.latest.outbox?.name ?? "No builder result.",
      active: Boolean(runtimeStatus.latest.outbox),
      pulse: builderSucceeded || loopWaiting,
      className: builderSucceeded ? success : waitingClass,
      dotClassName: builderSucceeded ? "bg-emerald-300" : waitingDot,
    },
    {
      id: "reviewer",
      kicker: "Review",
      label: "Reviewer",
      value: runtimeStatus.processes.reviewer_bridge ? "bridge" : runtimeStatus.processes.reviewer ? "manual" : "off",
      detail: runtimeStatus.processes.reviewer_bridge
        ? `Bridge PID ${runtimeStatus.processes.reviewer_bridge.pid}`
        : runtimeStatus.processes.reviewer
          ? `Reviewer PID ${runtimeStatus.processes.reviewer.pid}`
          : "Reviewer process not detected.",
      active: Boolean(runtimeStatus.processes.reviewer_bridge || runtimeStatus.processes.reviewer),
      pulse: resultNewerThanReview || loopWaiting || Boolean(runtimeStatus.processes.reviewer_bridge || runtimeStatus.processes.reviewer),
      className: resultNewerThanReview
        ? warning
        : loopWaiting || runtimeStatus.processes.reviewer_bridge || runtimeStatus.processes.reviewer
          ? live
          : stopped,
      dotClassName: resultNewerThanReview ? "bg-amber-300" : loopWaiting || runtimeStatus.processes.reviewer_bridge || runtimeStatus.processes.reviewer ? "bg-cyan-300" : "bg-rose-300",
    },
    {
      id: "decision",
      kicker: "Decision",
      label: "Next Step",
      value: reviewerVerdict,
      detail: runtimeStatus.latest_details.reviewer?.next_task_id
        ? `Next task: ${runtimeStatus.latest_details.reviewer.next_task_id}`
        : reviewerStopped
          ? "Reviewer stopped. PM decision is needed."
          : "No next task queued by reviewer.",
      active: !reviewerStopped && Boolean(runtimeStatus.latest_details.reviewer?.next_task_id),
      pulse: reviewerApproved || loopWaiting,
      className: reviewerStopped ? stopped : reviewerApproved ? success : waitingClass,
      dotClassName: reviewerStopped ? "bg-rose-300" : reviewerApproved ? "bg-emerald-300" : waitingDot,
    },
  ];
}

function getActivePipelineConnectorIndex(runtimeStatus: LocalRuntimeStatus | null) {
  if (!runtimeStatus) return null;

  if (runtimeStatus.queue.processing > 0) return 1;
  if (
    runtimeStatus.latest.outbox?.updated_at &&
    runtimeStatus.latest.review?.updated_at &&
    runtimeStatus.latest.outbox.updated_at > runtimeStatus.latest.review.updated_at
  ) {
    return 3;
  }
  if (runtimeStatus.queue.inbox > 0) return 0;
  if (runtimeStatus.processes.loop && runtimeStatus.queue.inbox === 0 && runtimeStatus.queue.processing === 0) return null;

  return null;
}

function getPipelineConnectorState(
  index: number,
  activeConnectorIndex: number | null,
  stages: PipelineStage[],
): PipelineConnectorState {
  if (index === activeConnectorIndex) return "current";

  const left = stages[index];
  const right = stages[index + 1];
  if (left?.dotClassName.includes("emerald") && right?.dotClassName.includes("emerald")) {
    return "success";
  }

  return "idle";
}

function getPipelineBottleneck(runtimeStatus: LocalRuntimeStatus | null) {
  if (!runtimeStatus) {
    return {
      severity: "loading",
      label: "Waiting for runtime",
      detail: "The backend has not returned the MCP runtime status yet.",
      className: commandStatusStyles.pending,
    };
  }

  if (runtimeStatus.queue.processing > 0 && !runtimeStatus.processes.implementer) {
    return {
      severity: "critical",
      label: "Builder PID missing",
      detail: "A task is in processing, but ArchiveOS cannot see the implementer process.",
      className: commandStatusStyles.failed,
    };
  }

  if (runtimeStatus.queue.inbox > 0 && !runtimeStatus.processes.loop) {
    return {
      severity: "critical",
      label: "Loop offline",
      detail: "There is queued work in inbox, but the loop runner is not detected.",
      className: commandStatusStyles.failed,
    };
  }

  if (runtimeStatus.latest_details.reviewer?.verdict === "stop" && runtimeStatus.queue.inbox === 0 && runtimeStatus.queue.processing === 0) {
    return {
      severity: "PM",
      label: "PM decision required",
      detail: "The reviewer stopped and there is no inbox work. The pipeline is idle until a new task is queued.",
      className: commandStatusStyles.pending,
    };
  }

  if (runtimeStatus.queue.processing > 0) {
    return {
      severity: "work",
      label: "Builder busy",
      detail: `The active task is ${runtimeStatus.active_task ?? "unknown"}.`,
      className: commandStatusStyles.running,
    };
  }

  if (runtimeStatus.queue.inbox > 0) {
    return {
      severity: "queue",
      label: "Loop backlog",
      detail: `${runtimeStatus.queue.inbox} inbox task${runtimeStatus.queue.inbox === 1 ? "" : "s"} waiting for the loop.`,
      className: commandStatusStyles.running,
    };
  }

  return {
    severity: "clear",
    label: "No active bottleneck",
    detail: "Inbox and processing are empty. This is an idle queue state when the loop is visible, not a runtime crash.",
    className: commandStatusStyles.succeeded,
  };
}

function getRuntimeAgents(runtimeStatus: LocalRuntimeStatus | null) {
  if (!runtimeStatus) {
    return [];
  }

  return [
    {
      id: "runtime-implementer",
      name: "Implementer Codex",
      role: "Local Codex process",
      status: runtimeStatus.queue.processing > 0 ? "working" : "waiting",
      current_task: runtimeStatus.processes.implementer
        ? `${formatProcess(runtimeStatus.processes.implementer, true)} / ${runtimeStatus.active_task ?? "waiting for inbox task"}`
        : null,
    },
    {
      id: "runtime-reviewer",
      name: "Reviewer Codex",
      role: "Local Codex reviewer session",
      status: runtimeStatus.processes.reviewer || runtimeStatus.processes.reviewer_bridge ? "reviewing" : "waiting",
      current_task: runtimeStatus.processes.reviewer
        ? `${formatProcess(runtimeStatus.processes.reviewer, true)} / latest review ${runtimeStatus.latest.review?.name ?? "none"}`
        : runtimeStatus.processes.reviewer_bridge
          ? `${formatProcess(runtimeStatus.processes.reviewer_bridge)} / bridge active`
          : null,
    },
  ].filter((agent) => agent.current_task) as {
    id: string;
    name: string;
    role: string;
    status: AgentStatus;
    current_task: string;
  }[];
}

function hasRuntimeChanged(previous: LocalRuntimeStatus, next: LocalRuntimeStatus) {
  return (
    previous.status !== next.status ||
    previous.active_task !== next.active_task ||
    previous.queue.inbox !== next.queue.inbox ||
    previous.queue.processing !== next.queue.processing ||
    previous.queue.outbox !== next.queue.outbox ||
    previous.queue.reviews !== next.queue.reviews ||
    previous.processes.loop?.pid !== next.processes.loop?.pid ||
    previous.processes.reviewer_bridge?.pid !== next.processes.reviewer_bridge?.pid ||
    previous.latest.processing?.name !== next.latest.processing?.name ||
    previous.latest.processing?.updated_at !== next.latest.processing?.updated_at ||
    previous.latest.outbox?.name !== next.latest.outbox?.name ||
    previous.latest.outbox?.updated_at !== next.latest.outbox?.updated_at ||
    previous.latest.review?.name !== next.latest.review?.name ||
    previous.latest.review?.updated_at !== next.latest.review?.updated_at
  );
}

function toCommandType(action: string) {
  return action.toLowerCase().replace(/\s+/g, "_");
}

export default App;
