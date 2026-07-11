import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  configuredBackendUrl, getAtlasOverview, getAuthSession, getEcosystemBalanceSummary, getEcosystemSummary, getEcosystemTopology,
  getExternalApprovals, getGameFinanceSummary, getHistorianStatus, getKnowledgeOverview, getLiveFlowRecentEvents, getLiveFlowSummary,
  getLiveFlowTopology, getMcpRegistry, getMeshOverview, getPmTasks, getQueueSummary, getRuntimeTimeline, getWorkforceOverview, liveFlowStreamUrl,
  type AuthSession, type AtlasOverview, type EcosystemBalanceSummary, type EcosystemSummary, type EcosystemTopology, type ExternalApprovalRequest,
  type GameFinanceSummary, type HistorianStatus, type KnowledgeOverview, type LiveFlowEvent, type LiveFlowSummary, type LiveFlowTopology,
  type McpRegistryEntry, type MeshOverview, type QueueSummary, type RuntimeTimelineEntry, type WorkforceOverview,
  type ArchitectureReview, type AxReadiness, type AiRuntime, type DashboardData, type EndpointHealth, type EcosystemTimeline,
  type KpiOverview, type LatestBatchStatus, type LocalRuntimeStatus, type ManagedSystemsOverview, type PlatformReadiness,
  type PublicAccessStatus, type RuntimeEvent, type RuntimeVersion, type SecurityStatus, type SettlementAgencyGameSummary,
} from "../lib/backendApi";
import type { CommandRun, DailyReport, PmTask } from "../types/database";
import { navigationItems, normalizeRoute, type CoreRoute } from "./navigation";
import { Sidebar } from "../components/shared/Sidebar";
import { Icon } from "../components/shared/Icon";
import { ThemeProvider } from "../theme/ThemeProvider";
import { I18nProvider, useI18n } from "../i18n/I18nProvider";
import { consoleText } from "../i18n/console";
import { languageOptions, t, type Locale } from "../i18n";
import { ConsoleDashboardPage } from "../pages/ConsoleDashboardPage";
import { ConsoleServicesPage } from "../pages/ConsoleServicesPage";
import { ConsoleOperationsPage } from "../pages/ConsoleOperationsPage";
import { ConsoleFinancePage } from "../pages/ConsoleFinancePage";
import { ConsoleRecordsPage } from "../pages/ConsoleRecordsPage";
import { ConsoleSettingsPage } from "../pages/ConsoleSettingsPage";

export type AppData = {
  loading: boolean; refreshedAt: string | null; errors: Record<string, string>; auth: AuthSession;
  dashboard: DashboardData | null; runtime: LocalRuntimeStatus | null; events: RuntimeEvent[]; commands: CommandRun[]; kpi: KpiOverview | null;
  endpointHealth: EndpointHealth | null; platformReadiness: PlatformReadiness | null; publicAccess: PublicAccessStatus | null; runtimeVersion: RuntimeVersion | null;
  security: SecurityStatus | null; architect: ArchitectureReview | null; axReadiness: AxReadiness | null; aiRuntime: AiRuntime | null; latestBatch: LatestBatchStatus | null; dailyReport: DailyReport | null;
  managedSystems: ManagedSystemsOverview | null; ecosystemTimeline: EcosystemTimeline | null; settlementGame: SettlementAgencyGameSummary | null;
  ecosystem: EcosystemSummary | null; ecosystemTopology: EcosystemTopology | null; liveFlow: LiveFlowSummary | null; liveFlowTopology: LiveFlowTopology | null; liveFlowEvents: LiveFlowEvent[];
  balance: EcosystemBalanceSummary | null; balanceRecommendations: { recommendations: Array<{ serviceId: string; title: string; reason: string; mode: string }> } | null;
  workforce: WorkforceOverview | null; mesh: MeshOverview | null; queue: QueueSummary | null; tasks: PmTask[]; atlas: AtlasOverview | null;
  gameFinance: GameFinanceSummary | null; externalApprovals: ExternalApprovalRequest[]; knowledge: KnowledgeOverview | null; historian: HistorianStatus | null;
  mcpRegistry: McpRegistryEntry[]; timeline: RuntimeTimelineEntry[];
  lastEventLatencyMs: number | null;
};

const publicAuth: AuthSession = { actor: "anonymous", role: "PUBLIC", authenticated: false };
const emptyData: AppData = { loading: true, refreshedAt: null, errors: {}, auth: publicAuth, dashboard: null, runtime: null, events: [], commands: [], kpi: null, endpointHealth: null, platformReadiness: null, publicAccess: null, runtimeVersion: null, security: null, architect: null, axReadiness: null, aiRuntime: null, latestBatch: null, dailyReport: null, managedSystems: null, ecosystemTimeline: null, settlementGame: null, ecosystem: null, ecosystemTopology: null, liveFlow: null, liveFlowTopology: null, liveFlowEvents: [], balance: null, balanceRecommendations: null, workforce: null, mesh: null, queue: null, tasks: [], atlas: null, gameFinance: null, externalApprovals: [], knowledge: null, historian: null, mcpRegistry: [], timeline: [], lastEventLatencyMs: null };
type Result = { key: keyof AppData; value: unknown; error: string | null };
async function settle(key: keyof AppData, fn: () => Promise<unknown>): Promise<Result> { try { return { key, value: await fn(), error: null }; } catch (error) { return { key, value: null, error: error instanceof Error ? error.message : String(error) }; } }

