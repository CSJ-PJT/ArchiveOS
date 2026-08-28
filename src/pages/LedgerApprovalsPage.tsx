import { useEffect, useMemo, useState } from "react";
import type { AppData } from "../app/AppShell";
import { MetricCard } from "../components/shared/MetricCard";
import { PaginatedItems } from "../components/shared/PaginatedItems";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { decideExternalApproval, getApprovalCallbacks, getExternalApproval, retryApprovalCallback } from "../lib/backendApi";
import type { ExternalApprovalRequest } from "../lib/backendApi";
import { formatTimeAgo, stringifyMeta } from "./pageUtils";

export function LedgerApprovalsPage({ data, onRefresh }: { data: AppData; onRefresh: () => Promise<void> }) {
  const approvals = data.externalApprovals;
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    approvals.find((item) => item.status === "PENDING")?.approval_request_id ?? approvals[0]?.approval_request_id ?? null,
  );
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExternalApprovalRequest | null>(null);
  const [callbacks, setCallbacks] = useState<Array<Record<string, unknown>>>([]);
  const firstPending = approvals.find((item) => item.status === "PENDING") ?? null;
  const selectedListItem = approvals.find((item) => item.approval_request_id === selectedId) ?? firstPending ?? approvals[0] ?? null;
  const selected = detail?.approval_request_id === selectedListItem?.approval_request_id ? detail : selectedListItem;
  const canDecide = data.auth.role === "ADMIN" || data.auth.role === "PM";
  const summary = useMemo(() => ({
    pending: approvals.filter((item) => item.status === "PENDING").length,
    high: approvals.filter((item) => item.priority === "high" || item.priority === "critical").length,
    callbackFailed: approvals.filter((item) => item.callback_status === "CALLBACK_FAILED").length,
    fallback: approvals.filter((item) => item.evidence_type === "RULE_FALLBACK").length,
  }), [approvals]);
  const totalPending = data.liveFlow?.approvalBacklog ?? summary.pending;

  useEffect(() => {
    const id = selectedListItem?.approval_request_id;
    if (!id) {
      setDetail(null);
      return;
    }
    let active = true;
    getExternalApproval(id)
      .then((value) => { if (active) setDetail(value); })
      .catch(() => { if (active) setDetail(null); });
    return () => { active = false; };
  }, [selectedListItem?.approval_request_id]);

  useEffect(() => {
    getApprovalCallbacks(20).then(setCallbacks).catch(() => setCallbacks([]));
  }, [approvals]);

  async function decide(action: "approve" | "reject" | "hold") {
    if (!selected) return;
    setBusy(action);
    setMessage(null);
    try {
      await decideExternalApproval(selected.approval_request_id, action, comment);
      setMessage(action === "approve" ? "승인을 기록했습니다." : action === "reject" ? "반려를 기록했습니다." : "보류를 기록했습니다.");
      setComment("");
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "승인 결정을 기록하지 못했습니다.");
    } finally {
      setBusy(null);
    }
  }

  return <div className="page-stack">
    <header className="page-heading">
      <div>
        <span className="eyebrow">ARCHIVE-LEDGER 승인 연동</span>
        <h2>승인·정산 대기열</h2>
        <p>ArchiveOS는 정책 근거와 승인 결정을 기록하고, Ledger는 거래·정산·대사를 책임집니다.</p>
      </div>
      <button className="button button-secondary" type="button" onClick={() => void onRefresh()}>새로고침</button>
    </header>

    <section className="kpi-command-grid">
      <MetricCard label="승인 대기" value={totalPending} status={totalPending ? "blocked" : "healthy"} description="현재 PostgreSQL 승인 대기열" />
      <MetricCard label="고위험" value={summary.high} status={summary.high ? "warning" : "healthy"} description="최근 50건 기준" />
      <MetricCard label="콜백 실패" value={summary.callbackFailed} status={summary.callbackFailed ? "critical" : "healthy"} description="최근 50건 기준" />
      <MetricCard label="규칙 기반 근거" value={summary.fallback} status={summary.fallback ? "warning" : "healthy"} description="최근 50건 기준" />
    </section>

    <section className="workflows-layout">
      <SectionCard title="승인 요청" eyebrow="합성 거래 승인">
        <PaginatedItems items={approvals} pageSize={10} className="workflow-list" label="승인 요청 페이지" renderItem={(approval) => <button
            className={`workflow-row ledger-approval-row ${selected?.approval_request_id === approval.approval_request_id ? "selected" : ""}`}
            key={approval.approval_request_id}
            type="button"
            onClick={() => setSelectedId(approval.approval_request_id)}
          >
            <div><strong>{approval.approval_request_id}</strong><span>{approval.transaction_id}</span></div>
            <StatusBadge status={approval.status}>{statusLabel(approval.status)}</StatusBadge>
            <span>{formatAmount(approval)}</span>
            <span>{approvalReasonLabel(String(approval.metadata?.eventType ?? approval.reason ?? ""))}</span>
            <span>{formatTimeAgo(approval.created_at)}</span>
          </button>} empty={<div className="empty-state">현재 Archive-Ledger 승인 요청이 없습니다.</div>} />
      </SectionCard>

      <SectionCard title="승인 상세" eyebrow="근거 · 콜백 · 결정">
        {selected ? <ApprovalDetail
          approval={selected}
          canDecide={canDecide}
          comment={comment}
          busy={busy}
          message={message}
          setComment={setComment}
          decide={decide}
        /> : <div className="empty-state">정책 근거를 확인할 승인 요청을 선택하세요.</div>}
      </SectionCard>

      <SectionCard title="콜백 발신함" eyebrow="Ledger 콜백 재시도 대기열">
        <PaginatedItems items={callbacks} pageSize={10} className="history-table" label="콜백 발신함 페이지" renderItem={(callback) => <article className="history-row" key={String(callback.callback_id)}>
            <summary>
              <strong>{String(callback.callback_id)}</strong>
              <StatusBadge status={String(callback.status)}>{statusLabel(String(callback.status))}</StatusBadge>
              <span>{String(callback.approval_request_id)}</span>
              <p>{String(callback.last_error || "기록된 오류 없음")}</p>
            </summary>
            <div className="detail-grid">
              <span>대상<strong>{String(callback.target_service)}</strong></span>
              <span>재시도<strong>{String(callback.retry_count)}</strong></span>
              <span>갱신<strong>{callback.updated_at ? formatTimeAgo(String(callback.updated_at)) : "정보 없음"}</strong></span>
            </div>
            {data.auth.role === "ADMIN" && String(callback.status) !== "SENT" ? <button className="button button-secondary" type="button" onClick={async () => { await retryApprovalCallback(String(callback.callback_id)); await onRefresh(); }}>
              콜백 재시도
            </button> : null}
          </article>} empty={<div className="empty-state">현재 콜백 발신 대기 항목이 없습니다.</div>} />
      </SectionCard>
    </section>
  </div>;
}

