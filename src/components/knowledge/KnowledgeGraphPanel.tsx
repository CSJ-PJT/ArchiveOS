import { useEffect, useMemo, useState } from "react";
import {
  getKnowledgeGraph,
  getKnowledgeGraphInsights,
  type KnowledgeGraph,
  type KnowledgeGraphEdge,
  type KnowledgeGraphInsights,
  type KnowledgeGraphNode,
  type KnowledgeOverview,
} from "../../lib/backendApi";
import { ActiveDecisionChainPanel } from "./ActiveDecisionChainPanel";
import { KnowledgeGraphInsightsPanel } from "./KnowledgeGraphInsights";
import { KnowledgeGraphEdgeDetail, KnowledgeGraphEdgeList, KnowledgeGraphNodeDetail } from "./KnowledgeNodeDetail";
import { KnowledgeGraphSvg } from "./KnowledgeGraphSvg";
import {
  GraphToggle,
  KnowledgeEmptyState,
  KnowledgeMetric,
  KnowledgePanel,
  KnowledgeStatusBadge,
  formatRelativeTime,
} from "./KnowledgeUi";
import {
  buildKnowledgeGraphFromOverview,
  filterKnowledgeGraph,
  getActiveDecisionChain,
  type GraphFilterMode,
} from "./knowledgeGraphUtils";

type GraphLoadState = "idle" | "loading" | "ready" | "empty" | "error";

