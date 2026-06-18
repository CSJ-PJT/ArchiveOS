import type { PmTask } from "../../types/database";
import { KnowledgePanel, KnowledgeStatusBadge, formatRelativeTime } from "./KnowledgeUi";

export function OperationalMemoryChainPanel({ tasks }: { tasks: PmTask[] }) {
  const activeTask =
    tasks.find((task) => task.status === "pm_decision_required") ||
    tasks.find((task) => task.status === "review") ||
    tasks.find((task) => task.status === "building") ||
    tasks[0] ||
    null;

  const steps = [
    {
      label: "Architect Review",
      value: activeTask?.latest_architect_review_id || "Awaiting architect review",
      tone: activeTask?.latest_architect_review_id ? "reviewing" : "idle",
    },
    {
      label: "Builder Result",
      value: activeTask?.latest_builder_result_id || "Awaiting builder result",
      tone: activeTask?.latest_builder_result_id ? "working" : "idle",
    },
    {
      label: "Reviewer Verdict",
      value: activeTask?.latest_reviewer_result_id || "Awaiting reviewer verdict",
      tone: activeTask?.latest_reviewer_result_id ? "reviewing" : "idle",
    },
    {
      label: "PM Decision",
      value: activeTask?.latest_pm_decision_id || "Decision not recorded",
      tone: activeTask?.latest_pm_decision_id ? "succeeded" : activeTask?.status === "pm_decision_required" ? "failed" : "idle",
    },
    {
      label: "Knowledge Record",
      value: activeTask ? "Linked through Knowledge Graph metadata" : "No active task",
      tone: activeTask ? "succeeded" : "idle",
    },
  ];

  return (
    <KnowledgePanel
      title="Operational Memory Chain"
      eyebrow="Task -> Architect -> Builder -> Reviewer -> PM -> Knowledge"
      right={activeTask ? <KnowledgeStatusBadge tone={activeTask.status === "pm_decision_required" ? "failed" : "working"}>{activeTask.status}</KnowledgeStatusBadge> : null}
    >
      {activeTask ? (
        <div className="operational-chain">
          <div className="chain-task-summary">
            <span className="eyebrow">Active chain target</span>
            <strong title={activeTask.title}>{activeTask.title}</strong>
            <span>
              {activeTask.priority} priority · iteration {activeTask.current_iteration}/{activeTask.max_iterations} ·{" "}
              {formatRelativeTime(activeTask.updated_at)}
            </span>
          </div>
          <div className="memory-chain-row">
            {steps.map((step, index) => (
              <div className="memory-chain-step" key={step.label}>
                <div className={`memory-chain-node ${step.tone}`}>
                  <span>{step.label}</span>
                  <strong title={step.value}>{step.value}</strong>
                </div>
                {index < steps.length - 1 ? <span className="memory-chain-arrow">→</span> : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <strong>No operational chain yet</strong>
          <span>PM task queue activity will create the Architect → Builder → Reviewer → PM Decision → Knowledge chain.</span>
        </div>
      )}
    </KnowledgePanel>
  );
}
