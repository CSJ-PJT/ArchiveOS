import { getLocalRuntimeStatus, type LocalRuntimeStatus } from "../lib/localRuntime.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { addDaysToDateString, getSeoulDateString } from "./businessDays.js";
import { exportBatchReportToObsidian, linkNightlyReviewExport } from "../historian/index.js";
import type { ExportResult } from "../historian/index.js";
import { recordBatchRun, recordHistorianExport, recordRuntimeSnapshot, updateBatchRunMetadata } from "./store.js";
import type { BatchResult, NightlyReviewSummary, OperationStatus, OperatorSummary } from "./types.js";

type NightlyReviewOptions = {
  targetDate?: string;
  persist?: boolean;
};

type RuntimeReadResult =
  | { ok: true; runtime: LocalRuntimeStatus }
  | { ok: false; reason: string; runtime: LocalRuntimeStatus };

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

  const persisted = await recordBatchRun(result);

  try {
    await recordRuntimeSnapshot(summary);
  } catch (error) {
    persisted.metadata = {
      ...persisted.metadata,
      runtime_snapshot_error: error instanceof Error ? error.message : "Unknown runtime snapshot persistence error.",
    };
  }

  const historianResult: ExportResult = await exportBatchReportToObsidian(persisted, summary).catch((error): ExportResult => ({
    enabled: true,
    success: false,
    reason: error instanceof Error ? error.message : "Unknown Historian export error.",
  }));
  const historianMetadata = {
    historian_exported: historianResult.success,
    historian_note_path: historianResult.notePath ?? null,
    historian_export_reason: historianResult.success ? null : historianResult.reason ?? "Historian export skipped.",
  };
  persisted.metadata = {
    ...persisted.metadata,
    ...historianMetadata,
  };

  if (persisted.id) {
    await updateBatchRunMetadata(persisted.id, persisted.metadata).catch(() => undefined);
  }

  await recordHistorianExport({
    note_type: "batch_report",
    status: historianResult.success ? "success" : historianResult.enabled ? "failed" : "skipped",
    note_path: historianResult.notePath ?? null,
    reason: historianResult.success ? null : historianResult.reason ?? null,
    source_id: persisted.id ?? null,
  }).catch(() => undefined);

  await linkNightlyReviewExport(persisted, summary, historianResult).catch((error) => {
    persisted.metadata = {
      ...persisted.metadata,
      knowledge_graph_error: error instanceof Error ? error.message : "Unknown knowledge graph link error.",
    };
  });

  return persisted;
}

