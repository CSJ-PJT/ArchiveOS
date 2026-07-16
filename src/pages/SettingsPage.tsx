import { useState, type ReactNode } from "react";
import type { AppData } from "../app/AppShell";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { useTheme, type ThemeMode } from "../theme/ThemeProvider";
import { formatTimeAgo, stringifyMeta } from "./pageUtils";
import { loginAdmin, logoutAdmin, type PlatformRole } from "../lib/backendApi";

const sections = [
  "Appearance",
  "Backend",
  "Spring AI",
  "Database",
  "Obsidian",
  "Docker",
  "MCP",
  "Slack",
  "Public Access",
  "Security",
  "Build Information",
] as const;

export function SettingsPage({
  data,
  onRefresh,
  backendOrigin,
}: {
  data: AppData;
  onRefresh: () => void;
  backendOrigin: string;
}) {
  const [open, setOpen] = useState<string>("Appearance");
  const { theme, setTheme } = useTheme();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [requestedRole, setRequestedRole] = useState<Exclude<PlatformRole, "PUBLIC">>("ADMIN");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  async function login() {
    setAuthBusy(true); setAuthError(null);
    try { await loginAdmin(password, requestedRole, username); setPassword(""); await onRefresh(); }
    catch (error) { setAuthError(error instanceof Error ? error.message : String(error)); }
    finally { setAuthBusy(false); }
  }

  async function logout() {
    setAuthBusy(true);
    try { await logoutAdmin(); await onRefresh(); }
    finally { setAuthBusy(false); }
  }

  if (data.auth.role === "PUBLIC") {
    return <div className="page-stack"><SectionCard title="운영자 로그인" eyebrow="PUBLIC 세션에서는 설정을 변경할 수 없습니다">
      <div className="decision-panel">
        <select value={requestedRole} onChange={(event) => setRequestedRole(event.target.value as Exclude<PlatformRole, "PUBLIC">)}>
          <option value="OPERATOR">Operator</option><option value="PM">PM</option><option value="ADMIN">Admin</option>
        </select>
        <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="admin" />
        <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="ARCHIVEOS_ADMIN_PASSWORD" />
        {authError ? <div className="empty-state error-state">{authError}</div> : null}
        <button className="button button-primary" type="button" onClick={login} disabled={authBusy || !password}>{authBusy ? "로그인 중..." : "로그인"}</button>
      </div>
    </SectionCard></div>;
  }

  return (
    <div className="page-stack">
      <SectionCard
        title="Settings"
        eyebrow="Runtime and integration diagnostics"
        action={<button className="button button-secondary" type="button" onClick={onRefresh}>Refresh</button>}
      >
        <div className="box-row"><strong>{data.auth.role}</strong><span>{data.auth.actor}</span><button className="button button-secondary" type="button" onClick={logout} disabled={authBusy}>Logout</button></div>
        <div className="settings-list">
          <SettingsRow title="Appearance" status={theme} open={open === "Appearance"} onToggle={() => setOpen(open === "Appearance" ? "" : "Appearance")}>
            <div className="theme-grid">
              {(["dark", "light", "system"] as ThemeMode[]).map((mode) => (
                <button className={`theme-choice ${theme === mode ? "active" : ""}`} key={mode} type="button" onClick={() => setTheme(mode)}>
                  {mode}
                </button>
              ))}
            </div>
          </SettingsRow>

          <SettingsRow title="Backend" status={data.endpointHealth ? "connected" : "unknown"} open={open === "Backend"} onToggle={() => setOpen(open === "Backend" ? "" : "Backend")}>
            <KeyValue label="Backend origin" value={backendOrigin} />
            <KeyValue label="Endpoint healthy" value={`${data.endpointHealth?.summary.online ?? 0}/${data.endpointHealth?.summary.total ?? 0}`} />
            <pre>{stringifyMeta(data.endpointHealth?.summary || data.errors)}</pre>
          </SettingsRow>

          <SettingsRow title="Spring AI" status={data.platformReadiness ? "connected" : "unknown"} open={open === "Spring AI"} onToggle={() => setOpen(open === "Spring AI" ? "" : "Spring AI")}>
            <KeyValue label="AX readiness score" value={data.platformReadiness ? `${data.platformReadiness.score} (${data.platformReadiness.grade})` : "Unknown"} />
            <KeyValue label="Runtime status" value={data.aiRuntime?.status || "unknown"} />
            <KeyValue label="ChatModel" value={data.aiRuntime ? `${data.aiRuntime.chatModel.model} / ${data.aiRuntime.chatModel.available ? "available" : "unavailable"}` : "unknown"} />
            <KeyValue label="EmbeddingModel" value={data.aiRuntime ? `${data.aiRuntime.embeddingModel.model} / ${data.aiRuntime.embeddingModel.dimensions}d` : "unknown"} />
            <KeyValue label="RAG ready" value={data.aiRuntime?.rag.ready ? "yes" : "no"} />
          </SettingsRow>

          <SettingsRow title="Database" status={data.knowledge ? "connected" : "unknown"} open={open === "Database"} onToggle={() => setOpen(open === "Database" ? "" : "Database")}>
            <KeyValue label="Knowledge nodes" value={data.knowledge?.totalNodes ?? 0} />
            <KeyValue label="Knowledge edges" value={data.knowledge?.totalEdges ?? 0} />
          </SettingsRow>

          <SettingsRow title="Obsidian" status={data.historian?.enabled ? "connected" : "not_configured"} open={open === "Obsidian"} onToggle={() => setOpen(open === "Obsidian" ? "" : "Obsidian")}>
            <KeyValue label="Configured" value={data.historian?.configured ? "yes" : "no"} />
            <KeyValue label="Last export" value={data.historian?.lastExport ? formatTimeAgo(data.historian.lastExport.createdAt) : "None"} />
            <KeyValue label="Relative note path" value={data.historian?.lastExport?.notePath || "Not exposed"} />
          </SettingsRow>

          <SettingsRow title="Docker" status="unknown" open={open === "Docker"} onToggle={() => setOpen(open === "Docker" ? "" : "Docker")}>
            <p>Docker is validated by local CLI/compose checks, not browser UI execution. See README for compose startup.</p>
          </SettingsRow>

          <SettingsRow title="MCP" status={data.runtime ? data.runtime.status : "unknown"} open={open === "MCP"} onToggle={() => setOpen(open === "MCP" ? "" : "MCP")}>
            <KeyValue label="Queue path" value={data.runtime?.queue.path || "Unknown"} />
            <KeyValue label="Active task" value={data.runtime?.active_task || "None"} />
          </SettingsRow>

          <SettingsRow title="Slack" status={data.latestBatch?.slack_webhook_configured ? "configured" : "not_configured"} open={open === "Slack"} onToggle={() => setOpen(open === "Slack" ? "" : "Slack")}>
            <KeyValue label="Notification configured" value={data.latestBatch?.slack_webhook_configured ? "yes" : "no"} />
            <KeyValue label="Last daily report" value={data.dailyReport ? formatTimeAgo(data.dailyReport.created_at) : "None"} />
          </SettingsRow>

          <SettingsRow title="Public Access" status={data.publicAccess?.frontendPublicUrlConfigured ? "connected" : "not_configured"} open={open === "Public Access"} onToggle={() => setOpen(open === "Public Access" ? "" : "Public Access")}>
            <KeyValue label="Frontend public URL" value={data.publicAccess?.frontendPublicUrl || "Not configured"} />
            <KeyValue label="Backend public URL" value={data.publicAccess?.backendPublicUrl || "Not configured"} />
          </SettingsRow>

          <SettingsRow title="Security" status={data.security?.securityLevel || "unknown"} open={open === "Security"} onToggle={() => setOpen(open === "Security" ? "" : "Security")}>
            <KeyValue label="Authentication" value={data.security?.authentication.status || "unknown"} />
            <KeyValue label="OAuth provider" value={data.security?.oauth.provider || "Not configured"} />
            <KeyValue label="Approved devices" value={data.security?.deviceApproval.approvedDevicesCount ?? 0} />
          </SettingsRow>

          <SettingsRow title="Build Information" status={data.runtimeVersion ? "connected" : "unknown"} open={open === "Build Information"} onToggle={() => setOpen(open === "Build Information" ? "" : "Build Information")}>
            <KeyValue label="Backend branch" value={data.runtimeVersion?.branch || "Unknown"} />
            <KeyValue label="Backend commit" value={data.runtimeVersion?.commitSha || "Unknown"} />
            <KeyValue label="Started" value={data.runtimeVersion?.startedAt ? formatTimeAgo(data.runtimeVersion.startedAt) : "Unknown"} />
          </SettingsRow>
        </div>
      </SectionCard>
    </div>
  );
}

function SettingsRow({
  title,
  status,
  open,
  onToggle,
  children,
}: {
  title: string;
  status: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <details className="settings-row" open={open} onToggle={(event) => event.preventDefault()}>
      <summary onClick={onToggle}>
        <strong>{title}</strong>
        <StatusBadge status={status}>{status}</StatusBadge>
      </summary>
      <div className="settings-row-body">{children}</div>
    </details>
  );
}

function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="key-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
