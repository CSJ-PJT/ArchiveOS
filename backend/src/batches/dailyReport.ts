import { addDaysToDateString, getSeoulDateString, isKoreanBusinessDay } from "./businessDays.js";
import { sendDiscordMessage } from "./discord.js";
import { exportDailyReportToObsidian, linkDailyReportExport } from "../historian/index.js";
import type { ExportResult } from "../historian/index.js";
import { buildNightlyReviewSummary } from "./nightlyReview.js";
import {
  getLatestBatchRun,
  recordBatchRun,
  recordDailyReport,
  recordHistorianExport,
  updateDailyReportHistorianStatus,
} from "./store.js";
import type { BatchResult, DailyReportRecord, NightlyReviewSummary } from "./types.js";

type DailyReportOptions = {
  today?: Date;
  persist?: boolean;
};

export async function runDailyReportBatch(options: DailyReportOptions = {}): Promise<BatchResult> {
  const today = options.today ?? new Date();
  const todayString = getSeoulDateString(today);
  const targetDate = addDaysToDateString(todayString, -1);
  const businessDay = await isKoreanBusinessDay(today);
  const nightly = await loadNightlyReview(targetDate);
  const publicUrl = process.env.ARCHIVEOS_PUBLIC_URL?.trim() || null;

  if (!businessDay.businessDay) {
    const reportText = buildDailyReportMessage(targetDate, nightly, publicUrl, businessDay.reason);
    return persistDailyAndBatch(
      nightly,
      reportText,
      {
        batch_type: "daily_report",
        status: "skipped",
        target_date: targetDate,
        summary: `Discord 일일 보고 생략: ${businessDay.reason}.`,
        metadata: {
          today: todayString,
          reason: businessDay.reason,
          business_day: false,
          nightly,
          archiveos_public_url_configured: Boolean(publicUrl),
        },
      },
      false,
      businessDay.reason,
      options.persist,
    );
  }

  const webhookConfigured = Boolean(process.env.DISCORD_WEBHOOK_URL?.trim());
  if (!webhookConfigured) {
    const reason = "DISCORD_WEBHOOK_URL not configured";
    const reportText = buildDailyReportMessage(targetDate, nightly, publicUrl, reason);
    return persistDailyAndBatch(
      nightly,
      reportText,
      {
        batch_type: "daily_report",
        status: "skipped",
        target_date: targetDate,
        summary: "Discord 일일 보고 생략: DISCORD_WEBHOOK_URL 미설정.",
        metadata: {
          today: todayString,
          reason,
          business_day: true,
          nightly,
          archiveos_public_url_configured: Boolean(publicUrl),
        },
      },
      false,
      reason,
      options.persist,
    );
  }

  const message = buildDailyReportMessage(targetDate, nightly, publicUrl);
  const sent = await sendDiscordMessage(message);

  if (!sent.ok) {
    return persistDailyAndBatch(
      nightly,
      message,
      {
        batch_type: "daily_report",
        status: "failed",
        target_date: targetDate,
        summary: `Discord 일일 보고 실패: ${sent.reason}.`,
        metadata: {
          today: todayString,
          reason: sent.reason,
          business_day: true,
          nightly,
          archiveos_public_url_configured: Boolean(publicUrl),
        },
      },
      false,
      sent.reason,
      options.persist,
    );
  }

  return persistDailyAndBatch(
    nightly,
    message,
    {
      batch_type: "daily_report",
      status: "sent",
      target_date: targetDate,
      summary: `Discord 일일 보고 전송 완료: ${targetDate}.`,
      metadata: {
        today: todayString,
        business_day: true,
        nightly,
        archiveos_public_url_configured: Boolean(publicUrl),
      },
    },
    true,
    null,
    options.persist,
  );
}

async function loadNightlyReview(targetDate: string): Promise<NightlyReviewSummary> {
  const latest = await getLatestBatchRun("nightly_review", targetDate).catch(() => null);
  const metadata = latest?.metadata as Partial<NightlyReviewSummary> | null;

  if (metadata?.queue && metadata.date === targetDate && metadata.summaryText) {
    return metadata as NightlyReviewSummary;
  }

  return buildNightlyReviewSummary(targetDate);
}

