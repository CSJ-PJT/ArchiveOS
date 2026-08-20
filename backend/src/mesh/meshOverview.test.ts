import assert from "node:assert/strict";
import { getOperationalArchitectureReview, resolveWithin } from "./meshOverview.js";

const immediate = await resolveWithin(Promise.resolve("live"), "fallback", 50);
assert.equal(immediate, "live");

const rejected = await resolveWithin(Promise.reject(new Error("offline")), "fallback", 50);
assert.equal(rejected, "fallback");

const started = Date.now();
const timedOut = await resolveWithin(new Promise<string>(() => undefined), "fallback", 25);
assert.equal(timedOut, "fallback");
assert.ok(Date.now() - started < 250, "timeout fallback must stay bounded");

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(JSON.stringify({
  data: {
    id: "review-local-1",
    target_type: "task",
    target_ref: "TASK-1",
    status: "reviewed",
    summary: "단건 검토 완료",
    findings: [],
    recommendations: [],
    related_nodes: [],
    created_at: "2026-08-20T00:00:00Z",
  },
}), { status: 200, headers: { "Content-Type": "application/json" } });
try {
  const localReview = await getOperationalArchitectureReview();
  assert.equal(localReview?.id, "review-local-1");
  assert.equal(localReview?.summary, "단건 검토 완료");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("meshOverview timeout regression passed");
