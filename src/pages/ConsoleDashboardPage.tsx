import { useMemo, useState } from "react";
import type { AppData } from "../app/AppShell";
import type { CoreRoute } from "../app/navigation";
import { LiveMeshTopology } from "../components/console/LiveMeshTopology";
import { DashboardRagCopilot } from "../components/console/DashboardRagCopilot";
import { Icon, type IconName } from "../components/shared/Icon";
import { StatusBadge, normalizeStatus, type SemanticStatus } from "../components/shared/StatusBadge";
import { useI18n } from "../i18n/I18nProvider";

type EventFilter = "ALL" | "MARKET" | "NEXUS" | "LOGISTICS" | "LEDGER" | "ARCHIVEOS" | "WARNING";

export function ConsoleDashboardPage({ data, onNavigate, onRefresh }: { data: AppData; onNavigate: (route: CoreRoute) => void; onRefresh: () => void }) {
  void onRefresh;
  const { translate } = useI18n();
  const [eventFilter, setEventFilter] = useState<EventFilter>("ALL");
  const [copilotQuestion, setCopilotQuestion] = useState<string | null>(null);
  const services = Object.values(data.ecosystem?.services ?? {});
  const healthy = services.filter((service) => service.status === "HEALTHY").length + 1;
  const runtime = data.liveFlow?.runtime;
  const balance = data.balance;
  const allEvents = data.liveFlowEvents;
  const filteredEvents = useMemo(() => allEvents.filter((event) => matchesFilter(event, eventFilter)), [allEvents, eventFilter]);
  const events = filteredEvents.slice(0, 4);
  const ecosystemStatus = data.ecosystem?.status ?? "UNKNOWN";
  const balanceView = balanceStatusView(balance?.balanceStatus);
  const approvalTrend = buildTrend(allEvents, (event) => /approval/i.test(`${event.event_type} ${event.status}`));
  const activeTrend = buildTrend(allEvents, () => true);
  const backlogTrend = buildTrend(allEvents, (event) => /waiting|delayed|failed|warning|retry/i.test(`${event.status} ${event.severity} ${event.event_type}`));

  return <div className="console-page dashboard-v4 dashboard-rework-phase1">
    <section className="dashboard-overview-header">
      <div className="dashboard-title-block">
        <span className="eyebrow">CONTROL TOWER</span>
        <h2>Archive 생태계 운영 현황</h2>
        <p>핵심 서비스 상태, 실시간 이벤트, 병목과 재무 균형을 한 화면에서 확인합니다.</p>
      </div>
      <div className="dashboard-header-tools">
        <DashboardRagCopilot data={data} seedQuestion={copilotQuestion} onSeedHandled={() => setCopilotQuestion(null)} />
        <div className="dashboard-header-status" aria-label="대시보드 수집 상태">
          <StatusBadge status={normalizeStatus(ecosystemStatus)}>{statusLabel(ecosystemStatus)}</StatusBadge>
          <StatusBadge status={runtime?.pipelineStatus === "LIVE" ? "healthy" : runtime?.pipelineStatus ? "warning" : "empty"}>{runtime?.pipelineStatus === "LIVE" ? "실시간 수집" : runtime?.pipelineStatus ? "흐름 확인 필요" : "수집 상태 확인"}</StatusBadge>
        </div>
      </div>
    </section>

    <section className="dashboard-kpi-grid" aria-label="핵심 운영 지표">
      <DashboardKpi icon="health" label="정상 서비스" value={`${healthy}/5`} helper="핵심 서비스와 Control Tower" status={healthy >= 5 ? "healthy" : "warning"} note="마지막 확인 기준" action="서비스" onClick={() => onNavigate("services")} />
      <DashboardKpi icon="activity" label="활성 이벤트" value={displayCount(data.liveFlow?.active_flows)} helper={data.liveFlow?.latest_event_at ? `마지막 수신 ${timeAgo(data.liveFlow.latest_event_at)}` : "최근 실행 이벤트 없음"} status={runtime?.freshnessStatus === "LIVE" ? "working" : runtime?.freshnessStatus === "NO_RUNTIME_EVENTS" ? "empty" : "warning"} trend={activeTrend} trendTone="activity" trendLabel="최근 30분" mobileTrendLabel="최근 30분" action="이벤트" onClick={() => onNavigate("records")} />
      <DashboardKpi icon="approval" label="승인 대기" value={displayCount(data.liveFlow?.approvalBacklog)} helper="현재 승인 큐 기준" status={numberStatus(data.liveFlow?.approvalBacklog)} trend={approvalTrend} trendTone="approval" trendLabel="최근 30분" mobileTrendLabel="승인 큐 기준" action={translate("copilot.analyze")} onClick={() => setCopilotQuestion(translate("copilot.questionApproval"))} />
      <DashboardKpi icon="workflow" label="처리 적체" value={displayCount(data.liveFlow?.processingBacklog)} helper="현재 처리 대기 기준" status={numberStatus(data.liveFlow?.processingBacklog)} trend={backlogTrend} trendTone="backlog" trendLabel="최근 30분" mobileTrendLabel="처리 대기 기준" action={translate("copilot.analyze")} onClick={() => setCopilotQuestion(translate("copilot.questionBacklog"))} />
      <DashboardKpi icon="overview" label="생태계 균형" value={balanceView.label} valueCompact helper={balanceShortSummary(balance?.balanceStatus)} helperTitle={balance?.reviewReason || balanceView.description} status={balanceView.status} badgeLabel={balanceView.badge} note={balance ? "마지막 계산 기준" : "재무 Runtime Mesh 수집 대기"} action={translate("copilot.analyze")} onClick={() => setCopilotQuestion(interpolate(translate("copilot.questionBalance"), { status: balance?.balanceStatus || "NO_DATA" }))} />
    </section>

    <LiveMeshTopology topology={data.liveFlowTopology} summary={data.liveFlow} events={allEvents} onNavigate={onNavigate} onAsk={setCopilotQuestion} />

    <section className="dashboard-event-strip" aria-labelledby="dashboard-recent-events-title">
      <header className="dashboard-event-strip-header">
        <div><span className="eyebrow">RUNTIME EVENT</span><h2 id="dashboard-recent-events-title">최근 이벤트</h2></div>
        <div className="dashboard-event-controls">
          <label><span className="sr-only">서비스 또는 상태 필터</span><select value={eventFilter} onChange={(event) => setEventFilter(event.target.value as EventFilter)} aria-label="최근 이벤트 필터"><option value="ALL">전체</option><option value="MARKET">Market</option><option value="NEXUS">Nexus</option><option value="LOGISTICS">Logistics</option><option value="LEDGER">Ledger</option><option value="ARCHIVEOS">ArchiveOS</option><option value="WARNING">주의·실패</option></select></label>
          <button type="button" className="text-button" onClick={() => onNavigate("records")}>전체 이벤트 보기 →</button>
        </div>
      </header>
      {events.length ? <><div className="dashboard-event-columns" aria-hidden="true"><span>시간</span><span>경로</span><span>이벤트</span><span>대상</span><span>Correlation</span><span>상태</span></div><ol className="dashboard-event-list">{events.map((event) => <li key={event.event_id} className={isFresh(event.received_at) ? "is-new" : ""}>
        <time className="event-time">{formatTime(event.occurred_at)}</time><span className="event-route" title={`${event.from_node} → ${event.to_node}`}>{displayServiceName(event.from_node)} → {displayServiceName(event.to_node)}</span><strong className="event-type" title={event.event_type}>{event.event_type}</strong><small className="event-entity" title={event.entity_id}>{event.entity_id || "대상 정보 없음"}</small><button type="button" className="correlation-link" title={event.correlation_id ? "AI 코파일럿에서 흐름 분석" : "연결 정보 없음"} onClick={() => setCopilotQuestion(interpolate(translate("copilot.questionCorrelation"), { id: event.correlation_id || "NO_DATA" }))}>{shortId(event.correlation_id) || "연결 정보 없음"}</button><StatusBadge status={normalizeStatus(event.status)}>{statusLabel(event.status)}</StatusBadge>
      </li>)}</ol></> : <p className="dashboard-event-empty">실시간 연결은 정상이며 새 런타임 이벤트를 기다리고 있습니다.</p>}
    </section>
  </div>;
}

