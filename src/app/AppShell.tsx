import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  configuredBackendUrl, getAiRuntime, getAtlasOverview, getAuthSession, getDashboardData, getEcosystemBalanceRecommendations, getEcosystemBalanceSummary, getEcosystemSummary, getEcosystemTopology,
  getEndpointHealth, getExternalApprovals, getGameFinanceSummary, getHistorianStatus, getKnowledgeOverview, getKpiOverview, getLatestBatchStatus, getLatestDailyReport, getLiveFlowRecentEvents, getLiveFlowSummary,
  getLiveFlowTopology, getLocalRuntimeStatus, getManagedSystemsOverview, getMcpRegistry, getMeshOverview, getPlatformReadiness, getPmTasks, getPublicAccessStatus, getQueueSummary, getRecentCommands, getRecentRuntimeEvents, getRuntimeTimeline, getRuntimeVersion, getSecurityStatus, getWorkforceOverview, liveFlowStreamUrl,
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
const REFRESH_PREFERENCE_VERSION = "2";
const MAX_LIVE_FLOW_EVENTS = 120;
const emptyData: AppData = { loading: true, refreshedAt: null, errors: {}, auth: publicAuth, dashboard: null, runtime: null, events: [], commands: [], kpi: null, endpointHealth: null, platformReadiness: null, publicAccess: null, runtimeVersion: null, security: null, architect: null, axReadiness: null, aiRuntime: null, latestBatch: null, dailyReport: null, managedSystems: null, ecosystemTimeline: null, settlementGame: null, ecosystem: null, ecosystemTopology: null, liveFlow: null, liveFlowTopology: null, liveFlowEvents: [], balance: null, balanceRecommendations: null, workforce: null, mesh: null, queue: null, tasks: [], atlas: null, gameFinance: null, externalApprovals: [], knowledge: null, historian: null, mcpRegistry: [], timeline: [], lastEventLatencyMs: null };
type Result = { key: keyof AppData; value: unknown; error: string | null };
type RefreshRun = { route: CoreRoute; generation: number; promise: Promise<void> };
async function settle(key: keyof AppData, fn: () => Promise<unknown>): Promise<Result> { try { return { key, value: await fn(), error: null }; } catch (error) { return { key, value: null, error: error instanceof Error ? error.message : String(error) }; } }

