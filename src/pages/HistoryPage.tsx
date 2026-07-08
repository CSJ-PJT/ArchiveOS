import { useMemo, useState } from "react";
import type { AppData } from "../app/AppShell";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { formatTimeAgo } from "./pageUtils";

type HistoryFilter = "runtime timeline" | "events" | "commands" | "agent runs" | "decisions" | "errors" | "kpi";

const filters: HistoryFilter[] = ["runtime timeline", "events", "commands", "agent runs", "decisions", "errors", "kpi"];

export function HistoryPage({ data }: { data: AppData }) {
  const [filter, setFilter] = useState<HistoryFilter>("runtime timeline");
  const decisionLogs = data.dashboard?.decisions || [];
  const errorEvents = useMemo(() => data.events.filter((event) => event.status === "error" || event.type === "warning"), [data.events]);

  return (
    <div className="page-stack">
      <div className="subnav">
        {filters.map((item) => (
          <button className={filter === item ? "active" : ""} type="button" key={item} onClick={() => setFilter(item)}>
            {item}
          </button>
        ))}
      </div>

      {filter === "runtime timeline" ? (
        <SectionCard title="Runtime Timeline" eyebrow="Task · Workflow · Approval · Knowledge · Slack · Agent · Batch">
          <TimelineRows rows={data.timeline.map((event) => ({
            id: event.id,
            time: event.occurred_at,
            type: event.event_type,
            status: event.status,
            target: event.source,
            summary: `${event.title}${event.summary ? ` - ${event.summary}` : ""}${event.correlation_id ? ` · ${event.correlation_id}` : ""}`,
          }))} />
        </SectionCard>
      ) : null}

      {filter === "events" ? (
        <SectionCard title="Timeline" eyebrow="Operational history">
          <TimelineRows rows={data.events.map((event) => ({
            id: event.id,
            time: event.created_at,
            type: event.type,
            status: event.status,
            target: event.source,
            summary: `${event.title} - ${event.description}`,
          }))} />
        </SectionCard>
      ) : null}

      {filter === "commands" ? (
        <SectionCard title="Commands" eyebrow="Recorded command suggestions/results">
          <TimelineRows rows={data.commands.map((command) => ({
            id: command.id,
            time: command.created_at,
            type: command.command_type || "command",
            status: command.status,
            target: command.command,
            summary: command.result || "No result recorded",
          }))} />
        </SectionCard>
      ) : null}

      {filter === "agent runs" ? (
        <SectionCard title="Agent Runs" eyebrow="Runtime evidence">
          <TimelineRows rows={(data.events || []).filter((event) => ["builder", "reviewer", "task"].includes(event.type)).map((event) => ({
            id: event.id,
            time: event.created_at,
            type: event.type,
            status: event.status,
            target: event.title,
            summary: event.description,
          }))} />
        </SectionCard>
      ) : null}

      {filter === "decisions" ? (
        <SectionCard title="Decisions" eyebrow="PM decision archive">
          <TimelineRows rows={decisionLogs.map((log) => ({
            id: log.id,
            time: log.created_at,
            type: log.log_type,
            status: "success",
            target: log.task?.title || "decision",
            summary: log.content,
          }))} />
        </SectionCard>
      ) : null}

      {filter === "errors" ? (
        <SectionCard title="Errors" eyebrow="Warnings and failures">
          <TimelineRows rows={errorEvents.map((event) => ({
            id: event.id,
            time: event.created_at,
            type: event.type,
            status: event.status,
            target: event.title,
            summary: event.description,
          }))} />
        </SectionCard>
      ) : null}

      {filter === "kpi" ? (
        <SectionCard title="KPI History" eyebrow="7-day operations metrics">
          <div className="kpi-history-grid">
            {Object.entries(data.kpi?.productivity || {}).map(([key, value]) => (
              <div className="kpi-row" key={key}>
                <span>{key}</span>
                <strong>{value ?? "insufficient data"}</strong>
              </div>
            ))}
            {Object.entries(data.kpi?.quality || {}).map(([key, value]) => (
              <div className="kpi-row" key={key}>
                <span>{key}</span>
                <strong>{value ?? "insufficient data"}</strong>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

function TimelineRows({
  rows,
}: {
  rows: Array<{ id: string; time: string; type: string; status: string; target: string; summary: string }>;
}) {
  if (rows.length === 0) return <div className="empty-state">No records available for this filter.</div>;
  return (
    <div className="history-table">
      {rows.map((row) => (
        <details className="history-row" key={row.id}>
          <summary>
            <span>{formatTimeAgo(row.time)}</span>
            <StatusBadge status={row.status}>{row.type}</StatusBadge>
            <strong>{row.target}</strong>
            <p>{row.summary}</p>
          </summary>
          <pre>{row.summary}</pre>
        </details>
      ))}
    </div>
  );
}
