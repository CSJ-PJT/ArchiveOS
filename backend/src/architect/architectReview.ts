import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  createKnowledgeEdge,
  searchKnowledge,
  upsertKnowledgeNode,
  type KnowledgeNode,
} from "../historian/index.js";
import { evaluateArchitectureRules } from "./architectureRules.js";
import type {
  ArchitectureReviewRow,
  ArchitectReviewInput,
  ArchitectReviewResult,
  ArchitectReviewStatus,
} from "./types.js";

export async function runArchitectReview(input: ArchitectReviewInput): Promise<ArchitectureReviewRow> {
  const relatedKnowledge = await findRelatedKnowledge(input);
  const evaluation = evaluateArchitectureRules(input);
  const status = deriveStatus(evaluation.findings.map((finding) => finding.severity));
  const summary = buildSummary(status, evaluation.findings.length);

  const { data, error } = await supabaseAdmin
    .from("architecture_reviews")
    .insert({
      target_type: input.targetType,
      target_ref: input.targetRef,
      status,
      summary,
      findings: evaluation.findings,
      recommendations: evaluation.recommendations,
      related_nodes: relatedKnowledge.map(toRelatedNode),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to record architecture review: ${error.message}`);
  }

  const row = data as ArchitectureReviewRow;
  await linkReviewToKnowledge(row, input, relatedKnowledge).catch(() => undefined);
  return row;
}

export async function getRecentArchitectureReviews(limit = 20) {
  const { data, error } = await supabaseAdmin
    .from("architecture_reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(clampLimit(limit));

  if (error) {
    throw new Error(`Failed to fetch architecture reviews: ${error.message}`);
  }

  return (data ?? []) as ArchitectureReviewRow[];
}

export async function getLatestArchitectureReview() {
  const { data, error } = await supabaseAdmin
    .from("architecture_reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch latest architecture review: ${error.message}`);
  }

  return data as ArchitectureReviewRow | null;
}

export async function runDemoArchitectureReview() {
  return runArchitectReview({
    targetType: "task",
    targetRef: "demo:add-process-control-buttons-to-dashboard",
    title: "Add process control buttons to Dashboard",
    description:
      "Add start process and stop process control buttons to Dashboard for operators. This is a manual demo review and must not execute anything.",
    metadata: {
      demo: true,
      source: "architect:review-demo",
    },
  });
}

function deriveStatus(severities: Array<"info" | "warning" | "blocked">): ArchitectReviewStatus {
  if (severities.includes("blocked")) return "blocked";
  if (severities.includes("warning")) return "warning";
  return "reviewed";
}

function buildSummary(status: ArchitectReviewStatus, findingCount: number) {
  if (status === "blocked") {
    return `Architect blocked this target with ${findingCount} finding(s).`;
  }

  if (status === "warning") {
    return `Architect found ${findingCount} design risk(s).`;
  }

  return "Architect review passed with no rule-based findings.";
}

async function findRelatedKnowledge(input: ArchitectReviewInput) {
  const exact = await findKnowledgeByExternalRef(input.targetRef);
  if (exact.length) return exact.slice(0, 5);

  const searched = await searchKnowledge(input.targetRef, 5).catch(() => []);
  if (searched.length) return searched;

  return searchKnowledge(input.title, 5).catch(() => []);
}

async function findKnowledgeByExternalRef(externalRef: string) {
  const { data, error } = await supabaseAdmin
    .from("knowledge_nodes")
    .select("*")
    .eq("external_ref", externalRef)
    .limit(5);

  if (error) {
    return [];
  }

  return (data ?? []) as KnowledgeNode[];
}

async function linkReviewToKnowledge(row: ArchitectureReviewRow, input: ArchitectReviewInput, related: KnowledgeNode[]) {
  const reviewNode = await upsertKnowledgeNode({
    node_type: "architecture_review",
    title: `Architect Review - ${input.title}`,
    summary: row.summary,
    source: "archiveos",
    external_ref: `architecture_review:${row.id}`,
    metadata: {
      review_id: row.id,
      target_type: input.targetType,
      target_ref: input.targetRef,
      status: row.status,
      findings_count: row.findings.length,
      recommendations_count: row.recommendations.length,
    },
  });

  const target = related.find((node) => node.external_ref === input.targetRef);
  if (target) {
    await createKnowledgeEdge({
      from_node_id: reviewNode.id,
      to_node_id: target.id,
      edge_type: "reviewed_architecture_of",
      metadata: { reason: "target_ref_match" },
    });
  }

  for (const node of related.filter((item) => item.id !== target?.id).slice(0, 4)) {
    await createKnowledgeEdge({
      from_node_id: reviewNode.id,
      to_node_id: node.id,
      edge_type: "references_memory",
      metadata: { reason: "architect_related_search" },
    });
  }
}

function toRelatedNode(node: KnowledgeNode): ArchitectReviewResult["relatedKnowledge"][number] {
  return {
    id: node.id,
    node_type: node.node_type,
    title: node.title,
    external_ref: node.external_ref,
  };
}

function clampLimit(value: number) {
  return Math.min(Math.max(Number.isFinite(value) ? Math.floor(value) : 20, 1), 100);
}
