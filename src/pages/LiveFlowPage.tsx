import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AppData } from "../app/AppShell";
import { MetricCard } from "../components/shared/MetricCard";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { getLiveFlowCorrelation, getLiveFlowEntity, refreshLiveFlow, type LiveFlowEvent } from "../lib/backendApi";
import { formatTimeAgo, stringifyMeta } from "./pageUtils";

type FlowNodeId = "market" | "nexus" | "logistics" | "ledger" | "archiveos" | "settlement";
type FlowEdgeKind = "business" | "async" | "approval" | "settlement" | "monitoring";

const nodes: Array<{
  id: FlowNodeId;
  title: string;
  service: string;
  role: string;
  description: string;
}> = [
  { id: "market", title: "Demand / Order", service: "Archive-Market", role: "주문·결제", description: "수요, 주문, 매출 이벤트" },
  { id: "nexus", title: "Manufacturing", service: "Archive-Nexus", role: "제조", description: "생산, 재고, 출하 이벤트" },
  { id: "logistics", title: "Logistics", service: "Archive-Logistics", role: "물류", description: "배송, 경로, 물류비 이벤트" },
  { id: "ledger", title: "Finance / Ledger", service: "Archive-Ledger", role: "정산", description: "거래, 원장, 대사 이벤트" },
  { id: "archiveos", title: "Control Tower", service: "ArchiveOS", role: "AI 운영 오케스트레이터", description: "승인, 감사, 콜백 관제" },
  { id: "settlement", title: "Settlement", service: "Settlement", role: "정산 배치", description: "일일 정산과 대사 결과" },
];

const edges: Array<{ from: FlowNodeId; to: FlowNodeId; label: string; kind: FlowEdgeKind }> = [
  { from: "market", to: "nexus", label: "생산·출하 요청", kind: "business" },
  { from: "market", to: "ledger", label: "매출·결제·환불", kind: "settlement" },
  { from: "nexus", to: "logistics", label: "출하·배송", kind: "async" },
  { from: "nexus", to: "ledger", label: "제조 비용", kind: "settlement" },
  { from: "logistics", to: "ledger", label: "물류비 확정", kind: "settlement" },
  { from: "ledger", to: "archiveos", label: "승인 요청", kind: "approval" },
  { from: "archiveos", to: "ledger", label: "승인 콜백", kind: "approval" },
  { from: "ledger", to: "settlement", label: "정산·대사", kind: "settlement" },
  { from: "archiveos", to: "settlement", label: "정산 관제", kind: "monitoring" },
  { from: "market", to: "archiveos", label: "상태 요약", kind: "monitoring" },
  { from: "nexus", to: "archiveos", label: "상태 요약", kind: "monitoring" },
  { from: "logistics", to: "archiveos", label: "상태 요약", kind: "monitoring" },
  { from: "ledger", to: "archiveos", label: "정산 요약", kind: "monitoring" },
];