function ApprovalDetail({
  approval,
  canDecide,
  comment,
  busy,
  message,
  setComment,
  decide,
}: {
  approval: ExternalApprovalRequest;
  canDecide: boolean;
  comment: string;
  busy: string | null;
  message: string | null;
  setComment: (value: string) => void;
  decide: (action: "approve" | "reject" | "hold") => Promise<void>;
}) {
  const isPending = approval.status === "PENDING";
  return <div className="detail-stack">
    <div className="detail-title">
      <div><h3>{approval.approval_request_id}</h3><span>{approval.correlation_id}</span></div>
      <StatusBadge status={approval.status}>{statusLabel(approval.status)}</StatusBadge>
    </div>
    <p className="body-copy">{approvalReasonLabel(approval.reason)}</p>
    <div className="detail-grid">
      <span>금액<strong>{formatAmount(approval)}</strong></span>
      <span>공장<strong>{String(approval.metadata?.factoryId ?? "정보 없음")}</strong></span>
      <span>공급사<strong>{String(approval.metadata?.vendorId ?? "정보 없음")}</strong></span>
      <span>위험도<strong>{statusLabel(String(approval.metadata?.severity ?? "정보 없음"))}</strong></span>
      <span>정책 근거<strong>{statusLabel(approval.evidence_type || approval.evidence?.[0]?.evidence_type || "정보 없음")}</strong></span>
      <span>콜백<strong>{statusLabel(approval.callback_status || "정보 없음")}</strong></span>
    </div>

    <SectionCard title="RAG / 규칙 기반 근거" eyebrow="정책 판단 근거">
      <PaginatedItems items={approval.evidence || []} pageSize={5} className="history-table" label="승인 근거 페이지" resetKey={approval.approval_request_id} renderItem={(evidence) => <article className="history-row" key={evidence.id}>
          <summary>
            <strong>{evidence.title}</strong>
            <StatusBadge status={evidence.evidence_type === "RAG" ? "healthy" : "warning"}>{evidence.evidence_type}</StatusBadge>
            <span>{evidence.source_path || "synthetic policy"}</span>
            <p>{evidence.content}</p>
          </summary>
        </article>} empty={<div className="empty-state">저장된 요청의 근거가 아직 없습니다.</div>} />
    </SectionCard>

    <SectionCard title="감사·콜백 요약" eyebrow="민감정보 미표시">
      <div className="detail-grid">
        <span>결정자<strong>{approval.decided_by || "승인 대기"}</strong></span>
        <span>결정 시각<strong>{approval.decided_at ? formatTimeAgo(approval.decided_at) : "승인 대기"}</strong></span>
        <span>콜백 시도<strong>{approval.callback_attempt_count}</strong></span>
        <span>최근 콜백 오류<strong>{approval.callback_last_error || "없음"}</strong></span>
      </div>
      <details className="details-box"><summary>메타데이터</summary><pre>{stringifyMeta(approval.metadata)}</pre></details>
    </SectionCard>

    {canDecide && isPending ? <div className="settings-grid">
      <p className="small-note">관리자·PM 결정 권한이 확인되었습니다.</p>
      <label>결정 메모<textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="정책 근거를 검토한 뒤 결정 사유를 입력하세요." /></label>
      <div className="inline-actions">
        <button className="button button-primary" type="button" disabled={busy !== null} onClick={() => void decide("approve")}>{busy === "approve" ? "승인 중..." : "승인"}</button>
        <button className="button button-secondary" type="button" disabled={busy !== null} onClick={() => void decide("reject")}>{busy === "reject" ? "반려 중..." : "반려"}</button>
        <button className="button button-secondary" type="button" disabled={busy !== null} onClick={() => void decide("hold")}>{busy === "hold" ? "보류 중..." : "보류"}</button>
      </div>
      {message ? <p className="small-note">{message}</p> : null}
    </div> : canDecide ? <div className="approval-decision-complete" role="status">
      <strong>{statusLabel(approval.status)} 처리 완료</strong>
      <p>이미 처리된 요청은 중복 결정할 수 없습니다. 승인 대기 요청이 생기면 해당 요청이 우선 표시되고 결정 버튼이 활성화됩니다.</p>
    </div> : <p className="small-note">승인 결정을 하려면 관리자 또는 PM 세션이 필요합니다.</p>}
  </div>;
}

