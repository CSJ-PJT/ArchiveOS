import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import type { Agent, AgentStatus, LogType, Task, TaskStatus, WorkLog } from "./types/database";

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
              A compact command surface for agent status, task flow, work logs, and saved decisions.
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
  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="grid gap-5 sm:grid-cols-2">
        <MetricCard label="Active agents" value={activeAgents.length} detail={`${data.agents.length} total agents`} />
        <MetricCard
          label="Open tasks"
          value={data.tasks.filter((task) => !["done", "failed"].includes(task.status)).length}
          detail={`${data.tasks.length} total tasks`}
        />
        <Panel title="Agents" className="sm:col-span-2">
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
        </Panel>
        <Panel title="Tasks by status" className="sm:col-span-2">
          <div className="grid gap-3 sm:grid-cols-5">
            {taskCounts.map((item) => (
              <div key={item.status} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold text-white">{item.count}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5">
        <Panel title="Recent work logs">
          <LogList logs={data.logs} />
        </Panel>
        <Panel title="Recent decisions">
          <LogList logs={data.decisions.slice(0, 4)} />
        </Panel>
      </section>
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
    return <p className="text-sm text-slate-400">No work logs yet.</p>;
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

export default App;
