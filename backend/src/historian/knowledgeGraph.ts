import { createHash } from "node:crypto";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import type { BatchResult, DailyReportRow, NightlyReviewSummary } from "../batches/types.js";
import type { ExportResult } from "./types.js";

export type KnowledgeNodeType =
  | "task"
  | "builder_result"
  | "reviewer_result"
  | "decision"
  | "incident"
  | "daily_report"
  | "nightly_review"
  | "batch_run"
  | "command"
  | "obsidian_note"
  | "architecture_note"
  | "architecture_review";

export type KnowledgeEdgeType =
  | "relates_to"
  | "produced"
  | "reviewed_by"
  | "decided_by"
  | "exported_to"
  | "caused_by"
  | "resolved_by"
  | "mentioned_in"
  | "follows"
  | "blocks"
  | "reviewed_architecture_of"
  | "recommends"
  | "conflicts_with"
  | "references_memory";

export type KnowledgeNode = {
  id: string;
  node_type: KnowledgeNodeType;
  title: string;
  summary: string | null;
  source: string | null;
  external_ref: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type KnowledgeEdge = {
  id: string;
  from_node_id: string;
  to_node_id: string;
  edge_type: KnowledgeEdgeType;
  confidence: number;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type KnowledgeGraphNode = {
  id: string;
  type: string;
  label: string;
  title: string;
  summary: string | null;
  source: string | null;
  externalRef: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type KnowledgeGraphEdge = {
  id: string;
  from: string;
  to: string;
  type: string;
  label: string;
  confidence: number | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export async function upsertKnowledgeNode(input: {
  node_type: KnowledgeNodeType;
  title: string;
  summary?: string | null;
  source?: string | null;
  external_ref?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const payload = {
    node_type: input.node_type,
    title: input.title,
    summary: input.summary ?? null,
    source: input.source ?? null,
    external_ref: input.external_ref ?? null,
    metadata: input.metadata ?? {},
  };

  if (payload.external_ref) {
    const { data: existing, error: selectError } = await supabaseAdmin
      .from("knowledge_nodes")
      .select("*")
      .eq("node_type", payload.node_type)
      .eq("external_ref", payload.external_ref)
      .maybeSingle();

    if (selectError) {
      throw new Error(`Failed to read knowledge node: ${selectError.message}`);
    }

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from("knowledge_nodes")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error) {
        throw new Error(`Failed to update knowledge node: ${error.message}`);
      }

      return data as KnowledgeNode;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("knowledge_nodes")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create knowledge node: ${error.message}`);
  }

  return data as KnowledgeNode;
}

export async function createKnowledgeEdge(input: {
  from_node_id: string;
  to_node_id: string;
  edge_type: KnowledgeEdgeType;
  confidence?: number;
  metadata?: Record<string, unknown>;
}) {
  const payload = {
    from_node_id: input.from_node_id,
    to_node_id: input.to_node_id,
    edge_type: input.edge_type,
    confidence: input.confidence ?? 1,
    metadata: input.metadata ?? {},
  };

  const { data, error } = await supabaseAdmin
    .from("knowledge_edges")
    .upsert(payload, { onConflict: "from_node_id,to_node_id,edge_type" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create knowledge edge: ${error.message}`);
  }

  return data as KnowledgeEdge;
}

export async function linkDailyReportExport(report: DailyReportRow, exportResult: ExportResult) {
  const reportNode = await upsertKnowledgeNode({
    node_type: "daily_report",
    title: `Daily Report ${report.target_date}`,
    summary: report.status_reason,
    source: "archiveos",
    external_ref: `daily_report:${report.target_date}`,
    metadata: {
      report_id: report.id,
      status: report.status,
      discord_sent: report.discord_sent,
      warnings: report.warnings,
    },
  });

  await createIncidentNodes(reportNode, report.target_date, report.warnings);

  if (!exportResult.success || !exportResult.notePath) {
    return reportNode;
  }

  const noteNode = await upsertKnowledgeNode({
    node_type: "obsidian_note",
    title: exportResult.notePath.split("/").pop() ?? exportResult.notePath,
    summary: "Obsidian Markdown export for daily report.",
    source: "obsidian",
    external_ref: exportResult.notePath,
    metadata: {
      note_path: exportResult.notePath,
      source_report_id: report.id,
    },
  });

  await createKnowledgeEdge({
    from_node_id: reportNode.id,
    to_node_id: noteNode.id,
    edge_type: "exported_to",
    metadata: { reason: "daily_report_export" },
  });

  return reportNode;
}

export async function linkNightlyReviewExport(
  batch: BatchResult,
  summary: NightlyReviewSummary,
  exportResult: ExportResult,
) {
  const nightlyNode = await upsertKnowledgeNode({
    node_type: "nightly_review",
    title: `Nightly Review ${batch.target_date}`,
    summary: summary.statusReason,
    source: "archiveos",
    external_ref: `nightly_review:${batch.target_date}`,
    metadata: {
      batch_id: batch.id ?? null,
      queue: summary.queue,
      warnings: summary.warnings,
    },
  });

  await linkBuilderReviewerResult(summary, nightlyNode.id);
  await createIncidentNodes(nightlyNode, batch.target_date, summary.warnings);
  await createDecisionNodes(nightlyNode, batch.target_date, summary.decisions.recent);
  await createCommandNodes(nightlyNode, batch.target_date, summary.commands.recent);

  if (!exportResult.success || !exportResult.notePath) {
    return nightlyNode;
  }

  const noteNode = await upsertKnowledgeNode({
    node_type: "obsidian_note",
    title: exportResult.notePath.split("/").pop() ?? exportResult.notePath,
    summary: "Obsidian Markdown export for nightly review.",
    source: "obsidian",
    external_ref: exportResult.notePath,
    metadata: {
      note_path: exportResult.notePath,
      source_batch_id: batch.id ?? null,
    },
  });

  await createKnowledgeEdge({
    from_node_id: nightlyNode.id,
    to_node_id: noteNode.id,
    edge_type: "exported_to",
    metadata: { reason: "nightly_review_export" },
  });

  return nightlyNode;
}

export async function linkBuilderReviewerResult(summary: NightlyReviewSummary, parentNodeId?: string) {
  const builder = summary.latestBuilder;
  const reviewer = summary.latestReviewer;
  let builderNode: KnowledgeNode | null = null;
  let reviewerNode: KnowledgeNode | null = null;

  if (builder) {
    const externalRef = builder.result_name ?? builder.task_id ?? null;
    builderNode = await upsertKnowledgeNode({
      node_type: "builder_result",
      title: builder.task_id ?? builder.result_name ?? "Builder result",
      summary: builder.summary,
      source: "mcp",
      external_ref: externalRef,
      metadata: {
        status: builder.status,
        finished_at: builder.finished_at,
        result_name: builder.result_name,
      },
    });
  }

  if (reviewer) {
    const externalRef = reviewer.review_name ?? reviewer.reviewed_task_id ?? null;
    reviewerNode = await upsertKnowledgeNode({
      node_type: "reviewer_result",
      title: reviewer.reviewed_task_id ?? reviewer.review_name ?? "Reviewer result",
      summary: reviewer.summary,
      source: "mcp",
      external_ref: externalRef,
      metadata: {
        verdict: reviewer.verdict,
        reviewed_at: reviewer.reviewed_at,
        review_name: reviewer.review_name,
      },
    });
  }

  if (builderNode && reviewerNode) {
    await createKnowledgeEdge({
      from_node_id: builderNode.id,
      to_node_id: reviewerNode.id,
      edge_type: "reviewed_by",
      metadata: { reason: "same_nightly_review" },
    });
  }

  if (parentNodeId && builderNode) {
    await createKnowledgeEdge({
      from_node_id: parentNodeId,
      to_node_id: builderNode.id,
      edge_type: "mentioned_in",
      metadata: { reason: "latest_builder_in_batch_summary" },
    });
  }

  if (parentNodeId && reviewerNode) {
    await createKnowledgeEdge({
      from_node_id: parentNodeId,
      to_node_id: reviewerNode.id,
      edge_type: "mentioned_in",
      metadata: { reason: "latest_reviewer_in_batch_summary" },
    });
  }
}

export async function getKnowledgeOverview() {
  const [nodesResult, edgesResult, latestNodes, latestEdges] = await Promise.all([
    supabaseAdmin.from("knowledge_nodes").select("node_type", { count: "exact", head: false }),
    supabaseAdmin.from("knowledge_edges").select("edge_type", { count: "exact", head: false }),
    getRecentKnowledgeNodes(8),
    getRecentKnowledgeEdges(8),
  ]);

  if (nodesResult.error) throw nodesResult.error;
  if (edgesResult.error) throw edgesResult.error;

  const countsByType = (nodesResult.data ?? []).reduce<Record<string, number>>((acc, node) => {
    const type = String(node.node_type);
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totalNodes: nodesResult.count ?? 0,
    totalEdges: edgesResult.count ?? 0,
    countsByType,
    latestNodes,
    latestEdges,
  };
}

export async function getRecentKnowledgeNodes(limit = 20) {
  const { data, error } = await supabaseAdmin
    .from("knowledge_nodes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(clampLimit(limit));

  if (error) throw error;
  return (data ?? []) as KnowledgeNode[];
}

export async function getRecentKnowledgeEdges(limit = 20) {
  const { data, error } = await supabaseAdmin
    .from("knowledge_edges")
    .select("*, from_node:knowledge_nodes!knowledge_edges_from_node_id_fkey(*), to_node:knowledge_nodes!knowledge_edges_to_node_id_fkey(*)")
    .order("created_at", { ascending: false })
    .limit(clampLimit(limit));

  if (error) throw error;
  return data ?? [];
}

export async function getKnowledgeGraph(limit = 100) {
  const safeLimit = Math.min(Math.max(Number.isFinite(limit) ? Math.floor(limit) : 100, 1), 300);
  const [nodesResult, edgesResult] = await Promise.all([
    supabaseAdmin
      .from("knowledge_nodes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(safeLimit),
    supabaseAdmin
      .from("knowledge_edges")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(safeLimit * 2),
  ]);

  if (nodesResult.error || edgesResult.error) {
    return {
      nodes: [] as KnowledgeGraphNode[],
      edges: [] as KnowledgeGraphEdge[],
      stats: {
        nodeCount: 0,
        edgeCount: 0,
        types: {} as Record<string, number>,
      },
    };
  }

  const includedIds = new Set((nodesResult.data ?? []).map((node) => node.id));
  const nodes = (nodesResult.data ?? []).map(toGraphNode);
  const edges = (edgesResult.data ?? [])
    .filter((edge) => includedIds.has(edge.from_node_id) && includedIds.has(edge.to_node_id))
    .slice(0, safeLimit)
    .map(toGraphEdge);
  const types = nodes.reduce<Record<string, number>>((acc, node) => {
    acc[node.type] = (acc[node.type] ?? 0) + 1;
    return acc;
  }, {});

  return {
    nodes,
    edges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      types,
    },
  };
}

export async function getKnowledgeNode(id: string) {
  const { data: node, error } = await supabaseAdmin
    .from("knowledge_nodes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;

  const [outgoing, incoming] = await Promise.all([
    supabaseAdmin
      .from("knowledge_edges")
      .select("*, to_node:knowledge_nodes!knowledge_edges_to_node_id_fkey(*)")
      .eq("from_node_id", id),
    supabaseAdmin
      .from("knowledge_edges")
      .select("*, from_node:knowledge_nodes!knowledge_edges_from_node_id_fkey(*)")
      .eq("to_node_id", id),
  ]);

  if (outgoing.error) throw outgoing.error;
  if (incoming.error) throw incoming.error;

  return {
    node: node as KnowledgeNode,
    outgoing: outgoing.data ?? [],
    incoming: incoming.data ?? [],
    related: [...(outgoing.data ?? []), ...(incoming.data ?? [])],
  };
}

export async function searchKnowledge(query: string, limit = 20) {
  const clean = query.trim();
  if (!clean) return [];

  const pattern = `%${clean.replace(/[%_]/g, "\\$&")}%`;
  const { data, error } = await supabaseAdmin
    .from("knowledge_nodes")
    .select("*")
    .or(`title.ilike.${pattern},summary.ilike.${pattern},external_ref.ilike.${pattern}`)
    .order("created_at", { ascending: false })
    .limit(clampLimit(limit));

  if (error) throw error;
  return (data ?? []) as KnowledgeNode[];
}

export async function getRelatedKnowledge(input: {
  external_ref?: string | null;
  node_type?: string | null;
}) {
  const externalRef = input.external_ref?.trim();
  const nodeType = input.node_type?.trim();

  if (!externalRef && !nodeType) {
    return [];
  }

  let query = supabaseAdmin.from("knowledge_nodes").select("*").limit(10);
  if (externalRef) query = query.eq("external_ref", externalRef);
  if (nodeType) query = query.eq("node_type", nodeType);

  const { data: nodes, error } = await query;
  if (error) throw error;

  const related = [];
  for (const node of nodes ?? []) {
    related.push(await getKnowledgeNode(node.id));
  }

  return related;
}

async function createIncidentNodes(parentNode: KnowledgeNode, date: string, warnings: string[]) {
  for (const warning of warnings) {
    const incidentNode = await upsertKnowledgeNode({
      node_type: "incident",
      title: warning.slice(0, 96),
      summary: warning,
      source: "archiveos",
      external_ref: `incident:${date}:${hashText(warning)}`,
      metadata: {
        severity: warning.includes("실패") || warning.includes("문제") ? "error" : "warning",
        warning,
      },
    });

    await createKnowledgeEdge({
      from_node_id: incidentNode.id,
      to_node_id: parentNode.id,
      edge_type: "mentioned_in",
      metadata: { reason: "same_daily_report" },
    });
  }
}

async function createDecisionNodes(parentNode: KnowledgeNode, date: string, decisions: string[]) {
  for (const decision of decisions) {
    const decisionNode = await upsertKnowledgeNode({
      node_type: "decision",
      title: decision.slice(0, 96),
      summary: decision,
      source: "supabase",
      external_ref: `decision:${date}:${hashText(decision)}`,
      metadata: {
        reason: "recent_decision_in_nightly_review",
      },
    });

    await createKnowledgeEdge({
      from_node_id: decisionNode.id,
      to_node_id: parentNode.id,
      edge_type: "mentioned_in",
      metadata: { reason: "same_nightly_review" },
    });
  }
}

async function createCommandNodes(parentNode: KnowledgeNode, date: string, commands: string[]) {
  for (const command of commands) {
    const commandNode = await upsertKnowledgeNode({
      node_type: "command",
      title: command.slice(0, 96),
      summary: command,
      source: "supabase",
      external_ref: `command:${date}:${hashText(command)}`,
      metadata: {
        reason: "recent_command_in_nightly_review",
      },
    });

    await createKnowledgeEdge({
      from_node_id: commandNode.id,
      to_node_id: parentNode.id,
      edge_type: "mentioned_in",
      metadata: { reason: "same_nightly_review" },
    });
  }
}

function hashText(value: string) {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function clampLimit(value: number) {
  return Math.min(Math.max(Number.isFinite(value) ? Math.floor(value) : 20, 1), 100);
}

function toGraphNode(node: KnowledgeNode): KnowledgeGraphNode {
  return {
    id: node.id,
    type: node.node_type,
    label: buildNodeLabel(node),
    title: node.title,
    summary: node.summary,
    source: node.source,
    externalRef: node.external_ref,
    createdAt: node.created_at,
    metadata: sanitizeMetadata(node.metadata),
  };
}

function toGraphEdge(edge: KnowledgeEdge): KnowledgeGraphEdge {
  return {
    id: edge.id,
    from: edge.from_node_id,
    to: edge.to_node_id,
    type: edge.edge_type,
    label: edge.edge_type,
    confidence: edge.confidence ?? null,
    createdAt: edge.created_at,
    metadata: sanitizeMetadata(edge.metadata),
  };
}

function buildNodeLabel(node: KnowledgeNode) {
  const raw = node.external_ref?.split("/").pop() ?? node.title;
  return raw.length > 42 ? `${raw.slice(0, 39)}...` : raw;
}

function sanitizeMetadata(metadata: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata ?? {})) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes("vault") || lowerKey.includes("absolute") || lowerKey.includes("secret") || lowerKey.includes("webhook")) {
      continue;
    }

    clean[key] = sanitizeMetadataValue(value);
  }

  return clean;
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (/^[A-Za-z]:\\/.test(value)) {
      return value.split(/[\\/]/).pop() ?? "[local-path-hidden]";
    }
    return value;
  }

  if (Array.isArray(value)) return value.map(sanitizeMetadataValue);

  if (value && typeof value === "object") {
    return sanitizeMetadata(value as Record<string, unknown>);
  }

  return value;
}
