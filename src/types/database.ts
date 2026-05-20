export type AgentStatus = "idle" | "working" | "reviewing" | "failed" | "waiting";
export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "failed";
export type LogType = "summary" | "decision" | "error" | "review";
export type CommandStatus = "pending" | "running" | "succeeded" | "failed";

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
