import { en } from "./en";
import { ja } from "./ja";
import { ko } from "./ko";
import type { Locale, TranslationKey, TranslationTable } from "./types";
import { zhCN } from "./zh-CN";

export type { Locale, TranslationKey, TranslationTable };

export const defaultLocale: Locale = "ko";

export const languageOptions: Array<{ code: Locale; labelKey: TranslationKey }> = [
  { code: "ko", labelKey: "common.language.korean" },
  { code: "en", labelKey: "common.language.english" },
  { code: "ja", labelKey: "common.language.japanese" },
  { code: "zh-CN", labelKey: "common.language.chinese" },
];

export const translations: Record<Locale, TranslationTable> = {
  ko,
  en,
  ja,
  "zh-CN": zhCN,
};

const sourceTexts: Partial<Record<TranslationKey, string[]>> = {
  "common.refresh": ["Refresh", "새로고침", "Refresh all operational data"],
  "common.updated": ["Updated"],
  "common.waiting": ["waiting", "Waiting"],
  "common.loading": ["Loading"],
  "common.owner": ["Owner"],
  "common.nextAction": ["Next action"],
  "common.noActionRequired": ["No action required"],
  "common.noEvents": ["No operational events have been recorded yet."],
  "common.approvalRequired": ["Approval Required", "approval required", "APPROVAL_REQUIRED"],
  "common.notRequired": ["Not required"],
  "common.running": ["Running", "RUNNING"],
  "common.stopped": ["Stopped", "STOPPED"],
  "common.healthy": ["Healthy", "healthy", "HEALTHY", "NORMAL", "normal"],
  "common.degraded": ["Degraded", "degraded", "DEGRADED"],
  "common.unavailable": ["Unavailable", "unavailable", "UNAVAILABLE"],
  "common.notConnected": ["Not connected", "not_connected", "NOT_CONNECTED"],
  "nav.overview": ["Overview"],
  "nav.home": ["Home"],
  "nav.agents": ["Agents"],
  "nav.managedSystems": ["Managed Systems"],
  "nav.tower": ["Tower"],
  "nav.ecosystem": ["Ecosystem"],
  "nav.ecosystemShort": ["Eco"],
  "nav.game": ["Ecosystem Survival Mode"],
  "nav.ledgerApprovals": ["Ledger Approvals"],
  "nav.ledger": ["Ledger"],
  "nav.workflows": ["Workflows"],
  "nav.flow": ["Flow"],
  "nav.knowledge": ["Knowledge"],
  "nav.memory": ["Memory"],
  "nav.history": ["History"],
  "nav.logs": ["Logs"],
  "nav.batch": ["Batch"],
  "nav.rpa": ["RPA"],
  "nav.atlas": ["Atlas"],
  "nav.mcpRegistry": ["MCP Registry"],
  "nav.settings": ["Settings"],
  "nav.config": ["Config"],
  "nav.overviewDesc": ["5-second PM operations summary"],
  "nav.agentsDesc": ["Agent availability and current responsibility"],
  "nav.managedDesc": ["Control Tower and PM Inbox"],
  "nav.ecosystemDesc": ["Nexus, Logistics, Ledger topology and degraded isolation"],
  "nav.gameDesc": ["Ecosystem simulation for synthetic settlement, risk, and cash flow control"],
  "nav.approvalsDesc": ["Archive-Ledger approval gateway"],
  "nav.workflowsDesc": ["Queue, agents, pipeline, and PM decisions"],
  "nav.knowledgeDesc": ["Operational memory, graph, RAG, and Obsidian"],
  "nav.historyDesc": ["Timeline, decisions, commands, errors, and KPI history"],
  "nav.batchDesc": ["Spring Batch jobs and execution evidence"],
  "nav.rpaDesc": ["Classified tasks and PM decision history"],
  "nav.atlasDesc": ["External Atlas platform status and Codex work log"],
  "nav.mcpDesc": ["Read-only tool capability and approval registry"],
  "nav.settingsDesc": ["Runtime, integrations, security, theme, and build status"],
  "overview.pmCommand": ["PM Command Center"],
  "overview.pmCommandEyebrow": ["Control Tower priority"],
  "overview.knowledgeStatus": ["Knowledge Status"],
  "overview.operationalMemory": ["Operational memory"],
  "overview.atlasStatus": ["Atlas Status"],
  "overview.externalPlatformWatch": ["External platform watch"],
  "overview.queueSummary": ["Queue Summary"],
  "overview.operationalEvents": ["Operational Events"],
  "overview.noActiveChain": ["No active chain"],
  "overview.queueClear": ["Queue is clear. New work will appear here when it enters the pipeline."],
  "overview.openWorkflow": ["Open workflow →"],
  "overview.exploreMemory": ["Explore memory →"],
  "managed.title": ["Managed Systems"],
  "managed.inbox": ["PM Inbox"],
  "managed.registry": ["System Registry"],
  "managed.serviceStatus": ["Service Status"],
  "managed.finance": ["System Finance", "Persisted System Finance"],
  "managed.exports": ["Exports"],
  "managed.imports": ["Imports"],
  "managed.cashBalance": ["Cash balance", "Cash Balance", "Ecosystem cash"],
  "managed.revenue": ["Revenue"],
  "managed.cost": ["Cost"],
  "managed.profit": ["Profit", "Daily profit"],
  "ecosystem.summary": ["Ecosystem Summary"],
  "ecosystem.topology": ["Ecosystem Topology"],
  "ecosystem.timeline": ["Ecosystem Timeline"],
  "ecosystem.refresh": ["Refresh ecosystem"],
  "ecosystem.dryRun": ["Run dry-run"],
  "ecosystem.safeModeBlocked": ["SAFE_MODE_BLOCKED", "Blocked by safe-mode"],
  "game.title": ["ArchiveOS - Ecosystem Survival Mode"],
  "game.defaultDryRun": ["Default dry-run"],
  "game.bankruptcyStress": ["Bankruptcy stress"],
  "game.bankruptcyRisk": ["Bankruptcy risk"],
  "game.agentProposals": ["Agent proposals", "Service Agent Proposals"],
  "game.settlementFlow": ["Settlement Operating Flow"],
  "game.eventTimeline": ["Game Event Timeline"],
  "game.noProposal": ["No bankruptcy prevention proposal is required for this tick."],
  "game.runDrySimulation": ["Run a dry simulation to persist system finance snapshots and trade ledger rows."],
  "approvals.title": ["Ledger Approvals"],
  "approvals.queue": ["Ledger Approval Queue"],
  "approvals.detail": ["Approval Detail"],
  "approvals.approve": ["Approve"],
  "approvals.reject": ["Reject"],
  "approvals.hold": ["Hold"],
  "approvals.callbackStatus": ["Callback status"],
  "approvals.evidence": ["Policy evidence", "RAG Evidence / Fallback Evidence"],
  "approvals.fallbackEvidence": ["Fallback evidence"],
  "approvals.noPending": ["No pending external approvals."],
  "workflows.pmInstruction": ["PM Work Instruction"],
  "workflows.queue": ["Workflow Queue"],
  "workflows.detail": ["Workflow Detail"],
  "workflows.noMatch": ["No workflows match this filter."],
  "workflows.select": ["Select a workflow to inspect its chain and PM decision state."],
  "workflows.decisionRecord": ["This records a PM decision and updates ArchiveOS task state."],
  "knowledge.ready": ["Ready"],
  "knowledge.nodes": ["Nodes"],
  "knowledge.relations": ["Relations"],
  "knowledge.rag": ["RAG"],
  "settings.operatorSignIn": ["Operator Sign In"],
  "settings.notPublic": ["Settings are not available to Public sessions"],
  "settings.appearance": ["Appearance"],
  "settings.backend": ["Backend"],
  "settings.database": ["Database"],
  "settings.security": ["Security"],
  "settings.buildInfo": ["Build Information"],
  "batch.jobs": ["Batch jobs"],
  "batch.execution": ["Execution history"],
  "rpa.classification": ["RPA classification"],
  "rpa.unavailable": ["RPA is unavailable."],
  "mcp.registry": ["MCP Registry"],
  "atlas.overview": ["Atlas Overview"],
  "outbox.pending": ["Pending", "PENDING"],
  "outbox.published": ["Published", "PUBLISHED"],
  "outbox.retry": ["Retry", "RETRY"],
  "outbox.failed": ["Failed", "FAILED"],
  "outbox.dryRun": ["DRY_RUN", "Dry-run"],
  "settlement.ready": ["Settlement ready", "SETTLEMENT_READY"],
  "settlement.settled": ["Settled", "SETTLED"],
  "settlement.dailyRun": ["Run daily settlement"],
  "reconciliation.summary": ["Reconciliation summary"],
  "reconciliation.result": ["Reconciliation result"],
  "reconciliation.mismatch": ["Mismatch"],
  "reconciliation.ok": ["OK"],
};

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === "en" || value === "ja" || value === "zh-CN" || value === "ko" ? value : defaultLocale;
}

