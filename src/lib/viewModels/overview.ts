import type {
  ArchitectureReview,
  EndpointHealth,
  HistorianStatus,
  KnowledgeOverview,
  KpiOverview,
  LocalRuntimeStatus,
  MeshOverview,
  QueueSummary,
  RuntimeEvent,
} from "../backendApi";
import type { PmTask } from "../../types/database";
import type { SemanticStatus } from "../../components/shared/StatusBadge";

export type RuntimeFlowStage = {
  id: string;
  label: string;
  status: "idle" | "waiting" | "running" | "success" | "failed" | "blocked";
};

export type OverviewViewModel = {
  systemStatus: "Healthy" | "Working" | "Waiting" | "Warning" | "Offline";
  statusTone: SemanticStatus;
  activeTask: string;
  currentAgent: string;
  currentStage: string;
  approvalCount: number;
  criticalAlertCount: number;
  lastUpdatedAt: string;
  queueCounts: {
    inbox: number;
    processing: number;
    review: number;
    pmDecision: number;
    failed: number;
  };
  runtimeFlow: RuntimeFlowStage[];
  memorySummary: {
    nodes: number;
    relations: number;
    recentMemory: number;
    staleMemory: number;
    lastSync: string;
    ragReady: boolean;
  };
  activeChain: {
    task: string;
    owner: string;
    stage: string;
    elapsed: string;
    nextAction: string;
  } | null;
  attention: Array<{ title: string; body: string; status: SemanticStatus }>;
  recentEvents: RuntimeEvent[];
};

function countTasks(tasks: PmTask[], status: PmTask["status"]) {
  return tasks.filter((task) => task.status === status).length;
}

function chooseStage(queue: QueueSummary | null, runtime: LocalRuntimeStatus | null, tasks: PmTask[]) {
  if (queue?.pm_decision_required || countTasks(tasks, "pm_decision_required") > 0) return "PM Approval";
  if ((runtime?.queue.processing || 0) > 0 || queue?.in_progress) return "Builder";
  if ((runtime?.queue.reviews || 0) > 0 || countTasks(tasks, "review") > 0) return "Reviewer";
  if ((runtime?.queue.inbox || 0) > 0 || queue?.queued) return "Queue";
  return "Idle";
}

function buildFlow(currentStage: string, failed: number): RuntimeFlowStage[] {
  const labels = ["Request", "Queue", "Architect", "Builder", "Reviewer", "PM Approval", "Deploy"];
  const index = labels.indexOf(currentStage);
  return labels.map((label, stageIndex) => {
    if (failed > 0 && stageIndex >= Math.max(index, 0)) return { id: label, label, status: "failed" };
    if (label === currentStage) return { id: label, label, status: currentStage === "Idle" ? "idle" : "running" };
    if (index > -1 && stageIndex < index) return { id: label, label, status: "success" };
    if (label === "PM Approval" && currentStage === "PM Approval") return { id: label, label, status: "blocked" };
    return { id: label, label, status: "idle" };
  });
}

