import type { AppData } from "../app/AppShell";
import { MetricCard } from "../components/shared/MetricCard";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import type { WorkforceServiceSummary } from "../lib/backendApi";
import { formatTimeAgo, stringifyMeta } from "./pageUtils";

function money(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return String(value ?? "0");
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(numeric);
}

function percent(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return String(value ?? "0");
  return `${numeric.toFixed(numeric % 1 === 0 ? 0 : 1)}%`;
}

function statusTone(service: WorkforceServiceSummary) {
  if (service.status === "UNAVAILABLE") return "critical";
  if (service.status === "DEGRADED" || service.capacityShortage) return "degraded";
  if (service.backlog > 0) return "warning";
  return "healthy";
}

export function WorkforcePage({ data }: { data: AppData }) {
  const workforce = data.workforce;
  if (!workforce) return <div className="empty-state">Operational Workforce overview is unavailable. Check archiveos-ai workforce endpoints.</div>;

  const summary = workforce.summary;
  return (
    <div className="page-stack workforce-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Operational Workforce - Synthetic Data only</span>
          <h2>Operational Workforce Overview</h2>
          <p>
            Reads Market, Nexus, Logistics, and Ledger workforce/capacity/productivity/cashflow summaries.
            No real employee, payroll, or personal data is used.
          </p>
        </div>
      </header>

      <p className="small-note">{workforce.dataPolicy} Generated {formatTimeAgo(workforce.generatedAt)}.</p>

      <section className="kpi-command-grid">
        <MetricCard label="Total headcount" value={summary.totalHeadcount} status="healthy" description="Synthetic workforce only" />
        <MetricCard label="Average productivity" value={percent(summary.averageProductivity)} status={Number(summary.averageProductivity) >= 80 ? "healthy" : "warning"} description="Cross-service score" />
        <MetricCard label="Largest bottleneck" value={summary.largestBottleneck} status={summary.totalBacklog > 0 ? "warning" : "healthy"} description={summary.largestBottleneckService} />
        <MetricCard label="Total backlog" value={summary.totalBacklog} status={summary.totalBacklog > 0 ? "blocked" : "healthy"} description="Open synthetic work queue" />
        <MetricCard label="Payroll burn" value={money(summary.payrollBurn)} status={Number(summary.payrollBurn) > 0 ? "working" : "idle"} description="Synthetic cost summary" />
        <MetricCard label="Recommended action" value={summary.recommendedAction} status={summary.totalBacklog > 0 ? "warning" : "healthy"} description="Recommendation-only" />
      </section>

      <section className="overview-layout">
        <SectionCard title="Service Workforce Board" eyebrow="capacity / backlog / productivity" className="span-7">
          <div className="history-table">
            {workforce.services.map((service) => (
              <article className="history-row" key={service.serviceId}>
                <summary>
                  <strong>{service.serviceName}</strong>
                  <StatusBadge status={statusTone(service)}>{service.status}</StatusBadge>
                  <span>{service.bottleneckRole}</span>
                  <p>{service.backlog} backlog · {service.usedCapacity}/{service.effectiveCapacity} capacity · productivity {percent(service.productivityScore)}</p>
                </summary>
                <div className="detail-grid">
                  <span>Headcount<strong>{service.headcount}</strong></span>
                  <span>Effective capacity<strong>{String(service.effectiveCapacity)}</strong></span>
                  <span>Used capacity<strong>{String(service.usedCapacity)}</strong></span>
                  <span>Backlog<strong>{service.backlog}</strong></span>
                  <span>Payroll cost<strong>{money(service.payrollCost)}</strong></span>
                  <span>Productivity<strong>{percent(service.productivityScore)}</strong></span>
                </div>
                <details><summary>source status</summary><pre>{stringifyMeta(service.source)}</pre></details>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="AI Agent Recommendations" eyebrow="proposal only / safe-mode" className="span-5">
          <div className="event-list compact">
            {workforce.recommendations.map((item) => (
              <article className="event-row" key={item.serviceId}>
                <span>{item.serviceName}</span>
                <StatusBadge status={item.severity}>{item.severity}</StatusBadge>
                <strong>{item.title}</strong>
                <p>{item.reason}</p>
                <small>{item.mode} · {item.externalWrite}</small>
              </article>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
