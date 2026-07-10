import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AppData } from "../app/AppShell";
import { MetricCard } from "../components/shared/MetricCard";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { getLiveFlowCorrelation, getLiveFlowEntity, getLiveFlowReplay, refreshLiveFlow, type LiveFlowEvent } from "../lib/backendApi";
import { formatTimeAgo, stringifyMeta } from "./pageUtils";

type FlowMode = "LIVE" | "REPLAY" | "DEMO";
type FlowLaneId = "market" | "nexus" | "logistics" | "ledger" | "archiveos" | "settlement";
type FlowEdgeKind = "business" | "finance" | "approval" | "monitoring";

const lanes: Array<{
  id: FlowLaneId;
  title: string;
  service: string;
  role: string;
  description: string;
}> = [
  { id: "market", title: "Demand / Order", service: "Archive-Market", role: "주문·결제", description: "수요, 주문, 매출 이벤트" },
  { id: "nexus", title: "Manufacturing", service: "Archive-Nexus", role: "제조", description: "생산, 출하, 품질 이벤트" },
  { id: "logistics", title: "Logistics", service: "Archive-Logistics", role: "물류", description: "배송, 경로, 물류비 이벤트" },
  { id: "ledger", title: "Finance / Ledger", service: "Archive-Ledger", role: "정산", description: "거래, 원장, 대사 이벤트" },
  { id: "settlement", title: "Settlement", service: "Settlement", role: "정산 배치", description: "일일 정산과 대사 결과" },
  { id: "archiveos", title: "Control / Approval", service: "ArchiveOS", role: "운영 관제", description: "승인, 감사, 콜백 관제" },
];

const edges: Array<{ from: FlowLaneId; to: FlowLaneId; label: string; kind: FlowEdgeKind }> = [
  { from: "market", to: "nexus", label: "생산 요청", kind: "business" },
  { from: "market", to: "ledger", label: "주문·결제", kind: "finance" },
  { from: "nexus", to: "logistics", label: "출하·배송", kind: "business" },
  { from: "nexus", to: "ledger", label: "제조 비용", kind: "finance" },
  { from: "logistics", to: "ledger", label: "물류 비용", kind: "finance" },
  { from: "ledger", to: "settlement", label: "일정산", kind: "finance" },
  { from: "ledger", to: "archiveos", label: "승인 요청", kind: "approval" },
  { from: "archiveos", to: "ledger", label: "콜백", kind: "approval" },
  { from: "market", to: "archiveos", label: "상태 요약", kind: "monitoring" },
  { from: "nexus", to: "archiveos", label: "상태 요약", kind: "monitoring" },
  { from: "logistics", to: "archiveos", label: "상태 요약", kind: "monitoring" },
];

