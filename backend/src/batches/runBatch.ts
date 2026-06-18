import "dotenv/config";
import { runDailyReportBatch } from "./dailyReport.js";
import { runNightlyReviewBatch } from "./nightlyReview.js";
import { runSupabaseKeepAliveBatch } from "./supabaseKeepAlive.js";

const batchName = process.argv[2];

if (batchName !== "nightly-review" && batchName !== "daily-report" && batchName !== "supabase-keepalive") {
  console.error("Usage: tsx src/batches/runBatch.ts <nightly-review|daily-report|supabase-keepalive>");
  process.exit(1);
}

const result =
  batchName === "nightly-review"
    ? await runNightlyReviewBatch()
    : batchName === "daily-report"
      ? await runDailyReportBatch()
      : await runSupabaseKeepAliveBatch();

console.log(JSON.stringify(result, null, 2));
