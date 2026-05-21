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
  className: string;
  dotClassName: string;
};

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
  working: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/25",
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

  const activeAgents = useMemo(
    () => data.agents.filter((agent) => ["working", "reviewing"].includes(agent.status)),
    [data.agents],
  );

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
          <Dashboard data={data} activeAgents={activeAgents} taskCounts={taskCounts} />
        ) : (
          <Decisions decisions={data.decisions} />
        )}
      </div>
    </main>
  );
}

function Dashboard({
  data,
  activeAgents,
  taskCounts,
}: {
  data: DashboardData;
  activeAgents: Agent[];
  taskCounts: { status: TaskStatus; label: string; count: number }[];
}) {
  const [runtimeStatus, setRuntimeStatus] = useState<LocalRuntimeStatus | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [runtimeEvents, setRuntimeEvents] = useState<RuntimeEvent[]>([]);
  const [runtimeEventsError, setRuntimeEventsError] = useState<string | null>(null);
  const [isRefreshingEvents, setIsRefreshingEvents] = useState(true);
  const [isRefreshingRuntime, setIsRefreshingRuntime] = useState(true);
  const runtimeAgents = getRuntimeAgents(runtimeStatus);
  const runtimeOpenTasks = runtimeStatus ? runtimeStatus.queue.inbox + runtimeStatus.queue.processing : 0;
  const bottleneck = getPipelineBottleneck(runtimeStatus);

  useEffect(() => {
    refreshRuntime();
    refreshRuntimeEvents();
    const timer = window.setInterval(() => {
      refreshRuntime({ silent: true });
      refreshRuntimeEvents({ silent: true });
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

  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="grid gap-5">
        <RuntimeSummary
          runtimeStatus={runtimeStatus}
          runtimeError={runtimeError}
          isRefreshing={isRefreshingRuntime}
          refresh={refreshRuntime}
        />

        <PipelineOverview runtimeStatus={runtimeStatus} runtimeError={runtimeError} />

        <EventTimeline
          events={runtimeEvents}
          error={runtimeEventsError}
          isRefreshing={isRefreshingEvents}
          refresh={refreshRuntimeEvents}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Active agents"
            value={activeAgents.length + runtimeAgents.length}
            detail={
              runtimeAgents.length
                ? `${runtimeAgents.length} local Codex processes detected`
                : data.agents.length
                  ? `${data.agents.length} live Supabase agents`
                  : "No live agent records"
            }
          />
          <MetricCard
            label="Open tasks"
            value={data.tasks.filter((task) => !["done", "failed"].includes(task.status)).length + runtimeOpenTasks}
            detail={
              runtimeOpenTasks
                ? `${runtimeOpenTasks} MCP queue task${runtimeOpenTasks === 1 ? "" : "s"}`
                : data.tasks.length
                  ? `${data.tasks.length} live Supabase tasks`
                  : "No live task records"
            }
          />
          <MetricCard
            label="Bottleneck"
            value={bottleneck.severity}
            detail={bottleneck.label}
          />
        </div>

        <Panel title="Agent State">
          {data.agents.length || runtimeAgents.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {runtimeAgents.map((agent) => (
                <article key={agent.id} className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.04] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-white">{agent.name}</h3>
                      <p className="mt-1 text-sm text-slate-400">{agent.role}</p>
                    </div>
                    <StatusBadge className={agentStatusStyles[agent.status]}>{agent.status}</StatusBadge>
                  </div>
                  <p className="mt-4 min-h-10 text-sm leading-5 text-slate-300">{agent.current_task}</p>
                </article>
              ))}
              {data.agents.map((agent) => (
                <article key={agent.id} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-white">{agent.name}</h3>
                      <p className="mt-1 text-sm text-slate-400">{agent.role}</p>
                    </div>
                    <StatusBadge className={agentStatusStyles[agent.status]}>{agent.status}</StatusBadge>
                  </div>
                  <p className="mt-4 min-h-10 text-sm leading-5 text-slate-300">
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
          {data.tasks.length ? (
            <div className="grid gap-3 sm:grid-cols-5">
              {taskCounts.map((item) => (
                <div key={item.status} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{item.count}</p>
                </div>
              ))}
            </div>
          ) : runtimeStatus && (runtimeStatus.queue.inbox > 0 || runtimeStatus.queue.processing > 0) ? (
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <RuntimeMetric label="Inbox" value={String(runtimeStatus.queue.inbox)} />
                <RuntimeMetric label="Processing" value={String(runtimeStatus.queue.processing)} />
                <RuntimeMetric label="Active MCP task" value={runtimeStatus.active_task ?? "none"} />
              </div>
              <p className="rounded border border-cyan-300/20 bg-cyan-300/[0.04] p-3 text-xs leading-5 text-cyan-100">
                Supabase task rows are empty, so this panel is showing the live MCP queue task state.
              </p>
            </div>
          ) : (
            <EmptyState
              title="No live task records"
              detail="Seed/demo tasks are hidden. Live MCP processing state is shown in the queue panel above."
            />
          )}
        </Panel>

        <Panel title="Command Center">
          <CommandCenter />
        </Panel>
      </section>

      <section className="grid gap-5">
        <Panel title="Latest Builder Result">
          {runtimeStatus?.latest_details.builder ? (
            <RuntimeResult
              title={runtimeStatus.latest_details.builder.task_id ?? "Unknown builder task"}
              status={runtimeStatus.latest_details.builder.status ?? "unknown"}
              timestamp={runtimeStatus.latest_details.builder.finished_at}
              body={runtimeStatus.latest_details.builder.summary ?? "No builder summary captured."}
            />
          ) : (
            <EmptyState title="No live builder result" detail="No readable MCP builder result payload was returned." />
          )}
        </Panel>

        <Panel title="Latest Reviewer Result">
          {runtimeStatus?.latest_details.reviewer ? (
            <RuntimeResult
              title={runtimeStatus.latest_details.reviewer.reviewed_task_id ?? "Unknown reviewed task"}
              status={runtimeStatus.latest_details.reviewer.verdict ?? "unknown"}
              timestamp={runtimeStatus.latest_details.reviewer.reviewed_at}
              body={runtimeStatus.latest_details.reviewer.summary ?? "No reviewer summary captured."}
            />
          ) : (
            <EmptyState title="No live reviewer result" detail="No readable MCP reviewer result payload was returned." />
          )}
        </Panel>

        <Panel title="Recorded Decisions">
          <LogList logs={data.decisions.slice(0, 4)} />
        </Panel>

        <Panel title="Pipeline Warnings">
          <PipelineWarnings runtimeStatus={runtimeStatus} />
        </Panel>

        <Panel title="Screenshot Freshness">
          <EmptyState
            title="No screenshot freshness signal yet"
            detail="This placeholder will track whether proof screenshots are current for PM review."
          />
        </Panel>
      </section>
    </div>
  );
}

function RuntimeSummary({
  runtimeStatus,
  runtimeError,
  isRefreshing,
  refresh,
}: {
  runtimeStatus: LocalRuntimeStatus | null;
  runtimeError: string | null;
  isRefreshing: boolean;
  refresh: (options?: { silent?: boolean }) => void;
}) {
  return (
    <section className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Live MCP Queue</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Current Workflow State</h2>
        </div>
        <button
          className="rounded border border-cyan-300/30 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isRefreshing}
          onClick={() => refresh()}
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
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
            <span className="text-xs text-slate-500">checked {formatDate(runtimeStatus.checked_at)}</span>
            <span className="text-xs text-slate-500">{runtimeStatus.queue.path ? "queue connected" : "queue not configured"}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <RuntimeMetric label="Inbox" value={String(runtimeStatus.queue.inbox)} />
            <RuntimeMetric label="Processing" value={String(runtimeStatus.queue.processing)} />
            <RuntimeMetric label="Outbox" value={String(runtimeStatus.queue.outbox)} />
            <RuntimeMetric label="Reviews" value={String(runtimeStatus.queue.reviews)} />
          </div>
          <div className="grid gap-2 lg:grid-cols-3">
            <RuntimeMetric label="Active task" value={runtimeStatus.active_task ?? "none"} />
            <RuntimeMetric label="Latest result" value={runtimeStatus.latest.outbox?.name ?? "none"} />
            <RuntimeMetric label="Latest review" value={runtimeStatus.latest.review?.name ?? "none"} />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <RuntimeDetailCard
              title="Actual Latest Builder Result"
              meta={[
                runtimeStatus.latest_details.builder?.status
                  ? `status=${runtimeStatus.latest_details.builder.status}`
                  : null,
                runtimeStatus.latest_details.builder?.exit_code != null
                  ? `exit=${runtimeStatus.latest_details.builder?.exit_code}`
                  : null,
                runtimeStatus.latest_details.builder?.finished_at
                  ? formatDate(runtimeStatus.latest_details.builder.finished_at)
                  : null,
              ]}
              body={runtimeStatus.latest_details.builder?.summary ?? "No readable builder result payload."}
            />
            <RuntimeDetailCard
              title="Actual Latest Reviewer Result"
              meta={[
                runtimeStatus.latest_details.reviewer?.verdict
                  ? `verdict=${runtimeStatus.latest_details.reviewer.verdict}`
                  : null,
                runtimeStatus.latest_details.reviewer?.reviewed_at
                  ? formatDate(runtimeStatus.latest_details.reviewer.reviewed_at)
                  : null,
                runtimeStatus.latest_details.reviewer?.next_task_id
                  ? `next=${runtimeStatus.latest_details.reviewer.next_task_id}`
                  : null,
              ]}
              body={runtimeStatus.latest_details.reviewer?.summary ?? "No readable reviewer result payload."}
            />
          </div>
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

function PipelineOverview({
  runtimeStatus,
  runtimeError,
}: {
  runtimeStatus: LocalRuntimeStatus | null;
  runtimeError: string | null;
}) {
  const stages = getPipelineStages(runtimeStatus);
  const bottleneck = getPipelineBottleneck(runtimeStatus);

  return (
    <Panel title="Live Pipeline Map" className="overflow-hidden">
      {runtimeError ? (
        <EmptyState title="Pipeline offline" detail={runtimeError} />
      ) : runtimeStatus ? (
        <div className="grid gap-5">
          <div className="rounded-md border border-cyan-300/20 bg-[#07121d] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
                  Runtime Flow
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  PM queue to builder, reviewer, and next decision.
                </p>
              </div>
              <StatusBadge className={bottleneck.className}>{bottleneck.label}</StatusBadge>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
              {stages.map((stage, index) => (
                <div key={stage.id} className="contents">
                  <PipelineNode stage={stage} />
                  {index < stages.length - 1 ? <PipelineConnector active={stage.active} /> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <RuntimeMetric label="Input backlog" value={`${runtimeStatus.queue.inbox} inbox`} />
            <RuntimeMetric label="Active work" value={`${runtimeStatus.queue.processing} processing`} />
            <RuntimeMetric label="Builder results" value={`${runtimeStatus.queue.outbox} outbox`} />
            <RuntimeMetric label="Reviewer results" value={`${runtimeStatus.queue.reviews} reviews`} />
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
      ) : events.length ? (
        <div className="relative grid gap-3">
          <div className="absolute bottom-3 left-[5.5rem] top-3 hidden w-px bg-white/10 sm:block" />
          {events.map((event) => (
            <article
              key={event.id}
              className={`relative grid gap-3 rounded-md border p-3 sm:grid-cols-[4.75rem_1fr] ${runtimeEventTypeStyles[event.type]}`}
            >
              <time className="text-xs leading-5 text-slate-500">{formatTime(event.created_at)}</time>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge>{event.type}</StatusBadge>
                  <StatusBadge className={runtimeEventStatusStyles[event.status]}>{event.status}</StatusBadge>
                  <span className="rounded bg-black/20 px-2 py-1 text-xs text-slate-400">{event.source}</span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-white">{event.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{event.description}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No runtime events yet" detail="No MCP, Supabase, or backend runtime events were derived." />
      )}
    </Panel>
  );
}

function PipelineNode({ stage }: { stage: PipelineStage }) {
  return (
    <article className={`min-h-36 rounded-md border p-3 ${stage.className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{stage.kicker}</p>
          <h3 className="mt-2 text-sm font-semibold text-white">{stage.label}</h3>
        </div>
        <span className={`h-3 w-3 rounded-full ${stage.dotClassName}`} />
      </div>
      <p className="mt-4 text-3xl font-semibold text-white">{stage.value}</p>
      <p className="mt-3 min-h-10 text-xs leading-5 text-slate-400">{stage.detail}</p>
    </article>
  );
}

function PipelineConnector({ active }: { active: boolean }) {
  return (
    <div className="hidden min-w-8 items-center lg:flex" aria-hidden="true">
      <div className={`h-px w-full ${active ? "bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.7)]" : "bg-white/10"}`} />
    </div>
  );
}

function CommandCenter() {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<CommandRun[]>([]);
  const [projects, setProjects] = useState<LocalActionProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("archiveos");
  const [localActionResult, setLocalActionResult] = useState<LocalActionResult | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<LocalRuntimeStatus | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [health, setHealth] = useState<"checking" | "online" | "offline">("checking");
  const [commandError, setCommandError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunningLocalAction, setIsRunningLocalAction] = useState(false);
  const [isRefreshingRuntime, setIsRefreshingRuntime] = useState(false);

  useEffect(() => {
    refreshHealth();
    refreshHistory();
    refreshProjects();
    refreshRuntimeStatus();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshRuntimeStatus({ silent: true });
    }, 5000);

    return () => window.clearInterval(timer);
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

  async function refreshProjects() {
    try {
      const configuredProjects = await getLocalActionProjects();
      setProjects(configuredProjects);
      setSelectedProjectId(configuredProjects[0]?.id ?? "archiveos");
    } catch {
      setCommandError("Could not load local action projects.");
    }
  }

  async function refreshRuntimeStatus(options: { silent?: boolean } = {}) {
    if (!options.silent) {
      setIsRefreshingRuntime(true);
    }
    setRuntimeError(null);

    try {
      const status = await getLocalRuntimeStatus();
      setRuntimeStatus((previous) => {
        if (previous && hasRuntimeChanged(previous, status)) {
          refreshHistory();
        }

        return status;
      });
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : "Could not load local runtime status.");
    } finally {
      if (!options.silent) {
        setIsRefreshingRuntime(false);
      }
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

  async function submitLocalAction(action: LocalAction) {
    setIsRunningLocalAction(true);
    setCommandError(null);
    setLocalActionResult(null);

    try {
      const result = await runLocalAction({
        project_id: selectedProjectId,
        action,
      });
      setLocalActionResult(result);
      await refreshHistory();
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : "Local action request failed.");
    } finally {
      setIsRunningLocalAction(false);
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

      <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-300">Current Workflow State</h3>
            <p className="mt-1 text-xs text-slate-500">Read-only local loop snapshot, auto-refreshes every 5 seconds</p>
          </div>
          <button
            className="rounded border border-white/10 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-cyan-300/50 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isRefreshingRuntime}
            onClick={() => refreshRuntimeStatus()}
          >
            {isRefreshingRuntime ? "Refreshing..." : "Refresh Runtime"}
          </button>
        </div>

        {runtimeError ? (
          <p className="rounded border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">
            {runtimeError}
          </p>
        ) : runtimeStatus ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge className={runtimeStatusStyles[runtimeStatus.status]}>
                {runtimeStatus.status}
              </StatusBadge>
              <span className="text-xs text-slate-500">checked {formatDate(runtimeStatus.checked_at)}</span>
              <span className="text-xs text-slate-600">auto refresh on</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-5">
              <RuntimeMetric
                label="Queue"
                value={`inbox=${runtimeStatus.queue.inbox} / processing=${runtimeStatus.queue.processing}`}
              />
              <RuntimeMetric
                label="Results"
                value={`outbox=${runtimeStatus.queue.outbox} / reviews=${runtimeStatus.queue.reviews}`}
              />
              <RuntimeMetric label="Task" value={runtimeStatus.active_task ?? "none"} />
              <RuntimeMetric label="Outbox" value={runtimeStatus.latest.outbox?.name ?? "none"} />
              <RuntimeMetric label="Review" value={runtimeStatus.latest.review?.name ?? "none"} />
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <RuntimeMetric
                label="Implementer"
                value={formatProcess(runtimeStatus.processes.implementer, true)}
              />
              <RuntimeMetric
                label="Reviewer Codex"
                value={formatProcess(runtimeStatus.processes.reviewer, true)}
              />
              <RuntimeMetric label="Loop" value={formatProcess(runtimeStatus.processes.loop)} />
              <RuntimeMetric
                label="Reviewer bridge"
                value={formatProcess(runtimeStatus.processes.reviewer_bridge)}
              />
            </div>
            <p className="rounded border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-400">
              {runtimeStatus.judgement}
            </p>
          </div>
        ) : (
          <EmptyState
            title={isRefreshingRuntime ? "Loading local workflow state" : "No local workflow state loaded"}
            detail={
              isRefreshingRuntime
                ? "Reading backend runtime status and MCP queue files."
                : "Start the backend and refresh runtime status."
            }
          />
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-300">Local Diagnostics</h3>
            <p className="mt-1 text-xs text-slate-500">
              Allowlisted project checks only. No arbitrary shell input is accepted.
            </p>
          </div>
          <select
            className="rounded border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-200 outline-none"
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
              <option value="archiveos">No local project configured</option>
            )}
          </select>
        </div>

        {projects.length ? (
          <div className="mb-3 rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
            {projects.map((project) => (
              <p key={project.id}>
                {project.name} / {project.repo}
              </p>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No local project configured"
            detail="The backend did not return an allowlisted project registry."
          />
        )}

        {projects.length ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {localActionButtons.map((item) => (
              <button
                key={item.action}
                className="rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-300/50 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isRunningLocalAction}
                onClick={() => submitLocalAction(item.action)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}

        {localActionResult ? (
          <div className="mt-3 rounded-md border border-white/10 bg-black/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-white">{localActionResult.action}</p>
              <StatusBadge className={commandStatusStyles[localActionResult.status]}>
                {localActionResult.status}
              </StatusBadge>
            </div>
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-3 text-xs leading-5 text-slate-300">
              {[localActionResult.stdout, localActionResult.stderr].filter(Boolean).join("\n\n") ||
                `Exit code ${localActionResult.exitCode}`}
            </pre>
          </div>
        ) : null}
      </div>

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
  body,
}: {
  title: string;
  status: string;
  timestamp: string | null;
  body: string;
}) {
  return (
    <article className="rounded-md border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-white" title={title}>
            {title}
          </h3>
          {timestamp ? <p className="mt-1 text-xs text-slate-500">{formatDate(timestamp)}</p> : null}
        </div>
        <StatusBadge className={status === "done" ? commandStatusStyles.succeeded : status === "stop" ? commandStatusStyles.pending : commandStatusStyles.running}>
          {status}
        </StatusBadge>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-300">{body}</p>
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
      ? "Reviewer verdict is stop and inbox is empty. PM must queue the next task."
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

function MetricCard({ label, value, detail }: { label: string; value: React.ReactNode; detail: string }) {
  return (
    <article className="rounded-md border border-white/10 bg-white/[0.04] p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-4xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </article>
  );
}

function RuntimeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-black/20 p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 truncate text-sm font-medium text-slate-200" title={value}>
        {value}
      </p>
    </div>
  );
}

function RuntimeDetailCard({ title, meta, body }: { title: string; meta: (string | null)[]; body: string }) {
  const visibleMeta = meta.filter(Boolean);

  return (
    <article className="rounded-md border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{title}</h3>
        {visibleMeta.map((item) => (
          <span key={item} className="rounded bg-white/[0.06] px-2 py-1 text-[11px] text-slate-300">
            {item}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-300">{body}</p>
    </article>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-md border border-dashed border-white/10 bg-black/10 p-4">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{detail}</p>
    </div>
  );
}

function Panel({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-md border border-white/10 bg-[#0d1117] p-5 ${className}`}>
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

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatProcess(processItem: LocalRuntimeStatus["processes"]["implementer"], includeCpu = false) {
  if (!processItem) {
    return "not detected";
  }

  const cpu = includeCpu && processItem.cpu !== null ? ` / CPU ${processItem.cpu.toFixed(1)}` : "";
  return `PID ${processItem.pid}${cpu}`;
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
      className: inactive,
      dotClassName: "bg-slate-500",
    }));
  }

  const reviewerVerdict = runtimeStatus.latest_details.reviewer?.verdict ?? "none";
  const hasPendingInput = runtimeStatus.queue.inbox > 0;
  const hasProcessing = runtimeStatus.queue.processing > 0;
  const reviewerStopped = reviewerVerdict === "stop";
  const resultNewerThanReview =
    runtimeStatus.latest.outbox?.updated_at &&
    runtimeStatus.latest.review?.updated_at &&
    runtimeStatus.latest.outbox.updated_at > runtimeStatus.latest.review.updated_at;

  return [
    {
      id: "input",
      kicker: "Queue",
      label: "Inbox",
      value: String(runtimeStatus.queue.inbox),
      detail: hasPendingInput ? "Queued work is waiting for the loop." : "No queued input.",
      active: hasPendingInput,
      className: hasPendingInput ? warning : inactive,
      dotClassName: hasPendingInput ? "bg-amber-300" : "bg-slate-500",
    },
    {
      id: "loop",
      kicker: "Runner",
      label: "Loop",
      value: runtimeStatus.processes.loop ? "on" : "off",
      detail: runtimeStatus.processes.loop
        ? `PID ${runtimeStatus.processes.loop.pid}`
        : "Loop process not detected.",
      active: Boolean(runtimeStatus.processes.loop),
      className: runtimeStatus.processes.loop ? live : stopped,
      dotClassName: runtimeStatus.processes.loop ? "bg-cyan-300" : "bg-rose-300",
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
      className: hasProcessing ? live : runtimeStatus.processes.implementer ? inactive : stopped,
      dotClassName: hasProcessing ? "bg-cyan-300" : runtimeStatus.processes.implementer ? "bg-slate-400" : "bg-rose-300",
    },
    {
      id: "result",
      kicker: "Output",
      label: "Outbox",
      value: String(runtimeStatus.queue.outbox),
      detail: runtimeStatus.latest.outbox?.name ?? "No builder result.",
      active: Boolean(runtimeStatus.latest.outbox),
      className: runtimeStatus.latest_details.builder?.status === "done" ? success : inactive,
      dotClassName: runtimeStatus.latest_details.builder?.status === "done" ? "bg-emerald-300" : "bg-slate-500",
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
      className: resultNewerThanReview ? warning : runtimeStatus.processes.reviewer_bridge || runtimeStatus.processes.reviewer ? live : stopped,
      dotClassName: resultNewerThanReview ? "bg-amber-300" : runtimeStatus.processes.reviewer_bridge || runtimeStatus.processes.reviewer ? "bg-cyan-300" : "bg-rose-300",
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
      className: reviewerStopped ? stopped : runtimeStatus.latest_details.reviewer?.next_task_id ? success : inactive,
      dotClassName: reviewerStopped ? "bg-rose-300" : runtimeStatus.latest_details.reviewer?.next_task_id ? "bg-emerald-300" : "bg-slate-500",
    },
  ];
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
    detail: "Inbox and processing are empty. The loop and agents are visible, but no task is currently moving.",
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
