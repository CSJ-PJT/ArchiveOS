import { useState } from "react";
import type { AppData } from "../app/AppShell";
import { MetricCard } from "../components/shared/MetricCard";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { simulateSettlementAgencyGame, type SettlementAgencyGameSummary } from "../lib/backendApi";
import { formatTimeAgo, stringifyMeta } from "./pageUtils";

function money(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return String(value ?? "0");
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(numeric);
}

function riskStatus(value: string | null | undefined) {
  const risk = (value || "").toUpperCase();
  if (risk === "LOW") return "healthy";
  if (risk === "WARNING") return "warning";
  if (risk === "CRITICAL") return "critical";
  return "waiting";
}

export function SettlementGamePage({ data, onRefresh }: { data: AppData; onRefresh: () => Promise<void> }) {
  const [game, setGame] = useState<SettlementAgencyGameSummary | null>(data.settlementGame);
  const [message, setMessage] = useState<string | null>(null);
  const snapshot = game ?? data.settlementGame;

  async function runDrySimulation(stress = false) {
    setMessage(null);
    try {
      const payload = stress
        ? {
            simulationRunId: "SIM-RUN-STRESS-001",
            settlementCycleId: "CYCLE-STRESS-001",
            tickId: "TICK-STRESS-001",
            day: 7,
            nexusInitialCash: 1200000,
            logisticsInitialCash: 800000,
            ledgerInitialCash: 900000,
            nexusProductionRevenue: 2200000,
            nexusMaterialCost: 3600000,
            nexusMaintenanceCost: 2400000,
            nexusQualityLossCost: 1700000,
            logisticsServiceFee: 500000,
            logisticsDailySettlementFee: 80000,
            transactionCount: 360,
            approvalReviewCount: 18,
            exceptionCount: 12,
            callbackFailureCount: 9,
            mismatchCount: 5,
            ledgerInfraFixedCost: 2600000,
            maxHop: 4,
          }
        : {};
      const result = await simulateSettlementAgencyGame(payload, true);
      setGame(result);
      setMessage(`${stress ? "Stress" : "Default"} dry-run complete - ${result.status} - ${result.bankruptcyRisk}`);
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Settlement simulation failed.");
    }
  }

  if (!snapshot) {
    return <div className="empty-state">Settlement game simulation is unavailable. Check archiveos-ai game endpoints.</div>;
  }

  const services = Object.entries(snapshot.services || {});
  const proposals = snapshot.proposals || [];
  const events = snapshot.events || [];

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">GAME / SIMULATION - Synthetic Data only</span>
          <h2>ArchiveOS - Ecosystem Survival Mode</h2>
          <p>
            Monitors the synthetic settlement loop where Nexus manufactures, Logistics fulfills delivery, Ledger performs
            daily settlement, Logistics receives settlement, and Logistics charges Nexus for manufacturing-linked service cost.
            All intervention remains gated by safe-mode and approval.
          </p>
        </div>
        <div className="inline-actions">
          <button className="button button-secondary" type="button" onClick={() => void runDrySimulation(false)}>Default dry-run</button>
          <button className="button button-primary" type="button" onClick={() => void runDrySimulation(true)}>Bankruptcy stress</button>
        </div>
      </header>

      {message ? <p className="small-note">{message}</p> : null}
      <p className="small-note">
        Source: {snapshot.simulationSource} - Namespace: {snapshot.gameNamespace} - Safe-mode: {String(snapshot.safeMode)} - External write: {String(snapshot.allowExternalWrite)}
        {snapshot.ledgerSimulationError ? ` - Ledger fallback reason: ${snapshot.ledgerSimulationError}` : ""}
      </p>

      <section className="kpi-command-grid">
        <MetricCard label="Ecosystem cash" value={money(snapshot.ecosystemCashBalance)} status={riskStatus(snapshot.bankruptcyRisk)} description={`Run ${snapshot.simulationRunId}`} />
        <MetricCard label="Daily profit" value={money(snapshot.ecosystemDailyProfit)} status={Number(snapshot.ecosystemDailyProfit) >= 0 ? "healthy" : "warning"} description={`Cycle ${snapshot.settlementCycleId}`} />
        <MetricCard label="Bankruptcy risk" value={snapshot.bankruptcyRisk} status={riskStatus(snapshot.bankruptcyRisk)} description={snapshot.writePolicy} />
        <MetricCard label="Agent proposals" value={proposals.length} status={proposals.length ? "waiting" : "healthy"} description="Proposal-only, approval required" />
      </section>

      <section className="overview-layout">
        <SectionCard title="Settlement Operating Flow" eyebrow="Nexus -> Logistics -> Ledger -> Logistics -> Nexus" className="span-12">
          <div className="command-flow settlement-flow">
            <FlowStage index={1} title="Nexus manufactures" status="working" summary="production revenue, material cost, maintenance cost" />
            <FlowStage index={2} title="Logistics fulfills" status="working" summary="route, ETA, delivery cost, delay risk" />
            <FlowStage index={3} title="Ledger settles daily" status="waiting" summary="ledger entries, settlement, reconciliation" />
            <FlowStage index={4} title="Logistics receives" status="healthy" summary="settlement agency result and service fee" />
            <FlowStage index={5} title="Nexus is charged" status="warning" summary="manufacturing-linked logistics settlement cost" terminal />
          </div>
        </SectionCard>

        <SectionCard title="Service P&L Board" eyebrow="Cash balance / burn rate / bankruptcy risk" className="span-7">
          <div className="history-table">
            {services.map(([key, service]) => (
              <article className="history-row" key={key}>
                <summary>
                  <strong>{service.service}</strong>
                  <StatusBadge status={riskStatus(service.bankruptcyRisk)}>{service.bankruptcyRisk}</StatusBadge>
                  <span>{service.explanation}</span>
                </summary>
                <div className="detail-grid">
                  <span>Cash before<strong>{money(service.cashBefore)}</strong></span>
                  <span>Revenue<strong>{money(service.revenue)}</strong></span>
                  <span>Cost<strong>{money(service.cost)}</strong></span>
                  <span>Profit<strong>{money(service.profit)}</strong></span>
                  <span>Cash after<strong>{money(service.cashAfter)}</strong></span>
                  <span>Burn rate<strong>{money(service.burnRate)}</strong></span>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Game Guard Rails" eyebrow="No infinite loop / no direct write" className="span-5">
          <div className="event-list compact">
            <article className="event-row">
              <span>metadata</span>
              <strong>{snapshot.simulationRunId} / {snapshot.tickId}</strong>
              <p>Each event includes simulationRunId, settlementCycleId, tickId, day, correlationId, hop, and maxHop.</p>
            </article>
            <article className="event-row">
              <span>idempotency</span>
              <strong>{String(snapshot.processedEventGuard?.infiniteLoopGuard ?? "processed event guard enabled")}</strong>
              <details><summary>guard detail</summary><pre>{stringifyMeta(snapshot.processedEventGuard)}</pre></details>
            </article>
            <article className="event-row">
              <span>agent mode</span>
              <strong>{snapshot.agentMode}</strong>
              <p>Each project agent makes proposals only. PM/Admin approval is required before any real write.</p>
            </article>
          </div>
        </SectionCard>

        <SectionCard title="Service Agent Proposals" eyebrow="PM decision candidates" className="span-7">
          <div className="history-table">
            {proposals.map((proposal) => (
              <article className="history-row" key={proposal.proposalId}>
                <summary>
                  <strong>{proposal.agentName}</strong>
                  <StatusBadge status={proposal.approvalRequired ? "waiting" : "healthy"}>{proposal.actionType}</StatusBadge>
                  <span>{proposal.summary}</span>
                </summary>
                <div className="detail-grid">
                  <span>Target<strong>{proposal.targetService}</strong></span>
                  <span>Expected cash impact<strong>{money(proposal.expectedCashImpact)}</strong></span>
                  <span>Confidence<strong>{Math.round((proposal.confidence || 0) * 100)}%</strong></span>
                  <span>Safe-mode<strong>{String(proposal.safeModeRequired)}</strong></span>
                </div>
                <details><summary>evidence</summary><pre>{stringifyMeta(proposal.evidence)}</pre></details>
              </article>
            ))}
            {!proposals.length ? <div className="empty-state">No bankruptcy prevention proposal is required for this tick.</div> : null}
          </div>
        </SectionCard>

        <SectionCard title="Synthetic Game Events" eyebrow="simulationRunId / tickId / maxHop" className="span-5">
          <div className="event-list compact">
            {events.map((event) => (
              <article className="event-row" key={event.eventId}>
                <span>{event.source} to {event.target}</span>
                <StatusBadge status={event.hop <= event.maxHop ? "success" : "blocked"}>hop {event.hop}/{event.maxHop}</StatusBadge>
                <strong>{event.eventType}</strong>
                <p>{event.idempotencyKey}</p>
                <details><summary>payload</summary><pre>{stringifyMeta(event.payload)}</pre></details>
              </article>
            ))}
          </div>
        </SectionCard>
      </section>

      <p className="small-note">
        Last tick created {snapshot.createdAt ? formatTimeAgo(snapshot.createdAt) : "unknown"}.
        All values are Synthetic Data / Demo Data and must not be treated as real finance, user, map, shipment, or delivery data.
      </p>
    </div>
  );
}

function FlowStage({ index, title, status, summary, terminal = false }: { index: number; title: string; status: string; summary: string; terminal?: boolean }) {
  return (
    <div className={`runtime-stage runtime-${status}`}>
      <span className="stage-index">{index}</span>
      <div><strong>{title}</strong><StatusBadge status={status}>{status}</StatusBadge><small>{summary}</small></div>
      {!terminal ? <i aria-hidden="true" /> : null}
    </div>
  );
}
