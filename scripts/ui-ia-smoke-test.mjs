import { existsSync, readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf-8");
const appShell = read("src/app/AppShell.tsx");
const navigation = read("src/app/navigation.ts");
const styles = read("src/styles.css");
const api = read("src/lib/backendApi.ts");
const servicesPage = read("src/pages/ConsoleServicesPage.tsx");
const managedSystemsPage = read("src/pages/ManagedSystemsPage.tsx");
const managedSystemsModel = read("src/features/managedSystems/model.ts");
const liveMesh = read("src/components/console/LiveMeshTopology.tsx");
const i18n = read("src/i18n/I18nProvider.tsx");

for (const label of ["대시보드", "서비스", "운영", "재무", "기록", "설정"]) {
  if (!navigation.includes(`label: "${label}"`)) throw new Error(`Missing Console V3 navigation label: ${label}`);
}
if ((navigation.match(/\{ id: "/g) ?? []).length !== 6) throw new Error("Console V3 must expose exactly six top-level navigation items.");
for (const route of ["overview", "liveflow", "ecosystem", "agents", "approvals", "history", "mcp"]) {
  if (!navigation.includes(`${route}:`)) throw new Error(`Legacy redirect missing: ${route}`);
}
for (const contract of [
  'managed: "services"',
  'requestedRoute === "managed"',
  'servicesHash(servicesView, managedSystemId)',
  '"archive-logitics"',
  '"archive-logistics"',
  'requestedView === "managed" || requestedView === "external"',
]) {
  if (!navigation.includes(contract)) throw new Error(`Managed Systems routing contract missing: ${contract}`);
}
for (const contract of ["getEcosystemSummary", "getLiveFlowSummary", "getLiveFlowTopology", "getLiveFlowRecentEvents", "liveFlowStreamUrl", "getEcosystemBalanceSummary"]) {
  if (!api.includes(contract)) throw new Error(`Console V3 API contract missing: ${contract}`);
}
for (const contract of ["getManagedSystemsOverview", "getManagedSystemEvents", "getManagedSystemWorkflows", "getManagedSystemWorkLogs"]) {
  if (!api.includes(contract)) throw new Error(`Managed Systems API contract missing: ${contract}`);
}
for (const contract of [
  'items={[["status", "서비스 상태"], ["managed", "관리 시스템"], ["external", "외부 연동"]]}',
  'role="tabpanel"',
  'aria-labelledby="managed-tab"',
  'onKeyDown',
  '"ArrowLeft"',
  '"ArrowRight"',
  'tabIndex={value === id ? 0 : -1}',
]) {
  if (!servicesPage.includes(contract)) throw new Error(`Services subview accessibility contract missing: ${contract}`);
}
for (const systemId of ["archive-os", "archive-market", "archive-nexus", "archive-logistics", "archive-ledger"]) {
  if (!managedSystemsModel.includes(`"${systemId}"`)) throw new Error(`Managed Systems core identity missing: ${systemId}`);
}
for (const forbidden of ["archive-world", "atlas-platform", "deepstake"]) {
  if (managedSystemsModel.toLowerCase().includes(`"${forbidden}"`)) throw new Error(`Non-core system leaked into Managed Systems list: ${forbidden}`);
}
for (const contract of [
  "statusReason",
  "lastCheckedAt",
  "openIncidentCount",
  "recommendedAction",
  "canManagePmInbox",
  "getManagedSystemEvents",
  "getManagedSystemWorkflows",
  "getManagedSystemWorkLogs",
  'kind="loading"',
  'kind="empty"',
  'kind="error"',
  'aria-live="polite"',
]) {
  if (!managedSystemsPage.includes(contract)) throw new Error(`Managed Systems UI state contract missing: ${contract}`);
}
if (managedSystemsPage.includes('"archive-logitics"')) throw new Error("Managed Systems UI must never emit the legacy Logistics identity.");
for (const contract of ["EventSource", "runtime-event", "fallback", "getLiveFlowRecentEvents(30)", "reconnectAttempt", "30_000", "eventIds.current.size > 750", "window.addEventListener(\"online\""]) {
  if (!appShell.includes(contract)) throw new Error(`Live Flow SSE contract missing: ${contract}`);
}
for (const contract of ["Archive-Market", "Archive-Nexus", "Archive-Logistics", "Archive-Ledger", "ArchiveOS", "Settlement", "events.slice(0, 30)"]) {
  if (!liveMesh.includes(contract)) throw new Error(`Mesh topology contract missing: ${contract}`);
}
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
