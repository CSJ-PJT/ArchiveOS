import type { BatchResult, DailyReportRow, NightlyReviewSummary } from "../batches/types.js";
import { bullet, frontmatter, markdownList } from "./markdown.js";
import { writeVaultNote } from "./obsidianVault.js";
import type { ExportResult } from "./types.js";

export async function exportDailyReportToObsidian(report: DailyReportRow): Promise<ExportResult> {
  const runtime = report.runtime_summary as {
    inbox?: number;
    processing?: number;
    outbox?: number;
    reviews?: number;
  };
  const builder = report.latest_builder as {
    status?: string | null;
    task_id?: string | null;
    result_name?: string | null;
  } | null;
  const reviewer = report.latest_reviewer as {
    verdict?: string | null;
    reviewed_task_id?: string | null;
    review_name?: string | null;
  } | null;
  const operators = report.operator_summary as {
    implementer?: string;
    reviewer?: string;
    loop?: string;
    reviewerBridge?: string;
  };
  const dashboardUrl = process.env.ARCHIVEOS_PUBLIC_URL?.trim() || null;

  const content = [
    frontmatter({
      type: "daily_report",
      date: report.target_date,
      source: "archiveos",
      status: report.status,
      tags: ["archiveos", "daily-report", "operations"],
    }),
    `# ArchiveOS 일일 운영 보고 - ${report.target_date}`,
    "",
    "## 상태",
    `- 상태: ${toKoreanStatus(report.status)}`,
    `- 사유: ${report.status_reason}`,
    "",
    "## Runtime",
    `- Inbox: ${bullet(runtime.inbox, "0")}`,
    `- Processing: ${bullet(runtime.processing, "0")}`,
    `- Outbox: ${bullet(runtime.outbox, "0")}`,
    `- Reviews: ${bullet(runtime.reviews, "0")}`,
    "",
    "## 최신 결과",
    `- Builder: ${bullet(builder?.status)} / ${bullet(builder?.task_id ?? builder?.result_name)}`,
    `- Reviewer: ${bullet(reviewer?.verdict)} / ${bullet(reviewer?.reviewed_task_id ?? reviewer?.review_name)}`,
    "",
    "## 작업자",
    `- Implementer: ${bullet(operators.implementer)}`,
    `- Reviewer: ${bullet(operators.reviewer)}`,
    `- Loop: ${bullet(operators.loop)}`,
    `- Reviewer Bridge: ${bullet(operators.reviewerBridge)}`,
    "",
    "## 경고",
    markdownList(report.warnings),
    "",
    "## Decisions / Commands",
    `- Decisions: ${report.decisions_count}`,
    `- Commands: ${report.commands_count}`,
    "",
    "## 관련 링크",
    dashboardUrl ? `- Dashboard: ${dashboardUrl}` : "- Dashboard: 미설정",
    "",
    "## 원문 보고서",
    "```text",
    report.report_text,
    "```",
    "",
  ].join("\n");

  return writeVaultNote("Reports", `daily-report-${report.target_date}`, content);
}

export async function exportBatchReportToObsidian(
  batch: BatchResult,
  summary: NightlyReviewSummary,
): Promise<ExportResult> {
  const content = [
    frontmatter({
      type: "batch_report",
      date: batch.target_date,
      source: "archiveos",
      batch_type: batch.batch_type,
      status: batch.status,
      tags: ["archiveos", "batch", "operations"],
    }),
    `# ArchiveOS Batch Report - ${batch.batch_type} - ${batch.target_date}`,
    "",
    "## 요약",
    batch.summary,
    "",
    "## Runtime",
    `- Inbox: ${summary.queue.inbox}`,
    `- Processing: ${summary.queue.processing}`,
    `- Outbox: ${summary.queue.outbox}`,
    `- Reviews: ${summary.queue.reviews}`,
    "",
    "## 경고",
    markdownList(summary.warnings),
    "",
  ].join("\n");

  return writeVaultNote("Batches", `${batch.batch_type}-${batch.target_date}`, content);
}

function toKoreanStatus(status: DailyReportRow["status"]) {
  if (status === "problem") return "문제";
  if (status === "warning") return "주의";
  return "정상";
}
