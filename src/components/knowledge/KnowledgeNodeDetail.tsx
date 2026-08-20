import type { KnowledgeGraph, KnowledgeGraphEdge, KnowledgeGraphNode } from "../../lib/backendApi";
import {
  KnowledgeCompactValue,
  KnowledgeEmptyState,
  KnowledgeSourceLabel,
  KnowledgeStatusBadge,
  copyText,
  formatExactDate,
  formatRelativeTime,
  knowledgeEdgeTypeLabel,
  knowledgeImportanceLabel,
  knowledgeNodeTypeLabel,
  localizeKnowledgeText,
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
        <KnowledgeEmptyState title="노드를 선택하세요" body="그래프 노드를 선택하면 연결된 운영 메모리 맥락을 확인할 수 있습니다." />
      </aside>
    );
  }

  const relatedEdges = graph.edges.filter((edge) => edge.from === node.id || edge.to === node.id);
  const reasons = getGraphNodeImportanceReasons(node, graph, activeChain);

  return (
    <aside className="graph-detail-panel">
      <div className="detail-header">
        <div>
          <span className="eyebrow">선택한 노드</span>
          <h3 title={node.title}>{truncateGraphLabel(node.title, 46)}</h3>
        </div>
        <KnowledgeStatusBadge tone={getImportanceBadgeStyle(node.importanceLevel)}>{knowledgeImportanceLabel(node.importanceLevel)}</KnowledgeStatusBadge>
      </div>

      <div className="detail-grid">
        <span>유형</span>
        <strong>{knowledgeNodeTypeLabel(node.type)}</strong>
        <span>출처</span>
        <strong>{node.source || "알 수 없음"}</strong>
        <span>중요도</span>
        <strong>{node.importanceScore}</strong>
        <span>생성</span>
        <strong title={formatExactDate(node.createdAt)}>{formatRelativeTime(node.createdAt)}</strong>
      </div>

      {node.summary ? <p className="detail-summary">{node.summary}</p> : null}

      <div className="why-important">
        <span className="eyebrow">중요한 이유</span>
        <strong>{localizeKnowledgeText(getGraphNodeImportanceReason(node))}</strong>
        <ul>
          {reasons.map((reason) => (
            <li key={reason}>{localizeKnowledgeText(reason)}</li>
          ))}
        </ul>
      </div>

      <div className="detail-section">
        <span className="eyebrow">외부 참조</span>
        <div className="copy-row">
          <KnowledgeCompactValue value={node.externalRef} maxLength={34} />
          {node.externalRef ? (
            <button type="button" onClick={() => copyText(node.externalRef || "")}>
              복사
            </button>
          ) : null}
        </div>
      </div>

      <div className="detail-section">
        <span className="eyebrow">관련 연결</span>
        <div className="mini-edge-list">
          {relatedEdges.slice(0, 6).map((edge) => (
            <div className="mini-edge" key={edge.id}>
              <KnowledgeSourceLabel>{knowledgeEdgeTypeLabel(edge.type)}</KnowledgeSourceLabel>
              <span title={readEdgeReason(edge) || edge.label}>{readEdgeReason(edge) || edge.label}</span>
            </div>
          ))}
          {relatedEdges.length === 0 ? <span className="muted">아직 관련 연결이 없습니다.</span> : null}
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
        <span className="eyebrow">선택한 관계</span>
        <strong>{knowledgeEdgeTypeLabel(edge.type)}</strong>
      </div>
      <p>
        <span title={from?.title}>{truncateGraphLabel(from?.label, 24)}</span> →{" "}
        <span title={to?.title}>{truncateGraphLabel(to?.label, 24)}</span>
      </p>
      <div className="detail-grid">
        <span>신뢰도</span>
        <strong>{edge.confidence ?? "알 수 없음"}</strong>
        <span>중요도</span>
        <strong>{edge.importanceScore}</strong>
        <span>근거</span>
        <strong>{readEdgeReason(edge) || "관계 메타데이터"}</strong>
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
        {collapsed ? "관계 표 보기" : "관계 표 숨기기"}
      </button>
      {!collapsed ? (
        <div className="edge-table">
          {graph.edges.map((edge) => {
            const from = graph.nodes.find((node) => node.id === edge.from);
            const to = graph.nodes.find((node) => node.id === edge.to);
            return (
              <button className="edge-row" type="button" key={edge.id} onClick={() => onSelectEdge(edge)}>
                <span title={from?.title}>{truncateGraphLabel(from?.label, 24)}</span>
                <KnowledgeStatusBadge tone={getImportanceBadgeStyle(edge.importanceLevel)}>{knowledgeEdgeTypeLabel(edge.type)}</KnowledgeStatusBadge>
                <span title={to?.title}>{truncateGraphLabel(to?.label, 24)}</span>
              </button>
            );
          })}
          {graph.edges.length === 0 ? <KnowledgeEmptyState title="연결 없음" body="Historian·배치·결정 흐름이 실행되면 그래프 관계가 생성됩니다." /> : null}
        </div>
      ) : null}
    </div>
  );
}
