import { useState, type ReactNode } from "react";
import type { AppData } from "../app/AppShell";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { useTheme, type ThemeMode } from "../theme/ThemeProvider";
import { formatTimeAgo, stringifyMeta } from "./pageUtils";

const sections = [
  "Appearance",
  "Backend",
  "Spring AI",
  "Database",
  "Obsidian",
  "Docker",
  "MCP",
  "Discord",
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

  return (
    <div className="page-stack">
      <SectionCard
        title="Settings"
        eyebrow="Runtime and integration diagnostics"
        action={<button className="button button-secondary" type="button" onClick={onRefresh}>Refresh</button>}
      >
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
            <KeyValue label="RAG proxy" value={data.endpointHealth?.endpoints.find((endpoint) => endpoint.path.includes("rag"))?.status || "unknown"} />
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

          <SettingsRow title="Discord" status={data.latestBatch?.discord_webhook_configured ? "configured" : "not_configured"} open={open === "Discord"} onToggle={() => setOpen(open === "Discord" ? "" : "Discord")}>
            <KeyValue label="Webhook configured" value={data.latestBatch?.discord_webhook_configured ? "yes" : "no"} />
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
