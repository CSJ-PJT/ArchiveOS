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
    ? `${atlasNormalServices}/${atlasTotalServices} services normal · ${data.atlas.system.environment}/${data.atlas.system.provider}`
    : "Atlas external observability registry unavailable";
  const tower = data.managedSystems;
  const recommendedPmAction = tower?.summary.recommendedPmAction;

  return <div className="page-stack overview-page">
    <section className={`system-command-bar state-${overview.statusTone}`}>
      <div className="system-state-icon"><Icon name="health" size={26} /></div>
      <div className="system-state-copy"><span className="eyebrow">System status</span><div className="system-state-title"><h2>{overview.systemStatus}</h2><StatusBadge status={overview.statusTone}>{overview.systemStatus}</StatusBadge></div><p>{overview.activeTask === "No active task" ? "All queues are clear. ArchiveOS is monitoring for new work." : overview.activeTask}</p></div>
      <div className="system-state-context"><span><small>Current agent</small><strong>{meaningfulAgent(overview.currentAgent)}</strong></span><span><small>Pipeline stage</small><strong>{overview.currentStage}</strong></span><span><small>Last update</small><strong>{updated}</strong></span></div>
      <button className="icon-button command-refresh" type="button" onClick={onRefresh} aria-label="Refresh dashboard"><Icon name="refresh" /></button>
    </section>

    <section className="kpi-command-grid" aria-label="Operational KPI cards">
      <MetricCard icon="health" label="System Health" value={overview.systemStatus} description="Runtime and endpoint condition" status={overview.statusTone} updatedAt={updated} onClick={() => onNavigate("settings")} actionLabel="Inspect health" />
      <MetricCard icon="activity" label="Control Tower" value={tower?.summary.managedSystemsCount ?? 0} description={`${tower?.summary.normalCount ?? 0} normal · ${tower?.summary.openPmInboxItems ?? 0} inbox open`} status={(tower?.summary.downCandidateCount ?? 0) > 0 ? "critical" : (tower?.summary.degradedCount ?? 0) > 0 ? "degraded" : "healthy"} updatedAt={tower?.summary.generatedAt ? formatTimeAgo(tower.summary.generatedAt) : updated} onClick={() => onNavigate("managed")} actionLabel="Open tower" />
      <MetricCard icon="activity" label="Atlas Platform" value={atlasStatus} description={atlasDescription} status={atlasStatus} updatedAt={atlasLatestCheck ? formatTimeAgo(atlasLatestCheck) : updated} onClick={() => onNavigate("atlas")} actionLabel="Open Atlas monitor" />
      <MetricCard icon="agents" label="Active Agents" value={`${activeAgents}/${data.mesh?.agents.length || 0}`} description={data.mesh?.health.summary || "Waiting for agent telemetry"} status={activeAgents > 0 ? "working" : "disconnected"} updatedAt={updated} onClick={() => onNavigate("agents")} actionLabel="Open monitor" />
      <MetricCard icon="workflow" label="Pipeline Status" value={overview.currentStage} description={`${runningTasks} task(s) currently processing`} status={runningTasks > 0 ? "working" : "idle"} updatedAt={updated} onClick={() => onNavigate("workflows")} actionLabel="View workflows" />
      <MetricCard icon="approval" label="Approval Queue" value={overview.approvalCount} description="Human PM decisions required" status={overview.approvalCount > 0 ? "blocked" : "healthy"} updatedAt={updated} onClick={() => onNavigate("workflows")} actionLabel="Review decisions" />
      <MetricCard icon="alert" label="Critical Alerts" value={overview.criticalAlertCount} description="Failures, blocks, and endpoint issues" status={overview.criticalAlertCount > 0 ? "critical" : "healthy"} updatedAt={updated} onClick={() => onNavigate("history")} actionLabel="Inspect alerts" />
      <MetricCard icon="activity" label="Running Tasks" value={runningTasks} description={`${overview.queueCounts.inbox} waiting in inbox`} status={runningTasks > 0 ? "working" : overview.queueCounts.inbox > 0 ? "waiting" : "idle"} updatedAt={updated} onClick={() => onNavigate("workflows")} actionLabel="Open queue" />
    </section>

    <section className="overview-layout operational-priority">
      <SectionCard title="Control Tower Summary" eyebrow="Multi-system PM view" className="span-7">
        {tower ? <div className="queue-bars">
          <button type="button" onClick={() => onNavigate("managed")}><span>Systems</span><strong>{tower.summary.managedSystemsCount}</strong><StatusBadge status="healthy">managed</StatusBadge></button>
          <button type="button" onClick={() => onNavigate("managed")}><span>Normal</span><strong>{tower.summary.normalCount}</strong><StatusBadge status="healthy">normal</StatusBadge></button>
          <button type="button" onClick={() => onNavigate("managed")}><span>Degraded</span><strong>{tower.summary.degradedCount}</strong><StatusBadge status={tower.summary.degradedCount ? "degraded" : "healthy"}>{tower.summary.degradedCount ? "review" : "clear"}</StatusBadge></button>
          <button type="button" onClick={() => onNavigate("managed")}><span>Pending approvals</span><strong>{tower.summary.pendingApprovals}</strong><StatusBadge status={tower.summary.pendingApprovals ? "blocked" : "healthy"}>{tower.summary.pendingApprovals ? "PM" : "clear"}</StatusBadge></button>
          <button type="button" onClick={() => onNavigate("managed")}><span>Inbox open</span><strong>{tower.summary.openPmInboxItems}</strong><StatusBadge status={tower.summary.openPmInboxItems ? "warning" : "healthy"}>{tower.summary.openPmInboxItems ? "open" : "clear"}</StatusBadge></button>
        </div> : <div className="empty-state">Managed Systems summary is unavailable.</div>}
      </SectionCard>

      <SectionCard title="Recommended PM Action" eyebrow="Highest priority" className="span-5">
        <button className="chain-focus clickable" type="button" onClick={() => onNavigate("managed")}>
          <div><StatusBadge status={recommendedPmAction?.severity || "healthy"}>{recommendedPmAction?.severity || "ready"}</StatusBadge><strong>{recommendedPmAction?.title || "No urgent action required"}</strong></div>
          <p>{recommendedPmAction?.reason || "Managed Systems has no open high-priority action."}</p>
          <span className="text-link">Open PM Inbox →</span>
        </button>
      </SectionCard>

      <SectionCard title="Attention Required" eyebrow="Act on exceptions first" className="span-5 priority-panel">
        <div className="attention-list">{overview.attention.map((item) => <button className="attention-item clickable" key={item.title} type="button" onClick={() => onNavigate(item.title.includes("approval") ? "workflows" : "history")}><StatusBadge status={item.status}>{item.status}</StatusBadge><div><strong>{item.title}</strong><p>{item.body}</p></div><span aria-hidden="true">→</span></button>)}{!overview.attention.length ? <div className="healthy-empty"><StatusBadge status="healthy">Healthy</StatusBadge><strong>No action required</strong><p>There are no blocked workflows or critical service alerts.</p></div> : null}</div>
      </SectionCard>

      <SectionCard title="Runtime Flow" eyebrow="Live execution path" className="span-7">
        <div className="runtime-flow command-flow">{overview.runtimeFlow.map((stage, index) => <div className={`runtime-stage runtime-${stage.status}`} key={stage.id}><span className="stage-index">{index + 1}</span><div><strong>{stage.label}</strong><StatusBadge status={stage.status}>{stage.status}</StatusBadge></div>{index < overview.runtimeFlow.length - 1 ? <i aria-hidden="true" /> : null}</div>)}</div>
      </SectionCard>

      <SectionCard title="Active Chain" eyebrow="Most important work now" className="span-5">
        {overview.activeChain ? <button className="chain-focus clickable" type="button" onClick={() => onNavigate("workflows")}><div><StatusBadge status="working">{overview.activeChain.stage}</StatusBadge><strong>{overview.activeChain.task}</strong></div><dl><div><dt>Owner</dt><dd>{meaningfulAgent(overview.activeChain.owner)}</dd></div><div><dt>Next action</dt><dd>{overview.activeChain.nextAction}</dd></div></dl><span className="text-link">Open workflow →</span></button> : <div className="empty-state"><strong>No active chain</strong><p>Queue is clear. New work will appear here when it enters the pipeline.</p></div>}
      </SectionCard>

      <SectionCard title="Knowledge Status" eyebrow="Operational memory" className="span-3">
        <button className="knowledge-snapshot clickable" type="button" onClick={() => onNavigate("knowledge")}><div className="constellation-mini" aria-hidden="true"><i /><i /><i /><i /><i /></div><dl><div><dt>Nodes</dt><dd>{overview.memorySummary.nodes}</dd></div><div><dt>Relations</dt><dd>{overview.memorySummary.relations}</dd></div><div><dt>RAG</dt><dd><StatusBadge status={data.aiRuntime?.rag.ready ? "healthy" : "waiting"}>{data.aiRuntime?.rag.ready ? "Ready" : "Waiting"}</StatusBadge></dd></div></dl><span className="text-link">Explore memory →</span></button>
      </SectionCard>

      <SectionCard title="Atlas Status" eyebrow="External platform watch" className="span-3">
        <button className="knowledge-snapshot clickable" type="button" onClick={() => onNavigate("atlas")}>
          <div className="constellation-mini" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          <dl>
            <div><dt>Platform</dt><dd><StatusBadge status={atlasStatus}>{atlasStatus}</StatusBadge></dd></div>
            <div><dt>Services</dt><dd>{atlasNormalServices}/{atlasTotalServices}</dd></div>
            <div><dt>Last check</dt><dd>{atlasLatestCheck ? formatTimeAgo(atlasLatestCheck) : "No data"}</dd></div>
          </dl>
          <span className="text-link">Open Atlas →</span>
        </button>
      </SectionCard>

      <SectionCard title="Queue" eyebrow="Work distribution" className="span-4">
        <div className="queue-bars">{[["Inbox", overview.queueCounts.inbox, "waiting"], ["Processing", overview.queueCounts.processing, "working"], ["Review", overview.queueCounts.review, "working"], ["PM Decision", overview.queueCounts.pmDecision, "blocked"], ["Failed", overview.queueCounts.failed, "critical"]].map(([label, value, status]) => <button key={String(label)} type="button" onClick={() => onNavigate("workflows")}><span>{label}</span><strong>{value}</strong><StatusBadge status={String(status)}>{Number(value) ? status : "clear"}</StatusBadge></button>)}</div>
      </SectionCard>

      <SectionCard title="Recent Activity" eyebrow="Latest operational evidence" className="span-12" action={<button className="text-button" type="button" onClick={() => onNavigate("history")}>Open history →</button>}>
        <div className="event-list compact">{overview.recentEvents.slice(0, 5).map((event) => <article className="event-row" key={event.id}><span>{formatTimeAgo(event.created_at)}</span><StatusBadge status={event.status}>{event.type}</StatusBadge><strong>{event.title}</strong><p>{event.description}</p></article>)}{!overview.recentEvents.length ? <div className="empty-state">No operational events have been recorded yet.</div> : null}</div>
      </SectionCard>
    </section>
  </div>;
}

function meaningfulAgent(value: string) { return value === "None" ? "Waiting for work" : value; }
