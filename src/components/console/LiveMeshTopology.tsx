import { useMemo, useState } from "react";
import type { LiveFlowEvent, LiveFlowSummary, LiveFlowTopology } from "../../lib/backendApi";
import { StatusBadge } from "../shared/StatusBadge";
import { useI18n } from "../../i18n/I18nProvider";
import { consoleText } from "../../i18n/console";

type MeshNode = { id: string; label: string; type: string; x: number; y: number };

const roleByNode: Record<string, string> = {
  market: "주문·결제",
  nexus: "제조",
  logistics: "물류",
  ledger: "정산",
  archiveos: "운영 오케스트레이터",
  settlement: "정산 배치",
};

export function LiveMeshTopology({
  topology,
  summary,
  events,
  compact = false,
}: {
  topology: LiveFlowTopology | null;
  summary: LiveFlowSummary | null;
  events: LiveFlowEvent[];
  compact?: boolean;
}) {
  const { locale } = useI18n();
  const [selected, setSelected] = useState<LiveFlowEvent | null>(null);
  const nodes = topology?.nodes?.length ? topology.nodes : fallbackNodes;
  const edges = topology?.edges?.length ? topology.edges : fallbackEdges;
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const runtime = summary?.runtime?.services ?? [];
  const visibleEvents = events.slice(0, 30);
  const clusters = useMemo(() => clusterEvents(events.slice(30)), [events]);

  return (
    <section className={`live-mesh ${compact ? "live-mesh-compact" : ""}`} aria-label="라이브 메쉬 토폴로지">
      <div className="live-mesh-header">
        <div>
          <span className="eyebrow">LIVE MESH</span>
          <h2>{consoleText(locale, "mesh.title")}</h2>
          <p>{consoleText(locale, "mesh.description")}</p>
        </div>
        <div className="mesh-legend" aria-label="흐름 범례">
          <span><i className="legend-business" />주요 흐름</span>
          <span><i className="legend-async" />비동기</span>
          <span><i className="legend-approval" />승인·검증</span>
          <span><i className="legend-monitor" />상태 공유</span>
        </div>
      </div>
      <div className="mesh-canvas-scroll">
        <div className="mesh-canvas">
          <svg className="mesh-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <marker id="mesh-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0,0 L5,2.5 L0,5 z" /></marker>
            </defs>
            {edges.map((edge) => {
              const from = nodeMap.get(edge.from); const to = nodeMap.get(edge.to);
              if (!from || !to) return null;
              const tone = edgeTone(edge.from, edge.to);
              return <line key={`${edge.from}-${edge.to}-${edge.label}`} className={`mesh-edge edge-${tone}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} markerEnd="url(#mesh-arrow)" />;
            })}
            {visibleEvents.map((event, index) => {
              const from = nodeMap.get(normalizeNode(event.from_node)); const to = nodeMap.get(normalizeNode(event.to_node));
              if (!from || !to) return null;
              const point = pointOnLine(from, to, index);
              return <circle key={event.event_id} className={`mesh-token token-${tokenTone(event)} ${selected?.event_id === event.event_id ? "selected" : ""}`} cx={point.x} cy={point.y} r="1.35" onClick={() => setSelected(event)} />;
            })}
          </svg>
          {nodes.map((node) => {
            const runtimeState = runtime.find((state) => normalizeNode(state.serviceId || state.serviceName) === node.id);
            const count = visibleEvents.filter((event) => normalizeNode(event.from_node) === node.id || normalizeNode(event.to_node) === node.id).length;
            return <button key={node.id} type="button" className={`mesh-node mesh-node-${node.id}`} style={{ left: `${node.x}%`, top: `${node.y}%` }} onClick={() => setSelected(visibleEvents.find((event) => normalizeNode(event.from_node) === node.id || normalizeNode(event.to_node) === node.id) ?? null)}>
              <span className="mesh-node-title">{node.label}</span>
              <span className="mesh-node-role">{roleByNode[node.id] ?? node.type}</span>
              <span className="mesh-node-metrics"><StatusBadge status={runtimeState?.runtimeStatus ?? "waiting"}>{runtimeLabel(runtimeState?.runtimeStatus)}</StatusBadge><em>{count ? `${count}건` : "없음"}</em></span>
            </button>;
          })}
          {clusters.map((cluster) => <span key={cluster.key} className="mesh-cluster" style={{ left: `${cluster.x}%`, top: `${cluster.y}%` }}>+{cluster.count}</span>)}
        </div>
      </div>
      {!compact ? <MeshDetail event={selected} /> : null}
    </section>
  );
}

function MeshDetail({ event }: { event: LiveFlowEvent | null }) {
  if (!event) return <div className="mesh-detail-empty">이벤트를 선택하면 관련 흐름과 운영 영향을 확인할 수 있습니다.</div>;
  const metadata = maskSensitive(event.metadata || {});
  return <div className="mesh-detail-grid">
    <article><span className="eyebrow">선택 이벤트</span><h3>{event.event_type}</h3><dl><dt>경로</dt><dd>{event.from_node} → {event.to_node}</dd><dt>상태</dt><dd><StatusBadge status={event.status}>{runtimeLabel(event.status)}</StatusBadge></dd><dt>발생</dt><dd>{formatTime(event.occurred_at)}</dd></dl></article>
    <article><span className="eyebrow">연관 흐름</span><h3>추적 정보</h3><dl><dt>상관관계</dt><dd className="mono">{event.correlation_id || "연결 정보 없음"}</dd><dt>대상</dt><dd>{event.entity_type} · {event.entity_id}</dd><dt>출처</dt><dd>{event.source_system_id}</dd></dl></article>
    <article><span className="eyebrow">운영 영향</span><h3>{impactLabel(event)}</h3><p>{impactDescription(event)}</p><details><summary>메타데이터 보기</summary><pre>{JSON.stringify(metadata, null, 2)}</pre></details></article>
  </div>;
}

function clusterEvents(events: LiveFlowEvent[]) {
  const groups = new Map<string, number>();
  for (const event of events) { const key = `${normalizeNode(event.from_node)}-${normalizeNode(event.to_node)}`; groups.set(key, (groups.get(key) ?? 0) + 1); }
  return [...groups.entries()].slice(0, 6).map(([key, count], index) => ({ key, count, x: 20 + (index % 3) * 28, y: 45 + Math.floor(index / 3) * 20 }));
}
function pointOnLine(from: MeshNode, to: MeshNode, index: number) { const step = 0.25 + (index % 5) * 0.12; return { x: from.x + (to.x - from.x) * step, y: from.y + (to.y - from.y) * step }; }
function normalizeNode(value?: string | null) { const text = String(value || "").toLowerCase(); if (text.includes("market")) return "market"; if (text.includes("nexus") || text.includes("factory")) return "nexus"; if (text.includes("logit")) return "logistics"; if (text.includes("ledger") || text.includes("transaction")) return "ledger"; if (text.includes("settle")) return "settlement"; return "archiveos"; }
function edgeTone(from: string, to: string) { if (from === "archiveos" || to === "archiveos") return "approval"; if (to === "settlement") return "settlement"; if (to === "archiveos") return "monitor"; return "business"; }
function tokenTone(event: LiveFlowEvent) { const value = `${event.status} ${event.severity}`.toLowerCase(); if (value.includes("fail") || value.includes("critical")) return "critical"; if (value.includes("delay") || value.includes("warning")) return "warning"; if (value.includes("approval")) return "approval"; if (value.includes("wait")) return "waiting"; if (value.includes("complete") || value.includes("settled")) return "completed"; return "normal"; }
function runtimeLabel(value?: string | null) { const text = String(value || "").toUpperCase(); if (["PROCESSING", "RUNNING", "MOVING"].includes(text)) return "처리 중"; if (["STALLED", "STALE"].includes(text)) return "정체"; if (["WARNING", "DEGRADED", "SLOW", "DELAYED"].includes(text)) return "주의"; if (["FAILED", "UNAVAILABLE"].includes(text)) return "실패"; if (["HEALTHY", "LIVE", "COMPLETED"].includes(text)) return "정상"; return "대기"; }
function impactLabel(event: LiveFlowEvent) { return tokenTone(event) === "critical" ? "확인 필요" : tokenTone(event) === "warning" ? "지연 가능성" : "정상 흐름"; }
function impactDescription(event: LiveFlowEvent) { if (tokenTone(event) === "critical") return "실패 또는 위험 상태입니다. 관련 승인·콜백·적체를 확인하세요."; if (tokenTone(event) === "warning") return "지연 또는 처리 대기 상태입니다. 서비스 처리량과 적체를 확인하세요."; return "수집된 합성 런타임 이벤트가 서비스 간 흐름에 반영되었습니다."; }
function formatTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(); }
function maskSensitive(value: Record<string, unknown>) { return Object.fromEntries(Object.entries(value).map(([key, item]) => /secret|token|password|webhook|private.?key|api.?key/i.test(key) ? [key, "***"] : [key, item])); }

const fallbackNodes: MeshNode[] = [
  { id: "market", label: "Archive-Market", type: "source", x: 10, y: 22 }, { id: "nexus", label: "Archive-Nexus", type: "factory", x: 42, y: 22 }, { id: "logistics", label: "Archive-Logistics", type: "flow", x: 76, y: 22 }, { id: "ledger", label: "Archive-Ledger", type: "financial", x: 22, y: 70 }, { id: "archiveos", label: "ArchiveOS", type: "control", x: 52, y: 70 }, { id: "settlement", label: "Settlement", type: "batch", x: 84, y: 70 },
];
const fallbackEdges = [{ from: "market", to: "nexus", label: "order" }, { from: "market", to: "ledger", label: "sales" }, { from: "nexus", to: "logistics", label: "shipment" }, { from: "nexus", to: "ledger", label: "cost" }, { from: "logistics", to: "ledger", label: "cost" }, { from: "ledger", to: "archiveos", label: "approval" }, { from: "archiveos", to: "ledger", label: "callback" }, { from: "ledger", to: "settlement", label: "settlement" }];
