import { useMemo, useState } from "react";
import type { AppRoute } from "../app/navigation";
import type { AppData } from "../app/AppShell";
import { MetricCard } from "../components/shared/MetricCard";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { acknowledgePmInboxItem, resolvePmInboxItem } from "../lib/backendApi";
import type { PmInboxItem } from "../lib/backendApi";
import { formatTimeAgo } from "./pageUtils";

export function ManagedSystemsPage({
  data,
  onRefresh,
  onNavigate,
}: {
  data: AppData;
  onRefresh: () => Promise<void>;
  onNavigate: (route: AppRoute) => void;
}) {
  const managed = data.managedSystems;
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const canAct = data.auth.role === "ADMIN";
  const systemsById = useMemo(() => new Map((managed?.systems || []).map((system) => [system.systemId, system])), [managed?.systems]);

  async function updateInbox(id: string, action: "acknowledge" | "resolve") {
    setBusyItem(`${action}:${id}`);
    setMessage(null);
    try {
      if (action === "acknowledge") await acknowledgePmInboxItem(id);
      else await resolvePmInboxItem(id);
      setMessage(`PM Inbox 항목을 ${action === "acknowledge" ? "확인" : "해결"} 처리했습니다.`);
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `PM Inbox 항목 ${action === "acknowledge" ? "확인" : "해결"} 처리에 실패했습니다.`);
    } finally {
      setBusyItem(null);
    }
  }

  if (!managed) {
    return <div className="empty-state">관리 시스템 관제 정보를 불러오지 못했습니다. archiveos-ai와 migration 상태를 확인하세요.</div>;
  }

  const recommended = managed.summary.recommendedPmAction;
  const openInbox = managed.pmInbox.filter((item) => item.status === "open");

  return <div className="page-stack">
    <header className="page-heading">
      <div>
        <span className="eyebrow">다중 시스템 운영</span>
        <h2>관리 시스템 관제</h2>
        <p>ArchiveOS, Archive-Market, Archive-Nexus, Archive-Logistics, Archive-Ledger, Atlas 상태를 한 화면에서 확인합니다.</p>
      </div>
      <button className="button button-secondary" type="button" onClick={() => void onRefresh()}>새로고침</button>
    </header>

    <section className="kpi-command-grid" aria-label="Managed systems control tower summary">
      <MetricCard label="관리 시스템" value={managed.summary.managedSystemsCount} status="healthy" description="등록된 운영 대상" />
      <MetricCard label="정상" value={managed.summary.normalCount} status="healthy" description="현재 정상인 시스템" />
      <MetricCard label="주의" value={managed.summary.degradedCount} status={managed.summary.degradedCount ? "degraded" : "healthy"} description="확인이 필요한 시스템" />
      <MetricCard label="장애 후보" value={managed.summary.downCandidateCount} status={managed.summary.downCandidateCount ? "critical" : "healthy"} description="중요 실패 감지" />
      <MetricCard label="승인 대기" value={managed.summary.pendingApprovals} status={managed.summary.pendingApprovals ? "blocked" : "healthy"} description="PM 결정 대기" />
      <MetricCard label="열린 Inbox" value={managed.summary.openPmInboxItems} status={managed.summary.openPmInboxItems ? "warning" : "healthy"} description="권장 PM 조치" />
    </section>

    <SectionCard title="권장 PM 조치" eyebrow="가장 먼저 볼 항목">
      <div className="healthy-empty">
        <StatusBadge status={recommended.severity || "healthy"}>{recommended.severity || "ready"}</StatusBadge>
        <strong>{recommended.title}</strong>
        <p>{recommended.reason}</p>
      </div>
    </SectionCard>

    <section className="overview-layout">
      <SectionCard title="관리 시스템 목록" eyebrow="상태 카드" className="span-7">
        <div className="queue-bars">
          {managed.systems.map((system) => <button key={system.systemId} type="button" onClick={() => navigateSystem(system.systemId, onNavigate)}>
            <span>{system.name}</span>
            <strong>{system.status}</strong>
            <StatusBadge status={system.status}>{system.status}</StatusBadge>
            <small>서비스 {system.normalServiceCount}/{system.serviceCount} · 승인 {system.pendingApprovalCount}건</small>
          </button>)}
        </div>
      </SectionCard>

      <SectionCard title="PM Inbox" eyebrow={`열린 항목 ${openInbox.length}건`} className="span-5">
        {message ? <p className="small-note">{message}</p> : null}
        <div className="history-table">
          {managed.pmInbox.map((item) => <InboxRow
            key={item.id}
            item={item}
            systemName={systemsById.get(item.sourceSystemId)?.name || item.sourceSystemId}
            canAct={canAct}
            busyItem={busyItem}
            onUpdate={updateInbox}
          />)}
          {!managed.pmInbox.length ? <div className="empty-state">PM Inbox 항목이 없습니다. 현재 관제 상태는 안정적입니다.</div> : null}
        </div>
        {!canAct ? <p className="small-note">Public, Operator, PM 세션은 PM Inbox를 조회할 수 있습니다. 확인/해결 처리는 Admin 권한이 필요합니다.</p> : null}
      </SectionCard>

      <SectionCard title="시스템 상세" eyebrow="시스템별 주요 정보" className="span-7">
        <div className="history-table">
          {managed.systems.map((system) => <article className="history-row" key={system.systemId}>
            <summary>
              <strong>{system.name}</strong>
              <StatusBadge status={system.status}>{system.status}</StatusBadge>
              <span>{system.type} · {system.environment}/{system.provider}</span>
              <p>{system.statusReason}</p>
            </summary>
            <div className="detail-grid">
              <span>최근 확인<strong>{system.lastCheckedAt ? formatTimeAgo(system.lastCheckedAt) : "데이터 없음"}</strong></span>
              <span>Repository<strong>{system.repository || "n/a"}</strong></span>
              <span>최근 workflow<strong>{system.latestWorkflowId || "n/a"}</strong></span>
              <span>최근 작업 로그<strong>{system.latestWorkLogId || "n/a"}</strong></span>
              {system.systemId === "archive-ledger" ? <>
                <span>Role<strong>{system.role || "Synthetic Financial Operations Backend"}</strong></span>
                <span>Base URL 설정<strong>{system.baseUrlConfigured ? "예" : "아니오"}</strong></span>
                <span>승인 callback<strong>{system.approvalCallbackConfigured ? "설정됨" : "미설정"}</strong></span>
                <span>Secret<strong>{system.secrets || "숨김"}</strong></span>
                <span>Required env<strong>{(system.environmentRequirements || []).map((env) => `${env.name}${env.secret ? " (hidden)" : ""}`).join(", ") || "n/a"}</strong></span>
              </> : null}
              {system.systemId === "archive-market" ? <>
                <span>Role<strong>{system.role || "Demand / Order / Revenue Source"}</strong></span>
                <span>보유자금<strong>{formatMoney(system.marketSummary?.cashBalance)}</strong></span>
                <span>수익<strong>{formatMoney(system.marketSummary?.totalRevenue)}</strong></span>
                <span>비용<strong>{formatMoney(system.marketSummary?.totalCost)}</strong></span>
                <span>손익<strong>{formatMoney(system.marketSummary?.profit)}</strong></span>
                <span>재무 위험<strong>{system.marketSummary?.bankruptcyRisk || "UNKNOWN"}</strong></span>
                <span>반품률<strong>{formatPercent(system.marketSummary?.returnRate)}</strong></span>
                <span>클레임률<strong>{formatPercent(system.marketSummary?.claimRate)}</strong></span>
              </> : null}
            </div>
          </article>)}
        </div>
      </SectionCard>

      <SectionCard title="최근 시스템 간 이벤트" eyebrow="감사 로그와 연결된 운영 근거" className="span-5">
        <div className="event-list compact">
          {data.timeline.slice(0, 6).map((event) => <article className="event-row" key={event.id}>
            <span>{formatTimeAgo(event.occurred_at)}</span>
            <StatusBadge status={event.status}>{event.event_type}</StatusBadge>
            <strong>{event.title}</strong>
            <p>{event.summary || event.project_id || "기록된 요약이 없습니다."}</p>
          </article>)}
          {!data.timeline.length ? <div className="empty-state">타임라인 조회에는 Operator, PM 또는 Admin 권한이 필요합니다.</div> : null}
        </div>
      </SectionCard>
    </section>
  </div>;
}

