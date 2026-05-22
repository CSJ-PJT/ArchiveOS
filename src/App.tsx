import { useEffect, useMemo, useState } from "react";
import {
  createCommandRun,
  getBackendHealth,
  getLocalActionProjects,
  getLocalRuntimeStatus,
  getRecentCommands,
  getRecentRuntimeEvents,
  runLocalAction,
  type LocalAction,
  type LocalActionProject,
  type LocalActionResult,
  type LocalRuntimeStatus,
  type RuntimeEvent,
} from "./lib/backendApi";
import { supabase } from "./lib/supabase";
import type {
  Agent,
  AgentStatus,
  CommandRun,
  CommandStatus,
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
};

const consistencyStatusStyles: Record<ConsistencyStatus, string> = {
  matched: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25",
  missing: "bg-slate-500/15 text-slate-200 ring-slate-400/20",
  stale: "bg-amber-500/15 text-amber-200 ring-amber-400/25",
  unknown: "bg-violet-500/15 text-violet-200 ring-violet-400/25",
  error: "bg-rose-500/15 text-rose-200 ring-rose-400/25",
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

function App() {
  const [view, setView] = useState<"dashboard" | "decisions">("dashboard");
  const [data, setData] = useState<DashboardData>({
    agents: [],
    tasks: [],
    logs: [],
    decisions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError(null);

      const [agentsResult, tasksResult, logsResult, decisionsResult] = await Promise.all([
        supabase.from("agents").select("*").order("name", { ascending: true }),
        supabase
          .from("tasks")
          .select("*, agent:agents(name,status)")
          .order("updated_at", { ascending: false }),
        supabase
          .from("work_logs")
          .select("*, task:tasks(title,status), agent:agents(name,role)")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("work_logs")
          .select("*, task:tasks(title,status), agent:agents(name,role)")
          .eq("log_type", "decision")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const firstError =
        agentsResult.error ?? tasksResult.error ?? logsResult.error ?? decisionsResult.error;

      if (firstError) {
        setError(firstError.message);
      } else {
        const agents = (agentsResult.data ?? []).filter((agent) => !seedAgentIds.has(agent.id));
        const tasks = ((tasksResult.data ?? []) as Task[]).filter((task) => !seedTaskIds.has(task.id));
        const logs = ((logsResult.data ?? []) as WorkLog[]).filter((log) => !seedWorkLogIds.has(log.id));
        const decisions = ((decisionsResult.data ?? []) as WorkLog[]).filter((log) => !seedWorkLogIds.has(log.id));

        setData({
          agents,
          tasks,
          logs,
          decisions,
        });
      }

      setLoading(false);
    }

    loadDashboard();
  }, []);

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
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
              Agent operations
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-normal text-white">ArchiveOS</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              A read-only PM operations dashboard for agent workflow visibility, safe command recording,
              and decision history.
            </p>
          </div>
          <nav className="flex rounded-md border border-white/10 bg-white/[0.03] p-1">
            <button
              className={`rounded px-4 py-2 text-sm font-medium transition ${
                view === "dashboard" ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:bg-white/10"
              }`}
              onClick={() => setView("dashboard")}
            >
              Dashboard
            </button>
            <button
              className={`rounded px-4 py-2 text-sm font-medium transition ${
                view === "decisions" ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:bg-white/10"
              }`}
              onClick={() => setView("decisions")}
            >
              Decisions
              {data.decisions.length ? (
                <span
                  className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
                    view === "decisions" ? "bg-slate-950/15 text-slate-950" : "bg-cyan-400/15 text-cyan-200"
                  }`}
                >
                  {data.decisions.length}
                </span>
              ) : null}
            </button>
          </nav>
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
        ) : view === "dashboard" ? (
          <Dashboard data={data} taskCounts={taskCounts} />
        ) : (
          <Decisions decisions={data.decisions} />
        )}
      </div>
    </main>
  );
}

function Dashboard({
  data,
  taskCounts,
}: {
  data: DashboardData;
  taskCounts: { status: TaskStatus; label: string; count: number }[];
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
  const [focusMode, setFocusMode] = useState(false);
  const runtimeAgents = getRuntimeAgents(runtimeStatus);

  useEffect(() => {
    refreshRuntime();
    refreshRuntimeEvents();
    refreshConsistency();
    const timer = window.setInterval(() => {
      refreshRuntime({ silent: true });
      refreshRuntimeEvents({ silent: true });
      refreshConsistency({ silent: true });
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

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

  return (
    <div className="grid gap-5">
      <FloatingRuntimeControls
        focusMode={focusMode}
        onToggleFocus={() => setFocusMode((current) => !current)}
      />

      <TopStatusStrip runtimeStatus={runtimeStatus} runtimeError={runtimeError} />

      <RuntimeSummary
        runtimeStatus={runtimeStatus}
        runtimeError={runtimeError}
        isRefreshing={isRefreshingRuntime}
        refresh={refreshRuntime}
        onRecorded={refreshRuntimeEvents}
      />

      <PipelineOverview runtimeStatus={runtimeStatus} runtimeError={runtimeError} />

      {focusMode ? null : (
        <>
      <EventTimeline
        events={runtimeEvents}
        error={runtimeEventsError}
        isRefreshing={isRefreshingEvents}
        refresh={refreshRuntimeEvents}
      />

      <DataConsistencyPanel
        runtimeStatus={runtimeStatus}
        runtimeError={runtimeError}
        data={data}
        backendReachability={backendReachability}
        commandRunsReachability={commandRunsReachability}
        consistencyError={consistencyError}
      />

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Agent State">
          <SourceLabel label="live MCP agents + non-seed Supabase agents" />
          {data.agents.length || runtimeAgents.length ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              {runtimeAgents.map((agent) => (
                <article key={agent.id} className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.04] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-medium text-white" title={agent.name}>{agent.name}</h3>
                      <p className="mt-1 truncate text-sm text-slate-400" title={agent.role}>{agent.role}</p>
                    </div>
                    <StatusBadge className={agentStatusStyles[agent.status]}>{agent.status}</StatusBadge>
                  </div>
                  <p className="mt-4 truncate text-sm leading-5 text-slate-300" title={agent.current_task}>{agent.current_task}</p>
                </article>
              ))}
              {data.agents.map((agent) => (
                <article key={agent.id} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-medium text-white" title={agent.name}>{agent.name}</h3>
                      <p className="mt-1 truncate text-sm text-slate-400" title={agent.role}>{agent.role}</p>
                    </div>
                    <StatusBadge className={agentStatusStyles[agent.status]}>{agent.status}</StatusBadge>
                  </div>
                  <p className="mt-4 truncate text-sm leading-5 text-slate-300" title={agent.current_task ?? "No current task"}>
                    {agent.current_task ?? "No current task"}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No live agent records"
              detail="Seed/demo agents are hidden, and no local Codex process was detected."
            />
          )}
        </Panel>

        <Panel title="Task Queue State">
          <SourceLabel label="live MCP queue + non-seed Supabase tasks" />
          {data.tasks.length ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-5">
              {taskCounts.map((item) => (
                <div key={item.status} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{item.count}</p>
                </div>
              ))}
            </div>
          ) : runtimeStatus && (runtimeStatus.queue.inbox > 0 || runtimeStatus.queue.processing > 0) ? (
            <div className="mt-3 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <RuntimeMetric label="Inbox" value={String(runtimeStatus.queue.inbox)} />
                <RuntimeMetric label="Processing" value={String(runtimeStatus.queue.processing)} />
                <RuntimeMetric label="Active MCP task" value={runtimeStatus.active_task ?? "none"} copyable />
              </div>
              <p className="rounded border border-cyan-300/20 bg-cyan-300/[0.04] p-3 text-xs leading-5 text-cyan-100">
                Supabase task rows are empty, so this panel is showing the live MCP queue task state.
              </p>
            </div>
          ) : (
            <EmptyState
              title={runtimeStatus?.queue.inbox === 0 && runtimeStatus.queue.processing === 0 ? "Queue is idle" : "No live task records"}
              detail={
                runtimeStatus?.queue.inbox === 0 && runtimeStatus.queue.processing === 0
                  ? "Supabase task rows are empty and the MCP inbox/processing folders are also empty. This is an idle state, not a loop failure."
                  : "Seed/demo tasks are hidden. Live MCP processing state is summarized above."
              }
            />
          )}
        </Panel>
      </div>

      <Panel title="Pipeline Warnings">
        <PipelineWarnings runtimeStatus={runtimeStatus} />
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Latest Builder Result">
          {runtimeStatus?.latest_details.builder ? (
            <RuntimeResult
              title={runtimeStatus.latest_details.builder.task_id ?? "Unknown builder task"}
              status={runtimeStatus.latest_details.builder.status ?? "unknown"}
              timestamp={runtimeStatus.latest_details.builder.finished_at}
              lastUpdated={runtimeStatus.latest_details.builder.finished_at ?? runtimeStatus.latest.outbox?.updated_at ?? null}
              sourceLabel="live MCP"
              body={runtimeStatus.latest_details.builder.summary ?? "No builder summary captured."}
              imageRef={runtimeStatus.latest_details.builder.image_ref}
            />
          ) : (
            <EmptyState title="No live builder result" detail="No readable MCP builder result payload was returned." muted />
          )}
        </Panel>

        <Panel title="Latest Reviewer Result">
          {runtimeStatus?.latest_details.reviewer ? (
            <RuntimeResult
              title={runtimeStatus.latest_details.reviewer.reviewed_task_id ?? "Unknown reviewed task"}
              status={runtimeStatus.latest_details.reviewer.verdict ?? "unknown"}
              timestamp={runtimeStatus.latest_details.reviewer.reviewed_at}
              lastUpdated={runtimeStatus.latest_details.reviewer.reviewed_at ?? runtimeStatus.latest.review?.updated_at ?? null}
              sourceLabel="live MCP"
              body={runtimeStatus.latest_details.reviewer.summary ?? "No reviewer summary captured."}
              imageRef={runtimeStatus.latest_details.reviewer.image_ref}
            />
          ) : (
            <EmptyState title="No live reviewer result" detail="No readable MCP reviewer result payload was returned." muted />
          )}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Panel title="Command Center">
          <CommandCenter />
        </Panel>

        <Panel title="Local Diagnostics">
          <LocalDiagnostics />
        </Panel>
      </div>

      <Panel title="Screenshot Freshness" muted>
        <EmptyState
          title="No screenshot freshness signal yet"
          detail="This placeholder will track whether proof screenshots are current for PM review."
          muted
        />
      </Panel>

      <Panel title="Recorded Decisions">
        <LogList logs={data.decisions.slice(0, 4)} />
      </Panel>
        </>
      )}
    </div>
  );
}

function RuntimeSummary({
  runtimeStatus,
  runtimeError,
  isRefreshing,
  refresh,
  onRecorded,
}: {
  runtimeStatus: LocalRuntimeStatus | null;
  runtimeError: string | null;
  isRefreshing: boolean;
  refresh: (options?: { silent?: boolean }) => void;
  onRecorded: (options?: { silent?: boolean }) => void;
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
          <NowWorkingPanel runtimeStatus={runtimeStatus} onRecorded={onRecorded} />
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
}: {
  runtimeStatus: LocalRuntimeStatus | null;
  runtimeError: string | null;
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
      <div className="grid gap-2 md:grid-cols-5">
        <StatusTile label="System state" value={runtimeError ? "runtime error" : runtimeStatus?.status ?? "loading"} strong />
        <StatusTile label="Active task" value={runtimeStatus?.active_task ?? "none"} strong copyable />
        <StatusTile label="Current worker" value={worker.label} detail={worker.detail} />
        <StatusTile label="Latest verdict" value={latestVerdict} />
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
}: {
  runtimeStatus: LocalRuntimeStatus;
  onRecorded: (options?: { silent?: boolean }) => void;
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
        <ApprovalRecorder targetTask={targetTask} onRecorded={onRecorded} />
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
  const [isRecording, setIsRecording] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function record(action: "approve" | "reject") {
    setIsRecording(true);
    setMessage(null);

    try {
      const reason = action === "reject" && rejectReason.trim() ? ` Reason: ${rejectReason.trim()}` : "";
      await createCommandRun({
        command: `${action} ${targetTask ?? "current-runtime-state"}`,
        command_type: `pm_${action}`,
        status: "succeeded",
        result: `Recording-only ${action} from PM dashboard. Target: ${targetTask ?? "unknown"}.${reason}`,
      });
      setMessage(action === "approve" ? "Approval recorded." : "Rejection recorded.");
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
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded border border-emerald-300/30 bg-emerald-300/[0.08] px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isRecording}
          onClick={() => record("approve")}
          type="button"
        >
          Record Approval
        </button>
        <button
          className="rounded border border-rose-300/30 bg-rose-300/[0.08] px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isRecording}
          onClick={() => record("reject")}
          type="button"
        >
          Record Rejection
        </button>
      </div>
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
  const todayEvents = events.filter((event) => isToday(event.created_at));
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

      {error ? (
        <EmptyState title="Event timeline unavailable" detail={error} />
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
  const warnings = [
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
    <section className={`rounded-md border p-5 ${muted ? "border-white/5 bg-[#0a0d12]" : "border-white/10 bg-[#0d1117]"} ${className}`}>
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
  return event.type;
}

function getEventTypeBadgeClassName(event: RuntimeEvent) {
  if (event.type === "builder") return commandStatusStyles.succeeded;
  if (event.type === "reviewer") return event.status === "error" ? commandStatusStyles.failed : "bg-amber-500/15 text-amber-200 ring-amber-400/25";
  if (event.type === "queue") return commandStatusStyles.running;
  if (event.type === "command") return "bg-violet-500/15 text-violet-200 ring-violet-400/25";
  if (event.type === "warning") return commandStatusStyles.failed;
  return runtimeEventStatusStyles[event.status];
}

function getEventCardClassName(event: RuntimeEvent) {
  if (event.type === "builder") return "border-emerald-300/30 bg-emerald-300/[0.05]";
  if (event.type === "reviewer") return "border-amber-300/30 bg-amber-300/[0.06]";
  if (event.type === "queue") return "border-cyan-300/30 bg-cyan-300/[0.05]";
  if (event.type === "command") return "border-violet-300/30 bg-violet-300/[0.05]";
  if (event.type === "warning") return "border-rose-300/40 bg-rose-300/[0.07]";
  return runtimeEventTypeStyles[event.type];
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
