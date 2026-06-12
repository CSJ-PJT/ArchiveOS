import { addDaysToDateString, getSeoulDateString, isKoreanBusinessDay } from "./businessDays.js";
import { sendDiscordMessage } from "./discord.js";
import { buildNightlyReviewSummary } from "./nightlyReview.js";
import { getLatestBatchRun, recordBatchRun } from "./store.js";
import type { BatchResult, NightlyReviewSummary } from "./types.js";

type DailyReportOptions = {
  today?: Date;
  persist?: boolean;
};

export async function runDailyReportBatch(options: DailyReportOptions = {}): Promise<BatchResult> {
  const today = options.today ?? new Date();
  const todayString = getSeoulDateString(today);
  const targetDate = addDaysToDateString(todayString, -1);
  const businessDay = await isKoreanBusinessDay(today);

  if (!businessDay.businessDay) {
    return persistResult(
      {
        batch_type: "daily_report",
        status: "skipped",
        target_date: targetDate,
        summary: `Discord daily report skipped: ${businessDay.reason}.`,
        metadata: {
          today: todayString,
          reason: businessDay.reason,
          business_day: false,
        },
      },
      options.persist,
    );
  }

  const webhookConfigured = Boolean(process.env.DISCORD_WEBHOOK_URL?.trim());
  if (!webhookConfigured) {
    return persistResult(
      {
        batch_type: "daily_report",
        status: "skipped",
        target_date: targetDate,
        summary: "Discord daily report skipped: DISCORD_WEBHOOK_URL not configured.",
        metadata: {
          today: todayString,
          reason: "DISCORD_WEBHOOK_URL not configured",
          business_day: true,
        },
      },
      options.persist,
    );
  }

  const nightly = await loadNightlyReview(targetDate);
  const message = buildDailyReportMessage(targetDate, nightly);
  const sent = await sendDiscordMessage(message);

  if (!sent.ok) {
    return persistResult(
      {
        batch_type: "daily_report",
        status: "failed",
        target_date: targetDate,
        summary: `Discord daily report failed: ${sent.reason}.`,
        metadata: {
          today: todayString,
          reason: sent.reason,
          business_day: true,
          nightly,
        },
      },
      options.persist,
    );
  }

  return persistResult(
    {
      batch_type: "daily_report",
      status: "sent",
      target_date: targetDate,
      summary: `Discord daily report sent for ${targetDate}.`,
      metadata: {
        today: todayString,
        business_day: true,
        nightly,
      },
    },
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

function buildDailyReportMessage(targetDate: string, nightly: NightlyReviewSummary) {
  const warnings = nightly.warnings.length
    ? nightly.warnings.map((warning) => `- ${translateWarning(warning)}`).join("\n")
    : "- 감지된 경고 없음";

  return [
    "## ArchiveOS 일일 운영 보고",
    `대상일: ${targetDate}`,
    "",
    "**Runtime**",
    `- Inbox: ${nightly.queue.inbox}`,
    `- Processing: ${nightly.queue.processing}`,
    `- Outbox: ${nightly.queue.outbox}`,
    `- Reviews: ${nightly.queue.reviews}`,
    "",
    "**Latest**",
    `- Builder: ${nightly.latestBuilder?.status ?? "없음"} / ${nightly.latestBuilder?.task_id ?? "-"}`,
    `- Reviewer: ${nightly.latestReviewer?.verdict ?? "없음"} / ${nightly.latestReviewer?.reviewed_task_id ?? "-"}`,
    "",
    "**Warnings**",
    warnings,
    "",
    "**Decisions / Commands**",
    `- Decisions: ${nightly.decisions.count}`,
    `- Commands: ${nightly.commands.count}`,
  ].join("\n");
}

function translateWarning(value: string) {
  if (/usage limit/i.test(value)) return "Codex 사용량 제한으로 stop 상태가 감지되었습니다.";
  if (/processing task/i.test(value)) return "processing 작업이 있지만 구현자 프로세스가 감지되지 않았습니다.";
  if (/inbox has work/i.test(value)) return "inbox에 작업이 있지만 loop 프로세스가 감지되지 않았습니다.";
  if (/reviewer verdict is stop/i.test(value)) return "최신 reviewer verdict가 stop입니다.";
  return value;
}

async function persistResult(result: BatchResult, persist = true) {
  if (persist === false) {
    return result;
  }

  return recordBatchRun(result);
}
