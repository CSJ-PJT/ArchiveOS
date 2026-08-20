import type { KnowledgeGraph, KnowledgeGraphInsights, KnowledgeGraphNode } from "../../lib/backendApi";
import { KnowledgeMetric, KnowledgeStatusBadge, knowledgeImportanceLabel, localizeKnowledgeText } from "./KnowledgeUi";
import { getImportanceBadgeStyle, truncateGraphLabel } from "./knowledgeGraphUtils";

export function KnowledgeGraphInsightsPanel({
  insights,
  graph,
  onSelectNode,
}: {
  insights: KnowledgeGraphInsights | null;
  graph: KnowledgeGraph;
  onSelectNode: (node: KnowledgeGraphNode) => void;
}) {
  const mostConnected = [...graph.nodes].sort((a, b) => b.degree - a.degree)[0] || null;
  const latestImportant = [...graph.nodes]
    .filter((node) => node.importanceLevel === "high" || node.importanceLevel === "critical")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  return (
    <div className="graph-insights">
      <div className="graph-insight-grid">
        <KnowledgeMetric label="가장 중요한 노드" value={insights?.topNodes?.[0]?.label || graph.nodes[0]?.label || "없음"} tone="working" />
        <KnowledgeMetric label="가장 많이 연결된 노드" value={mostConnected ? `${truncateGraphLabel(mostConnected.label, 18)} (${mostConnected.degree})` : "없음"} tone="reviewing" />
        <KnowledgeMetric label="최근 중요 노드" value={latestImportant ? truncateGraphLabel(latestImportant.label, 20) : "없음"} tone="succeeded" />
        <KnowledgeMetric label="긴급 노드" value={insights?.graphHealth?.criticalCount ?? graph.nodes.filter((node) => node.importanceLevel === "critical").length} tone="failed" />
      </div>

      {insights?.topNodes?.length ? (
        <div className="insight-list">
          <span className="eyebrow">그래프 분석</span>
          {insights.topNodes.slice(0, 5).map((node) => {
            const graphNode = graph.nodes.find((candidate) => candidate.id === node.id);
            return (
              <button className="insight-row" type="button" key={node.id} onClick={() => graphNode && onSelectNode(graphNode)}>
                <span title={node.label}>{truncateGraphLabel(node.label, 34)}</span>
                <KnowledgeStatusBadge tone={getImportanceBadgeStyle(node.importanceLevel)}>{knowledgeImportanceLabel(node.importanceLevel)}</KnowledgeStatusBadge>
                <small>{localizeKnowledgeText(node.reason)}</small>
              </button>
            );
          })}
        </div>
      ) : null}

      {insights?.notes?.length ? (
        <div className="graph-notes">
          {insights.notes.slice(0, 3).map((note) => (
            <span key={note}>{localizeKnowledgeText(note)}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
