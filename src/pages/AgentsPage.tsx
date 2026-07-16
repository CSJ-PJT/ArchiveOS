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
          <span className="eyebrow">RUNTIME OWNERSHIP</span>
          <h2>에이전트 현황</h2>
          <p>역할별 runtime 상태, handoff 기록, 로컬 큐 제어 권한을 확인합니다.</p>
        </div>
        <StatusBadge status={data.mesh?.health.status || "disconnected"}>{data.mesh?.health.status || "Disconnected"}</StatusBadge>
      </header>

      <section className="summary-strip agent-summary">
        <Summary label="등록 에이전트" value={agents.length} status="healthy" />
        <Summary label="활성 에이전트" value={active} status={active > 0 ? "working" : "inactive"} />
        <Summary label="주의 필요" value={warning} status={warning > 0 ? "warning" : "healthy"} />
        <Summary label="상호작용" value={data.mesh?.recentInteractions.length || 0} status="healthy" />
      </section>

      <SectionCard title="에이전트 Runtime 제어" eyebrow="ADMIN 전용 로컬 제어">
        <div className="runtime-control-panel">
          <div>
            <strong>MCP 큐 루프와 로컬 runtime 스크립트</strong>
            <p>
              제어는 <code>tools/runtime</code>의 allowlist 스크립트만 실행합니다. 대화형 implementer와 reviewer 세션은 별도 PID 구성이 필요합니다.
            </p>
          </div>
          <div className="inline-actions">
            <button className="button button-secondary" type="button" disabled={!canControl || busyAction !== null} onClick={() => void runRuntimeControl("runtime_status")}>상태 확인</button>
            <button className="button button-primary" type="button" disabled={!canControl || busyAction !== null} onClick={() => void runRuntimeControl("runtime_start_all")}>에이전트 시작</button>
            <button className="button button-secondary" type="button" disabled={!canControl || busyAction !== null} onClick={() => void runRuntimeControl("runtime_restart_all")}>재시작</button>
            <button className="button button-secondary" type="button" disabled={!canControl || busyAction !== null} onClick={() => void runRuntimeControl("runtime_stop_all")}>중지</button>
          </div>
          {!canControl ? <p className="small-note">로컬 runtime 프로세스 제어에는 관리자 권한이 필요합니다.</p> : null}
          {message ? <pre className="action-output">{message}</pre> : null}
        </div>
      </SectionCard>

      <SectionCard title="에이전트 모니터" eyebrow="운영 역할과 활동 기록">
        {agents.length === 0 ? <div className="empty-state">로컬 에이전트 runtime이 연결되지 않았습니다. runtime을 시작하면 운영 기록을 불러옵니다.</div> : null}
        <div className="agent-card-grid">
          {agents.map((agent) => (
            <article className="agent-card" key={agent.id} tabIndex={0}>
              <div className="agent-card-icon"><Icon name="agents" size={20} /></div>
              <div className="agent-card-main">
                <div className="agent-card-title">
                  <div><strong>{agent.label}</strong><span>{agent.role}</span></div>
                  <StatusBadge status={agent.status}>{agent.status.replace(/_/g, " ")}</StatusBadge>
                </div>
                <p>{agent.summary || "아직 runtime 활동 기록이 없습니다."}</p>
                <div className="agent-evidence"><span>출처 {agent.source}</span><span>갱신 {formatTimeAgo(data.refreshedAt)}</span></div>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="최근 Handoff" eyebrow="에이전트 간 운영 기록">
        <div className="event-list compact">
          {(data.mesh?.recentInteractions || []).slice(0, 8).map((interaction, index) => (
            <article className="event-row" key={`${interaction.time}-${index}`}>
              <span>{formatTimeAgo(interaction.time)}</span><StatusBadge status="working">{interaction.type}</StatusBadge>
              <strong>{interaction.from} to {interaction.to}</strong><p>{interaction.summary}</p>
            </article>
          ))}
          {!data.mesh?.recentInteractions.length ? <div className="empty-state">아직 에이전트 간 handoff 기록이 없습니다.</div> : null}
        </div>
      </SectionCard>
    </div>
  );
}

function Summary({ label, value, status }: { label: string; value: number; status: string }) {
  return <div className="summary-card"><span>{label}</span><strong>{value}</strong><StatusBadge status={status}>{status === "inactive" ? "대기" : status}</StatusBadge></div>;
}
