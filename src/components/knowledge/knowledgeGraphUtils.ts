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
  kind: "decision" | "memory";
  id: string;
  title: string;
  status: string;
  priority: string;
  risk: string;
  warning: string;
  lastUpdated: string | null;
  architectStatus: string;
  builderStatus: string;
  reviewerStatus: string;
  pmDecisionStatus: string;
  knowledgeStatus: string;
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
      importanceScore: node.importanceScore + degree * 2,
      importanceLevel: getImportanceLevel(node.importanceScore + degree * 2),
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
    updatedAt: node.updated_at,
    metadata: node.metadata || {},
    importanceScore,
    importanceLevel: getImportanceLevel(importanceScore),
    degree: 0,
    inDegree: 0,
    outDegree: 0,
    lastReferencedAt: node.updated_at || node.created_at,
    isRecent: isRecent(node.updated_at || node.created_at),
    isHub: false,
    isDecisionRelevant: false,
  };
}

function getNodeImportanceScore(node: KnowledgeNode, edges: KnowledgeOverview["latestEdges"]) {
  const connected = edges.filter((edge) => edge.from_node_id === node.id || edge.to_node_id === node.id).length;
  const typeWeight: Record<string, number> = {
    decision: 32,
    architecture_review: 26,
    incident: 26,
    reviewer_result: 20,
    builder_result: 18,
    daily_report: 16,
    nightly_review: 16,
    obsidian_note: 12,
    command: 8,
    task: 18,
  };
  const recency = isRecent(node.updated_at || node.created_at) ? 5 : 0;
  return (typeWeight[node.node_type] || 10) + connected * 4 + recency;
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

export function getOperationalChains(insights: KnowledgeGraphInsights | null, graph: KnowledgeGraph): ActiveDecisionChain[] {
  const chains = insights?.decisionChains?.length ? insights.decisionChains.slice(0, 5) : [null];
  const built = chains
    .map((chain, index) => buildOperationalChain(chain, graph, index))
    .filter((chain): chain is ActiveDecisionChain => Boolean(chain));
  return built.length ? built : buildConnectedMemoryChains(graph);
}

export function getActiveDecisionChain(insights: KnowledgeGraphInsights | null, graph: KnowledgeGraph): ActiveDecisionChain | null {
  return getOperationalChains(insights, graph)[0] || null;
}

function buildOperationalChain(
  chain: KnowledgeGraphInsights["decisionChains"][number] | null,
  graph: KnowledgeGraph,
  index: number,
): ActiveDecisionChain | null {
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
    kind: "decision",
    id: decisionNode?.id || chain?.decisionNodeId || `operational-chain-${index}`,
    title: decisionNode?.label || chain?.decisionLabel || "Active operational memory chain",
    status: decisionNode ? "PM Decision Recorded" : reviewerNode ? "PM Decision Required" : builderNode ? "Review Pending" : "Building Context",
    priority: decisionNode?.importanceLevel || architectNode?.importanceLevel || reviewerNode?.importanceLevel || "medium",
    risk: getChainRisk(architectNode, reviewerNode, edges),
    warning: getChainWarning(architectNode, reviewerNode, decisionNode),
    lastUpdated: getLatestChainTimestamp(steps),
    architectStatus: architectNode ? getNodeStatusLabel(architectNode) : "not linked",
    builderStatus: builderNode ? getNodeStatusLabel(builderNode) : "not linked",
    reviewerStatus: reviewerNode ? getNodeStatusLabel(reviewerNode) : "not linked",
    pmDecisionStatus: decisionNode ? getNodeStatusLabel(decisionNode) : "pending",
    knowledgeStatus: knowledgeNode ? getNodeStatusLabel(knowledgeNode) : "not linked",
    steps,
    nodeIds,
    edgeIds,
  };
}