export function buildOverviewViewModel(input: {
  runtime: LocalRuntimeStatus | null;
  queue: QueueSummary | null;
  tasks: PmTask[];
  events: RuntimeEvent[];
  knowledge: KnowledgeOverview | null;
  historian: HistorianStatus | null;
  endpointHealth: EndpointHealth | null;
  mesh: MeshOverview | null;
  kpi: KpiOverview | null;
  architect: ArchitectureReview | null;
}): OverviewViewModel {
  const { runtime, queue, tasks, events, knowledge, historian, endpointHealth, mesh, kpi, architect } = input;
  const pmDecision = queue?.pm_decision_required ?? countTasks(tasks, "pm_decision_required");
  const failed = queue?.failed_today ?? countTasks(tasks, "failed");
  const processing = runtime?.queue.processing ?? queue?.in_progress ?? 0;
  const inbox = runtime?.queue.inbox ?? queue?.queued ?? 0;
  const review = runtime?.queue.reviews ?? countTasks(tasks, "review");
  const currentStage = chooseStage(queue, runtime, tasks);
  const activeTask = queue?.current_task?.title || runtime?.active_task || tasks.find((task) => task.status !== "done")?.title || "No active task";
  const currentAgent =
    processing > 0
      ? "Builder Agent"
      : review > 0
        ? "Reviewer Agent"
        : architect?.status === "warning" || architect?.status === "blocked"
          ? "Architect"
          : "None";
  const endpointProblems = endpointHealth ? endpointHealth.summary.failed + endpointHealth.summary.missing + endpointHealth.summary.error : 0;
  const warningCount = kpi?.runtime.warningCount ?? 0;
  const criticalAlertCount = failed + endpointProblems + (architect?.status === "blocked" ? 1 : 0);

  let systemStatus: OverviewViewModel["systemStatus"] = "Healthy";
  let statusTone: SemanticStatus = "healthy";
  if (!runtime && endpointProblems > 0) {
    systemStatus = "Offline";
    statusTone = "offline";
  } else if (criticalAlertCount > 0) {
    systemStatus = "Warning";
    statusTone = "warning";
  } else if (processing > 0 || currentStage !== "Idle") {
    systemStatus = "Working";
    statusTone = "working";
  } else if (inbox > 0 || pmDecision > 0) {
    systemStatus = "Waiting";
    statusTone = "waiting";
  }

  const attention = [
    pmDecision > 0
      ? {
          title: "PM approval required",
          body: `${pmDecision} task(s) require a human decision.`,
          status: "blocked" as SemanticStatus,
        }
      : null,
    endpointProblems > 0
      ? {
          title: "Endpoint health needs review",
          body: `${endpointProblems} endpoint(s) are missing or failing.`,
          status: "warning" as SemanticStatus,
        }
      : null,
    failed > 0
      ? {
          title: "Failed workflow detected",
          body: `${failed} failed task(s) today.`,
          status: "critical" as SemanticStatus,
        }
      : null,
    warningCount > 0
      ? {
          title: "Runtime warnings present",
          body: `${warningCount} warning(s) recorded in KPI data.`,
          status: "warning" as SemanticStatus,
        }
      : null,
    historian && !historian.enabled
      ? {
          title: "Historian disabled",
          body: "Obsidian export is not configured or not enabled.",
          status: "not_configured" as SemanticStatus,
        }
      : null,
  ].filter(Boolean) as OverviewViewModel["attention"];

  return {
    systemStatus,
    statusTone,
    activeTask,
    currentAgent,
    currentStage,
    approvalCount: pmDecision,
    criticalAlertCount,
    lastUpdatedAt: queue?.updated_at || runtime?.checked_at || new Date().toISOString(),
    queueCounts: {
      inbox,
      processing,
      review,
      pmDecision,
      failed,
    },
    runtimeFlow: buildFlow(currentStage, failed),
    memorySummary: {
      nodes: knowledge?.totalNodes ?? 0,
      relations: knowledge?.totalEdges ?? 0,
      recentMemory: knowledge?.latestNodes?.length ?? 0,
      staleMemory: Math.max(0, (knowledge?.totalNodes ?? 0) - (knowledge?.latestNodes?.length ?? 0)),
      lastSync: historian?.lastExport?.createdAt || "Unknown",
      ragReady: Boolean(knowledge?.totalNodes && knowledge.totalNodes > 0),
    },
    activeChain:
      activeTask === "No active task"
        ? null
        : {
            task: activeTask,
            owner: currentAgent,
            stage: currentStage,
            elapsed: "live",
            nextAction: queue?.recommended_pm_action || (pmDecision > 0 ? "PM decision" : "Monitor"),
          },
    attention: attention.slice(0, 5),
    recentEvents: events.slice(0, 5),
  };
}
