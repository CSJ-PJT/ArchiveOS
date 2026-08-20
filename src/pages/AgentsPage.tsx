import { useState } from "react";
import type { AppData } from "../app/AppShell";
import { Icon } from "../components/shared/Icon";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { runLocalAction, type LocalAction } from "../lib/backendApi";
import { formatTimeAgo } from "./pageUtils";

const preferredOrder = ["implementer", "reviewer", "architect", "historian", "loop", "bridge"];

export function AgentsPage({ data, onRefresh }: { data: AppData; onRefresh: () => Promise<void> }) {
  const agents = [...(data.mesh?.agents || [])].sort((a, b) => preferredOrder.indexOf(a.id) - preferredOrder.indexOf(b.id));
  const registeredAgents = data.dashboard?.agents ?? [];
  const active = agents.filter((agent) => ["detected", "working", "clear", "enabled"].includes(agent.status)).length;
  const warning = agents.filter((agent) => ["warning", "blocked"].includes(agent.status)).length;
  const canControl = data.auth.role === "ADMIN";
  const [busyAction, setBusyAction] = useState<LocalAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function runRuntimeControl(action: LocalAction) {
    setBusyAction(action);
    setMessage(null);
    try {
      const result = await runLocalAction({ project_id: "archiveos", action });
      setMessage(`${action} ${result.status}.\n${result.stdout || result.stderr || "No runtime output."}`);
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Runtime control failed.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">런타임 소유권</span>
          <h2>에이전트 현황</h2>
          <p>역할별 runtime 상태, handoff 기록, 로컬 큐 제어 권한을 확인합니다.</p>
        </div>
        <StatusBadge status={data.mesh?.health.status || "disconnected"}>{agentStatusLabel(data.mesh?.health.status)}</StatusBadge>
      </header>

      <section className="summary-strip agent-summary">
        <Summary label="DB 등록 에이전트" value={registeredAgents.length} status={registeredAgents.length ? "healthy" : "inactive"} />
        <Summary label="Runtime 에이전트" value={agents.length} status={agents.length ? "healthy" : "inactive"} />
        <Summary label="활성 에이전트" value={active} status={active > 0 ? "working" : "inactive"} />
        <Summary label="주의 필요" value={warning} status={warning > 0 ? "warning" : "healthy"} />
        <Summary label="상호작용" value={data.mesh?.recentInteractions.length || 0} status="healthy" />
      </section>

      <SectionCard title="DB 에이전트 레지스트리" eyebrow="ARCHIVEOS POSTGRESQL">
        {registeredAgents.length ? <div className="agent-card-grid">{registeredAgents.map((agent) => (
          <article className="agent-card" key={agent.id}>
            <div className="agent-card-icon"><Icon name="agents" size={20} /></div>
            <div className="agent-card-main"><div className="agent-card-title"><div><strong>{agent.name}</strong><span>{agentRoleLabel(agent.role)}</span></div><StatusBadge status={agent.status === "failed" ? "warning" : agent.status === "working" ? "working" : "waiting"}>{agentStatusLabel(agent.status)}</StatusBadge></div><p>{agentTaskLabel(agent.current_task)}</p><div className="agent-evidence"><span>ArchiveOS PostgreSQL</span><span>갱신 {formatTimeAgo(agent.updated_at)}</span></div></div>
          </article>
        ))}</div> : <div className="empty-state">등록된 DB 에이전트가 없습니다.</div>}
      </SectionCard>

      <SectionCard title="에이전트 모니터" eyebrow="운영 역할과 활동 기록">
        {agents.length === 0 ? <div className="empty-state">DB 에이전트 {registeredAgents.length}개는 정상 등록되어 있습니다. 현재 별도 로컬 Runtime 프로세스만 실행되지 않은 상태입니다.</div> : null}
        <div className="agent-card-grid">
          {agents.map((agent) => (
            <article className="agent-card" key={agent.id} tabIndex={0}>
              <div className="agent-card-icon"><Icon name="agents" size={20} /></div>
              <div className="agent-card-main">
                <div className="agent-card-title">
                  <div><strong>{agentNameLabel(agent.id, agent.label)}</strong><span>{agentRoleLabel(agent.role)}</span></div>
                  <StatusBadge status={agent.status}>{agentStatusLabel(agent.status)}</StatusBadge>
                </div>
                <p>{agentSummaryLabel(agent.id, agent.summary)}</p>
                <div className="agent-evidence"><span>출처 {agentSourceLabel(agent.source)}</span><span>갱신 {formatTimeAgo(data.refreshedAt)}</span></div>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="최근 Handoff" eyebrow="에이전트 간 운영 기록">
        <div className="event-list compact">
          {(data.mesh?.recentInteractions || []).slice(0, 8).map((interaction, index) => (
            <article className="event-row" key={`${interaction.time}-${index}`}>
              <span>{formatTimeAgo(interaction.time)}</span><StatusBadge status="working">{interactionTypeLabel(interaction.type)}</StatusBadge>
              <strong>{agentNameLabel(interaction.from, interaction.from)} → {agentNameLabel(interaction.to, interaction.to)}</strong><p>{interactionSummaryLabel(interaction.summary)}</p>
            </article>
          ))}
          {!data.mesh?.recentInteractions.length ? <div className="empty-state">아직 에이전트 간 handoff 기록이 없습니다.</div> : null}
        </div>
      </SectionCard>

      <SectionCard title="로컬 에이전트 제어" eyebrow="관리자 세션 전용">
        <div className="runtime-control-panel">
          <div><strong>MCP 큐와 로컬 Runtime</strong><p>허용 목록에 등록된 로컬 Runtime 스크립트만 제어합니다. 공개 조회 세션에서는 실행 버튼이 잠깁니다.</p></div>
          <div className="inline-actions">
            <button className="button button-secondary" type="button" disabled={!canControl || busyAction !== null} onClick={() => void runRuntimeControl("runtime_status")}>상태 확인</button>
            <button className="button button-primary" type="button" disabled={!canControl || busyAction !== null} onClick={() => void runRuntimeControl("runtime_start_all")}>에이전트 시작</button>
            <button className="button button-secondary" type="button" disabled={!canControl || busyAction !== null} onClick={() => void runRuntimeControl("runtime_restart_all")}>재시작</button>
            <button className="button button-secondary" type="button" disabled={!canControl || busyAction !== null} onClick={() => void runRuntimeControl("runtime_stop_all")}>중지</button>
          </div>
          {!canControl ? <p className="small-note">로컬 Runtime 제어는 관리자 로그인 후 사용할 수 있습니다.</p> : null}
          {message ? <pre className="action-output">{message}</pre> : null}
        </div>
      </SectionCard>
    </div>
  );
}

function Summary({ label, value, status }: { label: string; value: number; status: string }) {
  return <div className="summary-card"><span>{label}</span><strong>{value}</strong><StatusBadge status={status}>{agentStatusLabel(status)}</StatusBadge></div>;
}

function agentStatusLabel(value: string | null | undefined) {
  return ({ healthy: "정상", normal: "정상", working: "진행 중", waiting: "대기", inactive: "대기", idle: "유휴", reviewing: "검토 중", reviewed: "검토 완료", detected: "감지됨", not_detected: "미실행", no_review: "검토 기록 없음", enabled: "활성", disabled: "비활성", clear: "이상 없음", warning: "주의", blocked: "차단됨", failed: "실패", disconnected: "연결 안 됨" } as Record<string, string>)[String(value || "").toLowerCase()] || "상태 미수집";
}

function agentRoleLabel(value: string | null | undefined) {
  return ({ planner: "기획", reviewer: "검토", logger: "기록", builder: "구현", implementer: "구현", architect: "아키텍처", historian: "이력 관리", bridge: "연동", loop: "반복 운영", "code implementation": "코드 구현", "code review and approval": "코드 검토 및 승인", "architecture risk review": "아키텍처 위험 검토", "long-term memory and obsidian export": "장기 기억 및 옵시디언 내보내기", "queue runner": "운영 큐 실행", "review handoff bridge": "검토 인계 연동" } as Record<string, string>)[String(value || "").toLowerCase()] || "역할 미수집";
}

function agentTaskLabel(value: string | null | undefined) {
  if (!value) return "현재 배정된 작업이 없습니다.";
  return ({ "Breaking down onboarding tasks": "온보딩 작업을 세분화하는 중입니다.", "Waiting for schema approval": "스키마 승인을 기다리는 중입니다.", "Checking dashboard data flow": "대시보드 데이터 흐름을 확인하는 중입니다." } as Record<string, string>)[value] || value;
}

function agentNameLabel(id: string | null | undefined, fallback: string) {
  return ({ implementer: "구현 에이전트", reviewer: "검토 에이전트", architect: "아키텍처 에이전트", historian: "이력 에이전트", loop: "운영 큐 에이전트", bridge: "검토 연동 에이전트", human_pm: "운영 관리자" } as Record<string, string>)[String(id || "").toLowerCase()] || fallback;
}

function agentSourceLabel(value: string | null | undefined) {
  return ({ runtime: "로컬 런타임", architect: "아키텍처 검토", historian: "운영 이력", knowledge_graph: "운영 지식", derived: "파생 상태" } as Record<string, string>)[String(value || "").toLowerCase()] || "운영 데이터";
}

function agentSummaryLabel(id: string, value: string | null | undefined) {
  const summary = value || "";
  if (id === "architect" && summary) return summary
    .replace("Architect review passed with no rule-based findings.", "규칙 기반 위험 없이 아키텍처 단건 검토를 완료했습니다.")
    .replace("Architecture review completed with no blocking findings.", "차단 사유 없이 아키텍처 단건 검토를 완료했습니다.")
    .replace("Architecture review completed", "아키텍처 단건 검토를 완료했습니다");
  if (summary.startsWith("Active task:")) return `현재 작업: ${summary.slice("Active task:".length).trim()}`;
  if (summary.includes("Implementer process detected")) return "구현 프로세스가 감지됐으며 현재 처리 중인 작업은 없습니다.";
  if (summary.includes("Implementer process not detected")) return "현재 구현 프로세스가 실행되지 않았습니다.";
  if (summary.startsWith("Latest verdict:")) return `최근 검토 결과: ${summary.slice("Latest verdict:".length).trim()}`;
  if (summary.includes("No reviewer verdict")) return "아직 검토 결과가 기록되지 않았습니다.";
  if (summary.startsWith("Latest export:")) return `최근 이력 내보내기: ${summary.slice("Latest export:".length).trim()}`;
  if (summary.includes("Historian configured")) return "이력 에이전트가 설정됐으며 아직 내보내기 기록은 없습니다.";
  if (summary.includes("Historian vault path not configured")) return "이력 저장소 경로가 설정되지 않았습니다.";
  if (summary.startsWith("Queue:")) return summary.replace(/^Queue: inbox (\d+), processing (\d+), outbox (\d+), reviews (\d+)\.$/, "운영 큐: 대기 $1건, 처리 중 $2건, 결과 $3건, 검토 $4건.");
  if (summary.includes("Reviewer bridge process detected")) return "검토 연동 프로세스가 감지됐습니다.";
  if (summary.includes("Reviewer bridge process not detected")) return "검토 연동 프로세스가 실행되지 않았습니다.";
  if (summary.includes("No architecture review recorded")) return "아직 아키텍처 검토 기록이 없습니다.";
  return summary || "아직 런타임 활동 기록이 없습니다.";
}

function interactionTypeLabel(value: string) {
  return ({ dispatches: "작업 배정", hands_off_to: "작업 인계", produces_verdict: "검토 결과", guards: "위험 점검", provides_memory: "기억 제공" } as Record<string, string>)[value] || value.replace(/_/g, " ");
}

function interactionSummaryLabel(value: string) {
  return ({ "queue task": "운영 큐 작업", "builder result -> review": "구현 결과를 검토로 인계", verdict: "검토 결과 전달", "architecture risk": "아키텍처 위험 점검", "related context": "관련 운영 문맥 제공", "review bridge": "검토 연동" } as Record<string, string>)[value] || value;
}
