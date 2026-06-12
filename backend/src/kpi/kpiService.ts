import { getLocalRuntimeStatus } from "../lib/localRuntime.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  countByDate,
  getRangeStart,
  isLoopDetected,
  normalizeRange,
  percent,
  ratio,
  readJsonArrayLength,
} from "./kpiCalculations.js";
import type { KpiOverview, KpiRange } from "./types.js";

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

type CountResult = {
  count: number | null;
  error: unknown;
};

type RuntimeSnapshotForKpi = {
  captured_at: string;
  inbox_count: number;
  processing_count: number;
  outbox_count: number;
  reviews_count: number;
  operators: Record<string, unknown> | null;
  warnings: unknown;
  latest_reviewer: { verdict?: string | null } | null;
};

type DailyReportForKpi = {
  target_date: string;
  created_at: string;
  status: string;
  warnings: unknown;
  latest_reviewer: { verdict?: string | null } | null;
};

type CreatedAtRow = {
  created_at: string;
};

export async function getKpiOverview(rangeInput: unknown): Promise<KpiOverview> {
  const range = normalizeRange(rangeInput);
  const generatedAt = new Date().toISOString();
  const start = getRangeStart(range).toISOString();
  const notes: string[] = [];

  const [
    runtime,
    tasksCompleted,
    decisions,
    commands,
    dailyReports,
    nightlyReviews,
    snapshotsResult,
    dailyReportsRowsResult,
    architectureRowsResult,
    knowledgeNodesTotal,
    knowledgeEdgesTotal,
    knowledgeNodesRange,
    knowledgeEdgesRange,
    historianExports,
  ] = await Promise.all([
    getLocalRuntimeStatus().catch(() => null),
    countTable("tasks", { column: "status", value: "done", sinceColumn: "updated_at", since: start }),
    fetchRows<CreatedAtRow>("work_logs", "id, created_at", start, { column: "log_type", value: "decision", excludeIds: seedWorkLogIds }),
    fetchRows<CreatedAtRow>("command_runs", "id, created_at", start, { sinceColumn: "created_at", excludeIds: seedCommandRunIds }),
    countTable("batch_runs", { column: "batch_type", value: "daily_report", statusColumn: "status", statusValue: "sent", sinceColumn: "created_at", since: start }),
    countTable("batch_runs", { column: "batch_type", value: "nightly_review", statusColumn: "status", statusValue: "completed", sinceColumn: "created_at", since: start }),
    fetchRows<RuntimeSnapshotForKpi>("runtime_snapshots", "captured_at, inbox_count, processing_count, outbox_count, reviews_count, operators, warnings, latest_reviewer", start, { sinceColumn: "captured_at" }),
    fetchRows<DailyReportForKpi>("daily_reports", "target_date, created_at, status, warnings, latest_reviewer", start),
    fetchRows<{ id: string; status: string; created_at: string }>("architecture_reviews", "id, status, created_at", start),
    countTable("knowledge_nodes", {}),
    countTable("knowledge_edges", {}),
    countTable("knowledge_nodes", { sinceColumn: "created_at", since: start }),
    countTable("knowledge_edges", { sinceColumn: "created_at", since: start }),
    countTable("historian_exports", { column: "status", value: "success", sinceColumn: "created_at", since: start }),
  ]);

  const snapshots = snapshotsResult.data ?? [];
  const dailyRows = dailyReportsRowsResult.data ?? [];
  const architectureRows = architectureRowsResult.data ?? [];
  const latestSnapshot = snapshots[0] ?? null;
  const verdicts = [
    ...snapshots.map((snapshot) => snapshot.latest_reviewer?.verdict ?? null),
    ...dailyRows.map((report) => report.latest_reviewer?.verdict ?? null),
  ].filter(Boolean) as string[];
  const reviewApproveCount = verdicts.filter((verdict) => verdict.includes("approve")).length;
  const reviewRejectCount = verdicts.filter((verdict) => verdict.includes("reject") || verdict.includes("request_changes")).length;
  const reviewStopCount = verdicts.filter((verdict) => verdict.includes("stop")).length;
  const reviewDenominator = reviewApproveCount + reviewRejectCount + reviewStopCount;
  const warningCount =
    dailyRows.reduce((sum, report) => sum + readJsonArrayLength(report.warnings), 0) +
    snapshots.reduce((sum, snapshot) => sum + readJsonArrayLength(snapshot.warnings), 0) +
    architectureRows.filter((review) => review.status === "warning" || review.status === "blocked").length;
  const loopSignals = snapshots.map((snapshot) => isLoopDetected(snapshot.operators)).filter((value): value is boolean => value !== null);
  const runtimeLatestStatus = deriveRuntimeStatus(runtime, warningCount);
  const totalNodes = knowledgeNodesTotal.count;
  const totalEdges = knowledgeEdgesTotal.count;

  addCountNotes(notes, {
    tasksCompleted,
    decisions,
    commands,
    dailyReports,
    nightlyReviews,
    knowledgeNodesTotal,
    knowledgeEdgesTotal,
    knowledgeNodesRange,
    knowledgeEdgesRange,
    historianExports,
  });

  if (!runtime) notes.push("Current runtime status was unavailable; latest runtime queue values are null.");
  if (!snapshots.length) notes.push("No runtime snapshots exist in range; loop detected rate is unavailable.");
  if (!verdicts.length) notes.push("No reviewer verdicts were found in range; approval rate is unavailable.");

  return {
    range,
    generatedAt,
    productivity: {
      tasksCompleted: tasksCompleted.count,
      reviewsCompleted: verdicts.length || null,
      decisionsRecorded: decisions.data?.length ?? null,
      commandsRecorded: commands.data?.length ?? null,
      dailyReportsSent: dailyReports.count,
      nightlyReviewsCompleted: nightlyReviews.count,
    },
    quality: {
      reviewApproveCount,
      reviewRejectCount,
      reviewStopCount,
      approvalRate: percent(reviewApproveCount, reviewDenominator),
      architectReviewCount: architectureRows.length,
      architectWarningCount: architectureRows.filter((review) => review.status === "warning").length,
      architectBlockedCount: architectureRows.filter((review) => review.status === "blocked").length,
    },
    runtime: {
      latestInbox: runtime?.queue.inbox ?? latestSnapshot?.inbox_count ?? null,
      latestProcessing: runtime?.queue.processing ?? latestSnapshot?.processing_count ?? null,
      latestOutbox: runtime?.queue.outbox ?? latestSnapshot?.outbox_count ?? null,
      latestReviews: runtime?.queue.reviews ?? latestSnapshot?.reviews_count ?? null,
      latestStatus: runtimeLatestStatus,
      warningCount,
      loopDetectedRate: loopSignals.length ? percent(loopSignals.filter(Boolean).length, loopSignals.length) : null,
    },
    knowledge: {
      totalNodes,
      totalEdges,
      nodesCreatedInRange: knowledgeNodesRange.count,
      edgesCreatedInRange: knowledgeEdgesRange.count,
      obsidianExports: historianExports.count,
      graphDensity: totalNodes === null || totalEdges === null ? null : ratio(totalEdges, totalNodes),
    },
    trends: {
      dailyReports: countByDate(dailyRows.map((row) => row.created_at)),
      decisions: countByDate((decisions.data ?? []).map((row) => row.created_at)),
      knowledgeNodes: await getKnowledgeNodeTrend(start),
      warnings: countByDate([
        ...dailyRows.flatMap((row) => Array.from({ length: readJsonArrayLength(row.warnings) }, () => row.created_at)),
        ...snapshots.flatMap((row) => Array.from({ length: readJsonArrayLength(row.warnings) }, () => row.captured_at)),
      ]),
    },
    notes,
  };
}

