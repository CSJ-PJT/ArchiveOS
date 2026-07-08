import type { AppData } from "../app/AppShell";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { formatTimeAgo } from "./pageUtils";

export function McpRegistryPage({ data }: { data: AppData }) {
  if (data.auth.role === "PUBLIC") {
    return <div className="empty-state">Operator, PM, or Admin session is required to view the MCP Registry.</div>;
  }
  return <div className="page-stack">
    <SectionCard title="MCP Registry" eyebrow="Read-only tool governance registry">
      <div className="history-table">
        {data.mcpRegistry.map((entry) => <div className="history-row" key={entry.id}>
          <summary><strong>{entry.tool}</strong><StatusBadge status={entry.health}>{entry.health}</StatusBadge><span>{entry.provider}</span><p>{entry.capability}</p></summary>
          <div className="detail-grid">
            <span>Permission<strong>{entry.permission}</strong></span>
            <span>Approval<strong>{entry.approval_required ? "Required" : "Not required"}</strong></span>
            <span>Enabled<strong>{entry.enabled ? "Yes" : "No"}</strong></span>
            <span>Last run<strong>{entry.last_run ? formatTimeAgo(entry.last_run) : "Never"}</strong></span>
          </div>
        </div>)}
        {!data.mcpRegistry.length ? <div className="empty-state">Registry is unavailable or contains no tools.</div> : null}
      </div>
      <p className="small-note">Execution is intentionally unavailable. Tool changes require Admin-controlled backend configuration.</p>
    </SectionCard>
  </div>;
}
