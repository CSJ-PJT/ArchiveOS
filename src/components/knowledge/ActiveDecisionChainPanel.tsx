import type { KnowledgeGraphNode } from "../../lib/backendApi";
import { KnowledgeStatusBadge, KnowledgeCompactValue } from "./KnowledgeUi";
import type { ActiveDecisionChain } from "./knowledgeGraphUtils";
import { getImportanceBadgeStyle, truncateGraphLabel } from "./knowledgeGraphUtils";

export function ActiveDecisionChainPanel({
  chain,
  onSelectNode,
}: {
  chain: ActiveDecisionChain | null;
  onSelectNode: (node: KnowledgeGraphNode) => void;
}) {
  if (!chain) {
    return (
      <div className="active-decision-chain empty">
        <div>
          <span className="eyebrow">Active Decision Chain</span>
          <strong>No active operational chain yet</strong>
        </div>
        <span>Decision, review, and report records will appear here once linked.</span>
      </div>
    );
  }

  return (
    <div className="active-decision-chain">
      <div className="chain-header">
        <div>
          <span className="eyebrow">Active Decision Chain</span>
          <strong title={chain.title}>{truncateGraphLabel(chain.title, 64)}</strong>
        </div>
        <KnowledgeStatusBadge tone="working">Operational Memory</KnowledgeStatusBadge>
      </div>
      <div className="active-chain-steps">
        {chain.steps.map((step, index) => (
          <div className="active-chain-step" key={step.key}>
            <button
              className={`active-chain-node ${step.node ? "linked" : "missing"}`}
              type="button"
              disabled={!step.node}
              title={step.node?.title || step.fallback}
              onClick={() => step.node && onSelectNode(step.node)}
            >
              <span>{step.label}</span>
              {step.node ? (
                <>
                  <strong>{truncateGraphLabel(step.node.label, 26)}</strong>
                  <KnowledgeStatusBadge tone={getImportanceBadgeStyle(step.node.importanceLevel)}>
                    {step.node.importanceLevel}
                  </KnowledgeStatusBadge>
                </>
              ) : (
                <KnowledgeCompactValue value={step.fallback} maxLength={28} />
              )}
            </button>
            {index < chain.steps.length - 1 ? <span className="active-chain-arrow">→</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
