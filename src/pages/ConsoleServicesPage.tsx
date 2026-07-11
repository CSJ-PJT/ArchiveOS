import { useState } from "react";
import type { AppData } from "../app/AppShell";
import type { EcosystemServiceView } from "../lib/backendApi";
import { StatusBadge, normalizeStatus } from "../components/shared/StatusBadge";
import { DataState } from "../components/shared/DataState";
import { useI18n } from "../i18n/I18nProvider";
import { consoleText } from "../i18n/console";

const serviceRoles: Record<string, string> = { market: "수요·주문·매출", nexus: "제조·출하", logitics: "물류·운송비", logistics: "물류·운송비", ledger: "거래·원장·정산" };

export function ConsoleServicesPage({ data }: { data: AppData }) {
  const { locale } = useI18n();
  const [tab, setTab] = useState<"core" | "external">("core");
  const services = Object.entries(data.ecosystem?.services ?? {});
  const healthyCount = services.filter(([, service]) => service.status === "HEALTHY").length;
  return <div className="console-page services-v4">
    <PageHeader title={consoleText(locale, "page.services.title")} description={consoleText(locale, "page.services.description")} />
    <ConsoleTabs value={tab} onChange={setTab} items={[["core", "핵심 서비스"], ["external", "외부 연동"]]} />
    {tab === "core" ? <>
      <div className="service-summary-bar"><span>외부 수집 대상 {services.length} · 정상 수집 {healthyCount}/{services.length}</span><small>ArchiveOS Control Tower는 별도로 정상 동작하며, 외부 장애는 상태로 분리합니다.</small></div>
      {data.loading ? <DataState kind="loading" title="서비스 상태를 수집하는 중입니다." description="각 Archive 서비스의 읽기 전용 요약을 불러오고 있습니다." /> : null}
      {!data.loading && !services.length ? <DataState kind={Object.keys(data.errors).length ? "error" : "empty"} title={Object.keys(data.errors).length ? "서비스 상태를 수집하지 못했습니다." : "등록된 외부 서비스가 없습니다."} description={Object.keys(data.errors).length ? "연결 주소와 외부 서비스 상태를 확인한 뒤 다시 시도하세요." : "Service Registry 설정이 반영되면 서비스 카드가 표시됩니다."} /> : null}
      {services.length ? <div className="service-grid">{services.map(([key, service]) => <ServiceCard key={key} keyName={key} service={service} />)}<ArchiveOsCard /></div> : null}
    </> : <ExternalSystems data={data} />}
  </div>;
}

function ServiceCard({ keyName, service }: { keyName: string; service: EcosystemServiceView }) {
  const summary = service.summary ?? {};
  const state = service.status;
  const error = service.errorMessage;
  const stats: Array<[string, unknown]> = [
    ["응답 지연", readValue(summary, ["latencyMs", "latency", "responseTimeMs", "health.latencyMs"])],
    ["최근 처리량", readValue(summary, ["recentEvents", "operations.processed", "runtime.eventsProducedLastTick", "outbox.published"])],
    ["오류율", readValue(summary, ["errorRate", "operations.errorRate", "outbox.failureRate"])],
    ["처리 적체", readValue(summary, ["backlog", "backlogCount", "outbox.pending", "operations.backlog"])],
    ["역량 사용률", readValue(summary, ["capacityUtilization", "capacity.utilization", "workforce.capacityUtilization"])],
    ["재무 데이터", hasFinanceData(summary) ? "수집됨" : "데이터 없음"],
  ];
  return <article className={`service-card service-${state.toLowerCase()}`}>
    <div className="service-card-title"><div><span className="eyebrow">{keyName === "logitics" ? "LOGISTICS" : keyName.toUpperCase()}</span><h2>{service.name}</h2><p className="service-role">{serviceRoles[keyName] ?? "운영 서비스"}</p></div><StatusBadge status={normalizeStatus(state)}>{statusText(state)}</StatusBadge></div>
    <dl className="service-connection-list"><dt>연결 주소</dt><dd className="service-url" title={service.baseUrl || ""}><code>{service.baseUrl || "설정 안 됨"}</code>{service.baseUrl ? <CopyButton value={service.baseUrl} label="주소 복사" /> : null}</dd><dt>마지막 성공</dt><dd>{service.lastCheckedAt ? new Date(service.lastCheckedAt).toLocaleString() : "수집 없음"}</dd><dt>수집 상태</dt><dd>{error ? "오류 감지" : Object.keys(summary).length ? "요약 수집됨" : "요약 없음"}</dd></dl>
    <div className="service-metric-grid">{stats.map(([label, value]) => <span key={label}><small>{label}</small><strong>{formatMetric(value)}</strong></span>)}</div>
    {error ? <p className="service-error">{error}</p> : <p className="service-state-note">{stateNote(state, service.lastCheckedAt)}</p>}
  </article>;
}

