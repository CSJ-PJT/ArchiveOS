import { useState } from "react";
import type { AppData } from "../app/AppShell";
import { HistoryPage } from "./HistoryPage";
import { KnowledgePage } from "./KnowledgePage";
import { ConsoleTabs, PageHeader } from "./ConsoleServicesPage";
import { useI18n } from "../i18n/I18nProvider";
import { consoleText } from "../i18n/console";

export function ConsoleRecordsPage({ data }: { data: AppData }) { const [tab, setTab] = useState<"events" | "audit" | "knowledge">("events"); const { locale } = useI18n(); return <div className="console-page"><PageHeader title={consoleText(locale, "page.records.title")} description={consoleText(locale, "page.records.description")} /><ConsoleTabs value={tab} onChange={setTab} items={[["events", "실시간 이벤트"], ["audit", "이력"], ["knowledge", "운영 지식"]]} />{tab === "events" ? <EventList data={data} /> : null}{tab === "audit" ? <HistoryPage data={data} /> : null}{tab === "knowledge" ? <KnowledgePage data={data} /> : null}</div>; }
function EventList({ data }: { data: AppData }) { return <section className="record-event-card"><h2>최근 이벤트</h2>{data.liveFlowEvents.length ? <ol>{data.liveFlowEvents.slice(0, 30).map((event) => <li key={event.event_id}><time>{new Date(event.occurred_at).toLocaleTimeString()}</time><strong>{event.event_type}</strong><span>{event.from_node} → {event.to_node}</span><em>{event.display_label}</em></li>)}</ol> : <p className="empty-copy">최근 실행 이벤트가 없습니다. 수집기는 정상이며 새 기록을 기다리고 있습니다.</p>}</section>; }
