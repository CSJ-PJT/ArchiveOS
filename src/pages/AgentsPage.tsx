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
          <span className="eyebrow">Runtime ownership</span>
          <h2>Agents</h2>
          <p>Monitor each agent role, runtime state, handoff evidence, and local queue-loop controls.</p>
        </div>
        <StatusBadge status={data.mesh?.health.status || "disconnected"}>{data.mesh?.health.status || "Disconnected"}</StatusBadge>
      </header>

      <section className="summary-strip agent-summary">
        <Summary label="Registered" value={agents.length} status="healthy" />
        <Summary label="Active" value={active} status={active > 0 ? "working" : "inactive"} />
        <Summary label="Attention" value={warning} status={warning > 0 ? "warning" : "healthy"} />
        <Summary label="Interactions" value={data.mesh?.recentInteractions.length || 0} status="healthy" />
      </section>

      <SectionCard title="Agent Runtime Controls" eyebrow="Admin-only local orchestration">
        <div className="runtime-control-panel">
          <div>
            <strong>MCP queue loop and local runtime scripts</strong>
            <p>
              Controls execute only the allowlisted scripts in <code>tools/runtime</code>. Interactive Codex implementer
              and reviewer sessions still require local PID configuration.
            </p>
          </div>
          <div className="inline-actions">
            <button className="button button-secondary" type="button" disabled={!canControl || busyAction !== null} onClick={() => void runRuntimeControl("runtime_status")}>Status</button>
            <button className="button button-primary" type="button" disabled={!canControl || busyAction !== null} onClick={() => void runRuntimeControl("runtime_start_all")}>Start agents</button>
            <button className="button button-secondary" type="button" disabled={!canControl || busyAction !== null} onClick={() => void runRuntimeControl("runtime_restart_all")}>Restart</button>
            <button className="button button-secondary" type="button" disabled={!canControl || busyAction !== null} onClick={() => void runRuntimeControl("runtime_stop_all")}>Stop</button>
          </div>
          {!canControl ? <p className="small-note">Admin unlock is required for local runtime process control.</p> : null}
          {message ? <pre className="action-output">{message}</pre> : null}
        </div>
      </SectionCard>

      <SectionCard title="Agent Monitor" eyebrow="Operational roles and evidence">
        {agents.length === 0 ? <div className="empty-state">Agent runtime is disconnected. Start the local runtime to load operator evidence.</div> : null}
        <div className="agent-card-grid">
          {agents.map((agent) => (
            <article className="agent-card" key={agent.id} tabIndex={0}>
              <div className="agent-card-icon"><Icon name="agents" size={20} /></div>
              <div className="agent-card-main">
                <div className="agent-card-title">
                  <div><strong>{agent.label}</strong><span>{agent.role}</span></div>
                  <StatusBadge status={agent.status}>{agent.status.replace(/_/g, " ")}</StatusBadge>
                </div>
                <p>{agent.summary || "No runtime evidence has been recorded yet."}</p>
                <div className="agent-evidence"><span>Source {agent.source}</span><span>Updated {formatTimeAgo(data.refreshedAt)}</span></div>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Recent Handoffs" eyebrow="Agent-to-agent operating evidence">
        <div className="event-list compact">
          {(data.mesh?.recentInteractions || []).slice(0, 8).map((interaction, index) => (
            <article className="event-row" key={`${interaction.time}-${index}`}>
              <span>{formatTimeAgo(interaction.time)}</span><StatusBadge status="working">{interaction.type}</StatusBadge>
              <strong>{interaction.from} to {interaction.to}</strong><p>{interaction.summary}</p>
            </article>
          ))}
          {!data.mesh?.recentInteractions.length ? <div className="empty-state">No agent handoffs have been recorded yet.</div> : null}
        </div>
      </SectionCard>
    </div>
  );
}

function Summary({ label, value, status }: { label: string; value: number; status: string }) {
  return <div className="summary-card"><span>{label}</span><strong>{value}</strong><StatusBadge status={status}>{status === "inactive" ? "Waiting" : status}</StatusBadge></div>;
}
