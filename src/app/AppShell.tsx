import { useCallback, useEffect, useMemo, useState } from "react";
import {
  configuredBackendUrl,
  getAxReadiness,
  getAuthSession,
  getAtlasOverview,
  getAiRuntime,
  getDashboardData,
  getEndpointHealth,
  getEcosystemSummary,
  getEcosystemTopology,
  getEcosystemTimeline,
  getExternalApprovals,
  getHistorianStatus,
  getKnowledgeOverview,
  getLatestArchitectureReview,
  getLatestBatchStatus,
  getLatestDailyReport,
  getLocalRuntimeStatus,
  getManagedSystemsOverview,
  getMeshOverview,
  getPmTasks,
  getPlatformReadiness,
  getPublicAccessStatus,
  getQueueSummary,
  getRecentCommands,
  getRecentRuntimeEvents,
  getRuntimeVersion,
  getSecurityStatus,
  getSettlementAgencyGameSummary,
  getKpiOverview,
  getGameFinanceSummary,
  getMcpRegistry,
  getRuntimeTimeline,
  type AuthSession,
  type ArchitectureReview,
  type AtlasOverview,
  type AxReadiness,
  type AiRuntime,
  type DashboardData,
  type EndpointHealth,
  type EcosystemSummary,
  type EcosystemTopology,
  type EcosystemTimeline,
  type ExternalApprovalRequest,
  type HistorianStatus,
  type KnowledgeOverview,
  type KpiOverview,
  type LatestBatchStatus,
  type LocalRuntimeStatus,
  type ManagedSystemsOverview,
  type MeshOverview,
  type PlatformReadiness,
  type PublicAccessStatus,
  type QueueSummary,
  type RuntimeEvent,
  type RuntimeVersion,
  type SecurityStatus,
  type SettlementAgencyGameSummary,
  type GameFinanceSummary,
  type McpRegistryEntry,
  type RuntimeTimelineEntry,
} from "../lib/backendApi";
import type { CommandRun, DailyReport, PmTask } from "../types/database";
import { navigationItems, type AppRoute } from "./navigation";
import { OverviewPage } from "../pages/OverviewPage";
import { WorkflowsPage } from "../pages/WorkflowsPage";
import { KnowledgePage } from "../pages/KnowledgePage";
import { HistoryPage } from "../pages/HistoryPage";
import { SettingsPage } from "../pages/SettingsPage";
import { AgentsPage } from "../pages/AgentsPage";
import { BatchPage } from "../pages/BatchPage";
import { RpaPage } from "../pages/RpaPage";
import { AtlasPage } from "../pages/AtlasPage";
import { McpRegistryPage } from "../pages/McpRegistryPage";
import { ManagedSystemsPage } from "../pages/ManagedSystemsPage";
import { LedgerApprovalsPage } from "../pages/LedgerApprovalsPage";
import { EcosystemPage } from "../pages/EcosystemPage";
import { SettlementGamePage } from "../pages/SettlementGamePage";
import { Icon } from "../components/shared/Icon";
import { Sidebar } from "../components/shared/Sidebar";
import { ThemeProvider } from "../theme/ThemeProvider";
import { applyLocale, languageOptions as i18nLanguageOptions, readStoredLocale, t, type Locale } from "../i18n";

export type AppData = {
  loading: boolean;
  refreshedAt: string | null;
  errors: Record<string, string>;
  dashboard: DashboardData | null;
  runtime: LocalRuntimeStatus | null;
  queue: QueueSummary | null;
  tasks: PmTask[];
  events: RuntimeEvent[];
  commands: CommandRun[];
  knowledge: KnowledgeOverview | null;
  historian: HistorianStatus | null;
  mesh: MeshOverview | null;
  kpi: KpiOverview | null;
  endpointHealth: EndpointHealth | null;
  platformReadiness: PlatformReadiness | null;
  publicAccess: PublicAccessStatus | null;
  runtimeVersion: RuntimeVersion | null;
  security: SecurityStatus | null;
  architect: ArchitectureReview | null;
  axReadiness: AxReadiness | null;
  aiRuntime: AiRuntime | null;
  latestBatch: LatestBatchStatus | null;
  dailyReport: DailyReport | null;
  auth: AuthSession;
  atlas: AtlasOverview | null;
  managedSystems: ManagedSystemsOverview | null;
  ecosystem: EcosystemSummary | null;
  ecosystemTopology: EcosystemTopology | null;
  ecosystemTimeline: EcosystemTimeline | null;
  settlementGame: SettlementAgencyGameSummary | null;
  gameFinance: GameFinanceSummary | null;
  externalApprovals: ExternalApprovalRequest[];
  mcpRegistry: McpRegistryEntry[];
  timeline: RuntimeTimelineEntry[];
};

