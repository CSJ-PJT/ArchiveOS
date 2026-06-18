import { useMemo } from "react";
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
  const nodeMap = useMemo(() => new Map(positionedNodes.map((node) => [node.id, node])), [positionedNodes]);
  const focus = useMemo(() => getGraphFocusContext(graph, selectedNodeId, activeChain), [graph, selectedNodeId, activeChain]);
  const hasFocus = Boolean(selectedNodeId || activeChain);

  if (graph.nodes.length === 0) {
    return (
      <div className="graph-empty-canvas">
        <strong>아직 Knowledge Graph 데이터가 충분하지 않습니다.</strong>
        <span>Daily Report, Nightly Review, Architect Review, Historian Export가 실행되면 노드와 엣지가 생성됩니다.</span>
      </div>
    );
  }

  return (
    <div className="knowledge-graph-canvas" role="img" aria-label="Operational memory knowledge graph">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
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
          const activeEdge = activeChain?.edgeIds.has(edge.id) || focus.edgeIds.has(edge.id);
          const faded = hasFocus && !activeEdge && !(focus.nodeIds.has(edge.from) && focus.nodeIds.has(edge.to));
          return (
            <g key={edge.id}>
              <line
                className={activeEdge ? "graph-edge active" : "graph-edge"}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={getKnowledgeEdgeColor(edge)}
                strokeWidth={activeEdge ? getKnowledgeEdgeWidth(edge) + 2.5 : getKnowledgeEdgeWidth(edge)}
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
                  {edge.type}
                </text>
              ) : null}
            </g>
          );
        })}

        {positionedNodes.map((node) => {
          const selected = selectedNodeId === node.id;
          const inFocus = focus.nodeIds.has(node.id);
          const inActiveChain = activeChain?.nodeIds.has(node.id);
          const faded = hasFocus && !selected && !inFocus && !inActiveChain;
          const radius = getKnowledgeNodeRadius(node);
          const isCritical = node.importanceLevel === "critical";
          const showLabel =
            selected ||
            inActiveChain ||
            node.importanceLevel === "critical" ||
            node.importanceLevel === "high" ||
            node.type === "decision" ||
            node.type === "architecture_review";
          return (
            <g
              className={`graph-node ${selected ? "selected" : ""} ${isCritical ? "critical" : ""}`}
              key={node.id}
              transform={`translate(${node.x} ${node.y})`}
              opacity={faded ? 0.2 : 1}
              onClick={() => onSelectNode(node)}
            >
              <circle
                r={radius}
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
                    {node.type}
                  </text>
                </>
              ) : null}
              <title>{`${node.title}\nimportance: ${node.importanceScore}\n${node.type}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
