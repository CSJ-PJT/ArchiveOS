import { useState } from "react";
import type { AppData } from "../app/AppShell";
import { StatusBadge, normalizeStatus } from "../components/shared/StatusBadge";
import { useI18n } from "../i18n/I18nProvider";
import { consoleText } from "../i18n/console";

export function ConsoleServicesPage({ data }: { data: AppData }) {
  const { locale } = useI18n();
  const [tab, setTab] = useState<"core" | "external">("core");
  const services = Object.entries(data.ecosystem?.services ?? {});
  return <div className="console-page"><PageHeader title={consoleText(locale, "page.services.title")} description={consoleText(locale, "page.services.description")} /><ConsoleTabs value={tab} onChange={setTab} items={[ ["core", "핵심 서비스"], ["external", "외부 연동"] ]} />
    {tab === "core" ? <div className="service-grid">{services.map(([key, service]) => <article className="service-card" key={key}><div><span className="eyebrow">{key === "logitics" ? "LOGISTICS" : key.toUpperCase()}</span><h2>{service.name}</h2></div><StatusBadge status={normalizeStatus(service.status)}>{statusText(service.status)}</StatusBadge><dl><dt>연결 주소</dt><dd>{service.baseUrl || "연동 안 됨"}</dd><dt>최근 확인</dt><dd>{service.lastCheckedAt ? new Date(service.lastCheckedAt).toLocaleString() : "데이터 없음"}</dd><dt>오류</dt><dd>{service.errorMessage || "없음"}</dd></dl><div className="service-compact-summary">{compactSummary(service.summary)}</div></article>)}<article className="service-card archiveos-card"><div><span className="eyebrow">CONTROL</span><h2>ArchiveOS</h2></div><StatusBadge status="healthy">정상</StatusBadge><p>상태 수집, 승인, 정책 근거, 감사 기록을 제공하는 Control Tower입니다.</p></article></div> : <div className="external-list"><article><h2>Atlas</h2><p>Archive 핵심 상태와 분리된 외부 연동입니다. Atlas 장애는 핵심 생태계 상태를 변경하지 않습니다.</p><StatusBadge status={data.atlas?.system?.current_status ?? "empty"}>{data.atlas?.system?.current_status ?? "연동 안 됨"}</StatusBadge></article><article><h2>외부 실험 시스템</h2><p>기본값에서는 표시하거나 폴링하지 않습니다. 설정에서 명시적으로 활성화한 경우에만 별도 Labs 영역으로 관리합니다.</p><StatusBadge status="empty">비활성</StatusBadge></article></div>}</div>;
}
export function PageHeader({ title, description }: { title: string; description: string }) { return <section className="console-page-header"><span className="eyebrow">ARCHIVEOS</span><h2>{title}</h2><p>{description}</p></section>; }
export function ConsoleTabs<T extends string>({ value, onChange, items }: { value: T; onChange: (value: T) => void; items: Array<[T, string]> }) { return <div className="console-tabs" role="tablist">{items.map(([id, label]) => <button key={id} className={value === id ? "active" : ""} type="button" onClick={() => onChange(id)} role="tab">{label}</button>)}</div>; }
function statusText(status: string) { return status === "HEALTHY" ? "정상" : status === "UNAVAILABLE" ? "연결 안 됨" : status === "DISABLED" ? "비활성" : "주의"; }
function compactSummary(value: Record<string, unknown>) { const entries = Object.entries(value).filter(([key]) => !["health", "operations", "marketEconomy", "capabilities"].includes(key)).slice(0, 4); return entries.length ? entries.map(([key, item]) => <span key={key}>{key}: {typeof item === "object" ? "수집됨" : String(item)}</span>) : <span>수집된 운영 요약이 없습니다.</span>; }
