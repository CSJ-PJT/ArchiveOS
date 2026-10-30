/**
 * Publishes a SANITIZED, read-only Steam PC development snapshot.
 * Does not run the game, write ArchiveOS API state, read user saves or infer original72 rows.
 *
 * node scripts/sync-deepstake-progress.mjs --result <one canonical MAIN result.json>
 * node scripts/sync-deepstake-progress.mjs --review <approved workstream review.json>
 * node scripts/sync-deepstake-progress.mjs --original72 <recovered original72 rows.json>
 *
 * All three options are optional separately; at least one is required.
 * This does not deploy. Review output and publish through the normal PR/release process.
 */
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { createHash } from "node:crypto";

const target = resolve("public/deepstake-progress.json");
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  const name = args[i];
  const value = args[i + 1];
  if (!["--result", "--review", "--original72"].includes(name) || !value || value.startsWith("--")) throw new Error("Supported options: --result, --review, --original72");
  if (options[name]) throw new Error(`Duplicate option: ${name}`);
  options[name] = value;
}
if (Object.keys(options).length === 0) throw new Error("Specify at least one verified source");
const snapshot = JSON.parse(readFileSync(target, "utf8"));
if (snapshot.schema !== "deepstake-steam-progress-v1" || snapshot.scope !== "steam-windows-pc") throw new Error("Wrong target schema");
const taskIdPattern = /^DS-[A-Z0-9-]{8,140}$/i;
const statuses = new Set(["completed", "in_progress", "unimplemented", "external"]);
const gateStatuses = new Set(["pass", "partial", "fail", "not_run", "blocked"]);
const stamp = (value) => {
  const n = Date.parse(value);
  if (!Number.isFinite(n)) throw new Error("Missing or invalid timestamp");
  return new Date(n).toISOString();
};
const num = (n) => Number.isFinite(n) && n >= 0;
const safe = (value) => typeof value === "string" ? value.slice(0, 500).replace(/[\r\n<>]/g, " ") : "";

if (options["--original72"]) {
  const recovered = JSON.parse(readFileSync(resolve(options["--original72"]), "utf8"));
  if (recovered.schema !== "deepstake-original72-authoritative-v1" || !Array.isArray(recovered.items) || recovered.items.length !== 72) {
    throw new Error("An original 72 item ledger, not inferred placeholders, is required");
  }
  const ids = new Set();
  for (const row of recovered.items) {
    if (!row || typeof row.id !== "string" || !/^[a-z0-9][a-z0-9._-]{1,99}$/i.test(row.id) ||
        ids.has(row.id) || !statuses.has(row.status)) throw new Error("Invalid or duplicate original item ID/status");
    ids.add(row.id);
  }
  if (!recovered.source || typeof recovered.source !== "string" || recovered.source.trim().length < 5) throw new Error("Original 72 source receipt required");
  snapshot.original72.items = recovered.items.map((row) => ({
    id: row.id, status: row.status,
    title: safe(row.title).slice(0, 120), evidenceRef: safe(row.evidenceRef).slice(0, 120),
  }));
  snapshot.original72.source = `Authoritative 72-item ledger: ${safe(recovered.source).slice(0, 180)}`;
  // Historical report stays immutable even after per-item mapping is recovered.
}

