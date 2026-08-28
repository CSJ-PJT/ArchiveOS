import { useCallback, useEffect, useMemo, useState } from "react";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { PaginatedItems } from "../components/shared/PaginatedItems";
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
  title: "Archive 공장 자동화 안전 검증",
  description:
    "Archive-Nexus, Archive-Logistics, Archive-Ledger와 ArchiveOS Control Tower의 합성 운영 작업을 분류합니다. 외부 쓰기는 safe-mode와 PM 승인으로 계속 차단합니다.",
  targetProject: "Archive 플랫폼",
};

export function RpaPage({ role }: { role: PlatformRole }) {
  const [tasks, setTasks] = useState<RpaTaskRecord[]>([]);
  const [selected, setSelected] = useState<RpaTaskDetail | null>(null);
  const [title, setTitle] = useState(sampleTask.title);
  const [description, setDescription] = useState(sampleTask.description);
  const [targetProject, setTargetProject] = useState(sampleTask.targetProject);
  const [decisionReason, setDecisionReason] = useState("PM이 자동화 위험과 외부 쓰기 차단 상태를 확인하고 결정을 기록했습니다.");
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
      setError("제목과 설명을 입력하세요.");
      return;
    }
    setBusy("classify");
    setMessage(null);
    try {
      const result = await classifyRpaTask({
        title: title.trim(),
        description: description.trim(),
        targetProject: targetProject.trim() || "Archive 플랫폼",
        requestedBy: "archiveos-control-tower",
        metadata: {
          source: "archiveos-ui",
          safety: "classification_only_no_external_execution",
        },
      });
      setMessage(`RPA 분류 기록을 저장했습니다. 배치 상태: ${result.batchStatus}.`);
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
      setError("반려하려면 사유를 입력하세요.");
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
      setMessage(`PM 결정을 기록했습니다: ${decisionLabel(result.decision.action)}.`);
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
          <span className="eyebrow">승인 통제 자동화</span>
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
              <span>제목</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              <span>대상 프로젝트</span>
              <input value={targetProject} onChange={(event) => setTargetProject(event.target.value)} />
            </label>
            <label>
              <span>설명</span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <p className="small-note">
              분류 기록만 생성합니다. 명령 셸, MCP 도구, 배포 또는 외부 쓰기를 자동으로 실행하지 않습니다.
            </p>
            <button className="button button-primary" type="button" onClick={() => void createClassification()} disabled={!canCreate || busy !== null}>
              {busy === "classify" ? "분류 중…" : "RPA 분류 기록"}
            </button>
            {!canCreate ? <p className="small-note">RPA 분류 작업 생성에는 관리자 로그인이 필요합니다.</p> : null}
          </div>
        </SectionCard>

        <SectionCard title="분류된 작업" eyebrow="위험도와 승인 큐">
          <PaginatedItems items={tasks} pageSize={10} label="RPA 작업 기록 페이지" className="workflow-list" empty={!error ? <div className="empty-state">분류된 RPA 작업이 없습니다. 관리자가 왼쪽 양식에서 기록을 만들 수 있습니다.</div> : null} renderItem={(task) => (
              <button
                className={`workflow-row ${selected?.task.id === task.id ? "selected" : ""}`}
                key={task.id}
                type="button"
                onClick={() => void inspect(task)}
              >
                <div>
                  <strong>{task.title}</strong>
                  <span>{categoryLabel(task.category)}</span>
                </div>
                <StatusBadge status={task.status}>{statusLabel(task.status)}</StatusBadge>
                <span>{riskLabel(task.riskLevel)}</span>
                <span>{formatTimeAgo(task.updatedAt)}</span>
              </button>
            )} />
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
            <div className="empty-state">작업을 선택하면 분류 결과와 결정 이력을 확인할 수 있습니다.</div>
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
        <StatusBadge status={detail.task.status}>{statusLabel(detail.task.status)}</StatusBadge>
      </div>
      <p className="body-copy">{detail.task.summary || detail.task.description}</p>
      <div className="detail-grid">
        <span>위험도<strong>{riskLabel(detail.task.riskLevel)}</strong></span>
        <span>권고<strong>{recommendationLabel(detail.task.recommendation)}</strong></span>
        <span>승인<strong>{detail.task.approvalRequired ? "필요" : "불필요"}</strong></span>
        <span>분류 출처<strong>{classificationSourceLabel(detail.task.classificationSource)}</strong></span>
      </div>
      <label className="form-stack">
        <span>결정 사유</span>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      {!canDecide ? <p className="small-note">RPA 결정 기록에는 PM 또는 관리자 로그인이 필요합니다.</p> : null}
      <div className="button-row">
        {(["approve", "reject", "hold", "request_retry"] as RpaDecisionAction[]).map((action) => (
          <button
            className={`button ${action === "approve" ? "button-primary" : "button-secondary"}`}
            key={action}
            type="button"
            onClick={() => onDecision(action)}
            disabled={Boolean(busy) || !canDecide}
          >
            {busy === action ? "기록 중…" : decisionLabel(action)}
          </button>
        ))}
      </div>
      <PaginatedItems items={detail.decisions} pageSize={10} label="RPA 결정 이력 페이지" className="decision-history-list" empty={<div className="empty-state">이 작업에 기록된 PM 결정이 없습니다.</div>} renderItem={(decision) => (
          <article className="decision-history-row" key={decision.id}>
            <div>
              <strong>{decisionLabel(decision.action)}</strong>
              <span>담당 {decision.decidedBy || "PM"} · {formatTimeAgo(decision.createdAt)}</span>
            </div>
            <StatusBadge status={decision.nextStatus}>{statusLabel(decision.nextStatus)}</StatusBadge>
            <p>{decision.reason || "기록된 사유가 없습니다."}</p>
          </article>
        )} />
      <details className="details-box">
        <summary>분류 메타데이터</summary>
        <pre>{stringifyMeta(detail.task.metadata)}</pre>
      </details>
    </div>
  );
}

