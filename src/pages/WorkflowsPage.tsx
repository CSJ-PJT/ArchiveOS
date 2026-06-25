import { useMemo, useState } from "react";
import type { AppData } from "../app/AppShell";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { MetricCard } from "../components/shared/MetricCard";
import { decidePmTask, retryPmTask } from "../lib/backendApi";
import type { PmDecisionAction, PmTask, PmTaskStatus } from "../types/database";
import { formatTimeAgo, stringifyMeta } from "./pageUtils";

type WorkflowFilter = "all" | "running" | "waiting" | "review" | "approval" | "failed" | "completed";

const filters: WorkflowFilter[] = ["all", "running", "waiting", "review", "approval", "failed", "completed"];

function matchesFilter(task: PmTask, filter: WorkflowFilter) {
  if (filter === "all") return true;
  if (filter === "running") return ["architect_review", "ready_for_build", "building"].includes(task.status);
  if (filter === "waiting") return ["queued", "hold"].includes(task.status);
  if (filter === "review") return task.status === "review";
  if (filter === "approval") return task.status === "pm_decision_required";
  if (filter === "failed") return ["failed", "rejected"].includes(task.status);
  return ["approved", "done"].includes(task.status);
}

function getOwner(task: PmTask) {
  if (task.status === "architect_review") return "Architect";
  if (["ready_for_build", "building"].includes(task.status)) return "Builder";
  if (task.status === "review") return "Reviewer";
  if (task.status === "pm_decision_required") return "Human PM";
  return "Queue";
}

export function WorkflowsPage({ data, onRefresh }: { data: AppData; onRefresh: () => void }) {
  const [filter, setFilter] = useState<WorkflowFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const filteredTasks = useMemo(() => data.tasks.filter((task) => matchesFilter(task, filter)), [data.tasks, filter]);
  const selectedTask = data.tasks.find((task) => task.id === selectedId) || filteredTasks[0] || null;
  const summary = {
    running: data.tasks.filter((task) => matchesFilter(task, "running")).length,
    waiting: data.tasks.filter((task) => matchesFilter(task, "waiting")).length,
    review: data.tasks.filter((task) => matchesFilter(task, "review")).length,
    approval: data.tasks.filter((task) => matchesFilter(task, "approval")).length,
    failed: data.tasks.filter((task) => matchesFilter(task, "failed")).length,
  };

  async function applyDecision(action: PmDecisionAction) {
    if (!selectedTask) return;
    if (action === "reject" && !reason.trim()) {
      setReason("Reject requires a reason.");
      return;
    }
    setBusyAction(action);
    try {
      if (action === "retry") {
        await retryPmTask(selectedTask.id, reason.trim() || null);
      } else {
        await decidePmTask(selectedTask.id, { action, reason: reason.trim() || null });
      }
      setReason("");
      await onRefresh();
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="page-stack">
      <section className="summary-strip">
        <MetricCard label="Running" value={summary.running} status={summary.running > 0 ? "working" : "idle"} />
        <MetricCard label="Waiting" value={summary.waiting} status={summary.waiting > 0 ? "waiting" : "idle"} />
        <MetricCard label="Review" value={summary.review} status={summary.review > 0 ? "working" : "idle"} />
        <MetricCard label="Approval Required" value={summary.approval} status={summary.approval > 0 ? "blocked" : "healthy"} />
        <MetricCard label="Failed" value={summary.failed} status={summary.failed > 0 ? "critical" : "healthy"} />
      </section>

      <section className="workflows-layout">
        <SectionCard title="Workflow Queue" eyebrow="Queue + pipeline + PM decisions">
          <div className="filter-row">
            {filters.map((item) => (
              <button className={`chip ${filter === item ? "active" : ""}`} key={item} type="button" onClick={() => setFilter(item)}>
                {item}
              </button>
            ))}
          </div>
          <div className="workflow-list">
            {filteredTasks.length === 0 ? <div className="empty-state">No workflows match this filter.</div> : null}
            {filteredTasks.map((task) => (
              <button
                className={`workflow-row ${selectedTask?.id === task.id ? "selected" : ""}`}
                key={task.id}
                type="button"
                onClick={() => setSelectedId(task.id)}
              >
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.target_project}</span>
                </div>
                <StatusBadge status={task.status}>{task.status}</StatusBadge>
                <span>{getOwner(task)}</span>
                <span>{formatTimeAgo(task.updated_at)}</span>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Workflow Detail" eyebrow="Human action is recorded only">
          {selectedTask ? (
            <WorkflowDetail
              task={selectedTask}
              reason={reason}
              setReason={setReason}
              busyAction={busyAction}
              onDecision={applyDecision}
            />
          ) : (
            <div className="empty-state">Select a workflow to inspect its chain and PM decision state.</div>
          )}
        </SectionCard>
      </section>
    </div>
  );
}

function WorkflowDetail({
  task,
  reason,
  setReason,
  busyAction,
  onDecision,
}: {
  task: PmTask;
  reason: string;
  setReason: (value: string) => void;
  busyAction: string | null;
  onDecision: (action: PmDecisionAction) => void;
}) {
  const flow: Array<[string, PmTaskStatus[]]> = [
    ["Queue", ["queued"]],
    ["Architect", ["architect_review"]],
    ["Builder", ["ready_for_build", "building"]],
    ["Reviewer", ["review"]],
    ["PM Decision", ["pm_decision_required"]],
    ["Done", ["approved", "done"]],
  ];

  return (
    <div className="detail-stack">
      <div className="detail-title">
        <div>
          <h3>{task.title}</h3>
          <p>{task.description}</p>
        </div>
        <StatusBadge status={task.status}>{task.status}</StatusBadge>
      </div>
      <div className="runtime-flow compact-flow">
        {flow.map(([label, statuses]) => (
          <div className={`runtime-stage ${statuses.includes(task.status) ? "runtime-running" : "runtime-idle"}`} key={label}>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="detail-grid">
        <div>
          <span>Priority</span>
          <strong>{task.priority}</strong>
        </div>
        <div>
          <span>Iteration</span>
          <strong>
            {task.current_iteration}/{task.max_iterations}
          </strong>
        </div>
        <div>
          <span>Owner</span>
          <strong>{getOwner(task)}</strong>
        </div>
        <div>
          <span>Updated</span>
          <strong>{formatTimeAgo(task.updated_at)}</strong>
        </div>
      </div>
      <details className="details-box">
        <summary>Architecture review / reviewer verdict metadata</summary>
        <pre>{stringifyMeta(task.metadata)}</pre>
      </details>
      <div className="decision-panel">
        <p>
          This records a PM decision and updates ArchiveOS task state. It does not directly execute Codex, MCP, shell,
          deployment, or process control.
        </p>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Decision reason or retry note" />
        <div className="button-row">
          {(["approve", "reject", "hold", "retry"] as PmDecisionAction[]).map((action) => (
            <button className={`button ${action === "approve" ? "button-primary" : "button-secondary"}`} key={action} type="button" onClick={() => onDecision(action)} disabled={Boolean(busyAction)}>
              {busyAction === action ? "Recording..." : action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
