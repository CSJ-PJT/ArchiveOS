import { useState } from "react";
import type { AppData } from "../app/AppShell";
import { SettingsPage } from "./SettingsPage";
import { McpRegistryPage } from "./McpRegistryPage";
import { ConsoleTabs, PageHeader } from "./ConsoleServicesPage";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { useI18n } from "../i18n/I18nProvider";
import { consoleText } from "../i18n/console";

export function ConsoleSettingsPage({ data, onRefresh, backendOrigin }: { data: AppData; onRefresh: () => void; backendOrigin: string }) {
  const [tab, setTab] = useState<"general" | "connections" | "permissions" | "labs" | "advanced">("general");
  const { locale } = useI18n();
  return <div className="console-page settings-v4"><PageHeader title={consoleText(locale, "page.settings.title")} description={consoleText(locale, "page.settings.description")} /><ConsoleTabs value={tab} onChange={setTab} items={[["general", "일반"], ["connections", "연결"], ["permissions", "권한"], ["labs", "Labs"], ["advanced", "고급 도구"]]} />
    {tab === "general" ? <SettingsPage data={data} onRefresh={onRefresh} backendOrigin={backendOrigin} /> : null}
    {tab === "connections" ? <ConnectionSettings data={data} backendOrigin={backendOrigin} /> : null}
    {tab === "permissions" ? <PermissionSettings data={data} /> : null}
    {tab === "labs" ? <LabsSettings /> : null}
    {tab === "advanced" ? <McpRegistryPage data={data} /> : null}
  </div>;
}

function ConnectionSettings({ data, backendOrigin }: { data: AppData; backendOrigin: string }) { return <SectionCard title="연결 상태" eyebrow="READ ONLY"><dl className="settings-dl"><dt>ArchiveOS API</dt><dd><code>{backendOrigin}</code></dd><dt>수집 오류</dt><dd>{Object.keys(data.errors).length ? `${Object.keys(data.errors).length}건` : "없음"}</dd><dt>안전 모드</dt><dd>활성</dd><dt>외부 쓰기</dt><dd>기본 차단</dd></dl><p className="small-note">연결 오류는 각 서비스 카드에서 별도로 표시하며, ArchiveOS의 읽기 전용 관제는 유지합니다.</p></SectionCard>; }
function PermissionSettings({ data }: { data: AppData }) { return <SectionCard title="권한" eyebrow="SESSION"><dl className="settings-dl"><dt>현재 역할</dt><dd><StatusBadge status={data.auth.role === "ADMIN" ? "healthy" : "waiting"}>{data.auth.role}</StatusBadge></dd><dt>승인 결정</dt><dd>{["PM", "ADMIN"].includes(data.auth.role) ? "가능" : "조회 전용"}</dd><dt>수동 갱신</dt><dd>{data.auth.role === "ADMIN" ? "가능" : "조회 전용"}</dd><dt>외부 쓰기</dt><dd>safe-mode와 별도 승인 필요</dd></dl></SectionCard>; }
function LabsSettings() { return <SectionCard title="Labs" eyebrow="OPTIONAL / NON-CORE"><p className="body-copy">실험 연동은 핵심 운영 상태와 분리됩니다. 기본값에서는 비활성이며, 활성화하지 않은 연동은 핵심 KPI와 상태 판정에 포함하지 않습니다.</p><StatusBadge status="empty">기본 비활성</StatusBadge></SectionCard>; }
