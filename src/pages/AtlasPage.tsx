import { useMemo, useState } from "react";
import type { AppData } from "../app/AppShell";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import type { AtlasCodexWorkLog } from "../lib/backendApi";
import { createAtlasWorkLog, runAtlasHealthchecks } from "../lib/backendApi";
import { formatTimeAgo } from "./pageUtils";

export function AtlasPage({ data, onRefresh }: { data: AppData; onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [logBusy, setLogBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [logMessage, setLogMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    workTitle: "",
    targetServiceId: "",
    repository: "",
    actor: "Codex",
    agent: "",
    model: "",
    reasoningLevel: "",
    taskSummary: "",
    changedFiles: "",
    testResults: "",
    failureReason: "",
    nextActions: "",
    committed: false,
    pushed: false,
    deployed: false,
    rollbackPlan: "",
  });
  const atlas = data.atlas;
  const serviceById = useMemo(() => new Map((atlas?.services || []).map((service) => [service.service_id, service.name])), [atlas?.services]);
  const workLogsByService = useMemo(() => {
    const rows = new Map<string, AtlasCodexWorkLog[]>();
    for (const log of atlas?.recent_work_logs || []) {
      const key = log.target_service_id || "atlas-platform";
      rows.set(key, [...(rows.get(key) || []), log]);
    }
    return rows;
  }, [atlas?.recent_work_logs]);
  const canRun = data.auth.role === "ADMIN" || data.auth.role === "PM";
  const canCreateWorkLog = data.auth.role === "ADMIN";

  async function runChecks() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await runAtlasHealthchecks();
      setMessage(`Healthcheck completed: ${result.system_status} - ${result.reason}`);
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to run Atlas healthchecks.");
    } finally {
      setBusy(false);
    }
  }

  async function submitWorkLog() {
    setLogBusy(true);
    setLogMessage(null);
    try {
      await createAtlasWorkLog({
        workTitle: form.workTitle,
        targetServiceId: form.targetServiceId || null,
        repository: form.repository || null,
        actor: form.actor || null,
        agent: form.agent || null,
        model: form.model || null,
        reasoningLevel: form.reasoningLevel || null,
        taskSummary: form.taskSummary || null,
        changedFiles: lines(form.changedFiles),
        testResults: lines(form.testResults),
        failureReason: form.failureReason || null,
        nextActions: lines(form.nextActions),
        committed: form.committed,
        pushed: form.pushed,
        deployed: form.deployed,
        rollbackPlan: form.rollbackPlan || null,
      });
      setLogMessage("Codex work log recorded.");
      setForm((current) => ({
        ...current,
        workTitle: "",
        taskSummary: "",
        changedFiles: "",
        testResults: "",
        failureReason: "",
        nextActions: "",
        rollbackPlan: "",
      }));
      await onRefresh();
    } catch (error) {
      setLogMessage(error instanceof Error ? error.message : "Failed to record Codex work log.");
    } finally {
      setLogBusy(false);
    }
  }

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  if (!atlas) {
    return <div className="empty-state">Atlas observability registry is unavailable. Check archiveos-ai and database migrations.</div>;
  }

  return <div className="page-stack">
    <SectionCard title="Atlas Overview" eyebrow="External managed system">
      <div className="detail-grid">
        <span>System<strong>{atlas.system.name}</strong></span>
        <span>Status<strong><StatusBadge status={atlas.system.current_status}>{atlas.system.current_status}</StatusBadge></strong></span>
        <span>Environment<strong>{atlas.system.environment}</strong></span>
        <span>Provider<strong>{atlas.system.provider}</strong></span>
        <span>Public URL<strong>{atlas.system.public_base_url}</strong></span>
        <span>Role<strong>{atlas.system.role}</strong></span>
      </div>
      <p className="small-note">{atlas.system.reason || "Atlas platform is registered as an external operating target."}</p>
    </SectionCard>

    <SectionCard title="Service Status Board" eyebrow="Registry + healthcheck policy">
      <div className="history-table">
        {atlas.services.map((service) => <div className="history-row" key={service.service_id}>
          <summary>
            <strong>{service.name}</strong>
            <StatusBadge status={service.current_status}>{service.current_status}</StatusBadge>
            <span>{service.criticality} · {service.service_type}</span>
            <p>{service.url_path} → {service.healthcheck_url}</p>
          </summary>
          <div className="detail-grid">
            <span>Repository<strong>{service.repository}</strong></span>
            <span>Expected<strong>HTTP {service.expected_status}</strong></span>
            <span>Timeout<strong>{service.timeout_ms}ms</strong></span>
            <span>Retry<strong>{service.retry_count}</strong></span>
          </div>
          {service.note ? <p className="small-note">{service.note}</p> : null}
        </div>)}
      </div>
    </SectionCard>

    <SectionCard title="Recent Healthcheck Results" eyebrow="Read-only HTTP monitor">
      <div className="inline-actions">
        <button className="button button-primary" type="button" disabled={!canRun || busy} onClick={() => void runChecks()}>
          {busy ? "Checking..." : "Run healthcheck"}
        </button>
        {!canRun ? <span className="small-note">PM or Admin session is required to run healthchecks.</span> : null}
      </div>
      {message ? <p className="small-note">{message}</p> : null}
      <div className="history-table">
        {atlas.recent_healthchecks.map((result) => {
          const relatedLogs = workLogsByService.get(result.service_id) || [];
          const latestLog = relatedLogs[0];
          return <div className="history-row" key={result.id}>
            <summary>
              <strong>{serviceById.get(result.service_id) ?? result.service_id}</strong>
              <StatusBadge status={result.status}>{result.status}</StatusBadge>
              <span>{formatTimeAgo(result.checked_at)}</span>
              <p>HTTP {result.http_status ?? "n/a"} · {result.latency_ms ?? "n/a"}ms · expected {result.expected_status}</p>
            </summary>
            <div className="detail-grid">
              <span>Linked work logs<strong>{relatedLogs.length}</strong></span>
              <span>Latest work<strong>{latestLog?.work_title || "No related Codex log"}</strong></span>
            </div>
            {result.error_message ? <p className="small-note">{result.error_message}</p> : null}
          </div>;
        })}
        {!atlas.recent_healthchecks.length ? <div className="empty-state">No Atlas healthcheck results yet. Run a check from a PM/Admin session.</div> : null}
      </div>
    </SectionCard>

    <SectionCard title="Codex Work Log" eyebrow="Manual operation evidence">
      {canCreateWorkLog ? <div className="settings-grid">
        <label>Work title<input value={form.workTitle} onChange={(event) => updateField("workTitle", event.target.value)} placeholder="Health Atlas build strategy review" /></label>
        <label>Target service<select value={form.targetServiceId} onChange={(event) => updateField("targetServiceId", event.target.value)}>
          <option value="">Atlas Platform</option>
          {atlas.services.map((service) => <option key={service.service_id} value={service.service_id}>{service.name}</option>)}
        </select></label>
        <label>Repository<input value={form.repository} onChange={(event) => updateField("repository", event.target.value)} placeholder="CSJ-PJT/Health-Atlas" /></label>
        <label>Actor<input value={form.actor} onChange={(event) => updateField("actor", event.target.value)} placeholder="Codex" /></label>
        <label>Agent<input value={form.agent} onChange={(event) => updateField("agent", event.target.value)} placeholder="ArchiveOS" /></label>
        <label>Model<input value={form.model} onChange={(event) => updateField("model", event.target.value)} placeholder="gpt-5-codex" /></label>
        <label>Reasoning level<input value={form.reasoningLevel} onChange={(event) => updateField("reasoningLevel", event.target.value)} placeholder="high" /></label>
        <label>Task summary<textarea rows={3} value={form.taskSummary} onChange={(event) => updateField("taskSummary", event.target.value)} /></label>
        <label>Changed files<textarea rows={3} value={form.changedFiles} onChange={(event) => updateField("changedFiles", event.target.value)} placeholder="One file per line" /></label>
        <label>Test results<textarea rows={3} value={form.testResults} onChange={(event) => updateField("testResults", event.target.value)} placeholder="npm run build: passed" /></label>
        <label>Failure reason<textarea rows={2} value={form.failureReason} onChange={(event) => updateField("failureReason", event.target.value)} /></label>
        <label>Next actions<textarea rows={3} value={form.nextActions} onChange={(event) => updateField("nextActions", event.target.value)} placeholder="One action per line" /></label>
        <label>Rollback plan<textarea rows={2} value={form.rollbackPlan} onChange={(event) => updateField("rollbackPlan", event.target.value)} /></label>
        <div className="inline-actions">
          <label><input type="checkbox" checked={form.committed} onChange={(event) => updateField("committed", event.target.checked)} /> committed</label>
          <label><input type="checkbox" checked={form.pushed} onChange={(event) => updateField("pushed", event.target.checked)} /> pushed</label>
          <label><input type="checkbox" checked={form.deployed} onChange={(event) => updateField("deployed", event.target.checked)} /> deployed</label>
        </div>
        <div className="inline-actions">
          <button className="button button-primary" type="button" disabled={logBusy || !form.workTitle.trim()} onClick={() => void submitWorkLog()}>
            {logBusy ? "Recording..." : "Record Codex work log"}
          </button>
          {logMessage ? <span className="small-note">{logMessage}</span> : null}
        </div>
      </div> : <p className="small-note">Admin session is required to create Codex work logs. Public mode remains read-only.</p>}
      <div className="history-table">
        {atlas.recent_work_logs.map((log) => <div className="history-row" key={log.id}>
          <summary>
            <strong>{log.work_title}</strong>
            <StatusBadge status={log.failure_reason ? "failed" : "recorded"}>{log.failure_reason ? "failed" : "recorded"}</StatusBadge>
            <span>{formatTimeAgo(log.created_at)}</span>
            <p>{log.task_summary || "No summary recorded."}</p>
          </summary>
          <div className="detail-grid">
            <span>Service<strong>{log.target_service_id ? serviceById.get(log.target_service_id) ?? log.target_service_id : "Atlas Platform"}</strong></span>
            <span>Repository<strong>{log.repository || "n/a"}</strong></span>
            <span>Commit<strong>{log.committed ? "Yes" : "No"}</strong></span>
            <span>Deploy<strong>{log.deployed ? "Yes" : "No"}</strong></span>
          </div>
        </div>)}
        {!atlas.recent_work_logs.length ? <div className="empty-state">No Codex work logs recorded yet.</div> : null}
      </div>
    </SectionCard>

    <SectionCard title="Repository Matrix" eyebrow="Service ownership map">
      <div className="kpi-history-grid">
        {atlas.services.map((service) => <div className="kpi-row" key={service.service_id}>
          <span>{service.name}</span>
          <strong>{service.repository}</strong>
        </div>)}
      </div>
      <p className="small-note">Secret values are intentionally not stored. Environment requirements keep names only.</p>
    </SectionCard>

    <SectionCard title="Environment Requirements" eyebrow="Names only, no secret values">
      <div className="kpi-history-grid">
        {atlas.environment_requirements.map((env) => <div className="kpi-row" key={env.id}>
          <span>{env.service_id ? serviceById.get(env.service_id) ?? env.service_id : atlas.system.name}</span>
          <strong>{env.env_name}{env.secret ? " · secret" : ""}</strong>
        </div>)}
      </div>
    </SectionCard>
  </div>;
}

function lines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}
