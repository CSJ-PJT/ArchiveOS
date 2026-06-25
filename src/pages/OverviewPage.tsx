import type { AppRoute } from "../app/navigation";
import type { AppData } from "../app/AppShell";
import { MetricCard } from "../components/shared/MetricCard";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { buildOverviewViewModel } from "../lib/viewModels/overview";
import { formatTimeAgo } from "./pageUtils";

export function OverviewPage({
  data,
  onRefresh,
  onNavigate,
}: {
  data: AppData;
  onRefresh: () => void;
  onNavigate: (route: AppRoute) => void;
}) {
  const overview = buildOverviewViewModel({
    runtime: data.runtime,
    queue: data.queue,
    tasks: data.tasks,
    events: data.events,
    knowledge: data.knowledge,
    historian: data.historian,
    endpointHealth: data.endpointHealth,
    mesh: data.mesh,
    kpi: data.kpi,
    architect: data.architect,
  });

  return (
    <div className="page-stack">
      <section className="hero-status">
        <div>
          <span className="eyebrow">System Status</span>
          <h2>{overview.systemStatus}</h2>
          <p>{overview.activeTask}</p>
        </div>
        <div className="hero-meta">
          <StatusBadge status={overview.statusTone}>{overview.systemStatus}</StatusBadge>
          <span>Last updated {formatTimeAgo(overview.lastUpdatedAt)}</span>
          <button className="button button-primary" type="button" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </section>

      <section className="overview-grid priority-grid">
        <MetricCard label="Current Agent" value={overview.currentAgent} status={overview.currentAgent === "None" ? "idle" : "working"} />
        <MetricCard label="Pipeline Stage" value={overview.currentStage} status={overview.currentStage === "Idle" ? "idle" : "working"} />
        <MetricCard label="Approval Waiting" value={overview.approvalCount} status={overview.approvalCount > 0 ? "blocked" : "healthy"} />
        <MetricCard label="Critical Alerts" value={overview.criticalAlertCount} status={overview.criticalAlertCount > 0 ? "warning" : "healthy"} />
      </section>

      <section className="overview-layout">
        <SectionCard title="Spring AI Engine" eyebrow="RAG / Agent platform core" className="span-12">
          <div className="spring-ai-grid">
            <MetricCard label="Spring AI Status" value={data.axReadiness?.currentMode === "spring_ai_target" ? "Target" : "Active foundation"} status={data.axReadiness ? "working" : "unknown"} />
            <MetricCard label="ChatModel" value={data.endpointHealth?.endpoints.find((endpoint) => endpoint.path === "/api/rag/ask")?.status || "unknown"} status={data.endpointHealth?.endpoints.find((endpoint) => endpoint.path === "/api/rag/ask")?.status || "unknown"} />
            <MetricCard label="EmbeddingModel" value={data.endpointHealth?.endpoints.find((endpoint) => endpoint.path === "/api/rag/search")?.status || "unknown"} status={data.endpointHealth?.endpoints.find((endpoint) => endpoint.path === "/api/rag/search")?.status || "unknown"} />
            <MetricCard label="VectorStore" value={overview.memorySummary.relations > 0 ? "indexed" : "pending"} status={overview.memorySummary.relations > 0 ? "healthy" : "warning"} />
            <MetricCard label="pgvector" value={overview.memorySummary.ragReady ? "ready" : "not verified"} status={overview.memorySummary.ragReady ? "healthy" : "warning"} />
            <MetricCard label="Obsidian Sync" value={data.historian?.lastExport ? formatTimeAgo(data.historian.lastExport.createdAt) : "no export"} status={data.historian?.enabled ? "healthy" : "not_configured"} />
            <MetricCard label="RAG Ready" value={overview.memorySummary.ragReady ? "Yes" : "No"} status={overview.memorySummary.ragReady ? "healthy" : "warning"} />
            <MetricCard label="Last RAG Check" value={data.axReadiness?.generatedAt ? formatTimeAgo(data.axReadiness.generatedAt) : "unknown"} status={data.axReadiness ? "healthy" : "unknown"} />
          </div>
        </SectionCard>

        <SectionCard title="RAG Pipeline Flow" eyebrow="Spring AI execution path" className="span-12">
          <div className="rag-pipeline">
            {["Markdown", "Chunking", "Embedding", "VectorStore", "Retriever", "ChatModel", "Answer + References"].map((step, index) => (
              <div className={`rag-pipeline-step ${index <= 2 || overview.memorySummary.ragReady ? "ready" : "pending"}`} key={step}>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Runtime Flow" eyebrow="Current execution path" className="span-8">
          <div className="runtime-flow">
            {overview.runtimeFlow.map((stage) => (
              <div className={`runtime-stage runtime-${stage.status}`} key={stage.id}>
                <span>{stage.label}</span>
                <StatusBadge status={stage.status}>{stage.status}</StatusBadge>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Queue Status" eyebrow="Click to inspect workflows" className="span-4">
          <div className="compact-metrics">
            {[
              ["Inbox", overview.queueCounts.inbox, "waiting"],
              ["Processing", overview.queueCounts.processing, "working"],
              ["Review", overview.queueCounts.review, "working"],
              ["PM Decision", overview.queueCounts.pmDecision, "blocked"],
              ["Failed", overview.queueCounts.failed, "critical"],
            ].map(([label, value, status]) => (
              <MetricCard key={label} label={String(label)} value={Number(value)} status={String(status)} onClick={() => onNavigate("workflows")} />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Memory Constellation" eyebrow="Knowledge preview" className="span-4">
          <div className="constellation-preview" role="button" tabIndex={0} onClick={() => onNavigate("knowledge")}>
            <div className="constellation-orbit">
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="compact-metrics two-col">
              <MetricCard label="Nodes" value={overview.memorySummary.nodes} status="healthy" />
              <MetricCard label="Relations" value={overview.memorySummary.relations} status="healthy" />
              <MetricCard label="Recent Memory" value={overview.memorySummary.recentMemory} status="working" />
              <MetricCard label="RAG Ready" value={overview.memorySummary.ragReady ? "Yes" : "No"} status={overview.memorySummary.ragReady ? "healthy" : "warning"} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Chain Focus" eyebrow="Most important flow" className="span-4">
          {overview.activeChain ? (
            <div className="chain-focus">
              <strong>{overview.activeChain.task}</strong>
              <p>Owner: {overview.activeChain.owner}</p>
              <p>Stage: {overview.activeChain.stage}</p>
              <p>Next: {overview.activeChain.nextAction}</p>
            </div>
          ) : (
            <div className="empty-state">No active operational chain. Queue is idle.</div>
          )}
        </SectionCard>

        <SectionCard title="Attention Required" eyebrow="Problems only" className="span-4">
          <div className="attention-list">
            {overview.attention.length === 0 ? <div className="empty-state">No urgent PM action right now.</div> : null}
            {overview.attention.map((item) => (
              <article className="attention-item" key={item.title}>
                <StatusBadge status={item.status}>{item.status}</StatusBadge>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Recent Activity" eyebrow="Last 5 events" className="span-12">
          <div className="event-list compact">
            {overview.recentEvents.length === 0 ? <div className="empty-state">No recent events recorded yet.</div> : null}
            {overview.recentEvents.map((event) => (
              <article className="event-row" key={event.id}>
                <span>{formatTimeAgo(event.created_at)}</span>
                <StatusBadge status={event.status}>{event.type}</StatusBadge>
                <strong>{event.title}</strong>
                <p>{event.description}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
