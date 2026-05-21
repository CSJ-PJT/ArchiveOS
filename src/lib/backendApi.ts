import type { CommandRun } from "../types/database";

const backendUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "http://localhost:4000";

type ApiEnvelope<T> = {
  data: T;
};

type HealthResponse = {
  status: "ok";
  service: "archiveos-backend";
};

export type LocalAction =
  | "git_status"
  | "git_branch"
  | "git_log_recent"
  | "frontend_build"
  | "backend_typecheck"
  | "backend_build";

export type LocalActionProject = {
  id: string;
  name: string;
  path: string;
  repo: string;
};

export type LocalActionResult = {
  action: LocalAction;
  status: "succeeded" | "failed";
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type LocalRuntimeProcess = {
  pid: number;
  name: string;
  parentProcessId: number | null;
  commandLine: string;
  cpu: number | null;
  startTime: string | null;
};

export type LocalRuntimeQueueFile = {
  name: string;
  updated_at: string;
};

export type LocalRuntimeStatus = {
  checked_at: string;
  status: "working" | "idle" | "unknown";
  queue: {
    path: string | null;
    inbox: number;
    processing: number;
    outbox: number;
    reviews: number;
  };
  active_task: string | null;
  processes: {
    implementer: LocalRuntimeProcess | null;
    reviewer: LocalRuntimeProcess | null;
    loop: LocalRuntimeProcess | null;
    reviewer_bridge: LocalRuntimeProcess | null;
  };
  latest: {
    processing: LocalRuntimeQueueFile | null;
    outbox: LocalRuntimeQueueFile | null;
    review: LocalRuntimeQueueFile | null;
  };
  latest_details: {
    builder: {
      task_id: string | null;
      status: string | null;
      exit_code: number | null;
      finished_at: string | null;
      summary: string | null;
      image_ref: string | null;
    } | null;
    reviewer: {
      reviewed_task_id: string | null;
      verdict: string | null;
      reviewed_at: string | null;
      summary: string | null;
      next_task_id: string | null;
      image_ref: string | null;
    } | null;
  };
  judgement: string;
};

export type RuntimeEvent = {
  id: string;
  type: "queue" | "builder" | "reviewer" | "command" | "decision" | "warning";
  title: string;
  description: string;
  status: "info" | "success" | "warning" | "error";
  source: "mcp" | "supabase" | "backend";
  created_at: string;
};

export async function getBackendHealth() {
  return request<HealthResponse>("/health");
}

export async function getRecentCommands() {
  const response = await request<ApiEnvelope<CommandRun[]>>("/api/commands/recent");
  return response.data;
}

export async function createCommandRun(input: {
  command: string;
  command_type?: string | null;
  status?: "pending" | "succeeded";
  result?: string | null;
}) {
  const response = await request<ApiEnvelope<CommandRun>>("/api/commands", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return response.data;
}

export async function getLocalActionProjects() {
  const response = await request<ApiEnvelope<LocalActionProject[]>>("/api/local-actions/projects");
  return response.data;
}

export async function runLocalAction(input: { project_id: string; action: LocalAction }) {
  return request<LocalActionResult>("/api/local-actions/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function getLocalRuntimeStatus() {
  const response = await request<ApiEnvelope<LocalRuntimeStatus>>("/api/local-runtime/status");
  return response.data;
}

export async function getRecentRuntimeEvents() {
  const response = await request<ApiEnvelope<RuntimeEvent[]>>("/api/runtime/events/recent");
  return response.data;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, init);

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as T;
}

async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Backend request failed with status ${response.status}.`;
  } catch {
    return `Backend request failed with status ${response.status}.`;
  }
}