function AppShellInner() {
  const [route, setRouteState] = useState<CoreRoute>(() => routeFromLocation());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState<AppData>(emptyData);
  const [pageLoading, setPageLoading] = useState(true);
  const [streamState, setStreamState] = useState<"connecting" | "connected" | "fallback">("connecting");
  const fallbackTimer = useRef<number | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const reconnectAttempt = useRef(0);
  const refreshGeneration = useRef(0);
  const refreshInFlight = useRef<RefreshRun | null>(null);
  const dashboardDetailsInFlight = useRef<Promise<void> | null>(null);
  const routeRef = useRef(route);
  const routeEpoch = useRef(0);
  if (routeRef.current !== route) {
    routeRef.current = route;
    routeEpoch.current += 1;
    dashboardDetailsInFlight.current = null;
  }
  const [refreshSeconds, setRefreshSeconds] = useState(() => {
    const storedValue = window.localStorage.getItem("archiveos.refresh.seconds");
    const preferenceVersion = window.localStorage.getItem("archiveos.refresh.preference.version");
    if (preferenceVersion !== REFRESH_PREFERENCE_VERSION && (storedValue === null || storedValue === "10")) return 5;
    const stored = Number(storedValue ?? "5");
    return [0, 5, 10, 30, 60].includes(stored) ? stored : 5;
  });
  const { locale, setLocale } = useI18n();

  const navigate = useCallback((next: CoreRoute) => { window.history.pushState({}, "", `#/${next}`); setRouteState(next); setSidebarOpen(false); }, []);
  useEffect(() => {
    const requested = (window.location.hash.replace(/^#\/?/, "") || window.location.pathname.split("/").filter(Boolean).pop() || "").toLowerCase();
    const canonical = normalizeRoute(requested);
    if (requested && requested !== canonical) window.history.replaceState({}, "", `#/${canonical}`);
  }, []);
  useEffect(() => { const onPopState = () => setRouteState(routeFromLocation()); window.addEventListener("popstate", onPopState); window.addEventListener("hashchange", onPopState); return () => { window.removeEventListener("popstate", onPopState); window.removeEventListener("hashchange", onPopState); }; }, []);
  useEffect(() => { document.body.classList.toggle("sidebar-open", sidebarOpen); return () => document.body.classList.remove("sidebar-open"); }, [sidebarOpen]);

  const refresh = useCallback((showPageLoading = true) => {
    const active = refreshInFlight.current;
    if (active?.route === route) {
      if (showPageLoading) setPageLoading(true);
      return active.promise.finally(() => { if (showPageLoading) setPageLoading(false); });
    }
    const generation = ++refreshGeneration.current;
    const loaders = loadersFor(route);
    if (showPageLoading) setPageLoading(true);
    setData((current) => current.refreshedAt ? current : ({ ...current, loading: true }));
    setData((current) => ({ ...current, errors: {} }));
    const promise = (async () => {
      await Promise.all(loaders.map(async ([key, fn]) => {
        const result = await settle(key, fn);
        if (generation !== refreshGeneration.current) return;
        setData((current) => applyResult(current, result));
      }));
      if (generation === refreshGeneration.current) {
        setData((current) => ({ ...current, loading: false, refreshedAt: new Date().toISOString() }));
        if (showPageLoading) setPageLoading(false);
      }
    })();
    refreshInFlight.current = { route, generation, promise };
    void promise.then(() => {
      if (refreshInFlight.current?.generation === generation) refreshInFlight.current = null;
    });
    return promise;
  }, [route]);

  const loadDashboardDetails = useCallback(() => {
    if (routeRef.current !== "dashboard") return Promise.resolve();
    if (dashboardDetailsInFlight.current) return dashboardDetailsInFlight.current;
    const requestedRoute = routeRef.current;
    const requestedRouteEpoch = routeEpoch.current;
    const promise = (async () => {
      const results = await Promise.all([
        settle("workforce", getWorkforceOverview),
        settle("liveFlowEvents", () => getLiveFlowRecentEvents(MAX_LIVE_FLOW_EVENTS, true)),
      ]);
      if (routeRef.current !== requestedRoute || routeEpoch.current !== requestedRouteEpoch) return;
      setData((current) => {
        let next = current;
        for (const result of results) next = applyResult(next, result);
        return { ...next, refreshedAt: new Date().toISOString() };
      });
    })();
    dashboardDetailsInFlight.current = promise;
    void promise.then(() => {
      if (dashboardDetailsInFlight.current === promise) dashboardDetailsInFlight.current = null;
    });
    return promise;
  }, []);

  useEffect(() => {
    window.localStorage.setItem("archiveos.refresh.seconds", String(refreshSeconds));
    window.localStorage.setItem("archiveos.refresh.preference.version", REFRESH_PREFERENCE_VERSION);
    if (route !== "dashboard") {
      void refresh(true);
      return;
    }
    let disposed = false;
    let timer: number | null = null;
    let initial = true;
    const poll = async () => {
      await refresh(initial);
      initial = false;
      if (!disposed && refreshSeconds > 0) timer = window.setTimeout(() => { void poll(); }, refreshSeconds * 1000);
    };
    void poll();
    return () => { disposed = true; if (timer !== null) window.clearTimeout(timer); };
  }, [refresh, refreshSeconds]);

  useEffect(() => {
    if (route !== "dashboard") return;
    let disposed = false;
    let streamConnected = false;
    let fallbackInFlight = false;
    let source: EventSource | null = null;
    const receive = (raw: string) => {
      try {
        const payload = JSON.parse(raw) as LiveFlowEvent | LiveFlowSummary;
        if ("event_id" in payload) {
          const receivedAt = payload.received_at ? Date.parse(payload.received_at) : Number.NaN;
          const latency = Number.isFinite(receivedAt) ? Math.max(0, Date.now() - receivedAt) : null;
          setData((current) => {
            const isNew = !current.liveFlowEvents.some((event) => event.event_id === payload.event_id);
            return { ...current, lastEventLatencyMs: latency, liveFlowEvents: mergeLiveFlowEvents(current.liveFlowEvents, [payload]), liveFlow: current.liveFlow ? { ...current.liveFlow, latest_event_at: newestEventTime(current.liveFlow.latest_event_at, payload.occurred_at), recent_events: (current.liveFlow.recent_events ?? 0) + (isNew ? 1 : 0), active_flows: (current.liveFlow.active_flows ?? 0) + (isNew ? 1 : 0) } : current.liveFlow };
          });
        } else if ("active_flows" in payload) {
          // SSE snapshots are intentionally compact. Preserve the richer
          // runtime/backlog contract loaded by polling so service processing
          // state cannot disappear between refreshes.
          setData((current) => ({ ...current, liveFlow: mergeLiveFlowSummary(current.liveFlow, payload) }));
        }
      } catch { /* malformed stream data is ignored; API polling remains a degraded fallback. */ }
    };
    const pollFallback = async () => {
      fallbackTimer.current = null;
      if (disposed || streamConnected || fallbackInFlight) return;
      fallbackInFlight = true;
      try {
        const events = await getLiveFlowRecentEvents(30, true);
        if (!disposed && !streamConnected) setData((current) => ({ ...current, liveFlowEvents: mergeLiveFlowEvents(current.liveFlowEvents, events) }));
      } catch { /* the next fallback poll retries after the normal delay. */ }
      finally {
        fallbackInFlight = false;
        if (!disposed && !streamConnected) fallbackTimer.current = window.setTimeout(() => { void pollFallback(); }, 1000);
      }
    };
    const startFallback = () => {
      if (streamConnected || fallbackTimer.current || fallbackInFlight) return;
      setStreamState("fallback");
      fallbackTimer.current = window.setTimeout(() => { void pollFallback(); }, 0);
    };
    const stopFallback = () => { if (fallbackTimer.current) { window.clearTimeout(fallbackTimer.current); fallbackTimer.current = null; } };
    const clearReconnect = () => { if (reconnectTimer.current) { window.clearTimeout(reconnectTimer.current); reconnectTimer.current = null; } };
    const connect = (reconnecting = false) => {
      if (disposed) return;
      clearReconnect();
      streamConnected = false;
      setStreamState(reconnecting ? "fallback" : "connecting");
      source?.close();
      source = new EventSource(liveFlowStreamUrl(), { withCredentials: true });
      const connected = (event: Event) => { streamConnected = true; receive((event as MessageEvent).data); reconnectAttempt.current = 0; setStreamState("connected"); stopFallback(); clearReconnect(); };
      source.addEventListener("snapshot", connected);
      source.addEventListener("runtime-event", connected);
      source.addEventListener("service-status", (event) => receive((event as MessageEvent).data));
      source.onerror = () => {
        if (disposed) return;
        streamConnected = false;
        startFallback();
        source?.close();
        if (!navigator.onLine) return;
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30_000);
        reconnectAttempt.current += 1;
        if (!reconnectTimer.current) reconnectTimer.current = window.setTimeout(() => connect(true), delay);
      };
    };
    const reconnectWhenOnline = () => { if (!disposed && !reconnectTimer.current) connect(true); };
    window.addEventListener("online", reconnectWhenOnline);
    connect();
    return () => { disposed = true; streamConnected = false; window.removeEventListener("online", reconnectWhenOnline); clearReconnect(); source?.close(); stopFallback(); reconnectAttempt.current = 0; };
  }, [route]);

  const health = useMemo(() => {
    if (data.ecosystem) return data.ecosystem.status === "HEALTHY" ? "healthy" : "warning";
    if (data.loading) return "waiting";
    return Object.keys(data.errors).length ? "warning" : "healthy";
  }, [data.ecosystem, data.errors, data.loading]);
  const page = route === "dashboard" ? <ConsoleDashboardPage data={data} onNavigate={navigate} onRefresh={refresh} onLoadTopologyDetails={loadDashboardDetails} /> : route === "services" ? <ConsoleServicesPage data={data} /> : route === "operations" ? <ConsoleOperationsPage data={data} onRefresh={refresh} /> : route === "finance" ? <ConsoleFinancePage data={data} onRefresh={refresh} /> : route === "records" ? <ConsoleRecordsPage data={data} /> : <ConsoleSettingsPage data={data} onRefresh={refresh} backendOrigin={configuredBackendUrl} />;
  return <div className="app-shell"><Sidebar route={route} open={sidebarOpen} onNavigate={navigate} health={health} loading={data.loading} role={data.auth.role} />{sidebarOpen ? <button className="sidebar-scrim" type="button" aria-label={consoleText(locale, "common.closeMenu")} onClick={() => setSidebarOpen(false)} /> : null}<div className="content-shell"><header className="topbar"><button className="mobile-menu-button" type="button" aria-label={consoleText(locale, "common.openMenu")} aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((open) => !open)}>☰</button><div><span className="eyebrow">ARCHIVEOS CONTROL TOWER</span><h1>{consoleText(locale, `nav.${route}`)}</h1></div><div className="topbar-status">{route === "dashboard" ? <span className={`stream-state stream-${streamState}`}>{streamState === "connected" ? `${consoleText(locale, "common.live")}${data.lastEventLatencyMs === null ? "" : ` · ${data.lastEventLatencyMs}ms`}` : streamState === "fallback" ? consoleText(locale, "common.reconnecting") : consoleText(locale, "common.connecting")}</span> : null}{route === "dashboard" ? <label className="refresh-interval"><span>자동 갱신</span><select value={refreshSeconds} onChange={(event) => setRefreshSeconds(Number(event.target.value))} aria-label="자동 새로고침 간격"><option value={0}>끄기</option><option value={5}>5초</option><option value={10}>10초</option><option value={30}>30초</option><option value={60}>60초</option></select></label> : <span className="manual-refresh-only">수동 갱신</span>}<button className={`auth-session-trigger ${data.auth.authenticated ? "authenticated" : ""}`} type="button" onClick={() => navigate("settings")} aria-label={data.auth.authenticated ? `${data.auth.role} 세션 설정` : "운영자 로그인"}>{data.auth.authenticated ? data.auth.role : "로그인"}</button><LanguagePopover locale={locale} setLocale={setLocale} /><span className="last-sync">{data.refreshedAt ? `${consoleText(locale, "common.updated")} ${new Date(data.refreshedAt).toLocaleTimeString()}` : consoleText(locale, "common.loading")}</span><button className="icon-button" type="button" onClick={() => void refresh(true)} aria-label={consoleText(locale, "common.refresh")} title={consoleText(locale, "common.refresh")}><Icon name="refresh" /></button></div></header><main className="page-host" id="main-content">{pageLoading ? <div className="page-loading-overlay" role="status" aria-live="polite"><span className="page-loading-spinner" aria-hidden="true" /><strong>페이지를 불러오는 중입니다.</strong></div> : null}{page}</main></div></div>;
}

