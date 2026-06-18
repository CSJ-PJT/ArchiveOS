import type { KnowledgeGraph, KnowledgeGraphEdge, KnowledgeGraphNode } from "../../lib/backendApi";
import {
  KnowledgeCompactValue,
  KnowledgeEmptyState,
  KnowledgeSourceLabel,
  KnowledgeStatusBadge,
  copyText,
  formatExactDate,
  formatRelativeTime,
} from "./KnowledgeUi";
import type { ActiveDecisionChain } from "./knowledgeGraphUtils";
import {
  getGraphNodeImportanceReason,
  getGraphNodeImportanceReasons,
  getImportanceBadgeStyle,
  readEdgeReason,
  truncateGraphLabel,
} from "./knowledgeGraphUtils";

export function KnowledgeGraphNodeDetail({
  node,
  graph,
  activeChain,
}: {
  node: KnowledgeGraphNode | null;
  graph: KnowledgeGraph;
  activeChain: ActiveDecisionChain | null;
}) {
  if (!node) {
    return (
      <aside className="graph-detail-panel">
        <KnowledgeEmptyState title="Select a node" body="Click a graph node to inspect its operational memory context." />
      </aside>
    );
  }

  const relatedEdges = graph.edges.filter((edge) => edge.from === node.id || edge.to === node.id);
  const reasons = getGraphNodeImportanceReasons(node, graph, activeChain);

  return (
    <aside className="graph-detail-panel">
      <div className="detail-header">
        <div>
          <span className="eyebrow">Selected Node</span>
          <h3 title={node.title}>{truncateGraphLabel(node.title, 46)}</h3>
        </div>
        <KnowledgeStatusBadge tone={getImportanceBadgeStyle(node.importanceLevel)}>{node.importanceLevel}</KnowledgeStatusBadge>
      </div>

      <div className="detail-grid">
        <span>Type</span>
        <strong>{node.type}</strong>
        <span>Source</span>
        <strong>{node.source || "unknown"}</strong>
        <span>Importance</span>
        <strong>{node.importanceScore}</strong>
        <span>Created</span>
        <strong title={formatExactDate(node.createdAt)}>{formatRelativeTime(node.createdAt)}</strong>
      </div>

      {node.summary ? <p className="detail-summary">{node.summary}</p> : null}

      <div className="why-important">
        <span className="eyebrow">Why Important</span>
        <strong>{getGraphNodeImportanceReason(node)}</strong>
        <ul>
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>

      <div className="detail-section">
        <span className="eyebrow">External Ref</span>
        <div className="copy-row">
          <KnowledgeCompactValue value={node.externalRef} maxLength={34} />
          {node.externalRef ? (
            <button type="button" onClick={() => copyText(node.externalRef || "")}>
              Copy
            </button>
          ) : null}
        </div>
      </div>

      <div className="detail-section">
        <span className="eyebrow">Related Edges</span>
        <div className="mini-edge-list">
          {relatedEdges.slice(0, 6).map((edge) => (
            <div className="mini-edge" key={edge.id}>
              <KnowledgeSourceLabel>{edge.type}</KnowledgeSourceLabel>
              <span title={readEdgeReason(edge) || edge.label}>{readEdgeReason(edge) || edge.label}</span>
            </div>
          ))}
          {relatedEdges.length === 0 ? <span className="muted">No related edges yet</span> : null}
        </div>
      </div>
    </aside>
  );
}

export function KnowledgeGraphEdgeDetail({
  edge,
  graph,
}: {
  edge: KnowledgeGraphEdge | null;
  graph: KnowledgeGraph;
}) {
  if (!edge) return null;
  const from = graph.nodes.find((node) => node.id === edge.from);
  const to = graph.nodes.find((node) => node.id === edge.to);

  return (
    <div className="edge-detail-panel">
      <div>
        <span className="eyebrow">Selected Relationship</span>
        <strong>{edge.type}</strong>
      </div>
      <p>
        <span title={from?.title}>{truncateGraphLabel(from?.label, 24)}</span> →{" "}
        <span title={to?.title}>{truncateGraphLabel(to?.label, 24)}</span>
      </p>
      <div className="detail-grid">
        <span>Confidence</span>
        <strong>{edge.confidence ?? "unknown"}</strong>
        <span>Importance</span>
        <strong>{edge.importanceScore}</strong>
        <span>Reason</span>
        <strong>{readEdgeReason(edge) || "relationship metadata"}</strong>
      </div>
    </div>
  );
}

export function KnowledgeGraphEdgeList({
  graph,
  collapsed,
  onToggle,
  onSelectEdge,
}: {
  graph: KnowledgeGraph;
  collapsed: boolean;
  onToggle: () => void;
  onSelectEdge: (edge: KnowledgeGraphEdge) => void;
}) {
  return (
    <div className="graph-edge-table">
      <button className="edge-table-toggle" type="button" onClick={onToggle}>
        {collapsed ? "Show relationship table" : "Hide relationship table"}
      </button>
      {!collapsed ? (
        <div className="edge-table">
          {graph.edges.map((edge) => {
            const from = graph.nodes.find((node) => node.id === edge.from);
            const to = graph.nodes.find((node) => node.id === edge.to);
            return (
              <button className="edge-row" type="button" key={edge.id} onClick={() => onSelectEdge(edge)}>
                <span title={from?.title}>{truncateGraphLabel(from?.label, 24)}</span>
                <KnowledgeStatusBadge tone={getImportanceBadgeStyle(edge.importanceLevel)}>{edge.type}</KnowledgeStatusBadge>
                <span title={to?.title}>{truncateGraphLabel(to?.label, 24)}</span>
              </button>
            );
          })}
          {graph.edges.length === 0 ? <KnowledgeEmptyState title="No edges" body="Run historian/batch/decision flows to create graph relationships." /> : null}
        </div>
      ) : null}
    </div>
  );
}
