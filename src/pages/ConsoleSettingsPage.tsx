import { useState } from "react";
import type { AppData } from "../app/AppShell";
import { SettingsPage } from "./SettingsPage";
import { McpRegistryPage } from "./McpRegistryPage";
import { ConsoleTabs, PageHeader } from "./ConsoleServicesPage";
import { useI18n } from "../i18n/I18nProvider";
import { consoleText } from "../i18n/console";

export function ConsoleSettingsPage({ data, onRefresh, backendOrigin }: { data: AppData; onRefresh: () => void; backendOrigin: string }) { const [tab, setTab] = useState<"general" | "integrations" | "advanced">("general"); const { locale } = useI18n(); return <div className="console-page"><PageHeader title={consoleText(locale, "page.settings.title")} description={consoleText(locale, "page.settings.description")} /><ConsoleTabs value={tab} onChange={setTab} items={[["general", "일반"], ["integrations", "연동"], ["advanced", "고급 도구"]]} />{tab === "general" ? <SettingsPage data={data} onRefresh={onRefresh} backendOrigin={backendOrigin} /> : null}{tab === "integrations" ? <IntegrationSettings data={data} /> : null}{tab === "advanced" ? <McpRegistryPage data={data} /> : null}</div>; }
function IntegrationSettings({ data }: { data: AppData }) { return <section className="finance-table-card"><h2>연동 상태</h2><p>기본 안전 모드에서는 외부 쓰기를 실행하지 않습니다.</p><dl className="settings-dl"><dt>안전 모드</dt><dd>활성</dd><dt>외부 쓰기</dt><dd>기본 차단</dd><dt>실험 시스템</dt><dd>기본 비활성</dd><dt>연동 오류</dt><dd>{Object.keys(data.errors).length ? `${Object.keys(data.errors).length}건` : "없음"}</dd></dl></section>; }
