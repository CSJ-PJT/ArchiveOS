import { useEffect, useMemo, useRef, useState } from "react";
import type { AppData } from "../../app/AppShell";
import { analyzeDecision, askRag, getAiRuntime, searchRag, syncObsidian, type AiRuntime, type DecisionRecommendation, type RagAnswer, type RagReference, type RagRuntimeContext } from "../../lib/backendApi";
import { useI18n } from "../../i18n/I18nProvider";
import type { TranslationKey } from "../../i18n";
import { Icon } from "../shared/Icon";
import { StatusBadge, type SemanticStatus } from "../shared/StatusBadge";

type CopilotMode = "ask" | "search";
type CopilotState = "READY" | "SYNC_REQUIRED" | "MODEL_UNAVAILABLE" | "VECTOR_UNAVAILABLE" | "VAULT_UNAVAILABLE" | "DEGRADED" | "UNAVAILABLE";

export function DashboardRagCopilot({ data, seedQuestion, onSeedHandled }: { data: AppData; seedQuestion?: string | null; onSeedHandled?: () => void }) {
  const { translate } = useI18n();
  const [runtime, setRuntime] = useState<AiRuntime | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [mode, setMode] = useState<CopilotMode>("ask");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [results, setResults] = useState<RagReference[] | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [decision, setDecision] = useState<DecisionRecommendation | null>(null);
  const [decisionBusy, setDecisionBusy] = useState(false);
  const triggerRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  const refreshRuntime = async (signal?: AbortSignal) => {
    try {
      const next = await getAiRuntime({ signal });
      setRuntime(next); setRuntimeError(null);
    } catch (error) {
      if ((error as Error).name !== "AbortError") setRuntimeError(safeError(error));
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void refreshRuntime(controller.signal);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!seedQuestion) return;
    setQuery(seedQuestion); setMode("ask"); setAnswer(null); setResults(null); setRequestError(null); setOpen(true);
    onSeedHandled?.();
  }, [seedQuestion, onSeedHandled]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open]);

  const ragState = deriveState(runtime, runtimeError);
  const context = useMemo(() => buildRuntimeContext(data), [data]);
  const suggestions = useMemo(() => buildSuggestions(data, translate), [data, translate]);
  const stateLabel = labelForState(ragState, translate);
  const stateTone = toneForState(ragState);
  const placeholder = ragState === "READY" ? translate("copilot.placeholder") : stateLabel;
  const canSync = ragState === "SYNC_REQUIRED" && data.auth.role === "ADMIN";

  function close() {
    requestRef.current?.abort();
    setLoading(false); setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  async function submit(nextQuery = query) {
    const normalized = nextQuery.trim();
    if (!normalized || loading) return;
    requestRef.current?.abort();
    const controller = new AbortController(); requestRef.current = controller;
    setQuery(normalized); setOpen(true); setLoading(true); setRequestError(null); setAnswer(null); setResults(null); setDecision(null);
    try {
      if (mode === "search") setResults(await searchRag(normalized, { signal: controller.signal }));
      else setAnswer(await askRag(normalized, context, { signal: controller.signal }));
    } catch (error) {
      if ((error as Error).name !== "AbortError") setRequestError(safeError(error));
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setLoading(false); }
    }
  }

  async function sync() {
    if (!canSync || syncing) return;
    setSyncing(true); setRequestError(null);
    try { await syncObsidian(); await refreshRuntime(); }
    catch (error) { setRequestError(safeError(error)); }
    finally { setSyncing(false); }
  }

  async function createDecision() {
    if (decisionBusy || data.auth.role !== "ADMIN" || !query.trim()) return;
    setDecisionBusy(true); setRequestError(null);
    try { setDecision(await analyzeDecision({ question: query, service: context.selectedService || "Archive-Ledger", correlationId: context.selectedCorrelationId })); }
    catch (error) { setRequestError(safeError(error)); }
    finally { setDecisionBusy(false); }
  }

  function trapFocus(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), [href]")];
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return <div className="dashboard-rag-copilot">
    <form className="copilot-search-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <label className="sr-only" htmlFor="dashboard-copilot-query">{translate("copilot.placeholder")}</label>
      <span className="copilot-search-icon"><Icon name="knowledge" size={16} /></span>
      <input ref={triggerRef} id="dashboard-copilot-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} aria-label={translate("copilot.placeholder")} />
      <select value={mode} onChange={(event) => setMode(event.target.value as CopilotMode)} aria-label={translate("copilot.questionMode")}>
        <option value="ask">{translate("copilot.questionMode")}</option><option value="search">{translate("copilot.searchMode")}</option>
      </select>
      <button type="submit" className="copilot-submit" disabled={!query.trim() || loading}>{translate("copilot.search")}</button>
    </form>
    <div className="copilot-runtime-meta"><StatusBadge status={stateTone}>{stateLabel}</StatusBadge>{runtime ? <span>{translate("copilot.documents")} {runtime.knowledge.documents} · {translate("copilot.embedded")} {runtime.knowledge.embeddedChunks}</span> : null}{canSync ? <button type="button" className="text-button" onClick={() => void sync()} disabled={syncing}>{syncing ? translate("copilot.syncing") : translate("copilot.sync")}</button> : null}</div>

    {open ? <div className="copilot-drawer-layer" role="presentation" onMouseDown={close}>
      <aside ref={dialogRef} className="copilot-drawer" role="dialog" aria-modal="true" aria-labelledby="copilot-drawer-title" onMouseDown={(event) => event.stopPropagation()} onKeyDown={trapFocus}>
        <header><div><span className="eyebrow">RAG · {translate("copilot.readOnly")}</span><h3 id="copilot-drawer-title">{translate("copilot.title")}</h3><StatusBadge status={stateTone}>{stateLabel}</StatusBadge></div><button ref={closeRef} type="button" className="copilot-close" onClick={close} aria-label={translate("copilot.close")}>×</button></header>
        <section className="copilot-question"><strong>{translate("copilot.question")}</strong><p>{query || translate("copilot.placeholder")}</p></section>
        {!loading && !answer && !results && !requestError ? <section className="copilot-suggestions"><strong>{translate("copilot.recommendation")}</strong>{suggestions.length ? <div>{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => void submit(suggestion)}>{suggestion}</button>)}</div> : <p>{translate("copilot.runtimeContext")}</p>}</section> : null}
        {loading ? <section className="copilot-loading"><span className="copilot-spinner" aria-hidden="true" />{translate("copilot.loading")}<button type="button" className="text-button" onClick={() => requestRef.current?.abort()}>{translate("copilot.cancel")}</button></section> : null}
        {requestError ? <section className="copilot-error"><strong>{translate("copilot.error")}</strong><p>{requestError}</p><button type="button" onClick={() => void submit()}>{translate("copilot.retry")}</button></section> : null}
        {answer ? <><section className="copilot-answer"><strong>{translate("copilot.answer")}</strong><p>{answer.answer}</p><small>{translate("copilot.humanReview")}</small>{data.auth.role === "ADMIN" ? <button type="button" className="text-button" onClick={() => void createDecision()} disabled={decisionBusy || !answer.references.length}>{decisionBusy ? "분석 제안 생성 중" : "근거 기반 제안 만들기"}</button> : null}</section><ReferenceList references={answer.references} title={translate("copilot.references")} empty={translate("copilot.noReferences")} /></> : null}
        {decision ? <section className="copilot-context"><strong>Decision Engine · {decision.status}</strong><p>{decision.summary}</p><small>제안만 기록되었으며, 외부 서비스 실행은 수행되지 않았습니다.</small></section> : null}
        {results ? <ReferenceList references={results} title={translate("copilot.searchResults")} empty={translate("copilot.noResults")} /> : null}
        <section className="copilot-context"><strong>{translate("copilot.context")}</strong><p>{translate("copilot.runtimeContext")}</p><dl><dt>ecosystemStatus</dt><dd>{context.ecosystemStatus || "NO_DATA"}</dd><dt>activeEvents</dt><dd>{displayValue(context.activeEvents)}</dd><dt>approvalBacklog</dt><dd>{displayValue(context.approvalBacklog)}</dd><dt>processingBacklog</dt><dd>{displayValue(context.processingBacklog)}</dd><dt>balanceStatus</dt><dd>{context.balanceStatus || "NO_DATA"}</dd></dl></section>
      </aside>
    </div> : null}
  </div>;
}

