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
  if (!workforce) return <div className="empty-state">작업 역량 현황을 불러오지 못했습니다. archiveos-ai workforce API 상태를 확인하세요.</div>;

  const summary = workforce.summary;
  return (
    <div className="page-stack workforce-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">작업 역량 관제 - Synthetic Data 전용</span>
          <h2>작업 역량 현황</h2>
          <p>
            Market, Nexus, Logistics, Ledger의 작업 인원, 처리 역량, 생산성, 현금흐름 요약을 읽어 병목을 확인합니다.
            실제 직원, 급여, 개인정보는 사용하지 않습니다.
          </p>
        </div>
      </header>

      <p className="small-note">{workforce.dataPolicy} 생성 시각: {formatTimeAgo(workforce.generatedAt)}.</p>

      <section className="kpi-command-grid">
        <MetricCard label="총 인원" value={summary.totalHeadcount} status="healthy" description="Synthetic workforce 기준" />
        <MetricCard label="평균 생산성" value={percent(summary.averageProductivity)} status={Number(summary.averageProductivity) >= 80 ? "healthy" : "warning"} description="서비스 통합 점수" />
        <MetricCard label="가장 큰 병목" value={summary.largestBottleneck} status={summary.totalBacklog > 0 ? "warning" : "healthy"} description={summary.largestBottleneckService} />
        <MetricCard label="전체 적체" value={summary.totalBacklog} status={summary.totalBacklog > 0 ? "blocked" : "healthy"} description="처리 대기 중인 synthetic 작업" />
        <MetricCard label="인건비성 비용" value={money(summary.payrollBurn)} status={Number(summary.payrollBurn) > 0 ? "working" : "idle"} description="Synthetic cost 요약" />
        <MetricCard label="권장 조치" value={summary.recommendedAction} status={summary.totalBacklog > 0 ? "warning" : "healthy"} description="제안 전용" />
      </section>

      <section className="overview-layout">
        <SectionCard title="서비스별 작업 역량" eyebrow="처리 역량 / 적체 / 생산성" className="span-7">
          <div className="history-table">
            {workforce.services.map((service) => (
              <article className="history-row" key={service.serviceId}>
                <summary>
                  <strong>{service.serviceName}</strong>
                  <StatusBadge status={statusTone(service)}>{service.status}</StatusBadge>
                  <span>{service.bottleneckRole}</span>
                  <p>적체 {service.backlog}건 · 처리량 {service.usedCapacity}/{service.effectiveCapacity} · 생산성 {percent(service.productivityScore)}</p>
                </summary>
                <div className="detail-grid">
                  <span>인원<strong>{service.headcount}</strong></span>
                  <span>유효 처리 역량<strong>{String(service.effectiveCapacity)}</strong></span>
                  <span>사용한 처리 역량<strong>{String(service.usedCapacity)}</strong></span>
                  <span>적체<strong>{service.backlog}</strong></span>
                  <span>인건비성 비용<strong>{money(service.payrollCost)}</strong></span>
                  <span>생산성<strong>{percent(service.productivityScore)}</strong></span>
                </div>
                <details><summary>수집 상태</summary><pre>{stringifyMeta(service.source)}</pre></details>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="에이전트 제안" eyebrow="제안 전용 / safe-mode 유지" className="span-5">
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
