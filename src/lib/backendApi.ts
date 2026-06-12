import type { BatchRun, CommandRun, DailyReport, RuntimeSnapshot } from "../types/database";
import type { Agent, Task, WorkLog } from "../types/database";

const configuredBackendUrlFromEnv = ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "").trim();
const isBrowser = typeof window !== "undefined";
const isRemoteHttps = isBrowser && window.location.protocol === "https:";
const configuredBackendIsLocalhost = /^(http:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?/i.test(configuredBackendUrlFromEnv);
const backendUrl = isRemoteHttps && configuredBackendIsLocalhost ? "" : configuredBackendUrlFromEnv;

export const configuredBackendUrl = backendUrl || (isBrowser ? window.location.origin : "");

type ApiEnvelope<T> = {
  data: T;
};

export type DashboardData = {
  agents: Agent[];
  tasks: Task[];
  logs: WorkLog[];
  decisions: WorkLog[];
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
    inbox: LocalRuntimeQueueFile | null;
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
  type: "queue" | "builder" | "reviewer" | "command" | "decision" | "warning" | "batch";
  title: string;
  description: string;
  status: "info" | "success" | "warning" | "error";
  source: "mcp" | "supabase" | "backend";
  created_at: string;
};

export type LatestBatchStatus = {
  nightly_review: BatchRun | null;
  daily_report: BatchRun | null;
  discord_webhook_configured: boolean;
  archiveos_public_url_configured: boolean;
  holiday_years: number[];
};

export type HistorianStatus = {
  configured: boolean;
  enabled: boolean;
  lastExport: {
    type: string;
    status: "success" | "skipped" | "failed";
    notePath: string | null;
    createdAt: string;
    reason: string | null;
  } | null;
};

export async function getBackendHealth() {
  return request<HealthResponse>("/health");
}

export async function getDashboardData() {
  const response = await request<ApiEnvelope<DashboardData>>("/api/dashboard");
  return response.data;
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

export async function getRecentBatchRuns() {
  const response = await request<ApiEnvelope<BatchRun[]>>("/api/batches/recent");
  return response.data;
}

export async function getLatestBatchStatus() {
  const response = await request<ApiEnvelope<LatestBatchStatus>>("/api/batches/latest");
  return response.data;
}

export async function getLatestDailyReport() {
  const response = await request<ApiEnvelope<DailyReport | null>>("/api/reports/daily/latest");
  return response.data;
}

export async function getRecentDailyReports() {
  const response = await request<ApiEnvelope<DailyReport[]>>("/api/reports/daily/recent");
  return response.data;
}

export async function getRecentRuntimeSnapshots() {
  const response = await request<ApiEnvelope<RuntimeSnapshot[]>>("/api/runtime/snapshots/recent");
  return response.data;
}

export async function getHistorianStatus() {
  const response = await request<ApiEnvelope<HistorianStatus>>("/api/historian/status");
  return response.data;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${backendUrl}${path}`, init);
  } catch {
    throw new Error(
      `Backend is unreachable at ${backendUrl}. Start the ArchiveOS backend and refresh the dashboard.`,
    );
  }

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