function LanguagePopover({ locale, setLocale }: { locale: Locale; setLocale: (locale: Locale) => void }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const close = (returnFocus = false) => { setOpen(false); if (returnFocus) window.setTimeout(() => triggerRef.current?.focus(), 0); };
  useEffect(() => { const dismiss = (event: PointerEvent) => { const target = event.target as Node; if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) close(false); }; const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(true); }; window.addEventListener("pointerdown", dismiss); window.addEventListener("keydown", escape); return () => { window.removeEventListener("pointerdown", dismiss); window.removeEventListener("keydown", escape); }; }, []);
  useEffect(() => { if (open) menuRef.current?.querySelector<HTMLButtonElement>("[aria-checked='true']")?.focus(); }, [open]);
  return <div className="language-popover"><button ref={triggerRef} type="button" className="language-trigger" aria-label={consoleText(locale, "common.language")} aria-expanded={open} aria-haspopup="menu" aria-controls={open ? menuId : undefined} onClick={() => setOpen((value) => !value)}><span aria-hidden="true">◎</span><b>{locale === "zh-CN" ? "ZH" : locale.toUpperCase()}</b></button>{open ? <div ref={menuRef} id={menuId} className="language-menu" role="menu">{languageOptions.map((option) => <button type="button" role="menuitemradio" aria-checked={locale === option.code} key={option.code} onClick={() => { setLocale(option.code); close(true); }}>{t(option.labelKey, locale)}</button>)}</div> : null}</div>;
}