function decisionLabel(value: string) {
  return ({ approve: "승인", reject: "반려", hold: "보류", request_retry: "재시도 요청" } as Record<string, string>)[value] || value.replace(/_/g, " ");
}

function categoryLabel(value: string | null | undefined) {
  return ({ execution_control: "실행 제어", general_operations: "일반 운영", data_processing: "데이터 처리", infrastructure: "인프라 운영" } as Record<string, string>)[String(value || "").toLowerCase()] || (value ? value.replace(/_/g, " ") : "미분류");
}

function statusLabel(value: string | null | undefined) {
  return ({ pending: "대기", classified: "분류 완료", approval_required: "승인 필요", approved: "승인됨", rejected: "반려됨", hold: "보류", retry_requested: "재시도 요청" } as Record<string, string>)[String(value || "").toLowerCase()] || (value ? value.replace(/_/g, " ") : "상태 미수집");
}

function riskLabel(value: string | null | undefined) {
  return ({ low: "낮음", medium: "보통", high: "높음", critical: "매우 높음" } as Record<string, string>)[String(value || "").toLowerCase()] || (value ? value.replace(/_/g, " ") : "위험도 미평가");
}

function classificationSourceLabel(value: string | null | undefined) {
  const normalized = String(value || "").toLowerCase();
  if (!normalized) return "규칙 기반";
  if (normalized.includes("rule")) return "규칙 기반";
  if (normalized.includes("model") || normalized.includes("ai")) return "AI 분류";
  if (normalized.includes("manual")) return "수동 분류";
  return String(value).replace(/_/g, " ");
}

function recommendationLabel(value: string | null | undefined) {
  return ({ PM_APPROVAL_REQUIRED: "PM 승인 필요", SAFE_TO_RECORD: "기록 가능", MANUAL_REVIEW: "수동 검토 필요", REJECT_EXECUTION: "실행 차단" } as Record<string, string>)[String(value || "").toUpperCase()] || (value ? value.replace(/_/g, " ") : "추가 권고 없음");
}
