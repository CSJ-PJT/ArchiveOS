import { readFileSync } from "node:fs";

const server = readFileSync("src/server.ts", "utf8");

for (const path of [
  "/api/batches/nightly-review/run",
  "/api/batches/daily-report/run",
  "/api/batches/recent",
  "/api/batches/latest",
  "/api/reports/daily/latest",
  "/api/reports/daily/recent",
  "/api/runtime/snapshots/recent",
]) {
  const routeIndex = server.lastIndexOf(`\"${path}\"`);
  if (routeIndex < 0) throw new Error(`Missing compatibility route: ${path}`);
  const routeBody = server.slice(routeIndex, routeIndex + 900);
  if (!routeBody.includes("proxyArchiveOsAi")) throw new Error(`Node route is not a Spring proxy: ${path}`);
}

for (const forbidden of ["runNightlyReviewBatch", "runDailyReportBatch"]) {
  if (server.includes(`import { ${forbidden}`)) throw new Error(`Node still imports migrated batch owner: ${forbidden}`);
}

console.log("spring migration proxy smoke-test passed");
