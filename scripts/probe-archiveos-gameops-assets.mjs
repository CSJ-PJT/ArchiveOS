import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";

const origin = "https://archiveos.kr";
const needles = {
  existingGameOps: ["DEVELOPMENT / RELEASE", "전체 목표 구현률", "원본 기준 부재", "소스 2,355개", "독립 플레이 E2E"],
  newDashboard: ["Steam PC MVP", "Steam Windows PC 작업영역별 추정", "9개 작업영역", "원본 72건 상태 분포", "ds-workstream-chart", "deepstake-steam-progress-v1"],
};
const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 16);
const fetchText = async (path) => {
  const url = new URL(path, origin);
  if (url.origin !== origin || !url.pathname.startsWith("/")) throw new Error("Only same-origin public static assets");
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(16000),
    headers: { accept: "text/html,application/javascript,text/javascript,*/*", "user-agent": "ArchiveOS-UI-Parity-ReadOnly/1.0" },
  });
  if (!response.ok || !(response.headers.get("content-type") || "").match(/javascript|text\/html/)) throw new Error("No public JS/HTML for "+path);
  const sizeLimit = 10 * 1024 * 1024;
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > sizeLimit) throw new Error("Static asset exceeds safe cap "+path);
  return { content: new TextDecoder("utf-8").decode(bytes), type: response.headers.get("content-type") || "", size: bytes.byteLength };
};

const root = await fetchText("/");
const refs = new Set();
for (const match of root.content.matchAll(/(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css))["']/g)) refs.add(match[1]);
const results = [{ path: "/", hash: hash(root.content), bytes: root.size, ...classify(root.content) }];
let entryRefs = [...refs].filter((p) => p.endsWith(".js")).slice(0, 4);
const textByAsset = new Map();
for (const path of entryRefs) {
  try {
    const file = await fetchText(path);
    textByAsset.set(path, file.content);
    results.push({ path, hash: hash(file.content), bytes: file.size, ...classify(file.content) });
  } catch (e) {
    results.push({ path, error: e instanceof Error ? e.message : "Failed" });
  }
}
const chunks = new Set();
for (const value of textByAsset.values()) {
  for (const match of value.matchAll(/["']([./]?(?:assets\/)?[A-Za-z0-9._/-]+\.js)["']/g)) {
    let p = match[1].startsWith("/") ? match[1] : match[1].startsWith("./") ? "/assets/" + match[1].slice(2) : match[1].startsWith("assets/") ? "/" + match[1] : "/assets/" + match[1];
    if (p.includes("..") || p.length > 130) continue;
    chunks.add(p);
  }
}
for (const path of [...chunks].filter(p=> !textByAsset.has(p)).slice(0, 12)) {
  try {
    const file = await fetchText(path);
    results.push({ path, hash: hash(file.content), bytes: file.size, ...classify(file.content) });
  } catch { /* Optional lazy chunk unavailable. No conclusion from that path. */ }
}
function classify(text) {
  const out = {};
  for (const [type, words] of Object.entries(needles)) out[type] = words.filter(w => text.includes(w));
  return out;
}

const routesAndPanels = [];
for (const [path, content] of textByAsset) {
  for (const phrase of ["DEVELOPMENT / RELEASE", "전체 목표 구현률", "원본 기준 부재", "Steam Windows PC 작업영역별 추정", "Steam 개발"]) {
    const at = content.indexOf(phrase);
    if (at >= 0) {
      const surrounding = content.slice(Math.max(0, at - 175), Math.min(content.length, at + phrase.length + 200))
        .replace(/[\\r\\n|]/g, " ").replace(/https?:\\/\\/[^"'`\\s]+/g, "[url]");
      routesAndPanels.push({ path, phrase, surrounding });
    }
  }
}

const existing = [...new Set(results.flatMap(r => r.existingGameOps || []))];
const modern = [...new Set(results.flatMap(r => r.newDashboard || []))];
const report = [
  "# OCI actual static bundle inspection (read-only)",
  "",
  "This checks actual public HTML and reachable entry/lazy JavaScript, not GitHub repo code or the browser cache.",
  "",
  "| File | Size | SHA256 prefix | GameOps legacy markers | PR #17 dashboard markers |",
  "| --- | ---: | --- | --- | --- |",
  ...results.map(r => `| \`${r.path.replaceAll("|", "")}\` | ${r.bytes ?? "not read"} | ${r.hash ?? "-"} | ${(r.existingGameOps||[]).join(", ")||"-"} | ${(r.newDashboard||[]).join(", ")||"-"} |`),
  "",
  `Existing GameOps marker set detected: ${existing.length}/${needles.existingGameOps.length}`,
  `New PR #17 marker set detected: ${modern.length}/${needles.newDashboard.length}`,
  "",
  "",
  "## Static bundle context around matched headings (limited public text)",
  ...routesAndPanels.map(x => `- \`${x.phrase}\` in \`${x.path}\`: \`${x.surrounding.replaceAll("`", "'")}\``),
  "",
  "A missing marker in downloaded assets does not prove absence from unrequested lazy chunks. A visible GameOps page is confirmed only by the user/browser. This job never deploys or changes runtime.",
].join("\n");
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n");
