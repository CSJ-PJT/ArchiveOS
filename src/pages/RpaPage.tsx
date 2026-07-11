import { useCallback, useEffect, useMemo, useState } from "react";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import {
  classifyRpaTask,
  decideRpaTask,
  getRpaTaskDetail,
  getRpaTasks,
  type PlatformRole,
  type RpaTaskDetail,
  type RpaTaskRecord,
} from "../lib/backendApi";
import { formatTimeAgo, stringifyMeta } from "./pageUtils";

type RpaDecisionAction = "approve" | "reject" | "hold" | "request_retry";

const sampleTask = {
  title: "Archive factory automation smoke",
  description:
    "Generate a safe synthetic operations task for Archive-Nexus, Archive-Logistics, Archive-Ledger and ArchiveOS Control Tower. External writes remain guarded by safe-mode and PM approval.",
  targetProject: "Archive Platform",
};

export function RpaPage({ role }: { role: PlatformRole }) {
  const [tasks, setTasks] = useState<RpaTaskRecord[]>([]);
  const [selected, setSelected] = useState<RpaTaskDetail | null>(null);
  const [title, setTitle] = useState(sampleTask.title);
  const [description, setDescription] = useState(sampleTask.description);
  const [targetProject, setTargetProject] = useState(sampleTask.targetProject);
  const [decisionReason, setDecisionReason] = useState("PM reviewed the automation risk and recorded the decision.");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canCreate = role === "ADMIN";
  const canDecide = role === "ADMIN" || role === "PM";

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const next = await getRpaTasks(30);
      setTasks(next);
      const current = selected?.task.id ? next.find((task) => task.id === selected.task.id) : next[0];
      if (current) setSelected(await getRpaTaskDetail(current.id));
      if (!current) setSelected(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }, [selected?.task.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const summary = useMemo(() => ({
    total: tasks.length,
    approvalRequired: tasks.filter((task) => task.approvalRequired).length,
    highRisk: tasks.filter((task) => ["HIGH", "CRITICAL", "high", "critical"].includes(String(task.riskLevel))).length,
    decided: tasks.filter((task) => ["approved", "rejected", "hold"].includes(String(task.status))).length,
  }), [tasks]);

  async function inspect(task: RpaTaskRecord) {
    setSelected(await getRpaTaskDetail(task.id));
  }

  async function createClassification() {
    if (!title.trim() || !description.trim()) {
      setError("title and description are required.");
      return;
    }
    setBusy("classify");
    setMessage(null);
    try {
      const result = await classifyRpaTask({
        title: title.trim(),
        description: description.trim(),
        targetProject: targetProject.trim() || "Archive Platform",
        requestedBy: "archiveos-control-tower",
        metadata: {
          source: "archiveos-ui",
          safety: "classification_only_no_external_execution",
        },
      });
      setMessage(`RPA classification recorded. Batch status: ${result.batchStatus}.`);
      await refresh();
      if (result.task?.id) setSelected(await getRpaTaskDetail(result.task.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  }

  async function decide(action: RpaDecisionAction) {
    if (!selected?.task.id) return;
    if (action === "reject" && !decisionReason.trim()) {
      setError("Reject requires a reason.");
      return;
    }
    setBusy(action);
    setMessage(null);
    try {
      const result = await decideRpaTask(selected.task.id, {
        action,
        reason: decisionReason.trim() || null,
        decidedBy: role === "ADMIN" ? "archiveos-admin" : "archiveos-pm",
      });
      setMessage(`PM decision recorded: ${result.decision.action}.`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">APPROVAL-GUARDED AUTOMATION</span>
          <h2>자동화 검토</h2>
          <p>자동 분류 결과와 PM 승인 이력을 실제 실행 제어와 분리해 추적합니다.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => void refresh()}>새로고침</button>
      </header>

      <section className="summary-strip">
        <div className="metric-card"><span>전체 작업</span><strong>{summary.total}</strong><small>최근 항목</small></div>
        <div className="metric-card"><span>승인 필요</span><strong>{summary.approvalRequired}</strong><small>PM 게이트</small></div>
        <div className="metric-card"><span>고위험</span><strong>{summary.highRisk}</strong><small>규칙 기반 분류</small></div>
        <div className="metric-card"><span>결정 완료</span><strong>{summary.decided}</strong><small>결정 기록</small></div>
      </section>

      {message ? <div className="empty-state success-state">{message}</div> : null}
      {error ? <div className="empty-state error-state">RPA 서비스에 연결할 수 없습니다. {error}</div> : null}

      <section className="workflows-layout">
        <SectionCard title="자동화 작업 분류" eyebrow="관리자가 검토 가능한 RPA 작업을 생성">
          <div className="form-stack">
            <label>
              <span>Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              <span>Target project</span>
              <input value={targetProject} onChange={(event) => setTargetProject(event.target.value)} />
            </label>
            <label>
              <span>Description</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <p className="small-note">
              This creates a classification record only. It never runs shell, MCP tools, deployments, or external writes by itself.
            </p>
            <button className="button button-primary" type="button" onClick={() => void createClassification()} disabled={!canCreate || busy !== null}>
              {busy === "classify" ? "Classifying..." : "Classify with RPA"}
            </button>
            {!canCreate ? <p className="small-note">Admin unlock is required to create RPA classification tasks.</p> : null}
          </div>
        </SectionCard>

        <SectionCard title="분류된 작업" eyebrow="위험도와 승인 큐">
          <div className="workflow-list">
            {tasks.map((task) => (
              <button
                className={`workflow-row ${selected?.task.id === task.id ? "selected" : ""}`}
                key={task.id}
                type="button"
                onClick={() => void inspect(task)}
              >
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.category || "Unclassified"}</span>
                </div>
                <StatusBadge status={task.status}>{task.status}</StatusBadge>
                <span>{task.riskLevel || "No risk"}</span>
                <span>{formatTimeAgo(task.updatedAt)}</span>
              </button>
            ))}
            {!tasks.length && !error ? <div className="empty-state">No RPA tasks have been classified yet. Admin can create one from the form.</div> : null}
          </div>
        </SectionCard>
      </section>

      <section className="workflows-layout">
        <SectionCard title="결정 상세" eyebrow="PM/관리자 결정 기록">
          {selected ? (
            <RpaDetail
              detail={selected}
              reason={decisionReason}
              setReason={setDecisionReason}
              busy={busy}
              canDecide={canDecide}
              onDecision={decide}
            />
          ) : (
            <div className="empty-state">Select a task to inspect its classification and decision history.</div>
          )}
        </SectionCard>
      </section>
    </div>
  );
}

function RpaDetail({
  detail,
  reason,
  setReason,
  busy,
  canDecide,
  onDecision,
}: {
  detail: RpaTaskDetail;
  reason: string;
  setReason: (value: string) => void;
  busy: string | null;
  canDecide: boolean;
  onDecision: (action: RpaDecisionAction) => void;
}) {
  return (
    <div className="detail-stack">
      <div className="detail-title">
        <div>
          <h3>{detail.task.title}</h3>
          <span>{detail.task.targetProject || "ArchiveOS"}</span>
        </div>
        <StatusBadge status={detail.task.status}>{detail.task.status}</StatusBadge>
      </div>
      <p className="body-copy">{detail.task.summary || detail.task.description}</p>
      <div className="detail-grid">
        <span>Risk<strong>{detail.task.riskLevel || "Not assessed"}</strong></span>
        <span>Recommendation<strong>{detail.task.recommendation || "No recommendation"}</strong></span>
        <span>Approval<strong>{detail.task.approvalRequired ? "Required" : "Not required"}</strong></span>
        <span>Source<strong>{detail.task.classificationSource || "rule_based"}</strong></span>
      </div>
      <label className="form-stack">
        <span>Decision reason</span>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      {!canDecide ? <p className="small-note">PM or Admin session is required to record RPA decisions.</p> : null}
      <div className="button-row">
        {(["approve", "reject", "hold", "request_retry"] as RpaDecisionAction[]).map((action) => (
          <button
            className={`button ${action === "approve" ? "button-primary" : "button-secondary"}`}
            key={action}
            type="button"
            onClick={() => onDecision(action)}
            disabled={Boolean(busy) || !canDecide}
          >
            {busy === action ? "Recording..." : action.replace("_", " ")}
          </button>
        ))}
      </div>
      <div className="decision-history-list">
        {detail.decisions.map((decision) => (
          <article className="decision-history-row" key={decision.id}>
            <div>
              <strong>{decision.action.replace(/_/g, " ")}</strong>
              <span>{decision.decidedBy || "Human PM"} · {formatTimeAgo(decision.createdAt)}</span>
            </div>
            <StatusBadge status={decision.nextStatus}>{decision.nextStatus}</StatusBadge>
            <p>{decision.reason || "No reason recorded."}</p>
          </article>
        ))}
        {!detail.decisions.length ? <div className="empty-state">No PM decisions recorded for this task.</div> : null}
      </div>
      <details className="details-box">
        <summary>Classification metadata</summary>
        <pre>{stringifyMeta(detail.task.metadata)}</pre>
      </details>
    </div>
  );
}