function ReferenceList({ references, title, empty }: { references: RagReference[]; title: string; empty: string }) {
  return <section className="copilot-references"><strong>{title}</strong>{references.length ? <ol>{references.map((reference, index) => <li key={`${reference.path}-${reference.heading}-${index}`}><b>{reference.title}</b>{reference.heading ? <span>{reference.heading}</span> : null}<p>{reference.chunkText}</p><small>score {reference.score.toFixed(3)} · Obsidian</small></li>)}</ol> : <p>{empty}</p>}</section>;
}

function deriveState(runtime: AiRuntime | null, error: string | null): CopilotState {
  if (error || !runtime) return "UNAVAILABLE";
  if (!runtime.obsidian.configured || !runtime.obsidian.reachable) return "VAULT_UNAVAILABLE";
  if (!runtime.vectorStore.databaseConnected || !runtime.vectorStore.extensionInstalled || !runtime.vectorStore.indexReady) return "VECTOR_UNAVAILABLE";
  if (!runtime.chatModel.available || !runtime.embeddingModel.available) return "MODEL_UNAVAILABLE";
  if (runtime.knowledge.pendingEmbeddings > 0 || runtime.knowledge.embeddedChunks === 0) return "SYNC_REQUIRED";
  if (runtime.rag.lastError || runtime.status === "degraded") return "DEGRADED";
  return runtime.rag.ready ? "READY" : "DEGRADED";
}
function labelForState(state: CopilotState, translate: (key: TranslationKey) => string) {
  return translate(({ READY: "copilot.ready", SYNC_REQUIRED: "copilot.syncRequired", MODEL_UNAVAILABLE: "copilot.modelUnavailable", VECTOR_UNAVAILABLE: "copilot.vectorUnavailable", VAULT_UNAVAILABLE: "copilot.vaultUnavailable", DEGRADED: "copilot.degraded", UNAVAILABLE: "copilot.unavailable" } as const)[state]);
}
function toneForState(state: CopilotState): SemanticStatus { return state === "READY" ? "healthy" : state === "SYNC_REQUIRED" ? "warning" : state === "DEGRADED" ? "degraded" : "disconnected"; }
function buildRuntimeContext(data: AppData): RagRuntimeContext {
  return {
    ecosystemStatus: data.ecosystem?.status,
    services: Object.values(data.ecosystem?.services ?? {}).map((service) => ({ name: service.name, status: service.status })),
    activeEvents: data.liveFlow?.active_flows ?? null,
    approvalBacklog: data.liveFlow?.approvalBacklog ?? null,
    processingBacklog: data.liveFlow?.processingBacklog ?? null,
    balanceStatus: data.balance?.balanceStatus ?? null,
    balanceReason: data.balance?.reviewReason ?? null,
    recentEvents: data.liveFlowEvents.slice(0, 20).map((event) => ({ eventType: event.event_type, source: event.from_node, target: event.to_node, entityId: event.entity_id, correlationId: event.correlation_id, status: event.status })),
  };
}
function buildSuggestions(data: AppData, translate: (key: TranslationKey) => string) {
  const suggestions: string[] = [];
  if ((data.liveFlow?.approvalBacklog ?? 0) > 0) suggestions.push(translate("copilot.suggestionApproval"));
  if ((data.liveFlow?.processingBacklog ?? 0) > 0) suggestions.push(translate("copilot.suggestionBacklog"));
  if (data.balance?.balanceStatus === "PARTIAL_DATA") suggestions.push(translate("copilot.suggestionBalance"));
  const recent = data.liveFlowEvents.find((event) => /warning|failed|critical|delayed/i.test(`${event.status} ${event.severity}`));
  if (recent?.correlation_id) suggestions.push(interpolate(translate("copilot.suggestionCorrelation"), { id: recent.correlation_id }));
  return suggestions.slice(0, 4);
}
function interpolate(template: string, variables: Record<string, string>) { return Object.entries(variables).reduce((text, [key, value]) => text.split(`{${key}}`).join(value), template); }
function safeError(error: unknown) { return String(error instanceof Error ? error.message : error).replace(/(sk-[\w-]+|password=[^\s&]+|token=[^\s&]+)/gi, "[redacted]").slice(0, 280); }
function displayValue(value: number | null | undefined) { return typeof value === "number" ? value.toLocaleString() : "NO_DATA"; }