export function KnowledgeGraphPanel({ overview }: { overview: KnowledgeOverview | null }) {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [insights, setInsights] = useState<KnowledgeGraphInsights | null>(null);
  const [loadState, setLoadState] = useState<GraphLoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<KnowledgeGraphEdge | null>(null);
  const [nodeType, setNodeType] = useState("all");
  const [edgeType, setEdgeType] = useState("all");
  const [limit, setLimit] = useState(100);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<GraphFilterMode>("all");
  const [edgeTableCollapsed, setEdgeTableCollapsed] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadGraph() {
      setLoadState("loading");
      setError(null);
      try {
        const [graphResult, insightResult] = await Promise.allSettled([getKnowledgeGraph(limit), getKnowledgeGraphInsights(limit)]);
        if (cancelled) return;

        let nextGraph: KnowledgeGraph | null = null;
        if (graphResult.status === "fulfilled") {
          nextGraph = graphResult.value;
        } else if (overview) {
          nextGraph = buildKnowledgeGraphFromOverview(overview);
        }

        setGraph(nextGraph);
        setInsights(insightResult.status === "fulfilled" ? insightResult.value : null);
        setLoadState(nextGraph && nextGraph.nodes.length > 0 ? "ready" : "empty");
        if (graphResult.status === "rejected" && !overview) {
          setError("Knowledge Graph API를 불러오지 못했습니다. 백엔드 엔드포인트가 누락되었거나 오래된 프로세스일 수 있습니다.");
        }
      } catch (err) {
        if (cancelled) return;
        setLoadState("error");
        setError(err instanceof Error ? err.message : "Unknown Knowledge Graph error");
      }
    }

    loadGraph();
    return () => {
      cancelled = true;
    };
  }, [limit, overview]);

  const filteredGraph = useMemo(() => {
    if (!graph) return null;
    return filterKnowledgeGraph(graph, { nodeType, edgeType, search, limit, mode });
  }, [edgeType, graph, limit, mode, nodeType, search]);

  const activeChain = useMemo(() => (filteredGraph ? getActiveDecisionChain(insights, filteredGraph) : null), [filteredGraph, insights]);
  const selectedNode = filteredGraph?.nodes.find((node) => node.id === selectedNodeId) || null;
  const nodeTypes = useMemo(() => ["all", ...Object.keys(graph?.stats.types || {})], [graph]);
  const edgeTypes = useMemo(() => ["all", ...Array.from(new Set(graph?.edges.map((edge) => edge.type) || []))], [graph]);
  const latestNode = graph?.nodes
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const graphBody = () => {
    if (loadState === "loading") {
      return <KnowledgeEmptyState title="Loading graph" body="Reading knowledge_nodes and knowledge_edges." />;
    }
    if (loadState === "error") {
      return <KnowledgeEmptyState title="Knowledge Graph API를 불러오지 못했습니다." body={error || "Settings > Endpoint Health Matrix를 확인하세요."} />;
    }
    if (!filteredGraph || filteredGraph.nodes.length === 0) {
      return (
        <KnowledgeEmptyState
          title="아직 Knowledge Graph 데이터가 충분하지 않습니다."
          body="Daily Report, Nightly Review, Architect Review, Historian Export가 실행되면 노드와 엣지가 생성됩니다."
        />
      );
    }

    return (
      <>
        <ActiveDecisionChainPanel chain={activeChain} onSelectNode={(node) => setSelectedNodeId(node.id)} />
        <div className="graph-main-layout">
          <KnowledgeGraphSvg
            graph={filteredGraph}
            selectedNodeId={selectedNodeId}
            activeChain={activeChain}
            onSelectNode={(node) => {
              setSelectedNodeId(node.id);
              setSelectedEdge(null);
            }}
            onSelectEdge={(edge) => setSelectedEdge(edge)}
          />
          <KnowledgeGraphNodeDetail node={selectedNode} graph={filteredGraph} activeChain={activeChain} />
        </div>
        <KnowledgeGraphEdgeDetail edge={selectedEdge} graph={filteredGraph} />
        <KnowledgeGraphInsightsPanel insights={insights} graph={filteredGraph} onSelectNode={(node) => setSelectedNodeId(node.id)} />
        <KnowledgeGraphEdgeList
          graph={filteredGraph}
          collapsed={edgeTableCollapsed}
          onToggle={() => setEdgeTableCollapsed((value) => !value)}
          onSelectEdge={(edge) => setSelectedEdge(edge)}
        />
      </>
    );
  };

  return (
    <KnowledgePanel
      title="Operational Memory Graph"
      eyebrow="Knowledge Graph Visualization"
      className="knowledge-graph-panel"
      right={<KnowledgeStatusBadge tone={loadState === "ready" ? "succeeded" : loadState === "error" ? "failed" : "idle"}>{loadState}</KnowledgeStatusBadge>}
    >
      <div className="graph-health-row">
        <KnowledgeMetric label="Nodes" value={graph?.stats.nodeCount ?? overview?.totalNodes ?? 0} tone="working" />
        <KnowledgeMetric label="Edges" value={graph?.stats.edgeCount ?? overview?.totalEdges ?? 0} tone="reviewing" />
        <KnowledgeMetric label="Top Type" value={Object.entries(graph?.stats.types || overview?.countsByType || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || "None"} tone="succeeded" />
        <KnowledgeMetric label="Latest Node" value={latestNode?.type || "None"} tone="idle" />
      </div>

      <div className="graph-filter-bar">
        <label>
          Node type
          <select value={nodeType} onChange={(event) => setNodeType(event.target.value)}>
            {nodeTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          Edge type
          <select value={edgeType} onChange={(event) => setEdgeType(event.target.value)}>
            {edgeTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          Limit
          <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
            {[50, 100, 200].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="graph-search">
          Search
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="title, ref, source..." />
        </label>
      </div>

      <div className="graph-mode-row" aria-label="Graph focus filters">
        {[
          ["all", "All Importance"],
          ["high", "High Only"],
          ["critical", "Critical Only"],
          ["recent", "Recent Only"],
          ["decision", "Decision Path"],
          ["architect", "Architect Path"],
          ["incident", "Incident Path"],
        ].map(([value, label]) => (
          <GraphToggle key={value} active={mode === value} onClick={() => setMode(value as GraphFilterMode)}>
            {label}
          </GraphToggle>
        ))}
      </div>

      <p className="graph-readonly-note">
        Read-only operational memory view. Node size represents importance, edge thickness represents relationship strength, and focus mode highlights upstream/downstream context.
        {latestNode ? <span title={latestNode.createdAt}> Latest: {latestNode.type} · {formatRelativeTime(latestNode.createdAt)}</span> : null}
      </p>

      {graphBody()}
    </KnowledgePanel>
  );
}