export function LiveFlowPage({ data, onRefresh }: { data: AppData; onRefresh: () => Promise<void> }) {
  const [mode, setMode] = useState<FlowMode>("LIVE");
  const [selected, setSelected] = useState<LiveFlowEvent | null>(null);
  const [replayEvents, setReplayEvents] = useState<LiveFlowEvent[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [domainFilter, setDomainFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [correlationFilter, setCorrelationFilter] = useState("");
  const [chainEvents, setChainEvents] = useState<LiveFlowEvent[]>([]);
  const [chainLabel, setChainLabel] = useState("추적할 체인을 선택하세요");
  const canRefresh = data.auth.role === "ADMIN";
  const summary = data.liveFlow;
  const topology = data.liveFlowTopology;
  const sourceEvents = mode === "REPLAY" ? replayEvents : data.liveFlowEvents;
  const latestEvent = summary?.latest_event_at || sourceEvents[0]?.occurred_at || null;
  const workforceWarning = data.workforce?.summary.largestBottleneck || "병목 없음";
  const overallStatus = (summary?.failed_callbacks ?? 0) > 0 ? "critical" : (summary?.degraded_systems ?? 0) > 0 ? "degraded" : "healthy";

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

  async function loadReplay() {
    setMessage(null);
    try {
      const result = await getLiveFlowReplay(200);
      setReplayEvents(result.data);
      setMode("REPLAY");
      setMessage(`저장된 런타임 이벤트 ${result.data.length}건을 불러왔습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "재생 데이터를 불러오지 못했습니다.");
    }
  }

  function selectEvent(event: LiveFlowEvent) {
    setSelected(event);
    setChainEvents([]);
    setChainLabel("상관관계 또는 엔터티 기준으로 운영 체인을 추적하세요.");
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
      setChainLabel(`상관관계 체인: ${event.correlation_id} (${result.data.length}건)`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "상관관계 추적에 실패했습니다.");
    }
  }

  async function traceEntity(event: LiveFlowEvent) {
    setMessage(null);
    try {
      const result = await getLiveFlowEntity(event.entity_id);
      setChainEvents(result.data);
      setChainLabel(`엔터티 체인: ${event.entity_id} (${result.data.length}건)`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "엔터티 추적에 실패했습니다.");
    }
  }

  if (!summary || !topology) {
    return <div className="empty-state">실시간 관제 데이터를 불러오지 못했습니다. archiveos-ai live-flow API와 Flyway V14 적용 상태를 확인하세요.</div>;
  }

  return (
    <div className="page-stack live-flow-page polished-live-flow">
      <header className="live-flow-hero">
        <div>
          <span className="eyebrow">LIVE FLOW</span>
          <h2>실시간 관제</h2>
          <p>Archive 서비스의 주문·제조·물류·정산·승인 흐름을 실시간으로 확인합니다.</p>
          <div className="flow-badge-row">
            <StatusBadge status={mode === "LIVE" ? "working" : "info"}>{modeLabel(mode)}</StatusBadge>
            <StatusBadge status="info">합성 이벤트</StatusBadge>
            <StatusBadge status={overallStatus}>{statusLabel(overallStatus)}</StatusBadge>
            <span>권한: {data.auth.role}</span>
            <span>최근 갱신: {data.refreshedAt ? formatTimeAgo(data.refreshedAt) : "대기 중"}</span>
          </div>
        </div>
        <div className="inline-actions wrap">
          <button className="button button-secondary" type="button" onClick={() => setMode("LIVE")}>실시간</button>
          <button className="button button-secondary" type="button" onClick={() => void loadReplay()}>재생</button>
          <button className="button button-secondary" type="button" onClick={() => { setMode("DEMO"); setReplayEvents(data.liveFlowEvents); }}>데모</button>
          <button className="button button-primary" type="button" disabled={!canRefresh} onClick={() => void refreshNow()}>수동 갱신</button>
        </div>
      </header>

      <div className="live-flow-warning">
        <strong>합성 런타임 이벤트만 사용합니다.</strong>
        <span>실제 고객, 결제, 계좌, 금융 데이터는 사용하지 않습니다.</span>
        <span>Safe-mode 기준으로 외부 쓰기는 차단되며, Public/Operator/PM 세션에서는 조회만 가능합니다.</span>
      </div>
      {message ? <p className="small-note">{message}</p> : null}

      <section className="live-flow-metrics">
        <MetricCard label="활성 흐름" value={summary.active_flows ?? 0} status={(summary.active_flows ?? 0) > 0 ? "working" : "idle"} description="최근 구간" />
        <MetricCard label="최근 이벤트" value={summary.recent_events ?? 0} status={(summary.recent_events ?? 0) > 0 ? "healthy" : "empty"} description="수집된 이벤트" />
        <MetricCard label="승인 대기" value={summary.pending_approvals ?? 0} status={(summary.pending_approvals ?? 0) > 0 ? "blocked" : "healthy"} description="승인 게이트" />
        <MetricCard label="배송 지연" value={summary.delayed_shipments ?? 0} status={(summary.delayed_shipments ?? 0) > 0 ? "warning" : "healthy"} description="지연 경로" />
        <MetricCard label="콜백 실패" value={summary.failed_callbacks ?? 0} status={(summary.failed_callbacks ?? 0) > 0 ? "critical" : "healthy"} description="재시도 확인" />
        <MetricCard label="주의 시스템" value={summary.degraded_systems ?? 0} status={(summary.degraded_systems ?? 0) > 0 ? "degraded" : "healthy"} description="수집 저하" />
        <MetricCard label="작업 병목" value={workforceWarning} status={(data.workforce?.summary.totalBacklog ?? 0) > 0 ? "warning" : "healthy"} description={`적체 ${data.workforce?.summary.totalBacklog ?? 0}건`} />
        <MetricCard label="최근 발생" value={latestEvent ? formatTimeAgo(latestEvent) : "없음"} status={latestEvent ? "healthy" : "idle"} description="마지막 이벤트" />
      </section>

      <section className="live-flow-board-layout">
        <SectionCard title="주요 흐름" eyebrow={`${filteredEvents.length}개 이벤트 표시 중`} className="span-8">
          <LaneFlowBoard events={filteredEvents} selected={selected} paused={paused} speed={speed} onSelect={selectEvent} />
        </SectionCard>

        <SectionCard title="선택한 이벤트" eyebrow="상세 정보와 운영 영향" className="span-4">
          <EventDetailPanel
            event={selected}
            workforce={data.workforce?.services || []}
            onTraceCorrelation={traceCorrelation}
            onTraceEntity={traceEntity}
          />
        </SectionCard>

        <SectionCard title="재생 및 필터" eyebrow="실시간 / 재생 / 조건 검색" className="span-12">
          <div className="replay-bar live-flow-toolbar">
            <button className="button button-secondary" type="button" onClick={() => setMode("LIVE")}>실시간</button>
            <button className="button button-secondary" type="button" onClick={() => void loadReplay()}>재생</button>
            <button className="button button-secondary" type="button" onClick={() => setPaused((value) => !value)}>{paused ? "재생" : "일시정지"}</button>
            {[1, 2, 5].map((next) => <button className="button button-secondary" type="button" key={next} onClick={() => setSpeed(next)}>{next}x</button>)}
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
            <span>최근 10분 / 1시간 / 24시간 선택은 저장 이벤트 기준으로 확장 예정</span>
          </div>
        </SectionCard>

        <SectionCard title="최근 이벤트" eyebrow="ArchiveOS가 정리한 런타임 이벤트" className="span-7">
          <div className="event-list compact">
            {filteredEvents.slice(0, 24).map((event) => (
              <button className="event-row clickable" type="button" key={event.event_id} onClick={() => selectEvent(event)}>
                <span>{formatTimeAgo(event.occurred_at)}</span>
                <StatusBadge status={event.status}>{statusLabel(event.status)}</StatusBadge>
                <strong>{event.display_label}</strong>
                <p>{event.from_node} → {event.to_node} / {event.event_type} / {event.correlation_id || "상관관계 없음"}</p>
              </button>
            ))}
            {!filteredEvents.length ? <div className="empty-state">최근 실시간 관제 이벤트가 없습니다. 수동 갱신 또는 재생 모드에서 저장된 합성 이벤트를 확인할 수 있습니다.</div> : null}
          </div>
        </SectionCard>

        <SectionCard title="이벤트 연결" eyebrow={chainLabel} className="span-5">
          <div className="flow-chain">
            {chainEvents.map((event, index) => (
              <button className="chain-step" type="button" key={`${event.event_id}-${index}`} onClick={() => setSelected(event)}>
                <span className="chain-index">{index + 1}</span>
                <StatusBadge status={event.status}>{statusLabel(event.status)}</StatusBadge>
                <strong>{event.display_label}</strong>
                <small>{event.source_system_id} / {event.entity_type} / {formatTimeAgo(event.occurred_at)}</small>
              </button>
            ))}
            {!chainEvents.length ? <div className="empty-state">이벤트를 선택한 뒤 correlationId 또는 entityId 기준으로 추적하세요.</div> : null}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

function LaneFlowBoard({ events, selected, paused, speed, onSelect }: {
  events: LiveFlowEvent[];
  selected: LiveFlowEvent | null;
  paused: boolean;
  speed: number;
  onSelect: (event: LiveFlowEvent) => void;
}) {
  const laneStats = buildLaneStats(events);
  const edgeGroups = buildEdgeGroups(events);

  return (
    <div className={`lane-flow-board ${paused ? "is-paused" : ""}`} style={{ ["--flow-speed" as string]: String(speed) }}>
      <div className="lane-grid">
        {lanes.map((lane) => (
          <article className={`lane-node lane-${lane.id}`} key={lane.id}>
              <span className="lane-title">{lane.title}</span>
              <strong>{lane.service}</strong>
              <small>{lane.role}</small>
              <p>{lane.description}</p>
              <div className="lane-node-footer">
              <StatusBadge status={laneStats[lane.id].status}>{statusLabel(laneStats[lane.id].status)}</StatusBadge>
              <span>이벤트 {laneStats[lane.id].count}건</span>
              <span>대기 {laneStats[lane.id].backlog}건</span>
            </div>
          </article>
        ))}
      </div>
      <svg className="lane-edge-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {edges.map((edge) => {
          const from = lanePoint(edge.from);
          const to = lanePoint(edge.to);
          return (
            <g key={`${edge.from}-${edge.to}-${edge.label}`} className={`lane-edge lane-edge-${edge.kind}`}>
              <path d={`M ${from.x} ${from.y} C ${(from.x + to.x) / 2} ${from.y}, ${(from.x + to.x) / 2} ${to.y}, ${to.x} ${to.y}`} />
              <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 1}>{edge.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="lane-token-layer">
        {edgeGroups.map((group, index) => (
          <button
            className={`lane-token token-${group.severity} token-type-${group.entityType} ${selected?.event_id === group.event.event_id ? "selected" : ""}`}
            key={group.event.event_id}
            style={{ left: `${group.x}%`, top: `${group.y}%`, ["--token-index" as string]: String(index % 7) }}
            type="button"
            title={`${group.event.event_type} / ${group.event.source_system_id} / ${statusLabel(group.event.status)} / ${group.event.correlation_id || "상관관계 없음"}`}
            onClick={() => onSelect(group.event)}
          >
            <span>{entityIcon(group.entityType)}</span>
            {group.count > 1 ? <strong>+{group.count}</strong> : null}
          </button>
        ))}
        {!events.length ? <div className="lane-empty-overlay">최근 실시간 관제 이벤트가 없습니다. 저장된 합성 이벤트를 재생 모드에서 확인하거나 Admin 권한으로 수동 갱신을 실행하세요.</div> : null}
      </div>
      <div className="lane-legend">
        <span><i className="legend-business" /> 주요 비즈니스 흐름</span>
        <span><i className="legend-finance" /> 정산/결제 흐름</span>
        <span><i className="legend-approval" /> 승인/콜백</span>
        <span><i className="legend-monitoring" /> 관제/조회</span>
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
          <span className="eyebrow">선택한 이벤트</span>
          <h3>{event.display_label}</h3>
        </div>
        <div className="inline-actions compact-actions">
          <StatusBadge status={event.severity}>{statusLabel(event.severity)}</StatusBadge>
          <StatusBadge status={event.status}>{statusLabel(event.status)}</StatusBadge>
        </div>
      </div>

      <DetailSection title="이벤트">
        <span>eventType<strong>{event.event_type}</strong></span>
        <span>영역<strong>{event.domain}</strong></span>
        <span>발생 시스템<strong>{event.source_system_id}</strong></span>
        <span>대상<strong>{event.entity_type} / {event.entity_id}</strong></span>
        <span>발생 시각<strong>{formatTimeAgo(event.occurred_at)}</strong></span>
      </DetailSection>

      <DetailSection title="연결 정보">
        <span>correlationId<strong>{event.correlation_id || "없음"}</strong></span>
        <span>causationId<strong>{String(metadata.causationId || "없음")}</strong></span>
        <div className="inline-actions wrap detail-actions">
          <button className="button button-secondary" type="button" onClick={() => void onTraceCorrelation(event)}>상관관계 보기</button>
          <button className="button button-secondary" type="button" onClick={() => void onTraceEntity(event)}>대상 흐름 보기</button>
        </div>
      </DetailSection>

      {context.length ? <DetailSection title="업무 맥락">
        {context.map(([label, value]) => <span key={label}>{label}<strong>{String(value)}</strong></span>)}
      </DetailSection> : null}

      <DetailSection title="운영상 영향">
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

function buildLaneStats(events: LiveFlowEvent[]) {
  const stats = Object.fromEntries(lanes.map((lane) => [lane.id, { count: 0, backlog: 0, status: "idle" }])) as Record<FlowLaneId, { count: number; backlog: number; status: string }>;
  for (const event of events) {
    const lane = normalizeLane(event.source_system_id || event.domain);
    stats[lane].count += 1;
    if (event.status === "waiting" || event.status === "approval_required") stats[lane].backlog += 1;
    if (event.status === "failed" || event.severity === "critical") stats[lane].status = "critical";
    else if (event.status === "delayed" || event.severity === "warning") stats[lane].status = stats[lane].status === "critical" ? "critical" : "warning";
    else if (stats[lane].status === "idle") stats[lane].status = "healthy";
  }
  return stats;
}

function buildEdgeGroups(events: LiveFlowEvent[]) {
  const groups = new Map<string, { event: LiveFlowEvent; count: number; severity: string; entityType: string; x: number; y: number }>();
  for (const [index, event] of events.slice(0, 90).entries()) {
    const from = normalizeLane(event.from_node || event.source_system_id || event.domain);
    const to = normalizeLane(event.to_node || event.domain);
    const key = `${from}-${to}-${event.entity_type}-${event.status}-${Math.floor(index / 8)}`;
    const point = tokenPoint(from, to, index);
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (severityRank(event.severity) > severityRank(existing.severity)) existing.severity = event.severity;
    } else {
      groups.set(key, { event, count: 1, severity: tokenTone(event), entityType: event.entity_type, x: point.x, y: point.y });
    }
  }
  return [...groups.values()];
}

function lanePoint(lane: FlowLaneId) {
  const points: Record<FlowLaneId, { x: number; y: number }> = {
    market: { x: 10, y: 25 },
    nexus: { x: 28, y: 25 },
    logistics: { x: 46, y: 25 },
    ledger: { x: 65, y: 25 },
    settlement: { x: 84, y: 25 },
    archiveos: { x: 72, y: 73 },
  };
  return points[lane];
}

function tokenPoint(from: FlowLaneId, to: FlowLaneId, index: number) {
  const a = lanePoint(from);
  const b = lanePoint(to);
  const progress = ((index % 9) + 1) / 10;
  const offset = ((index % 5) - 2) * 1.6;
  return { x: a.x + (b.x - a.x) * progress, y: a.y + (b.y - a.y) * progress + offset };
}

function normalizeLane(value: string): FlowLaneId {
  const node = (value || "").toLowerCase();
  if (node.includes("market") || node.includes("order") || node.includes("demand")) return "market";
  if (node.includes("logistics") || node.includes("logitics") || node.includes("shipment") || node.includes("route")) return "logistics";
  if (node.includes("nexus") || node.includes("factory") || node.includes("manufacturing")) return "nexus";
  if (node.includes("settlement")) return "settlement";
  if (node.includes("ledger") || node.includes("transaction") || node.includes("finance")) return "ledger";
  if (node.includes("archiveos") || node.includes("archive-os") || node.includes("approval") || node.includes("audit")) return "archiveos";
  return "archiveos";
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
  return event.severity || "normal";
}

function severityRank(value: string) {
  const severity = value.toLowerCase();
  if (severity === "critical") return 4;
  if (severity === "warning") return 3;
  if (severity === "info") return 2;
  return 1;
}

function modeLabel(mode: FlowMode) {
  if (mode === "LIVE") return "실시간";
  if (mode === "REPLAY") return "재생";
  return "데모";
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
