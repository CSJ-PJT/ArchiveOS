import { useCallback, useEffect, useState } from "react";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { getUsageAudit, type PlatformRole, type UsageAuditEntry, type UsageAuditPage } from "../lib/backendApi";

const PAGE_SIZE = 25;

export function AdminUsageAuditPage({ role }: { role: PlatformRole }) {
  const [page, setPage] = useState(0);
  const [selectedDate, setSelectedDate] = useState(todayInKorea);
  const [data, setData] = useState<UsageAuditPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (role !== "ADMIN") return;
    setLoading(true);
    setError(null);
    try {
      const result = await getUsageAudit(page, PAGE_SIZE, selectedDate);
      setData(result);
      const lastPage = Math.max(0, Math.ceil(result.total / result.size) - 1);
      if (page > lastPage) setPage(lastPage);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [page, role, selectedDate]);

  useEffect(() => { void load(); }, [load]);

  if (role !== "ADMIN") {
    return <SectionCard title="사용 기록" eyebrow="관리자 전용"><p className="empty-copy">관리자 계정으로 로그인해야 사용자 IP와 사용 시각을 조회할 수 있습니다.</p></SectionCard>;
  }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.size ?? PAGE_SIZE)));
  const latestAtlas = data?.atlas.reports.find((report) => report.target_date === selectedDate);
  return <div className="page-stack admin-usage-audit">
    <SectionCard title="ArchiveOS 사용 기록" eyebrow="관리자 전용 · 서버 기록" action={<button type="button" className="button button-secondary" onClick={() => void load()} disabled={loading}>{loading ? "갱신 중..." : "새로고침"}</button>}>
      <p className="body-copy">ArchiveOS 화면 사용과 승인·배치·메일 등 변경 작업의 계정, 접속 IP, 발생 시각을 확인합니다. IP는 브라우저 입력값이 아닌 서버 프록시 요청에서 기록합니다.</p>
      <div className="usage-audit-date-controls" aria-label="사용 기록 조회 날짜">
        <button type="button" onClick={() => moveDate(-1)} disabled={loading}>이전 날</button>
        <label>조회 날짜<input type="date" value={selectedDate} max={todayInKorea()} onChange={(event) => { setPage(0); setSelectedDate(event.target.value || todayInKorea()); }} /></label>
        <button type="button" onClick={() => { setPage(0); setSelectedDate(todayInKorea()); }} disabled={loading || selectedDate === todayInKorea()}>오늘</button>
        <button type="button" onClick={() => moveDate(1)} disabled={loading || selectedDate >= todayInKorea()}>다음 날</button>
      </div>
      <div className="usage-audit-summary" aria-label="사용 기록 요약">
        <Summary label="선택일 전체 기록" value={data?.summary.total} />
        <Summary label="선택일 접속 IP" value={data?.summary.unique_ips} />
        <Summary label="로그인 사용자 기록" value={data?.summary.authenticated} />
        <Summary label="Atlas 화면 기록" value={data?.summary.atlas_page_views} />
      </div>
    </SectionCard>

    <SectionCard title="Atlas·Archive 프로젝트 외부 접속" eyebrow="OCI 일일 집계 · 별도 DB 저장">
      <p className="body-copy">Atlas와 Archive 공개 프로젝트의 하루 단위 접속 집계입니다. 원 IP와 브라우저 정보는 아래 관리자 전용 최근 사용 내역에만 보관하고, 일일 집계와 Slack에는 식별 정보를 포함하지 않습니다.</p>
      {latestAtlas ? <>
        <div className="usage-audit-summary" aria-label="Atlas 외부 접속 요약">
          <Summary label="집계 기준일" value={latestAtlas.target_date} />
          <Summary label="외부 요청" value={latestAtlas.monitored_requests} />
          <Summary label="고유 비식별 접속" value={latestAtlas.monitored_unique_connections} />
          <Summary label="오류 응답" value={latestAtlas.status_4xx + latestAtlas.status_5xx} />
        </div>
        <div className="usage-audit-table-wrap">
          <table className="usage-audit-table atlas-access-table">
            <thead><tr><th>프로젝트</th><th>외부 요청</th><th>기준일</th><th>응답 상태</th></tr></thead>
            <tbody>{data?.atlas.projects.map((project) => <tr key={project.service_name}>
              <td><strong>{atlasProjectLabel(project.service_name)}</strong><small>{atlasProjectPath(project.service_name)}</small></td>
              <td><strong>{project.request_count.toLocaleString()}건</strong></td>
              <td><time dateTime={latestAtlas.generated_at}>{formatDate(latestAtlas.generated_at)}</time></td>
              <td><span>2xx {latestAtlas.status_2xx.toLocaleString()} · 3xx {latestAtlas.status_3xx.toLocaleString()}</span><small>4xx {latestAtlas.status_4xx.toLocaleString()} · 5xx {latestAtlas.status_5xx.toLocaleString()}</small></td>
            </tr>)}</tbody>
          </table>
        </div>
      </> : <p className="empty-copy">{selectedDate} Atlas·Archive 일일 집계가 아직 생성되지 않았습니다.</p>}
    </SectionCard>

    <SectionCard title="최근 사용 내역" eyebrow={`최신순 · 페이지당 ${PAGE_SIZE}건`}>
      {error ? <div className="empty-state error-state" role="alert">{error}</div> : null}
      {loading && !data ? <div className="usage-audit-loading" role="status"><span className="page-loading-spinner" aria-hidden="true" />사용 기록을 불러오는 중입니다.</div> : null}
      {!loading && !error && !data?.items.length ? <p className="empty-copy">아직 기록된 ArchiveOS·Atlas 사용 내역이 없습니다.</p> : null}
      {data?.items.length ? <div className="usage-audit-table-wrap">
        <table className="usage-audit-table">
          <thead><tr><th>사용 시각</th><th>계정</th><th>기능</th><th>작업</th><th>IP</th><th>접속 환경</th></tr></thead>
          <tbody>{data.items.map((entry) => <UsageRow key={`${entry.source}-${entry.id}`} entry={entry} />)}</tbody>
        </table>
      </div> : null}
      <div className="list-pagination" aria-label="사용 기록 페이지 이동">
        <span>{page + 1} / {totalPages} 페이지 · 총 {(data?.total ?? 0).toLocaleString()}건</span>
        <div><button type="button" disabled={page === 0 || loading} onClick={() => setPage((value) => Math.max(0, value - 1))}>이전</button><button type="button" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>다음</button></div>
      </div>
    </SectionCard>
  </div>;

  function moveDate(days: number) {
    const next = new Date(`${selectedDate}T12:00:00+09:00`);
    next.setUTCDate(next.getUTCDate() + days);
    setPage(0);
    setSelectedDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(next));
  }
}

