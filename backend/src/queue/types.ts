export type PmTaskPriority = "high" | "medium" | "low";

export type PmTaskStatus =
  | "queued"
  | "architect_review"
  | "ready_for_build"
  | "building"
  | "review"
  | "pm_decision_required"
  | "approved"
  | "rejected"
  | "hold"
  | "failed"
  | "done";

export type PmDecisionAction = "approve" | "reject" | "hold" | "retry";

export type PmTaskRow = {
  id: string;
  title: string;
  description: string;
  priority: PmTaskPriority;
  status: PmTaskStatus;
  target_project: string;
  scope_files: string[] | null;
  max_iterations: number;
  current_iteration: number;
  cost_budget: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  latest_architect_review_id: string | null;
  latest_builder_result_id: string | null;
  latest_reviewer_result_id: string | null;
  latest_pm_decision_id: string | null;
  metadata: Record<string, unknown>;
};

export type PmTaskDecisionRow = {
  id: string;
  task_id: string;
  action: PmDecisionAction;
  reason: string | null;
  created_at: string;
};

export type PmTaskEventRow = {
  id: string;
  task_id: string;
  event_type: string;
  title: string;
  description: string | null;
  source: "queue" | "architect" | "builder" | "reviewer" | "pm" | "discord";
  metadata: Record<string, unknown>;
  created_at: string;
};

export type QueueSummary = {
  queued: number;
  in_progress: number;
  pm_decision_required: number;
  done_today: number;
  failed_today: number;
  current_task: Pick<PmTaskRow, "id" | "title" | "priority" | "status" | "current_iteration" | "max_iterations"> | null;
  recommended_pm_action: string;
  updated_at: string;
};
