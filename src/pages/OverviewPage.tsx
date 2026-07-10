import type { AppRoute } from "../app/navigation";
import type { AppData } from "../app/AppShell";
import { Icon } from "../components/shared/Icon";
import { MetricCard } from "../components/shared/MetricCard";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { buildOverviewViewModel } from "../lib/viewModels/overview";
import { formatTimeAgo } from "./pageUtils";

export function OverviewPage({ data, onRefresh, onNavigate }: { data: AppData; onRefresh: () => void; onNavigate: (route: AppRoute) => void }) {
  const overview = buildOverviewViewModel({ runtime: data.runtime, queue: data.queue, tasks: data.tasks, events: data.events, knowledge: data.knowledge, historian: data.historian, endpointHealth: data.endpointHealth, mesh: data.mesh, kpi: data.kpi, architect: data.architect });
  const activeAgents = data.mesh?.agents.filter((agent) => ["detected", "working", "enabled", "clear"].includes(agent.status)).length || 0;
  const runningTasks = data.queue?.in_progress ?? overview.queueCounts.processing;
  const updated = formatTimeAgo(data.refreshedAt || overview.lastUpdatedAt);
  const atlasStatus = data.atlas?.system.current_status ?? "unknown";
  const atlasNormalServices = data.atlas?.services.filter((service) => service.current_status === "normal").length ?? 0;
  const atlasTotalServices = data.atlas?.services.length ?? 0;
  const atlasLatestCheck = data.atlas?.recent_healthchecks[0]?.checked_at;
  const atlasDescription = data.atlas
    ? `${atlasNormalServices}/${atlasTotalServices}개 서비스 정상 · ${data.atlas.system.environment}/${data.atlas.system.provider}`
    : "Atlas 외부 관제 레지스트리를 불러오지 못했습니다.";
  const tower = data.managedSystems;
  const recommendedPmAction = tower?.summary.recommendedPmAction;
  const liveFlow = data.liveFlow;
  const workforce = data.workforce;

  return <div className="page-stack overview-page">
    <section className={`system-command-bar state-${overview.statusTone}`}>
      <div className="system-state-icon"><Icon name="health" size={26} /></div>
      <div className="system-state-copy"><span className="eyebrow">시스템 상태</span><div className="system-state-title"><h2>{overview.systemStatus}</h2><StatusBadge status={overview.statusTone}>{overview.systemStatus}</StatusBadge></div><p>{overview.activeTask === "No active task" ? "대기 중인 작업은 없습니다. ArchiveOS가 새 이벤트를 감시하고 있습니다." : overview.activeTask}</p></div>
      <div className="system-state-context"><span><small>현재 에이전트</small><strong>{meaningfulAgent(overview.currentAgent)}</strong></span><span><small>파이프라인 단계</small><strong>{overview.currentStage}</strong></span><span><small>마지막 갱신</small><strong>{updated}</strong></span></div>
      <button className="icon-button command-refresh" type="button" onClick={onRefresh} aria-label="대시보드 새로고침"><Icon name="refresh" /></button>
    </section>

    <section className="kpi-command-grid" aria-label="Operational KPI cards">
      <MetricCard icon="health" label="시스템 상태" value={overview.systemStatus} description="런타임과 주요 API 상태" status={overview.statusTone} updatedAt={updated} onClick={() => onNavigate("settings")} actionLabel="상태 확인" />
      <MetricCard icon="activity" label="관제 대상" value={tower?.summary.managedSystemsCount ?? 0} description={`${tower?.summary.normalCount ?? 0}개 정상 · Inbox ${tower?.summary.openPmInboxItems ?? 0}건`} status={(tower?.summary.downCandidateCount ?? 0) > 0 ? "critical" : (tower?.summary.degradedCount ?? 0) > 0 ? "degraded" : "healthy"} updatedAt={tower?.summary.generatedAt ? formatTimeAgo(tower.summary.generatedAt) : updated} onClick={() => onNavigate("managed")} actionLabel="관제 열기" />
      <MetricCard icon="workflow" label="실시간 흐름" value={liveFlow?.active_flows ?? 0} description={`승인 ${liveFlow?.pending_approvals ?? 0}건 · callback 실패 ${liveFlow?.failed_callbacks ?? 0}건`} status={(liveFlow?.failed_callbacks ?? 0) > 0 ? "critical" : (liveFlow?.degraded_systems ?? 0) > 0 ? "degraded" : (liveFlow?.active_flows ?? 0) > 0 ? "working" : "idle"} updatedAt={liveFlow?.latest_event_at ? formatTimeAgo(liveFlow.latest_event_at) : updated} onClick={() => onNavigate("liveflow")} actionLabel="흐름 보기" />
      <MetricCard icon="agents" label="작업 역량" value={workforce?.summary.totalHeadcount ?? 0} description={`적체 ${workforce?.summary.totalBacklog ?? 0}건 · ${workforce?.summary.largestBottleneck ?? "병목 없음"}`} status={(workforce?.summary.totalBacklog ?? 0) > 0 ? "warning" : workforce ? "healthy" : "idle"} updatedAt={workforce?.generatedAt ? formatTimeAgo(workforce.generatedAt) : updated} onClick={() => onNavigate("workforce")} actionLabel="역량 보기" />
      <MetricCard icon="activity" label="Atlas 플랫폼" value={atlasStatus} description={atlasDescription} status={atlasStatus} updatedAt={atlasLatestCheck ? formatTimeAgo(atlasLatestCheck) : updated} onClick={() => onNavigate("atlas")} actionLabel="Atlas 관제" />
      <MetricCard icon="agents" label="활성 에이전트" value={`${activeAgents}/${data.mesh?.agents.length || 0}`} description={data.mesh?.health.summary || "에이전트 상태 수집 대기 중"} status={activeAgents > 0 ? "working" : "disconnected"} updatedAt={updated} onClick={() => onNavigate("agents")} actionLabel="에이전트 보기" />
      <MetricCard icon="workflow" label="파이프라인" value={overview.currentStage} description={`처리 중인 작업 ${runningTasks}건`} status={runningTasks > 0 ? "working" : "idle"} updatedAt={updated} onClick={() => onNavigate("workflows")} actionLabel="작업 흐름 보기" />
      <MetricCard icon="approval" label="승인 대기" value={overview.approvalCount} description="PM 확인이 필요한 결정" status={overview.approvalCount > 0 ? "blocked" : "healthy"} updatedAt={updated} onClick={() => onNavigate("workflows")} actionLabel="승인 검토" />
      <MetricCard icon="alert" label="중요 알림" value={overview.criticalAlertCount} description="실패, 차단, API 이상 항목" status={overview.criticalAlertCount > 0 ? "critical" : "healthy"} updatedAt={updated} onClick={() => onNavigate("history")} actionLabel="알림 확인" />
      <MetricCard icon="activity" label="진행 작업" value={runningTasks} description={`Inbox 대기 ${overview.queueCounts.inbox}건`} status={runningTasks > 0 ? "working" : overview.queueCounts.inbox > 0 ? "waiting" : "idle"} updatedAt={updated} onClick={() => onNavigate("workflows")} actionLabel="큐 열기" />
    </section>

    <section className="overview-layout operational-priority">
      <SectionCard title="관제 요약" eyebrow="서비스별 상태와 PM 확인 항목" className="span-7">
        {tower ? <div className="queue-bars">
          <button type="button" onClick={() => onNavigate("managed")}><span>시스템</span><strong>{tower.summary.managedSystemsCount}</strong><StatusBadge status="healthy">관리 중</StatusBadge></button>
          <button type="button" onClick={() => onNavigate("managed")}><span>정상</span><strong>{tower.summary.normalCount}</strong><StatusBadge status="healthy">정상</StatusBadge></button>
          <button type="button" onClick={() => onNavigate("managed")}><span>주의</span><strong>{tower.summary.degradedCount}</strong><StatusBadge status={tower.summary.degradedCount ? "degraded" : "healthy"}>{tower.summary.degradedCount ? "확인" : "없음"}</StatusBadge></button>
          <button type="button" onClick={() => onNavigate("managed")}><span>승인 대기</span><strong>{tower.summary.pendingApprovals}</strong><StatusBadge status={tower.summary.pendingApprovals ? "blocked" : "healthy"}>{tower.summary.pendingApprovals ? "PM" : "없음"}</StatusBadge></button>
          <button type="button" onClick={() => onNavigate("managed")}><span>Inbox</span><strong>{tower.summary.openPmInboxItems}</strong><StatusBadge status={tower.summary.openPmInboxItems ? "warning" : "healthy"}>{tower.summary.openPmInboxItems ? "열림" : "비어 있음"}</StatusBadge></button>
        </div> : <div className="empty-state">관리 시스템 요약을 불러오지 못했습니다.</div>}
      </SectionCard>

      <SectionCard title="권장 조치" eyebrow="가장 먼저 볼 항목" className="span-5">
        <button className="chain-focus clickable" type="button" onClick={() => onNavigate("managed")}>
          <div><StatusBadge status={recommendedPmAction?.severity || "healthy"}>{recommendedPmAction?.severity || "준비됨"}</StatusBadge><strong>{recommendedPmAction?.title || "긴급 조치는 없습니다"}</strong></div>
          <p>{recommendedPmAction?.reason || "현재 우선 확인이 필요한 관리 시스템 항목은 없습니다."}</p>
          <span className="text-link">PM Inbox 열기 →</span>
        </button>
      </SectionCard>

      <SectionCard title="확인 필요" eyebrow="예외 항목 우선 처리" className="span-5 priority-panel">
        <div className="attention-list">{overview.attention.map((item) => <button className="attention-item clickable" key={item.title} type="button" onClick={() => onNavigate(item.title.includes("approval") ? "workflows" : "history")}><StatusBadge status={item.status}>{item.status}</StatusBadge><div><strong>{item.title}</strong><p>{item.body}</p></div><span aria-hidden="true">→</span></button>)}{!overview.attention.length ? <div className="healthy-empty"><StatusBadge status="healthy">정상</StatusBadge><strong>처리할 예외 없음</strong><p>차단된 작업이나 중요 서비스 알림이 없습니다.</p></div> : null}</div>
      </SectionCard>

      <SectionCard title="실행 흐름" eyebrow="현재 작업 경로" className="span-7">
        <div className="runtime-flow command-flow">{overview.runtimeFlow.map((stage, index) => <div className={`runtime-stage runtime-${stage.status}`} key={stage.id}><span className="stage-index">{index + 1}</span><div><strong>{stage.label}</strong><StatusBadge status={stage.status}>{stage.status}</StatusBadge></div>{index < overview.runtimeFlow.length - 1 ? <i aria-hidden="true" /> : null}</div>)}</div>
      </SectionCard>

      <SectionCard title="활성 작업 체인" eyebrow="현재 우선 작업" className="span-5">
        {overview.activeChain ? <button className="chain-focus clickable" type="button" onClick={() => onNavigate("workflows")}><div><StatusBadge status="working">{overview.activeChain.stage}</StatusBadge><strong>{overview.activeChain.task}</strong></div><dl><div><dt>담당</dt><dd>{meaningfulAgent(overview.activeChain.owner)}</dd></div><div><dt>다음 조치</dt><dd>{overview.activeChain.nextAction}</dd></div></dl><span className="text-link">작업 흐름 열기 →</span></button> : <div className="empty-state"><strong>활성 작업 없음</strong><p>큐가 비어 있습니다. 새 작업이 파이프라인에 들어오면 이곳에 표시됩니다.</p></div>}
      </SectionCard>

      <SectionCard title="지식 상태" eyebrow="운영 메모리" className="span-3">
        <button className="knowledge-snapshot clickable" type="button" onClick={() => onNavigate("knowledge")}><div className="constellation-mini" aria-hidden="true"><i /><i /><i /><i /><i /></div><dl><div><dt>노드</dt><dd>{overview.memorySummary.nodes}</dd></div><div><dt>관계</dt><dd>{overview.memorySummary.relations}</dd></div><div><dt>RAG</dt><dd><StatusBadge status={data.aiRuntime?.rag.ready ? "healthy" : "waiting"}>{data.aiRuntime?.rag.ready ? "준비됨" : "대기 중"}</StatusBadge></dd></div></dl><span className="text-link">메모리 보기 →</span></button>
      </SectionCard>

      <SectionCard title="Atlas 상태" eyebrow="외부 플랫폼 관제" className="span-3">
        <button className="knowledge-snapshot clickable" type="button" onClick={() => onNavigate("atlas")}>
          <div className="constellation-mini" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          <dl>
            <div><dt>플랫폼</dt><dd><StatusBadge status={atlasStatus}>{atlasStatus}</StatusBadge></dd></div>
            <div><dt>서비스</dt><dd>{atlasNormalServices}/{atlasTotalServices}</dd></div>
            <div><dt>최근 점검</dt><dd>{atlasLatestCheck ? formatTimeAgo(atlasLatestCheck) : "데이터 없음"}</dd></div>
          </dl>
          <span className="text-link">Atlas 열기 →</span>
        </button>
      </SectionCard>

      <SectionCard title="작업 큐" eyebrow="작업 분포" className="span-4">
        <div className="queue-bars">{[["Inbox", overview.queueCounts.inbox, "waiting"], ["처리 중", overview.queueCounts.processing, "working"], ["검토", overview.queueCounts.review, "working"], ["PM 결정", overview.queueCounts.pmDecision, "blocked"], ["실패", overview.queueCounts.failed, "critical"]].map(([label, value, status]) => <button key={String(label)} type="button" onClick={() => onNavigate("workflows")}><span>{label}</span><strong>{value}</strong><StatusBadge status={String(status)}>{Number(value) ? status : "없음"}</StatusBadge></button>)}</div>
      </SectionCard>

      <SectionCard title="최근 활동" eyebrow="최근 운영 근거" className="span-12" action={<button className="text-button" type="button" onClick={() => onNavigate("history")}>이력 열기 →</button>}>
        <div className="event-list compact">{overview.recentEvents.slice(0, 5).map((event) => <article className="event-row" key={event.id}><span>{formatTimeAgo(event.created_at)}</span><StatusBadge status={event.status}>{event.type}</StatusBadge><strong>{event.title}</strong><p>{event.description}</p></article>)}{!overview.recentEvents.length ? <div className="empty-state">아직 기록된 운영 이벤트가 없습니다.</div> : null}</div>
      </SectionCard>
    </section>
  </div>;
}

function meaningfulAgent(value: string) { return value === "None" ? "작업 대기 중" : value; }
