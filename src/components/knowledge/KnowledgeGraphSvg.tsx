import { useMemo, useState } from "react";
import type { KnowledgeGraph, KnowledgeGraphEdge, KnowledgeGraphNode } from "../../lib/backendApi";
import {
  getGraphFocusContext,
  getKnowledgeEdgeColor,
  getKnowledgeEdgeWidth,
  getKnowledgeNodeColor,
  getKnowledgeNodeRadius,
  layoutKnowledgeGraphNodes,
  truncateGraphLabel,
  type ActiveDecisionChain,
} from "./knowledgeGraphUtils";
import { knowledgeEdgeTypeLabel, knowledgeNodeTypeLabel } from "./KnowledgeUi";

export function KnowledgeGraphSvg({
  graph,
  selectedNodeId,
  activeChain,
  onSelectNode,
  onSelectEdge,
}: {
  graph: KnowledgeGraph;
  selectedNodeId: string | null;
  activeChain: ActiveDecisionChain | null;
  onSelectNode: (node: KnowledgeGraphNode) => void;
  onSelectEdge: (edge: KnowledgeGraphEdge) => void;
}) {
  const width = 920;
  const height = 560;
  const positionedNodes = useMemo(() => layoutKnowledgeGraphNodes(graph.nodes, width, height), [graph.nodes]);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const nodeMap = useMemo(() => new Map(positionedNodes.map((node) => [node.id, node])), [positionedNodes]);
  const focus = useMemo(() => getGraphFocusContext(graph, selectedNodeId, activeChain), [graph, selectedNodeId, activeChain]);
  const hoveredNode = hoveredNodeId ? nodeMap.get(hoveredNodeId) || null : null;
  const hoverEdgeIds = useMemo(
    () => new Set(graph.edges.filter((edge) => edge.from === hoveredNodeId || edge.to === hoveredNodeId).map((edge) => edge.id)),
    [graph.edges, hoveredNodeId],
  );
  const hoverNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (!hoveredNodeId) return ids;
    ids.add(hoveredNodeId);
    graph.edges.forEach((edge) => {
      if (edge.from === hoveredNodeId) ids.add(edge.to);
      if (edge.to === hoveredNodeId) ids.add(edge.from);
    });
    return ids;
  }, [graph.edges, hoveredNodeId]);
  const hasFocus = Boolean(selectedNodeId || activeChain || hoveredNodeId);

  if (graph.nodes.length === 0) {
    return (
      <div className="graph-empty-canvas">
        <strong>아직 지식 그래프 데이터가 충분하지 않습니다.</strong>
        <span>일일 보고서, 야간 검토, 아키텍처 검토, Historian 내보내기가 실행되면 노드와 연결이 생성됩니다.</span>
      </div>
    );
  }

  return (
    <div className="knowledge-graph-canvas" role="region" aria-label="운영 메모리 지식 그래프">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" aria-label="노드에 마우스를 올리거나 키보드로 선택하면 연결 관계가 강조됩니다.">
        <defs>
          <filter id="graphGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {graph.edges.map((edge) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const activeEdge = activeChain?.edgeIds.has(edge.id) || focus.edgeIds.has(edge.id) || hoverEdgeIds.has(edge.id);
          const selectedByHover = hoverEdgeIds.has(edge.id);
          const faded = hoveredNodeId
            ? !selectedByHover
            : hasFocus && !activeEdge && !(focus.nodeIds.has(edge.from) && focus.nodeIds.has(edge.to));
          return (
            <g key={edge.id}>
              <line
                className={activeEdge ? "graph-edge active" : "graph-edge"}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={getKnowledgeEdgeColor(edge)}
                strokeWidth={selectedByHover ? getKnowledgeEdgeWidth(edge) + 1.75 : activeEdge ? getKnowledgeEdgeWidth(edge) + 1 : getKnowledgeEdgeWidth(edge)}
                opacity={faded ? 0.14 : activeEdge ? 0.95 : 0.5}
                onClick={() => onSelectEdge(edge)}
              />
              {activeEdge ? (
                <text
                  className="graph-edge-label"
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 - 4}
                  textAnchor="middle"
                  fill="#dbeafe"
                >
                  {knowledgeEdgeTypeLabel(edge.type)}
                </text>
              ) : null}
            </g>
          );
        })}

        {positionedNodes.map((node) => {
          const selected = selectedNodeId === node.id;
          const hovered = hoveredNodeId === node.id;
          const inFocus = focus.nodeIds.has(node.id);
          const inActiveChain = activeChain?.nodeIds.has(node.id);
          const inHoverContext = hoverNodeIds.has(node.id);
          const faded = hoveredNodeId ? !inHoverContext : hasFocus && !selected && !inFocus && !inActiveChain;
          const radius = getKnowledgeNodeRadius(node);
          const isCritical = node.importanceLevel === "critical";
          const showLabel =
            selected ||
            hovered ||
            node.type === "decision" ||
            node.type === "architecture_review";
          return (
            <g
              className={`graph-node ${selected ? "selected" : ""} ${hovered ? "hovered" : ""} ${isCritical ? "critical" : ""}`}
              key={node.id}
              transform={`translate(${node.x} ${node.y})`}
              opacity={faded ? 0.2 : 1}
              onClick={() => onSelectNode(node)}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              onFocus={() => setHoveredNodeId(node.id)}
              onBlur={() => setHoveredNodeId(null)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectNode(node);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`${node.title}, ${knowledgeNodeTypeLabel(node.type)}, 연결 ${node.degree}개`}
            >
              <circle
                r={hovered ? radius + 4 : radius}
                fill={getKnowledgeNodeColor(node.type)}
                stroke={selected || inActiveChain ? "#f8fafc" : "#0f172a"}
                strokeWidth={selected || inActiveChain ? 3 : 1.5}
                filter={node.isRecent || selected || inActiveChain ? "url(#graphGlow)" : undefined}
              />
              <circle r={radius + 5} fill="none" stroke={getKnowledgeNodeColor(node.type)} strokeWidth={1} opacity={isCritical ? 0.7 : 0.18} />
              {showLabel ? (
                <>
                  <text y={radius + 18} textAnchor="middle" className="graph-node-label">
                    {truncateGraphLabel(node.label, 18)}
                  </text>
                  <text y={radius + 33} textAnchor="middle" className="graph-node-type">
                    {knowledgeNodeTypeLabel(node.type)}
                  </text>
                </>
              ) : null}
              <title>{`${node.title}\n중요도: ${node.importanceScore}\n${knowledgeNodeTypeLabel(node.type)}`}</title>
            </g>
          );
        })}
      </svg>
      {hoveredNode ? (
        <div className="graph-hover-card" role="status" aria-live="polite">
          <span>{knowledgeNodeTypeLabel(hoveredNode.type)}</span>
          <strong>{hoveredNode.title}</strong>
          <small>{hoveredNode.source || "archiveos"} · 연결 {hoveredNode.degree}개 · 중요도 {hoveredNode.importanceScore}</small>
        </div>
      ) : null}
    </div>
  );
}