function ArchiveOsCard() { return <article className="service-card archiveos-card"><div className="service-card-title"><div><span className="eyebrow">CONTROL TOWER</span><h2>ArchiveOS</h2><p className="service-role">관제·승인·정책 근거</p></div><StatusBadge status="healthy">정상</StatusBadge></div><dl className="service-connection-list"><dt>역할</dt><dd>상태 수집, 승인 게이트웨이, 감사 기록</dd><dt>쓰기 정책</dt><dd>Safe-mode 기본 차단</dd><dt>부분 장애</dt><dd>DEGRADED / UNAVAILABLE 분리</dd></dl><p className="service-state-note">외부 서비스 오류가 발생해도 ArchiveOS 조회 화면과 runtime은 유지됩니다.</p></article>; }

function ExternalSystems({ data }: { data: AppData }) { return <div className="external-list external-systems"><article><span className="eyebrow">EXTERNAL / NON-CORE</span><h2>Atlas</h2><p>Archive 핵심 서비스와 분리된 외부 플랫폼 연동입니다. Atlas 상태는 핵심 생태계 상태를 바꾸지 않습니다.</p><dl className="external-definition"><dt>상태</dt><dd><StatusBadge status={data.atlas?.system?.current_status ?? "empty"}>{data.atlas?.system?.current_status ?? "연동 안 됨"}</StatusBadge></dd><dt>마지막 확인</dt><dd>{data.atlas?.system?.updated_at ? new Date(data.atlas.system.updated_at).toLocaleString() : "수집 없음"}</dd><dt>영향 범위</dt><dd>핵심 서비스 상태에 미포함</dd></dl></article><article><span className="eyebrow">LABS / OPTIONAL</span><h2>실험 연동</h2><p>기본값에서는 표시하거나 polling하지 않습니다. 설정에서 명시적으로 활성화한 경우에만 별도 Labs 영역으로 관리합니다.</p><StatusBadge status="empty">기본 비활성</StatusBadge></article></div>; }

export function PageHeader({ title, description }: { title: string; description: string }) { return <section className="console-page-header"><span className="eyebrow">ARCHIVEOS</span><h2>{title}</h2><p>{description}</p></section>; }
export function ConsoleTabs<T extends string>({ value, onChange, items }: { value: T; onChange: (value: T) => void; items: Array<[T, string]> }) { return <div className="console-tabs" role="tablist">{items.map(([id, label]) => <button key={id} id={`${id}-tab`} className={value === id ? "active" : ""} type="button" onClick={() => onChange(id)} role="tab" aria-selected={value === id} aria-controls={`${id}-panel`}>{label}</button>)}</div>; }
function CopyButton({ value, label }: { value: string; label: string }) { return <button type="button" className="copy-button" aria-label={label} title={label} onClick={() => navigator.clipboard?.writeText(value).catch(() => undefined)}>복사</button>; }
function readValue(source: Record<string, unknown>, paths: string[]) { for (const path of paths) { let value: unknown = source; for (const key of path.split(".")) value = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined; if (value !== undefined && value !== null) return value; } return null; }
function hasFinanceData(summary: Record<string, unknown>) { return ["recognizedRevenue", "totalRevenue", "operatingProfit", "profit", "cashBalance"].some((key) => readValue(summary, [key, `economy.${key}`, `marketEconomy.${key}`]) != null); }
function formatMetric(value: unknown) { if (value == null || value === "") return "데이터 없음"; if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : "데이터 없음"; return typeof value === "boolean" ? (value ? "활성" : "비활성") : String(value); }
function statusText(status: string) { return status === "HEALTHY" ? "정상" : status === "UNAVAILABLE" ? "연결 안 됨" : status === "DISABLED" ? "비활성" : status === "STALE" ? "오래된 수집" : status === "UNKNOWN" ? "수집 대기" : "주의"; }
function stateNote(status: string, lastCheckedAt: string | null) { if (status === "UNAVAILABLE") return "연결할 수 없습니다. 주소·timeout·컨테이너 상태를 확인하세요."; if (status === "STALE") return `마지막 성공 데이터만 표시합니다${lastCheckedAt ? ` (${new Date(lastCheckedAt).toLocaleString()})` : ""}.`; if (status === "DEGRADED") return "일부 capability가 응답하지 않아 주의 상태입니다."; return "마지막 확인 기준으로 정상 응답했습니다."; }
