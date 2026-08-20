import { useEffect, useState } from "react";
import type { AppData } from "../app/AppShell";
import { AgentsPage } from "./AgentsPage";
import { WorkforcePage } from "./WorkforcePage";
import { WorkflowsPage } from "./WorkflowsPage";
import { BatchPage } from "./BatchPage";
import { RpaPage } from "./RpaPage";
import { ConsoleTabs, PageHeader } from "./ConsoleServicesPage";
import { useI18n } from "../i18n/I18nProvider";
import { consoleText } from "../i18n/console";
import { getDecisionRecommendations, getIncidents, getPmAttention, type AiOperationsItem, type DecisionRecommendation, type IncidentRecord } from "../lib/backendApi";

export function ConsoleOperationsPage({ data, onRefresh }: { data: AppData; onRefresh: () => Promise<void> }) {
  const { locale } = useI18n();
  const [tab, setTab] = useState<"agents" | "workforce" | "workflows" | "automation">("agents");
  const [automationTab, setAutomationTab] = useState<"batch" | "rpa">("batch");
  const [decisions, setDecisions] = useState<DecisionRecommendation[]>([]);
  const [attention, setAttention] = useState<AiOperationsItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  useEffect(() => { void getDecisionRecommendations(5).then(setDecisions).catch(() => setDecisions([])); }, []);
  useEffect(() => { void Promise.all([getPmAttention(), getIncidents()]).then(([items, records]) => { setAttention(items.slice(0, 5)); setIncidents(records.slice(0, 3)); }).catch(() => { setAttention([]); setIncidents([]); }); }, []);
  return <div className="console-page operations-v4">
    <PageHeader title={consoleText(locale, "page.operations.title")} description={consoleText(locale, "page.operations.description")} />
    <div className="operations-mode-note"><strong>{data.auth.role === "ADMIN" ? "관리자 세션" : "조회 전용 세션"}</strong><span>{data.auth.role === "ADMIN" ? "제안 확인과 제한된 수동 갱신만 가능하며, 외부 쓰기는 safe-mode 정책을 따릅니다." : "운영 데이터와 에이전트 제안은 조회만 가능합니다."}</span></div>
    {decisions.length ? <section className="operations-mode-note"><strong>AI 결정 제안</strong><span>{decisions.filter((item) => item.status === "REVIEW_REQUIRED").length}건 검토 대기 · 모든 제안은 사람 승인 전 외부 작업을 실행하지 않습니다.</span></section> : null}
    <ConsoleTabs value={tab} onChange={setTab} items={[["agents", "에이전트"], ["workforce", "작업 역량"], ["workflows", "작업 흐름"], ["automation", "자동화"]]} />
    {(attention.length || incidents.length) ? <section className="operations-mode-note ai-operations-attention" aria-label="AI operations attention">
      <strong>운영 우선 확인</strong>
      <div className="ai-operations-attention-grid">
        {attention.map((item) => <span key={item.inboxId} title={item.summary}>{attentionTypeLabel(item.type)} · {item.service || "ArchiveOS"} · 점수 {item.deterministicScore}</span>)}
        {incidents.map((item) => <span key={item.incident_id} title={item.title}>장애 · {incidentLabel(item.severity)} · {incidentLabel(item.status)}</span>)}
      </div>
      <small>점수는 결정 규칙으로 산정하며, AI는 명시적으로 요청한 경우에만 근거 설명을 제공합니다.</small>
    </section> : null}
    {tab === "agents" ? <AgentsPage data={data} onRefresh={onRefresh} /> : null}
    {tab === "workforce" ? <WorkforcePage data={data} /> : null}
    {tab === "workflows" ? <WorkflowsPage data={data} onRefresh={onRefresh} /> : null}
    {tab === "automation" ? <div className="page-stack automation-console"><ConsoleTabs value={automationTab} onChange={setAutomationTab} items={[["batch", "배치 작업"], ["rpa", "RPA 검토"]]} />{automationTab === "batch" ? <BatchPage role={data.auth.role} /> : <RpaPage role={data.auth.role} />}</div> : null}
  </div>;
}

function attentionTypeLabel(value: string) { return ({ system: "시스템", approval: "승인", incident: "장애", task: "작업", agent: "에이전트" } as Record<string, string>)[String(value || "").toLowerCase()] || value.replace(/_/g, " "); }
function incidentLabel(value: string) { return ({ low: "낮음", medium: "보통", high: "높음", critical: "매우 높음", open: "발생", investigating: "조사 중", resolved: "해결", closed: "종료" } as Record<string, string>)[String(value || "").toLowerCase()] || value.replace(/_/g, " "); }
