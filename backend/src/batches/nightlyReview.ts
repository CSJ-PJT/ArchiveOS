import { getLocalRuntimeStatus } from "../lib/localRuntime.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { addDaysToDateString, getSeoulDateString } from "./businessDays.js";
import { recordBatchRun } from "./store.js";
import type { BatchResult, NightlyReviewSummary } from "./types.js";

type NightlyReviewOptions = {
  targetDate?: string;
  persist?: boolean;
};

export async function runNightlyReviewBatch(options: NightlyReviewOptions = {}): Promise<BatchResult> {
  const targetDate = options.targetDate ?? addDaysToDateString(getSeoulDateString(), -1);
  const summary = await buildNightlyReviewSummary(targetDate);
  const result = {
    batch_type: "nightly_review" as const,
    status: "completed" as const,
    target_date: targetDate,
    summary: summary.summaryText,
    metadata: summary as unknown as Record<string, unknown>,
  };

  if (options.persist === false) {
    return result;
  }

  return recordBatchRun(result);
}

export async function buildNightlyReviewSummary(targetDate: string): Promise<NightlyReviewSummary> {
  const runtime = await getLocalRuntimeStatus();
  const [commands, decisions] = await Promise.all([
    readRecentCommands(),
    readRecentDecisions(),
  ]);

  const warnings = buildWarnings(runtime);
  const latestBuilder = runtime.latest_details.builder
    ? {
        task_id: runtime.latest_details.builder.task_id,
        status: runtime.latest_details.builder.status,
        finished_at: runtime.latest_details.builder.finished_at,
        summary: runtime.latest_details.builder.summary,
      }
    : null;
  const latestReviewer = runtime.latest_details.reviewer
    ? {
        reviewed_task_id: runtime.latest_details.reviewer.reviewed_task_id,
        verdict: runtime.latest_details.reviewer.verdict,
        reviewed_at: runtime.latest_details.reviewer.reviewed_at,
        summary: runtime.latest_details.reviewer.summary,
      }
    : null;

  const summaryText = [
    `ArchiveOS nightly review for ${targetDate}`,
    `Queue: inbox ${runtime.queue.inbox}, processing ${runtime.queue.processing}, outbox ${runtime.queue.outbox}, reviews ${runtime.queue.reviews}.`,
    latestBuilder ? `Latest builder: ${latestBuilder.status ?? "unknown"} / ${latestBuilder.task_id ?? "unknown"}.` : "Latest builder: none.",
    latestReviewer ? `Latest reviewer: ${latestReviewer.verdict ?? "unknown"} / ${latestReviewer.reviewed_task_id ?? "unknown"}.` : "Latest reviewer: none.",
    warnings.length ? `Warnings: ${warnings.join(" | ")}` : "Warnings: none.",
    `Decisions: ${decisions.length}. Commands: ${commands.length}.`,
  ].join("\n");

  return {
    date: targetDate,
    queue: {
      inbox: runtime.queue.inbox,
      processing: runtime.queue.processing,
      outbox: runtime.queue.outbox,
      reviews: runtime.queue.reviews,
    },
    latestBuilder,
    latestReviewer,
    warnings,
    decisions: {
      count: decisions.length,
      recent: decisions.map((decision) => summarizeText(decision.content)),
    },
    commands: {
      count: commands.length,
      recent: commands.map((command) => summarizeText(`${command.command}: ${command.status}`)),
    },
    summaryText,
  };
}

async function readRecentCommands() {
  const { data } = await supabaseAdmin
    .from("command_runs")
    .select("command, status, result, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return data ?? [];
}

async function readRecentDecisions() {
  const { data } = await supabaseAdmin
    .from("work_logs")
    .select("content, created_at")
    .eq("log_type", "decision")
    .order("created_at", { ascending: false })
    .limit(10);

  return data ?? [];
}

function buildWarnings(runtime: Awaited<ReturnType<typeof getLocalRuntimeStatus>>) {
  return [
    runtime.queue.processing > 0 && !runtime.processes.implementer
      ? "processing task exists but implementer process is not detected"
      : null,
    runtime.queue.inbox > 0 && !runtime.processes.loop
      ? "inbox has work but loop process is not detected"
      : null,
    runtime.latest_details.reviewer?.verdict === "stop"
      ? "latest reviewer verdict is stop"
      : null,
    /usage limit/i.test(runtime.latest_details.reviewer?.summary ?? "")
      ? "Codex usage limit stop detected"
      : null,
  ].filter((warning): warning is string => Boolean(warning));
}

function summarizeText(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > 160 ? `${clean.slice(0, 160)}...` : clean;
}
