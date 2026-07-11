import { useMemo, useState } from "react";
import type { AppData } from "../app/AppShell";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { MetricCard } from "../components/shared/MetricCard";
import { createPmTask, decidePmTask, retryPmTask } from "../lib/backendApi";
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
  if (task.status === "architect_review") return "설계 검토";
  if (["ready_for_build", "building"].includes(task.status)) return "구현";
  if (task.status === "review") return "리뷰";
  if (task.status === "pm_decision_required") return "PM";
  return "큐";
}

export function WorkflowsPage({ data, onRefresh }: { data: AppData; onRefresh: () => void }) {
  const [filter, setFilter] = useState<WorkflowFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [newTitle, setNewTitle] = useState("Archive 공정 파이프라인 점검");
  const [newDescription, setNewDescription] = useState("PM이 확인 가능한 작업 항목으로 Archive Platform 제어 파이프라인을 점검합니다. 위험 작업 전 Nexus, Logistics, Ledger, MCP/RPA, RAG, 승인 게이트를 확인합니다.");
  const [newTarget, setNewTarget] = useState("Archive Platform");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const canDecide = data.auth.role === "PM" || data.auth.role === "ADMIN";
  const canCreate = data.auth.role === "ADMIN";

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

  async function createInstruction() {
    if (!newTitle.trim() || !newDescription.trim()) return;
    setBusyAction("create");
    try {
      const task = await createPmTask({
        title: newTitle.trim(),
        description: newDescription.trim(),
        target_project: newTarget.trim() || "Archive Platform",
        priority: "high",
        max_iterations: 3,
      });
      setSelectedId(task.id);
      await onRefresh();
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="page-stack">
      <section className="summary-strip">
        <MetricCard label="진행 중" value={summary.running} status={summary.running > 0 ? "working" : "idle"} />
        <MetricCard label="대기" value={summary.waiting} status={summary.waiting > 0 ? "waiting" : "idle"} />
        <MetricCard label="검토" value={summary.review} status={summary.review > 0 ? "working" : "idle"} />
        <MetricCard label="승인 필요" value={summary.approval} status={summary.approval > 0 ? "blocked" : "healthy"} />
        <MetricCard label="실패" value={summary.failed} status={summary.failed > 0 ? "critical" : "healthy"} />
      </section>

      <SectionCard title="PM 작업 지시" eyebrow="CONTROL TOWER COMMAND INTAKE">
        <div className="form-stack">
          <label>
            <span>제목</span>
            <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
          </label>
          <label>
            <span>대상</span>
            <input value={newTarget} onChange={(event) => setNewTarget(event.target.value)} />
          </label>
          <label>
            <span>작업 지시</span>
            <textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} />
          </label>
          <p className="small-note">
            감사 가능한 PM 작업 항목만 생성합니다. shell, 배포, MCP, 외부 쓰기를 직접 실행하지 않습니다.
          </p>
          <button className="button button-primary" type="button" disabled={!canCreate || Boolean(busyAction)} onClick={() => void createInstruction()}>
            {busyAction === "create" ? "생성 중..." : "작업 지시 생성"}
          </button>
          {!canCreate ? <p className="small-note">새 작업 지시를 만들려면 관리자 권한이 필요합니다.</p> : null}
        </div>
      </SectionCard>

      <section className="workflows-layout">
        <SectionCard title="작업 흐름 큐" eyebrow="QUEUE + PIPELINE + PM DECISIONS">
          <div className="filter-row">
            {filters.map((item) => (
              <button className={`chip ${filter === item ? "active" : ""}`} key={item} type="button" onClick={() => setFilter(item)}>
                {item}
              </button>
            ))}
          </div>
          <div className="workflow-list">
            {filteredTasks.length === 0 ? <div className="empty-state">현재 필터에 맞는 작업 흐름이 없습니다.</div> : null}
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

        <SectionCard title="작업 흐름 상세" eyebrow="사람의 결정만 기록">
          {selectedTask ? (
            <WorkflowDetail
              task={selectedTask}
              reason={reason}
              setReason={setReason}
              busyAction={busyAction}
              onDecision={applyDecision}
              canDecide={canDecide}
            />
          ) : (
            <div className="empty-state">작업 흐름을 선택하면 단계와 PM 결정 상태를 확인할 수 있습니다.</div>
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
  canDecide,
}: {
  task: PmTask;
  reason: string;
  setReason: (value: string) => void;
  busyAction: string | null;
  onDecision: (action: PmDecisionAction) => void;
  canDecide: boolean;
}) {
  const flow: Array<[string, PmTaskStatus[]]> = [
    ["큐", ["queued"]], ["설계 검토", ["architect_review"]], ["구현", ["ready_for_build", "building"]], ["리뷰", ["review"]], ["PM 결정", ["pm_decision_required"]], ["완료", ["approved", "done"]],
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
          <span>우선순위</span>
          <strong>{task.priority}</strong>
        </div>
        <div>
          <span>반복</span>
          <strong>
            {task.current_iteration}/{task.max_iterations}
          </strong>
        </div>
        <div>
          <span>담당</span>
          <strong>{getOwner(task)}</strong>
        </div>
        <div>
          <span>최근 변경</span>
          <strong>{formatTimeAgo(task.updated_at)}</strong>
        </div>
      </div>
      <details className="details-box">
        <summary>설계 검토·리뷰 판정 메타데이터</summary>
        <pre>{stringifyMeta(task.metadata)}</pre>
      </details>
      <div className="decision-panel">
        <p>
          PM 결정과 ArchiveOS 작업 상태만 기록합니다. Codex, MCP, shell, 배포, 프로세스 제어를 직접 실행하지 않습니다.
        </p>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="결정 사유 또는 재시도 메모" />
        {!canDecide ? <p>승인, 거절, 보류, 재시도에는 PM 또는 관리자 세션이 필요합니다.</p> : null}
        <div className="button-row">
          {(["approve", "reject", "hold", "retry"] as PmDecisionAction[]).map((action) => (
            <button className={`button ${action === "approve" ? "button-primary" : "button-secondary"}`} key={action} type="button" onClick={() => onDecision(action)} disabled={Boolean(busyAction) || !canDecide}>
              {busyAction === action ? "기록 중..." : action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
