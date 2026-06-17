import { sendDiscordMessage } from "../batches/discord.js";
import { runArchitectReview } from "../architect/index.js";
import {
  createKnowledgeEdge,
  upsertKnowledgeNode,
  type KnowledgeNode,
} from "../historian/index.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import type { ArchitectureReviewRow } from "../architect/types.js";
import type {
  PmDecisionAction,
  PmTaskDecisionRow,
  PmTaskEventRow,
  PmTaskPriority,
  PmTaskRow,
  PmTaskStatus,
  QueueSummary,
} from "./types.js";

const activeStatuses: PmTaskStatus[] = ["architect_review", "ready_for_build", "building", "review"];
const terminalStatuses: PmTaskStatus[] = ["approved", "rejected", "hold", "failed", "done"];
const priorityWeight: Record<PmTaskPriority, number> = { high: 0, medium: 1, low: 2 };

export async function listPmTasks() {
  const { data, error } = await supabaseAdmin
    .from("pm_tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch PM tasks: ${error.message}`);
  return (data ?? []) as PmTaskRow[];
}

export async function getPmTask(id: string) {
  const { data, error } = await supabaseAdmin
    .from("pm_tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch PM task: ${error.message}`);
  return data as PmTaskRow | null;
}

export async function createPmTask(input: {
  title: string;
  description: string;
  priority?: PmTaskPriority;
  target_project?: string;
  scope_files?: string[] | null;
  max_iterations?: number;
  cost_budget?: number | null;
}) {
  const payload = {
    title: input.title.trim(),
    description: input.description.trim(),
    priority: input.priority ?? "medium",
    target_project: input.target_project?.trim() || "DeepStake3D",
    scope_files: input.scope_files ?? null,
    max_iterations: clampMaxIterations(input.max_iterations),
    current_iteration: 0,
    cost_budget: input.cost_budget ?? null,
    status: "queued" satisfies PmTaskStatus,
    metadata: { source: "pm_queue" },
  };

  const { data, error } = await supabaseAdmin
    .from("pm_tasks")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create PM task: ${error.message}`);
  const task = data as PmTaskRow;
  await recordTaskEvent(task.id, "task_created", "Task queued", `${task.title} was added to the PM work queue.`, "queue", {
    priority: task.priority,
    target_project: task.target_project,
  });
  await linkTaskKnowledge(task).catch(() => undefined);
  await notifyTask("task created", task).catch(() => undefined);
  return task;
}

export async function updatePmTask(id: string, input: Partial<Pick<PmTaskRow, "title" | "description" | "priority" | "status" | "target_project" | "scope_files" | "max_iterations" | "cost_budget">>) {
  const payload: Record<string, unknown> = {};
  if (input.title !== undefined) payload.title = input.title.trim();
  if (input.description !== undefined) payload.description = input.description.trim();
  if (input.priority !== undefined) payload.priority = input.priority;
  if (input.status !== undefined) payload.status = input.status;
  if (input.target_project !== undefined) payload.target_project = input.target_project.trim();
  if (input.scope_files !== undefined) payload.scope_files = input.scope_files;
  if (input.max_iterations !== undefined) payload.max_iterations = clampMaxIterations(input.max_iterations);
  if (input.cost_budget !== undefined) payload.cost_budget = input.cost_budget;

  const { data, error } = await supabaseAdmin
    .from("pm_tasks")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update PM task: ${error.message}`);
  return data as PmTaskRow;
}

export async function getQueueSummary(): Promise<QueueSummary> {
  const tasks = await listPmTasks();
  const today = new Date().toISOString().slice(0, 10);
  const current =
    tasks
      .filter((task) => ["architect_review", "ready_for_build", "building", "review", "queued"].includes(task.status))
      .sort(compareTaskPriority)[0] ?? null;

  return {
    queued: tasks.filter((task) => task.status === "queued").length,
    in_progress: tasks.filter((task) => activeStatuses.includes(task.status)).length,
    pm_decision_required: tasks.filter((task) => task.status === "pm_decision_required").length,
    done_today: tasks.filter((task) => ["done", "approved"].includes(task.status) && task.completed_at?.startsWith(today)).length,
    failed_today: tasks.filter((task) => task.status === "failed" && task.completed_at?.startsWith(today)).length,
    current_task: current
      ? {
          id: current.id,
          title: current.title,
          priority: current.priority,
          status: current.status,
          current_iteration: current.current_iteration,
          max_iterations: current.max_iterations,
        }
      : null,
    recommended_pm_action: buildRecommendedPmAction(tasks),
    updated_at: new Date().toISOString(),
  };
}

export async function runQueueOnce() {
  const task = await selectNextRunnableTask();
  if (!task) {
    const summary = await getQueueSummary();
    await recordQueueCompletedIfEmpty(summary);
    return { status: "idle", message: "No runnable queued task.", summary };
  }

  if (task.current_iteration >= task.max_iterations) {
    const updated = await updateTaskState(task.id, "hold", {
      completed_at: null,
      metadata: { ...task.metadata, hold_reason: "max_iterations exceeded" },
    });
    await recordTaskEvent(task.id, "task_held", "Task held", "Task exceeded max_iterations and requires PM review.", "queue", {
      current_iteration: task.current_iteration,
      max_iterations: task.max_iterations,
    });
    await notifyTask("task held", updated, "Max iterations exceeded.").catch(() => undefined);
    return { status: "hold", task: updated };
  }

  await updateTaskState(task.id, "architect_review");
  await recordTaskEvent(task.id, "architect_review_started", "Architect review started", task.title, "architect");
  const architectReview = await runArchitectReview({
    targetType: "task",
    targetRef: task.id,
    title: task.title,
    description: task.description,
    metadata: {
      priority: task.priority,
      target_project: task.target_project,
      scope_files: task.scope_files,
      source: "pm_queue",
    },
  });

  await recordTaskEvent(task.id, "architect_review_completed", "Architect review completed", architectReview.summary, "architect", {
    architecture_review_id: architectReview.id,
    status: architectReview.status,
  });

  if (architectReview.status === "blocked") {
    const blocked = await updateTaskState(task.id, "hold", {
      latest_architect_review_id: architectReview.id,
      metadata: { ...task.metadata, architect_status: architectReview.status },
    });
    await linkTaskFlowKnowledge(blocked, architectReview).catch(() => undefined);
    await notifyTask("task held", blocked, "Architect blocked the task.").catch(() => undefined);
    return { status: "hold", task: blocked, architectReview };
  }

  const iteration = task.current_iteration + 1;
  const builderResult = await recordBuilderInstruction(task, iteration, architectReview);
  await updateTaskState(task.id, "building", {
    latest_architect_review_id: architectReview.id,
    latest_builder_result_id: builderResult.id,
    current_iteration: iteration,
  });
  await recordTaskEvent(task.id, "builder_result_recorded", "Builder instruction recorded", "Builder instruction was generated; no Codex/MCP/shell execution was performed.", "builder", {
    command_run_id: builderResult.id,
  });

  const reviewerResult = await recordReviewerVerdict(task, builderResult.id, iteration);
  const next = await updateTaskState(task.id, "pm_decision_required", {
    latest_architect_review_id: architectReview.id,
    latest_builder_result_id: builderResult.id,
    latest_reviewer_result_id: reviewerResult.id,
    current_iteration: iteration,
  });
  await recordTaskEvent(task.id, "pm_decision_required", "PM decision required", "Review is recorded. PM must approve, reject, hold, or request retry.", "reviewer", {
    command_run_id: reviewerResult.id,
  });
  await linkTaskFlowKnowledge(next, architectReview, builderResult.id, reviewerResult.id).catch(() => undefined);
  await notifyTask("pm decision required", next, "Reviewer recommendation recorded.").catch(() => undefined);

  return {
    status: "pm_decision_required",
    task: next,
    architectReview,
    builderResult,
    reviewerResult,
  };
}

export async function decidePmTask(id: string, input: { action: PmDecisionAction; reason?: string | null }) {
  const task = await getRequiredTask(id);
  if (input.action === "reject" && !input.reason?.trim()) {
    throw new Error("Reject reason is required.");
  }

  if (input.action === "retry") {
    return retryPmTask(id, input.reason);
  }

  const { data: decision, error } = await supabaseAdmin
    .from("pm_task_decisions")
    .insert({
      task_id: id,
      action: input.action,
      reason: input.reason?.trim() || null,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to record PM decision: ${error.message}`);

  const nextStatus = getStatusForDecision(input.action);
  const completedAt = nextStatus === "approved" || nextStatus === "rejected" || nextStatus === "hold" ? new Date().toISOString() : null;
  const updated = await updateTaskState(id, nextStatus, {
    latest_pm_decision_id: (decision as PmTaskDecisionRow).id,
    completed_at: completedAt,
  });

  await recordTaskEvent(id, `pm_decision_${input.action}`, `PM decision: ${input.action}`, input.reason ?? null, "pm", {
    decision_id: (decision as PmTaskDecisionRow).id,
  });
  await linkDecisionKnowledge(updated, decision as PmTaskDecisionRow).catch(() => undefined);
  await notifyTask(`task ${nextStatus}`, updated, input.reason ?? undefined).catch(() => undefined);

  return { task: updated, decision: decision as PmTaskDecisionRow };
}

export async function retryPmTask(id: string, reason?: string | null) {
  const task = await getRequiredTask(id);
  if (terminalStatuses.includes(task.status) && task.status !== "hold") {
    throw new Error("Terminal tasks cannot be retried automatically.");
  }

  if (task.current_iteration >= task.max_iterations) {
    throw new Error("Task already reached max_iterations.");
  }

  const { data: decision, error } = await supabaseAdmin
    .from("pm_task_decisions")
    .insert({
      task_id: id,
      action: "retry",
      reason: reason?.trim() || null,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to record retry decision: ${error.message}`);

  const updated = await updateTaskState(id, "queued", {
    latest_pm_decision_id: (decision as PmTaskDecisionRow).id,
    completed_at: null,
  });
  await recordTaskEvent(id, "pm_decision_retry", "PM requested retry", reason ?? "Retry requested.", "pm", {
    decision_id: (decision as PmTaskDecisionRow).id,
  });
  await notifyTask("task retry requested", updated, reason ?? undefined).catch(() => undefined);
  return { task: updated, decision: decision as PmTaskDecisionRow };
}

export async function getTaskEvents(limit = 50) {
  const { data, error } = await supabaseAdmin
    .from("pm_task_events")
    .select("*, task:pm_tasks(title, priority, status)")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (error) throw new Error(`Failed to fetch PM task events: ${error.message}`);
  return (data ?? []) as Array<PmTaskEventRow & { task?: Pick<PmTaskRow, "title" | "priority" | "status"> }>;
}

export async function runNightlyQueueSummary() {
  const summary = await getQueueSummary();
  const message = [
    "[ArchiveOS Queue Nightly Summary]",
    `Queued: ${summary.queued}`,
    `In progress: ${summary.in_progress}`,
    `PM decision required: ${summary.pm_decision_required}`,
    `Done today: ${summary.done_today}`,
    `Failed today: ${summary.failed_today}`,
    `Recommended PM action: ${summary.recommended_pm_action}`,
  ].join("\n");
  const discord = await sendDiscordMessage(message);
  await recordTaskEvent("00000000-0000-0000-0000-000000000000", "nightly_queue_summary", "Nightly queue summary", message, "discord", {
    discord,
    summary,
  }).catch(() => undefined);
  return { summary, discord };
}

async function selectNextRunnableTask() {
  const { data, error } = await supabaseAdmin
    .from("pm_tasks")
    .select("*")
    .in("status", ["queued", "ready_for_build"])
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to select queued task: ${error.message}`);
  return ((data ?? []) as PmTaskRow[]).sort(compareTaskPriority)[0] ?? null;
}

async function getRequiredTask(id: string) {
  const task = await getPmTask(id);
  if (!task) throw new Error("Task not found.");
  return task;
}

async function updateTaskState(id: string, status: PmTaskStatus, extra: Record<string, unknown> = {}) {
  const payload = {
    status,
    ...extra,
  };
  const { data, error } = await supabaseAdmin
    .from("pm_tasks")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update task state: ${error.message}`);
  return data as PmTaskRow;
}

async function recordBuilderInstruction(task: PmTaskRow, iteration: number, architectReview: ArchitectureReviewRow) {
  const instruction = [
    `Target project: ${task.target_project}`,
    `Task: ${task.title}`,
    "",
    task.description,
    "",
    "Safe orchestration note: ArchiveOS recorded this builder instruction only. It did not execute Codex, MCP, shell, deployment, process control, or git push.",
  ].join("\n");

  const { data, error } = await supabaseAdmin
    .from("command_runs")
    .insert({
      command: `builder_instruction:${task.id}`,
      command_type: "pm_queue_builder_instruction",
      status: "succeeded",
      result: JSON.stringify({
        task_id: task.id,
        iteration,
        architect_review_id: architectReview.id,
        instruction,
        suggested_verification: [
          "git status",
          "git diff",
          "npm run build",
          "npm run typecheck",
          "cd backend && npm run build",
          "cd backend && npm run typecheck",
        ],
      }),
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to record builder instruction: ${error.message}`);
  return data as { id: string; result: string | null };
}

async function recordReviewerVerdict(task: PmTaskRow, builderResultId: string, iteration: number) {
  const verdict = {
    task_id: task.id,
    iteration,
    builder_result_id: builderResultId,
    verdict: "approve_for_pm_decision",
    summary: "Reviewer instruction skeleton recorded. PM decision is required before marking the task done.",
    safety: "No Codex/MCP/shell execution was performed.",
  };

  const { data, error } = await supabaseAdmin
    .from("command_runs")
    .insert({
      command: `reviewer_verdict:${task.id}`,
      command_type: "pm_queue_reviewer_verdict",
      status: "succeeded",
      result: JSON.stringify(verdict),
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to record reviewer verdict: ${error.message}`);
  return data as { id: string; result: string | null };
}

async function recordTaskEvent(
  taskId: string,
  eventType: string,
  title: string,
  description: string | null,
  source: PmTaskEventRow["source"],
  metadata: Record<string, unknown> = {},
) {
  if (taskId === "00000000-0000-0000-0000-000000000000") {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("pm_task_events")
    .insert({
      task_id: taskId,
      event_type: eventType,
      title,
      description,
      source,
      metadata,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to record task event: ${error.message}`);
  return data as PmTaskEventRow;
}

async function notifyTask(trigger: string, task: PmTaskRow, reason?: string) {
  const summary = await getQueueSummary().catch(() => null);
  const message = [
    `[ArchiveOS Task ${titleCase(trigger)}]`,
    `Task: ${task.title}`,
    `Status: ${task.status}`,
    `Priority: ${task.priority}`,
    `Iterations: ${task.current_iteration}/${task.max_iterations}`,
    `Target: ${task.target_project}`,
    reason ? `Reason: ${reason}` : null,
    `Updated: ${formatKst(new Date())}`,
    summary
      ? [
          "",
          "Queue Summary:",
          `queued: ${summary.queued}`,
          `in_progress: ${summary.in_progress}`,
          `pm_decision_required: ${summary.pm_decision_required}`,
          `done_today: ${summary.done_today}`,
          `failed_today: ${summary.failed_today}`,
        ].join("\n")
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const discord = await sendDiscordMessage(message);
  if (!discord.ok) {
    console.warn(`[pm-queue] Discord notification skipped/failed: ${discord.reason}`);
  }
  return discord;
}

async function recordQueueCompletedIfEmpty(summary: QueueSummary) {
  if (summary.queued || summary.in_progress || summary.pm_decision_required) return;
  await sendDiscordMessage(
    [
      "[ArchiveOS Queue Completed]",
      "All PM queue tasks are currently complete or waiting outside the runnable queue.",
      `Done today: ${summary.done_today}`,
      `Failed today: ${summary.failed_today}`,
      `Updated: ${formatKst(new Date())}`,
    ].join("\n"),
  ).catch(() => undefined);
}

async function linkTaskKnowledge(task: PmTaskRow) {
  return upsertKnowledgeNode({
    node_type: "task",
    title: task.title,
    summary: task.description,
    source: "archiveos",
    external_ref: `pm_task:${task.id}`,
    metadata: {
      priority: task.priority,
      status: task.status,
      target_project: task.target_project,
    },
  });
}

async function linkTaskFlowKnowledge(task: PmTaskRow, architectReview: ArchitectureReviewRow, builderResultId?: string, reviewerResultId?: string) {
  const taskNode = await linkTaskKnowledge(task);
  const architectNode = await upsertKnowledgeNode({
    node_type: "architecture_review",
    title: `Architect Review - ${task.title}`,
    summary: architectReview.summary,
    source: "archiveos",
    external_ref: `architecture_review:${architectReview.id}`,
    metadata: { task_id: task.id, status: architectReview.status },
  });
  await createKnowledgeEdge({
    from_node_id: architectNode.id,
    to_node_id: taskNode.id,
    edge_type: "reviewed_architecture_of",
    metadata: { reason: "pm_queue_architect_review" },
  });

  let builderNode: KnowledgeNode | null = null;
  if (builderResultId) {
    builderNode = await upsertKnowledgeNode({
      node_type: "builder_result",
      title: `Builder Instruction - ${task.title}`,
      summary: "Recorded builder instruction suggestion; no direct execution.",
      source: "archiveos",
      external_ref: `command_run:${builderResultId}`,
      metadata: { task_id: task.id },
    });
    await createKnowledgeEdge({
      from_node_id: taskNode.id,
      to_node_id: builderNode.id,
      edge_type: "produced",
      metadata: { reason: "pm_queue_builder_instruction" },
    });
  }

  if (reviewerResultId) {
    const reviewerNode = await upsertKnowledgeNode({
      node_type: "reviewer_result",
      title: `Reviewer Verdict - ${task.title}`,
      summary: "Recorded reviewer verdict suggestion; PM decision required.",
      source: "archiveos",
      external_ref: `command_run:${reviewerResultId}`,
      metadata: { task_id: task.id },
    });
    if (builderNode) {
      await createKnowledgeEdge({
        from_node_id: builderNode.id,
        to_node_id: reviewerNode.id,
        edge_type: "reviewed_by",
        metadata: { reason: "pm_queue_reviewer_verdict" },
      });
    }
  }
}

async function linkDecisionKnowledge(task: PmTaskRow, decision: PmTaskDecisionRow) {
  const taskNode = await linkTaskKnowledge(task);
  const decisionNode = await upsertKnowledgeNode({
    node_type: "decision",
    title: `PM ${decision.action} - ${task.title}`,
    summary: decision.reason ?? `PM recorded ${decision.action}.`,
    source: "archiveos",
    external_ref: `pm_task_decision:${decision.id}`,
    metadata: { task_id: task.id, action: decision.action },
  });
  await createKnowledgeEdge({
    from_node_id: decisionNode.id,
    to_node_id: taskNode.id,
    edge_type: "decided_by",
    metadata: { reason: "pm_queue_decision" },
  });
}

function compareTaskPriority(left: PmTaskRow, right: PmTaskRow) {
  return priorityWeight[left.priority] - priorityWeight[right.priority] || left.created_at.localeCompare(right.created_at);
}

function clampMaxIterations(value: number | undefined) {
  if (!Number.isFinite(value ?? 2)) return 2;
  return Math.min(Math.max(Math.trunc(value ?? 2), 1), 10);
}

function buildRecommendedPmAction(tasks: PmTaskRow[]) {
  const pending = tasks.filter((task) => task.status === "pm_decision_required").length;
  if (pending) return `${pending} task(s) require PM approval, rejection, hold, or retry.`;
  if (tasks.some((task) => task.status === "queued")) return "Run queue once to generate Architect/Builder/Reviewer records.";
  if (tasks.some((task) => activeStatuses.includes(task.status))) return "Wait for orchestration record generation to finish.";
  return "No PM action required.";
}

function getStatusForDecision(action: Exclude<PmDecisionAction, "retry">): PmTaskStatus {
  if (action === "approve") return "approved";
  if (action === "reject") return "rejected";
  return "hold";
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatKst(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
