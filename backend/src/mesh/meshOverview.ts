import { getLatestArchitectureReview } from "../architect/index.js";
import { getLatestDailyReport, getLatestHistorianExport } from "../batches/store.js";
import { getRecentKnowledgeEdges, isHistorianConfigured } from "../historian/index.js";
import { getLocalRuntimeStatus } from "../lib/localRuntime.js";
import type { MeshAgent, MeshInteraction, MeshLink, MeshOverview } from "./types.js";

type KnowledgeEdgeWithNodes = {
  id: string;
  edge_type: string;
  created_at: string;
  metadata?: Record<string, unknown>;
  from_node?: {
    node_type?: string;
    title?: string;
    external_ref?: string | null;
  };
  to_node?: {
    node_type?: string;
    title?: string;
    external_ref?: string | null;
  };
};

export async function getAgentMeshOverview(): Promise<MeshOverview> {
  const [runtime, architect, latestExport, latestDailyReport, knowledgeEdges] = await Promise.all([
    getLocalRuntimeStatus(),
    getLatestArchitectureReview().catch(() => null),
    getLatestHistorianExport().catch(() => null),
    getLatestDailyReport().catch(() => null),
    getRecentKnowledgeEdges(12).catch(() => []),
  ]);

  const agents: MeshAgent[] = [
    {
      id: "implementer",
      label: "Implementer",
      role: "Code implementation",
      status: runtime.queue.processing > 0 ? "working" : runtime.processes.implementer ? "detected" : "not_detected",
      source: "runtime",
      summary: runtime.active_task
        ? `Active task: ${runtime.active_task}`
        : runtime.processes.implementer
          ? "Implementer process detected, no active processing task."
          : "Implementer process not detected.",
      metadata: {
        pid: runtime.processes.implementer?.pid ?? null,
        cpu: runtime.processes.implementer?.cpu ?? null,
        active_task: runtime.active_task,
      },
    },
    {
      id: "reviewer",
      label: "Reviewer",
      role: "Code review and approval",
      status: runtime.processes.reviewer ? "detected" : runtime.latest_details.reviewer?.verdict ? "idle" : "not_detected",
      source: "runtime",
      summary: runtime.latest_details.reviewer?.verdict
        ? `Latest verdict: ${runtime.latest_details.reviewer.verdict}`
        : "No reviewer verdict detected yet.",
      metadata: {
        pid: runtime.processes.reviewer?.pid ?? null,
        verdict: runtime.latest_details.reviewer?.verdict ?? null,
        review_name: runtime.latest.review?.name ?? null,
      },
    },
    {
      id: "architect",
      label: "Architect",
      role: "Architecture risk review",
      status: architect ? (architect.status === "reviewed" ? "clear" : architect.status) : "no_review",
      source: "architect",
      summary: architect?.summary ?? "No architecture review recorded yet.",
      metadata: {
        review_id: architect?.id ?? null,
        target_ref: architect?.target_ref ?? null,
        findings_count: architect?.findings.length ?? 0,
        recommendations_count: architect?.recommendations.length ?? 0,
      },
    },
    {
      id: "historian",
      label: "Historian",
      role: "Long-term memory and Obsidian export",
      status: isHistorianConfigured() ? latestExport?.status === "failed" ? "warning" : "enabled" : "disabled",
      source: "historian",
      summary: latestExport
        ? `Latest export: ${latestExport.status}${latestExport.note_path ? ` / ${latestExport.note_path}` : ""}`
        : isHistorianConfigured()
          ? "Historian configured, no export yet."
          : "Historian vault path not configured.",
      metadata: {
        configured: isHistorianConfigured(),
        latest_export_status: latestExport?.status ?? null,
        latest_note_path: latestExport?.note_path ?? null,
      },
    },
    {
      id: "loop",
      label: "MCP Loop",
      role: "Queue runner",
      status: runtime.queue.processing > 0 ? "working" : runtime.processes.loop ? "idle" : runtime.queue.inbox > 0 ? "warning" : "not_detected",
      source: "runtime",
      summary: `Queue: inbox ${runtime.queue.inbox}, processing ${runtime.queue.processing}, outbox ${runtime.queue.outbox}, reviews ${runtime.queue.reviews}.`,
      metadata: {
        pid: runtime.processes.loop?.pid ?? null,
        queue: runtime.queue,
      },
    },
    {
      id: "bridge",
      label: "Reviewer Bridge",
      role: "Review handoff bridge",
      status: runtime.processes.reviewer_bridge ? "detected" : "not_detected",
      source: "runtime",
      summary: runtime.processes.reviewer_bridge ? "Reviewer bridge process detected." : "Reviewer bridge process not detected.",
      metadata: {
        pid: runtime.processes.reviewer_bridge?.pid ?? null,
      },
    },
  ];

  const links = buildStaticLinks(runtime.queue.processing > 0 || Boolean(runtime.latest.outbox), architect?.status ?? null);
  const graphLinks = mapKnowledgeEdgesToLinks(knowledgeEdges as KnowledgeEdgeWithNodes[]);
  const recentInteractions = buildRecentInteractions(runtime.checked_at, knowledgeEdges as KnowledgeEdgeWithNodes[], links);
  const warnings = [
    ...(latestDailyReport?.warnings ?? []),
    ...(runtime.queue.inbox > 0 && !runtime.processes.loop ? ["Inbox has work but loop process was not detected."] : []),
    ...(architect?.status === "blocked" ? ["Architect review is blocked."] : []),
  ];

  const blocked = architect?.status === "blocked";
  const health = {
    status: blocked ? "blocked" as const : warnings.length ? "warning" as const : "healthy" as const,
    summary: blocked
      ? "Architect reported a blocked architecture risk."
      : warnings[0] ?? "Agent mesh has no blocking signal.",
  };

  return {
    agents,
    links: [...links, ...graphLinks].slice(0, 16),
    recentInteractions,
    health,
  };
}

