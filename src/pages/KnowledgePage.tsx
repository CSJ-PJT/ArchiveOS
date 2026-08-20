import { useState } from "react";
import type { AppData } from "../app/AppShell";
import { MetricCard } from "../components/shared/MetricCard";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { KnowledgeGraphPanel } from "../components/knowledge/KnowledgeGraphPanel";
import { askRag, type RagAnswer } from "../lib/backendApi";
import { formatTimeAgo } from "./pageUtils";
import { knowledgeNodeTypeLabel } from "../components/knowledge/KnowledgeUi";

type KnowledgeTab = "overview" | "memory" | "graph" | "rag" | "obsidian";

const tabs: KnowledgeTab[] = ["overview", "memory", "graph", "rag", "obsidian"];
const tabLabels: Record<KnowledgeTab, string> = { overview: "개요", memory: "운영 메모리", graph: "지식 그래프", rag: "RAG 질문", obsidian: "Obsidian 그래프" };

export function KnowledgePage({ data }: { data: AppData }) {
  const [tab, setTab] = useState<KnowledgeTab>("overview");

  return (
    <div className="page-stack">
      <div className="subnav">
        {tabs.map((item) => (
          <button className={tab === item ? "active" : ""} type="button" key={item} onClick={() => setTab(item)}>
            {tabLabels[item]}
          </button>
        ))}
      </div>

      {tab === "overview" ? <KnowledgeOverview data={data} /> : null}
      {tab === "memory" ? <MemoryView data={data} /> : null}
      {tab === "graph" ? <KnowledgeGraphPanel overview={data.knowledge} /> : null}
      {tab === "rag" ? <RagView data={data} /> : null}
      {tab === "obsidian" ? <ObsidianView data={data} /> : null}
    </div>
  );
}

