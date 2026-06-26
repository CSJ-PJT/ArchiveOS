import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppData } from "../app/AppShell";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { MetricCard } from "../components/shared/MetricCard";
import {
  decidePmTask,
  getRpaTaskDetail,
  getRpaTasks,
  getSpringBatchExecution,
  getSpringBatchExecutions,
  getSpringBatchJobs,
  retryPmTask,
  runSpringBatchJob,
  type RpaTaskDetail,
  type RpaTaskRecord,
  type SpringBatchExecution,
  type SpringBatchJob,
} from "../lib/backendApi";
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
  const [batchJobs, setBatchJobs] = useState<SpringBatchJob[]>([]);
  const [batchExecutions, setBatchExecutions] = useState<SpringBatchExecution[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<SpringBatchExecution | null>(null);
  const [rpaTasks, setRpaTasks] = useState<RpaTaskRecord[]>([]);
  const [selectedRpaDetail, setSelectedRpaDetail] = useState<RpaTaskDetail | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState<string | null>(null);

  const loadBatchOperations = useCallback(async () => {
    try {
      setBatchError(null);
      const [jobs, executions, rpa] = await Promise.all([
        getSpringBatchJobs(),
        getSpringBatchExecutions(12),
        getRpaTasks(12),
      ]);
      setBatchJobs(jobs);
      setBatchExecutions(executions);
      setRpaTasks(rpa);
      if (!selectedExecution && executions[0]) {
        setSelectedExecution(executions[0]);
      }
      if (!selectedRpaDetail && rpa[0]) {
        const detail = await getRpaTaskDetail(rpa[0].id);
        setSelectedRpaDetail(detail);
      }
    } catch (error) {
      setBatchError(error instanceof Error ? error.message : String(error));
    }
  }, [selectedExecution, selectedRpaDetail]);

  useEffect(() => {
    loadBatchOperations();
  }, [loadBatchOperations]);

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
      await loadBatchOperations();
    } finally {
      setBusyAction(null);
    }
  }

  async function runJob(jobName: string) {
    setBatchBusy(jobName);
    try {
      const execution = await runSpringBatchJob(jobName);
      setSelectedExecution(await getSpringBatchExecution(execution.id));
      await loadBatchOperations();
    } finally {
      setBatchBusy(null);
    }
  }

  async function selectExecution(execution: SpringBatchExecution) {
    setSelectedExecution(await getSpringBatchExecution(execution.id));
  }

  async function selectRpaTask(task: RpaTaskRecord) {
    setSelectedRpaDetail(await getRpaTaskDetail(task.id));
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

      <section className="workflows-layout">
        <SectionCard
          title="Spring Batch Jobs"
          eyebrow="archiveos-ai job catalog + manual operations"
          action={
            <button className="button button-secondary" type="button" onClick={loadBatchOperations}>
              Refresh Batch
            </button>
          }
        >
          {batchError ? <div className="empty-state error-state">{batchError}</div> : null}
          <div className="batch-job-grid">
            {batchJobs.map((job) => (
              <article className="batch-job-card" key={job.name}>
                <div className="batch-job-header">
                  <div>
                    <strong>{job.name}</strong>
                    <p>{job.description}</p>
                  </div>
                  <StatusBadge status={job.manualRunAllowed ? "healthy" : "blocked"}>
                    {job.manualRunAllowed ? "manual run" : "dedicated flow"}
                  </StatusBadge>
                </div>
                <div className="button-row">
                  <button
                    className="button button-primary"
                    type="button"
                    disabled={!job.manualRunAllowed || batchBusy === job.name}
                    onClick={() => runJob(job.name)}
                  >
                    {batchBusy === job.name ? "Running..." : "Run Job"}
                  </button>
                </div>
                <div className="mini-execution-list">
                  {job.recentExecutions.length === 0 ? <span>No recent executions</span> : null}
                  {job.recentExecutions.slice(0, 3).map((execution) => (
                    <button type="button" key={execution.id} onClick={() => selectExecution(execution)}>
                      <span>#{execution.id}</span>
                      <StatusBadge status={execution.status}>{execution.status}</StatusBadge>
                      <small>{formatTimeAgo(execution.createTime)}</small>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Execution Detail" eyebrow="Spring Batch metadata">
          <BatchExecutionPanel
            executions={batchExecutions}
            selectedExecution={selectedExecution}
            onSelectExecution={selectExecution}
          />
        </SectionCard>
      </section>

      <section className="workflows-layout">
        <SectionCard title="RPA Decision History" eyebrow="PM approval records from archiveos-ai">
          <div className="workflow-list">
            {rpaTasks.length === 0 ? <div className="empty-state">No RPA tasks have been classified yet.</div> : null}
            {rpaTasks.map((task) => (
              <button
                className={`workflow-row ${selectedRpaDetail?.task.id === task.id ? "selected" : ""}`}
                key={task.id}
                type="button"
                onClick={() => selectRpaTask(task)}
              >
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.targetProject || "ArchiveOS"}</span>
                </div>
                <StatusBadge status={task.status}>{task.status}</StatusBadge>
                <span>{task.riskLevel || "unknown"}</span>
                <span>{formatTimeAgo(task.updatedAt)}</span>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="RPA Task Detail" eyebrow="Decision records only, no execution">
          {selectedRpaDetail ? <RpaDecisionHistory detail={selectedRpaDetail} /> : <div className="empty-state">Select an RPA task to inspect PM decision history.</div>}
        </SectionCard>
      </section>
    </div>
  );
}

function BatchExecutionPanel({
  executions,
  selectedExecution,
  onSelectExecution,
}: {
  executions: SpringBatchExecution[];
  selectedExecution: SpringBatchExecution | null;
  onSelectExecution: (execution: SpringBatchExecution) => void;
}) {
  return (
    <div className="detail-stack">
      <div className="execution-list">
        {executions.length === 0 ? <div className="empty-state">No Spring Batch executions have been recorded yet.</div> : null}
        {executions.map((execution) => (
          <button
            className={`execution-row ${selectedExecution?.id === execution.id ? "selected" : ""}`}
            key={execution.id}
            type="button"
            onClick={() => onSelectExecution(execution)}
          >
            <strong>#{execution.id}</strong>
            <span>{execution.jobName}</span>
            <StatusBadge status={execution.status}>{execution.status}</StatusBadge>
            <small>{formatTimeAgo(execution.createTime)}</small>
          </button>
        ))}
      </div>
      {selectedExecution ? (
        <>
          <div className="detail-grid">
            <div>
              <span>Job</span>
              <strong>{selectedExecution.jobName}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{selectedExecution.status}</strong>
            </div>
            <div>
              <span>Exit</span>
              <strong>{selectedExecution.exitCode}</strong>
            </div>
            <div>
              <span>Started</span>
              <strong>{formatTimeAgo(selectedExecution.startTime)}</strong>
            </div>
          </div>
          <details className="details-box" open>
            <summary>Step executions</summary>
            <div className="step-list">
              {(selectedExecution.steps || []).map((step) => (
                <div className="step-row" key={`${selectedExecution.id}-${step.stepName}`}>
                  <strong>{step.stepName}</strong>
                  <StatusBadge status={step.status}>{step.status}</StatusBadge>
                  <span>commit {step.commitCount}</span>
                  <span>rollback {step.rollbackCount}</span>
                </div>
              ))}
              {(selectedExecution.steps || []).length === 0 ? <div className="empty-state">Open an execution to load step details.</div> : null}
            </div>
          </details>
          <details className="details-box">
            <summary>Execution context</summary>
            <pre>{stringifyMeta(selectedExecution.executionContext)}</pre>
          </details>
        </>
      ) : null}
    </div>
  );
}

function RpaDecisionHistory({ detail }: { detail: RpaTaskDetail }) {
  return (
    <div className="detail-stack">
      <div className="detail-title">
        <div>
          <h3>{detail.task.title}</h3>
          <p>{detail.task.summary || detail.task.description}</p>
        </div>
        <StatusBadge status={detail.task.status}>{detail.task.status}</StatusBadge>
      </div>
      <div className="detail-grid">
        <div>
          <span>Risk</span>
          <strong>{detail.task.riskLevel || "unknown"}</strong>
        </div>
        <div>
          <span>Recommendation</span>
          <strong>{detail.task.recommendation || "none"}</strong>
        </div>
        <div>
          <span>Source</span>
          <strong>{detail.task.classificationSource || "unknown"}</strong>
        </div>
        <div>
          <span>Updated</span>
          <strong>{formatTimeAgo(detail.task.updatedAt)}</strong>
        </div>
      </div>
      <div className="decision-history-list">
        {detail.decisions.length === 0 ? <div className="empty-state">No PM decisions recorded for this RPA task yet.</div> : null}
        {detail.decisions.map((decision) => (
          <article className="decision-history-row" key={decision.id}>
            <div>
              <strong>{decision.action}</strong>
              <p>{decision.reason || "No reason recorded."}</p>
            </div>
            <div>
              <StatusBadge status={decision.nextStatus}>{decision.nextStatus}</StatusBadge>
              <small>{formatTimeAgo(decision.createdAt)}</small>
            </div>
          </article>
        ))}
      </div>
      <details className="details-box">
        <summary>RPA metadata</summary>
        <pre>{stringifyMeta(detail.task.metadata)}</pre>
      </details>
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