function buildConnectedMemoryChains(graph: KnowledgeGraph): ActiveDecisionChain[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, Array<{ node: KnowledgeGraphNode; edge: KnowledgeGraphEdge }>>();

  for (const edge of graph.edges) {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to) continue;
    adjacency.set(from.id, [...(adjacency.get(from.id) || []), { node: to, edge }]);
    adjacency.set(to.id, [...(adjacency.get(to.id) || []), { node: from, edge }]);
  }

  const seeds = graph.nodes
    .filter((node) => (adjacency.get(node.id)?.length || 0) > 0)
    .sort((left, right) => {
      const degreeDelta = (adjacency.get(right.id)?.length || 0) - (adjacency.get(left.id)?.length || 0);
      if (degreeDelta !== 0) return degreeDelta;
      const importanceDelta = right.importanceScore - left.importanceScore;
      if (importanceDelta !== 0) return importanceDelta;
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  const covered = new Set<string>();
  const chains: ActiveDecisionChain[] = [];

  for (const seed of seeds) {
    if (covered.has(seed.id) || chains.length >= 5) continue;
    const chainNodes: KnowledgeGraphNode[] = [];
    const chainEdges: KnowledgeGraphEdge[] = [];
    const queued = [seed];
    const visited = new Set<string>();

    while (queued.length && chainNodes.length < 5) {
      const current = queued.shift();
      if (!current || visited.has(current.id)) continue;
      visited.add(current.id);
      chainNodes.push(current);
      const linked = (adjacency.get(current.id) || []).slice().sort((left, right) => {
        const importanceDelta = right.node.importanceScore - left.node.importanceScore;
        return importanceDelta || new Date(right.node.createdAt).getTime() - new Date(left.node.createdAt).getTime();
      });
      for (const item of linked) {
        if (visited.has(item.node.id)) continue;
        if (!chainEdges.some((edge) => edge.id === item.edge.id)) chainEdges.push(item.edge);
        queued.push(item.node);
      }
    }

    if (chainNodes.length < 2) continue;
    chainNodes.forEach((node) => covered.add(node.id));
    const nodeIds = new Set(chainNodes.map((node) => node.id));
    const edgeIds = new Set(
      graph.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)).map((edge) => edge.id),
    );
    const priorityNode = chainNodes.slice().sort((left, right) => right.importanceScore - left.importanceScore)[0];
    const risk = chainNodes.some((node) => node.importanceLevel === "critical") || chainEdges.some((edge) => edge.type === "blocks")
      ? "High"
      : chainNodes.some((node) => node.importanceLevel === "high")
        ? "Medium"
        : "Low";
    const steps = chainNodes.map<ActiveDecisionStep>((node, index) => ({
      key: `memory-${index}-${node.id}`,
      label: node.type,
      node,
      fallback: "",
    }));

    chains.push({
      kind: "memory",
      id: `memory-chain-${seed.id}`,
      title: seed.label,
      status: "linked",
      priority: priorityNode.importanceLevel,
      risk,
      warning: "No blocking warning detected.",
      lastUpdated: getLatestChainTimestamp(steps),
      architectStatus: "not applicable",
      builderStatus: "not applicable",
      reviewerStatus: "not applicable",
      pmDecisionStatus: "not applicable",
      knowledgeStatus: "linked",
      steps,
      nodeIds,
      edgeIds,
    });
  }

  return chains;
}

function getNodeStatusLabel(node: KnowledgeGraphNode) {
  if (node.importanceLevel === "critical") return "critical";
  if (node.importanceLevel === "high") return "ready";
  if (node.isRecent) return "recent";
  return "linked";
}

function getChainRisk(
  architectNode: KnowledgeGraphNode | null,
  reviewerNode: KnowledgeGraphNode | null,
  edges: KnowledgeGraphEdge[],
) {
  const hasBlocker = [architectNode, reviewerNode].some((node) => node?.importanceLevel === "critical");
  if (hasBlocker || edges.some((edge) => edge.type === "blocks")) return "High";
  if (architectNode?.importanceLevel === "high" || reviewerNode?.importanceLevel === "high") return "Medium";
  return "Low";
}

function getChainWarning(
  architectNode: KnowledgeGraphNode | null,
  reviewerNode: KnowledgeGraphNode | null,
  decisionNode: KnowledgeGraphNode | null,
) {
  if (!decisionNode) return "PM decision is still pending.";
  if (architectNode?.importanceLevel === "critical") return "Architect review is marked critical.";
  if (reviewerNode?.importanceLevel === "critical") return "Reviewer verdict is marked critical.";
  return "No blocking warning detected.";
}

function getLatestChainTimestamp(steps: ActiveDecisionStep[]) {
  const timestamps = steps
    .map((step) => step.node?.updatedAt || step.node?.createdAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime());
  return timestamps[0] || null;
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
  if (score >= 75) return "critical";
  if (score >= 45) return "high";
  if (score >= 24) return "medium";
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
    `연결된 노드 ${relatedEdges.length}개`,
    `참조한 결정 ${decisionRefs}건`,
    `아키텍처 검토 참조 ${architectRefs}건`,
    `야간 검토 사용 ${nightlyRefs}건`,
  ];
  if (activeChain?.nodeIds.has(node.id)) reasons.push("활성 운영 체인에 포함됨");
  if (node.isRecent) reasons.push("최근 생성된 노드");
  if (node.isHub) reasons.push("운영 메모리 허브 역할");
  return reasons;
}

export function getGraphNodeImportanceReason(node: KnowledgeGraphNode) {
  if (node.type === "decision") return "PM 결정이 운영 메모리의 기준점입니다.";
  if (node.type === "architecture_review") return "아키텍처 검토가 설계와 위험 판단의 근거입니다.";
  if (node.type === "incident") return "장애 기록이 운영 위험을 보여줍니다.";
  if (node.isHub) return "여러 운영 메모리 기록을 연결하는 중심 노드입니다.";
  if (node.isRecent) return "최근 생성된 운영 메모리 노드입니다.";
  return "유형, 최신성, 그래프 연결을 기준으로 중요도를 산정했습니다.";
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
