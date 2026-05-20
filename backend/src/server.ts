import "dotenv/config";
import cors from "cors";
import express from "express";
import { supabaseAdmin } from "./lib/supabaseAdmin.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const logTypes = new Set(["summary", "decision", "error", "review"]);
const commandStatuses = new Set(["pending", "running", "succeeded", "failed"]);

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
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    response.status(500).json({ error: "Failed to fetch recent work logs." });
    return;
  }

  response.json({ data });
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

type ValidationResult =
  | { ok: true; value: WorkLogBody }
  | { ok: false; error: string };

type CommandValidationResult =
  | { ok: true; value: CommandBody }
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
          ? "Mock command recorded as succeeded. Real execution is not enabled yet."
          : "Command recorded as pending. Real execution is not enabled yet."),
    },
  };
}
