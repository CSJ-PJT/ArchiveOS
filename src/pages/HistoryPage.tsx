import { useMemo, useState } from "react";
import type { AppData } from "../app/AppShell";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { PaginatedItems } from "../components/shared/PaginatedItems";
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
            target: agentRunTitle(event.title),
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
          {data.kpi ? <div className="kpi-history-groups">
            <KpiGroup title="생산성" values={data.kpi.productivity} />
            <KpiGroup title="품질·검토" values={data.kpi.quality} />
            <KpiGroup title="Runtime" values={data.kpi.runtime} />
            <KpiGroup title="운영 지식" values={data.kpi.knowledge} />
            <p className="kpi-generated-at">집계 생성 {new Date(data.kpi.generatedAt).toLocaleString()}</p>
          </div> : <div className="empty-state">KPI 집계를 불러오는 중입니다.</div>}
        </SectionCard>
      ) : null}
    </div>
  );
}

function KpiGroup({ title, values }: { title: string; values: Record<string, string | number | null> }) {
  return <section className="kpi-history-group" aria-label={`${title} KPI`}>
    <h3>{title}</h3>
    <div className="kpi-history-grid">
      {Object.entries(values).map(([key, value]) => <div className="kpi-row" key={key}>
        <span>{kpiLabel(key)}</span>
        <strong>{formatKpiValue(key, value)}</strong>
      </div>)}
    </div>
  </section>;
}

function kpiLabel(key: string) {
  return ({ tasksCompleted: "완료 작업", reviewsCompleted: "완료 검토", decisionsRecorded: "기록된 결정", commandsRecorded: "기록된 명령", dailyReportsSent: "일일 보고", nightlyReviewsCompleted: "야간 검토", reviewApproveCount: "승인 판정", reviewRejectCount: "반려 판정", reviewStopCount: "중지 판정", approvalRate: "승인율", architectReviewCount: "설계 검토", architectWarningCount: "설계 주의", architectBlockedCount: "설계 차단", latestInbox: "최근 Inbox", latestProcessing: "현재 처리", latestOutbox: "최근 Outbox", latestReviews: "최근 리뷰", latestStatus: "Runtime 상태", warningCount: "주의 기록", loopDetectedRate: "루프 감지율", totalNodes: "지식 노드", totalEdges: "지식 관계", nodesCreatedInRange: "기간 내 생성 노드", edgesCreatedInRange: "기간 내 생성 관계", obsidianExports: "Obsidian 내보내기", graphDensity: "그래프 밀도" } as Record<string, string>)[key] || key;
}

function formatKpiValue(key: string, value: string | number | null) {
  if (value == null) return "집계 대기";
  if (["approvalRate", "loopDetectedRate"].includes(key) && typeof value === "number") return `${value.toLocaleString()}%`;
  if (key === "graphDensity" && typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return typeof value === "number" ? value.toLocaleString() : value;
}

function TimelineRows({
  rows,
}: {
  rows: Array<{ id: string; time: string; type: string; status: string; target: string; summary: string }>;
}) {
  return <PaginatedItems
    items={rows}
    pageSize={10}
    label="감사 기록 페이지"
    className="history-table"
    empty={<div className="empty-state">해당 필터의 기록이 없습니다.</div>}
    renderItem={(row) => (
        <details className="history-row" key={row.id}>
          <summary>
            <span>{formatTimeAgo(row.time)}</span>
            <StatusBadge status={row.status}>{historyTypeLabel(row.type)}</StatusBadge>
            <strong>{row.target}</strong>
            <p>{row.summary}</p>
          </summary>
          <pre>{row.summary}</pre>
        </details>
      )}
  />;
}

function historyTypeLabel(value: string) {
  return ({ knowledge: "지식", task: "작업", approval: "승인", agent: "에이전트", batch: "배치", command: "명령", event: "이벤트", warning: "주의", error: "오류", slack_notification: "Slack 알림" } as Record<string, string>)[String(value || "").toLowerCase()] || value.replace(/_/g, " ");
}

function agentRunTitle(value: string) {
  return ({
    task_created: "에이전트 작업 생성",
    nexus_action_callback: "에이전트 작업 완료",
    pm_decision_approve: "PM 승인 완료",
    pm_decision_reject: "PM 반려 완료",
    pm_decision_hold: "PM 보류",
    pm_decision_retry: "에이전트 재시도 요청",
  } as Record<string, string>)[String(value || "").toLowerCase()] || value.replace(/_/g, " ");
}
