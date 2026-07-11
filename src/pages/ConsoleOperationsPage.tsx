import { useState } from "react";
import type { AppData } from "../app/AppShell";
import { AgentsPage } from "./AgentsPage";
import { WorkforcePage } from "./WorkforcePage";
import { WorkflowsPage } from "./WorkflowsPage";
import { BatchPage } from "./BatchPage";
import { RpaPage } from "./RpaPage";
import { ConsoleTabs, PageHeader } from "./ConsoleServicesPage";
import { useI18n } from "../i18n/I18nProvider";
import { consoleText } from "../i18n/console";

export function ConsoleOperationsPage({ data, onRefresh }: { data: AppData; onRefresh: () => Promise<void> }) {
  const { locale } = useI18n();
  const [tab, setTab] = useState<"agents" | "workforce" | "workflows" | "automation">("agents");
  return <div className="console-page operations-v4">
    <PageHeader title={consoleText(locale, "page.operations.title")} description={consoleText(locale, "page.operations.description")} />
    <div className="operations-mode-note"><strong>{data.auth.role === "ADMIN" ? "관리자 세션" : "조회 전용 세션"}</strong><span>{data.auth.role === "ADMIN" ? "제안 확인과 제한된 수동 갱신만 가능하며, 외부 쓰기는 safe-mode 정책을 따릅니다." : "운영 데이터와 에이전트 제안은 조회만 가능합니다."}</span></div>
    <ConsoleTabs value={tab} onChange={setTab} items={[["agents", "에이전트"], ["workforce", "작업 역량"], ["workflows", "작업 흐름"], ["automation", "자동화"]]} />
    {tab === "agents" ? <AgentsPage data={data} onRefresh={onRefresh} /> : null}
    {tab === "workforce" ? <WorkforcePage data={data} /> : null}
    {tab === "workflows" ? <WorkflowsPage data={data} onRefresh={onRefresh} /> : null}
    {tab === "automation" ? <div className="console-subgrid"><BatchPage role={data.auth.role} /><RpaPage role={data.auth.role} /></div> : null}
  </div>;
}
