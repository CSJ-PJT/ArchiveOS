import { useMemo, useState } from "react";
import type { AppData } from "../app/AppShell";
import { HistoryPage } from "./HistoryPage";
import { KnowledgePage } from "./KnowledgePage";
import { ConsoleTabs, PageHeader } from "./ConsoleServicesPage";
import { useI18n } from "../i18n/I18nProvider";
import { consoleText } from "../i18n/console";

export function ConsoleRecordsPage({ data }: { data: AppData }) {
  const [tab, setTab] = useState<"events" | "audit" | "knowledge">("events");
  const [query, setQuery] = useState("");
  const { locale } = useI18n();
  return <div className="console-page records-v4"><PageHeader title={consoleText(locale, "page.records.title")} description={consoleText(locale, "page.records.description")} /><ConsoleTabs value={tab} onChange={setTab} items={[["events", "실시간 이벤트"], ["audit", "감사 기록"], ["knowledge", "운영 지식"]]} />
    <label className="record-search"><span>기록 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="eventId, correlationId, entityId, 서비스, eventType" /></label>
    {tab === "events" ? <EventList data={data} query={query} /> : null}{tab === "audit" ? <HistoryPage data={data} /> : null}{tab === "knowledge" ? <KnowledgePage data={data} /> : null}
  </div>;
}

function EventList({ data, query }: { data: AppData; query: string }) {
  const { locale } = useI18n();
  const events = useMemo(() => { const needle = query.trim().toLowerCase(); if (!needle) return data.liveFlowEvents.slice(0, 50); return data.liveFlowEvents.filter((event) => [event.event_id, event.correlation_id, event.entity_id, event.from_node, event.to_node, event.event_type, event.source_system_id].some((value) => String(value || "").toLowerCase().includes(needle))).slice(0, 50); }, [data.liveFlowEvents, query]);
  return <section className="record-event-card"><header className="record-event-header"><div><span className="eyebrow">RUNTIME EVENT</span><h2>{consoleText(locale, "records.recentEvents")}</h2></div><small>{events.length}건 표시</small></header>{events.length ? <ol>{events.map((event) => <li key={event.event_id}><time>{new Date(event.occurred_at).toLocaleTimeString()}</time><strong title={event.event_type}>{event.event_type}</strong><span>{event.from_node} → {event.to_node}</span><em title={event.correlation_id || undefined}>{event.correlation_id ? `${event.correlation_id.slice(0, 16)}…` : "연결 정보 없음"}</em><small>{event.status}</small></li>)}</ol> : <p className="empty-copy">{query ? "검색 조건에 맞는 기록이 없습니다." : consoleText(locale, "records.emptyEvents")}</p>}</section>;
}
