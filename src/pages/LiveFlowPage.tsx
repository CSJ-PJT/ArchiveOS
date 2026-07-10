import { useMemo, useState } from "react";
import type { AppData } from "../app/AppShell";
import { MetricCard } from "../components/shared/MetricCard";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { getLiveFlowCorrelation, getLiveFlowEntity, getLiveFlowReplay, refreshLiveFlow, type LiveFlowEvent } from "../lib/backendApi";
import { formatTimeAgo, stringifyMeta } from "./pageUtils";

type FlowMode = "LIVE" | "REPLAY" | "DEMO";

export function LiveFlowPage({ data, onRefresh }: { data: AppData; onRefresh: () => Promise<void> }) {
  const [mode, setMode] = useState<FlowMode>("LIVE");
  const [selected, setSelected] = useState<LiveFlowEvent | null>(null);
  const [replayEvents, setReplayEvents] = useState<LiveFlowEvent[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [chainEvents, setChainEvents] = useState<LiveFlowEvent[]>([]);
  const [chainLabel, setChainLabel] = useState("No chain loaded");
  const canRefresh = data.auth.role === "ADMIN";
  const summary = data.liveFlow;
  const topology = data.liveFlowTopology;
  const events = mode === "REPLAY" ? replayEvents : data.liveFlowEvents;
  const latestEvent = summary?.latest_event_at || events[0]?.occurred_at || null;
  const filteredEvents = useMemo(() => events.slice(0, 80), [events]);

  async function refreshNow() {
    setMessage(null);
    try {
      const result = await refreshLiveFlow();
      setMessage(`Live Flow refreshed. Collected ${result.collected ?? 0} runtime event marker(s).`);
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Live Flow refresh failed.");
    }
  }

  async function loadReplay() {
    setMessage(null);
    try {
      const result = await getLiveFlowReplay(200);
      setReplayEvents(result.data);
      setMode("REPLAY");
      setMessage(`Replay loaded with ${result.data.length} stored runtime event(s).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Replay load failed.");
    }
  }

  function selectEvent(event: LiveFlowEvent) {
    setSelected(event);
    setChainEvents([]);
    setChainLabel("Select Trace correlation or Trace entity to load the operational chain.");
  }

  async function traceCorrelation(event: LiveFlowEvent) {
    if (!event.correlation_id) {
      setChainEvents([event]);
      setChainLabel("Selected event has no correlationId. Showing selected event only.");
      return;
    }
    setMessage(null);
    try {
      const result = await getLiveFlowCorrelation(event.correlation_id);
      setChainEvents(result.data);
      setChainLabel(`Correlation chain: ${event.correlation_id} (${result.data.length})`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Correlation trace failed.");
    }
  }

  async function traceEntity(event: LiveFlowEvent) {
    setMessage(null);
    try {
      const result = await getLiveFlowEntity(event.entity_id);
      setChainEvents(result.data);
      setChainLabel(`Entity chain: ${event.entity_id} (${result.data.length})`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Entity trace failed.");
    }
  }

  if (!summary || !topology) {
    return <div className="empty-state">Live Flow is unavailable. Check archiveos-ai live-flow endpoints and Flyway migration V14.</div>;
  }

  return (
    <div className="page-stack live-flow-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Operational Twin</span>
          <h2>Live Flow / Operational Twin</h2>
          <p>Mode: {mode} / Data: Synthetic Runtime Events / No real customer, payment, account, or financial data.</p>
        </div>
        <div className="inline-actions">
          <button className="button button-secondary" type="button" onClick={() => setMode("LIVE")}>LIVE</button>
          <button className="button button-secondary" type="button" onClick={() => void loadReplay()}>REPLAY</button>
          <button className="button button-secondary" type="button" onClick={() => { setMode("DEMO"); setReplayEvents(data.liveFlowEvents); }}>DEMO</button>
          <button className="button button-primary" type="button" disabled={!canRefresh} onClick={() => void refreshNow()}>Manual refresh</button>
        </div>
      </header>

      {!canRefresh ? <p className="small-note">Public/Operator/PM sessions are read-only. Admin unlock is required for manual refresh or replay marker actions.</p> : null}
      {message ? <p className="small-note">{message}</p> : null}

      <section className="kpi-command-grid">
        <MetricCard label="Active flows" value={summary.active_flows ?? 0} status={(summary.active_flows ?? 0) > 0 ? "working" : "idle"} description="Stored events in the recent live window" />
        <MetricCard label="Recent events" value={summary.recent_events ?? 0} status={(summary.recent_events ?? 0) > 0 ? "healthy" : "empty"} description="Runtime events collected by ArchiveOS" />
        <MetricCard label="Pending approvals" value={summary.pending_approvals ?? 0} status={(summary.pending_approvals ?? 0) > 0 ? "blocked" : "healthy"} description="Approval gate tokens" />
        <MetricCard label="Delayed shipments" value={summary.delayed_shipments ?? 0} status={(summary.delayed_shipments ?? 0) > 0 ? "warning" : "healthy"} description="Logistics delayed route markers" />
        <MetricCard label="Failed callbacks" value={summary.failed_callbacks ?? 0} status={(summary.failed_callbacks ?? 0) > 0 ? "critical" : "healthy"} description="Approval callback failures" />
        <MetricCard label="Degraded systems" value={summary.degraded_systems ?? 0} status={(summary.degraded_systems ?? 0) > 0 ? "degraded" : "healthy"} description="Unavailable/degraded collectors" />
      </section>

      <section className="overview-layout">
        <SectionCard title="Live Flow Canvas" eyebrow={`Mode ${mode} / latest ${latestEvent ? formatTimeAgo(latestEvent) : "no event"}`} className="span-8">
          <LiveFlowCanvas topology={topology} events={filteredEvents} selected={selected} paused={paused} speed={speed} onSelect={selectEvent} />
        </SectionCard>

        <SectionCard title="Detail Panel" eyebrow="Selected event / entity / correlation" className="span-4">
          {selected ? <div className="event-detail-panel">
            <StatusBadge status={selected.severity}>{selected.severity}</StatusBadge>
            <h3>{selected.display_label}</h3>
            <dl className="detail-grid">
              <span>Event type<strong>{selected.event_type}</strong></span>
              <span>Source<strong>{selected.source_system_id}</strong></span>
              <span>Entity<strong>{selected.entity_type} / {selected.entity_id}</strong></span>
              <span>Status<strong>{selected.status}</strong></span>
              <span>Correlation<strong>{selected.correlation_id || "n/a"}</strong></span>
              <span>Occurred<strong>{formatTimeAgo(selected.occurred_at)}</strong></span>
            </dl>
            <OperationalLinks event={selected} workforce={data.workforce?.services || []} />
            <div className="inline-actions wrap">
              <button className="button button-secondary" type="button" onClick={() => void traceCorrelation(selected)}>Trace correlation</button>
              <button className="button button-secondary" type="button" onClick={() => void traceEntity(selected)}>Trace entity</button>
            </div>
            <details><summary>metadata</summary><pre>{stringifyMeta(selected.metadata)}</pre></details>
          </div> : <div className="empty-state">Select a token or event to inspect the correlation chain context.</div>}
        </SectionCard>

        <SectionCard title="Replay Bar" eyebrow="Stored runtime events only" className="span-12">
          <div className="replay-bar">
            <button className="button button-secondary" type="button" onClick={() => setPaused((value) => !value)}>{paused ? "Play" : "Pause"}</button>
            {[1, 2, 5].map((next) => <button className="button button-secondary" type="button" key={next} onClick={() => setSpeed(next)}>{next}x</button>)}
            <span>Speed {speed}x</span>
            <span>Mode {mode}</span>
            <span>Events {filteredEvents.length}</span>
            <span>Severity filter: all</span>
            <span>Domain filter: all</span>
          </div>
        </SectionCard>

        <SectionCard title="Recent Flow Events" eyebrow="Real runtime data normalized by ArchiveOS" className="span-12">
          <div className="event-list compact">
            {filteredEvents.slice(0, 30).map((event) => (
              <button className="event-row clickable" type="button" key={event.event_id} onClick={() => selectEvent(event)}>
                <span>{formatTimeAgo(event.occurred_at)}</span>
                <StatusBadge status={event.status}>{event.status}</StatusBadge>
                <strong>{event.display_label}</strong>
                <p>{event.from_node} → {event.to_node} / {event.event_type} / {event.correlation_id || "no correlation"}</p>
              </button>
            ))}
            {!filteredEvents.length ? <div className="empty-state">No flow event has been collected yet. Admin can run manual refresh.</div> : null}
          </div>
        </SectionCard>

        <SectionCard title="Correlation / Entity Chain" eyebrow={chainLabel} className="span-12">
          <div className="flow-chain">
            {chainEvents.map((event, index) => (
              <button className="chain-step" type="button" key={`${event.event_id}-${index}`} onClick={() => setSelected(event)}>
                <span className="chain-index">{index + 1}</span>
                <StatusBadge status={event.status}>{event.status}</StatusBadge>
                <strong>{event.display_label}</strong>
                <small>{event.source_system_id} / {event.entity_type} / {formatTimeAgo(event.occurred_at)}</small>
              </button>
            ))}
            {!chainEvents.length ? <div className="empty-state">No chain loaded. Select an event and trace by correlationId or entityId.</div> : null}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}

function OperationalLinks({ event, workforce }: { event: LiveFlowEvent; workforce: NonNullable<AppData["workforce"]>["services"] }) {
  const metadata = event.metadata || {};
  const links = [
    ["Order", metadata.orderId],
    ["Shipment", metadata.shipmentId],
    ["Route", metadata.routeId],
    ["Truck", metadata.truckId],
    ["Factory", metadata.factoryId],
    ["Transaction", metadata.transactionId],
    ["Approval", metadata.approvalRequestId],
    ["Risk", metadata.riskLevel],
    ["Amount bucket", event.amount_bucket],
  ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");

  const callbackState = event.entity_type === "callback" || event.event_type.includes("CALLBACK");
  const settlementState = event.entity_type === "settlement" || event.event_type.includes("SETTLEMENT") || event.status === "settled";
  const workforceImpact = workforce.find((item) => item.serviceId === event.source_system_id || item.serviceType.toLowerCase() === event.domain.toLowerCase());

  return (
    <div className="operational-links">
      <h4>Operational links</h4>
      {links.length ? <dl className="detail-grid compact">
        {links.map(([label, value]) => <span key={String(label)}>{String(label)}<strong>{String(value)}</strong></span>)}
      </dl> : <p className="small-note">No linked synthetic identifiers were recorded for this event.</p>}
      {workforceImpact ? <dl className="detail-grid compact">
        <span>Capacity shortage<strong>{String(workforceImpact.capacityShortage)}</strong></span>
        <span>Backlog<strong>{String(workforceImpact.backlog)}</strong></span>
        <span>Bottleneck role<strong>{workforceImpact.bottleneckRole}</strong></span>
        <span>Productivity score<strong>{String(workforceImpact.productivityScore)}</strong></span>
        <span>Payroll cost<strong>{String(workforceImpact.payrollCost)}</strong></span>
      </dl> : <p className="small-note">No workforce impact snapshot is linked to this source yet.</p>}
      {callbackState ? <p className="small-note">Callback chain: ArchiveOS → Archive-Ledger. Check callback status before retrying.</p> : null}
      {settlementState ? <p className="small-note">Settlement chain: Ledger transaction → settlement batch → reconciliation summary.</p> : null}
    </div>
  );
}

function LiveFlowCanvas({ topology, events, selected, paused, speed, onSelect }: {
  topology: NonNullable<AppData["liveFlowTopology"]>;
  events: LiveFlowEvent[];
  selected: LiveFlowEvent | null;
  paused: boolean;
  speed: number;
  onSelect: (event: LiveFlowEvent) => void;
}) {
  const nodeMap = new Map(topology.nodes.map((node) => [node.id, node]));
  return (
    <div className={`live-flow-canvas ${paused ? "is-paused" : ""}`} style={{ ["--flow-speed" as string]: String(speed) }}>
      <svg viewBox="0 0 100 100" role="img" aria-label="Archive Platform live flow topology">
        {topology.edges.map((edge) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          return <g key={`${edge.from}-${edge.to}`}>
            <line className="flow-edge" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
            <text className="flow-edge-label" x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 1}>{edge.label}</text>
          </g>;
        })}
        {topology.nodes.map((node) => (
          <g className={`flow-node flow-node-${node.type}`} key={node.id}>
            <circle cx={node.x} cy={node.y} r="4.4" />
            <text x={node.x} y={node.y + 8}>{node.label}</text>
          </g>
        ))}
        {events.slice(0, 28).map((event, index) => {
          const from = nodeMap.get(normalizeNode(event.from_node)) || nodeMap.get("archiveos")!;
          const to = nodeMap.get(normalizeNode(event.to_node)) || from;
          const progress = tokenProgress(event, index);
          const x = from.x + (to.x - from.x) * progress;
          const y = from.y + (to.y - from.y) * progress + ((index % 3) - 1) * 1.4;
          return <g className={`flow-token token-${event.severity} ${selected?.event_id === event.event_id ? "selected" : ""}`} key={event.event_id} onClick={() => onSelect(event)}>
            <circle cx={x} cy={y} r={event.status === "failed" ? 2.5 : 2.1} />
            <title>{event.display_label}</title>
          </g>;
        })}
      </svg>
    </div>
  );
}

function normalizeNode(value: string) {
  const node = value.toLowerCase();
  if (node.includes("market")) return "market";
  if (node.includes("logistics") || node.includes("logitics")) return "logistics";
  if (node.includes("nexus")) return "nexus";
  if (node.includes("ledger")) return "ledger";
  if (node.includes("settlement")) return "settlement";
  if (node.includes("archiveos") || node.includes("archive-os")) return "archiveos";
  return node;
}

function tokenProgress(event: LiveFlowEvent, index: number) {
  const timestamp = Date.parse(event.occurred_at);
  if (Number.isNaN(timestamp)) return (index % 10) / 10;
  return ((Math.floor(timestamp / 1000) + index) % 10) / 10;
}
