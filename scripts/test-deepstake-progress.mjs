import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const snapshot = JSON.parse(readFileSync("public/deepstake-progress.json", "utf8"));
assert.equal(snapshot.schema, "deepstake-steam-progress-v1");
assert.equal(snapshot.scope, "steam-windows-pc");
assert.ok(Number.isFinite(Date.parse(snapshot.asOfUtc)));

const original = snapshot.original72;
assert.equal(original.total, 72, "Original scope must never be silently changed");
const statuses = ["completed", "in_progress", "unimplemented", "external"];
assert.equal(statuses.reduce((sum, status) => sum + original.historicalCounts[status], 0), 72);
if (original.items !== undefined) {
  assert.equal(original.items.length, 72, "Only real complete original criterion lists are accepted");
  assert.equal(new Set(original.items.map((item) => item.id)).size, 72);
  for (const item of original.items) assert.ok(statuses.includes(item.status));
}

const streams = snapshot.steamMvp.workstreams;
assert.equal(new Set(streams.map((stream) => stream.id)).size, streams.length);
assert.equal(streams.reduce((sum, stream) => sum + stream.weight, 0), 100);
for (const stream of streams) {
  assert.ok(stream.estimate >= 0 && stream.estimate <= 100);
  assert.ok(stream.weight > 0);
  if (stream.estimate > 0) assert.ok(stream.evidence.length > 0, "No estimate may lack evidence references");
}
const modeled = Math.round(streams.reduce((sum, stream) => sum + stream.weight * stream.estimate, 0) / 10) / 10;
assert.equal(snapshot.steamMvp.history.at(-1).estimate, modeled);
assert.equal(snapshot.verification.editorPassed, 30);
assert.equal(snapshot.verification.editorTotal, 30);
assert.equal(snapshot.verification.nativeStatus, "fail");
assert.equal(snapshot.verification.nativeExitCode, 1);
assert.ok(snapshot.gates.some((gate) => gate.id === "gpu-zero" && gate.status === "fail"));
assert.ok(snapshot.gates.some((gate) => gate.id === "gameplay" && gate.status === "fail"));

const dashboard = readFileSync("src/components/console/DeepStakeProgressBoard.tsx", "utf8");
const operations = readFileSync("src/pages/ConsoleOperationsPage.tsx", "utf8");
const overview = readFileSync("src/pages/ConsoleDashboardPage.tsx", "utf8");
for (const fragment of ["original72Mapped", "steamEstimate", "Steam Windows PC", "ds-stacked", "ds-workstream-chart"]) {
  assert.ok(dashboard.includes(fragment), `Dashboard missing ${fragment}`);
}
assert.ok(operations.includes("Steam 개발"));
assert.ok(overview.includes("<DeepStakeProgressBoard compact />"));
console.log(`Steam PC progress snapshot validated: historical72=72, modeled=${modeled}% (ESTIMATE only), native=FAIL`);