function interpolate(template: string, variables: Record<string, string>) { return Object.entries(variables).reduce((text, [key, value]) => text.split(`{${key}}`).join(value), template); }

function DashboardKpi({ icon, label, value, helper, helperTitle, status, badgeLabel, trend, trendTone, trendLabel, mobileTrendLabel, note, action, onClick, valueCompact = false }: { icon: IconName; label: string; value: string; helper: string; helperTitle?: string; status: SemanticStatus; badgeLabel?: string; trend?: number[]; trendTone?: "activity" | "approval" | "backlog"; trendLabel?: string; mobileTrendLabel?: string; note?: string; action: string; onClick: () => void; valueCompact?: boolean }) {
  const hasTrend = Boolean(trend?.some((value) => value > 0));
  return <button type="button" className="dashboard-kpi-card" onClick={onClick} aria-label={`${label}: ${value}. ${action}`}>
    <span className="dashboard-kpi-heading"><Icon name={icon} size={16} /><span>{label}</span><StatusBadge status={status}>{badgeLabel || statusText(status)}</StatusBadge></span>
    <strong className={valueCompact ? "is-compact" : ""}>{value}</strong>
    <span className="dashboard-kpi-helper" title={helperTitle || helper}>{helper}</span>
    <span className="dashboard-kpi-foot">{hasTrend && trend ? <><Sparkline values={trend} tone={trendTone} /><small title={trendLabel}><span className="desktop-trend-label">{trendLabel}</span><span className="mobile-trend-label">{mobileTrendLabel || trendLabel}</span></small></> : <small>{note || "추세 데이터 없음"}</small>}<em>{action} →</em></span>
  </button>;
}