function InboxRow({
  item,
  systemName,
  canAct,
  busyItem,
  onUpdate,
}: {
  item: PmInboxItem;
  systemName: string;
  canAct: boolean;
  busyItem: string | null;
  onUpdate: (id: string, action: "acknowledge" | "resolve") => Promise<void>;
}) {
  const disabled = !canAct || item.status === "resolved";
  return <article className="history-row">
    <summary>
      <strong>{item.title}</strong>
      <StatusBadge status={item.severity}>{item.severity}</StatusBadge>
      <span>{systemName} · {item.sourceType}</span>
      <p>{item.summary}</p>
    </summary>
    <div className="detail-grid">
      <span>상태<strong>{item.status}</strong></span>
      <span>생성<strong>{formatTimeAgo(item.createdAt)}</strong></span>
      <span>권장 조치<strong>{item.recommendedAction}</strong></span>
      <span>연결 항목<strong>{item.relatedWorkflowId || item.relatedServiceId || item.relatedWorkLogId || "n/a"}</strong></span>
    </div>
    <div className="inline-actions">
      <button className="button button-secondary" type="button" disabled={disabled || busyItem === `acknowledge:${item.id}`} onClick={() => void onUpdate(item.id, "acknowledge")}>
        {busyItem === `acknowledge:${item.id}` ? "확인 처리 중..." : "확인"}
      </button>
      <button className="button button-primary" type="button" disabled={disabled || busyItem === `resolve:${item.id}`} onClick={() => void onUpdate(item.id, "resolve")}>
        {busyItem === `resolve:${item.id}` ? "해결 처리 중..." : "해결"}
      </button>
    </div>
  </article>;
}

function navigateSystem(systemId: string, onNavigate: (route: AppRoute) => void) {
  if (systemId === "atlas-platform") onNavigate("atlas");
  else if (systemId === "archive-market") onNavigate("managed");
  else if (systemId === "archive-nexus" || systemId === "archive-logitics") onNavigate("overview");
  else if (systemId === "archive-ledger") onNavigate("approvals");
  else onNavigate("overview");
}

function formatMoney(value: unknown) {
  const number = typeof value === "number" ? value : Number(String(value ?? "0").replace(/,/g, ""));
  if (!Number.isFinite(number)) return String(value ?? "0");
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(number);
}

function formatPercent(value: unknown) {
  const number = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(number)) return String(value ?? "0");
  return `${number}%`;
}
