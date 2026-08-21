import type { KnowledgeGraphNode } from "../../lib/backendApi";
import {
  KnowledgeCompactValue,
  KnowledgeMetric,
  KnowledgeStatusBadge,
  formatExactDate,
  formatRelativeTime,
  knowledgeImportanceLabel,
  knowledgeNodeTypeLabel,
  knowledgeStateLabel,
  localizeKnowledgeText,
} from "./KnowledgeUi";
import type { ActiveDecisionChain } from "./knowledgeGraphUtils";
import { getImportanceBadgeStyle, truncateGraphLabel } from "./knowledgeGraphUtils";

export function ActiveDecisionChainPanel({
  chains,
  selectedChainId,
  onSelectChain,
  onSelectNode,
  showReplay = true,
}: {
  chains: ActiveDecisionChain[];
  selectedChainId: string | null;
  onSelectChain: (chain: ActiveDecisionChain) => void;
  onSelectNode: (node: KnowledgeGraphNode) => void;
  showReplay?: boolean;
}) {
  const selectedChain = chains.find((chain) => chain.id === selectedChainId) || chains[0] || null;

  return (
    <section className="active-operational-chains">
      <div className="chain-section-header">
        <div>
          <span className="eyebrow">운영 메모리 우선</span>
          <h3>활성 운영 체인</h3>
        </div>
        <KnowledgeStatusBadge tone={chains.length ? "working" : "idle"}>{chains.length ? `${chains.length}개 체인` : "체인 없음"}</KnowledgeStatusBadge>
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
                  위험 {knowledgeImportanceLabel(chain.risk)}
                </KnowledgeStatusBadge>
              </div>
              <div className="chain-card-meta">
                <span>상태: {knowledgeStateLabel(chain.status)}</span>
                <span>우선순위: {knowledgeImportanceLabel(chain.priority)}</span>
                <span title={formatExactDate(chain.lastUpdated)}>갱신: {formatRelativeTime(chain.lastUpdated)}</span>
              </div>
              <div className="chain-card-statuses">
                {chain.kind === "memory" ? (
                  <>
                    <KnowledgeMetric label="실데이터 노드" value={chain.nodeIds.size} tone="working" />
                    <KnowledgeMetric label="실데이터 연결" value={chain.edgeIds.size} tone="reviewing" />
                    <KnowledgeMetric label="메모리 상태" value="연결됨" tone="succeeded" />
                  </>
                ) : (
                  <>
                    <KnowledgeMetric label="아키텍처" value={knowledgeStateLabel(chain.architectStatus)} tone={chain.risk === "High" ? "failed" : "reviewing"} />
                    <KnowledgeMetric label="구현" value={knowledgeStateLabel(chain.builderStatus)} tone="working" />
                    <KnowledgeMetric label="검토" value={knowledgeStateLabel(chain.reviewerStatus)} tone="reviewing" />
                    <KnowledgeMetric label="PM" value={knowledgeStateLabel(chain.pmDecisionStatus)} tone={chain.pmDecisionStatus === "pending" ? "failed" : "succeeded"} />
                  </>
                )}
              </div>
              <div className="mini-chain">
                {chain.steps.map((step, index) => (
                  <span className={step.node ? "linked" : "missing"} key={step.key} title={step.node?.title || step.fallback}>
                    {stepLabel(step.label)}
                    {index < chain.steps.length - 1 ? <b>-&gt;</b> : null}
                  </span>
                ))}
              </div>
              <p title={chain.warning}>{localizeChainWarning(chain.warning)}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="active-decision-chain empty">
          <strong>아직 활성 운영 체인이 없습니다.</strong>
          <span>결정·검토·보고 기록이 서로 연결되면 이곳에 표시됩니다.</span>
        </div>
      )}

      {showReplay ? <OperationalChainReplay chain={selectedChain} onSelectNode={onSelectNode} /> : null}
    </section>
  );
}

export function OperationalChainReplay({
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
          <span className="eyebrow">선택한 체인 상세</span>
          <h3>운영 메모리 재생</h3>
        </div>
        <KnowledgeStatusBadge tone={chain.risk === "High" ? "failed" : chain.risk === "Medium" ? "reviewing" : "succeeded"}>
          {knowledgeStateLabel(chain.status)}
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
              <span className="eyebrow">{stepLabel(step.label)}</span>
              {step.node ? (
                <>
                  <strong title={step.node.title}>{truncateGraphLabel(step.node.title, 54)}</strong>
                  <small>
                    {knowledgeNodeTypeLabel(step.node.type)} · {knowledgeImportanceLabel(step.node.importanceLevel)} · {formatRelativeTime(step.node.updatedAt || step.node.createdAt)}
                  </small>
                </>
              ) : (
                <>
                  <strong>{step.fallback}</strong>
                  <small>아직 연결된 메타데이터가 충분하지 않습니다.</small>
                </>
              )}
            </div>
            {step.node ? <KnowledgeStatusBadge tone={getImportanceBadgeStyle(step.node.importanceLevel)}>{knowledgeImportanceLabel(step.node.importanceLevel)}</KnowledgeStatusBadge> : null}
          </button>
        ))}
      </div>
      <div className="chain-replay-summary">
        <KnowledgeCompactValue value={`위험: ${knowledgeImportanceLabel(chain.risk)}`} />
        <KnowledgeCompactValue value={`주의: ${localizeChainWarning(chain.warning)}`} />
      </div>
    </div>
  );
}

function localizeChainWarning(value: string) {
  return ({ "PM decision is still pending.": "PM 결정이 아직 대기 중입니다.", "Architect review is marked critical.": "아키텍처 검토가 긴급으로 표시되었습니다.", "Reviewer verdict is marked critical.": "검토 결과가 긴급으로 표시되었습니다.", "No blocking warning detected.": "차단 경고가 감지되지 않았습니다." } as Record<string, string>)[value] || localizeKnowledgeText(value);
}

function stepLabel(value: string) {
  return ({ "Architect Review": "아키텍처 검토", "Builder Result": "구현 결과", "Reviewer Verdict": "검토 결과", "PM Decision": "PM 결정", "Knowledge Record": "지식 기록" } as Record<string, string>)[value] || knowledgeNodeTypeLabel(value);
}