if (options["--result"]) {
  const path = resolve(options["--result"]);
  const result = JSON.parse(readFileSync(path, "utf8"));
  if (!taskIdPattern.test(result.taskId || "")) throw new Error("Not a canonical DeepStake task result");
  const when = stamp(result.completedAtUtc || result.completedAt || "");
  if (Date.parse(when) <= Date.parse(snapshot.asOfUtc)) throw new Error("Result is not newer than the published snapshot; not overwriting newer evidence");
  const results = Array.isArray(result.native) ? result.native : result.native?.runs || [];
  const lastNative = results.at(-1) || {};
  const nativeExit = lastNative.exit?.ExitCode ?? lastNative.exit?.exitCode ?? lastNative.exitCode ?? null;
  const nativePid = lastNative.process?.Pid ?? lastNative.pid ?? null;
  const test = result.tests || {};
  const testTotal = test.total ?? null;
  const testPassed = test.passed ?? null;
  const hasTestCounts = Number.isInteger(testTotal) && Number.isInteger(testPassed) && testTotal >= 0 && testPassed >= 0 && testPassed <= testTotal;
  const nativeStatus = nativeExit === 0 ? "partial" : nativeExit === 1 ? "fail" : "not_run";
  const lastFailure = safe(lastNative.failure || result.firstFailure?.actualNativeException || result.native?.failure || "");
  const taskId = result.taskId;
  const digest = createHash("sha256").update(taskId + when).digest("hex").slice(0, 12);
  const label = `${taskId} · ${hasTestCounts ? `EditMode ${testPassed}/${testTotal}` : "tests 미확인"} · Native ${nativeExit === null ? "미실행" : `exit ${nativeExit}`}`;
  const evidenceName = basename(path);
  const entry = { id: `result-${digest}`, atUtc: when, label: safe(label), status: nativeStatus, evidence: evidenceName };
  snapshot.events = [entry, ...snapshot.events.filter((x) => x.id !== entry.id)].sort((a, b) => Date.parse(b.atUtc) - Date.parse(a.atUtc)).slice(0, 40);
  snapshot.verification = {
    ...snapshot.verification,
    suite: hasTestCounts ? `새 결과: ${taskId}` : "새 결과에 관련 XML 집계 없음",
    editorPassed: hasTestCounts ? testPassed : snapshot.verification.editorPassed,
    editorTotal: hasTestCounts ? testTotal : snapshot.verification.editorTotal,
    nativePid: Number.isInteger(nativePid) ? nativePid : null,
    nativeExitCode: Number.isInteger(nativeExit) ? nativeExit : null,
    nativeStatus,
    nativeFailure: lastFailure || (nativeExit === 0 ? "이 실행의 Native 프로세스는 종료 0. 전체 E2E와 출시 게이트는 별도 검증 필요." : "Native 원인 증거 추가 확인 필요."),
    isIndependentQA: false,
  };
  // A successful test or process exit is NEVER allowed to auto-promote full E2E,
  // the original72 ledger, workstream scores, GPU privacy or Steam release.
  if (nativeStatus === "fail") {
    const targetGate = snapshot.gates.find((g) => g.id === "gameplay");
    if (targetGate) { targetGate.status = "fail"; targetGate.detail = `최근 Native 미통과: ${lastFailure || "세부 로그 확인 필요"}`; targetGate.evidence = evidenceName; }
  }
  snapshot.asOfUtc = when;
  snapshot.sourceLabel = `최신 MAIN 결과 ${taskId} · ${evidenceName} (원본 전체 데이터는 게시하지 않음)`;
}

if (options["--review"]) {
  const review = JSON.parse(readFileSync(resolve(options["--review"]), "utf8"));
  if (review.schema !== "deepstake-steam-review-v1" || !review.reviewer || !review.source) throw new Error("Human-reviewed source and reviewer required");
  const when = stamp(review.reviewedAtUtc);
  if (Date.parse(when) < Date.parse(snapshot.asOfUtc)) throw new Error("Older review cannot overwrite newer source");
  if (!Array.isArray(review.workstreams) || review.workstreams.length !== snapshot.steamMvp.workstreams.length) throw new Error("Full workstream reevaluation required");
  const updates = new Map(review.workstreams.map((x) => [x.id, x]));
  for (const w of snapshot.steamMvp.workstreams) {
    const next = updates.get(w.id);
    if (!next || next.weight !== w.weight || !num(next.estimate) || next.estimate > 100 ||
      !gateStatuses.has(next.gate) || (next.estimate > 0 && (!Array.isArray(next.evidence) || next.evidence.length === 0))) {
      throw new Error(`Unreviewed/unsupported workstream ${w.id}`);
    }
    w.estimate = next.estimate; w.gate = next.gate;
    w.note = safe(next.note); w.evidence = next.evidence.map((e) => safe(e).slice(0, 160));
  }
  const estimate = Math.round(snapshot.steamMvp.workstreams.reduce((sum, w) => sum + w.estimate * w.weight, 0) / 10) / 10;
  snapshot.steamMvp.history.push({ atUtc: when, estimate, source: `review: ${safe(review.source).slice(0, 150)}` });
  snapshot.steamMvp.history = snapshot.steamMvp.history.slice(-120);
  snapshot.asOfUtc = when;
  snapshot.sourceLabel = `MVP 가중 진척 재검토: ${safe(review.source).slice(0, 160)}`;
}

const aggregate = snapshot.original72.historicalCounts;
if (["completed", "in_progress", "unimplemented", "external"].reduce((sum, key) => sum + aggregate[key], 0) !== 72) {
  throw new Error("Historical72 counts must remain consistent");
}
if (snapshot.original72.items && new Set(snapshot.original72.items.map((x) => x.id)).size !== 72) throw new Error("Original 72 IDs must be unique");
if (snapshot.steamMvp.workstreams.reduce((sum, w) => sum + w.weight, 0) !== 100) throw new Error("Steam MVP weight total must stay 100");
const tmp = target + ".next";
writeFileSync(tmp, JSON.stringify(snapshot, null, 2) + "\n", { encoding: "utf8", flag: "w" });
renameSync(tmp, target);
console.log(`Sanitized snapshot prepared: ${target}. Review diff and open PR; no deployment attempted.`);
