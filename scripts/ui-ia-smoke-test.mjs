import { existsSync, readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf-8");
const appShell = read("src/app/AppShell.tsx");
const navigation = read("src/app/navigation.ts");
const styles = read("src/styles.css");
const api = read("src/lib/backendApi.ts");
const liveMesh = read("src/components/console/LiveMeshTopology.tsx");
const dashboard = read("src/pages/ConsoleDashboardPage.tsx");
const services = read("src/pages/ConsoleServicesPage.tsx");
const finance = read("src/pages/ConsoleFinancePage.tsx");
const workforce = read("src/pages/WorkforcePage.tsx");
const rpa = read("src/pages/RpaPage.tsx");
const knowledge = read("src/pages/KnowledgePage.tsx");
const knowledgeUi = read("src/components/knowledge/KnowledgeUi.tsx");
const knowledgePanel = read("src/components/knowledge/KnowledgeGraphPanel.tsx");
const operations = read("src/pages/ConsoleOperationsPage.tsx");
const agents = read("src/pages/AgentsPage.tsx");
const sidebar = read("src/components/shared/Sidebar.tsx");
const consoleSettings = read("src/pages/ConsoleSettingsPage.tsx");
const mcpRegistry = read("src/pages/McpRegistryPage.tsx");
const pageUtils = read("src/pages/pageUtils.ts");
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
for (const contract of ["operations.runtimeWorkforce.usedCapacity", "operations.runtimeWorkforce.effectiveCapacity", "외부 쓰기"]) {
  if (!services.includes(contract)) throw new Error(`Nested service metric/label contract missing: ${contract}`);
}
for (const contract of ["runtimeWorkforce.usedCapacity", "runtimeWorkforce.effectiveCapacity", "registeredSystemRole", "environmentLabel"]) {
  if (!services.includes(contract)) throw new Error(`Runtime workforce/external system display contract missing: ${contract}`);
}
if (!finance.includes("modeLabel(item.mode)")) throw new Error("Finance recommendation modes must use localized display labels.");
for (const contract of ["productivityLabel", "시뮬레이터 정지", "외부 쓰기 차단"]) {
  if (!workforce.includes(contract)) throw new Error(`Workforce display contract missing: ${contract}`);
}
for (const contract of ["roleLabel", "recommendationSeverityLabel", "합성 작업", "안전 모드 유지"]) {
  if (!workforce.includes(contract)) throw new Error(`Workforce localization contract missing: ${contract}`);
}
for (const contract of ["agentStatusLabel", "agentRoleLabel", "agentTaskLabel", "관리자 세션 전용"]) {
  if (!agents.includes(contract)) throw new Error(`Agent display contract missing: ${contract}`);
}
for (const contract of ["attentionTypeLabel", "incidentLabel"]) {
  if (!operations.includes(contract)) throw new Error(`Operations attention localization missing: ${contract}`);
}
for (const contract of ["platformHealthLabel", "import.meta.env.BASE_URL", "archiveos-mark.svg"]) {
  if (!sidebar.includes(contract)) throw new Error(`Sidebar public-base asset contract missing: ${contract}`);
}
if (!services.includes('"archive-logitics": "합성 물류·운송 운영"')) throw new Error("Legacy Logistics system ID must use the localized role label.");
for (const contract of ["protectedKeys", "권한 보호 항목", "공개 세션에서 보호됨", "roleLabel"]) {
  if (!consoleSettings.includes(contract)) throw new Error(`Settings public-protection display missing: ${contract}`);
}
for (const contract of ["const authPromise = getAuthSession()", '["auth", () => authPromise]', "(await authPromise).authenticated ? getMcpRegistry() : []", "(await authPromise).authenticated ? getPublicAccessStatus() : null", "(await authPromise).authenticated ? getSecurityStatus() : null"]) {
  if (!appShell.includes(contract)) throw new Error(`Settings protected-loader auth gate missing: ${contract}`);
}
for (const contract of ["MCP 도구 레지스트리", "운영자·PM·관리자 세션", "읽기 전용 도구 거버넌스"]) {
  if (!mcpRegistry.includes(contract)) throw new Error(`MCP registry localization missing: ${contract}`);
}
for (const contract of ["방금", "분 전", "시간 전", "알 수 없음"]) {
  if (!pageUtils.includes(contract)) throw new Error(`Korean time display contract missing: ${contract}`);
}
for (const contract of ["categoryLabel", "statusLabel", "riskLabel", "실행 제어", "승인됨", "높음"]) {
  if (!rpa.includes(contract)) throw new Error(`RPA localization contract missing: ${contract}`);
}
if (!appShell.includes("current.refreshedAt ? current")) throw new Error("Background refresh must preserve the loaded UI without resetting global loading state.");
for (const contract of ["Obsidian 그래프", "KnowledgeGraphPanel", "최근 RAG·지식 기록", "askRag"]) {
  if (!knowledge.includes(contract)) throw new Error(`Knowledge restoration contract missing: ${contract}`);
}
for (const contract of ["knowledgeNodeTypeLabel", "knowledgeEdgeTypeLabel", "knowledgeImportanceLabel", "knowledgeStateLabel", "방금", "일 전"]) {
  if (!knowledgeUi.includes(contract)) throw new Error(`Knowledge graph localization contract missing: ${contract}`);
}
for (const contract of ["knowledgeNodeTypeLabel", "knowledgeEdgeTypeLabel", "knowledgeStateLabel", "그래프 집중 필터"]) {
  if (!knowledgePanel.includes(contract)) throw new Error(`Knowledge graph panel display contract missing: ${contract}`);
}
for (const contract of [".settings-list>div", ".memory-chain-card", ".knowledge-graph-panel .panel-header"]) {
  if (!styles.includes(contract)) throw new Error(`Knowledge layout restoration missing: ${contract}`);
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