function buildStaticLinks(activeBuilderFlow: boolean, architectStatus: string | null): MeshLink[] {
  return [
    {
      from: "loop",
      to: "implementer",
      type: "dispatches",
      label: "queue task",
      strength: 1,
      recent: activeBuilderFlow,
      source: "runtime",
    },
    {
      from: "implementer",
      to: "reviewer",
      type: "hands_off_to",
      label: "builder result -> review",
      strength: 1,
      recent: activeBuilderFlow,
      source: "knowledge_graph",
    },
    {
      from: "reviewer",
      to: "human_pm",
      type: "produces_verdict",
      label: "verdict",
      strength: 1,
      recent: true,
      source: "derived",
    },
    {
      from: "architect",
      to: "reviewer",
      type: "guards",
      label: "architecture risk",
      strength: 0.8,
      recent: architectStatus === "warning" || architectStatus === "blocked",
      source: "architect",
    },
    {
      from: "historian",
      to: "architect",
      type: "provides_memory",
      label: "related context",
      strength: 0.7,
      recent: true,
      source: "historian",
    },
    {
      from: "bridge",
      to: "reviewer",
      type: "hands_off_to",
      label: "review bridge",
      strength: 0.8,
      recent: false,
      source: "runtime",
    },
  ];
}

function mapKnowledgeEdgesToLinks(edges: KnowledgeEdgeWithNodes[]): MeshLink[] {
  return edges.flatMap((edge) => {
    const mapped = mapNodeTypesToAgents(edge.from_node?.node_type, edge.to_node?.node_type);
    if (!mapped) return [];

    return [{
      from: mapped.from,
      to: mapped.to,
      type: edge.edge_type,
      label: formatEdgeLabel(edge),
      strength: 0.6,
      recent: isRecent(edge.created_at),
      source: "knowledge_graph" as const,
    }];
  });
}

function buildRecentInteractions(checkedAt: string, edges: KnowledgeEdgeWithNodes[], links: MeshLink[]): MeshInteraction[] {
  const graphInteractions = edges.flatMap((edge) => {
    const mapped = mapNodeTypesToAgents(edge.from_node?.node_type, edge.to_node?.node_type);
    if (!mapped) return [];

    return [{
      time: edge.created_at,
      from: mapped.from,
      to: mapped.to,
      type: edge.edge_type,
      summary: formatEdgeLabel(edge),
      source: "knowledge_graph" as const,
    }];
  });

  const derived = links
    .filter((link) => link.recent)
    .map((link) => ({
      time: checkedAt,
      from: link.from,
      to: link.to,
      type: link.type,
      summary: link.label,
      source: link.source,
    }));

  return [...graphInteractions, ...derived]
    .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
    .slice(0, 12);
}

function mapNodeTypesToAgents(fromType?: string, toType?: string) {
  if (fromType === "builder_result" && toType === "reviewer_result") return { from: "implementer", to: "reviewer" };
  if (fromType === "daily_report" && toType === "obsidian_note") return { from: "historian", to: "human_pm" };
  if (fromType === "nightly_review" && toType === "obsidian_note") return { from: "historian", to: "human_pm" };
  if (fromType === "architecture_review") return { from: "architect", to: agentForNodeType(toType) };
  if (toType === "architecture_review") return { from: agentForNodeType(fromType), to: "architect" };
  if (fromType === "decision" && toType === "daily_report") return { from: "human_pm", to: "historian" };
  if (fromType === "incident" && toType === "daily_report") return { from: "loop", to: "historian" };
  return null;
}

function agentForNodeType(nodeType?: string) {
  if (nodeType === "reviewer_result") return "reviewer";
  if (nodeType === "builder_result") return "implementer";
  if (nodeType === "obsidian_note" || nodeType === "daily_report" || nodeType === "nightly_review") return "historian";
  if (nodeType === "decision") return "human_pm";
  return "human_pm";
}

function formatEdgeLabel(edge: KnowledgeEdgeWithNodes) {
  const from = edge.from_node?.title ?? edge.from_node?.node_type ?? "source";
  const to = edge.to_node?.title ?? edge.to_node?.node_type ?? "target";
  return `${from} ${edge.edge_type} ${to}`;
}

function isRecent(value: string) {
  const ageMs = Date.now() - new Date(value).getTime();
  return Number.isFinite(ageMs) && ageMs < 1000 * 60 * 60 * 24;
}
