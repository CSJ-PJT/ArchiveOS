import { useState } from "react";
import type { AppData } from "../app/AppShell";
import { HistoryPage } from "./HistoryPage";
import { KnowledgePage } from "./KnowledgePage";
import { ConsoleTabs, PageHeader } from "./ConsoleServicesPage";
import { useI18n } from "../i18n/I18nProvider";
import { consoleText } from "../i18n/console";

export function ConsoleRecordsPage({ data }: { data: AppData }) { const [tab, setTab] = useState<"events" | "audit" | "knowledge">("events"); const { locale } = useI18n(); return <div className="console-page"><PageHeader title={consoleText(locale, "page.records.title")} description={consoleText(locale, "page.records.description")} /><ConsoleTabs value={tab} onChange={setTab} items={[["events", consoleText(locale, "records.events")], ["audit", consoleText(locale, "records.audit")], ["knowledge", consoleText(locale, "records.knowledge")]]} />{tab === "events" ? <EventList data={data} /> : null}{tab === "audit" ? <HistoryPage data={data} /> : null}{tab === "knowledge" ? <KnowledgePage data={data} /> : null}</div>; }
function EventList({ data }: { data: AppData }) { const { locale } = useI18n(); return <section className="record-event-card"><h2>{consoleText(locale, "records.recentEvents")}</h2>{data.liveFlowEvents.length ? <ol>{data.liveFlowEvents.slice(0, 30).map((event) => <li key={event.event_id}><time>{new Date(event.occurred_at).toLocaleTimeString()}</time><strong>{event.event_type}</strong><span>{event.from_node} → {event.to_node}</span><em>{event.display_label}</em></li>)}</ol> : <p className="empty-copy">{consoleText(locale, "records.emptyEvents")}</p>}</section>; }
