import "dotenv/config";
import { runDailyReportBatch } from "./dailyReport.js";
import { runNightlyReviewBatch } from "./nightlyReview.js";

const batchName = process.argv[2];

if (batchName !== "nightly-review" && batchName !== "daily-report") {
  console.error("Usage: tsx src/batches/runBatch.ts <nightly-review|daily-report>");
  process.exit(1);
}

const result =
  batchName === "nightly-review"
    ? await runNightlyReviewBatch()
    : await runDailyReportBatch();

console.log(JSON.stringify(result, null, 2));
