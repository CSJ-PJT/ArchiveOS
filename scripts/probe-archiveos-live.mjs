import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";

const origin = "https://archiveos.kr";
const paths = ["/", "/api/health", "/api/schedule/overview", "/deepstake-progress.json"];
const results = [];
const safeHash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 16);

for (const path of paths) {
  const url = new URL(path, origin);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      headers: { "user-agent": "ArchiveOS-Production-Parity-ReadOnly/1.0", accept: path.endsWith(".json") ? "application/json" : "*/*" },
    });
    const contentType = (response.headers.get("content-type") || "").split(";")[0].slice(0, 60);
    const length = Number(response.headers.get("content-length")) || null;
    const text = (await response.text()).slice(0, 512 * 1024);
    let validSnapshot = false;
    if (path === "/deepstake-progress.json" && contentType === "application/json") {
      try {
        const obj = JSON.parse(text);
        validSnapshot = obj?.schema === "deepstake-steam-progress-v1" &&
          obj?.scope === "steam-windows-pc" && obj?.original72?.total === 72;
      } catch { /* Never label malformed/stale files as deployed. */ }
    }
    results.push({ path, status: response.status, contentType, length: length ?? text.length,
      sha256Prefix: safeHash(text), validSnapshot, reachable: true });
  } catch (e) {
    results.push({ path, reachable: false, status: null, contentType: "", length: null,
      sha256Prefix: "", validSnapshot: false, error: e instanceof Error ? e.name : "unknown" });
  }
}

const report = [
  "# ArchiveOS public production fingerprint (read-only)",
  "",
  "| Path | Reachable | HTTP | Content type | Bytes (observed/declared) | SHA256 prefix | Steam JSON validated |",
  "| --- | --- | --- | --- | ---: | --- | --- |",
  ...results.map(r => `| \`${r.path}\` | ${r.reachable ? "yes" : "no"} | ${r.status ?? "-"} | ${r.contentType || "-"} | ${r.length ?? "-"} | ${r.sha256Prefix || "-"} | ${r.validSnapshot ? "YES" : "no"} |`),
  "",
  "This job never authenticates, executes server commands, modifies a service, or deploys. A valid JSON endpoint by itself does not prove the dashboard UI is updated.",
].join("\n");
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n");
