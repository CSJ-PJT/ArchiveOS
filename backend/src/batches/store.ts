import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import type { BatchResult, BatchRun, BatchStatus, BatchType } from "./types.js";

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