function buildDailyReportMessage(
  targetDate: string,
  nightly: NightlyReviewSummary,
  publicUrl: string | null,
  skippedReason?: string,
) {
  const statusLine = formatOperationStatus(nightly.operationStatus);
  const reason = skippedReason ? `${nightly.statusReason} / Discord 생략: ${skippedReason}` : nightly.statusReason;
  const warnings = nightly.warnings.length
    ? nightly.warnings.map((warning) => `• ${warning}`).join("\n")
    : "• 감지된 경고 없음";
  const latestWaitingTask = nightly.queue.inbox > 0
    ? nightly.latestInboxTask ?? `대기 작업 ${nightly.queue.inbox}개`
    : "대기 작업 없음";
  const dashboardLink = publicUrl ? ["", "Dashboard:", publicUrl] : [];

  return [
    "📊 ArchiveOS 일일 운영 보고",
    `대상일: ${targetDate}`,
    "",
    `상태: ${statusLine}`,
    `사유: ${reason}`,
    "",
    "Runtime",
    `• Inbox: ${nightly.queue.inbox}`,
    `• Processing: ${nightly.queue.processing}`,
    `• Outbox: ${nightly.queue.outbox}`,
    `• Reviews: ${nightly.queue.reviews}`,
    "",
    "최신 결과",
    `• Builder: ${nightly.latestBuilder?.status ?? "없음"} / ${shortenName(nightly.latestBuilder?.task_id ?? nightly.latestBuilder?.result_name ?? "-")}`,
    `• Reviewer: ${nightly.latestReviewer?.verdict ?? "없음"} / ${shortenName(nightly.latestReviewer?.reviewed_task_id ?? nightly.latestReviewer?.review_name ?? "-")}`,
    "",
    "현재 대기 작업",
    `• ${shortenName(latestWaitingTask)}`,
    "",
    "작업자",
    `• Implementer: ${nightly.operators.implementer}`,
    `• Reviewer: ${nightly.operators.reviewer}`,
    `• Loop: ${nightly.operators.loop}`,
    `• Reviewer Bridge: ${nightly.operators.reviewerBridge}`,
    "",
    "경고",
    warnings,
    "",
    "Decisions / Commands",
    `• Decisions: ${nightly.decisions.count}`,
    `• Commands: ${nightly.commands.count}`,
    ...dashboardLink,
  ].join("\n");
}

async function persistDailyAndBatch(
  nightly: NightlyReviewSummary,
  reportText: string,
  result: BatchResult,
  discordSent: boolean,
  discordSkippedReason: string | null,
  persist = true,
) {
  if (persist === false) {
    return result;
  }

  const report: DailyReportRecord = {
    target_date: result.target_date,
    status: nightly.operationStatus,
    status_reason: nightly.statusReason,
    runtime_summary: nightly.queue,
    latest_builder: nightly.latestBuilder,
    latest_reviewer: nightly.latestReviewer,
    operator_summary: nightly.operators,
    warnings: nightly.warnings,
    decisions_count: nightly.decisions.count,
    commands_count: nightly.commands.count,
    discord_sent: discordSent,
    discord_skipped_reason: discordSkippedReason,
    report_text: reportText,
  };

  const persisted = await recordBatchRun(result);

  try {
    const dailyReport = await recordDailyReport(report);
    const historianResult: ExportResult = await exportDailyReportToObsidian(dailyReport).catch((error): ExportResult => ({
      enabled: true,
      success: false,
      reason: error instanceof Error ? error.message : "Unknown Historian export error.",
    }));
    await updateDailyReportHistorianStatus(dailyReport.id, {
      historian_exported: historianResult.success,
      historian_note_path: historianResult.notePath ?? null,
      historian_export_reason: historianResult.success ? null : historianResult.reason ?? "Historian export skipped.",
    }).catch(() => undefined);
    await recordHistorianExport({
      note_type: "daily_report",
      status: historianResult.success ? "success" : historianResult.enabled ? "failed" : "skipped",
      note_path: historianResult.notePath ?? null,
      reason: historianResult.success ? null : historianResult.reason ?? null,
      source_id: dailyReport.id,
    }).catch(() => undefined);
    await linkDailyReportExport(dailyReport, historianResult).catch((error) => {
      persisted.metadata = {
        ...persisted.metadata,
        knowledge_graph_error: error instanceof Error ? error.message : "Unknown knowledge graph link error.",
      };
    });
    persisted.metadata = {
      ...persisted.metadata,
      daily_report_id: dailyReport.id,
      historian_exported: historianResult.success,
      historian_note_path: historianResult.notePath ?? null,
      historian_export_reason: historianResult.success ? null : historianResult.reason ?? null,
    };
  } catch (error) {
    persisted.metadata = {
      ...persisted.metadata,
      daily_report_persistence_error: error instanceof Error ? error.message : "Unknown daily report persistence error.",
    };
  }

  return persisted;
}

function formatOperationStatus(status: NightlyReviewSummary["operationStatus"]) {
  if (status === "problem") return "🔴 문제";
  if (status === "warning") return "🟡 주의";
  return "🟢 정상";
}

function shortenName(value: string) {
  if (value.length <= 72) {
    return value;
  }

  return `${value.slice(0, 69)}...`;
}
