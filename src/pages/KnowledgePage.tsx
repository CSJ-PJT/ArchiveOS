import { useState } from "react";
import type { AppData } from "../app/AppShell";
import { MetricCard } from "../components/shared/MetricCard";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { KnowledgeGraphPanel } from "../components/knowledge/KnowledgeGraphPanel";
import { configuredBackendUrl } from "../lib/backendApi";
import { formatTimeAgo, stringifyMeta } from "./pageUtils";

type KnowledgeTab = "overview" | "memory" | "graph" | "rag" | "obsidian";

const tabs: KnowledgeTab[] = ["overview", "memory", "graph", "rag", "obsidian"];

export function KnowledgePage({ data }: { data: AppData }) {
  const [tab, setTab] = useState<KnowledgeTab>("overview");

  return (
    <div className="page-stack">
      <div className="subnav">
        {tabs.map((item) => (
          <button className={tab === item ? "active" : ""} type="button" key={item} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>

      {tab === "overview" ? <KnowledgeOverview data={data} /> : null}
      {tab === "memory" ? <MemoryView data={data} /> : null}
      {tab === "graph" ? <KnowledgeGraphPanel overview={data.knowledge} /> : null}
      {tab === "rag" ? <RagView /> : null}
      {tab === "obsidian" ? <ObsidianView data={data} /> : null}
    </div>
  );
}

function KnowledgeOverview({ data }: { data: AppData }) {
  return (
    <section className="overview-grid">
      <MetricCard label="Documents" value={data.aiRuntime?.knowledge.documents ?? 0} status={data.aiRuntime ? "healthy" : "unknown"} />
      <MetricCard label="Chunks" value={data.aiRuntime?.knowledge.chunks ?? 0} status={data.aiRuntime ? "healthy" : "unknown"} />
      <MetricCard label="Embeddings" value={data.aiRuntime?.knowledge.embeddedChunks ?? 0} status={(data.aiRuntime?.knowledge.embeddedChunks ?? 0) > 0 ? "healthy" : "empty"} />
      <MetricCard label="Pending" value={data.aiRuntime?.knowledge.pendingEmbeddings ?? 0} status={(data.aiRuntime?.knowledge.pendingEmbeddings ?? 0) > 0 ? "working" : "healthy"} />
      <MetricCard label="Failed" value={data.aiRuntime?.knowledge.failedEmbeddings ?? 0} status={(data.aiRuntime?.knowledge.failedEmbeddings ?? 0) > 0 ? "critical" : "healthy"} />
      <MetricCard label="Vector Index" value={data.aiRuntime ? `${data.aiRuntime.vectorStore.indexReady ? "ready" : "not ready"} / ${data.aiRuntime.vectorStore.indexType}` : "unknown"} status={data.aiRuntime?.vectorStore.indexReady ? "healthy" : "degraded"} />
      <MetricCard label="Similarity Search" value={data.aiRuntime?.rag.lastSearchAt ? formatTimeAgo(data.aiRuntime.rag.lastSearchAt) : "not run"} status={data.aiRuntime?.rag.lastSearchAt ? "healthy" : "stale"} />
      <MetricCard label="References" value={data.aiRuntime?.rag.lastReferenceCount ?? 0} status={(data.aiRuntime?.rag.lastReferenceCount ?? 0) > 0 ? "healthy" : "empty"} />
      <MetricCard label="Last Sync" value={data.aiRuntime?.knowledge.lastSyncAt ? formatTimeAgo(data.aiRuntime.knowledge.lastSyncAt) : "Unknown"} status={data.aiRuntime?.knowledge.lastSyncAt ? "healthy" : "stale"} />
      <MetricCard label="RAG Status" value={data.aiRuntime?.rag.ready ? "ready" : data.aiRuntime?.status || "unknown"} status={data.aiRuntime?.rag.ready ? "healthy" : data.aiRuntime?.status || "unknown"} />
      <SectionCard title="Spring AI Knowledge Engine" eyebrow="Obsidian RAG core" className="span-12">
        <p className="body-copy">
          ArchiveOS uses Spring Boot 3 + Spring AI as the dedicated RAG engine. React displays operations, Node/Express proxies operational APIs, and archiveos-ai handles Obsidian sync, chunking, embeddings, pgvector search, ChatModel answers, and references.
        </p>
        <div className="rag-pipeline">
          {[
            ["Documents", (data.aiRuntime?.knowledge.documents ?? 0) > 0],
            ["Chunks", (data.aiRuntime?.knowledge.chunks ?? 0) > 0],
            ["Embeddings", (data.aiRuntime?.knowledge.embeddedChunks ?? 0) > 0],
            ["Vector Index", data.aiRuntime?.vectorStore.indexReady],
            ["Similarity Search", Boolean(data.aiRuntime?.rag.lastSearchAt)],
            ["References", (data.aiRuntime?.rag.lastReferenceCount ?? 0) > 0],
            ["RAG Answer", Boolean(data.aiRuntime?.rag.lastAskAt)],
          ].map(([step, ready]) => (
            <div className={`rag-pipeline-step ${ready ? "ready" : "pending"}`} key={String(step)}>
              <span>{step}</span>
            </div>
          ))}
        </div>
        <div className="event-list compact">
          {(data.knowledge?.latestNodes || []).slice(0, 6).map((node) => (
            <article className="event-row" key={node.id}>
              <StatusBadge status="healthy">{node.node_type}</StatusBadge>
              <strong>{node.title}</strong>
              <p>{node.summary || node.external_ref || "No summary"}</p>
            </article>
          ))}
        </div>
      </SectionCard>
    </section>
  );
}

function MemoryView({ data }: { data: AppData }) {
  const nodes = data.knowledge?.latestNodes || [];
  return (
    <SectionCard title="Operational Memory Chain" eyebrow="Task to knowledge record">
      <div className="memory-chain-list">
        {nodes.length === 0 ? <div className="empty-state">No memory nodes have been recorded yet.</div> : null}
        {nodes.slice(0, 8).map((node) => (
          <article className="memory-chain-card" key={node.id}>
            <StatusBadge status="healthy">{node.node_type}</StatusBadge>
            <strong>{node.title}</strong>
            <span>{node.source || "archiveos"}</span>
            <p>{node.summary || node.external_ref || "Linked operational memory"}</p>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}

function RagView() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  async function ask() {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer(null);
    try {
      const response = await fetch(`${configuredBackendUrl}/api/rag/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const payload = await response.json();
      setAnswer(payload);
    } catch (err) {
      setAnswer({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard title="RAG" eyebrow="Read-only question and references">
      <div className="rag-box">
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask ArchiveOS operational memory..." />
        <button className="button button-primary" type="button" onClick={ask} disabled={loading}>
          {loading ? "Asking..." : "Ask"}
        </button>
        <pre>{answer ? stringifyMeta(answer) : "No RAG answer yet."}</pre>
      </div>
    </SectionCard>
  );
}

function ObsidianView({ data }: { data: AppData }) {
  return (
    <SectionCard title="Obsidian" eyebrow="Long-term markdown memory">
      <div className="settings-list">
        <div>
          <span>Vault configured</span>
          <StatusBadge status={data.historian?.configured ? "healthy" : "not_configured"}>{data.historian?.configured ? "yes" : "no"}</StatusBadge>
        </div>
        <div>
          <span>Exporter enabled</span>
          <StatusBadge status={data.historian?.enabled ? "healthy" : "offline"}>{data.historian?.enabled ? "yes" : "no"}</StatusBadge>
        </div>
        <div>
          <span>Last note</span>
          <strong>{data.historian?.lastExport?.notePath || "No export yet"}</strong>
        </div>
      </div>
    </SectionCard>
  );
}
