import type {
  ImportanceLevel,
  KnowledgeGraph,
  KnowledgeGraphEdge,
  KnowledgeGraphInsights,
  KnowledgeGraphNode,
  KnowledgeNode,
  KnowledgeOverview,
} from "../../lib/backendApi";

export type GraphFilterMode = "all" | "high" | "critical" | "recent" | "decision" | "architect" | "incident";

export type GraphFilters = {
  nodeType: string;
  edgeType: string;
  search: string;
  limit: number;
  mode: GraphFilterMode;
};

export type ActiveDecisionStep = {
  key: string;
  label: string;
  node: KnowledgeGraphNode | null;
  fallback: string;
};

export type ActiveDecisionChain = {
  title: string;
  steps: ActiveDecisionStep[];
  nodeIds: Set<string>;
  edgeIds: Set<string>;
};

export type GraphFocusContext = {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  upstreamIds: Set<string>;
  downstreamIds: Set<string>;
};

type PositionedNode = KnowledgeGraphNode & { x: number; y: number };

export function buildKnowledgeGraphFromOverview(overview: KnowledgeOverview): KnowledgeGraph {
  const nodeMap = new Map<string, KnowledgeGraphNode>();

  for (const node of overview.latestNodes) {
    nodeMap.set(node.id, toGraphNode(node, overview.latestEdges));
  }

  for (const edge of overview.latestEdges) {
    if (edge.from_node && !nodeMap.has(edge.from_node.id)) {
      nodeMap.set(edge.from_node.id, toGraphNode(edge.from_node, overview.latestEdges));
    }
    if (edge.to_node && !nodeMap.has(edge.to_node.id)) {
      nodeMap.set(edge.to_node.id, toGraphNode(edge.to_node, overview.latestEdges));
    }
  }

  const edges: KnowledgeGraphEdge[] = overview.latestEdges.map((edge) => {
    const importanceScore = getEdgeImportanceScore(edge.edge_type, edge.confidence, edge.metadata);
    return {
      id: edge.id,
      from: edge.from_node_id,
      to: edge.to_node_id,
      type: edge.edge_type,
      label: edge.edge_type,
      confidence: edge.confidence,
      createdAt: edge.created_at,
      metadata: edge.metadata || {},
      importanceScore,
      importanceLevel: getImportanceLevel(importanceScore),
      isRecent: isRecent(edge.created_at),
      isDecisionPath: ["decided_by", "mentioned_in", "relates_to", "reviewed_by"].includes(edge.edge_type),
      isArchitectPath: ["reviewed_architecture_of", "references_memory", "recommends", "conflicts_with"].includes(edge.edge_type),
      isIncidentPath: ["caused_by", "resolved_by", "blocks"].includes(edge.edge_type),
    };
  });

  const nodes = Array.from(nodeMap.values()).map((node) => {
    const inDegree = edges.filter((edge) => edge.to === node.id).length;
    const outDegree = edges.filter((edge) => edge.from === node.id).length;
    const degree = inDegree + outDegree;
    return {
      ...node,
      inDegree,
      outDegree,
      degree,
      isHub: degree >= 4,
      isDecisionRelevant: ["decision", "reviewer_result", "architecture_review", "incident"].includes(node.type),
      importanceScore: node.importanceScore + degree * 4,
      importanceLevel: getImportanceLevel(node.importanceScore + degree * 4),
    };
  });

  return {
    nodes,
    edges,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      types: overview.countsByType,
    },
  };
}

function toGraphNode(node: KnowledgeNode, edges: KnowledgeOverview["latestEdges"]): KnowledgeGraphNode {
  const importanceScore = getNodeImportanceScore(node, edges);
  return {
    id: node.id,
    type: node.node_type,
    label: node.title,
    title: node.title,
    summary: node.summary,
    source: node.source,
    externalRef: node.external_ref,
    createdAt: node.created_at,
    metadata: node.metadata || {},
    importanceScore,
    importanceLevel: getImportanceLevel(importanceScore),
    degree: 0,
    inDegree: 0,
    outDegree: 0,
    lastReferencedAt: node.updated_at || node.created_at,
    isRecent: isRecent(node.created_at),
    isHub: false,
    isDecisionRelevant: false,
  };
}

function getNodeImportanceScore(node: KnowledgeNode, edges: KnowledgeOverview["latestEdges"]) {
  const connected = edges.filter((edge) => edge.from_node_id === node.id || edge.to_node_id === node.id).length;
  const typeWeight: Record<string, number> = {
    decision: 34,
    architecture_review: 28,
    incident: 26,
    reviewer_result: 22,
    builder_result: 20,
    daily_report: 16,
    nightly_review: 16,
    obsidian_note: 12,
    command: 8,
    task: 18,
  };
  const recency = isRecent(node.created_at) ? 10 : 0;
  return (typeWeight[node.node_type] || 10) + connected * 6 + recency;
}

