import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.resolve(rootDir, "docs", "screenshots");
const baseUrl = process.env.ARCHIVEOS_SCREENSHOT_BASE_URL ?? "http://localhost:5173";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadPuppeteer() {
  const searchPaths = [process.env.PUPPETEER_NODE_PATH, path.resolve(rootDir, "node_modules")].filter(Boolean);
  const resolved = require.resolve("puppeteer", { paths: searchPaths });
  return (await import(pathToFileURL(resolved).href)).default;
}

async function clickByText(page, text) {
  await page.evaluate((needle) => {
    const candidates = Array.from(document.querySelectorAll("button, a"));
    const target = candidates.find((node) => (node.textContent || "").toLowerCase().includes(needle.toLowerCase()));
    if (target instanceof HTMLElement) target.click();
  }, text);
  await wait(1600);
}

async function capturePage(page, routeLabel, fileName, actionLabel = null) {
  await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 30000 });
  if (routeLabel) await clickByText(page, routeLabel);
  if (actionLabel) await clickByText(page, actionLabel);
  await page.screenshot({ path: path.join(outputDir, fileName), fullPage: true });
}

async function captureUrl(page, url, fileName) {
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  await page.screenshot({ path: path.join(outputDir, fileName), fullPage: true });
}

const apiTargets = [
  ["http://localhost:8080/api/outbox/summary", "api-01-nexus-outbox-summary.png"],
  ["http://localhost:8092/api/routes/summary", "api-02-logistics-routes-summary.png"],
  ["http://localhost:18080/api/operations/summary", "api-03-ledger-operations-summary.png"],
  ["http://localhost:18080/api/reconciliation/summary", "api-04-ledger-reconciliation-summary.png"],
  [`${baseUrl}/api/ecosystem/summary`, "api-05-archiveos-ecosystem-summary.png"],
  [`${baseUrl}/api/ecosystem/topology`, "api-06-archiveos-topology.png"],
];

await fs.mkdir(outputDir, { recursive: true });
const puppeteer = await loadPuppeteer();
const browser = await puppeteer.launch({
  headless: "shell",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });

  await capturePage(page, "Ecosystem", "archiveos-01-ecosystem-overview.png");
  await capturePage(page, "Ecosystem", "archiveos-02-service-registry.png");
  await capturePage(page, "Ecosystem", "archiveos-03-topology.png");
  await capturePage(page, "Ledger Approvals", "archiveos-04-ledger-approval-queue.png");
  await capturePage(page, "Ledger Approvals", "archiveos-05-callback-outbox.png");
  await capturePage(page, "Ledger Approvals", "archiveos-06-policy-evidence.png");
  await capturePage(page, "Ecosystem", "archiveos-07-safe-mode-demo.png", "Demo dry-run");

  for (const [url, fileName] of apiTargets) {
    try {
      await captureUrl(page, url, fileName);
    } catch (error) {
      await fs.writeFile(path.join(outputDir, `${fileName}.error.txt`), `${url}\n${String(error)}\n`, "utf8");
    }
  }
} finally {
  await browser.close();
}
