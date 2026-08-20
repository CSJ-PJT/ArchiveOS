import { useEffect, useMemo, useState } from "react";
import {
  getKnowledgeGraph,
  getKnowledgeGraphInsights,
  type KnowledgeGraph,
  type KnowledgeGraphEdge,
  type KnowledgeGraphInsights,
  type KnowledgeOverview,
} from "../../lib/backendApi";
import { ActiveDecisionChainPanel, OperationalChainReplay } from "./ActiveDecisionChainPanel";
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
  knowledgeEdgeTypeLabel,
  knowledgeNodeTypeLabel,
  knowledgeStateLabel,
} from "./KnowledgeUi";
import {
  buildKnowledgeGraphFromOverview,
  filterKnowledgeGraph,
  getOperationalChains,
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
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
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
        setError(err instanceof Error ? err.message : "지식 그래프 오류");
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

  const operationalChains = useMemo(() => (filteredGraph ? getOperationalChains(insights, filteredGraph) : []), [filteredGraph, insights]);
  const activeChain = useMemo(
    () => operationalChains.find((chain) => chain.id === selectedChainId) || operationalChains[0] || null,
    [operationalChains, selectedChainId],
  );
  const selectedNode = filteredGraph?.nodes.find((node) => node.id === selectedNodeId) || null;
  const nodeTypes = useMemo(() => ["all", ...Object.keys(graph?.stats.types || {})], [graph]);
  const edgeTypes = useMemo(() => ["all", ...Array.from(new Set(graph?.edges.map((edge) => edge.type) || []))], [graph]);
  const latestNode = graph?.nodes
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const selectNode = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    setSelectedEdge(null);
  };

  const graphBody = () => {
    if (loadState === "loading") {
      return <KnowledgeEmptyState title="지식 그래프를 불러오는 중입니다." body="운영 지식 노드와 Obsidian 인덱스 연결을 확인하고 있습니다." />;
    }
    if (loadState === "error") {
      return <KnowledgeEmptyState title="지식 그래프 API를 불러오지 못했습니다." body={error || "설정의 엔드포인트 상태를 확인하세요."} />;
    }
    if (!filteredGraph || filteredGraph.nodes.length === 0) {
      return (
        <KnowledgeEmptyState
          title="지식 그래프 미구성"
          body="지식 그래프는 별도 생성 경로가 필요하며 현재 노드/관계 데이터가 없습니다. RAG 데이터(문서/청크)는 별도 지표로 확인하세요."
        />
      );
    }

    return (
      <>
        <ActiveDecisionChainPanel
          chains={operationalChains}
          selectedChainId={activeChain?.id || null}
          onSelectChain={(chain) => {
            setSelectedChainId(chain.id);
            const firstNode = chain.steps.find((step) => step.node)?.node;
            selectNode(firstNode?.id || null);
          }}
          onSelectNode={(node) => selectNode(node.id)}
          showReplay={false}
        />

        <div className="chain-replay-mobile">
          <OperationalChainReplay chain={activeChain} onSelectNode={(node) => selectNode(node.id)} />
        </div>

        <section className="memory-constellation">
          <div className="constellation-header">
            <div>
              <span className="eyebrow">지식 그래프</span>
              <h3>운영 메모리 연결망</h3>
              <p>문서, 청크, 결정, 검토, 장애와 보고서가 어떻게 연결되는지 확인합니다.</p>
            </div>
            <KnowledgeStatusBadge tone={activeChain ? "working" : "idle"}>
              {activeChain ? "체인 집중" : "자유 탐색"}
            </KnowledgeStatusBadge>
          </div>

          <div className="graph-main-layout">
            <KnowledgeGraphSvg
              graph={filteredGraph}
              selectedNodeId={selectedNodeId}
              activeChain={activeChain}
              onSelectNode={(node) => {
                selectNode(node.id);
                const linkedChain = operationalChains.find((chain) => chain.nodeIds.has(node.id));
                if (linkedChain) {
                  setSelectedChainId(linkedChain.id);
                }
              }}
              onSelectEdge={(edge) => setSelectedEdge(edge)}
            />
            <KnowledgeGraphNodeDetail node={selectedNode} graph={filteredGraph} activeChain={activeChain} />
          </div>
        </section>

        <div className="chain-replay-desktop">
          <OperationalChainReplay chain={activeChain} onSelectNode={(node) => selectNode(node.id)} />
        </div>

        <KnowledgeGraphInsightsPanel insights={insights} graph={filteredGraph} onSelectNode={(node) => selectNode(node.id)} />

        <KnowledgeGraphEdgeDetail edge={selectedEdge} graph={filteredGraph} />
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
      title="운영 메모리"
      eyebrow="체인 보기 + 지식 그래프"
      className="knowledge-graph-panel"
      right={<KnowledgeStatusBadge tone={loadState === "ready" ? "succeeded" : loadState === "error" ? "failed" : "idle"}>{knowledgeStateLabel(loadState)}</KnowledgeStatusBadge>}
    >
      <div className="graph-health-row">
        <KnowledgeMetric label="노드" value={graph?.stats.nodeCount ?? overview?.totalNodes ?? 0} tone="working" />
        <KnowledgeMetric label="연결" value={graph?.stats.edgeCount ?? overview?.totalEdges ?? 0} tone="reviewing" />
        <KnowledgeMetric label="운영 체인" value={operationalChains.length} tone="succeeded" />
        <KnowledgeMetric label="최근 노드" value={knowledgeNodeTypeLabel(latestNode?.type)} tone="idle" />
      </div>

      <div className="graph-filter-bar">
        <label>
          노드 유형
          <select value={nodeType} onChange={(event) => setNodeType(event.target.value)}>
            {nodeTypes.map((type) => (
              <option key={type} value={type}>
                {type === "all" ? "전체" : knowledgeNodeTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <label>
          연결 유형
          <select value={edgeType} onChange={(event) => setEdgeType(event.target.value)}>
            {edgeTypes.map((type) => (
              <option key={type} value={type}>
                {type === "all" ? "전체" : knowledgeEdgeTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <label>
          표시 수
          <select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
            {[50, 100, 200].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="graph-search">
          검색
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="제목, 경로, 출처…" />
        </label>
      </div>

      <div className="graph-mode-row" aria-label="그래프 집중 필터">
        {[
          ["all", "전체 중요도"],
          ["high", "높음 이상"],
          ["critical", "긴급만"],
          ["recent", "최근만"],
          ["decision", "결정 경로"],
          ["architect", "설계 경로"],
          ["incident", "장애 경로"],
        ].map(([value, label]) => (
          <GraphToggle key={value} active={mode === value} onClick={() => setMode(value as GraphFilterMode)}>
            {label}
          </GraphToggle>
        ))}
      </div>

      <p className="graph-readonly-note">
        읽기 전용 운영 메모리입니다. 실제 PostgreSQL 지식 노드 또는 Obsidian 문서·청크 투영만 표시합니다.
        {latestNode ? <span title={latestNode.createdAt}> 최근: {knowledgeNodeTypeLabel(latestNode.type)} · {formatRelativeTime(latestNode.createdAt)}</span> : null}
      </p>

      {graphBody()}
    </KnowledgePanel>
  );
}
