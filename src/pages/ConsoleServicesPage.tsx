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
      <div className="service-summary-bar"><span>핵심 수집 대상 {services.length} · 정상 수집 {healthyCount}/{services.length}</span><small>ArchiveOS Control Tower는 별도로 정상 동작하며, 외부 장애는 상태로 분리합니다.</small></div>
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
    ["누적 처리 이벤트", throughput(summary)],
    ["실패 건수", readValue(summary, ["failedEvents", "failed", "outbox.failed", "operations.outbox.failed", "operations.failedEvents"])],
    ["처리 적체", readValue(summary, ["backlog", "backlogCount", "runtime.backlogCount", "operations.runtime.backlogCount", "balance.backlogCount", "outbox.pending", "operations.backlog"])],
    ["역량 사용률", capacityUtilization(summary, keyName)],
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

function ExternalSystems({ data }: { data: AppData }) {
  const systems = data.managedSystems?.systems ?? [];
  const connectors = integrationConnectors(data);
  return <div className="page-stack external-integration-view">
    <div className="service-summary-bar"><span>등록 시스템 {systems.length} · 연동 경로 {connectors.length}</span><small>비밀값은 표시하지 않으며 실제 읽기 계약과 최근 상태만 보여줍니다.</small></div>
    <section className="external-list external-systems">
      <article><span className="eyebrow">EXTERNAL / NON-CORE</span><h2>Atlas</h2><p>Archive 핵심 서비스와 분리된 외부 플랫폼 연동입니다. Atlas 상태는 핵심 생태계 상태를 바꾸지 않습니다.</p><dl className="external-definition"><dt>상태</dt><dd><StatusBadge status={data.atlas?.system?.current_status ?? "empty"}>{displayStatus(data.atlas?.system?.current_status)}</StatusBadge></dd><dt>마지막 확인</dt><dd>{data.atlas?.system?.updated_at ? new Date(data.atlas.system.updated_at).toLocaleString() : "수집 없음"}</dd><dt>영향 범위</dt><dd>핵심 서비스 상태에 미포함</dd></dl></article>
      {systems.filter((system) => system.systemId !== "archiveos").map((system) => <article key={system.systemId}><span className="eyebrow">REGISTERED SYSTEM</span><h2>{system.name}</h2><p>{registeredSystemRole(system.systemId, system.role || system.statusReason)}</p><dl className="external-definition"><dt>상태</dt><dd><StatusBadge status={system.status}>{displayStatus(system.status)}</StatusBadge></dd><dt>환경</dt><dd>{environmentLabel(system.provider)} · {environmentLabel(system.environment)}</dd><dt>대기 승인</dt><dd>{system.pendingApprovalCount.toLocaleString()}건</dd><dt>저장소</dt><dd>{system.repository || "등록 정보 없음"}</dd></dl></article>)}
    </section>
    <section className="integration-contract-grid" aria-label="서비스 연동 경로">{connectors.map((connector) => <article key={connector.id}><div><span className="eyebrow">SERVICE CONTRACT</span><h3>{connector.label}</h3></div><StatusBadge status={connector.enabled ? "healthy" : "waiting"}>{connector.enabled ? "연동됨" : "쓰기 차단"}</StatusBadge><p>{connector.detail}</p></article>)}</section>
  </div>;
}

