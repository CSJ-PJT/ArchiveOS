import { useEffect, useMemo, useState } from "react";
import type { AppData } from "../app/AppShell";
import { canonicalManagedSystemId } from "../app/navigation";
import { DataState } from "../components/shared/DataState";
import { MetricCard } from "../components/shared/MetricCard";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import {
  acknowledgePmInboxItem,
  getManagedSystem,
  getManagedSystemEvents,
  getManagedSystemWorkflows,
  getManagedSystemWorkLogs,
  resolvePmInboxItem,
  type ManagedSystemSummary,
  type PmInboxItem,
} from "../lib/backendApi";
import {
  canManagePmInbox,
  executePmInboxAction,
  managedSystemsUiState,
  selectCoreManagedSystems,
} from "../features/managedSystems/model";
import { formatTimeAgo } from "./pageUtils";

type DetailEvidence = {
  system: ManagedSystemSummary;
  events: Array<Record<string, unknown>>;
  workflows: Array<Record<string, unknown>>;
  workLogs: Array<Record<string, unknown>>;
};

export function ManagedSystemsPage({
  data,
  selectedSystemId,
  onSelectSystem,
  onRefresh,
}: {
  data: AppData;
  selectedSystemId: string | null;
  onSelectSystem: (systemId: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const managed = data.managedSystems;
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailEvidence | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const canAct = canManagePmInbox(data.auth.role);
  const coreSystems = useMemo(() => selectCoreManagedSystems(managed?.systems ?? []), [managed?.systems]);
  const systemsById = useMemo(() => new Map(coreSystems.map((system) => [system.systemId, system])), [coreSystems]);
  const canonicalSelection = canonicalManagedSystemId(selectedSystemId);

  useEffect(() => {
    if (!canonicalSelection) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }
    let active = true;
    setDetailLoading(true);
    setDetailError(null);
    setDetail((current) => current?.system.systemId === canonicalSelection ? current : null);
    Promise.all([
      getManagedSystem(canonicalSelection),
      getManagedSystemEvents(canonicalSelection),
      getManagedSystemWorkflows(canonicalSelection),
      getManagedSystemWorkLogs(canonicalSelection),
    ]).then(([system, events, workflows, workLogs]) => {
      if (active) setDetail({ system, events, workflows, workLogs });
    }).catch((error) => {
      if (active) setDetailError(error instanceof Error ? error.message : "관리 시스템 상세 조회에 실패했습니다.");
    }).finally(() => {
      if (active) setDetailLoading(false);
    });
    return () => { active = false; };
  }, [canonicalSelection]);

  async function updateInbox(id: string, action: "acknowledge" | "resolve") {
    setBusyItem(`${action}:${id}`);
    setMessage(null);
    try {
      const result = await executePmInboxAction(id, action, {
        acknowledge: acknowledgePmInboxItem,
        resolve: resolvePmInboxItem,
      }, onRefresh);
      setMessage(result.message);
    } finally {
      setBusyItem(null);
    }
  }

  const uiState = managedSystemsUiState(data.loading, Boolean(managed), data.errors.managedSystems);
  if (uiState === "loading") {
    return <DataState kind="loading" title="관리 시스템을 불러오는 중입니다." description="Runtime 5개 시스템과 PM Inbox를 조회하고 있습니다." />;
  }
  if (uiState === "error") {
    return <DataState kind="error" title="관리 시스템을 불러오지 못했습니다." description={data.errors.managedSystems} />;
  }
  if (uiState === "empty" || !managed) {
    return <DataState kind="empty" title="관리 시스템 데이터가 없습니다." description="ArchiveOS 관리 시스템 API의 연결 상태를 확인하세요." />;
  }

  const recommended = managed.summary.recommendedPmAction;
  const openInbox = managed.pmInbox.filter((item) => item.status === "open");

  return <div className="page-stack managed-systems-v3" data-testid="managed-systems-view">
    <header className="page-heading">
      <div>
        <span className="eyebrow">RUNTIME 5 SYSTEMS</span>
        <h2>관리 시스템 관제</h2>
        <p>ArchiveOS, Market, Nexus, Logistics, Ledger의 상태 근거와 PM Inbox를 조회합니다.</p>
      </div>
      <button className="button button-secondary" type="button" onClick={() => void onRefresh()}>새로고침</button>
    </header>

    <section className="kpi-command-grid" aria-label="관리 시스템 관제 요약">
      <MetricCard label="관리 시스템" value={coreSystems.length} status="healthy" description="Archive Runtime core" />
      <MetricCard label="정상" value={managed.summary.normalCount} status="healthy" description="현재 정상인 시스템" />
      <MetricCard label="주의" value={managed.summary.degradedCount} status={managed.summary.degradedCount ? "degraded" : "healthy"} description="확인이 필요한 시스템" />
      <MetricCard label="연결 안 됨" value={managed.summary.notConnectedCount} status={managed.summary.notConnectedCount ? "warning" : "healthy"} description="운영 근거가 없는 시스템" />
      <MetricCard label="승인 대기" value={managed.summary.pendingApprovals} status={managed.summary.pendingApprovals ? "blocked" : "healthy"} description="PM 결정 대기" />
      <MetricCard label="열린 Inbox" value={managed.summary.openPmInboxItems} status={managed.summary.openPmInboxItems ? "warning" : "healthy"} description="권장 PM 조치" />
    </section>

    <SectionCard title="권장 PM 조치" eyebrow="현재 우선순위">
      <div className="healthy-empty">
        <StatusBadge status={recommended.severity || "healthy"}>{recommended.severity || "ready"}</StatusBadge>
        <strong>{recommended.title}</strong>
        <p>{recommended.reason}</p>
      </div>
    </SectionCard>

    <section className="overview-layout">
      <SectionCard title="관리 시스템 목록" eyebrow={`${coreSystems.length}/5 systems`} className="span-7">
        {coreSystems.length ? <div className="queue-bars managed-system-list">
          {coreSystems.map((system) => <button
            key={system.systemId}
            type="button"
            data-testid={`managed-system-select-${system.systemId}`}
            aria-pressed={canonicalSelection === system.systemId}
            onClick={() => onSelectSystem(system.systemId)}
          >
            <span>{system.name}</span>
            <strong>{system.status}</strong>
            <StatusBadge status={system.status}>{system.status}</StatusBadge>
            <small>{system.statusReason || "상태 근거 없음"}</small>
            <small>서비스 {system.normalServiceCount}/{system.serviceCount} · 승인 {system.pendingApprovalCount} · 장애 {system.openIncidentCount}</small>
            <small>확인 {system.lastCheckedAt ? formatTimeAgo(system.lastCheckedAt) : "데이터 없음"}</small>
          </button>)}
        </div> : <DataState kind="empty" title="표시할 관리 시스템이 없습니다." description="Archive Runtime core 5개 시스템 응답을 확인하세요." />}
        {coreSystems.length !== 5 ? <p className="small-note" role="status">예상 5개 중 {coreSystems.length}개만 조회되었습니다.</p> : null}
      </SectionCard>

      <SectionCard title="PM Inbox" eyebrow={`열린 항목 ${openInbox.length}건`} className="span-5">
        {message ? <p className="small-note" role="status" aria-live="polite">{message}</p> : null}
        <div className="history-table">
          {managed.pmInbox.map((item) => <InboxRow
            key={item.id}
            item={item}
            systemName={systemsById.get(item.sourceSystemId)?.name || item.sourceSystemId}
            canAct={canAct}
            busyItem={busyItem}
            onUpdate={updateInbox}
          />)}
          {!managed.pmInbox.length ? <DataState kind="empty" title="PM Inbox 항목이 없습니다." description="현재 열린 권장 조치가 없습니다." /> : null}
        </div>
        {!canAct ? <p className="small-note">현재 역할은 {data.auth.role}입니다. 목록은 조회할 수 있지만 확인·해결은 Admin만 수행할 수 있습니다.</p> : null}
      </SectionCard>

      <SectionCard title="시스템 상세" eyebrow={canonicalSelection || "시스템을 선택하세요"} className="span-12">
        {!canonicalSelection ? <DataState kind="empty" title="관리 시스템을 선택하세요." description="목록에서 시스템을 선택하면 상태 근거와 events, workflows, work-logs를 조회합니다." /> : null}
        {canonicalSelection && detailLoading && !detail ? <DataState kind="loading" title="시스템 상세를 불러오는 중입니다." description={canonicalSelection} /> : null}
        {detailError ? <DataState kind="error" title="시스템 상세 조회에 실패했습니다." description={detailError} /> : null}
        {detail ? <SystemDetail evidence={detail} loading={detailLoading} /> : null}
      </SectionCard>
    </section>
  </div>;
}

function SystemDetail({ evidence, loading }: { evidence: DetailEvidence; loading: boolean }) {
  const { system, events, workflows, workLogs } = evidence;
  const publicUrl = safeUrl(system.publicUrl);
  const repositoryUrl = safeUrl(system.repository);
  return <div className="managed-system-detail" data-testid={`managed-system-${system.systemId}`}>
    {loading ? <p className="small-note" role="status">상세 정보를 갱신하고 있습니다.</p> : null}
    <article className="history-row">
      <summary>
        <strong>{system.name}</strong>
        <StatusBadge status={system.status}>{system.status}</StatusBadge>
        <span>{system.systemId} · {system.type} · {system.environment}/{system.provider}</span>
        <p>{system.statusReason || "상태 근거가 없습니다."}</p>
      </summary>
      <div className="detail-grid">
        <span>최근 확인<strong title={system.lastCheckedAt || undefined}>{system.lastCheckedAt ? formatTimeAgo(system.lastCheckedAt) : "데이터 없음"}</strong></span>
        <span>서비스<strong>{system.normalServiceCount}/{system.serviceCount} 정상</strong></span>
        <span>승인 대기<strong>{system.pendingApprovalCount}</strong></span>
        <span>열린 장애/실패<strong>{system.openIncidentCount}</strong></span>
        <span>Repository<strong>{repositoryUrl ? <a href={repositoryUrl} target="_blank" rel="noreferrer">{system.repository}</a> : system.repository || "n/a"}</strong></span>
        <span>Public URL<strong>{publicUrl ? <a href={publicUrl} target="_blank" rel="noreferrer">{system.publicUrl}</a> : system.publicUrl || "n/a"}</strong></span>
        <span>최근 workflow<strong>{system.latestWorkflowId || "n/a"}</strong></span>
        <span>최근 audit<strong>{system.latestAuditEventId || "n/a"}</strong></span>
        <span>최근 work-log<strong>{system.latestWorkLogId || "n/a"}</strong></span>
        <span>Secret<strong>{system.secrets || "hidden"}</strong></span>
      </div>
    </article>
    <div className="managed-evidence-grid">
      <EvidenceList title="Events" items={events} />
      <EvidenceList title="Workflows" items={workflows} />
      <EvidenceList title="Work logs" items={workLogs} />
    </div>
  </div>;
}

function EvidenceList({ title, items }: { title: string; items: Array<Record<string, unknown>> }) {
  return <section className="history-row" aria-label={title}>
    <summary><strong>{title}</strong><span>{items.length}건</span></summary>
    {items.length ? <ul className="managed-evidence-list">{items.slice(0, 10).map((item, index) => <li key={String(item.id ?? item.event_id ?? `${title}-${index}`)}>
      <strong>{text(item.title ?? item.event_type ?? item.workflow_name ?? item.work_title ?? item.id, "기록")}</strong>
      <span>{text(item.status ?? item.severity ?? item.created_at, "상태 정보 없음")}</span>
    </li>)}</ul> : <p className="small-note">기록된 항목이 없습니다.</p>}
  </section>;
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

function safeUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function text(value: unknown, fallback: string) {
  if (value == null || value === "") return fallback;
  return String(value);
}
