export type AgentStatus = "idle" | "working" | "reviewing" | "failed" | "waiting";
export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "failed";
export type LogType = "summary" | "decision" | "error" | "review";
export type CommandStatus = "pending" | "running" | "succeeded" | "failed";
export type BatchStatus = "completed" | "sent" | "skipped" | "failed";
export type BatchType = "nightly_review" | "daily_report";
export type OperationStatus = "normal" | "warning" | "problem";
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

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  current_task: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_agent_id: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  agent?: Pick<Agent, "name" | "status"> | null;
}

export interface WorkLog {
  id: string;
  task_id: string | null;
  agent_id: string | null;
  log_type: LogType;
  content: string;
  created_at: string;
  task?: Pick<Task, "title" | "status"> | null;
  agent?: Pick<Agent, "name" | "role"> | null;
}

export interface CommandRun {
  id: string;
  command: string;
  command_type: string | null;
  status: CommandStatus;
  result: string | null;
  created_at: string;
  updated_at: string;
}

export interface BatchRun {
  id: string;
  batch_type: BatchType;
  status: BatchStatus;
  target_date: string;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DailyReport {
  id: string;
  target_date: string;
  status: OperationStatus;
  status_reason: string;
  runtime_summary: Record<string, unknown>;
  latest_builder: Record<string, unknown> | null;
  latest_reviewer: Record<string, unknown> | null;
  operator_summary: Record<string, unknown>;
  warnings: string[];
  decisions_count: number;
  commands_count: number;
  discord_sent: boolean;
  discord_skipped_reason: string | null;
  historian_exported: boolean;
  historian_note_path: string | null;
  historian_export_reason: string | null;
  report_text: string;
  created_at: string;
}

export interface RuntimeSnapshot {
  id: string;
  captured_at: string;
  inbox_count: number;
  processing_count: number;
  outbox_count: number;
  reviews_count: number;
  active_task: string | null;
  latest_builder: Record<string, unknown> | null;
  latest_reviewer: Record<string, unknown> | null;
  operators: Record<string, unknown>;
  warnings: string[];
  source: string;
}

export interface PmTask {
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
}

export interface PmTaskDecision {
  id: string;
  task_id: string;
  action: PmDecisionAction;
  reason: string | null;
  created_at: string;
}

export interface PmTaskEvent {
  id: string;
  task_id: string;
  event_type: string;
  title: string;
  description: string | null;
  source: "queue" | "architect" | "builder" | "reviewer" | "pm" | "discord";
  metadata: Record<string, unknown>;
  created_at: string;
}