export function readStoredLocale(): Locale {
  return normalizeLocale(window.localStorage.getItem("archive.locale") ?? window.localStorage.getItem("archiveos-language"));
}

export function t(key: TranslationKey, locale: Locale): string {
  return translations[locale]?.[key] ?? translations.ko[key] ?? key;
}

function buildReverseMap(locale: Locale) {
  const reverse = new Map<string, string>();
  const tables = Object.values(translations);
  for (const key of Object.keys(ko) as TranslationKey[]) {
    const target = t(key, locale);
    reverse.set(ko[key], target);
    for (const table of tables) {
      reverse.set(table[key], target);
    }
    for (const source of sourceTexts[key] ?? []) {
      reverse.set(source, target);
    }
  }
  return reverse;
}

function replacePreservingPadding(value: string, reverse: Map<string, string>) {
  const trimmed = value.trim();
  const replacement = reverse.get(trimmed);
  if (!replacement || replacement === trimmed) return value;
  return value.replace(trimmed, replacement);
}

function translateTextNodes(root: ParentNode, reverse: Map<string, string>) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ["SCRIPT", "STYLE", "CODE", "PRE", "OPTION"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return node.nodeValue?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    node.nodeValue = replacePreservingPadding(node.nodeValue ?? "", reverse);
  }
}

function translateAttributes(root: ParentNode, reverse: Map<string, string>) {
  const attributes = ["aria-label", "title", "placeholder"];
  const elements = root.querySelectorAll<HTMLElement>("[aria-label], [title], [placeholder]");
  for (const element of elements) {
    for (const attribute of attributes) {
      const value = element.getAttribute(attribute);
      if (value) element.setAttribute(attribute, replacePreservingPadding(value, reverse));
    }
  }
}

export function applyLocale(locale: Locale, _root: ParentNode = document.body) {
  const normalized = normalizeLocale(locale);
  window.localStorage.setItem("archive.locale", normalized);
  document.documentElement.lang = normalized;
  document.documentElement.dataset.language = normalized;
}