const emptyData: AppData = {
  loading: true,
  refreshedAt: null,
  errors: {},
  dashboard: null,
  runtime: null,
  queue: null,
  tasks: [],
  events: [],
  commands: [],
  knowledge: null,
  historian: null,
  mesh: null,
  kpi: null,
  endpointHealth: null,
  platformReadiness: null,
  publicAccess: null,
  runtimeVersion: null,
  security: null,
  architect: null,
  axReadiness: null,
  aiRuntime: null,
  latestBatch: null,
  dailyReport: null,
  auth: { actor: "anonymous", role: "PUBLIC", authenticated: false },
  atlas: null,
  managedSystems: null,
  ecosystem: null,
  ecosystemTopology: null,
  ecosystemTimeline: null,
  settlementGame: null,
  gameFinance: null,
  externalApprovals: [],
  mcpRegistry: [],
  timeline: [],
};

async function settle<T>(key: string, fn: () => Promise<T>) {
  try {
    return { key, value: await fn(), error: null };
  } catch (err) {
    return { key, value: null, error: err instanceof Error ? err.message : String(err) };
  }
}

function AppShellInner() {
  const [route, setRoute] = useState<AppRoute>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState<AppData>(emptyData);
  const [language, setLanguage] = useState<Locale>(() => readStoredLocale());

  useEffect(() => {
    applyLocale(language);
    const observer = new MutationObserver(() => window.requestAnimationFrame(() => applyLocale(language)));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [language]);

  useEffect(() => {
    const timer = window.setTimeout(() => applyLocale(language), 0);
    return () => window.clearTimeout(timer);
  }, [data, language, route]);

  const refresh = useCallback(async () => {
    setData((current) => ({ ...current, loading: true }));
    const authResult = await settle("auth", getAuthSession);
    const role = authResult.value?.role ?? "PUBLIC";
    const operatorAccess = role !== "PUBLIC";
    const adminAccess = role === "ADMIN";
    const results = [authResult, ...(await Promise.all([
      settle("dashboard", getDashboardData),
      settle("runtime", getLocalRuntimeStatus),
      settle("queue", getQueueSummary),
      settle("tasks", getPmTasks),
      settle("events", getRecentRuntimeEvents),
      settle("commands", getRecentCommands),
      settle("knowledge", getKnowledgeOverview),
      settle("historian", getHistorianStatus),
      settle("mesh", getMeshOverview),
      settle("kpi", () => getKpiOverview("7d")),
      settle("endpointHealth", getEndpointHealth),
      settle("platformReadiness", getPlatformReadiness),
      adminAccess ? settle("publicAccess", getPublicAccessStatus) : Promise.resolve({ key: "publicAccess", value: null, error: null }),
      settle("runtimeVersion", getRuntimeVersion),
      adminAccess ? settle("security", getSecurityStatus) : Promise.resolve({ key: "security", value: null, error: null }),
      settle("architect", getLatestArchitectureReview),
      settle("axReadiness", getAxReadiness),
      settle("aiRuntime", getAiRuntime),
      settle("latestBatch", getLatestBatchStatus),
      settle("dailyReport", getLatestDailyReport),
      settle("atlas", getAtlasOverview),
      settle("managedSystems", getManagedSystemsOverview),
      settle("ecosystem", getEcosystemSummary),
      settle("ecosystemTopology", getEcosystemTopology),
      settle("ecosystemTimeline", () => getEcosystemTimeline(50)),
      settle("settlementGame", getSettlementAgencyGameSummary),
      settle("gameFinance", getGameFinanceSummary),
      settle("externalApprovals", () => getExternalApprovals(50)),
      operatorAccess ? settle("mcpRegistry", getMcpRegistry) : Promise.resolve({ key: "mcpRegistry", value: [], error: null }),
      operatorAccess ? settle("timeline", () => getRuntimeTimeline(100)) : Promise.resolve({ key: "timeline", value: [], error: null }),
    ]))];

    const next: AppData = { ...emptyData, loading: false, refreshedAt: new Date().toISOString(), errors: {} };
    for (const result of results) {
      if (result.error) {
        next.errors[result.key] = result.error;
      } else {
        (next as unknown as Record<string, unknown>)[result.key] = result.value;
      }
    }
    setData(next);
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 45_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const healthTone = useMemo(() => {
    if (data.loading) return "working";
    const failing = data.endpointHealth?.summary.failed ?? Object.keys(data.errors).length;
    return failing > 0 ? "warning" : "healthy";
  }, [data.endpointHealth?.summary.failed, data.errors, data.loading]);

  const page = {
    overview: <OverviewPage data={data} onRefresh={refresh} onNavigate={setRoute} />,
    managed: <ManagedSystemsPage data={data} onRefresh={refresh} onNavigate={setRoute} />,
    ecosystem: <EcosystemPage data={data} onRefresh={refresh} />,
    game: <SettlementGamePage data={data} onRefresh={refresh} />,
    approvals: <LedgerApprovalsPage data={data} onRefresh={refresh} />,
    agents: <AgentsPage data={data} onRefresh={refresh} />,
    workflows: <WorkflowsPage data={data} onRefresh={refresh} />,
    knowledge: <KnowledgePage data={data} />,
    history: <HistoryPage data={data} />,
    batch: <BatchPage role={data.auth.role} />,
    rpa: <RpaPage role={data.auth.role} />,
    atlas: <AtlasPage data={data} onRefresh={refresh} />,
    mcp: <McpRegistryPage data={data} />,
    settings: <SettingsPage data={data} onRefresh={refresh} backendOrigin={configuredBackendUrl} />,
  }[route];

  return (
    <div className="app-shell">
      <Sidebar route={route} open={sidebarOpen} onNavigate={(nextRoute) => { setRoute(nextRoute); setSidebarOpen(false); }} health={healthTone} loading={data.loading} branch={data.runtimeVersion?.branch} commitSha={data.runtimeVersion?.commitSha} role={data.auth.role} />
      {sidebarOpen ? <button className="sidebar-scrim" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} /> : null}

      <div className="content-shell">
        <header className="topbar">
          <button className="mobile-menu-button" type="button" aria-label="Open navigation" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((open) => !open)}>☰</button>
          <div><span className="eyebrow">ArchiveOS Control Tower</span><h1>{navigationItems.find((item) => item.id === route)?.label}</h1></div>
          <div className="topbar-status">
            <LanguageSelector value={language} onChange={setLanguage} />
            <span className="last-sync">Updated {data.refreshedAt ? new Date(data.refreshedAt).toLocaleTimeString() : "waiting"}</span>
            <button className="icon-button" type="button" onClick={refresh} aria-label="Refresh all operational data" title="Refresh"><Icon name="refresh" /></button>
          </div>
        </header>
        <main className="page-host" id="main-content">{page}</main>
      </div>
    </div>
  );
}

function LanguageSelector({ value, onChange }: { value: Locale; onChange: (value: Locale) => void }) {
  return (
    <label className="language-selector" title="Display language">
      <span aria-hidden="true">🌐</span>
      <select value={value} aria-label="Display language" onChange={(event) => onChange(event.target.value as Locale)}>
        {i18nLanguageOptions.map((option) => <option key={option.code} value={option.code}>{t(option.labelKey, value)}</option>)}
      </select>
    </label>
  );
}

export function AppShell() {
  return (
    <ThemeProvider>
      <AppShellInner />
    </ThemeProvider>
  );
}
