import type { KnowledgeGraphNode } from "../../lib/backendApi";
import {
  KnowledgeCompactValue,
  KnowledgeMetric,
  KnowledgeStatusBadge,
  formatExactDate,
  formatRelativeTime,
} from "./KnowledgeUi";
import type { ActiveDecisionChain } from "./knowledgeGraphUtils";
import { getImportanceBadgeStyle, truncateGraphLabel } from "./knowledgeGraphUtils";

export function ActiveDecisionChainPanel({
  chains,
  selectedChainId,
  onSelectChain,
  onSelectNode,
}: {
  chains: ActiveDecisionChain[];
  selectedChainId: string | null;
  onSelectChain: (chain: ActiveDecisionChain) => void;
  onSelectNode: (node: KnowledgeGraphNode) => void;
}) {
  const selectedChain = chains.find((chain) => chain.id === selectedChainId) || chains[0] || null;

  return (
    <section className="active-operational-chains">
      <div className="chain-section-header">
        <div>
          <span className="eyebrow">Operational Memory First</span>
          <h3>Active Operational Chains</h3>
        </div>
        <KnowledgeStatusBadge tone={chains.length ? "working" : "idle"}>{chains.length ? `${chains.length} chains` : "no chain"}</KnowledgeStatusBadge>
      </div>

      {chains.length ? (
        <div className="operational-chain-grid">
          {chains.map((chain) => (
            <button
              className={`operational-chain-card ${selectedChain?.id === chain.id ? "selected" : ""}`}
              key={chain.id}
              type="button"
              onClick={() => onSelectChain(chain)}
            >
              <div className="chain-card-header">
                <strong title={chain.title}>{truncateGraphLabel(chain.title, 42)}</strong>
                <KnowledgeStatusBadge tone={chain.risk === "High" ? "failed" : chain.risk === "Medium" ? "reviewing" : "succeeded"}>
                  Risk {chain.risk}
                </KnowledgeStatusBadge>
              </div>
              <div className="chain-card-meta">
                <span>Status: {chain.status}</span>
                <span>Priority: {chain.priority}</span>
                <span title={formatExactDate(chain.lastUpdated)}>Updated: {formatRelativeTime(chain.lastUpdated)}</span>
              </div>
              <div className="chain-card-statuses">
                <KnowledgeMetric label="Architect" value={chain.architectStatus} tone={chain.risk === "High" ? "failed" : "reviewing"} />
                <KnowledgeMetric label="Builder" value={chain.builderStatus} tone="working" />
                <KnowledgeMetric label="Reviewer" value={chain.reviewerStatus} tone="reviewing" />
                <KnowledgeMetric label="PM" value={chain.pmDecisionStatus} tone={chain.pmDecisionStatus === "pending" ? "failed" : "succeeded"} />
              </div>
              <div className="mini-chain">
                {chain.steps.map((step, index) => (
                  <span className={step.node ? "linked" : "missing"} key={step.key} title={step.node?.title || step.fallback}>
                    {step.label.replace(" Result", "").replace(" Verdict", "").replace(" Review", "")}
                    {index < chain.steps.length - 1 ? <b>→</b> : null}
                  </span>
                ))}
              </div>
              <p title={chain.warning}>{chain.warning}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="active-decision-chain empty">
          <strong>No active operational chain yet</strong>
          <span>Decision, review, and report records will appear here once linked.</span>
        </div>
      )}

      <OperationalChainReplay chain={selectedChain} onSelectNode={onSelectNode} />
    </section>
  );
}

function OperationalChainReplay({
  chain,
  onSelectNode,
}: {
  chain: ActiveDecisionChain | null;
  onSelectNode: (node: KnowledgeGraphNode) => void;
}) {
  if (!chain) return null;

  return (
    <div className="chain-replay-panel">
      <div className="chain-section-header">
        <div>
          <span className="eyebrow">Selected Chain Detail</span>
          <h3>Operational Memory Replay</h3>
        </div>
        <KnowledgeStatusBadge tone={chain.risk === "High" ? "failed" : chain.risk === "Medium" ? "reviewing" : "succeeded"}>
          {chain.status}
        </KnowledgeStatusBadge>
      </div>
      <div className="chain-replay-list">
        {chain.steps.map((step, index) => (
          <button
            className={`chain-replay-step ${step.node ? "linked" : "missing"}`}
            key={step.key}
            type="button"
            disabled={!step.node}
            onClick={() => step.node && onSelectNode(step.node)}
          >
            <span className="chain-step-index">{index + 1}</span>
            <div>
              <span className="eyebrow">{step.label}</span>
              {step.node ? (
                <>
                  <strong title={step.node.title}>{truncateGraphLabel(step.node.title, 54)}</strong>
                  <small>
                    {step.node.type} · {step.node.importanceLevel} · {formatRelativeTime(step.node.createdAt)}
                  </small>
                </>
              ) : (
                <>
                  <strong>{step.fallback}</strong>
                  <small>Not enough metadata linked yet</small>
                </>
              )}
            </div>
            {step.node ? <KnowledgeStatusBadge tone={getImportanceBadgeStyle(step.node.importanceLevel)}>{step.node.importanceLevel}</KnowledgeStatusBadge> : null}
          </button>
        ))}
      </div>
      <div className="chain-replay-summary">
        <KnowledgeCompactValue value={`Risk: ${chain.risk}`} />
        <KnowledgeCompactValue value={`Warning: ${chain.warning}`} />
      </div>
    </div>
  );
}
