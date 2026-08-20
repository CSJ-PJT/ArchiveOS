import { existsSync, readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf-8");
const appShell = read("src/app/AppShell.tsx");
const navigation = read("src/app/navigation.ts");
const styles = read("src/styles.css");
const api = read("src/lib/backendApi.ts");
const liveMesh = read("src/components/console/LiveMeshTopology.tsx");
const dashboard = read("src/pages/ConsoleDashboardPage.tsx");
const services = read("src/pages/ConsoleServicesPage.tsx");
const knowledge = read("src/pages/KnowledgePage.tsx");
const operations = read("src/pages/ConsoleOperationsPage.tsx");
const i18n = read("src/i18n/I18nProvider.tsx");

for (const label of ["대시보드", "서비스", "운영", "재무", "기록", "설정"]) {
  if (!navigation.includes(`label: "${label}"`)) throw new Error(`Missing Console V3 navigation label: ${label}`);
}
if ((navigation.match(/\{ id: "/g) ?? []).length !== 6) throw new Error("Console V3 must expose exactly six top-level navigation items.");
for (const route of ["overview", "liveflow", "ecosystem", "agents", "approvals", "history", "mcp"]) {
  if (!navigation.includes(`${route}:`)) throw new Error(`Legacy redirect missing: ${route}`);
}
for (const contract of ["getEcosystemSummary", "getLiveFlowSummary", "getLiveFlowTopology", "getLiveFlowRecentEvents", "liveFlowStreamUrl", "getEcosystemBalanceSummary"]) {
  if (!api.includes(contract)) throw new Error(`Console V3 API contract missing: ${contract}`);
}
for (const contract of ["EventSource", "runtime-event", "fallback", "getLiveFlowRecentEvents(30)", "reconnectAttempt", "30_000", "eventIds.current.size > 750", "window.addEventListener(\"online\""]) {
  if (!appShell.includes(contract)) throw new Error(`Live Flow SSE contract missing: ${contract}`);
}
if (!/route === "records"[^\n]+\["aiRuntime", getAiRuntime\]/.test(appShell)) {
  throw new Error("Records knowledge view must load Spring AI runtime metrics.");
}
for (const contract of ["archiveos.refresh.seconds", "자동 새로고침 간격", "getManagedSystemsOverview", "getRecentRuntimeEvents", "getRecentCommands", "getKpiOverview"]) {
  if (!appShell.includes(contract)) throw new Error(`Restored console contract missing: ${contract}`);
}
for (const contract of ["라이브 토폴로지 상세", "LiveFlowPage"]) {
  if (!dashboard.includes(contract)) throw new Error(`Dashboard topology detail contract missing: ${contract}`);
}
for (const contract of ["integrationConnectors", "등록 시스템", "역량 사용률", "시뮬레이터 정지"]) {
  if (!services.includes(contract)) throw new Error(`Service integration/metric contract missing: ${contract}`);
}
for (const contract of ["Obsidian 그래프", "KnowledgeGraphPanel", "최근 RAG·지식 기록", "askRag"]) {
  if (!knowledge.includes(contract)) throw new Error(`Knowledge restoration contract missing: ${contract}`);
}
if (!operations.includes('items={[["batch", "배치 작업"], ["rpa", "RPA 검토"]]}')) throw new Error("Automation must restore separate Batch and RPA tabs.");
for (const contract of ["Archive-Market", "Archive-Nexus", "Archive-Logistics", "Archive-Ledger", "ArchiveOS", "Settlement", "events.slice(0, 30)"]) {
  if (!liveMesh.includes(contract)) throw new Error(`Mesh topology contract missing: ${contract}`);
}
for (const contract of ["nodeEventMetric", "state?.lastEventAt", "최근 창 0건", "최근 수신 대기"]) {
  if (!liveMesh.includes(contract)) throw new Error(`Mesh zero-window/runtime distinction missing: ${contract}`);
}
if (liveMesh.includes(': "이벤트 없음"')) throw new Error("Mesh nodes must not label a finite event window as globally empty.");
if (appShell.includes("MutationObserver")) throw new Error("DOM MutationObserver translation must not remain in AppShell.");
for (const contract of ["I18nProvider", "archive.locale", "setLocale"]) {
  if (!i18n.includes(contract)) throw new Error(`I18n provider contract missing: ${contract}`);
}
for (const token of [".console-kpi-grid", ".live-mesh", ".mesh-canvas", ".language-popover", "@media (max-width:640px)"]) {
  if (!styles.includes(token)) throw new Error(`Console V3 responsive style missing: ${token}`);
}
for (const doc of ["docs/console-v3-audit.md", "docs/console-v3-information-architecture.md", "docs/console-v3-realtime-sse.md", "docs/console-v3-performance.md", "docs/ecosystem-balance-policy.md", "docs/cross-service-balance-actions.md"]) {
  if (!existsSync(doc)) throw new Error(`Console V3 documentation missing: ${doc}`);
}
console.log("archiveos console-v3 information architecture smoke-test passed");