export async function buildNightlyReviewSummary(targetDate: string): Promise<NightlyReviewSummary> {
  const runtimeResult = await readRuntimeSafely();
  const runtime = runtimeResult.runtime;
  const [commands, decisions] = await Promise.all([readRecentCommands(), readRecentDecisions()]);

  const warnings = buildWarnings(runtime, runtimeResult.ok ? null : runtimeResult.reason);
  const operation = judgeOperationStatus(runtime, warnings, runtimeResult.ok);
  const operators = buildOperatorSummary(runtime);
  const latestBuilder = runtime.latest_details.builder
    ? {
        task_id: runtime.latest_details.builder.task_id,
        status: runtime.latest_details.builder.status,
        result_name: runtime.latest.outbox?.name ?? null,
        finished_at: runtime.latest_details.builder.finished_at,
        summary: runtime.latest_details.builder.summary,
      }
    : null;
  const latestReviewer = runtime.latest_details.reviewer
    ? {
        reviewed_task_id: runtime.latest_details.reviewer.reviewed_task_id,
        verdict: runtime.latest_details.reviewer.verdict,
        review_name: runtime.latest.review?.name ?? null,
        reviewed_at: runtime.latest_details.reviewer.reviewed_at,
        summary: runtime.latest_details.reviewer.summary,
      }
    : null;

  const summaryText = [
    `ArchiveOS 일일 운영 요약: ${targetDate}`,
    `상태: ${operation.status} / ${operation.reason}`,
    `Runtime: Inbox ${runtime.queue.inbox}, Processing ${runtime.queue.processing}, Outbox ${runtime.queue.outbox}, Reviews ${runtime.queue.reviews}`,
    latestBuilder
      ? `Builder: ${latestBuilder.status ?? "unknown"} / ${latestBuilder.task_id ?? latestBuilder.result_name ?? "unknown"}`
      : "Builder: 없음",
    latestReviewer
      ? `Reviewer: ${latestReviewer.verdict ?? "unknown"} / ${latestReviewer.reviewed_task_id ?? latestReviewer.review_name ?? "unknown"}`
      : "Reviewer: 없음",
    warnings.length ? `경고: ${warnings.join(" | ")}` : "경고: 없음",
    `Decisions: ${decisions.length}. Commands: ${commands.length}.`,
  ].join("\n");

  return {
    date: targetDate,
    operationStatus: operation.status,
    statusReason: operation.reason,
    queue: {
      inbox: runtime.queue.inbox,
      processing: runtime.queue.processing,
      outbox: runtime.queue.outbox,
      reviews: runtime.queue.reviews,
    },
    latestInboxTask: runtime.latest.inbox?.name ?? null,
    latestBuilder,
    latestReviewer,
    operators,
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

async function readRuntimeSafely(): Promise<RuntimeReadResult> {
  try {
    return { ok: true, runtime: await getLocalRuntimeStatus() };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "backend runtime API 응답 실패",
      runtime: {
        checked_at: new Date().toISOString(),
        status: "unknown",
        queue: {
          path: null,
          inbox: 0,
          processing: 0,
          outbox: 0,
          reviews: 0,
        },
        active_task: null,
        processes: {
          implementer: null,
          reviewer: null,
          loop: null,
          reviewer_bridge: null,
        },
        latest: {
          inbox: null,
          processing: null,
          outbox: null,
          review: null,
        },
        latest_details: {
          builder: null,
          reviewer: null,
        },
        judgement: "backend runtime API 응답 실패",
      },
    };
  }
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

function buildWarnings(runtime: LocalRuntimeStatus, runtimeError: string | null) {
  return [
    runtimeError ? `backend runtime API 응답 실패: ${runtimeError}` : null,
    runtime.queue.processing > 0 && !runtime.processes.implementer
      ? "processing 작업이 있지만 implementer 프로세스가 감지되지 않았습니다."
      : null,
    runtime.queue.inbox > 0 && !runtime.processes.loop
      ? "inbox에 작업이 있지만 loop 프로세스가 감지되지 않았습니다."
      : null,
    runtime.latest_details.reviewer?.verdict === "stop"
      ? "최신 reviewer verdict가 stop입니다."
      : null,
    /usage limit/i.test(runtime.latest_details.reviewer?.summary ?? "")
      ? "Codex 사용량 제한으로 reviewer stop이 감지되었습니다."
      : null,
  ].filter((warning): warning is string => Boolean(warning));
}

function judgeOperationStatus(
  runtime: LocalRuntimeStatus,
  warnings: string[],
  runtimeReadable: boolean,
): { status: OperationStatus; reason: string } {
  if (!runtimeReadable || warnings.some((warning) => warning.includes("backend runtime API 응답 실패"))) {
    return { status: "problem", reason: "backend runtime API 응답 실패" };
  }

  const loopDetected = Boolean(runtime.processes.loop);
  if (runtime.queue.processing > 0 && loopDetected) {
    return { status: "normal", reason: "loop가 감지되었고 processing 작업이 진행 중입니다." };
  }

  const usageLimitWarning = warnings.find((warning) => warning.includes("사용량 제한"));
  if (usageLimitWarning) {
    return { status: "warning", reason: usageLimitWarning };
  }

  const inboxLoopWarning = warnings.find((warning) => warning.includes("inbox에 작업"));
  if (inboxLoopWarning) {
    return { status: "warning", reason: inboxLoopWarning };
  }

  const processingWarning = warnings.find((warning) => warning.includes("processing 작업"));
  if (processingWarning) {
    return { status: "warning", reason: processingWarning };
  }

  return { status: "normal", reason: runtime.queue.inbox > 0 ? "대기 작업이 있으며 loop 상태를 확인해야 합니다." : "치명적 경고가 없습니다." };
}

function buildOperatorSummary(runtime: LocalRuntimeStatus): OperatorSummary {
  return {
    implementer: runtime.processes.implementer
      ? runtime.queue.processing > 0
        ? "작업중"
        : "감지됨"
      : "미감지",
    reviewer: runtime.processes.reviewer ? "감지됨" : "미감지",
    loop: runtime.processes.loop ? "감지됨" : "미감지",
    reviewerBridge: runtime.processes.reviewer_bridge ? "감지됨" : "미감지",
  };
}

function summarizeText(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > 160 ? `${clean.slice(0, 160)}...` : clean;
}
