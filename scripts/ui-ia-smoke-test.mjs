import { existsSync, readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf-8");
const appShell = read("src/app/AppShell.tsx");
const navigation = read("src/app/navigation.ts");
const styles = read("src/styles.css");
const api = read("src/lib/backendApi.ts");
const liveMesh = read("src/components/console/LiveMeshTopology.tsx");
const liveFlowPage = read("src/pages/LiveFlowPage.tsx");
const dashboard = read("src/pages/ConsoleDashboardPage.tsx");
const services = read("src/pages/ConsoleServicesPage.tsx");
const finance = read("src/pages/ConsoleFinancePage.tsx");
const workforce = read("src/pages/WorkforcePage.tsx");
const rpa = read("src/pages/RpaPage.tsx");
const knowledge = read("src/pages/KnowledgePage.tsx");
const knowledgeUi = read("src/components/knowledge/KnowledgeUi.tsx");
const knowledgePanel = read("src/components/knowledge/KnowledgeGraphPanel.tsx");
const knowledgeGraph = read("src/components/knowledge/KnowledgeGraphSvg.tsx");
const knowledgeUtils = read("src/components/knowledge/knowledgeGraphUtils.ts");
const records = read("src/pages/ConsoleRecordsPage.tsx");
const pagination = read("src/components/shared/Pagination.tsx");
const operations = read("src/pages/ConsoleOperationsPage.tsx");
const agents = read("src/pages/AgentsPage.tsx");
const workflows = read("src/pages/WorkflowsPage.tsx");
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
for (const contract of ["EventSource", "runtime-event", "fallback", "getLiveFlowRecentEvents(30)", "reconnectAttempt", "30_000", "mergeLiveFlowEvents", "window.addEventListener(\"online\""]) {
  if (!appShell.includes(contract)) throw new Error(`Live Flow SSE contract missing: ${contract}`);
}
if (!/route === "records"[^\n]+\["aiRuntime", getAiRuntime\]/.test(appShell)) {
  throw new Error("Records knowledge view must load Spring AI runtime metrics.");
}
for (const contract of ["archiveos.refresh.seconds", "자동 새로고침 간격", "getManagedSystemsOverview", "getRecentRuntimeEvents", "getRecentCommands", "getKpiOverview"]) {
  if (!appShell.includes(contract)) throw new Error(`Restored console contract missing: ${contract}`);
}
for (const contract of ["REFRESH_PREFERENCE_VERSION", 'storedValue === "10"', "? stored : 5", "refreshGeneration", "refreshInFlight", "active?.route === route", "window.setTimeout", "result.key !== \"auth\"", "getLiveFlowRecentEvents(30)"]) {
  if (!appShell.includes(contract)) throw new Error(`Five-second progressive dashboard contract missing: ${contract}`);
}
for (const contract of ["mergeLiveFlowEvents", "MAX_LIVE_FLOW_EVENTS", "loadDashboardDetails", "getLiveFlowRecentEvents(MAX_LIVE_FLOW_EVENTS)", "getWorkforceOverview", "streamConnected", "fallbackInFlight", "routeEpoch", "newestEventTime"]) {
  if (!appShell.includes(contract)) throw new Error(`Race-safe live-flow/lazy-detail contract missing: ${contract}`);
}
for (const contract of ["mergeLiveFlowSummary(current.liveFlow, payload)", "approvalBacklog: incoming.approvalBacklog ?? current.approvalBacklog", "processingBacklog: incoming.processingBacklog ?? current.processingBacklog", "services: incoming.runtime.services ?? current.runtime?.services"]) {
  if (!appShell.includes(contract)) throw new Error(`SSE summary must preserve polled runtime/backlog detail: ${contract}`);
}
if (appShell.includes("liveFlow: payload")) throw new Error("Compact SSE snapshots must not replace the detailed live-flow summary.");
if (appShell.includes("window.setInterval(() => { void refresh()")) throw new Error("Dashboard polling must schedule only after the prior refresh completes.");
if (appShell.includes("liveFlowEvents: events")) throw new Error("Live-flow polling must merge events instead of replacing newer stream data.");
if ((appShell.match(/mergeLiveFlowEvents\(/g) ?? []).length < 4) throw new Error("Every live-flow event ingress path must use the shared merge policy.");
const dashboardLoader = appShell.match(/if \(route === "dashboard"\) return \[([^\n]+)\];/)?.[1] ?? "";
if (dashboardLoader.includes("getWorkforceOverview") || dashboardLoader.includes("MAX_LIVE_FLOW_EVENTS")) throw new Error("Initial dashboard loading must keep workforce and full event history lazy.");
for (const contract of ["라이브 토폴로지 상세", "LiveFlowPage", "onLoadTopologyDetails", "refreshTopology"]) {
  if (!dashboard.includes(contract)) throw new Error(`Dashboard topology detail contract missing: ${contract}`);
}
for (const contract of ["integrationConnectors", "등록 시스템", "역량 사용률", "시뮬레이터 정지"]) {
  if (!services.includes(contract)) throw new Error(`Service integration/metric contract missing: ${contract}`);
}
for (const contract of ["Atlas Platform", "ATLAS PROJECT", "latestAtlasCheck", "Atlas 읽기 전용 health"]) {
  if (!services.includes(contract)) throw new Error(`Atlas project integration contract missing: ${contract}`);
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
for (const contract of ["displayTaskTitle", "replacementMarkers >= 2", "운영 작업"]) {
  if (!workflows.includes(contract)) throw new Error(`Workflow replacement-character display guard missing: ${contract}`);
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
for (const contract of ["hoveredNodeId", "hoverEdgeIds", "onMouseEnter", "graph-hover-card", 'role="button"']) {
  if (!knowledgeGraph.includes(contract)) throw new Error(`Knowledge graph hover contract missing: ${contract}`);
}
for (const contract of ["buildConnectedMemoryChains", 'kind: "memory"', "chainNodes.length < 2", "memory-chain-"]) {
  if (!knowledgeUtils.includes(contract)) throw new Error(`Truthful active memory chain contract missing: ${contract}`);
}
for (const contract of [".settings-list>div", ".memory-chain-card", ".knowledge-graph-panel .panel-header"]) {
  if (!styles.includes(contract)) throw new Error(`Knowledge layout restoration missing: ${contract}`);
}
if (!operations.includes('items={[["batch", "배치 작업"], ["rpa", "RPA 검토"]]}')) throw new Error("Automation must restore separate Batch and RPA tabs.");
for (const contract of ["Archive-Market", "Archive-Nexus", "Archive-Logistics", "Archive-Ledger", "ArchiveOS", "Settlement", "events.slice(0, 30)"]) {
  if (!liveMesh.includes(contract)) throw new Error(`Mesh topology contract missing: ${contract}`);
}
for (const contract of ["nodeEventMetric", "state?.recentThroughput", "현재 처리", "mesh-edge-time-badge", "segment.fromX", "segment.toX"]) {
  if (!liveMesh.includes(contract)) throw new Error(`Mesh processing/direction contract missing: ${contract}`);
}
for (const contract of ["detail-flow-arrow-", "markerEnd", "flowEdgePath", "parallelEdges", "parallelIndex", "parallelOffset", "mesh-flow-edge", "현재 처리"]) {
  if (!liveFlowPage.includes(contract)) throw new Error(`Detailed topology arrow contract missing: ${contract}`);
}
for (const contract of [".mesh-edge-time-badge", ".polished-live-flow .mesh-edge-layer .mesh-flow-edge", "fill:none", "font-variant-numeric:tabular-nums"]) {
  if (!styles.includes(contract)) throw new Error(`Topology thin-line/time-badge style missing: ${contract}`);
}
for (const contract of ["totalItems", "pageSize", "aria-label", "이전", "다음"]) {
  if (!pagination.includes(contract)) throw new Error(`Shared pagination contract missing: ${contract}`);
}
for (const contract of ["Pagination", "eventPageSize", "pagedEvents"]) {
  if (!liveFlowPage.includes(contract)) throw new Error(`Live event pagination missing: ${contract}`);
}
for (const contract of ["Pagination", "filteredEvents", "safePage"]) {
  if (!records.includes(contract)) throw new Error(`Records pagination missing: ${contract}`);
}
for (const contract of ["auth-session-trigger", '"운영자 로그인"', 'navigate("settings")']) {
  if (!appShell.includes(contract)) throw new Error(`Public OCI login entry contract missing: ${contract}`);
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
