import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";
import cors from "cors";
import express from "express";
import { findProject, projects } from "./config/projects.js";
import { getLocalRuntimeStatus } from "./lib/localRuntime.js";
import { supabaseAdmin } from "./lib/supabaseAdmin.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const logTypes = new Set(["summary", "decision", "error", "review"]);
const commandStatuses = new Set(["pending", "running", "succeeded", "failed"]);
const localActionTypes = new Set([
  "git_status",
  "git_branch",
  "git_log_recent",
  "frontend_build",
  "backend_typecheck",
  "backend_build",
]);
const seedWorkLogIds = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
  "10000000-0000-4000-8000-000000000004",
];
const seedCommandRunIds = [
  "20000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS."));
    },
  }),
);
app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "archiveos-backend",
  });
});

app.get("/api/work-logs/recent", async (_request, response) => {
  const { data, error } = await supabaseAdmin
    .from("work_logs")
    .select("*, task:tasks(title), agent:agents(name)")
    .not("id", "in", `(${seedWorkLogIds.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    response.status(500).json({ error: "Failed to fetch recent work logs." });
    return;
  }

  response.json({ data });
});

app.get("/api/dashboard", async (_request, response) => {
  const [agentsResult, tasksResult, logsResult, decisionsResult] = await Promise.all([
    supabaseAdmin.from("agents").select("*").order("name", { ascending: true }),
    supabaseAdmin
      .from("tasks")
      .select("*, agent:agents(name,status)")
      .order("updated_at", { ascending: false }),
    supabaseAdmin
      .from("work_logs")
      .select("*, task:tasks(title,status), agent:agents(name,role)")
      .order("created_at", { ascending: false })
      .limit(8),
    supabaseAdmin
      .from("work_logs")
      .select("*, task:tasks(title,status), agent:agents(name,role)")
      .eq("log_type", "decision")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const firstError =
    agentsResult.error ?? tasksResult.error ?? logsResult.error ?? decisionsResult.error;

  if (firstError) {
    response.status(500).json({ error: "Failed to fetch dashboard data." });
    return;
  }

  response.json({
    data: {
      agents: agentsResult.data ?? [],
      tasks: tasksResult.data ?? [],
      logs: logsResult.data ?? [],
      decisions: decisionsResult.data ?? [],
    },
  });
});

app.post("/api/work-logs", async (request, response) => {
  const validation = validateWorkLogBody(request.body);

  if (!validation.ok) {
    response.status(400).json({ error: validation.error });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("work_logs")
    .insert(validation.value)
    .select()
    .single();

  if (error) {
    response.status(500).json({ error: "Failed to create work log." });
    return;
  }

  response.status(201).json({ data });
});

app.get("/api/commands/recent", async (_request, response) => {
  const { data, error } = await supabaseAdmin
    .from("command_runs")
    .select("*")
    .not("id", "in", `(${seedCommandRunIds.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    response.status(500).json({ error: "Failed to fetch recent commands." });
    return;
  }

  response.json({ data });
});

app.post("/api/commands", async (request, response) => {
  const validation = validateCommandBody(request.body);

  if (!validation.ok) {
    response.status(400).json({ error: validation.error });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("command_runs")
    .insert(validation.value)
    .select()
    .single();

  if (error) {
    response.status(500).json({ error: "Failed to record command." });
    return;
  }

  response.status(201).json({ data });
});

app.get("/api/local-actions/projects", (_request, response) => {
  response.json({
    data: projects.map((project) => ({
      id: project.id,
      name: project.name,
      path: project.path,
      repo: project.repo,
    })),
  });
});

app.post("/api/local-actions/run", async (request, response) => {
  const validation = validateLocalActionBody(request.body);

  if (!validation.ok) {
    response.status(400).json({ error: validation.error });
    return;
  }

  const project = findProject(validation.value.project_id);

  if (!project) {
    response.status(400).json({ error: "Unknown project_id." });
    return;
  }

  const result = await runLocalAction(project.path, validation.value.action);
  const commandStatus = result.status;
  const commandResult = summarizeCommandOutput(result.stdout, result.stderr);

  const { error } = await supabaseAdmin.from("command_runs").insert({
    command: result.action,
    command_type: "local_action",
    status: commandStatus,
    result: commandResult,
  });

  if (error) {
    response.status(500).json({ error: "Local action ran but failed to record command result." });
    return;
  }

  response.json(result);
});

app.get("/api/local-runtime/status", async (_request, response) => {
  try {
    const status = await getLocalRuntimeStatus();
    response.json({ data: status });
  } catch {
    response.status(500).json({ error: "Failed to read local runtime status." });
  }
});

app.get("/api/runtime/events/recent", async (_request, response) => {
  try {
    const events = await getRecentRuntimeEvents();
    response.json({ data: events });
  } catch {
    response.status(500).json({ error: "Failed to fetch runtime events." });
  }
});

app.use(
  (
    error: Error,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error.message === "Origin not allowed by CORS.") {
      response.status(400).json({ error: "Origin not allowed by CORS." });
      return;
    }

    if ((error as { status?: number }).status === 400) {
      response.status(400).json({ error: "Invalid JSON request body." });
      return;
    }

    response.status(500).json({ error: "Internal server error." });
  },
);

app.listen(port, () => {
  console.log(`archiveos-backend listening on port ${port}`);
});

type WorkLogBody = {
  task_id: string | null;
  agent_id: string | null;
  log_type: "summary" | "decision" | "error" | "review";
  content: string;
};

type CommandBody = {
  command: string;
  command_type: string | null;
  status: "pending" | "running" | "succeeded" | "failed";
  result: string | null;
};

type LocalAction = "git_status" | "git_branch" | "git_log_recent" | "frontend_build" | "backend_typecheck" | "backend_build";

type LocalActionBody = {
  project_id: string;
  action: LocalAction;
};

type LocalActionResult = {
  action: LocalAction;
  status: "succeeded" | "failed";
  stdout: string;
  stderr: string;
  exitCode: number;
};

type RuntimeEvent = {
  id: string;
  type: "queue" | "builder" | "reviewer" | "command" | "decision" | "warning";
  title: string;
  description: string;
  status: "info" | "success" | "warning" | "error";
  source: "mcp" | "supabase" | "backend";
  created_at: string;
};

type ValidationResult =
  | { ok: true; value: WorkLogBody }
  | { ok: false; error: string };

type CommandValidationResult =
  | { ok: true; value: CommandBody }
  | { ok: false; error: string };

type LocalActionValidationResult =
  | { ok: true; value: LocalActionBody }
  | { ok: false; error: string };

function validateWorkLogBody(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const candidate = body as Record<string, unknown>;

  if (candidate.task_id !== null && candidate.task_id !== undefined && typeof candidate.task_id !== "string") {
    return { ok: false, error: "task_id must be a string or null." };
  }

  if (candidate.agent_id !== null && candidate.agent_id !== undefined && typeof candidate.agent_id !== "string") {
    return { ok: false, error: "agent_id must be a string or null." };
  }

  if (typeof candidate.log_type !== "string" || !logTypes.has(candidate.log_type)) {
    return { ok: false, error: "log_type must be one of summary, decision, error, review." };
  }

  if (typeof candidate.content !== "string" || candidate.content.trim().length === 0) {
    return { ok: false, error: "content must not be empty." };
  }

  return {
    ok: true,
    value: {
      task_id: candidate.task_id ?? null,
      agent_id: candidate.agent_id ?? null,
      log_type: candidate.log_type as WorkLogBody["log_type"],
      content: candidate.content.trim(),
    },
  };
}

async function getRecentRuntimeEvents(): Promise<RuntimeEvent[]> {
  const checkedAt = new Date().toISOString();
  const [runtime, commandsResult, decisionsResult] = await Promise.all([
    getLocalRuntimeStatus(),
    supabaseAdmin
      .from("command_runs")
      .select("id, command, command_type, status, result, created_at")
      .not("id", "in", `(${seedCommandRunIds.join(",")})`)
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("work_logs")
      .select("id, log_type, content, created_at, task:tasks(title), agent:agents(name)")
      .eq("log_type", "decision")
      .not("id", "in", `(${seedWorkLogIds.join(",")})`)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const events: RuntimeEvent[] = [];

  events.push({
    id: `queue-${runtime.checked_at}`,
    type: "queue",
    title: runtime.status === "working" ? "Queue is processing" : "Queue snapshot updated",
    description: `Inbox ${runtime.queue.inbox}, processing ${runtime.queue.processing}, outbox ${runtime.queue.outbox}, reviews ${runtime.queue.reviews}.`,
    status: runtime.status === "unknown" ? "warning" : "info",
    source: "mcp",
    created_at: runtime.checked_at,
  });

  if (runtime.latest.processing) {
    events.push({
      id: `processing-${runtime.latest.processing.name}`,
      type: "queue",
      title: "Processing task active",
      description: runtime.active_task ?? runtime.latest.processing.name,
      status: runtime.processes.implementer ? "info" : "warning",
      source: "mcp",
      created_at: runtime.latest.processing.updated_at,
    });
  }

  if (runtime.latest_details.builder) {
    const builder = runtime.latest_details.builder;
    events.push({
      id: `builder-${builder.task_id ?? runtime.latest.outbox?.name ?? builder.finished_at ?? checkedAt}`,
      type: "builder",
      title: builder.status === "done" ? "Builder result completed" : "Builder result recorded",
      description: summarizeEventDescription(builder.summary ?? runtime.latest.outbox?.name ?? "No builder summary captured."),
      status: builder.status === "done" ? "success" : builder.status === "failed" ? "error" : "info",
      source: "mcp",
      created_at: builder.finished_at ?? runtime.latest.outbox?.updated_at ?? checkedAt,
    });
  }

  if (runtime.latest_details.reviewer) {
    const reviewer = runtime.latest_details.reviewer;
    events.push({
      id: `reviewer-${reviewer.reviewed_task_id ?? runtime.latest.review?.name ?? reviewer.reviewed_at ?? checkedAt}`,
      type: "reviewer",
      title: reviewer.verdict === "stop" ? "Reviewer stopped pipeline" : "Reviewer decision recorded",
      description: summarizeEventDescription(
        reviewer.next_task_id
          ? `${reviewer.summary ?? "Reviewer queued next task."} Next: ${reviewer.next_task_id}`
          : reviewer.summary ?? runtime.latest.review?.name ?? "No reviewer summary captured.",
      ),
      status: reviewer.verdict === "stop" ? "warning" : reviewer.verdict === "request_changes" ? "error" : "success",
      source: "mcp",
      created_at: reviewer.reviewed_at ?? runtime.latest.review?.updated_at ?? checkedAt,
    });
  }

  if (runtime.judgement) {
    events.push({
      id: `judgement-${runtime.checked_at}`,
      type: runtime.status === "working" ? "queue" : "warning",
      title: runtime.status === "working" ? "Runtime judgement: work in progress" : "Runtime judgement",
      description: runtime.judgement,
      status: runtime.status === "working" ? "info" : runtime.queue.processing > 0 ? "warning" : "info",
      source: "backend",
      created_at: runtime.checked_at,
    });
  }

  for (const command of commandsResult.data ?? []) {
    events.push({
      id: `command-${command.id}`,
      type: "command",
      title: `Command recorded: ${command.command}`,
      description: summarizeEventDescription(command.result ?? command.command_type ?? "Command intent recorded."),
      status: command.status === "failed" ? "error" : command.status === "succeeded" ? "success" : "info",
      source: "supabase",
      created_at: command.created_at,
    });
  }

  for (const decision of decisionsResult.data ?? []) {
    events.push({
      id: `decision-${decision.id}`,
      type: "decision",
      title: "Decision recorded",
      description: summarizeEventDescription(decision.content),
      status: "info",
      source: "supabase",
      created_at: decision.created_at,
    });
  }

  return events
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 20);
}

function summarizeEventDescription(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > 180 ? `${clean.slice(0, 180)}...` : clean;
}

function validateCommandBody(body: unknown): CommandValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const candidate = body as Record<string, unknown>;

  if (typeof candidate.command !== "string" || candidate.command.trim().length === 0) {
    return { ok: false, error: "command must not be empty." };
  }

  if (
    candidate.command_type !== null &&
    candidate.command_type !== undefined &&
    typeof candidate.command_type !== "string"
  ) {
    return { ok: false, error: "command_type must be a string or null." };
  }

  if (
    candidate.status !== undefined &&
    (typeof candidate.status !== "string" || !commandStatuses.has(candidate.status))
  ) {
    return { ok: false, error: "status must be one of pending, running, succeeded, failed." };
  }

  if (candidate.result !== null && candidate.result !== undefined && typeof candidate.result !== "string") {
    return { ok: false, error: "result must be a string or null." };
  }

  const requestedStatus = typeof candidate.status === "string" ? candidate.status : "pending";
  const status = requestedStatus === "succeeded" ? "succeeded" : "pending";

  return {
    ok: true,
    value: {
      command: candidate.command.trim(),
      command_type: candidate.command_type ?? null,
      status,
      result:
        candidate.result ??
        (status === "succeeded"
          ? "Command intent recorded as succeeded. Real execution is not enabled yet."
          : "Command recorded as pending. Real execution is not enabled yet."),
    },
  };
}

function validateLocalActionBody(body: unknown): LocalActionValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const candidate = body as Record<string, unknown>;

  if (typeof candidate.project_id !== "string" || candidate.project_id.trim().length === 0) {
    return { ok: false, error: "project_id is required." };
  }

  if (typeof candidate.action !== "string" || !localActionTypes.has(candidate.action)) {
    return {
      ok: false,
      error: "action must be one of git_status, git_branch, git_log_recent, frontend_build, backend_typecheck, backend_build.",
    };
  }

  return {
    ok: true,
    value: {
      project_id: candidate.project_id,
      action: candidate.action as LocalAction,
    },
  };
}

function runLocalAction(projectPath: string, action: LocalAction): Promise<LocalActionResult> {
  const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
  const backendPath = path.join(projectPath, "backend");
  const definitions: Record<LocalAction, { command: string; args: string[]; cwd: string }> = {
    git_status: { command: "git", args: ["status", "--short"], cwd: projectPath },
    git_branch: { command: "git", args: ["branch", "--show-current"], cwd: projectPath },
    git_log_recent: { command: "git", args: ["log", "--oneline", "-5"], cwd: projectPath },
    frontend_build: { command: npmExecutable, args: ["run", "build"], cwd: projectPath },
    backend_typecheck: { command: npmExecutable, args: ["run", "typecheck"], cwd: backendPath },
    backend_build: { command: npmExecutable, args: ["run", "build"], cwd: backendPath },
  };

  const definition = definitions[action];

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const child = spawn(definition.command, definition.args, {
      cwd: definition.cwd,
      shell: false,
      windowsHide: true,
    });

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      child.kill("SIGTERM");
      resolve({
        action,
        status: "failed",
        stdout: truncateOutput(stdout),
        stderr: truncateOutput(`${stderr}\nCommand timed out after 60000ms.`.trim()),
        exitCode: -1,
      });
    }, 60000);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve({
        action,
        status: "failed",
        stdout: truncateOutput(stdout),
        stderr: truncateOutput(`${stderr}\n${error.message}`.trim()),
        exitCode: -1,
      });
    });

    child.on("close", (exitCode) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve({
        action,
        status: exitCode === 0 ? "succeeded" : "failed",
        stdout: truncateOutput(stdout),
        stderr: truncateOutput(stderr),
        exitCode: exitCode ?? -1,
      });
    });
  });
}

function summarizeCommandOutput(stdout: string, stderr: string) {
  return truncateOutput([stdout.trim(), stderr.trim()].filter(Boolean).join("\n\n"));
}

function truncateOutput(value: string) {
  const maxLength = 12000;

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n[output truncated]`;
}