function KnowledgeOverview({ data }: { data: AppData }) {
  return (
    <section className="overview-grid">
      <MetricCard label="문서" value={data.aiRuntime?.knowledge.documents ?? 0} status={data.aiRuntime ? "healthy" : "unknown"} />
      <MetricCard label="청크" value={data.aiRuntime?.knowledge.chunks ?? 0} status={data.aiRuntime ? "healthy" : "unknown"} />
      <MetricCard label="임베딩" value={data.aiRuntime?.knowledge.embeddedChunks ?? 0} status={(data.aiRuntime?.knowledge.embeddedChunks ?? 0) > 0 ? "healthy" : "empty"} />
      <MetricCard label="대기 임베딩" value={data.aiRuntime?.knowledge.pendingEmbeddings ?? 0} status={(data.aiRuntime?.knowledge.pendingEmbeddings ?? 0) > 0 ? "working" : "healthy"} />
      <MetricCard label="실패 임베딩" value={data.aiRuntime?.knowledge.failedEmbeddings ?? 0} status={(data.aiRuntime?.knowledge.failedEmbeddings ?? 0) > 0 ? "critical" : "healthy"} />
      <MetricCard label="벡터 인덱스" value={data.aiRuntime ? `${data.aiRuntime.vectorStore.indexReady ? "준비됨" : "준비 필요"} / ${data.aiRuntime.vectorStore.indexType}` : "확인 중"} status={data.aiRuntime?.vectorStore.indexReady ? "healthy" : "degraded"} />
      <MetricCard label="최근 유사도 검색" value={data.aiRuntime?.rag.lastSearchAt ? formatTimeAgo(data.aiRuntime.rag.lastSearchAt) : "실행 이력 없음"} status={data.aiRuntime?.rag.lastSearchAt ? "healthy" : "stale"} />
      <MetricCard label="최근 참조" value={data.aiRuntime?.rag.lastReferenceCount ?? 0} status={(data.aiRuntime?.rag.lastReferenceCount ?? 0) > 0 ? "healthy" : "empty"} />
      <MetricCard label="마지막 동기화" value={data.aiRuntime?.knowledge.lastSyncAt ? formatTimeAgo(data.aiRuntime.knowledge.lastSyncAt) : "확인되지 않음"} status={data.aiRuntime?.knowledge.lastSyncAt ? "healthy" : "stale"} />
      <MetricCard label="RAG 상태" value={data.aiRuntime?.rag.ready ? "준비됨" : data.aiRuntime?.status || "확인 중"} status={data.aiRuntime?.rag.ready ? "healthy" : data.aiRuntime?.status || "unknown"} />
      <SectionCard title="Spring AI 운영 지식 엔진" eyebrow="OBSIDIAN RAG CORE" className="span-12">
        <p className="body-copy">
          ArchiveOS는 Spring Boot 3와 Spring AI로 Obsidian 동기화, 청크 분할, 임베딩, pgvector 검색, 답변과 참조 기록을 처리합니다. 공개 화면에는 비밀값이나 원문 전체를 노출하지 않습니다.
        </p>
        <div className="rag-pipeline">
          {[
            ["문서", (data.aiRuntime?.knowledge.documents ?? 0) > 0],
            ["청크", (data.aiRuntime?.knowledge.chunks ?? 0) > 0],
            ["임베딩", (data.aiRuntime?.knowledge.embeddedChunks ?? 0) > 0],
            ["벡터 인덱스", data.aiRuntime?.vectorStore.indexReady],
            ["유사도 검색", Boolean(data.aiRuntime?.rag.lastSearchAt)],
            ["참조", (data.aiRuntime?.rag.lastReferenceCount ?? 0) > 0],
            ["RAG 답변", Boolean(data.aiRuntime?.rag.lastAskAt)],
          ].map(([step, ready]) => (
            <div className={`rag-pipeline-step ${ready ? "ready" : "pending"}`} key={String(step)}>
              <span>{step}</span>
            </div>
          ))}
        </div>
        <div className="event-list compact">
          {(data.knowledge?.latestNodes || []).slice(0, 6).map((node) => (
            <article className="event-row" key={node.id}>
              <StatusBadge status="healthy">{knowledgeNodeTypeLabel(node.node_type)}</StatusBadge>
              <strong>{node.title}</strong>
              <p>{node.summary || node.external_ref || "요약 없음"}</p>
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
    <SectionCard title="운영 메모리 체인" eyebrow="작업에서 지식 기록까지">
      <div className="memory-chain-list">
        {nodes.length === 0 ? <div className="empty-state">운영 메모리 투영 데이터가 없습니다.</div> : null}
        {nodes.slice(0, 8).map((node) => (
          <article className="memory-chain-card" key={node.id}>
            <StatusBadge status="healthy">{knowledgeNodeTypeLabel(node.node_type)}</StatusBadge>
            <strong>{node.title}</strong>
            <span>{node.source || "archiveos"}</span>
            <p>{node.summary || node.external_ref || "연결된 운영 메모리"}</p>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}

function RagView({ data }: { data: AppData }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask() {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer(null);
    setError("");
    try {
      setAnswer(await askRag(question.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard title="RAG 운영 질문" eyebrow="답변과 참조 기록">
      <div className="rag-box">
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="ArchiveOS 운영 지식에 질문하세요…" />
        <button className="button button-primary" type="button" onClick={ask} disabled={loading}>
          {loading ? "질문 처리 중…" : "질문하기"}
        </button>
        {error ? <div className="empty-state error-state">RAG 질문을 처리하지 못했습니다. {error}</div> : null}
        {answer ? <div className="rag-answer"><p>{answer.answer}</p><strong>참조 {answer.references.length}건</strong><ol>{answer.references.map((reference, index) => <li key={`${reference.path}-${index}`}><span>{reference.title}</span><small>{reference.heading || reference.path} · 유사도 {(reference.score * 100).toFixed(1)}%</small></li>)}</ol></div> : <div className="empty-state">아직 RAG 답변이 없습니다.</div>}
        <div className="rag-history"><strong>최근 RAG·지식 기록</strong>{data.timeline.filter((item) => item.event_type === "knowledge").slice(0, 5).map((item) => <span key={item.id}>{formatTimeAgo(item.occurred_at)} · {item.title}</span>)}</div>
      </div>
    </SectionCard>
  );
}

function ObsidianView({ data }: { data: AppData }) {
  const obsidian = data.aiRuntime?.obsidian;
  return (
    <div className="page-stack obsidian-knowledge-view"><SectionCard title="Obsidian 인덱스" eyebrow="장기 Markdown 운영 메모리">
      <div className="settings-list"><div><span>Vault 구성</span><StatusBadge status={obsidian?.configured ? "healthy" : "not_configured"}>{obsidian?.configured ? "구성됨" : "구성 필요"}</StatusBadge></div><div><span>Vault 접근</span><StatusBadge status={obsidian?.reachable ? "healthy" : "offline"}>{obsidian?.reachable ? "정상" : "접근 불가"}</StatusBadge></div><div><span>인덱싱 문서</span><strong>{obsidian?.documentCount ?? 0}개</strong></div><div><span>마지막 동기화</span><strong>{obsidian?.lastSyncAt ? formatTimeAgo(obsidian.lastSyncAt) : "동기화 이력 없음"}</strong></div><div><span>Historian 내보내기</span><strong>{data.historian?.lastExport?.notePath || "내보낸 기록 없음"}</strong></div></div>
    </SectionCard><KnowledgeGraphPanel overview={data.knowledge} /></div>
  );
}