function formatAmount(approval: ExternalApprovalRequest) {
  return `${Number(approval.amount).toLocaleString()} ${approval.currency}`;
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    PENDING: "승인 대기", APPROVED: "승인됨", REJECTED: "반려됨", HOLD: "보류",
    CALLBACK_PENDING: "콜백 대기", CALLBACK_SUCCEEDED: "콜백 완료", CALLBACK_FAILED: "콜백 실패",
    CALLBACK_SKIPPED: "콜백 생략", SENT: "전송 완료", RULE_FALLBACK: "규칙 기반", RAG: "RAG 근거",
    HIGH: "높음", CRITICAL: "긴급", MEDIUM: "보통", LOW: "낮음", NORMAL: "정상",
  };
  return labels[String(value || "").toUpperCase()] || value;
}

function approvalReasonLabel(value: string) {
  const normalized = String(value || "").trim();
  const labels: Record<string, string> = {
    COLD_CHAIN_RISK_COST_CONFIRMED: "콜드체인 위험 비용 확인",
    DELAY_PENALTY_CONFIRMED: "배송 지연 비용 확인",
    LOGISTICS_COST_CONFIRMED: "물류 비용 확인",
    REFUND_REQUESTED: "환불 승인 요청",
    ROUTE_DEVIATION_COST_CONFIRMED: "경로 이탈 비용 확인",
    URGENT_DELIVERY_COST_CONFIRMED: "긴급 배송 비용 확인",
    "controlled synthetic approval ingress verification": "통제된 합성 승인 수신 검증",
    "Synthetic logistics cost confirmed by Archive-Logistics": "Archive-Logistics 합성 물류 비용 확인",
  };
  return labels[normalized] || (normalized ? normalized.replace(/_/g, " ") : "이벤트 정보 없음");
}