function Summary({ label, value }: { label: string; value: number | string | undefined }) {
  return <article><span>{label}</span><strong>{value === undefined ? "-" : typeof value === "number" ? value.toLocaleString() : value}</strong></article>;
}

function UsageRow({ entry }: { entry: UsageAuditEntry }) {
  return <tr>
    <td><time dateTime={entry.occurred_at}>{formatDate(entry.occurred_at)}</time></td>
    <td><strong>{entry.actor || "anonymous"}</strong><StatusBadge status={entry.authenticated ? "healthy" : "empty"}>{roleLabel(entry.role)}</StatusBadge></td>
    <td><strong>{featureLabel(entry.feature)}</strong><small>{routeLabel(entry.route)}</small></td>
    <td><span>{actionLabel(entry)}</span><small>{entry.source === "ATLAS_PAGE_VIEW" ? "외부 화면 사용" : entry.source === "PAGE_VIEW" ? "화면 사용" : "기능 실행"}</small></td>
    <td><code>{entry.client_ip || "확인 불가"}</code></td>
    <td title={entry.user_agent || ""}>{deviceLabel(entry.user_agent)}</td>
  </tr>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "시간 확인 불가" : date.toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function todayInKorea() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function roleLabel(role: string) { return ({ ADMIN:"관리자", PM:"PM", OPERATOR:"운영자", PUBLIC:"공개" } as Record<string,string>)[role] ?? role; }
function featureLabel(feature: string) { return ({ auth:"로그인", tasks:"작업", approvals:"승인", batch:"배치", batches:"배치", mail:"메일", rag:"RAG", memory:"운영 메모리" } as Record<string,string>)[feature] ?? feature; }
function routeLabel(route: string) { return route.startsWith("/api/") ? route.replace(/^\/api\//, "API · ") : route.startsWith("/") ? route : `#/${route}`; }
function actionLabel(entry: UsageAuditEntry) {
  if (entry.action === "PAGE_VIEW") return "페이지 조회";
  if (entry.action === "approval_decision") return "승인 결정";
  if (entry.action === "workflow_retry") return "작업 재시도";
  const method = entry.action.split(" ")[0]?.toUpperCase();
  return ({ POST:"실행", PATCH:"변경", PUT:"변경", DELETE:"삭제" } as Record<string,string>)[method] ?? entry.action;
}
function deviceLabel(value: string | null) {
  if (!value) return "확인 불가";
  if (/android|iphone|ipad/i.test(value)) return /chrome/i.test(value) ? "모바일 Chrome" : /safari/i.test(value) ? "모바일 Safari" : "모바일 브라우저";
  if (/edg\//i.test(value)) return "Edge";
  if (/chrome/i.test(value)) return "Chrome";
  if (/firefox/i.test(value)) return "Firefox";
  if (/safari/i.test(value)) return "Safari";
  return "브라우저";
}

function atlasProjectLabel(value: string) {
  return ({
    "Atlas Home/Other": "Atlas 통합 홈",
    "Learn Atlas": "Backend Atlas 학습",
    "Sketchfy Atlas": "Sketchfy Atlas",
    "Incruit Atlas": "Incruit Atlas",
    "Health Atlas": "Health Atlas",
    "Travel Atlas": "Route Atlas",
    "World Atlas": "Archive World",
    ArchiveOS: "ArchiveOS",
    "Archive-Market": "Archive-Market",
    "Archive-Nexus": "Archive-Nexus",
    "Archive-Logistics": "Archive-Logistics",
    "Archive-Ledger": "Archive-Ledger",
    "Archive-World": "Archive World",
  } as Record<string, string>)[value] ?? value;
}

function atlasProjectPath(value: string) {
  return ({
    "Atlas Home/Other": "/atlas 및 기타",
    "Learn Atlas": "/learn · /run",
    "Sketchfy Atlas": "/sketchfy",
    "Incruit Atlas": "/jobs",
    "Health Atlas": "/health",
    "Travel Atlas": "/travel",
    "World Atlas": "/world",
    ArchiveOS: "/archiveos",
    "Archive-Market": "/market",
    "Archive-Nexus": "/nexus",
    "Archive-Logistics": "/logistics",
    "Archive-Ledger": "/ledger",
    "Archive-World": "/archive-world · /archive-world-mini",
  } as Record<string, string>)[value] ?? "Atlas OCI";
}