async function countTable(
  table: string,
  filters: {
    column?: string;
    value?: string;
    statusColumn?: string;
    statusValue?: string;
    sinceColumn?: string;
    since?: string;
  },
): Promise<CountResult> {
  let query = supabaseAdmin.from(table).select("id", { count: "exact", head: true });

  if (filters.column && filters.value) query = query.eq(filters.column, filters.value);
  if (filters.statusColumn && filters.statusValue) query = query.eq(filters.statusColumn, filters.statusValue);
  if (filters.sinceColumn && filters.since) query = query.gte(filters.sinceColumn, filters.since);

  const { count, error } = await query;
  return { count: error ? null : count ?? 0, error };
}

async function fetchRows<T>(
  table: string,
  select: string,
  since: string,
  options: { column?: string; value?: string; sinceColumn?: string; excludeIds?: string[] } = {},
) {
  let query = supabaseAdmin
    .from(table)
    .select(select)
    .gte(options.sinceColumn ?? "created_at", since)
    .order(options.sinceColumn ?? "created_at", { ascending: false });

  if (options.column && options.value) query = query.eq(options.column, options.value);
  if (options.excludeIds?.length) query = query.not("id", "in", `(${options.excludeIds.join(",")})`);

  const { data, error } = await query;
  return { data: error ? [] : (data ?? []) as unknown as T[], error };
}

async function getKnowledgeNodeTrend(start: string) {
  const { data, error } = await supabaseAdmin
    .from("knowledge_nodes")
    .select("created_at")
    .gte("created_at", start)
    .order("created_at", { ascending: true });

  if (error) return [];
  return countByDate((data ?? []).map((row) => row.created_at));
}

function deriveRuntimeStatus(runtime: Awaited<ReturnType<typeof getLocalRuntimeStatus>> | null, warningCount: number) {
  if (!runtime) return "unknown";
  if (runtime.status === "working") return "healthy";
  if (runtime.queue.processing > 0 && !runtime.processes.implementer) return "warning";
  if (runtime.queue.inbox > 0 && !runtime.processes.loop) return "warning";
  if (warningCount > 0) return "warning";
  return "healthy";
}

function addCountNotes(notes: string[], counts: Record<string, CountResult | { error: unknown }>) {
  for (const [name, result] of Object.entries(counts)) {
    if (result.error) {
      notes.push(`${name} metric is unavailable from Supabase.`);
    }
  }
}