function Sparkline({ values, tone = "activity" }: { values: number[]; tone?: "activity" | "approval" | "backlog" }) {
  const points = sparklinePoints(values);
  return <svg className={`dashboard-sparkline tone-${tone}`} viewBox="0 0 100 28" preserveAspectRatio="none" aria-label="실제 이벤트 기준 추세"><polyline points={points} fill="none" /></svg>;
}

function buildTrend(events: AppData["liveFlowEvents"], predicate: (event: AppData["liveFlowEvents"][number]) => boolean) {
  const now = Date.now(); const buckets = Array.from({ length: 6 }, () => 0);
  for (const event of events) { const occurred = new Date(event.occurred_at || event.received_at).getTime(); const age = now - occurred; if (Number.isNaN(occurred) || age < 0 || age > 30 * 60_000 || !predicate(event)) continue; buckets[Math.min(5, Math.max(0, 5 - Math.floor(age / (5 * 60_000))))] += 1; }
  return buckets;
}

function sparklinePoints(values: number[]) { const max = Math.max(...values, 1); return values.map((value, index) => `${index * (100 / Math.max(values.length - 1, 1))},${25 - (value / max) * 20}`).join(" "); }
function numberStatus(value: number | null | undefined): SemanticStatus { return typeof value !== "number" ? "empty" : value > 0 ? "warning" : "healthy"; }
function displayCount(value: number | null | undefined) { return typeof value === "number" ? value.toLocaleString() : "데이터 없음"; }
function shortId(value: string | null | undefined) { return value ? `${value.slice(0, 12)}…` : null; }
function displayServiceName(value: string) { const normalized = value.toLowerCase(); if (normalized.includes("market")) return "Market"; if (normalized.includes("nexus")) return "Nexus"; if (normalized.includes("logit")) return "Logistics"; if (normalized.includes("ledger")) return "Ledger"; if (normalized.includes("settle")) return "Settlement"; if (normalized.includes("archiveos")) return "ArchiveOS"; return value; }
function formatTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function timeAgo(value: string) { const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)); return seconds < 60 ? `${seconds}초 전` : `${Math.floor(seconds / 60)}분 전`; }
function isFresh(value: string) { const timestamp = new Date(value).getTime(); return !Number.isNaN(timestamp) && Date.now() - timestamp < 10_000; }
function matchesFilter(event: AppData["liveFlowEvents"][number], filter: EventFilter) { if (filter === "ALL") return true; if (filter === "WARNING") return /warning|failed|critical|delayed|stale/i.test(`${event.status} ${event.severity}`); return `${event.source_system_id} ${event.from_node} ${event.to_node}`.toUpperCase().includes(filter); }
function statusText(status: SemanticStatus) { if (["healthy", "success"].includes(status)) return "정상"; if (["empty", "unknown"].includes(status)) return "데이터 없음"; if (["warning", "degraded", "stale"].includes(status)) return "주의"; return "수집 중"; }
function statusLabel(value: string | undefined | null) { const status = String(value || "").toUpperCase(); if (["HEALTHY", "LIVE", "COMPLETED", "OK", "WITHIN_RANGE", "COMPLETE_BALANCED"].includes(status)) return "정상"; if (["UNAVAILABLE", "FAILED", "CRITICAL"].includes(status)) return "연결 안 됨"; if (["NO_DATA", "UNKNOWN"].includes(status)) return "데이터 없음"; if (status === "PARTIAL_DATA") return "부분 수집"; return "주의"; }
function balanceStatusView(value?: string) { if (value === "COMPLETE_BALANCED" || value === "BALANCED") return { label: "안정", badge: "정상", status: "healthy" as SemanticStatus, description: "모든 수집 서비스가 목표 범위 안입니다." }; if (value === "PARTIAL_DATA") return { label: "부분 수집", badge: "부분 수집", status: "empty" as SemanticStatus, description: "수집된 서비스 재무 데이터만 기준으로 표시합니다." }; if (value === "NO_DATA" || !value) return { label: "데이터 없음", badge: "데이터 없음", status: "empty" as SemanticStatus, description: "재무 Runtime Mesh 수집을 기다리고 있습니다." }; return { label: "검토", badge: "검토", status: "warning" as SemanticStatus, description: "목표 이익률·적체·수익 집중도를 확인하세요." }; }
function balanceShortSummary(value?: string) { if (value === "PARTIAL_DATA") return "일부 서비스 재무 데이터 미수집"; if (value === "NO_DATA" || !value) return "재무 Runtime Mesh 수집 대기"; if (value === "COMPLETE_BALANCED" || value === "BALANCED") return "수집 범위 내 목표 기준 충족"; return "정책 기준 확인 필요"; }
