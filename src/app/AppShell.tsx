import { useCallback, useEffect, useMemo, useState } from "react";
import {
  configuredBackendUrl,
  getAxReadiness,
  getAiRuntime,
  getDashboardData,
  getEndpointHealth,
  getHistorianStatus,
  getKnowledgeOverview,
  getLatestArchitectureReview,
  getLatestBatchStatus,
  getLatestDailyReport,
  getLocalRuntimeStatus,
  getMeshOverview,
  getPmTasks,
  getPlatformReadiness,
  getPublicAccessStatus,
  getQueueSummary,
  getRecentCommands,
  getRecentRuntimeEvents,
  getRuntimeVersion,
  getSecurityStatus,
  getKpiOverview,
  type ArchitectureReview,
  type AxReadiness,
  type AiRuntime,
  type DashboardData,
  type EndpointHealth,
  type HistorianStatus,
  type KnowledgeOverview,
  type KpiOverview,
  type LatestBatchStatus,
  type LocalRuntimeStatus,
  type MeshOverview,
  type PlatformReadiness,
  type PublicAccessStatus,
  type QueueSummary,
  type RuntimeEvent,
  type RuntimeVersion,
  type SecurityStatus,
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
import { Icon } from "../components/shared/Icon";
import { Sidebar } from "../components/shared/Sidebar";
import { ThemeProvider } from "../theme/ThemeProvider";

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

  const refresh = useCallback(async () => {
    setData((current) => ({ ...current, loading: true }));
    const results = await Promise.all([
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
      settle("publicAccess", getPublicAccessStatus),
      settle("runtimeVersion", getRuntimeVersion),
      settle("security", getSecurityStatus),
      settle("architect", getLatestArchitectureReview),
      settle("axReadiness", getAxReadiness),
      settle("aiRuntime", getAiRuntime),
      settle("latestBatch", getLatestBatchStatus),
      settle("dailyReport", getLatestDailyReport),
    ]);

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
    agents: <AgentsPage data={data} />,
    workflows: <WorkflowsPage data={data} onRefresh={refresh} />,
    knowledge: <KnowledgePage data={data} />,
    history: <HistoryPage data={data} />,
    batch: <BatchPage />,
    rpa: <RpaPage />,
    settings: <SettingsPage data={data} onRefresh={refresh} backendOrigin={configuredBackendUrl} />,
  }[route];

  return (
    <div className="app-shell">
      <Sidebar route={route} open={sidebarOpen} onNavigate={(nextRoute) => { setRoute(nextRoute); setSidebarOpen(false); }} health={healthTone} loading={data.loading} branch={data.runtimeVersion?.branch} commitSha={data.runtimeVersion?.commitSha} />
      {sidebarOpen ? <button className="sidebar-scrim" type="button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} /> : null}

      <div className="content-shell">
        <header className="topbar">
          <button className="mobile-menu-button" type="button" aria-label="Open navigation" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((open) => !open)}>☰</button>
          <div><span className="eyebrow">AI Agent Operations Platform</span><h1>{navigationItems.find((item) => item.id === route)?.label}</h1></div>
          <div className="topbar-status"><span className="last-sync">Updated {data.refreshedAt ? new Date(data.refreshedAt).toLocaleTimeString() : "waiting"}</span><button className="icon-button" type="button" onClick={refresh} aria-label="Refresh all operational data" title="Refresh"><Icon name="refresh" /></button></div>
        </header>
        <main className="page-host" id="main-content">{page}</main>
      </div>
    </div>
  );
}

export function AppShell() {
  return (
    <ThemeProvider>
      <AppShellInner />
    </ThemeProvider>
  );
}
