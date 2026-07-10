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
  const persistedFinance = data.gameFinance;

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
      setMessage(`${stress ? "스트레스" : "기본"} dry-run 완료 - ${result.status} - ${result.bankruptcyRisk}`);
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "에코시스템 재무 흐름 확인에 실패했습니다.");
    }
  }

  if (!snapshot) {
    return <div className="empty-state">에코시스템 재무 흐름을 불러오지 못했습니다. archiveos-ai 정산 API 상태를 확인하세요.</div>;
  }

  const services = Object.entries(snapshot.services || {});
  const proposals = snapshot.proposals || [];
  const events = snapshot.events || [];

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">에코시스템 재무 - Synthetic Data 전용</span>
          <h2>에코시스템 재무 흐름</h2>
          <p>
            Nexus의 제조, Logistics의 배송과 일정산 수신, Ledger의 정산·대사, Logistics의 제조 연계 비용 청구 흐름을 관제합니다.
            모든 실행성 조치는 safe-mode와 승인 절차를 기준으로 통제합니다.
          </p>
        </div>
        <div className="inline-actions">
          <button className="button button-secondary" type="button" onClick={() => void runDrySimulation(false)}>기본 dry-run</button>
          <button className="button button-primary" type="button" onClick={() => void runDrySimulation(true)}>위험 상황 확인</button>
        </div>
      </header>

      {message ? <p className="small-note">{message}</p> : null}
      <p className="small-note">
        소스: {snapshot.simulationSource} - 네임스페이스: {snapshot.gameNamespace} - Safe-mode: {String(snapshot.safeMode)} - 외부 write: {String(snapshot.allowExternalWrite)}
        {snapshot.ledgerSimulationError ? ` - Ledger 대체 처리 사유: ${snapshot.ledgerSimulationError}` : ""}
      </p>

      <section className="kpi-command-grid">
        <MetricCard label="전체 보유자금" value={money(snapshot.ecosystemCashBalance)} status={riskStatus(snapshot.bankruptcyRisk)} description={`Run ${snapshot.simulationRunId}`} />
        <MetricCard label="일일 손익" value={money(snapshot.ecosystemDailyProfit)} status={Number(snapshot.ecosystemDailyProfit) >= 0 ? "healthy" : "warning"} description={`Cycle ${snapshot.settlementCycleId}`} />
        <MetricCard label="재무 위험" value={snapshot.bankruptcyRisk} status={riskStatus(snapshot.bankruptcyRisk)} description={snapshot.writePolicy} />
        <MetricCard label="에이전트 제안" value={proposals.length} status={proposals.length ? "waiting" : "healthy"} description="제안 전용, 승인 필요" />
      </section>

      <section className="overview-layout">
        <SectionCard title="정산 운영 흐름" eyebrow="Nexus -> Logistics -> Ledger -> Logistics -> Nexus" className="span-12">
          <div className="command-flow settlement-flow">
            <FlowStage index={1} title="Nexus 제조" status="working" summary="생산 매출, 원자재 비용, 정비 비용" />
            <FlowStage index={2} title="Logistics 배송 처리" status="working" summary="경로, ETA, 배송비, 지연 위험" />
            <FlowStage index={3} title="Ledger 일일 정산" status="waiting" summary="원장, 정산, 대사" />
            <FlowStage index={4} title="Logistics 정산 수신" status="healthy" summary="정산 결과와 서비스 수수료" />
            <FlowStage index={5} title="Nexus 비용 반영" status="warning" summary="제조 연계 물류 정산 비용" terminal />
          </div>
        </SectionCard>

        <SectionCard title="서비스별 손익" eyebrow="보유자금 / 비용 소진 / 재무 위험" className="span-7">
          <div className="history-table">
            {services.map(([key, service]) => (
              <article className="history-row" key={key}>
                <summary>
                  <strong>{service.service}</strong>
                  <StatusBadge status={riskStatus(service.bankruptcyRisk)}>{service.bankruptcyRisk}</StatusBadge>
                  <span>{service.explanation}</span>
                </summary>
                <div className="detail-grid">
                  <span>이전 보유자금<strong>{money(service.cashBefore)}</strong></span>
                  <span>수익<strong>{money(service.revenue)}</strong></span>
                  <span>비용<strong>{money(service.cost)}</strong></span>
                  <span>손익<strong>{money(service.profit)}</strong></span>
                  <span>현재 보유자금<strong>{money(service.cashAfter)}</strong></span>
                  <span>비용 소진<strong>{money(service.burnRate)}</strong></span>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="저장된 시스템 재무" eyebrow="DB 기준 보유자금 / 수출 / 수입" className="span-5">
          <div className="history-table">
            {Object.entries(persistedFinance?.systems || {}).map(([systemId, finance]) => (
              <article className="history-row" key={systemId}>
                <summary>
                  <strong>{finance.service_name}</strong>
                  <StatusBadge status={riskStatus(finance.bankruptcy_risk)}>{finance.bankruptcy_risk}</StatusBadge>
                  <span>보유자금 {money(finance.cash_balance)}</span>
                </summary>
                <div className="detail-grid">
                  <span>수익<strong>{money(finance.revenue_amount)}</strong></span>
                  <span>비용<strong>{money(finance.cost_amount)}</strong></span>
                  <span>손익<strong>{money(finance.profit_amount)}</strong></span>
                  <span>Tick<strong>{finance.tick_id}</strong></span>
                </div>
                <TradeList title="수출" trades={finance.exports || []} />
                <TradeList title="수입" trades={finance.imports || []} />
              </article>
            ))}
            {!Object.keys(persistedFinance?.systems || {}).length ? <div className="empty-state">Dry-run을 실행하면 시스템 재무 스냅샷과 거래 원장이 저장됩니다.</div> : null}
          </div>
        </SectionCard>

        <SectionCard title="재무 안전장치" eyebrow="무한 루프 방지 / 직접 write 차단" className="span-5">
          <div className="event-list compact">
            <article className="event-row">
              <span>메타데이터</span>
              <strong>{snapshot.simulationRunId} / {snapshot.tickId}</strong>
              <p>각 이벤트에는 simulationRunId, settlementCycleId, tickId, day, correlationId, hop, maxHop이 포함됩니다.</p>
            </article>
            <article className="event-row">
              <span>중복 방지</span>
              <strong>{String(snapshot.processedEventGuard?.infiniteLoopGuard ?? "processed event guard enabled")}</strong>
              <details><summary>guard 상세</summary><pre>{stringifyMeta(snapshot.processedEventGuard)}</pre></details>
            </article>
            <article className="event-row">
              <span>에이전트 모드</span>
              <strong>{snapshot.agentMode}</strong>
              <p>각 프로젝트 에이전트는 제안만 생성합니다. 실제 write 전에는 PM/Admin 승인이 필요합니다.</p>
            </article>
          </div>
        </SectionCard>

        <SectionCard title="서비스 에이전트 제안" eyebrow="PM 결정 후보" className="span-7">
          <div className="history-table">
            {proposals.map((proposal) => (
              <article className="history-row" key={proposal.proposalId}>
                <summary>
                  <strong>{proposal.agentName}</strong>
                  <StatusBadge status={proposal.approvalRequired ? "waiting" : "healthy"}>{proposal.actionType}</StatusBadge>
                  <span>{proposal.summary}</span>
                </summary>
                <div className="detail-grid">
                  <span>대상<strong>{proposal.targetService}</strong></span>
                  <span>예상 현금 영향<strong>{money(proposal.expectedCashImpact)}</strong></span>
                  <span>신뢰도<strong>{Math.round((proposal.confidence || 0) * 100)}%</strong></span>
                  <span>Safe-mode<strong>{String(proposal.safeModeRequired)}</strong></span>
                </div>
                <details><summary>근거</summary><pre>{stringifyMeta(proposal.evidence)}</pre></details>
              </article>
            ))}
            {!proposals.length ? <div className="empty-state">이번 tick에는 추가 재무 개입 제안이 필요하지 않습니다.</div> : null}
          </div>
        </SectionCard>

        <SectionCard title="Synthetic 정산 이벤트" eyebrow="simulationRunId / tickId / maxHop" className="span-5">
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
        모든 값은 Synthetic Data / Demo Data이며 실제 금융, 사용자, 지도, 출하, 배송 데이터로 취급하면 안 됩니다.
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

function TradeList({ title, trades }: { title: string; trades: Array<{ trade_id: string; trade_type: string; amount: number | string; currency: string; description: string }> }) {
  return (
    <details className="details-box">
      <summary>{title} ({trades.length})</summary>
      <div className="compact-ledger-list">
        {trades.slice(0, 5).map((trade) => (
          <div key={trade.trade_id}>
            <strong>{trade.trade_type}</strong>
            <span>{money(trade.amount)} {trade.currency}</span>
            <p>{trade.description}</p>
          </div>
        ))}
        {!trades.length ? <p>No {title.toLowerCase()} recorded yet.</p> : null}
      </div>
    </details>
  );
}