function loadersFor(route: CoreRoute): Array<[keyof AppData, () => Promise<unknown>]> {
  const auth: [keyof AppData, () => Promise<unknown>] = ["auth", getAuthSession];
  if (route === "dashboard") return [auth, ["ecosystem", getEcosystemSummary], ["liveFlow", getLiveFlowSummary], ["liveFlowTopology", getLiveFlowTopology], ["liveFlowEvents", () => getLiveFlowRecentEvents(30, true)], ["balance", getEcosystemBalanceSummary]];
  if (route === "services") return [auth, ["ecosystem", getEcosystemSummary], ["ecosystemTopology", getEcosystemTopology], ["atlas", getAtlasOverview], ["managedSystems", getManagedSystemsOverview]];
  if (route === "operations") return [auth, ["dashboard", getDashboardData], ["mesh", getMeshOverview], ["workforce", getWorkforceOverview], ["queue", getQueueSummary], ["tasks", getPmTasks]];
  if (route === "finance") return [auth, ["ecosystem", getEcosystemSummary], ["liveFlow", getLiveFlowSummary], ["balance", getEcosystemBalanceSummary], ["gameFinance", getGameFinanceSummary], ["externalApprovals", () => getExternalApprovals(50)]];
  if (route === "records") return [auth, ["liveFlowEvents", () => getLiveFlowRecentEvents(100)], ["events", getRecentRuntimeEvents], ["commands", getRecentCommands], ["dashboard", getDashboardData], ["kpi", () => getKpiOverview("7d")], ["aiRuntime", getAiRuntime], ["knowledge", getKnowledgeOverview], ["historian", getHistorianStatus], ["timeline", () => getRuntimeTimeline(200)]];
  return [
    auth,
    ["endpointHealth", getEndpointHealth],
    ["platformReadiness", getPlatformReadiness],
    ["aiRuntime", getAiRuntime],
    ["knowledge", getKnowledgeOverview],
    ["historian", getHistorianStatus],
    ["runtime", getLocalRuntimeStatus],
    ["mcpRegistry", getMcpRegistry],
    ["latestBatch", getLatestBatchStatus],
    ["dailyReport", getLatestDailyReport],
    ["publicAccess", getPublicAccessStatus],
    ["security", getSecurityStatus],
    ["runtimeVersion", getRuntimeVersion],
  ];
}
function applyResult(current: AppData, result: Result): AppData {
  const errors = { ...current.errors };
  const next: AppData = { ...current, errors };
  if (result.error) errors[result.key] = result.error;
  else {
    delete errors[result.key];
    if (result.key === "liveFlowEvents") next.liveFlowEvents = mergeLiveFlowEvents(current.liveFlowEvents, result.value as LiveFlowEvent[]);
    else (next as unknown as Record<string, unknown>)[result.key] = result.value;
    if (result.key !== "auth") next.loading = false;
  }
  if (!next.auth) next.auth = publicAuth;
  return next;
}
function mergeLiveFlowEvents(current: LiveFlowEvent[], incoming: LiveFlowEvent[]) {
  const events = new Map<string, LiveFlowEvent>();
  for (const event of [...current, ...incoming]) {
    const existing = events.get(event.event_id);
    if (!existing || liveFlowEventTime(event) >= liveFlowEventTime(existing)) events.set(event.event_id, event);
  }
  return [...events.values()]
    .sort((left, right) => liveFlowEventTime(right) - liveFlowEventTime(left) || left.event_id.localeCompare(right.event_id))
    .slice(0, MAX_LIVE_FLOW_EVENTS);
}
function mergeLiveFlowSummary(current: LiveFlowSummary | null, incoming: LiveFlowSummary): LiveFlowSummary {
  if (!current) return incoming;
  return {
    ...current,
    ...incoming,
    runtime: incoming.runtime
      ? {
          ...current.runtime,
          ...incoming.runtime,
          services: incoming.runtime.services ?? current.runtime?.services,
        }
      : current.runtime,
    approvalBacklog: incoming.approvalBacklog ?? current.approvalBacklog,
    approvalBacklogSource: incoming.approvalBacklogSource ?? current.approvalBacklogSource,
    processingBacklog: incoming.processingBacklog ?? current.processingBacklog,
    processingBacklogSource: incoming.processingBacklogSource ?? current.processingBacklogSource,
  };
}
function liveFlowEventTime(event: LiveFlowEvent) {
  const received = Date.parse(event.received_at || "");
  const occurred = Date.parse(event.occurred_at || "");
  return Math.max(Number.isFinite(received) ? received : 0, Number.isFinite(occurred) ? occurred : 0);
}
function newestEventTime(current: string | null | undefined, incoming: string) {
  const currentTime = Date.parse(current || "");
  const incomingTime = Date.parse(incoming);
  return !Number.isFinite(currentTime) || (Number.isFinite(incomingTime) && incomingTime >= currentTime) ? incoming : current;
}
function routeFromLocation(): CoreRoute { const hash = window.location.hash.replace(/^#\/?/, ""); const path = window.location.pathname.split("/").filter(Boolean).pop(); return normalizeRoute(hash || path); }
export function AppShell() { return <ThemeProvider><I18nProvider><AppShellInner /></I18nProvider></ThemeProvider>; }
