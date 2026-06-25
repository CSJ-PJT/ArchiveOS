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
            <MetricCard label="Spring Boot" value={`${data.aiRuntime?.springBoot.status || "unknown"} ${data.aiRuntime?.springBoot.version || ""}`.trim()} status={data.aiRuntime?.springBoot.status || "unknown"} />
            <MetricCard label="Spring AI" value={`${data.aiRuntime?.springAi.status || "unknown"} ${data.aiRuntime?.springAi.version || ""}`.trim()} status={data.aiRuntime?.springAi.status || "unknown"} />
            <MetricCard label="ChatModel" value={data.aiRuntime ? `${data.aiRuntime.chatModel.model} / ${data.aiRuntime.chatModel.available ? "available" : "unavailable"}` : "unknown"} status={data.aiRuntime?.chatModel.available ? "healthy" : data.aiRuntime?.chatModel.configured ? "degraded" : "not_configured"} />
            <MetricCard label="EmbeddingModel" value={data.aiRuntime ? `${data.aiRuntime.embeddingModel.model} / ${data.aiRuntime.embeddingModel.dimensions}d` : "unknown"} status={data.aiRuntime?.embeddingModel.available ? "healthy" : data.aiRuntime?.embeddingModel.configured ? "degraded" : "not_configured"} />
            <MetricCard label="VectorStore / pgvector" value={data.aiRuntime ? `${data.aiRuntime.vectorStore.type} / ${data.aiRuntime.vectorStore.databaseConnected ? "connected" : "down"}` : "unknown"} status={data.aiRuntime?.vectorStore.available ? "healthy" : data.aiRuntime?.vectorStore.databaseConnected ? "degraded" : "unavailable"} />
            <MetricCard label="Vector Index" value={data.aiRuntime ? `${data.aiRuntime.vectorStore.indexReady ? "ready" : "not ready"} / ${data.aiRuntime.vectorStore.indexType}` : "unknown"} status={data.aiRuntime?.vectorStore.indexReady ? "healthy" : "degraded"} />
            <MetricCard label="Obsidian Sync" value={data.aiRuntime?.knowledge.lastSyncAt ? formatTimeAgo(data.aiRuntime.knowledge.lastSyncAt) : "no sync"} status={data.aiRuntime?.obsidian.reachable ? "healthy" : data.aiRuntime?.obsidian.configured ? "degraded" : "not_configured"} />
            <MetricCard label="RAG Ready" value={data.aiRuntime?.rag.ready ? "Yes" : "No"} status={data.aiRuntime?.rag.ready ? "healthy" : data.aiRuntime ? "degraded" : "unknown"} />
            <MetricCard label="Recent Latency" value={data.aiRuntime?.rag.lastLatencyMs != null ? `${data.aiRuntime.rag.lastLatencyMs}ms` : "none"} status={data.aiRuntime?.rag.lastLatencyMs != null ? "healthy" : "unknown"} />
            <MetricCard label="Recent References" value={data.aiRuntime?.rag.lastReferenceCount ?? 0} status={(data.aiRuntime?.rag.lastReferenceCount ?? 0) > 0 ? "healthy" : "empty"} />
            <MetricCard label="Last RAG Check" value={data.aiRuntime?.checkedAt ? formatTimeAgo(data.aiRuntime.checkedAt) : "unknown"} status={data.aiRuntime?.status || "unknown"} />
          </div>
        </SectionCard>

        <SectionCard title="RAG Pipeline Flow" eyebrow="Spring AI execution path" className="span-12">
          <div className="rag-pipeline">
            {[
              ["Markdown", data.aiRuntime?.obsidian.reachable],
              ["Chunking", (data.aiRuntime?.knowledge.chunks ?? 0) > 0],
              ["Embedding", (data.aiRuntime?.knowledge.embeddedChunks ?? 0) > 0],
              ["VectorStore", data.aiRuntime?.vectorStore.available],
              ["Retriever", data.aiRuntime?.vectorStore.indexReady],
              ["ChatModel", data.aiRuntime?.chatModel.available],
              ["Answer + References", data.aiRuntime?.rag.ready],
            ].map(([step, ready]) => (
              <div className={`rag-pipeline-step ${ready ? "ready" : "pending"}`} key={String(step)}>
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
              <MetricCard label="RAG Ready" value={data.aiRuntime?.rag.ready ? "Yes" : "No"} status={data.aiRuntime?.rag.ready ? "healthy" : data.aiRuntime ? "degraded" : "unknown"} />
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
