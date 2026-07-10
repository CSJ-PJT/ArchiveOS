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
      setMessage(`에코시스템 상태를 갱신했습니다: ${result.status}`);
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "에코시스템 상태 갱신에 실패했습니다.");
    }
  }

  async function dryRunScenario() {
    setMessage(null);
    try {
      const result = await runEcosystemDryRun();
      setDryRun(result);
      setMessage(`Dry-run 결과를 생성했습니다: ${result.traceId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Dry-run 실행에 실패했습니다.");
    }
  }

  if (!ecosystem) return <div className="empty-state">에코시스템 관제 정보를 불러오지 못했습니다. archiveos-ai와 Flyway 적용 상태를 확인하세요.</div>;

  const services = Object.entries(ecosystem.services);

  return <div className="page-stack">
    <header className="page-heading">
      <div>
        <span className="eyebrow">Archive Platform 관제</span>
        <h2>에코시스템 현황</h2>
        <p>Market → Nexus → Logistics → Ledger → ArchiveOS 흐름을 health, approval, callback, policy evidence 기준으로 관제합니다.</p>
      </div>
      <div className="inline-actions">
        <button className="button button-secondary" type="button" onClick={() => void dryRunScenario()}>Dry-run 확인</button>
        <button className="button button-primary" type="button" disabled={!canAct} onClick={() => void refreshNow()}>상태 갱신</button>
      </div>
    </header>

    {message ? <p className="small-note">{message}</p> : null}
    {!canAct ? <p className="small-note">Public, Operator, PM 세션은 에코시스템 상태를 조회할 수 있습니다. POST 기반 갱신은 Admin 권한이 필요합니다.</p> : null}

    <section className="kpi-command-grid">
      <MetricCard label="전체 상태" value={ecosystem.status} status={ecosystem.status === "HEALTHY" ? "healthy" : "degraded"} description={`Trace ${ecosystem.traceId}`} />
      <MetricCard label="승인 대기" value={ecosystem.approval.pending_external_approvals ?? 0} status={(ecosystem.approval.pending_external_approvals ?? 0) ? "blocked" : "healthy"} description="외부 승인 요청 큐" />
      <MetricCard label="callback 대기" value={ecosystem.approval.callback_pending ?? 0} status={(ecosystem.approval.callback_pending ?? 0) ? "warning" : "healthy"} description="승인 callback outbox" />
      <MetricCard label="callback 실패" value={ecosystem.approval.callback_failed ?? 0} status={(ecosystem.approval.callback_failed ?? 0) ? "critical" : "healthy"} description="재시도 또는 운영자 확인 필요" />
    </section>

    <section className="overview-layout">
      <SectionCard title="서비스 레지스트리" eyebrow="느슨한 연동 / 장애 격리" className="span-7">
        <div className="history-table">
          {services.map(([key, service]) => <article className="history-row" key={key}>
            <summary>
              <strong>{service.name}</strong>
              <StatusBadge status={service.status}>{service.status}</StatusBadge>
              <span>{service.baseUrl}</span>
              <p>{service.errorMessage || "외부 서비스가 응답했거나 기록된 오류가 없습니다."}</p>
            </summary>
            <div className="detail-grid">
              <span>최근 확인<strong>{service.lastCheckedAt ? formatTimeAgo(service.lastCheckedAt) : "스냅샷 없음"}</strong></span>
              <span>요약 키<strong>{Object.keys(service.summary || {}).join(", ") || "없음"}</strong></span>
            </div>
          </article>)}
        </div>
      </SectionCard>

      <SectionCard title="토폴로지" eyebrow="Market → Nexus → Logistics → Ledger → ArchiveOS" className="span-5">
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

      <SectionCard title="Dry-run 확인" eyebrow="외부 write 없음" className="span-7">
        {dryRun ? <div className="history-table">
          {dryRun.steps.map((step) => <article className="history-row" key={step.order}>
            <summary><strong>{step.order}. {step.service}</strong><StatusBadge status="info">{step.mode}</StatusBadge><p>{step.action}</p></summary>
          </article>)}
        </div> : <div className="empty-state">Dry-run을 실행하면 외부 서비스를 변경하지 않고 전체 흐름을 미리 확인할 수 있습니다.</div>}
      </SectionCard>

      <SectionCard title="서비스 간 타임라인" eyebrow="최근 운영 이벤트" className="span-5">
        <div className="event-list compact">
          {(timeline?.events || []).slice(0, 8).map((event, index) => <article className="event-row" key={String(event.id ?? index)}>
            <span>{event.occurred_at ? formatTimeAgo(String(event.occurred_at)) : "recent"}</span>
            <StatusBadge status={String(event.event_type ?? "event")}>{String(event.source_service ?? "archiveos")}</StatusBadge>
            <strong>{String(event.title ?? "Ecosystem event")}</strong>
            <details><summary>상세</summary><pre>{stringifyMeta(event.detail)}</pre></details>
          </article>)}
          {!timeline?.events?.length ? <div className="empty-state">아직 기록된 에코시스템 타임라인 이벤트가 없습니다.</div> : null}
        </div>
      </SectionCard>
    </section>
  </div>;
}