function AppShellInner() {
  const [route, setRouteState] = useState<CoreRoute>(() => routeFromLocation());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState<AppData>(emptyData);
  const [streamState, setStreamState] = useState<"connecting" | "connected" | "fallback">("connecting");
  const fallbackTimer = useRef<number | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const eventIds = useRef(new Set<string>());
  const { locale, setLocale } = useI18n();

  const navigate = useCallback((next: CoreRoute) => { window.history.pushState({}, "", `#/${next}`); setRouteState(next); setSidebarOpen(false); }, []);
  useEffect(() => {
    const requested = (window.location.hash.replace(/^#\/?/, "") || window.location.pathname.split("/").filter(Boolean).pop() || "").toLowerCase();
    const canonical = normalizeRoute(requested);
    if (requested && requested !== canonical) window.history.replaceState({}, "", `#/${canonical}`);
  }, []);
  useEffect(() => { const onPopState = () => setRouteState(routeFromLocation()); window.addEventListener("popstate", onPopState); window.addEventListener("hashchange", onPopState); return () => { window.removeEventListener("popstate", onPopState); window.removeEventListener("hashchange", onPopState); }; }, []);
  useEffect(() => { document.body.classList.toggle("sidebar-open", sidebarOpen); return () => document.body.classList.remove("sidebar-open"); }, [sidebarOpen]);

  const refresh = useCallback(async () => {
    setData((current) => ({ ...current, loading: true }));
    const loaders = loadersFor(route);
    const results = await Promise.all(loaders.map(([key, fn]) => settle(key, fn)));
    setData((current) => {
      const next: AppData = { ...current, loading: false, refreshedAt: new Date().toISOString(), errors: {} };
      for (const result of results) { if (result.error) next.errors[result.key] = result.error; else (next as unknown as Record<string, unknown>)[result.key] = result.value; }
      if (!next.auth) next.auth = publicAuth;
      return next;
    });
  }, [route]);
  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (route !== "dashboard") return;
    let disposed = false;
    let source: EventSource | null = null;
    const receive = (raw: string) => {
      try {
        const payload = JSON.parse(raw) as LiveFlowEvent | LiveFlowSummary;
        if ("event_id" in payload) {
          if (eventIds.current.has(payload.event_id)) return;
          eventIds.current.add(payload.event_id);
          const receivedAt = payload.received_at ? Date.parse(payload.received_at) : Number.NaN;
          const latency = Number.isFinite(receivedAt) ? Math.max(0, Date.now() - receivedAt) : null;
          setData((current) => ({ ...current, lastEventLatencyMs: latency, liveFlowEvents: [payload, ...current.liveFlowEvents.filter((event) => event.event_id !== payload.event_id)].slice(0, 100), liveFlow: current.liveFlow ? { ...current.liveFlow, latest_event_at: payload.occurred_at, recent_events: (current.liveFlow.recent_events ?? 0) + 1, active_flows: (current.liveFlow.active_flows ?? 0) + 1 } : current.liveFlow }));
        } else if ("active_flows" in payload) setData((current) => ({ ...current, liveFlow: payload }));
      } catch { /* malformed stream data is ignored; API polling remains a degraded fallback. */ }
    };
    const startFallback = () => {
      if (fallbackTimer.current) return;
      setStreamState("fallback");
      fallbackTimer.current = window.setInterval(() => { getLiveFlowRecentEvents(30).then((events) => { if (!disposed) setData((current) => ({ ...current, liveFlowEvents: events })); }).catch(() => undefined); }, 1000);
    };
    const stopFallback = () => { if (fallbackTimer.current) { window.clearInterval(fallbackTimer.current); fallbackTimer.current = null; } };
    const clearReconnect = () => { if (reconnectTimer.current) { window.clearTimeout(reconnectTimer.current); reconnectTimer.current = null; } };
    const connect = (reconnecting = false) => {
      if (disposed) return;
      clearReconnect();
      setStreamState(reconnecting ? "fallback" : "connecting");
      source?.close();
      source = new EventSource(liveFlowStreamUrl(), { withCredentials: true });
      const connected = (event: Event) => { receive((event as MessageEvent).data); setStreamState("connected"); stopFallback(); clearReconnect(); };
      source.addEventListener("snapshot", connected);
      source.addEventListener("runtime-event", connected);
      source.addEventListener("service-status", (event) => receive((event as MessageEvent).data));
      source.onerror = () => {
        if (disposed) return;
        startFallback();
        source?.close();
        if (!reconnectTimer.current) reconnectTimer.current = window.setTimeout(() => connect(true), 1000);
      };
    };
    connect();
    return () => { disposed = true; clearReconnect(); source?.close(); stopFallback(); };
  }, [route]);

  const health = useMemo(() => data.ecosystem?.status === "HEALTHY" ? "healthy" : Object.keys(data.errors).length ? "warning" : "waiting", [data.ecosystem?.status, data.errors]);
  const page = route === "dashboard" ? <ConsoleDashboardPage data={data} onNavigate={navigate} onRefresh={refresh} /> : route === "services" ? <ConsoleServicesPage data={data} /> : route === "operations" ? <ConsoleOperationsPage data={data} onRefresh={refresh} /> : route === "finance" ? <ConsoleFinancePage data={data} onRefresh={refresh} /> : route === "records" ? <ConsoleRecordsPage data={data} /> : <ConsoleSettingsPage data={data} onRefresh={refresh} backendOrigin={configuredBackendUrl} />;
  return <div className="app-shell"><Sidebar route={route} open={sidebarOpen} onNavigate={navigate} health={health} loading={data.loading} role={data.auth.role} />{sidebarOpen ? <button className="sidebar-scrim" type="button" aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} /> : null}<div className="content-shell"><header className="topbar"><button className="mobile-menu-button" type="button" aria-label="메뉴 열기" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((open) => !open)}>☰</button><div><span className="eyebrow">ARCHIVEOS CONTROL TOWER</span><h1>{consoleText(locale, `nav.${route}`)}</h1></div><div className="topbar-status">{route === "dashboard" ? <span className={`stream-state stream-${streamState}`}>{streamState === "connected" ? `${consoleText(locale, "common.live")}${data.lastEventLatencyMs === null ? "" : ` · ${data.lastEventLatencyMs}ms`}` : streamState === "fallback" ? "연결 재시도 중" : "연결 중"}</span> : null}<LanguagePopover locale={locale} setLocale={setLocale} /><span className="last-sync">{data.refreshedAt ? `갱신 ${new Date(data.refreshedAt).toLocaleTimeString()}` : "불러오는 중"}</span><button className="icon-button" type="button" onClick={refresh} aria-label="현재 화면 새로고침" title={consoleText(locale, "common.refresh")}><Icon name="refresh" /></button></div></header><main className="page-host" id="main-content">{page}</main></div></div>;
}

