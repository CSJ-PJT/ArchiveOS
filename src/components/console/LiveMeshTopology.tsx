import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { CoreRoute } from "../../app/navigation";
import type { LiveFlowEvent, LiveFlowSummary, LiveFlowTopology } from "../../lib/backendApi";
import { useI18n } from "../../i18n/I18nProvider";
import type { TranslationKey } from "../../i18n";
import { StatusBadge, normalizeStatus } from "../shared/StatusBadge";

type MeshNode = { id: string; label: string; type: string; x: number; y: number };
type MeshEdge = { from: string; to: string; label: string };
type Selection = { type: "event"; event: LiveFlowEvent } | { type: "node"; node: MeshNode } | { type: "edge"; edge: MeshEdge } | null;
type RuntimeService = NonNullable<NonNullable<LiveFlowSummary["runtime"]>["services"]>[number];

const roleByNode: Record<string, string> = { market: "주문·결제", nexus: "제조", logistics: "물류", ledger: "정산", archiveos: "운영 오케스트레이터", settlement: "정산 배치" };

/** Runtime events are the sole source of animated tokens. No timer creates traffic. */
export function LiveMeshTopology({ topology, summary, events, onNavigate, onAsk }: { topology: LiveFlowTopology | null; summary: LiveFlowSummary | null; events: LiveFlowEvent[]; onNavigate?: (route: CoreRoute) => void; onAsk?: (question: string) => void }) {
  const { translate } = useI18n();
  const [selection, setSelection] = useState<Selection>(null);
  const openerRef = useRef<HTMLElement | SVGElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const nodes = topology?.nodes?.length ? topology.nodes : fallbackNodes;
  const edges = useMemo(() => uniqueMeshEdges(topology?.edges?.length ? topology.edges : fallbackEdges), [topology]);
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const runtime: RuntimeService[] = summary?.runtime?.services ?? [];
  const visibleEvents = events.slice(0, 30);
  const animatedEvents = useMemo(() => uniqueEventsByEdge(visibleEvents).slice(0, 8), [visibleEvents]);
  const edgeMetrics = useMemo(() => buildEdgeMetrics(visibleEvents), [visibleEvents]);
  const activeEdges = useMemo(() => new Set([...edgeMetrics.entries()].filter(([, metric]) => metric.count > 0).map(([key]) => key)), [edgeMetrics]);
  const warningEdges = useMemo(() => new Set([...edgeMetrics.entries()].filter(([, metric]) => metric.warning).map(([key]) => key)), [edgeMetrics]);
  const activeFlowEdges = useMemo(() => edges.map((edge) => ({ edge, metric: edgeMetrics.get(edgeKey(edge.from, edge.to)) })).filter((item) => item.metric?.count).slice(0, 4), [edges, edgeMetrics]);

  useEffect(() => {
    if (!selection) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeSelection(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selection]);

  function openSelection(next: Exclude<Selection, null>, opener?: HTMLElement | SVGElement | null) {
    openerRef.current = opener ?? null;
    setSelection(next);
  }

  function closeSelection() {
    setSelection(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  }

  return <section className="live-mesh" aria-labelledby="live-mesh-title">
    <header className="live-mesh-header">
      <div><span className="eyebrow">LIVE MESH</span><h2 id="live-mesh-title">라이브 메쉬 토폴로지</h2><p>실제 수집된 합성 런타임 이벤트로 서비스 간 흐름을 표시합니다.</p></div>
      <div className="mesh-header-meta"><span><b>{visibleEvents.length}</b> 최근 이벤트</span><span><b>{activeEdges.size}</b> 활성 경로</span><span className={warningEdges.size ? "mesh-meta-warning" : ""}><b>{warningEdges.size}</b> 주의 경로</span><span>{eventAge(summary?.latest_event_at)}</span></div>
    </header>
    <div className="mesh-legend" aria-label="메쉬 흐름 범례"><span><i className="legend-business" />주요 흐름</span><span><i className="legend-async" />비동기</span><span><i className="legend-approval" />승인·검증</span><span><i className="legend-monitor" />상태 공유</span><span><i className="legend-token" />실제 수신 이벤트</span></div>

    <div className="mesh-mobile-summary" aria-label="모바일 서비스 흐름 요약">
      <div className="mesh-mobile-flow-list"><strong>활성 경로</strong>{activeFlowEdges.length ? activeFlowEdges.map(({ edge, metric }) => <button type="button" key={edgeKey(edge.from, edge.to)} className="mesh-mobile-flow" onClick={(event) => openSelection({ type: "edge", edge }, event.currentTarget)}><span>{shortNodeLabel(edge.from)} → {shortNodeLabel(edge.to)}</span><small>최근 {metric?.count}건 · {eventAge(metric?.lastAt)}</small><StatusBadge status={metric?.warning ? "warning" : "working"}>{metric?.warning ? "주의" : "처리 중"}</StatusBadge></button>) : <p>현재 활성 경로가 없습니다.</p>}</div>
      <div className="mesh-mobile-service-list"><strong>서비스 상태</strong>{nodes.map((node) => <button type="button" key={node.id} className="mesh-mobile-node" onClick={(event) => openSelection({ type: "node", node }, event.currentTarget)}><span><strong>{node.label}</strong><small>{roleByNode[node.id] ?? node.type} · {nodeBacklog(node, runtime, visibleEvents)}</small></span><StatusBadge status={nodeStatus(node, runtime)}>{runtimeLabel(nodeStatus(node, runtime))}</StatusBadge></button>)}</div>
    </div>

    <div className="mesh-canvas-scroll"><div className="mesh-canvas">
      <svg className="mesh-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Archive 서비스 메쉬 구조">
        <defs><marker id="mesh-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" /></marker></defs>
        {edges.map((edge) => {
          const from = nodeMap.get(edge.from); const to = nodeMap.get(edge.to); if (!from || !to) return null;
          const key = edgeKey(edge.from, edge.to); const metric = edgeMetrics.get(key); const tone = edgeTone(edge.from, edge.to);
          const segment = edgeSegment(from, to);
          const anchor = edgeAnchor(segment, edgeIndex(edge, edges));
          return <g key={`${key}-${edge.label}`} className="mesh-edge-group" onClick={(event) => openSelection({ type: "edge", edge }, event.currentTarget)} tabIndex={0} role="button" aria-label={`${edge.from}에서 ${edge.to} 흐름 상세 보기`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openSelection({ type: "edge", edge }, event.currentTarget); }}>
            <line className={`mesh-edge edge-${tone} ${metric?.count ? "edge-active" : ""} ${metric?.warning ? "edge-warning" : ""}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} markerEnd="url(#mesh-arrow)" />
            {metric?.count ? <g className="mesh-edge-badge" transform={`translate(${anchor.x} ${anchor.y})`}><rect x="-4.6" y="-2.7" width="9.2" height="5.4" rx="2.6" /><text x="0" y="1">{`${metric.count} · ${shortAge(metric.lastAt)}`}</text></g> : null}
            <title>{`${edge.label} · 최근 ${metric?.count ?? 0}건${metric?.lastAt ? ` · ${formatTime(metric.lastAt)}` : ""}`}</title>
          </g>;
        })}
        {animatedEvents.map((event, index) => {
          const from = nodeMap.get(normalizeNode(event.from_node)); const to = nodeMap.get(normalizeNode(event.to_node)); if (!from || !to) return null;
          const begin = `${Math.min(index * 0.1, 1.1)}s`;
          const segment = edgeSegment(from, to);
          return <circle key={event.event_id} className={`mesh-token token-${tokenTone(event)}`} cx={segment.fromX} cy={segment.fromY} r="1.05" onClick={(clickEvent) => openSelection({ type: "event", event }, clickEvent.currentTarget)}>
            <title>{`${event.event_type} · ${event.from_node} → ${event.to_node}`}</title><animate attributeName="cx" from={segment.fromX} to={segment.toX} dur="1.45s" begin={begin} fill="freeze" /><animate attributeName="cy" from={segment.fromY} to={segment.toY} dur="1.45s" begin={begin} fill="freeze" /><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.84;1" dur="1.45s" begin={begin} fill="freeze" />
          </circle>;
        })}
      </svg>
      {nodes.map((node) => {
        const runtimeState = runtime.find((state) => normalizeNode(state.serviceId || state.serviceName) === node.id);
        const nodeEvents = visibleEvents.filter((event) => normalizeNode(event.from_node) === node.id || normalizeNode(event.to_node) === node.id);
        return <button key={node.id} type="button" className={`mesh-node mesh-node-${node.id} ${nodeEvents.length ? "mesh-node-active" : ""}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} onClick={(event) => openSelection({ type: "node", node }, event.currentTarget)}>
          <span className="mesh-node-title">{node.label}</span><span className="mesh-node-role">{roleByNode[node.id] ?? node.type}</span>
          <span className="mesh-node-metrics"><StatusBadge status={runtimeState?.runtimeStatus || runtimeState?.serviceStatus || "waiting"}>{runtimeLabel(runtimeState?.runtimeStatus || runtimeState?.serviceStatus)}</StatusBadge><em>{nodeEvents.length ? `${nodeEvents.length}건` : "이벤트 없음"}</em></span>
          <span className="mesh-node-backlog">{typeof runtimeState?.backlogCount === "number" ? `적체 ${runtimeState.backlogCount.toLocaleString()}` : runtimeState?.lastEventAt ? `최근 ${eventAge(runtimeState.lastEventAt)}` : "수집 대기"}</span>
        </button>;
      })}
    </div></div>

    {selection ? <MeshDrawer selection={selection} runtime={runtime} events={visibleEvents} edgeMetrics={edgeMetrics} onClose={closeSelection} closeRef={closeRef} onNavigate={onNavigate} onAsk={onAsk} translate={translate} /> : null}
  </section>;
}

function MeshDrawer({ selection, runtime, events, edgeMetrics, onClose, closeRef, onNavigate, onAsk, translate }: { selection: Exclude<Selection, null>; runtime: RuntimeService[]; events: LiveFlowEvent[]; edgeMetrics: Map<string, EdgeMetric>; onClose: () => void; closeRef: RefObject<HTMLButtonElement>; onNavigate?: (route: CoreRoute) => void; onAsk?: (question: string) => void; translate: (key: TranslationKey) => string }) {
  const isEvent = selection.type === "event"; const isNode = selection.type === "node";
  const event = isEvent ? selection.event : null; const node = isNode ? selection.node : null; const edge = selection.type === "edge" ? selection.edge : null;
  const nodeRuntime = node ? runtime.find((item) => normalizeNode(item.serviceId || item.serviceName) === node.id) : null;
  const metric = edge ? edgeMetrics.get(edgeKey(edge.from, edge.to)) : null;
  const related = event ? events.filter((item) => item.correlation_id && item.correlation_id === event.correlation_id).slice(0, 4) : edge ? events.filter((item) => edgeKey(normalizeNode(item.from_node), normalizeNode(item.to_node)) === edgeKey(edge.from, edge.to)).slice(0, 4) : node ? events.filter((item) => normalizeNode(item.from_node) === node.id || normalizeNode(item.to_node) === node.id).slice(0, 4) : [];
  const title = event?.event_type || node?.label || `${shortNodeLabel(edge?.from)} → ${shortNodeLabel(edge?.to)}`;
  const status = event?.status || nodeRuntime?.runtimeStatus || nodeRuntime?.serviceStatus || (metric?.warning ? "warning" : "healthy");
  const lastAt = nodeRuntime?.lastWorkAt || nodeRuntime?.lastEventAt || event?.occurred_at || metric?.lastAt;
  return <div className="mesh-drawer-layer" role="presentation" onMouseDown={onClose}>
    <aside className="mesh-detail-drawer" aria-live="polite" aria-label="선택한 메쉬 상세 정보" onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}>
      <header><div><span className="eyebrow">{isEvent ? "선택 이벤트" : isNode ? "선택 서비스" : "선택 경로"}</span><h3>{title}</h3></div><button ref={closeRef} type="button" className="mesh-drawer-close" onClick={onClose} aria-label="상세 정보 닫기">×</button></header>
      <dl className="mesh-drawer-facts"><dt>상태</dt><dd><StatusBadge status={status}>{runtimeLabel(status)}</StatusBadge></dd><dt>{isNode ? "역할" : "경로"}</dt><dd>{isNode ? roleByNode[node!.id] : event ? `${event.from_node} → ${event.to_node}` : `${shortNodeLabel(edge?.from)} → ${shortNodeLabel(edge?.to)}`}</dd><dt>{isNode ? "최근 성공" : "마지막 발생"}</dt><dd>{formatTime(lastAt)}</dd><dt>적체</dt><dd>{typeof nodeRuntime?.backlogCount === "number" ? nodeRuntime.backlogCount.toLocaleString() : "데이터 없음"}</dd><dt>처리 역량</dt><dd>데이터 없음</dd></dl>
      <div className="mesh-drawer-related"><strong>연관 흐름</strong>{event ? <p><span className="mono">{event.correlation_id || "연결 정보 없음"}</span><br />{event.entity_type} · {event.entity_id}</p> : <p>{related.length ? `최근 ${related.length}건의 수집 이벤트` : "연결 정보 없음"}</p>}<ol>{related.slice(0, 3).map((item) => <li key={item.event_id}>{formatTime(item.occurred_at)} · {item.event_type}</li>)}</ol></div>
      <footer><span>{event ? impactLabel(event) : metric?.warning ? "확인 필요" : runtimeReason(nodeRuntime?.reason)}</span><span className="mesh-drawer-actions">{onAsk ? <button type="button" className="text-button" onClick={() => { onAsk(questionForSelection(selection, translate)); onClose(); }}>{translate("copilot.analyze")} →</button> : null}{onNavigate ? <button type="button" className="text-button" onClick={() => onNavigate(isNode ? "services" : "records")}>{isNode ? "서비스 보기" : "기록 보기"} →</button> : null}</span></footer>
    </aside>
  </div>;
}

