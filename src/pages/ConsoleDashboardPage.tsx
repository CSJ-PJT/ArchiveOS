import type { AppData } from "../app/AppShell";
import type { CoreRoute } from "../app/navigation";
import { LiveMeshTopology } from "../components/console/LiveMeshTopology";
import { MetricCard } from "../components/shared/MetricCard";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge, normalizeStatus } from "../components/shared/StatusBadge";
import { useI18n } from "../i18n/I18nProvider";
import { consoleText } from "../i18n/console";

export function ConsoleDashboardPage({ data, onNavigate, onRefresh }: { data: AppData; onNavigate: (route: CoreRoute) => void; onRefresh: () => void }) {
  const { locale } = useI18n();
  const services = Object.values(data.ecosystem?.services ?? {});
  const healthy = services.filter((service) => service.status === "HEALTHY").length + 1;
  const runtime = data.liveFlow?.runtime;
  const priority = data.balanceRecommendations?.recommendations?.slice(0, 3) ?? [];
  const balance = data.balance;
  const approvalBacklog = valueOrNone(data.liveFlow?.approvalBacklog);
  const processingBacklog = valueOrNone(data.liveFlow?.processingBacklog);
  return <div className="console-page dashboard-v3">
    <section className="console-hero compact-hero">
      <div><span className="eyebrow">ARCHIVEOS CONTROL TOWER</span><h2>{consoleText(locale, "dashboard.title")}</h2><p>{consoleText(locale, "dashboard.description")}</p></div>
      <div className="console-hero-actions"><StatusBadge status={normalizeStatus(data.ecosystem?.status)}>{data.ecosystem?.status === "HEALTHY" ? "정상" : "주의"}</StatusBadge><StatusBadge status={runtime?.pipelineStatus === "LIVE" ? "healthy" : "warning"}>{runtime?.pipelineStatus === "LIVE" ? "실시간 연결" : "이벤트 확인 필요"}</StatusBadge><button type="button" className="button button-primary" onClick={onRefresh}>연결 다시 확인</button></div>
    </section>
    <div className="console-kpi-grid">
      <MetricCard label="정상 서비스" value={`${healthy}/5`} hint="Archive 핵심 서비스" status={healthy >= 5 ? "healthy" : "warning"} />
      <MetricCard label="활성 이벤트" value={valueOrNone(data.liveFlow?.active_flows)} hint="최근 30분 합성 이벤트" status={runtime?.freshnessStatus === "LIVE" ? "working" : "warning"} />
      <MetricCard label="승인 대기" value={approvalBacklog} description="현재 Synthetic 승인 큐" status={data.liveFlow?.approvalBacklog ? "warning" : "healthy"} onClick={() => onNavigate("finance")} actionLabel="승인·정산 보기" />
      <MetricCard label="처리 적체" value={processingBacklog} description="현재 outbox·처리 대기 합계" status={typeof data.liveFlow?.processingBacklog === "number" && data.liveFlow.processingBacklog > 0 ? "warning" : "healthy"} onClick={() => onNavigate("operations")} actionLabel="운영에서 보기" />
      <MetricCard label="생태계 균형" value={balance?.balanceStatus === "BALANCED" ? "안정" : balance?.balanceStatus === "REVIEW" ? "검토" : balance?.balanceStatus === "WATCH" ? "주의" : "데이터 없음"} description={balance?.reviewReason ?? "손익·적체·처리량 기준"} status={balance?.balanceStatus === "BALANCED" ? "healthy" : balance ? "warning" : "empty"} onClick={() => onNavigate("finance")} actionLabel="서비스별 손익" />
    </div>
    <div className="dashboard-v3-main">
      <LiveMeshTopology topology={data.liveFlowTopology} summary={data.liveFlow} events={data.liveFlowEvents} compact />
      <aside className="dashboard-priority-panel"><SectionCard title="우선 조치" eyebrow="ACTION">
        {priority.length ? <ul className="priority-list">{priority.map((item) => <li key={`${item.serviceId}-${item.title}`}><strong>{item.title}</strong><span>{item.reason}</span><small>{item.serviceId}</small></li>)}</ul> : <p className="empty-copy">현재 수집된 합성 지표에서 즉시 확인할 조치가 없습니다.</p>}
      </SectionCard><SectionCard title="서비스 상태" eyebrow="CORE">
        <ul className="core-service-list">{services.map((service) => <li key={service.name}><span>{service.name}</span><StatusBadge status={normalizeStatus(service.status)}>{service.status === "HEALTHY" ? "정상" : service.status === "UNAVAILABLE" ? "연결 안 됨" : "주의"}</StatusBadge></li>)}<li><span>ArchiveOS</span><StatusBadge status="healthy">정상</StatusBadge></li></ul>
      </SectionCard></aside>
    </div>
    <section className="dashboard-balance-strip"><div><span>재무 균형</span><strong>{formatAmount(balance?.totals?.profit)}</strong><small>합성 수익·비용 기준 영업이익</small></div><div><span>작업 역량</span><strong>{data.workforce?.summary?.averageProductivity ?? "데이터 없음"}</strong><small>평균 생산성</small></div><div><span>상세 보기</span><button type="button" className="text-button" onClick={() => onNavigate("services")}>서비스 상태 →</button><button type="button" className="text-button" onClick={() => onNavigate("operations")}>운영 현황 →</button></div></section>
  </div>;
}
function formatAmount(value: string | number | undefined) { if (value === undefined) return "데이터 없음"; const amount = Number(value); return Number.isFinite(amount) ? `${amount.toLocaleString()} KRW` : String(value); }
function valueOrNone(value: number | null | undefined) { return typeof value === "number" ? value === 0 ? "없음" : value.toLocaleString() : "데이터 없음"; }
