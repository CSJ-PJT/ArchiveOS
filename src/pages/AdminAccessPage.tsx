import { useCallback, useEffect, useMemo, useState } from "react";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { getAccessLogs, getAccessSummary, type AccessLogEntry, type AccessLogSummary } from "../lib/accessApi";
import type { PlatformRole } from "../lib/backendApi";

const routeOptions = [
  ["all", "전체"],
  ["root", "루트"],
  ["dashboard", "대시보드"],
  ["services", "서비스"],
  ["operations", "운영"],
  ["finance", "재무"],
  ["records", "기록"],
  ["mail", "메일"],
  ["settings", "설정"],
] as const;

export function AdminAccessPage({ role }: { role: PlatformRole }) {
  const [logs, setLogs] = useState<AccessLogEntry[]>([]);
  const [summary, setSummary] = useState<AccessLogSummary | null>(null);
  const [route, setRoute] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (role !== "ADMIN") return;
    setLoading(true);
    setError("");
    try {
      const [nextLogs, nextSummary] = await Promise.all([getAccessLogs(200, route), getAccessSummary()]);
      setLogs(nextLogs);
      setSummary(nextSummary);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "접속 기록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [role, route]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return logs;
    return logs.filter((item) => [item.actor, item.role, item.client_ip, item.route, item.request_path]
      .some((field) => String(field ?? "").toLowerCase().includes(value)));
  }, [logs, query]);

  if (role !== "ADMIN") {
    return <SectionCard title="접속 기록" eyebrow="ADMIN ONLY"><p className="body-copy">접속자, IP, 경로, 시간 정보는 관리자 세션에서만 조회할 수 있습니다.</p><StatusBadge status="blocked">관리자 권한 필요</StatusBadge></SectionCard>;
  }

  return <div className="page-stack admin-access-monitor">
    <SectionCard title="접속 모니터" eyebrow="SECURITY / ACCESS" action={<button className="button" type="button" onClick={() => void load()} disabled={loading}>{loading ? "갱신 중" : "새로고침"}</button>}>
      <p className="body-copy">ArchiveOS 루트와 주요 화면에 누가 접속했는지, 어떤 IP에서 언제 접근했는지 확인합니다. 쿠키·토큰·요청 본문은 저장하지 않습니다.</p>
      {error ? <p className="small-note">{error}</p> : null}
    </SectionCard>

    <div className="overview-grid">
      <Metric label="최근 24시간" value={summary?.last_24_hours} suffix="회" />
      <Metric label="고유 IP" value={summary?.unique_ips_24h} suffix="개" />
      <Metric label="로그인 접속" value={summary?.authenticated_24h} suffix="회" />
      <Metric label="익명 접속" value={summary?.anonymous_24h} suffix="회" />
      <Metric label="전체 기록" value={summary?.total} suffix="회" />
    </div>

    <SectionCard title="최근 활성 접속자" eyebrow="LAST 15 MINUTES">
      {summary?.activeVisitors?.length ? <div className="history-table">{summary.activeVisitors.map((item) => <div className="history-row" key={`${item.client_ip}-${item.actor}-${item.role}`}><div className="detail-grid"><div><span>접속자</span><strong>{actorLabel(item.actor, item.role)}</strong></div><div><span>IP</span><strong>{item.client_ip}</strong></div><div><span>최근 접속</span><strong>{formatTime(item.last_seen)}</strong></div><div><span>15분 내 접근</span><strong>{Number(item.visits).toLocaleString()}회</strong></div></div></div>)}</div> : <p className="empty-state">최근 15분 내 기록된 접속이 없습니다.</p>}
    </SectionCard>

    <SectionCard title="화면별 접속" eyebrow="LAST 24 HOURS">
      {summary?.byRoute?.length ? <div className="overview-grid">{summary.byRoute.map((item) => <article className="metric-card" key={item.route}><span>{routeLabel(item.route)}</span><strong>{Number(item.count).toLocaleString()}회</strong><small>{item.last_seen ? `최근 ${formatTime(item.last_seen)}` : "접속 없음"}</small></article>)}</div> : <p className="empty-state">최근 24시간 접속 데이터가 없습니다.</p>}
    </SectionCard>

    <SectionCard title="접속 이력" eyebrow={`30일 보존 · 최근 ${filtered.length.toLocaleString()}건`}>
      <div className="filter-row">
        <label>대상 화면 <select value={route} onChange={(event) => setRoute(event.target.value)}>{routeOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>검색 <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="접속자 또는 IP" /></label>
      </div>
      {filtered.length ? <div className="history-table">{filtered.map((item) => <details className="history-row" key={item.id}><summary><span>{formatTime(item.occurred_at)}</span><strong>{actorLabel(item.actor, item.role)}</strong><code>{item.client_ip}</code><span>{routeLabel(item.route)}</span></summary><div className="detail-grid"><div><span>요청 경로</span><strong>{item.request_path}</strong></div><div><span>역할</span><strong>{roleLabel(item.role)}</strong></div><div><span>User-Agent</span><strong>{item.user_agent || "수집 없음"}</strong></div><div><span>Referer</span><strong>{item.referer || "수집 없음"}</strong></div></div></details>)}</div> : <p className="empty-state">조건에 맞는 접속 기록이 없습니다.</p>}
      <p className="small-note">이 화면은 ArchiveOS 웹 UI의 루트·대시보드·서비스·운영·재무·기록·메일·설정 접근을 기록합니다. 외부 서비스 자체에 직접 접속한 기록은 해당 서비스가 별도 전달하지 않는 한 포함되지 않습니다.</p>
    </SectionCard>
  </div>;
}

function Metric({ label, value, suffix }: { label: string; value: number | undefined; suffix: string }) {
  return <article className="metric-card"><span>{label}</span><strong>{value == null ? "-" : `${Number(value).toLocaleString()}${suffix}`}</strong></article>;
}

function actorLabel(actor: string, role: string) {
  return role === "PUBLIC" ? "익명" : `${actor} · ${roleLabel(role)}`;
}

function roleLabel(role: string) {
  return ({ PUBLIC: "공개", OPERATOR: "운영자", PM: "PM", ADMIN: "관리자", AUTHENTICATED_READ: "인증 조회", ARCHIVE_INTERNAL_SERVICE: "내부 서비스" } as Record<string, string>)[role] ?? role;
}

function routeLabel(route: string) {
  return ({ root: "루트", dashboard: "대시보드", services: "서비스", operations: "운영", finance: "재무", records: "기록", mail: "메일", settings: "설정", unknown: "기타" } as Record<string, string>)[route] ?? route;
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
