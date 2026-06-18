import type { KnowledgeGraph, KnowledgeGraphInsights, KnowledgeGraphNode } from "../../lib/backendApi";
import { KnowledgeMetric, KnowledgeStatusBadge } from "./KnowledgeUi";
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
        <KnowledgeMetric label="Most Important Node" value={insights?.topNodes?.[0]?.label || graph.nodes[0]?.label || "None"} tone="working" />
        <KnowledgeMetric label="Most Connected Node" value={mostConnected ? `${truncateGraphLabel(mostConnected.label, 18)} (${mostConnected.degree})` : "None"} tone="reviewing" />
        <KnowledgeMetric label="Latest Important Node" value={latestImportant ? truncateGraphLabel(latestImportant.label, 20) : "None"} tone="succeeded" />
        <KnowledgeMetric label="Critical Nodes" value={insights?.graphHealth?.criticalCount ?? graph.nodes.filter((node) => node.importanceLevel === "critical").length} tone="failed" />
      </div>

      {insights?.topNodes?.length ? (
        <div className="insight-list">
          <span className="eyebrow">Graph Insights</span>
          {insights.topNodes.slice(0, 5).map((node) => {
            const graphNode = graph.nodes.find((candidate) => candidate.id === node.id);
            return (
              <button className="insight-row" type="button" key={node.id} onClick={() => graphNode && onSelectNode(graphNode)}>
                <span title={node.label}>{truncateGraphLabel(node.label, 34)}</span>
                <KnowledgeStatusBadge tone={getImportanceBadgeStyle(node.importanceLevel)}>{node.importanceLevel}</KnowledgeStatusBadge>
                <small>{node.reason}</small>
              </button>
            );
          })}
        </div>
      ) : null}

      {insights?.notes?.length ? (
        <div className="graph-notes">
          {insights.notes.slice(0, 3).map((note) => (
            <span key={note}>{note}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
