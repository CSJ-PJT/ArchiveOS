import { useEffect, useMemo, useState } from "react";
import type { AppData } from "../app/AppShell";
import { MetricCard } from "../components/shared/MetricCard";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { decideExternalApproval, getApprovalCallbacks, getExternalApproval, retryApprovalCallback } from "../lib/backendApi";
import type { ExternalApprovalRequest } from "../lib/backendApi";
import { formatTimeAgo, stringifyMeta } from "./pageUtils";

export function LedgerApprovalsPage({ data, onRefresh }: { data: AppData; onRefresh: () => Promise<void> }) {
  const approvals = data.externalApprovals;
  const [selectedId, setSelectedId] = useState<string | null>(approvals[0]?.approval_request_id ?? null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExternalApprovalRequest | null>(null);
  const [callbacks, setCallbacks] = useState<Array<Record<string, unknown>>>([]);
  const selectedListItem = approvals.find((item) => item.approval_request_id === selectedId) ?? approvals[0] ?? null;
  const selected = detail?.approval_request_id === selectedListItem?.approval_request_id ? detail : selectedListItem;
  const canDecide = data.auth.role === "ADMIN" || data.auth.role === "PM";
  const summary = useMemo(() => ({
    pending: approvals.filter((item) => item.status === "PENDING").length,
    high: approvals.filter((item) => item.priority === "high" || item.priority === "critical").length,
    callbackFailed: approvals.filter((item) => item.callback_status === "CALLBACK_FAILED").length,
    fallback: approvals.filter((item) => item.evidence_type === "RULE_FALLBACK").length,
  }), [approvals]);

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
      setMessage(`External approval ${action} recorded.`);
      setComment("");
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Failed to ${action} approval.`);
    } finally {
      setBusy(null);
    }
  }

  return <div className="page-stack">
    <header className="page-heading">
      <div>
        <span className="eyebrow">Archive-Ledger integration gateway</span>
        <h2>Ledger Approval Queue</h2>
        <p>ArchiveOS records policy evidence and PM decisions. Ledger remains responsible for transaction, settlement, reconciliation, and ledger mutation.</p>
      </div>
      <button className="button button-secondary" type="button" onClick={() => void onRefresh()}>Refresh</button>
    </header>

    <section className="kpi-command-grid">
      <MetricCard label="Pending" value={summary.pending} status={summary.pending ? "blocked" : "healthy"} description="Awaiting PM/Admin decision" />
      <MetricCard label="High Risk" value={summary.high} status={summary.high ? "warning" : "healthy"} description="Amount/severity threshold" />
      <MetricCard label="Callback Failed" value={summary.callbackFailed} status={summary.callbackFailed ? "critical" : "healthy"} description="Ledger callback failures" />
      <MetricCard label="Fallback Evidence" value={summary.fallback} status={summary.fallback ? "warning" : "healthy"} description="RAG unavailable fallback" />
    </section>

    <section className="workflows-layout">
      <SectionCard title="Approval Requests" eyebrow="Synthetic transaction approvals">
        <div className="workflow-list">
          {approvals.map((approval) => <button
            className={`workflow-row ledger-approval-row ${selected?.approval_request_id === approval.approval_request_id ? "selected" : ""}`}
            key={approval.approval_request_id}
            type="button"
            onClick={() => setSelectedId(approval.approval_request_id)}
          >
            <div><strong>{approval.approval_request_id}</strong><span>{approval.transaction_id}</span></div>
            <StatusBadge status={approval.status}>{approval.status}</StatusBadge>
            <span>{formatAmount(approval)}</span>
            <span>{String(approval.metadata?.eventType ?? "event n/a")}</span>
            <span>{formatTimeAgo(approval.created_at)}</span>
          </button>)}
          {!approvals.length ? <div className="empty-state">No Archive-Ledger approval requests recorded yet.</div> : null}
        </div>
      </SectionCard>

      <SectionCard title="Approval Detail" eyebrow="Evidence + callback + decision">
        {selected ? <ApprovalDetail
          approval={selected}
          canDecide={canDecide}
          comment={comment}
          busy={busy}
          message={message}
          setComment={setComment}
          decide={decide}
        /> : <div className="empty-state">Select an approval request to inspect policy evidence.</div>}
      </SectionCard>

      <SectionCard title="Callback Outbox" eyebrow="Ledger callback retry queue">
        <div className="history-table">
          {callbacks.map((callback) => <article className="history-row" key={String(callback.callback_id)}>
            <summary>
              <strong>{String(callback.callback_id)}</strong>
              <StatusBadge status={String(callback.status)}>{String(callback.status)}</StatusBadge>
              <span>{String(callback.approval_request_id)}</span>
              <p>{String(callback.last_error || "No error recorded.")}</p>
            </summary>
            <div className="detail-grid">
              <span>Target<strong>{String(callback.target_service)}</strong></span>
              <span>Retry<strong>{String(callback.retry_count)}</strong></span>
              <span>Updated<strong>{callback.updated_at ? formatTimeAgo(String(callback.updated_at)) : "n/a"}</strong></span>
            </div>
            {data.auth.role === "ADMIN" && String(callback.status) !== "SENT" ? <button className="button button-secondary" type="button" onClick={async () => { await retryApprovalCallback(String(callback.callback_id)); await onRefresh(); }}>
              Retry callback
            </button> : null}
          </article>)}
          {!callbacks.length ? <div className="empty-state">No callback outbox item recorded yet.</div> : null}
        </div>
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
  return <div className="detail-stack">
    <div className="detail-title">
      <div><h3>{approval.approval_request_id}</h3><span>{approval.correlation_id}</span></div>
      <StatusBadge status={approval.status}>{approval.status}</StatusBadge>
    </div>
    <p className="body-copy">{approval.reason}</p>
    <div className="detail-grid">
      <span>Amount<strong>{formatAmount(approval)}</strong></span>
      <span>Factory<strong>{String(approval.metadata?.factoryId ?? "n/a")}</strong></span>
      <span>Vendor<strong>{String(approval.metadata?.vendorId ?? "n/a")}</strong></span>
      <span>Severity<strong>{String(approval.metadata?.severity ?? "n/a")}</strong></span>
      <span>Evidence<strong>{approval.evidence_type || approval.evidence?.[0]?.evidence_type || "n/a"}</strong></span>
      <span>Callback<strong>{approval.callback_status || "n/a"}</strong></span>
    </div>

    <SectionCard title="RAG / Fallback Evidence" eyebrow="Policy basis">
      <div className="history-table">
        {(approval.evidence || []).map((evidence) => <article className="history-row" key={evidence.id}>
          <summary>
            <strong>{evidence.title}</strong>
            <StatusBadge status={evidence.evidence_type === "RAG" ? "healthy" : "warning"}>{evidence.evidence_type}</StatusBadge>
            <span>{evidence.source_path || "synthetic policy"}</span>
            <p>{evidence.content}</p>
          </summary>
        </article>)}
        {!approval.evidence?.length ? <div className="empty-state">Evidence will appear in detail after selecting a persisted request.</div> : null}
      </div>
    </SectionCard>

    <SectionCard title="Audit / Callback Summary" eyebrow="No secret values">
      <div className="detail-grid">
        <span>Decided by<strong>{approval.decided_by || "pending"}</strong></span>
        <span>Decided at<strong>{approval.decided_at ? formatTimeAgo(approval.decided_at) : "pending"}</strong></span>
        <span>Callback attempts<strong>{approval.callback_attempt_count}</strong></span>
        <span>Last callback error<strong>{approval.callback_last_error || "none"}</strong></span>
      </div>
      <details className="details-box"><summary>Metadata</summary><pre>{stringifyMeta(approval.metadata)}</pre></details>
    </SectionCard>

    {canDecide ? <div className="settings-grid">
      <label>Decision comment<textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Policy evidence reviewed. Decision rationale..." /></label>
      <div className="inline-actions">
        <button className="button button-primary" type="button" disabled={busy !== null || approval.status !== "PENDING"} onClick={() => void decide("approve")}>{busy === "approve" ? "Approving..." : "Approve"}</button>
        <button className="button button-secondary" type="button" disabled={busy !== null || approval.status !== "PENDING"} onClick={() => void decide("reject")}>{busy === "reject" ? "Rejecting..." : "Reject"}</button>
        <button className="button button-secondary" type="button" disabled={busy !== null || approval.status !== "PENDING"} onClick={() => void decide("hold")}>{busy === "hold" ? "Holding..." : "Hold"}</button>
      </div>
      {message ? <p className="small-note">{message}</p> : null}
    </div> : <p className="small-note">Admin unlock or PM session is required for approval decisions.</p>}
  </div>;
}

function formatAmount(approval: ExternalApprovalRequest) {
  return `${Number(approval.amount).toLocaleString()} ${approval.currency}`;
}