function getEdgeImportanceScore(edgeType: string, confidence: number | null, metadata: Record<string, unknown>) {
  const typeWeight: Record<string, number> = {
    exported_to: 18,
    reviewed_by: 26,
    decided_by: 30,
    reviewed_architecture_of: 28,
    references_memory: 22,
    mentioned_in: 20,
    relates_to: 14,
    caused_by: 26,
    blocks: 32,
  };
  const confidenceWeight = Math.round((confidence ?? 1) * 10);
  const derivedWeight = metadata?.reason ? 2 : 0;
  return (typeWeight[edgeType] || 12) + confidenceWeight + derivedWeight;
}

export function filterKnowledgeGraph(graph: KnowledgeGraph, filters: GraphFilters): KnowledgeGraph {
  const normalizedSearch = filters.search.trim().toLowerCase();
  const candidateNodes = graph.nodes
    .filter((node) => filters.nodeType === "all" || node.type === filters.nodeType)
    .filter((node) => importancePasses(node, filters.mode))
    .filter((node) => {
      if (!normalizedSearch) return true;
      return [node.label, node.title, node.summary, node.externalRef, node.type, node.source]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    })
    .sort((a, b) => b.importanceScore - a.importanceScore)
    .slice(0, filters.limit);

  const allowedIds = new Set(candidateNodes.map((node) => node.id));
  const edges = graph.edges
    .filter((edge) => allowedIds.has(edge.from) && allowedIds.has(edge.to))
    .filter((edge) => filters.edgeType === "all" || edge.type === filters.edgeType)
    .filter((edge) => {
      if (filters.mode === "decision") return edge.isDecisionPath;
      if (filters.mode === "architect") return edge.isArchitectPath;
      if (filters.mode === "incident") return edge.isIncidentPath;
      return true;
    });

  return {
    nodes: candidateNodes,
    edges,
    stats: {
      nodeCount: candidateNodes.length,
      edgeCount: edges.length,
      types: candidateNodes.reduce<Record<string, number>>((acc, node) => {
        acc[node.type] = (acc[node.type] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}

function importancePasses(node: KnowledgeGraphNode, mode: GraphFilterMode) {
  if (mode === "all") return true;
  if (mode === "high") return node.importanceLevel === "high" || node.importanceLevel === "critical";
  if (mode === "critical") return node.importanceLevel === "critical";
  if (mode === "recent") return node.isRecent;
  if (mode === "decision") return node.type === "decision" || node.isDecisionRelevant;
  if (mode === "architect") return node.type === "architecture_review";
  if (mode === "incident") return node.type === "incident";
  return true;
}

export function getActiveDecisionChain(insights: KnowledgeGraphInsights | null, graph: KnowledgeGraph): ActiveDecisionChain | null {
  const chain = insights?.decisionChains?.[0];
  const nodes = graph.nodes;
  const edges = graph.edges;
  const findNode = (id?: string) => (id ? nodes.find((node) => node.id === id) || null : null);
  const findFirstType = (types: string[]) => nodes.find((node) => types.includes(node.type)) || null;

  const decisionNode = findNode(chain?.decisionNodeId) || findFirstType(["decision"]);
  const architectNode = findNode(chain?.relatedArchitectReviews?.[0]?.id) || findFirstType(["architecture_review"]);
  const builderNode = findConnectedNode(decisionNode, nodes, edges, ["builder_result"]) || findFirstType(["builder_result"]);
  const reviewerNode = findConnectedNode(decisionNode, nodes, edges, ["reviewer_result"]) || findNode(chain?.relatedReviews?.[0]?.id) || findFirstType(["reviewer_result"]);
  const knowledgeNode =
    findConnectedNode(decisionNode, nodes, edges, ["obsidian_note", "daily_report", "nightly_review"]) ||
    findFirstType(["obsidian_note", "daily_report", "nightly_review"]);

  if (!decisionNode && !architectNode && !builderNode && !reviewerNode && !knowledgeNode) return null;

  const steps: ActiveDecisionStep[] = [
    { key: "architect", label: "Architect Review", node: architectNode, fallback: "No architect review linked" },
    { key: "builder", label: "Builder Result", node: builderNode, fallback: "No builder result linked" },
    { key: "reviewer", label: "Reviewer Verdict", node: reviewerNode, fallback: "No reviewer verdict linked" },
    { key: "decision", label: "PM Decision", node: decisionNode, fallback: "No PM decision linked" },
    { key: "knowledge", label: "Knowledge Record", node: knowledgeNode, fallback: "No memory record linked" },
  ];
  const nodeIds = new Set(steps.flatMap((step) => (step.node ? [step.node.id] : [])));
  const edgeIds = new Set(
    edges
      .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
      .map((edge) => edge.id),
  );

  return {
    title: decisionNode?.label || chain?.decisionLabel || "Active operational memory chain",
    steps,
    nodeIds,
    edgeIds,
  };
}

function findConnectedNode(
  anchor: KnowledgeGraphNode | null,
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  types: string[],
) {
  if (!anchor) return null;
  const connectedIds = edges
    .filter((edge) => edge.from === anchor.id || edge.to === anchor.id)
    .flatMap((edge) => [edge.from, edge.to])
    .filter((id) => id !== anchor.id);
  return nodes.find((node) => connectedIds.includes(node.id) && types.includes(node.type)) || null;
}

export function getGraphFocusContext(graph: KnowledgeGraph, selectedNodeId: string | null, activeChain: ActiveDecisionChain | null): GraphFocusContext {
  const nodeIds = new Set(activeChain?.nodeIds || []);
  const edgeIds = new Set(activeChain?.edgeIds || []);
  const upstreamIds = new Set<string>();
  const downstreamIds = new Set<string>();

  if (selectedNodeId) {
    nodeIds.add(selectedNodeId);
    collectDirectional(graph, selectedNodeId, "upstream", upstreamIds, edgeIds);
    collectDirectional(graph, selectedNodeId, "downstream", downstreamIds, edgeIds);
    upstreamIds.forEach((id) => nodeIds.add(id));
    downstreamIds.forEach((id) => nodeIds.add(id));
  }

  return { nodeIds, edgeIds, upstreamIds, downstreamIds };
}

function collectDirectional(
  graph: KnowledgeGraph,
  rootId: string,
  direction: "upstream" | "downstream",
  out: Set<string>,
  edgeIds: Set<string>,
) {
  let frontier = [rootId];
  for (let depth = 0; depth < 2; depth += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      const linked = graph.edges.filter((edge) => (direction === "upstream" ? edge.to === id : edge.from === id));
      for (const edge of linked) {
        const targetId = direction === "upstream" ? edge.from : edge.to;
        edgeIds.add(edge.id);
        if (!out.has(targetId)) {
          out.add(targetId);
          next.push(targetId);
        }
      }
    }
    frontier = next;
  }
}

export function layoutKnowledgeGraphNodes(nodes: KnowledgeGraphNode[], width: number, height: number): PositionedNode[] {
  if (nodes.length === 0) return [];
  const centerX = width / 2;
  const centerY = height / 2;
  const groups = groupGraphNodes(nodes);
  const groupEntries = Array.from(groups.entries());
  const groupRadius = Math.min(width, height) * 0.28;
  const positioned: PositionedNode[] = [];

  groupEntries.forEach(([type, typeNodes], groupIndex) => {
    const groupAngle = (Math.PI * 2 * groupIndex) / Math.max(groupEntries.length, 1) - Math.PI / 2;
    const groupX = centerX + Math.cos(groupAngle) * groupRadius;
    const groupY = centerY + Math.sin(groupAngle) * groupRadius;
    const localRadius = Math.max(42, Math.min(120, typeNodes.length * 16));

    typeNodes.forEach((node, nodeIndex) => {
      const localAngle = (Math.PI * 2 * nodeIndex) / Math.max(typeNodes.length, 1);
      const isDecisionLike = ["decision", "architecture_review", "incident"].includes(type);
      const pullToCenter = isDecisionLike ? 0.52 : 0.82;
      positioned.push({
        ...node,
        x: centerX + (groupX - centerX) * pullToCenter + Math.cos(localAngle) * localRadius,
        y: centerY + (groupY - centerY) * pullToCenter + Math.sin(localAngle) * localRadius,
      });
    });
  });

  return positioned.sort((a, b) => a.importanceScore - b.importanceScore);
}

function groupGraphNodes(nodes: KnowledgeGraphNode[]) {
  const priority = [
    "decision",
    "architecture_review",
    "reviewer_result",
    "builder_result",
    "incident",
    "daily_report",
    "nightly_review",
    "obsidian_note",
    "command",
  ];
  const groups = new Map<string, KnowledgeGraphNode[]>();
  for (const type of priority) groups.set(type, []);
  for (const node of nodes) {
    if (!groups.has(node.type)) groups.set(node.type, []);
    groups.get(node.type)?.push(node);
  }
  for (const [type, groupNodes] of groups) {
    if (groupNodes.length === 0) groups.delete(type);
  }
  return groups;
}

export function getKnowledgeNodeColor(type: string) {
  const colors: Record<string, string> = {
    decision: "#22c55e",
    architecture_review: "#a855f7",
    incident: "#ef4444",
    reviewer_result: "#f59e0b",
    builder_result: "#06b6d4",
    daily_report: "#38bdf8",
    nightly_review: "#6366f1",
    obsidian_note: "#84cc16",
    command: "#94a3b8",
    task: "#14b8a6",
  };
  return colors[type] || "#64748b";
}

export function getKnowledgeNodeRadius(node: KnowledgeGraphNode) {
  const base = 13 + Math.min(18, node.importanceScore / 4);
  if (node.type === "decision") return base + 8;
  if (node.type === "architecture_review" || node.type === "incident") return base + 5;
  return base;
}

export function getKnowledgeEdgeColor(edge: KnowledgeGraphEdge) {
  if (edge.isDecisionPath) return "#22c55e";
  if (edge.isArchitectPath) return "#a855f7";
  if (edge.isIncidentPath) return "#ef4444";
  if (edge.importanceLevel === "critical") return "#f97316";
  if (edge.importanceLevel === "high") return "#38bdf8";
  return "#475569";
}

export function getKnowledgeEdgeWidth(edge: KnowledgeGraphEdge) {
  return 1.5 + Math.min(5, edge.importanceScore / 10);
}

export function getImportanceLevel(score: number): ImportanceLevel {
  if (score >= 58) return "critical";
  if (score >= 38) return "high";
  if (score >= 22) return "medium";
  return "low";
}

export function getImportanceBadgeStyle(level: ImportanceLevel) {
  if (level === "critical") return "failed";
  if (level === "high") return "working";
  if (level === "medium") return "reviewing";
  return "idle";
}

export function getGraphNodeImportanceReasons(node: KnowledgeGraphNode, graph: KnowledgeGraph, activeChain: ActiveDecisionChain | null) {
  const relatedEdges = graph.edges.filter((edge) => edge.from === node.id || edge.to === node.id);
  const decisionRefs = relatedEdges.filter((edge) => {
    const otherId = edge.from === node.id ? edge.to : edge.from;
    return graph.nodes.find((candidate) => candidate.id === otherId)?.type === "decision";
  }).length;
  const architectRefs = relatedEdges.filter((edge) => {
    const otherId = edge.from === node.id ? edge.to : edge.from;
    return graph.nodes.find((candidate) => candidate.id === otherId)?.type === "architecture_review";
  }).length;
  const nightlyRefs = relatedEdges.filter((edge) => {
    const otherId = edge.from === node.id ? edge.to : edge.from;
    return graph.nodes.find((candidate) => candidate.id === otherId)?.type === "nightly_review" || edge.type.includes("nightly");
  }).length;
  const reasons = [
    `connected to ${relatedEdges.length} nodes`,
    `referenced by ${decisionRefs} decisions`,
    `referenced in ${architectRefs} architect reviews`,
    `used in ${nightlyRefs} nightly reviews`,
  ];
  if (activeChain?.nodeIds.has(node.id)) reasons.push("part of active operational chain");
  if (node.isRecent) reasons.push("recently created");
  if (node.isHub) reasons.push("acts as a graph hub");
  return reasons;
}

export function getGraphNodeImportanceReason(node: KnowledgeGraphNode) {
  if (node.type === "decision") return "PM decisions anchor operational memory.";
  if (node.type === "architecture_review") return "Architecture reviews explain design and risk decisions.";
  if (node.type === "incident") return "Incidents identify operational risk.";
  if (node.isHub) return "This node connects multiple memory records.";
  if (node.isRecent) return "This node was created recently.";
  return "Importance is derived from type, recency, and graph connections.";
}

export function truncateGraphLabel(value: string | null | undefined, maxLength = 28) {
  if (!value) return "Untitled";
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

export function readEdgeReason(edge: KnowledgeGraphEdge) {
  const reason = edge.metadata?.reason || edge.metadata?.source || edge.metadata?.match;
  return typeof reason === "string" ? reason : null;
}

function isRecent(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(value).getTime();
  if (Number.isNaN(date)) return false;
  return Date.now() - date < 1000 * 60 * 60 * 24 * 7;
}
