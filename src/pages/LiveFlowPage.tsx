import { useMemo, useState } from "react";
import type { AppData } from "../app/AppShell";
import { MetricCard } from "../components/shared/MetricCard";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { getLiveFlowCorrelation, getLiveFlowEntity, getLiveFlowReplay, refreshLiveFlow, type LiveFlowEvent } from "../lib/backendApi";
import { formatTimeAgo, stringifyMeta } from "./pageUtils";

type FlowMode = "LIVE" | "REPLAY" | "DEMO";

export function LiveFlowPage({ data, onRefresh }: { data: AppData; onRefresh: () => Promise<void> }) {
  const [mode, setMode] = useState<FlowMode>("LIVE");
  const [selected, setSelected] = useState<LiveFlowEvent | null>(null);
  const [replayEvents, setReplayEvents] = useState<LiveFlowEvent[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [chainEvents, setChainEvents] = useState<LiveFlowEvent[]>([]);
  const [chainLabel, setChainLabel] = useState("추적할 체인을 선택하세요");
  const canRefresh = data.auth.role === "ADMIN";
  const summary = data.liveFlow;
  const topology = data.liveFlowTopology;
  const events = mode === "REPLAY" ? replayEvents : data.liveFlowEvents;
  const latestEvent = summary?.latest_event_at || events[0]?.occurred_at || null;
  const filteredEvents = useMemo(() => events.slice(0, 80), [events]);

  async function refreshNow() {
    setMessage(null);
    try {
      const result = await refreshLiveFlow();
      setMessage(`실시간 흐름을 갱신했습니다. 수집된 이벤트 표식: ${result.collected ?? 0}건`);
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "실시간 흐름 갱신에 실패했습니다.");
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
    return <div className="empty-state">실시간 흐름을 불러오지 못했습니다. archiveos-ai live-flow API와 Flyway V14 적용 상태를 확인하세요.</div>;
  }

  return (
    <div className="page-stack live-flow-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">운영 트윈</span>
          <h2>실시간 흐름</h2>
          <p>모드: {mode} / 데이터: 합성 런타임 이벤트 / 실제 고객, 결제, 계좌, 금융 데이터는 사용하지 않습니다.</p>
        </div>
        <div className="inline-actions">
          <button className="button button-secondary" type="button" onClick={() => setMode("LIVE")}>LIVE</button>
          <button className="button button-secondary" type="button" onClick={() => void loadReplay()}>REPLAY</button>
          <button className="button button-secondary" type="button" onClick={() => { setMode("DEMO"); setReplayEvents(data.liveFlowEvents); }}>DEMO</button>
          <button className="button button-primary" type="button" disabled={!canRefresh} onClick={() => void refreshNow()}>수동 갱신</button>
        </div>
      </header>

      {!canRefresh ? <p className="small-note">Public, Operator, PM 세션은 조회만 가능합니다. 수동 갱신과 재생 표식 작업은 Admin 권한이 필요합니다.</p> : null}
      {message ? <p className="small-note">{message}</p> : null}

      <section className="kpi-command-grid">
        <MetricCard label="활성 흐름" value={summary.active_flows ?? 0} status={(summary.active_flows ?? 0) > 0 ? "working" : "idle"} description="최근 구간에 저장된 흐름 이벤트" />
        <MetricCard label="최근 이벤트" value={summary.recent_events ?? 0} status={(summary.recent_events ?? 0) > 0 ? "healthy" : "empty"} description="ArchiveOS가 수집한 런타임 이벤트" />
        <MetricCard label="승인 대기" value={summary.pending_approvals ?? 0} status={(summary.pending_approvals ?? 0) > 0 ? "blocked" : "healthy"} description="승인 게이트에 대기 중인 항목" />
        <MetricCard label="배송 지연" value={summary.delayed_shipments ?? 0} status={(summary.delayed_shipments ?? 0) > 0 ? "warning" : "healthy"} description="Logistics 지연 경로 표식" />
        <MetricCard label="callback 실패" value={summary.failed_callbacks ?? 0} status={(summary.failed_callbacks ?? 0) > 0 ? "critical" : "healthy"} description="승인 callback 실패 항목" />
        <MetricCard label="주의 시스템" value={summary.degraded_systems ?? 0} status={(summary.degraded_systems ?? 0) > 0 ? "degraded" : "healthy"} description="수집 실패 또는 저하 상태" />
      </section>

      <section className="overview-layout">
        <SectionCard title="흐름 캔버스" eyebrow={`모드 ${mode} / 최근 ${latestEvent ? formatTimeAgo(latestEvent) : "이벤트 없음"}`} className="span-8">
          <LiveFlowCanvas topology={topology} events={filteredEvents} selected={selected} paused={paused} speed={speed} onSelect={selectEvent} />
        </SectionCard>

        <SectionCard title="상세 정보" eyebrow="선택한 이벤트 / 엔터티 / 상관관계" className="span-4">
          {selected ? <div className="event-detail-panel">
            <StatusBadge status={selected.severity}>{selected.severity}</StatusBadge>
            <h3>{selected.display_label}</h3>
            <dl className="detail-grid">
              <span>이벤트 유형<strong>{selected.event_type}</strong></span>
              <span>소스<strong>{selected.source_system_id}</strong></span>
              <span>엔터티<strong>{selected.entity_type} / {selected.entity_id}</strong></span>
              <span>상태<strong>{selected.status}</strong></span>
              <span>상관관계<strong>{selected.correlation_id || "없음"}</strong></span>
              <span>발생 시각<strong>{formatTimeAgo(selected.occurred_at)}</strong></span>
            </dl>
            <OperationalLinks event={selected} workforce={data.workforce?.services || []} />
            <div className="inline-actions wrap">
              <button className="button button-secondary" type="button" onClick={() => void traceCorrelation(selected)}>상관관계 추적</button>
              <button className="button button-secondary" type="button" onClick={() => void traceEntity(selected)}>엔터티 추적</button>
            </div>
            <details><summary>metadata</summary><pre>{stringifyMeta(selected.metadata)}</pre></details>
          </div> : <div className="empty-state">토큰이나 이벤트를 선택하면 연결된 흐름을 확인할 수 있습니다.</div>}
        </SectionCard>

        <SectionCard title="재생 제어" eyebrow="저장된 런타임 이벤트 기준" className="span-12">
          <div className="replay-bar">
            <button className="button button-secondary" type="button" onClick={() => setPaused((value) => !value)}>{paused ? "재생" : "일시정지"}</button>
            {[1, 2, 5].map((next) => <button className="button button-secondary" type="button" key={next} onClick={() => setSpeed(next)}>{next}x</button>)}
            <span>속도 {speed}x</span>
            <span>모드 {mode}</span>
            <span>이벤트 {filteredEvents.length}건</span>
            <span>심각도: 전체</span>
            <span>도메인: 전체</span>
          </div>
        </SectionCard>

        <SectionCard title="최근 흐름 이벤트" eyebrow="ArchiveOS가 정규화한 실제 런타임 데이터" className="span-12">
          <div className="event-list compact">
            {filteredEvents.slice(0, 30).map((event) => (
              <button className="event-row clickable" type="button" key={event.event_id} onClick={() => selectEvent(event)}>
                <span>{formatTimeAgo(event.occurred_at)}</span>
                <StatusBadge status={event.status}>{event.status}</StatusBadge>
                <strong>{event.display_label}</strong>
                <p>{event.from_node} → {event.to_node} / {event.event_type} / {event.correlation_id || "상관관계 없음"}</p>
              </button>
            ))}
            {!filteredEvents.length ? <div className="empty-state">아직 수집된 흐름 이벤트가 없습니다. Admin 권한으로 수동 갱신할 수 있습니다.</div> : null}
          </div>
        </SectionCard>

        <SectionCard title="상관관계 / 엔터티 체인" eyebrow={chainLabel} className="span-12">
          <div className="flow-chain">
            {chainEvents.map((event, index) => (
              <button className="chain-step" type="button" key={`${event.event_id}-${index}`} onClick={() => setSelected(event)}>
                <span className="chain-index">{index + 1}</span>
                <StatusBadge status={event.status}>{event.status}</StatusBadge>
                <strong>{event.display_label}</strong>
                <small>{event.source_system_id} / {event.entity_type} / {formatTimeAgo(event.occurred_at)}</small>
              </button>
            ))}
            {!chainEvents.length ? <div className="empty-state">불러온 체인이 없습니다. 이벤트를 선택한 뒤 correlationId 또는 entityId로 추적하세요.</div> : null}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

function OperationalLinks({ event, workforce }: { event: LiveFlowEvent; workforce: NonNullable<AppData["workforce"]>["services"] }) {
  const metadata = event.metadata || {};
  const links = [
    ["주문", metadata.orderId],
    ["배송", metadata.shipmentId],
    ["경로", metadata.routeId],
    ["차량", metadata.truckId],
    ["공장", metadata.factoryId],
    ["거래", metadata.transactionId],
    ["승인", metadata.approvalRequestId],
    ["위험도", metadata.riskLevel],
    ["금액 구간", event.amount_bucket],
  ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");

  const callbackState = event.entity_type === "callback" || event.event_type.includes("CALLBACK");
  const settlementState = event.entity_type === "settlement" || event.event_type.includes("SETTLEMENT") || event.status === "settled";
  const workforceImpact = workforce.find((item) => item.serviceId === event.source_system_id || item.serviceType.toLowerCase() === event.domain.toLowerCase());

  return (
    <div className="operational-links">
      <h4>운영 연결 정보</h4>
      {links.length ? <dl className="detail-grid compact">
        {links.map(([label, value]) => <span key={String(label)}>{String(label)}<strong>{String(value)}</strong></span>)}
      </dl> : <p className="small-note">이 이벤트에 연결된 synthetic 식별자가 없습니다.</p>}
      {workforceImpact ? <dl className="detail-grid compact">
        <span>역량 부족<strong>{String(workforceImpact.capacityShortage)}</strong></span>
        <span>적체<strong>{String(workforceImpact.backlog)}</strong></span>
        <span>병목 역할<strong>{workforceImpact.bottleneckRole}</strong></span>
        <span>생산성 점수<strong>{String(workforceImpact.productivityScore)}</strong></span>
        <span>인건비성 비용<strong>{String(workforceImpact.payrollCost)}</strong></span>
      </dl> : <p className="small-note">이 소스와 연결된 작업 역량 스냅샷은 아직 없습니다.</p>}
      {callbackState ? <p className="small-note">Callback 흐름: ArchiveOS → Archive-Ledger. 재시도 전 callback 상태를 확인하세요.</p> : null}
      {settlementState ? <p className="small-note">정산 흐름: Ledger 거래 → 정산 배치 → 대사 요약으로 이어집니다.</p> : null}
    </div>
  );
}

function LiveFlowCanvas({ topology, events, selected, paused, speed, onSelect }: {
  topology: NonNullable<AppData["liveFlowTopology"]>;
  events: LiveFlowEvent[];
  selected: LiveFlowEvent | null;
  paused: boolean;
  speed: number;
  onSelect: (event: LiveFlowEvent) => void;
}) {
  const nodeMap = new Map(topology.nodes.map((node) => [node.id, node]));
  return (
    <div className={`live-flow-canvas ${paused ? "is-paused" : ""}`} style={{ ["--flow-speed" as string]: String(speed) }}>
      <svg viewBox="0 0 100 100" role="img" aria-label="Archive Platform 실시간 흐름 토폴로지">
        {topology.edges.map((edge) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          return <g key={`${edge.from}-${edge.to}`}>
            <line className="flow-edge" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
            <text className="flow-edge-label" x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 1}>{edge.label}</text>
          </g>;
        })}
        {topology.nodes.map((node) => (
          <g className={`flow-node flow-node-${node.type}`} key={node.id}>
            <circle cx={node.x} cy={node.y} r="4.4" />
            <text x={node.x} y={node.y + 8}>{node.label}</text>
          </g>
        ))}
        {events.slice(0, 28).map((event, index) => {
          const from = nodeMap.get(normalizeNode(event.from_node)) || nodeMap.get("archiveos")!;
          const to = nodeMap.get(normalizeNode(event.to_node)) || from;
          const progress = tokenProgress(event, index);
          const x = from.x + (to.x - from.x) * progress;
          const y = from.y + (to.y - from.y) * progress + ((index % 3) - 1) * 1.4;
          return <g className={`flow-token token-${event.severity} ${selected?.event_id === event.event_id ? "selected" : ""}`} key={event.event_id} onClick={() => onSelect(event)}>
            <circle cx={x} cy={y} r={event.status === "failed" ? 2.5 : 2.1} />
            <title>{event.display_label}</title>
          </g>;
        })}
      </svg>
    </div>
  );
}

function normalizeNode(value: string) {
  const node = value.toLowerCase();
  if (node.includes("market")) return "market";
  if (node.includes("logistics") || node.includes("logitics")) return "logistics";
  if (node.includes("nexus")) return "nexus";
  if (node.includes("ledger")) return "ledger";
  if (node.includes("settlement")) return "settlement";
  if (node.includes("archiveos") || node.includes("archive-os")) return "archiveos";
  return node;
}

function tokenProgress(event: LiveFlowEvent, index: number) {
  const timestamp = Date.parse(event.occurred_at);
  if (Number.isNaN(timestamp)) return (index % 10) / 10;
  return ((Math.floor(timestamp / 1000) + index) % 10) / 10;
}
