import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import type {
  BatchResult,
  BatchRun,
  BatchStatus,
  BatchType,
  DailyReportRecord,
  DailyReportRow,
  NightlyReviewSummary,
  RuntimeSnapshotRow,
} from "./types.js";

export async function recordBatchRun(input: {
  batch_type: BatchType;
  status: BatchStatus;
  target_date: string;
  summary: string;
  metadata: Record<string, unknown>;
}): Promise<BatchResult> {
  const { data, error } = await supabaseAdmin
    .from("batch_runs")
    .insert(input)
    .select("*")
    .single();

  if (error) {
    return {
      ...input,
      metadata: {
        ...input.metadata,
        persistence_error: error.message,
      },
    };
  }

  const row = data as BatchRun;
  return {
    batch_type: row.batch_type,
    status: row.status,
    target_date: row.target_date,
    summary: row.summary,
    metadata: row.metadata,
    created_at: row.created_at,
  };
}

export async function getRecentBatchRuns(limit = 20) {
  const { data, error } = await supabaseAdmin
    .from("batch_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as BatchRun[];
}

export async function getLatestBatchRuns() {
  const [nightly, daily] = await Promise.all([
    getLatestBatchRun("nightly_review"),
    getLatestBatchRun("daily_report"),
  ]);

  return { nightly_review: nightly, daily_report: daily };
}

export async function getLatestBatchRun(batchType: BatchType, targetDate?: string) {
  let query = supabaseAdmin
    .from("batch_runs")
    .select("*")
    .eq("batch_type", batchType)
    .order("created_at", { ascending: false })
    .limit(1);

  if (targetDate) {
    query = query.eq("target_date", targetDate);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? [])[0] ?? null) as BatchRun | null;
}

export async function recordDailyReport(report: DailyReportRecord) {
  const { data, error } = await supabaseAdmin
    .from("daily_reports")
    .insert(report)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to record daily report: ${error.message}`);
  }

  return data as DailyReportRow;
}

export async function getLatestDailyReport() {
  const { data, error } = await supabaseAdmin
    .from("daily_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch latest daily report: ${error.message}`);
  }

  return data as DailyReportRow | null;
}

export async function getRecentDailyReports(limit = 20) {
  const { data, error } = await supabaseAdmin
    .from("daily_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch recent daily reports: ${error.message}`);
  }

  return (data ?? []) as DailyReportRow[];
}

export async function recordRuntimeSnapshot(summary: NightlyReviewSummary) {
  const { data, error } = await supabaseAdmin
    .from("runtime_snapshots")
    .insert({
      captured_at: new Date().toISOString(),
      inbox_count: summary.queue.inbox,
      processing_count: summary.queue.processing,
      outbox_count: summary.queue.outbox,
      reviews_count: summary.queue.reviews,
      active_task: summary.latestBuilder?.task_id ?? summary.latestReviewer?.reviewed_task_id ?? null,
      latest_builder: summary.latestBuilder,
      latest_reviewer: summary.latestReviewer,
      operators: summary.operators,
      warnings: summary.warnings,
      source: "nightly_review_batch",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to record runtime snapshot: ${error.message}`);
  }

  return data as RuntimeSnapshotRow;
}

export async function getRecentRuntimeSnapshots(limit = 20) {
  const { data, error } = await supabaseAdmin
    .from("runtime_snapshots")
    .select("*")
    .order("captured_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch recent runtime snapshots: ${error.message}`);
  }

  return (data ?? []) as RuntimeSnapshotRow[];
}
