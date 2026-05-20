import { useEffect, useMemo, useState } from "react";
import {
  createCommandRun,
  getBackendHealth,
  getLocalActionProjects,
  getLocalRuntimeStatus,
  getRecentCommands,
  runLocalAction,
  type LocalAction,
  type LocalActionProject,
  type LocalActionResult,
  type LocalRuntimeStatus,
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
        setData({
          agents: agentsResult.data ?? [],
          tasks: (tasksResult.data ?? []) as Task[],
          logs: (logsResult.data ?? []) as WorkLog[],
          decisions: (decisionsResult.data ?? []) as WorkLog[],
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
  const latestBuilderResult = data.logs.find((log) => log.log_type === "summary" || log.log_type === "error");
  const latestReviewerResult = data.logs.find((log) => log.log_type === "review");

  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="grid gap-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Active agents" value={activeAgents.length} detail={`${data.agents.length} total agents`} />
          <MetricCard
            label="Open tasks"
            value={data.tasks.filter((task) => !["done", "failed"].includes(task.status)).length}
            detail={`${data.tasks.length} total tasks`}
          />
          <MetricCard
            label="Decisions"
            value={data.decisions.length}
            detail={data.decisions.length ? "saved PM memory" : "No data yet"}
          />
        </div>

        <Panel title="Agent State">
          {data.agents.length ? (
            <div className="grid gap-3 md:grid-cols-2">
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
              title="No data yet"
              detail="No agents were returned. Load Supabase seed data or check the frontend Supabase environment."
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
          ) : (
            <EmptyState
              title="Supabase seed not loaded"
              detail="No tasks were returned. Run the schema and seed SQL before using this as an operations view."
            />
          )}
        </Panel>

        <Panel title="Command Center">
          <CommandCenter />
        </Panel>
      </section>

      <section className="grid gap-5">
        <Panel title="Latest Builder Result">
          {latestBuilderResult ? (
            <LogItem log={latestBuilderResult} />
          ) : (
            <EmptyState title="No builder result yet" detail="Waiting for a recorded summary or error work log." />
          )}
        </Panel>

        <Panel title="Latest Reviewer Result">
          {latestReviewerResult ? (
            <LogItem log={latestReviewerResult} />
          ) : (
            <EmptyState title="No reviewer result yet" detail="Waiting for a recorded review work log." />
          )}
        </Panel>

        <Panel title="Latest Decisions">
          <LogList logs={data.decisions.slice(0, 4)} />
        </Panel>

        <Panel title="Stale/Stuck Warnings">
          <EmptyState
            title="No warning rules connected yet"
            detail="This placeholder will summarize stale processing, missing reviews, and stuck queues later."
          />
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
      setHistory(commands);
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
            These buttons only record mock command intent unless marked as a read-only check.
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
          placeholder="Type a command to record, e.g. review latest PR"
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
            <div className="grid gap-2 sm:grid-cols-4">
              <RuntimeMetric label="Queue" value={`processing=${runtimeStatus.queue.processing}`} />
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
            <EmptyState title="No local workflow state loaded" detail="Start the backend and refresh runtime status." />
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
            title="No recent commands"
            detail="Recorded PM commands and mock action requests will appear here."
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
          <p className="text-sm text-slate-400">No saved decisions yet.</p>
        )}
      </div>
    </Panel>
  );
}
function MetricCard({ label, value, detail }: { label: string; value: number; detail: string }) {
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
    return <EmptyState title="No data yet" detail="No matching work logs were returned from Supabase." />;
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

function formatProcess(processItem: LocalRuntimeStatus["processes"]["implementer"], includeCpu = false) {
  if (!processItem) {
    return "not detected";
  }

  const cpu = includeCpu && processItem.cpu !== null ? ` / CPU ${processItem.cpu.toFixed(1)}` : "";
  return `PID ${processItem.pid}${cpu}`;
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