type EdgeMetric = { count: number; lastAt?: string; warning: boolean };
function buildEdgeMetrics(events: LiveFlowEvent[]) { const metrics = new Map<string, EdgeMetric>(); for (const event of events) { const key = edgeKey(normalizeNode(event.from_node), normalizeNode(event.to_node)); const current = metrics.get(key) || { count: 0, warning: false }; metrics.set(key, { count: current.count + 1, lastAt: current.lastAt && new Date(current.lastAt) > new Date(event.occurred_at) ? current.lastAt : event.occurred_at, warning: current.warning || ["warning", "critical"].includes(tokenTone(event)) }); } return metrics; }
function uniqueMeshEdges(edges: MeshEdge[]) { const seen = new Set<string>(); return edges.filter((edge) => { const key = edgeKey(edge.from, edge.to); if (seen.has(key)) return false; seen.add(key); return true; }); }
function uniqueEventsByEdge(events: LiveFlowEvent[]) { const seen = new Set<string>(); return events.filter((event) => { const from = normalizeNode(event.from_node); const to = normalizeNode(event.to_node); if (from === to) return false; const key = edgeKey(from, to); if (seen.has(key)) return false; seen.add(key); return true; }); }
function edgeKey(from: string, to: string) { return `${from}-${to}`; }
function edgeIndex(edge: MeshEdge, edges: MeshEdge[]) { return Math.max(0, edges.findIndex((candidate) => candidate.from === edge.from && candidate.to === edge.to && candidate.label === edge.label)); }
function edgeSegment(from: MeshNode, to: MeshNode) { const dx = to.x - from.x; const dy = to.y - from.y; const distance = Math.max(Math.hypot(dx, dy), 1); const inset = Math.min(8.5, distance / 3); return { fromX: from.x + (dx / distance) * inset, fromY: from.y + (dy / distance) * inset, toX: to.x - (dx / distance) * inset, toY: to.y - (dy / distance) * inset }; }
function edgeAnchor(segment: ReturnType<typeof edgeSegment>, index: number) { const dx = segment.toX - segment.fromX; const dy = segment.toY - segment.fromY; const distance = Math.max(Math.hypot(dx, dy), 1); const normalX = -dy / distance; const normalY = dx / distance; const side = index % 2 ? -1 : 1; return { x: (segment.fromX + segment.toX) / 2 + normalX * 2.6 * side, y: (segment.fromY + segment.toY) / 2 + normalY * 2.6 * side }; }
function clusterEvents(events: LiveFlowEvent[], nodeMap: Map<string, MeshNode>) { const grouped = new Map<string, { count: number; edge: MeshEdge }>(); for (const event of events) { const from = normalizeNode(event.from_node); const to = normalizeNode(event.to_node); const key = edgeKey(from, to); const current = grouped.get(key); grouped.set(key, { count: (current?.count || 0) + 1, edge: { from, to, label: event.event_type } }); } return [...grouped.entries()].slice(0, 4).flatMap(([key, item]) => { const [from, to] = key.split("-"); const a = nodeMap.get(from); const b = nodeMap.get(to); return a && b ? [{ key, count: item.count, edge: item.edge, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }] : []; }); }
function normalizeNode(value?: string | null) { const text = String(value || "").toLowerCase(); if (text.includes("market")) return "market"; if (text.includes("nexus") || text.includes("factory")) return "nexus"; if (text.includes("logit")) return "logistics"; if (text.includes("ledger") || text.includes("transaction")) return "ledger"; if (text.includes("settle")) return "settlement"; return "archiveos"; }
function nodeStatus(node: MeshNode, runtime: RuntimeService[]) { const state = runtime.find((item) => normalizeNode(item.serviceId || item.serviceName) === node.id); return state?.runtimeStatus || state?.serviceStatus || "waiting"; }
function edgeTone(from: string, to: string) { if ((from === "ledger" && to === "archiveos") || (from === "archiveos" && to === "ledger")) return "approval"; if (to === "settlement") return "settlement"; if (to === "archiveos") return "monitor"; return "business"; }
function tokenTone(event: LiveFlowEvent) { const value = `${event.status} ${event.severity}`.toLowerCase(); if (value.includes("fail") || value.includes("critical")) return "critical"; if (value.includes("delay") || value.includes("warning")) return "warning"; if (value.includes("approval")) return "approval"; if (value.includes("wait")) return "waiting"; if (value.includes("complete") || value.includes("settled")) return "completed"; return "normal"; }
function runtimeLabel(value?: string | null) { const text = String(value || "").toUpperCase(); if (["PROCESSING", "RUNNING", "MOVING"].includes(text)) return "처리 중"; if (["STALLED", "STALE"].includes(text)) return "정체"; if (["WARNING", "DEGRADED", "SLOW", "DELAYED"].includes(text)) return "주의"; if (["FAILED", "UNAVAILABLE"].includes(text)) return "실패"; if (["HEALTHY", "LIVE", "COMPLETED"].includes(text)) return "정상"; return "대기"; }
function shortNodeLabel(value?: string | null) { const id = normalizeNode(value); return ({ market: "Market", nexus: "Nexus", logistics: "Logistics", ledger: "Ledger", archiveos: "ArchiveOS", settlement: "Settlement" } as Record<string, string>)[id]; }
function shortAge(value?: string | null) { if (!value) return "-"; const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)); if (seconds < 60) return `${seconds}초`; return `${Math.floor(seconds / 60)}분`; }
function nodeBacklog(node: MeshNode, runtime: RuntimeService[], events: LiveFlowEvent[]) { const state = runtime.find((item) => normalizeNode(item.serviceId || item.serviceName) === node.id); if (typeof state?.backlogCount === "number") return `적체 ${state.backlogCount.toLocaleString()}`; const count = events.filter((event) => normalizeNode(event.from_node) === node.id || normalizeNode(event.to_node) === node.id).length; return count ? `최근 이벤트 ${count}건` : "수집 대기"; }
function runtimeErrorLabel(status?: string | null, reason?: string | null) { const text = String(status || "").toUpperCase(); if (["HEALTHY", "LIVE", "COMPLETED", "PROCESSING", "RUNNING"].includes(text)) return "없음"; return runtimeReason(reason); }
function runtimeReason(value?: string | null) { const text = String(value || "").trim(); if (!text) return "수집된 상태와 최근 이벤트를 기준으로 표시합니다."; if (/service is healthy|healthy/i.test(text)) return "최근 수집 상태가 정상입니다."; if (/unavailable|connection|timeout/i.test(text)) return "연결 또는 수집 상태를 확인하세요."; if (/stale|no runtime event/i.test(text)) return "최근 실행 이벤트가 없어 흐름 상태를 확인하세요."; return "수집된 상태와 최근 이벤트를 기준으로 표시합니다."; }
function impactLabel(event: LiveFlowEvent) { return tokenTone(event) === "critical" ? "확인 필요" : tokenTone(event) === "warning" ? "지연 가능성" : "정상 흐름"; }
function questionForSelection(selection: Exclude<Selection, null>, translate: (key: TranslationKey) => string) { if (selection.type === "node") return interpolate(translate("copilot.questionNode"), { name: selection.node.label }); if (selection.type === "edge") return interpolate(translate("copilot.questionEdge"), { from: shortNodeLabel(selection.edge.from), to: shortNodeLabel(selection.edge.to), eventType: selection.edge.label }); return interpolate(translate("copilot.questionCorrelation"), { id: selection.event.correlation_id || "NO_DATA" }); }
function interpolate(template: string, variables: Record<string, string>) { return Object.entries(variables).reduce((text, [key, value]) => text.split(`{${key}}`).join(value), template); }
function impactDescription(event: LiveFlowEvent) { if (tokenTone(event) === "critical") return "실패 또는 위험 상태입니다. 관련 승인·콜백·적체를 확인하세요."; if (tokenTone(event) === "warning") return "지연 또는 처리 대기 상태입니다. 서비스 처리량과 적체를 확인하세요."; return "수집된 합성 런타임 이벤트가 서비스 간 흐름에 반영되었습니다."; }
function formatTime(value?: string | null) { if (!value || value === "-") return "데이터 없음"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function eventAge(value?: string | null) { if (!value) return "최근 이벤트 없음"; const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)); return seconds < 60 ? `${seconds}초 전 수신` : `${Math.floor(seconds / 60)}분 전 수신`; }

const fallbackNodes: MeshNode[] = [
  { id: "market", label: "Archive-Market", type: "source", x: 13, y: 23 }, { id: "nexus", label: "Archive-Nexus", type: "factory", x: 42, y: 23 }, { id: "logistics", label: "Archive-Logistics", type: "flow", x: 75, y: 23 }, { id: "ledger", label: "Archive-Ledger", type: "financial", x: 22, y: 72 }, { id: "archiveos", label: "ArchiveOS Control Tower", type: "control", x: 52, y: 72 }, { id: "settlement", label: "Settlement", type: "batch", x: 84, y: 72 },
];
const fallbackEdges: MeshEdge[] = [{ from: "market", to: "nexus", label: "order" }, { from: "market", to: "ledger", label: "sales" }, { from: "nexus", to: "logistics", label: "shipment" }, { from: "nexus", to: "ledger", label: "cost" }, { from: "logistics", to: "ledger", label: "cost" }, { from: "ledger", to: "archiveos", label: "approval" }, { from: "archiveos", to: "ledger", label: "callback" }, { from: "ledger", to: "settlement", label: "settlement" }];
