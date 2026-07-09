import { useMemo, useState } from "react";
import type { AppRoute } from "../app/navigation";
import type { AppData } from "../app/AppShell";
import { MetricCard } from "../components/shared/MetricCard";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { acknowledgePmInboxItem, resolvePmInboxItem } from "../lib/backendApi";
import type { GameFinanceSnapshot, PmInboxItem } from "../lib/backendApi";
import { formatTimeAgo } from "./pageUtils";

export function ManagedSystemsPage({
  data,
  onRefresh,
  onNavigate,
}: {
  data: AppData;
  onRefresh: () => Promise<void>;
  onNavigate: (route: AppRoute) => void;
}) {
  const managed = data.managedSystems;
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const canAct = data.auth.role === "ADMIN";
  const systemsById = useMemo(() => new Map((managed?.systems || []).map((system) => [system.systemId, system])), [managed?.systems]);

  async function updateInbox(id: string, action: "acknowledge" | "resolve") {
    setBusyItem(`${action}:${id}`);
    setMessage(null);
    try {
      if (action === "acknowledge") await acknowledgePmInboxItem(id);
      else await resolvePmInboxItem(id);
      setMessage(`PM Inbox item ${action}d.`);
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Failed to ${action} PM Inbox item.`);
    } finally {
      setBusyItem(null);
    }
  }

  if (!managed) {
    return <div className="empty-state">Managed Systems Control Tower is unavailable. Check archiveos-ai and migrations.</div>;
  }

  const recommended = managed.summary.recommendedPmAction;
  const openInbox = managed.pmInbox.filter((item) => item.status === "open");

  return <div className="page-stack">
    <header className="page-heading">
      <div>
        <span className="eyebrow">Multi-system operations</span>
        <h2>Managed Systems Control Tower</h2>
        <p>ArchiveOS, Archive-Nexus, Atlas Platform, and future systems are summarized in one PM operating surface.</p>
      </div>
      <button className="button button-secondary" type="button" onClick={() => void onRefresh()}>Refresh</button>
    </header>

    <section className="kpi-command-grid" aria-label="Managed systems control tower summary">
      <MetricCard label="Managed Systems" value={managed.summary.managedSystemsCount} status="healthy" description="Registered operating targets" />
      <MetricCard label="Normal" value={managed.summary.normalCount} status="healthy" description="Systems currently normal" />
      <MetricCard label="Degraded" value={managed.summary.degradedCount} status={managed.summary.degradedCount ? "degraded" : "healthy"} description="Systems needing review" />
      <MetricCard label="Down Candidate" value={managed.summary.downCandidateCount} status={managed.summary.downCandidateCount ? "critical" : "healthy"} description="Critical failures detected" />
      <MetricCard label="Pending Approvals" value={managed.summary.pendingApprovals} status={managed.summary.pendingApprovals ? "blocked" : "healthy"} description="PM workflow decisions" />
      <MetricCard label="Open Inbox" value={managed.summary.openPmInboxItems} status={managed.summary.openPmInboxItems ? "warning" : "healthy"} description="Recommended PM actions" />
    </section>

    <SectionCard title="Recommended PM Action" eyebrow="What to look at first">
      <div className="healthy-empty">
        <StatusBadge status={recommended.severity || "healthy"}>{recommended.severity || "ready"}</StatusBadge>
        <strong>{recommended.title}</strong>
        <p>{recommended.reason}</p>
      </div>
    </SectionCard>

    <section className="overview-layout">
      <SectionCard title="Managed Systems List" eyebrow="Status cards" className="span-7">
        <div className="queue-bars">
          {managed.systems.map((system) => <button key={system.systemId} type="button" onClick={() => navigateSystem(system.systemId, onNavigate)}>
            <span>{system.name}</span>
            <strong>{system.status}</strong>
            <StatusBadge status={system.status}>{system.status}</StatusBadge>
            <small>{system.normalServiceCount}/{system.serviceCount} services · {system.pendingApprovalCount} approval(s)</small>
          </button>)}
        </div>
      </SectionCard>

      <SectionCard title="PM Inbox" eyebrow={`${openInbox.length} open item(s)`} className="span-5">
        {message ? <p className="small-note">{message}</p> : null}
        <div className="history-table">
          {managed.pmInbox.map((item) => <InboxRow
            key={item.id}
            item={item}
            systemName={systemsById.get(item.sourceSystemId)?.name || item.sourceSystemId}
            canAct={canAct}
            busyItem={busyItem}
            onUpdate={updateInbox}
          />)}
          {!managed.pmInbox.length ? <div className="empty-state">No PM Inbox items. Control Tower is calm.</div> : null}
        </div>
        {!canAct ? <p className="small-note">Public/Operator/PM sessions can read PM Inbox. Admin session is required to acknowledge or resolve items.</p> : null}
      </SectionCard>

      <SectionCard title="System Detail Panel" eyebrow="Selected-by-card quick facts" className="span-7">
        <div className="history-table">
          {managed.systems.map((system) => <article className="history-row" key={system.systemId}>
            <summary>
              <strong>{system.name}</strong>
              <StatusBadge status={system.status}>{system.status}</StatusBadge>
              <span>{system.type} · {system.environment}/{system.provider}</span>
              <p>{system.statusReason}</p>
            </summary>
            <div className="detail-grid">
              <span>Last checked<strong>{system.lastCheckedAt ? formatTimeAgo(system.lastCheckedAt) : "No data"}</strong></span>
              <span>Repository<strong>{system.repository || "n/a"}</strong></span>
              <span>Latest workflow<strong>{system.latestWorkflowId || "n/a"}</strong></span>
              <span>Latest work log<strong>{system.latestWorkLogId || "n/a"}</strong></span>
              {system.systemId === "archive-ledger" ? <>
                <span>Role<strong>{system.role || "Synthetic Financial Operations Backend"}</strong></span>
                <span>Base URL configured<strong>{system.baseUrlConfigured ? "yes" : "no"}</strong></span>
                <span>Approval Callback<strong>{system.approvalCallbackConfigured ? "configured" : "not configured"}</strong></span>
                <span>Secrets<strong>{system.secrets || "hidden"}</strong></span>
                <span>Required env<strong>{(system.environmentRequirements || []).map((env) => `${env.name}${env.secret ? " (hidden)" : ""}`).join(", ") || "n/a"}</strong></span>
              </> : null}
            </div>
            <SystemFinancePanel finance={data.gameFinance?.systems?.[system.systemId]} />
          </article>)}
        </div>
      </SectionCard>

      <SectionCard title="Recent Cross-System Events" eyebrow="Audit-linked operating evidence" className="span-5">
        <div className="event-list compact">
          {data.timeline.slice(0, 6).map((event) => <article className="event-row" key={event.id}>
            <span>{formatTimeAgo(event.occurred_at)}</span>
            <StatusBadge status={event.status}>{event.event_type}</StatusBadge>
            <strong>{event.title}</strong>
            <p>{event.summary || event.project_id || "No summary recorded."}</p>
          </article>)}
          {!data.timeline.length ? <div className="empty-state">Timeline requires Operator, PM, or Admin access.</div> : null}
        </div>
      </SectionCard>
    </section>
  </div>;
}

function InboxRow({
  item,
  systemName,
  canAct,
  busyItem,
  onUpdate,
}: {
  item: PmInboxItem;
  systemName: string;
  canAct: boolean;
  busyItem: string | null;
  onUpdate: (id: string, action: "acknowledge" | "resolve") => Promise<void>;
}) {
  const disabled = !canAct || item.status === "resolved";
  return <article className="history-row">
    <summary>
      <strong>{item.title}</strong>
      <StatusBadge status={item.severity}>{item.severity}</StatusBadge>
      <span>{systemName} · {item.sourceType}</span>
      <p>{item.summary}</p>
    </summary>
    <div className="detail-grid">
      <span>Status<strong>{item.status}</strong></span>
      <span>Created<strong>{formatTimeAgo(item.createdAt)}</strong></span>
      <span>Recommended<strong>{item.recommendedAction}</strong></span>
      <span>Related<strong>{item.relatedWorkflowId || item.relatedServiceId || item.relatedWorkLogId || "n/a"}</strong></span>
    </div>
    <div className="inline-actions">
      <button className="button button-secondary" type="button" disabled={disabled || busyItem === `acknowledge:${item.id}`} onClick={() => void onUpdate(item.id, "acknowledge")}>
        {busyItem === `acknowledge:${item.id}` ? "Acknowledging..." : "Acknowledge"}
      </button>
      <button className="button button-primary" type="button" disabled={disabled || busyItem === `resolve:${item.id}`} onClick={() => void onUpdate(item.id, "resolve")}>
        {busyItem === `resolve:${item.id}` ? "Resolving..." : "Resolve"}
      </button>
    </div>
  </article>;
}

function navigateSystem(systemId: string, onNavigate: (route: AppRoute) => void) {
  if (systemId === "atlas-platform") onNavigate("atlas");
  else if (systemId === "archive-nexus" || systemId === "archive-logitics") onNavigate("ecosystem");
  else if (systemId === "archive-ledger") onNavigate("approvals");
  else onNavigate("overview");
}

function SystemFinancePanel({ finance }: { finance: GameFinanceSnapshot | undefined }) {
  if (!finance) {
    return <div className="small-note">No persisted finance snapshot yet. Run Ecosystem Survival Mode dry-run to seed DB-backed cash/import/export rows.</div>;
  }

  return (
    <div className="system-finance-panel">
      <div className="detail-grid">
        <span>Cash balance<strong>{money(finance.cash_balance)}</strong></span>
        <span>Revenue<strong>{money(finance.revenue_amount)}</strong></span>
        <span>Cost<strong>{money(finance.cost_amount)}</strong></span>
        <span>Profit<strong>{money(finance.profit_amount)}</strong></span>
      </div>
      <div className="finance-ledger-columns">
        <MiniTrades title="Exports" trades={finance.exports || []} />
        <MiniTrades title="Imports" trades={finance.imports || []} />
      </div>
    </div>
  );
}

function MiniTrades({ title, trades }: { title: string; trades: Array<{ trade_id: string; trade_type: string; amount: number | string; currency: string }> }) {
  return (
    <div className="mini-trade-list">
      <strong>{title}</strong>
      {trades.slice(0, 4).map((trade) => (
        <span key={trade.trade_id}>{trade.trade_type}: {money(trade.amount)} {trade.currency}</span>
      ))}
      {!trades.length ? <span>No records</span> : null}
    </div>
  );
}

function money(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return String(value ?? "0");
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(numeric);
}