export function LiveFlowPage({ data, onRefresh }: { data: AppData; onRefresh: () => Promise<void> }) {
  const [selected, setSelected] = useState<LiveFlowEvent | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [correlationFilter, setCorrelationFilter] = useState("");
  const [chainEvents, setChainEvents] = useState<LiveFlowEvent[]>([]);
  const [chainLabel, setChainLabel] = useState("추적할 이벤트를 선택하세요.");

  const canRefresh = data.auth.role === "ADMIN";
  const summary = data.liveFlow;
  const topology = data.liveFlowTopology;
  const sourceEvents = data.liveFlowEvents;
  const runtime = summary?.runtime;
  const latestEvent = runtime?.latestEventAt || summary?.latest_event_at || sourceEvents[0]?.occurred_at || null;
  const workforceWarning = data.workforce?.summary.largestBottleneck || "병목 없음";
  const freshnessStatus = runtime?.freshnessStatus || freshnessFromLatest(latestEvent);
  const overallStatus = (summary?.failed_callbacks ?? 0) > 0 ? "critical" : (summary?.degraded_systems ?? 0) > 0 ? "degraded" : freshnessBadgeStatus(freshnessStatus);
  const isRuntimeBlocked = freshnessStatus === "STALE" || freshnessStatus === "NO_RUNTIME_EVENTS" || (runtime?.stalledServices?.length ?? 0) > 0;
  const staleMinutes = latestEvent ? Math.floor((Date.now() - new Date(latestEvent).getTime()) / 60000) : null;

  useEffect(() => {
    const timer = window.setInterval(() => {
      void onRefresh();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [onRefresh]);

  const filteredEvents = useMemo(() => {
    const text = correlationFilter.trim().toLowerCase();
    return sourceEvents
      .filter((event) => domainFilter === "all" || event.domain.toLowerCase() === domainFilter)
      .filter((event) => severityFilter === "all" || event.severity.toLowerCase() === severityFilter)
      .filter((event) => !text || (event.correlation_id || "").toLowerCase().includes(text))
      .slice(0, 120);
  }, [correlationFilter, domainFilter, severityFilter, sourceEvents]);

  async function refreshNow() {
    setMessage(null);
    try {
      const result = await refreshLiveFlow();
      setMessage(`실시간 관제 데이터를 갱신했습니다. 수집된 이벤트: ${result.collected ?? 0}건`);
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "실시간 관제 데이터 갱신에 실패했습니다.");
    }
  }

  function selectEvent(event: LiveFlowEvent) {
    setSelected(event);
    setChainEvents([]);
    setChainLabel("상관관계 또는 대상 기준으로 운영 흐름을 추적하세요.");
  }

  async function traceCorrelation(event: LiveFlowEvent) {
    if (!event.correlation_id) {
      setChainEvents([event]);
      setChainLabel("선택한 이벤트에 correlationId가 없어 단일 이벤트만 표시합니다.");
      return;
    }
    setMessage(null);
    try {
      const result = await getLiveFlowCorrelation(event.correlation_id);
      setChainEvents(result.data);
      setChainLabel(`상관관계 흐름: ${event.correlation_id} (${result.data.length}건)`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "상관관계 추적에 실패했습니다.");
    }
  }

  async function traceEntity(event: LiveFlowEvent) {
    setMessage(null);
    try {
      const result = await getLiveFlowEntity(event.entity_id);
      setChainEvents(result.data);
      setChainLabel(`대상 흐름: ${event.entity_id} (${result.data.length}건)`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "대상 흐름 추적에 실패했습니다.");
    }
  }

  if (!summary || !topology) {
    return <div className="empty-state">실시간 관제 데이터를 불러오지 못했습니다. archiveos-ai live-flow API 상태를 확인하세요.</div>;
  }

  return (
    <div className="page-stack live-flow-page polished-live-flow">
      <header className="live-flow-hero mesh-hero">
        <div>
          <span className="eyebrow">LIVE MESH TOPOLOGY</span>
          <h2>실시간 관제</h2>
          <p>Archive 생태계의 메쉬형 운영 흐름을 실시간으로 확인합니다.</p>
          <div className="flow-badge-row">
            <StatusBadge status="working">실시간</StatusBadge>
            <StatusBadge status="info">합성 이벤트</StatusBadge>
            <StatusBadge status={overallStatus}>{freshnessStatusLabel(freshnessStatus)}</StatusBadge>
            <span>권한: {data.auth.role}</span>
            <span>자동 갱신: 10초</span>
            <span>최근 갱신: {data.refreshedAt ? formatTimeAgo(data.refreshedAt) : "대기 중"}</span>
          </div>
        </div>
        <div className="inline-actions wrap">
          <button className="button button-primary" type="button" disabled={!canRefresh} onClick={() => void refreshNow()}>수동 갱신</button>
        </div>
      </header>

      <div className="live-flow-warning">
        <strong>합성 런타임 이벤트만 사용합니다.</strong>
        <span>실제 고객, 결제, 계좌, 금융 데이터는 사용하지 않습니다.</span>
        <span>Safe-mode 기준으로 외부 쓰기는 차단되며, 현재 화면은 read-only 관제만 수행합니다.</span>
      </div>
      {isRuntimeBlocked ? (
        <div className="live-flow-warning stale-warning">
          <strong>{freshnessStatus === "NO_RUNTIME_EVENTS" ? "최근 실행 이벤트가 없습니다." : freshnessStatus === "STALE" ? "운영 흐름이 정체되었습니다." : "일부 서비스 실행이 정체되었습니다."}</strong>
          <span>{runtime?.reason || "서비스는 실행 중이지만 최근 운영 이벤트가 없습니다. 자동 실행 루프 또는 outbox publisher 상태를 확인하세요."}</span>
          {runtime?.stalledServices?.length ? <span>정체 서비스: {runtime.stalledServices.join(", ")}</span> : null}
          {staleMinutes !== null && staleMinutes >= 1 ? <span>마지막 이벤트: 약 {staleMinutes}분 전</span> : null}
        </div>
      ) : null}
      {message ? <p className="small-note">{message}</p> : null}

      <section className="live-flow-metrics compact-mesh-kpis">
        <MetricCard label="활성 흐름" value={summary.active_flows ?? 0} status={(summary.active_flows ?? 0) > 0 ? "working" : "idle"} description="최근 구간" />
        <MetricCard label="최근 이벤트" value={summary.recent_events ?? 0} status={(summary.recent_events ?? 0) > 0 ? "healthy" : "empty"} description={freshnessStatusLabel(freshnessStatus)} />
        <MetricCard label="승인 대기" value={summary.pending_approvals ?? 0} status={(summary.pending_approvals ?? 0) > 0 ? "blocked" : "healthy"} description="승인 게이트" />
        <MetricCard label="지연/병목" value={summary.delayed_shipments ?? 0} status={(summary.delayed_shipments ?? 0) > 0 ? "warning" : (data.workforce?.summary.totalBacklog ?? 0) > 0 ? "warning" : "healthy"} description={workforceWarning} />
        <MetricCard label="오류/실패" value={summary.failed_callbacks ?? 0} status={(summary.failed_callbacks ?? 0) > 0 ? "critical" : "healthy"} description="콜백·수집 실패" />
        <MetricCard label="최근 이벤트 시각" value={latestEvent ? formatTimeAgo(latestEvent) : "없음"} status={freshnessBadgeStatus(freshnessStatus)} description={`파이프라인: ${pipelineStatusLabel(runtime?.pipelineStatus || freshnessStatus)}`} />
      </section>

      <section className="live-flow-board-layout">
        <SectionCard title="라이브 메쉬 토폴로지" eyebrow={`${filteredEvents.length}개 이벤트 표시 중`} className="span-12 live-mesh-section">
          <MeshFlowBoard events={filteredEvents} runtimeServices={runtime?.services || []} selected={selected} onSelect={selectEvent} />
        </SectionCard>

        <SectionCard title="선택 이벤트 요약" eyebrow="상세 정보와 운영 영향" className="span-12 live-detail-section">
          <EventDetailPanel
            event={selected}
            workforce={data.workforce?.services || []}
            onTraceCorrelation={traceCorrelation}
            onTraceEntity={traceEntity}
          />
        </SectionCard>

        <SectionCard title="이벤트 흐름" eyebrow="실시간 이벤트 / 조건 검색" className="span-7 live-events-section">
          <div className="replay-bar live-flow-toolbar real-time-toolbar">
            <select value={domainFilter} aria-label="도메인 필터" onChange={(event) => setDomainFilter(event.target.value)}>
              <option value="all">도메인 전체</option>
              <option value="market">Market</option>
              <option value="nexus">Nexus</option>
              <option value="logistics">Logistics</option>
              <option value="ledger">Ledger</option>
              <option value="archiveos">ArchiveOS</option>
            </select>
            <select value={severityFilter} aria-label="심각도 필터" onChange={(event) => setSeverityFilter(event.target.value)}>
              <option value="all">심각도 전체</option>
              <option value="normal">normal</option>
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="critical">critical</option>
            </select>
            <input value={correlationFilter} onChange={(event) => setCorrelationFilter(event.target.value)} placeholder="correlationId 검색" />
            <button className="button button-secondary" type="button" onClick={() => { setDomainFilter("all"); setSeverityFilter("all"); setCorrelationFilter(""); }}>필터 초기화</button>
          </div>
          <div className="event-list compact live-event-list">
            {filteredEvents.slice(0, 24).map((event) => (
              <button className="event-row clickable" type="button" key={event.event_id} onClick={() => selectEvent(event)}>
                <span>{formatTimeAgo(event.occurred_at)}</span>
                <StatusBadge status={event.status}>{statusLabel(event.status)}</StatusBadge>
                <strong>{event.display_label}</strong>
                <p>{routeLabel(event)} / {event.event_type} / {event.correlation_id || "상관관계 없음"}</p>
              </button>
            ))}
            {!filteredEvents.length ? <div className="empty-state">최근 실시간 관제 이벤트가 없습니다. 외부 서비스의 outbox, scheduler, publish 상태를 확인하세요.</div> : null}
          </div>
        </SectionCard>

        <SectionCard title="연관 흐름" eyebrow={chainLabel} className="span-5 live-chain-section">
          <div className="flow-chain">
            {chainEvents.map((event, index) => (
              <button className="chain-step" type="button" key={`${event.event_id}-${index}`} onClick={() => setSelected(event)}>
                <span className="chain-index">{index + 1}</span>
                <StatusBadge status={event.status}>{statusLabel(event.status)}</StatusBadge>
                <strong>{event.display_label}</strong>
                <small>{event.source_system_id} / {event.entity_type} / {formatTimeAgo(event.occurred_at)}</small>
              </button>
            ))}
            {!chainEvents.length ? <div className="empty-state">이벤트를 선택한 뒤 correlationId 또는 entityId 기준으로 흐름을 추적하세요.</div> : null}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

function MeshFlowBoard({ events, runtimeServices, selected, onSelect }: {
  events: LiveFlowEvent[];
  runtimeServices: NonNullable<NonNullable<AppData["liveFlow"]>["runtime"]>["services"];
  selected: LiveFlowEvent | null;
  onSelect: (event: LiveFlowEvent) => void;
}) {
  const nodeStats = buildNodeStats(events, runtimeServices || []);
  const tokenGroups = buildTokenGroups(events);

  return (
    <div className="mesh-flow-board">
      <svg className="mesh-edge-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {edges.map((edge) => {
          const from = nodePoint(edge.from);
          const to = nodePoint(edge.to);
          const controlY = edge.kind === "monitoring" ? Math.max(from.y, to.y) + 10 : (from.y + to.y) / 2;
          return (
            <g key={`${edge.from}-${edge.to}-${edge.label}`} className={`mesh-edge mesh-edge-${edge.kind}`}>
              <path d={`M ${from.x} ${from.y} C ${from.x} ${controlY}, ${to.x} ${controlY}, ${to.x} ${to.y}`} />
            </g>
          );
        })}
      </svg>

      <div className="mesh-node-layer">
        {nodes.map((node) => {
          const point = nodePoint(node.id);
          const stat = nodeStats[node.id];
          return (
            <article className={`mesh-node mesh-node-${node.id}`} key={node.id} style={{ left: `${point.x}%`, top: `${point.y}%` }}>
              <span className="mesh-node-title">{node.title}</span>
              <strong>{node.service}</strong>
              <small>{node.role}</small>
              <p>{node.description}</p>
              <div className="mesh-node-footer">
                <StatusBadge status={stat.status}>{statusLabel(stat.status)}</StatusBadge>
                <span>이벤트 {stat.count}건</span>
                <span>대기 {stat.backlog}건</span>
                {stat.runtimeLabel ? <span>{stat.runtimeLabel}</span> : null}
              </div>
            </article>
          );
        })}
      </div>

      <div className="mesh-token-layer">
        {tokenGroups.map((group, index) => (
          <button
            className={`mesh-token token-${group.severity} token-type-${group.entityType} ${selected?.event_id === group.event.event_id ? "selected" : ""}`}
            key={group.event.event_id}
            style={{ left: `${group.x}%`, top: `${group.y}%`, ["--token-index" as string]: String(index % 8) }}
            type="button"
            title={`${group.event.event_type} / ${routeLabel(group.event)} / ${statusLabel(group.event.status)}`}
            onClick={() => onSelect(group.event)}
          >
            <span>{entityIcon(group.entityType)}</span>
            {group.count > 1 ? <strong>+{group.count}</strong> : null}
          </button>
        ))}
        {!events.length ? <div className="mesh-empty-overlay">최근 실시간 관제 이벤트가 없습니다. 외부 서비스가 기동 중이면 outbox publish와 scheduler 상태를 확인하세요.</div> : null}
      </div>

      <div className="mesh-legend">
        <span><i className="legend-normal" /> 정상 이벤트</span>
        <span><i className="legend-working" /> 처리중 이벤트</span>
        <span><i className="legend-waiting" /> 대기 이벤트</span>
        <span><i className="legend-warning" /> 지연 이벤트</span>
        <span><i className="legend-business" /> 주요 흐름</span>
        <span><i className="legend-async" /> 비동기 흐름</span>
        <span><i className="legend-approval" /> 승인/검증</span>
        <span><i className="legend-monitoring" /> 데이터 동기화</span>
      </div>
    </div>
  );
}

function EventDetailPanel({ event, workforce, onTraceCorrelation, onTraceEntity }: {
  event: LiveFlowEvent | null;
  workforce: NonNullable<AppData["workforce"]>["services"];
  onTraceCorrelation: (event: LiveFlowEvent) => void;
  onTraceEntity: (event: LiveFlowEvent) => void;
}) {
  if (!event) return <div className="empty-state">이벤트를 선택하면 상세 정보가 표시됩니다.</div>;

  const metadata = event.metadata || {};
  const workforceImpact = workforce.find((item) => item.serviceId === event.source_system_id || item.serviceType.toLowerCase() === event.domain.toLowerCase());
  const context = [
    ["orderId", metadata.orderId],
    ["shipmentId", metadata.shipmentId],
    ["routeId", metadata.routeId],
    ["transactionId", metadata.transactionId],
    ["approvalRequestId", metadata.approvalRequestId],
    ["settlementCycleId", metadata.settlementCycleId],
  ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "") as Array<[string, unknown]>;
  const impact = [
    event.status === "approval_required" || event.event_type.includes("APPROVAL") ? "승인 검토 필요" : null,
    event.status === "delayed" || event.event_type.includes("DELAY") ? "배송/처리 지연" : null,
    event.status === "failed" || event.event_type.includes("FAILED") ? "실패 이벤트" : null,
    event.status === "unavailable" ? "외부 서비스 응답 없음" : null,
    workforceImpact?.capacityShortage ? "작업 역량 부족" : null,
    workforceImpact && workforceImpact.backlog > 0 ? `적체 ${workforceImpact.backlog}건` : null,
  ].filter(Boolean);

  return (
    <div className="event-detail-panel structured-detail">
      <div className="detail-title-row">
        <div>
          <span className="eyebrow">선택 이벤트</span>
          <h3>{event.display_label}</h3>
        </div>
        <div className="inline-actions compact-actions">
          <StatusBadge status={event.severity}>{statusLabel(event.severity)}</StatusBadge>
          <StatusBadge status={event.status}>{statusLabel(event.status)}</StatusBadge>
        </div>
      </div>

      <DetailSection title="이벤트 요약">
        <span>eventType<strong>{event.event_type}</strong></span>
        <span>서비스<strong>{event.source_system_id}</strong></span>
        <span>경로<strong>{routeLabel(event)}</strong></span>
        <span>상태<strong>{statusLabel(event.status)}</strong></span>
        <span>발생 시각<strong>{formatTimeAgo(event.occurred_at)}</strong></span>
      </DetailSection>

      <DetailSection title="연관 흐름">
        <span>correlationId<strong>{event.correlation_id || "없음"}</strong></span>
        <span>causationId<strong>{String(metadata.causationId || "없음")}</strong></span>
        {context.map(([label, value]) => <span key={label}>{label}<strong>{String(value)}</strong></span>)}
        <div className="inline-actions wrap detail-actions">
          <button className="button button-secondary" type="button" onClick={() => void onTraceCorrelation(event)}>관련 흐름 보기</button>
          <button className="button button-secondary" type="button" onClick={() => void onTraceEntity(event)}>대상 흐름 보기</button>
        </div>
      </DetailSection>

      <DetailSection title="운영 영향">
        {impact.length ? impact.map((item) => <span key={String(item)}>영향<strong>{String(item)}</strong></span>) : <span>영향<strong>감지된 운영 영향 없음</strong></span>}
        {workforceImpact ? <>
          <span>병목 역할<strong>{workforceImpact.bottleneckRole}</strong></span>
          <span>생산성<strong>{String(workforceImpact.productivityScore)}</strong></span>
        </> : <span>작업 역량<strong>연결된 작업 역량 스냅샷 없음</strong></span>}
      </DetailSection>

      <details>
        <summary>메타데이터</summary>
        <pre>{safeStringify(metadata)}</pre>
      </details>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="detail-section"><h4>{title}</h4><dl className="detail-grid compact">{children}</dl></section>;
}

function buildNodeStats(events: LiveFlowEvent[], runtimeServices: NonNullable<NonNullable<AppData["liveFlow"]>["runtime"]>["services"] = []) {
  const stats = Object.fromEntries(nodes.map((node) => [node.id, { count: 0, backlog: 0, status: "idle", runtimeLabel: "" }])) as Record<FlowNodeId, { count: number; backlog: number; status: string; runtimeLabel: string }>;
  for (const event of events) {
    for (const node of new Set([normalizeNode(event.source_system_id || event.domain), normalizeNode(event.from_node || ""), normalizeNode(event.to_node || "")])) {
      stats[node].count += 1;
      if (event.status === "waiting" || event.status === "approval_required") stats[node].backlog += 1;
      if (event.status === "failed" || event.severity === "critical") stats[node].status = "critical";
      else if (event.status === "delayed" || event.severity === "warning") stats[node].status = stats[node].status === "critical" ? "critical" : "warning";
      else if (stats[node].status === "idle") stats[node].status = "healthy";
    }
  }
  for (const service of runtimeServices || []) {
    const node = runtimeServiceToNode(service.serviceId || service.serviceName);
    const mapped = runtimeStatusToBadge(service.runtimeStatus);
    stats[node].status = mapped.priority >= statusPriority(stats[node].status) ? mapped.status : stats[node].status;
    stats[node].runtimeLabel = runtimeStatusLabel(service.runtimeStatus);
    if (typeof service.backlogCount === "number" && service.backlogCount > stats[node].backlog) stats[node].backlog = service.backlogCount;
  }
  return stats;
}

function buildTokenGroups(events: LiveFlowEvent[]) {
  const groups = new Map<string, { event: LiveFlowEvent; count: number; severity: string; entityType: string; x: number; y: number }>();
  for (const [index, event] of events.slice(0, 96).entries()) {
    const from = normalizeNode(event.from_node || event.source_system_id || event.domain);
    const to = normalizeNode(event.to_node || event.domain);
    const key = `${from}-${to}-${event.entity_type}-${event.status}-${Math.floor(index / 8)}`;
    const point = tokenPoint(from, to, index);
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (severityRank(event.severity) > severityRank(existing.severity)) existing.severity = tokenTone(event);
    } else {
      groups.set(key, { event, count: 1, severity: tokenTone(event), entityType: event.entity_type, x: point.x, y: point.y });
    }
  }
  return [...groups.values()];
}

function nodePoint(node: FlowNodeId) {
  const points: Record<FlowNodeId, { x: number; y: number }> = {
    market: { x: 16, y: 22 },
    nexus: { x: 50, y: 18 },
    logistics: { x: 84, y: 22 },
    ledger: { x: 18, y: 70 },
    archiveos: { x: 52, y: 72 },
    settlement: { x: 84, y: 70 },
  };
  return points[node];
}

function tokenPoint(from: FlowNodeId, to: FlowNodeId, index: number) {
  const a = nodePoint(from);
  const b = nodePoint(to);
  const progress = ((index % 9) + 1) / 10;
  const offset = ((index % 5) - 2) * 1.35;
  return { x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress + offset };
}

function normalizeNode(value: string): FlowNodeId {
  const node = (value || "").toLowerCase();
  if (node.includes("market") || node.includes("order") || node.includes("demand")) return "market";
  if (node.includes("logistics") || node.includes("logitics") || node.includes("shipment") || node.includes("route")) return "logistics";
  if (node.includes("nexus") || node.includes("factory") || node.includes("manufacturing")) return "nexus";
  if (node.includes("settlement")) return "settlement";
  if (node.includes("ledger") || node.includes("transaction") || node.includes("finance")) return "ledger";
  if (node.includes("archiveos") || node.includes("archive-os") || node.includes("approval") || node.includes("audit") || node.includes("callback")) return "archiveos";
  return "archiveos";
}

function routeLabel(event: LiveFlowEvent) {
  const from = event.from_node || event.source_system_id || event.domain;
  const to = event.to_node || event.domain;
  return `${from} → ${to}`;
}

function entityIcon(value: string) {
  const entity = value.toLowerCase();
  if (entity.includes("order")) return "O";
  if (entity.includes("shipment") || entity.includes("route") || entity.includes("truck")) return "S";
  if (entity.includes("factory") || entity.includes("equipment")) return "F";
  if (entity.includes("transaction")) return "T";
  if (entity.includes("approval")) return "A";
  if (entity.includes("settlement")) return "₩";
  if (entity.includes("callback")) return "C";
  if (entity.includes("audit")) return "L";
  return "E";
}

function tokenTone(event: LiveFlowEvent) {
  const status = event.status.toLowerCase();
  if (status.includes("approved") || status.includes("completed") || status.includes("settled")) return "completed";
  if (status.includes("approval")) return "approval";
  if (status.includes("failed") || status.includes("critical")) return "critical";
  if (status.includes("waiting")) return "waiting";
  if (status.includes("moving") || status.includes("created")) return "working";
  if (status.includes("delayed")) return "warning";
  return event.severity || "normal";
}

function severityRank(value: string) {
  const severity = value.toLowerCase();
  if (severity === "critical") return 4;
  if (severity === "warning") return 3;
  if (severity === "info") return 2;
  return 1;
}

function freshnessFromLatest(latest: string | null) {
  if (!latest) return "NO_RUNTIME_EVENTS";
  const ageSeconds = Math.floor((Date.now() - new Date(latest).getTime()) / 1000);
  if (!Number.isFinite(ageSeconds)) return "NO_RUNTIME_EVENTS";
  if (ageSeconds <= 60) return "LIVE";
  if (ageSeconds <= 300) return "SLOW";
  return "STALE";
}

function freshnessStatusLabel(value: string) {
  const status = String(value || "").toUpperCase();
  if (status === "LIVE") return "실시간 정상";
  if (status === "SLOW") return "이벤트 지연";
  if (status === "STALE") return "흐름 정체";
  if (status === "NO_RUNTIME_EVENTS") return "최근 실행 이벤트 없음";
  if (status === "DEGRADED") return "주의";
  return statusLabel(value);
}

function freshnessBadgeStatus(value: string) {
  const status = String(value || "").toUpperCase();
  if (status === "LIVE") return "healthy";
  if (status === "SLOW") return "warning";
  if (status === "STALE" || status === "NO_RUNTIME_EVENTS") return "critical";
  if (status === "DEGRADED") return "warning";
  return "idle";
}

function pipelineStatusLabel(value: string) {
  const status = String(value || "").toUpperCase();
  if (status === "LIVE") return "실시간";
  if (status === "SLOW") return "지연";
  if (status === "STALE") return "정체";
  if (status === "NO_RUNTIME_EVENTS") return "이벤트 없음";
  if (status === "DEGRADED") return "주의";
  if (status.includes("LIVE")) return "실시간";
  return value || "대기";
}

function runtimeServiceToNode(value: string): FlowNodeId {
  return normalizeNode(value);
}

function runtimeStatusToBadge(value: string) {
  const status = String(value || "").toUpperCase();
  if (status === "FAILED") return { status: "critical", priority: 5 };
  if (status === "STALLED") return { status: "critical", priority: 5 };
  if (status === "WARNING") return { status: "warning", priority: 4 };
  if (status === "WAITING") return { status: "waiting", priority: 3 };
  if (status === "PROCESSING") return { status: "working", priority: 2 };
  if (status === "HEALTHY") return { status: "healthy", priority: 1 };
  return { status: "idle", priority: 0 };
}

function runtimeStatusLabel(value: string) {
  const status = String(value || "").toUpperCase();
  if (status === "PROCESSING") return "처리중";
  if (status === "WAITING") return "대기";
  if (status === "STALLED") return "정체";
  if (status === "WARNING") return "주의";
  if (status === "FAILED") return "실패";
  if (status === "HEALTHY") return "정상";
  return "대기";
}

function statusPriority(value: string) {
  const status = String(value || "").toLowerCase();
  if (status === "critical" || status === "failed") return 5;
  if (status === "warning" || status === "degraded") return 4;
  if (status === "waiting" || status === "blocked") return 3;
  if (status === "working" || status === "running") return 2;
  if (status === "healthy") return 1;
  return 0;
}

function statusLabel(value: string) {
  const status = String(value || "").toLowerCase();
  if (status === "healthy" || status === "normal" || status === "completed" || status === "settled" || status === "approved") return "정상";
  if (status === "degraded" || status === "warning" || status === "delayed") return "주의";
  if (status === "unavailable" || status === "not_connected" || status === "disconnected") return "연결 안 됨";
  if (status === "blocked") return "차단됨";
  if (status === "idle" || status === "empty" || status === "waiting") return "대기";
  if (status === "critical" || status === "failed" || status === "rejected") return "긴급";
  if (status === "approval_required") return "승인 필요";
  if (status === "info") return "정보";
  if (status === "working" || status === "running" || status === "moving") return "진행 중";
  if (status === "created") return "생성됨";
  if (status === "completed") return "완료";
  return value;
}

function safeStringify(value: Record<string, unknown>) {
  return stringifyMeta(maskSensitive(value));
}

function maskSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSensitive);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => {
    if (/secret|token|password|webhook|private.?key|api.?key/i.test(key)) return [key, "***masked***"];
    return [key, maskSensitive(item)];
  }));
}