function LanguagePopover({ locale, setLocale }: { locale: Locale; setLocale: (locale: Locale) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, []);
  return <div className="language-popover"><button type="button" className="language-trigger" aria-label="표시 언어" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span aria-hidden="true">◎</span><b>{locale === "zh-CN" ? "ZH" : locale.toUpperCase()}</b></button>{open ? <div className="language-menu" role="menu">{languageOptions.map((option) => <button type="button" role="menuitemradio" aria-checked={locale === option.code} key={option.code} onClick={() => { setLocale(option.code); setOpen(false); }}>{t(option.labelKey, locale)}</button>)}</div> : null}</div>;
}

function loadersFor(route: CoreRoute): Array<[keyof AppData, () => Promise<unknown>]> {
  const auth: [keyof AppData, () => Promise<unknown>] = ["auth", getAuthSession];
  if (route === "dashboard") return [auth, ["ecosystem", getEcosystemSummary], ["liveFlow", getLiveFlowSummary], ["liveFlowTopology", getLiveFlowTopology], ["liveFlowEvents", () => getLiveFlowRecentEvents(30)], ["balance", getEcosystemBalanceSummary]];
  if (route === "services") return [auth, ["ecosystem", getEcosystemSummary], ["ecosystemTopology", getEcosystemTopology], ["atlas", getAtlasOverview]];
  if (route === "operations") return [auth, ["mesh", getMeshOverview], ["workforce", getWorkforceOverview], ["queue", getQueueSummary], ["tasks", getPmTasks]];
  if (route === "finance") return [auth, ["ecosystem", getEcosystemSummary], ["balance", getEcosystemBalanceSummary], ["gameFinance", getGameFinanceSummary], ["externalApprovals", () => getExternalApprovals(50)]];
  if (route === "records") return [auth, ["liveFlowEvents", () => getLiveFlowRecentEvents(100)], ["knowledge", getKnowledgeOverview], ["historian", getHistorianStatus], ["timeline", () => getRuntimeTimeline(100)]];
  return [auth, ["mcpRegistry", getMcpRegistry]];
}
function routeFromLocation(): CoreRoute { const hash = window.location.hash.replace(/^#\/?/, ""); const path = window.location.pathname.split("/").filter(Boolean).pop(); return normalizeRoute(hash || path); }
export function AppShell() { return <ThemeProvider><I18nProvider><AppShellInner /></I18nProvider></ThemeProvider>; }
