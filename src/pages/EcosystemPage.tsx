import { useState } from "react";
import type { AppData } from "../app/AppShell";
import { MetricCard } from "../components/shared/MetricCard";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { refreshEcosystem, runEcosystemDryRun } from "../lib/backendApi";
import { formatTimeAgo, stringifyMeta } from "./pageUtils";

export function EcosystemPage({ data, onRefresh }: { data: AppData; onRefresh: () => Promise<void> }) {
  const ecosystem = data.ecosystem;
  const topology = data.ecosystemTopology;
  const timeline = data.ecosystemTimeline;
  const [message, setMessage] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<Awaited<ReturnType<typeof runEcosystemDryRun>> | null>(null);
  const canAct = data.auth.role === "ADMIN";

  async function refreshNow() {
    setMessage(null);
    try {
      const result = await refreshEcosystem();
      setMessage(`Ecosystem refreshed: ${result.status}`);
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to refresh ecosystem.");
    }
  }

  async function dryRunScenario() {
    setMessage(null);
    try {
      const result = await runEcosystemDryRun();
      setDryRun(result);
      setMessage(`Dry-run generated: ${result.traceId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to run dry-run.");
    }
  }

  if (!ecosystem) return <div className="empty-state">Ecosystem Control Tower is unavailable. Check archiveos-ai and Flyway migrations.</div>;

  const services = Object.entries(ecosystem.services);

  return <div className="page-stack">
    <header className="page-heading">
      <div>
        <span className="eyebrow">Archive Platform Control Tower</span>
        <h2>Ecosystem Overview</h2>
        <p>Market → Nexus → Logistics → Ledger → ArchiveOS 흐름을 health, approval, callback, policy evidence 기준으로 관제합니다.</p>
      </div>
      <div className="inline-actions">
        <button className="button button-secondary" type="button" onClick={() => void dryRunScenario()}>Demo dry-run</button>
        <button className="button button-primary" type="button" disabled={!canAct} onClick={() => void refreshNow()}>Refresh ecosystem</button>
      </div>
    </header>

    {message ? <p className="small-note">{message}</p> : null}
    {!canAct ? <p className="small-note">Public/Operator/PM sessions can read ecosystem status. Admin session is required to run refresh POST actions.</p> : null}

    <section className="kpi-command-grid">
      <MetricCard label="Ecosystem" value={ecosystem.status} status={ecosystem.status === "HEALTHY" ? "healthy" : "degraded"} description={`Trace ${ecosystem.traceId}`} />
      <MetricCard label="Pending Approval" value={ecosystem.approval.pending_external_approvals ?? 0} status={(ecosystem.approval.pending_external_approvals ?? 0) ? "blocked" : "healthy"} description="External approval queue" />
      <MetricCard label="Callback Pending" value={ecosystem.approval.callback_pending ?? 0} status={(ecosystem.approval.callback_pending ?? 0) ? "warning" : "healthy"} description="Callback outbox / approval callbacks" />
      <MetricCard label="Callback Failed" value={ecosystem.approval.callback_failed ?? 0} status={(ecosystem.approval.callback_failed ?? 0) ? "critical" : "healthy"} description="Needs retry or operator review" />
    </section>

    <section className="overview-layout">
      <SectionCard title="Service Registry" eyebrow="Loose coupling / degraded isolation" className="span-7">
        <div className="history-table">
          {services.map(([key, service]) => <article className="history-row" key={key}>
            <summary>
              <strong>{service.name}</strong>
              <StatusBadge status={service.status}>{service.status}</StatusBadge>
              <span>{service.baseUrl}</span>
              <p>{service.errorMessage || "External service responded or no error has been recorded."}</p>
            </summary>
            <div className="detail-grid">
              <span>Last checked<strong>{service.lastCheckedAt ? formatTimeAgo(service.lastCheckedAt) : "No snapshot"}</strong></span>
              <span>Summary keys<strong>{Object.keys(service.summary || {}).join(", ") || "n/a"}</strong></span>
            </div>
          </article>)}
        </div>
      </SectionCard>

      <SectionCard title="Topology" eyebrow="Market → Nexus → Logistics → Ledger → ArchiveOS" className="span-5">
        <div className="queue-bars">
          {(topology?.nodes || []).map((node) => <div className="history-row" key={node.id}>
            <summary><strong>{node.label}</strong><StatusBadge status={node.status}>{node.status}</StatusBadge><span>{node.type}</span></summary>
          </div>)}
        </div>
        <div className="event-list compact">
          {(topology?.edges || []).map((edge) => <article className="event-row" key={`${edge.from}-${edge.to}`}>
            <strong>{edge.from} → {edge.to}</strong>
            <p>{edge.label}</p>
          </article>)}
        </div>
      </SectionCard>

      <SectionCard title="Demo Dry-run" eyebrow="No external write" className="span-7">
        {dryRun ? <div className="history-table">
          {dryRun.steps.map((step) => <article className="history-row" key={step.order}>
            <summary><strong>{step.order}. {step.service}</strong><StatusBadge status="info">{step.mode}</StatusBadge><p>{step.action}</p></summary>
          </article>)}
        </div> : <div className="empty-state">Run dry-run to preview the full ecosystem scenario without external writes.</div>}
      </SectionCard>

      <SectionCard title="Cross-service Timeline" eyebrow="MVP events" className="span-5">
        <div className="event-list compact">
          {(timeline?.events || []).slice(0, 8).map((event, index) => <article className="event-row" key={String(event.id ?? index)}>
            <span>{event.occurred_at ? formatTimeAgo(String(event.occurred_at)) : "recent"}</span>
            <StatusBadge status={String(event.event_type ?? "event")}>{String(event.source_service ?? "archiveos")}</StatusBadge>
            <strong>{String(event.title ?? "Ecosystem event")}</strong>
            <details><summary>detail</summary><pre>{stringifyMeta(event.detail)}</pre></details>
          </article>)}
          {!timeline?.events?.length ? <div className="empty-state">No ecosystem timeline event recorded yet.</div> : null}
        </div>
      </SectionCard>
    </section>
  </div>;
}
