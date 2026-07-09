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

for (const path of [
  "/api/approvals/external",
  "/api/approvals/external/:id",
  "/api/approvals/external/:id/approve",
  "/api/approvals/external/:id/reject",
  "/api/approvals/external/:id/hold",
]) {
  const routeIndex = server.lastIndexOf(`"${path}"`);
  if (routeIndex < 0) throw new Error(`Missing external approval compatibility route: ${path}`);
  const routeBody = server.slice(routeIndex, routeIndex + 700);
  if (!routeBody.includes("relayArchiveOsAi")) throw new Error(`External approval route is not a Spring proxy: ${path}`);
}

if (!server.includes("approvals\\/external\\/[^/]+\\/(approve|reject|hold)")) {
  throw new Error("External approval PM decision routes are not included in the Node CUD guard allow-list.");
}

for (const path of [
  "/api/ecosystem/services",
  "/api/ecosystem/summary",
  "/api/ecosystem/topology",
  "/api/ecosystem/refresh",
  "/api/ecosystem/demo/dry-run",
  "/api/integrations/nexus/outbox",
  "/api/integrations/logitics/summary",
  "/api/integrations/ledger/summary",
  "/api/approvals/callbacks",
  "/api/approvals/callbacks/retry-failed",
]) {
  const routeIndex = server.lastIndexOf(`"${path}"`);
  if (routeIndex < 0) throw new Error(`Missing ecosystem compatibility route: ${path}`);
  const routeBody = server.slice(routeIndex, routeIndex + 700);
  if (!routeBody.includes("relayArchiveOsAi")) throw new Error(`Ecosystem route is not a Spring proxy: ${path}`);
}

for (const forbidden of ["runNightlyReviewBatch", "runDailyReportBatch"]) {
  if (server.includes(`import { ${forbidden}`)) throw new Error(`Node still imports migrated batch owner: ${forbidden}`);
}

for (const path of [
  "/api/knowledge/health",
  "/api/knowledge/overview",
  "/api/knowledge/recent",
  "/api/knowledge/search",
  "/api/knowledge/related",
  "/api/knowledge/graph",
  "/api/knowledge/map",
  "/api/knowledge/graph/insights",
  "/api/knowledge/map/insights",
  "/api/knowledge/node/:id",
]) {
  const routeIndex = server.indexOf(`app.get("${path}"`);
  if (routeIndex < 0) throw new Error(`Missing Knowledge compatibility route: ${path}`);
  const routeBody = server.slice(routeIndex, routeIndex + 700);
  if (!routeBody.includes("relayArchiveOsAi")) throw new Error(`Knowledge route is not a Spring proxy: ${path}`);
}

for (const forbidden of ["getKnowledgeOverview", "getKnowledgeGraph", "getKnowledgeGraphInsights", "searchKnowledge"]) {
  if (server.includes(`  ${forbidden},`)) throw new Error(`Node still imports migrated Knowledge read owner: ${forbidden}`);
}

console.log("spring migration proxy smoke-test passed");
