import { useMemo, useState } from "react";
import type { AppData } from "../app/AppShell";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { formatTimeAgo } from "./pageUtils";

type HistoryFilter = "runtime timeline" | "events" | "commands" | "agent runs" | "decisions" | "errors" | "kpi";

const filters: HistoryFilter[] = ["runtime timeline", "events", "commands", "agent runs", "decisions", "errors", "kpi"];
const filterLabels: Record<HistoryFilter, string> = { "runtime timeline": "전체 기록", events: "운영 이벤트", commands: "명령 기록", "agent runs": "에이전트 실행", decisions: "PM 결정", errors: "오류", kpi: "KPI" };

export function HistoryPage({ data }: { data: AppData }) {
  const [filter, setFilter] = useState<HistoryFilter>("runtime timeline");
  const decisionLogs = data.dashboard?.decisions || [];
  const errorEvents = useMemo(() => data.events.filter((event) => event.status === "error" || event.type === "warning"), [data.events]);

  return (
    <div className="page-stack">
      <div className="subnav">
        {filters.map((item) => (
          <button className={filter === item ? "active" : ""} type="button" key={item} onClick={() => setFilter(item)}>
            {filterLabels[item]}
          </button>
        ))}
      </div>

      {filter === "runtime timeline" ? (
        <SectionCard title="감사·Runtime 타임라인" eyebrow="작업 · 흐름 · 승인 · RAG · 지식 · 에이전트 · 배치">
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
        <SectionCard title="운영 이벤트" eyebrow="실제 Runtime 이력">
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
        <SectionCard title="명령 기록" eyebrow="기록된 명령 제안과 결과">
          <TimelineRows rows={data.commands.map((command) => ({
            id: command.id,
            time: command.created_at,
            type: command.command_type || "command",
            status: command.status,
            target: command.command,
            summary: command.result || "기록된 결과 없음",
          }))} />
        </SectionCard>
      ) : null}

      {filter === "agent runs" ? (
        <SectionCard title="에이전트 실행" eyebrow="Runtime 근거">
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
        <SectionCard title="PM 결정" eyebrow="의사결정 기록">
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
        <SectionCard title="오류" eyebrow="주의와 실패 기록">
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
        <SectionCard title="KPI 이력" eyebrow="최근 7일 운영 지표">
          <div className="kpi-history-grid">
            {Object.entries(data.kpi?.productivity || {}).map(([key, value]) => (
              <div className="kpi-row" key={key}>
                <span>{key}</span>
                <strong>{value == null ? "KPI 이력 데이터 없음" : value}</strong>
              </div>
            ))}
            {Object.entries(data.kpi?.quality || {}).map(([key, value]) => (
              <div className="kpi-row" key={key}>
                <span>{key}</span>
                <strong>{value == null ? "KPI 이력 데이터 없음" : value}</strong>
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
  if (rows.length === 0) return <div className="empty-state">해당 필터의 기록이 없습니다.</div>;
  return (
    <div className="history-table">
      {rows.map((row) => (
        <details className="history-row" key={row.id}>
          <summary>
            <span>{formatTimeAgo(row.time)}</span>
            <StatusBadge status={row.status}>{historyTypeLabel(row.type)}</StatusBadge>
            <strong>{row.target}</strong>
            <p>{row.summary}</p>
          </summary>
          <pre>{row.summary}</pre>
        </details>
      ))}
    </div>
  );
}

function historyTypeLabel(value: string) {
  return ({ knowledge: "지식", task: "작업", approval: "승인", agent: "에이전트", batch: "배치", command: "명령", event: "이벤트", warning: "주의", error: "오류", slack_notification: "Slack 알림" } as Record<string, string>)[String(value || "").toLowerCase()] || value.replace(/_/g, " ");
}