export function PageHeader({ title, description }: { title: string; description: string }) { return <section className="console-page-header"><span className="eyebrow">ARCHIVEOS</span><h2>{title}</h2><p>{description}</p></section>; }
export function ConsoleTabs<T extends string>({ value, onChange, items }: { value: T; onChange: (value: T) => void; items: Array<[T, string]> }) { return <div className="console-tabs" role="tablist">{items.map(([id, label]) => <button key={id} id={`${id}-tab`} className={value === id ? "active" : ""} type="button" onClick={() => onChange(id)} role="tab" aria-selected={value === id} aria-controls={`${id}-panel`}>{label}</button>)}</div>; }
function CopyButton({ value, label }: { value: string; label: string }) { return <button type="button" className="copy-button" aria-label={label} title={label} onClick={() => navigator.clipboard?.writeText(value).catch(() => undefined)}>복사</button>; }
function readValue(source: Record<string, unknown>, paths: string[]) { for (const path of paths) { let value: unknown = source; for (const key of path.split(".")) value = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined; if (value !== undefined && value !== null) return value; } return null; }
function throughput(summary: Record<string, unknown>) { return readValue(summary, ["outbox.total", "operations.outbox.total", "processedEvents", "transactionsProcessed", "operations.transactionsProcessed", "outbox.published", "operations.outbox.published", "orders.total"]); }
function capacityUtilization(summary: Record<string, unknown>, service: string) {
  const direct = readValue(summary, ["capacityUtilization", "capacity.utilization", "workforce.capacityUtilization", "operations.workforce.capacityUtilization", "balance.capacityUtilization"]);
  const used = Number(readValue(summary, ["operations.runtimeWorkforce.usedCapacity", "runtimeWorkforce.usedCapacity", "operations.workforce.usedCapacity", "workforce.usedCapacity"]));
  const effective = Number(readValue(summary, ["operations.runtimeWorkforce.effectiveCapacity", "runtimeWorkforce.effectiveCapacity", "operations.workforce.effectiveCapacity", "workforce.effectiveCapacity"]));
  let value = Number(direct);
  if ((!Number.isFinite(value) || value === 0) && Number.isFinite(used) && Number.isFinite(effective) && effective > 0) value = used / effective;
  if (Number.isFinite(value) && value > 0) return `${(value <= 1 ? value * 100 : value).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  const runtimeActive = readValue(summary, ["runtime.runtimeActive", "operations.runtime.runtimeActive"]);
  if (service === "nexus" && runtimeActive === false) return "시뮬레이터 정지";
  return effective === 0 ? "기준 역량 없음" : "0%";
}
function integrationConnectors(data: AppData) {
  const services = data.ecosystem?.services;
  const market = (readValue(services?.market?.summary ?? {}, ["operations.integration", "integration"]) ?? {}) as Record<string, unknown>;
  const nexus = (readValue(services?.nexus?.summary ?? {}, ["outbox.integrations", "operations.outbox.integrations"]) ?? {}) as Record<string, unknown>;
  const logistics = (readValue(services?.logitics?.summary ?? {}, ["ledger"]) ?? {}) as Record<string, unknown>;
  const values: Array<{ id: string; label: string; enabled: boolean; detail: string }> = [];
  for (const [target, status] of Object.entries(market)) values.push({ id: `market-${target}`, label: `Market → ${displayTarget(target)}`, enabled: !/blocked|disabled/i.test(String(status)), detail: `Market 운영 이벤트 계약 · ${contractStatusLabel(status)}` });
  for (const [target, raw] of Object.entries(nexus)) { const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}; values.push({ id: `nexus-${target}`, label: `Nexus → ${displayTarget(target)}`, enabled: item.enabled === true || /enabled|healthy/i.test(String(item.status ?? raw)), detail: `Nexus Outbox 라우팅 · ${contractStatusLabel(item.status ?? raw)}` }); }
  if (Object.keys(logistics).length) values.push({ id: "logistics-ledger", label: "Logistics → Ledger", enabled: logistics.enabled === true || /enabled|healthy/i.test(String(logistics.status)), detail: `물류비 확정 계약 · ${contractStatusLabel(logistics.status)}` });
  const ledgerSystem = data.managedSystems?.systems.find((system) => system.systemId === "archive-ledger");
  if (ledgerSystem) values.push({ id: "ledger-archiveos", label: "Ledger → ArchiveOS", enabled: ledgerSystem.approvalCallbackConfigured === true, detail: ledgerSystem.approvalCallbackConfigured ? "승인 콜백 계약 구성됨" : "승인 콜백 구성 필요" });
  return values;
}
function displayTarget(value: string) { if (/externalWrite/i.test(value)) return "외부 쓰기"; if (/logit/i.test(value)) return "Logistics"; if (/ledger/i.test(value)) return "Ledger"; if (/nexus/i.test(value)) return "Nexus"; if (/archive/i.test(value)) return "ArchiveOS"; return value; }
function displayStatus(value: string | null | undefined) { const normalized = String(value || "").toLowerCase(); if (["normal", "healthy", "up"].includes(normalized)) return "정상"; if (["degraded", "partial_data", "warning"].includes(normalized)) return "부분 수집"; if (["unavailable", "down", "error"].includes(normalized)) return "연결 안 됨"; return value || "연동 안 됨"; }
function registeredSystemRole(systemId: string, fallback?: string | null) { return ({ "archive-market": "수요·주문·매출 원천", "archive-nexus": "제조·생산·출하 운영", "archive-logistics": "합성 물류·운송 운영", "archive-ledger": "합성 거래·원장·정산 운영" } as Record<string, string>)[systemId] || fallback || "ArchiveOS 관리 시스템"; }
function environmentLabel(value: string) { return ({ local: "로컬", development: "개발", production: "운영", staging: "검증" } as Record<string, string>)[String(value).toLowerCase()] || value; }
function contractStatusLabel(value: unknown) { const normalized = String(value ?? "").toUpperCase(); if (normalized === "INTERNAL_SYNTHETIC_PUBLISH_ENABLED") return "내부 합성 이벤트 발행 활성"; if (normalized === "EXTERNAL_WRITE_BLOCKED") return "외부 쓰기 차단"; if (normalized === "ENABLED" || normalized === "HEALTHY") return "활성"; if (normalized === "DISABLED" || normalized === "BLOCKED") return "비활성"; return value == null ? "상태 미수집" : String(value).replace(/_/g, " "); }
function hasFinanceData(summary: Record<string, unknown>) { return ["recognizedRevenue", "totalRevenue", "operatingProfit", "profit", "cashBalance"].some((key) => readValue(summary, [key, `economy.${key}`, `marketEconomy.${key}`]) != null); }
function formatMetric(value: unknown) { if (value == null || value === "") return "데이터 없음"; if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : "데이터 없음"; return typeof value === "boolean" ? (value ? "활성" : "비활성") : String(value); }
function statusText(status: string) { return status === "HEALTHY" ? "정상" : status === "UNAVAILABLE" ? "연결 안 됨" : status === "DISABLED" ? "비활성" : status === "STALE" ? "오래된 수집" : status === "UNKNOWN" ? "수집 대기" : "주의"; }
function stateNote(status: string, lastCheckedAt: string | null) { if (status === "UNAVAILABLE") return "연결할 수 없습니다. 주소·timeout·컨테이너 상태를 확인하세요."; if (status === "STALE") return `마지막 성공 데이터만 표시합니다${lastCheckedAt ? ` (${new Date(lastCheckedAt).toLocaleString()})` : ""}.`; if (status === "DEGRADED") return "일부 capability가 응답하지 않아 주의 상태입니다."; return "마지막 확인 기준으로 정상 응답했습니다."; }
