import { useMemo, useState } from "react";
import type { AppData } from "../app/AppShell";
import { MetricCard } from "../components/shared/MetricCard";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { DataState } from "../components/shared/DataState";
import { LedgerApprovalsPage } from "./LedgerApprovalsPage";
import { ConsoleTabs, PageHeader } from "./ConsoleServicesPage";
import { useI18n } from "../i18n/I18nProvider";
import { consoleText } from "../i18n/console";

export function ConsoleFinancePage({ data, onRefresh }: { data: AppData; onRefresh: () => Promise<void> }) {
  const { locale } = useI18n();
  const [tab, setTab] = useState<"ecosystem" | "profit" | "approval" | "reconciliation">("ecosystem");
  return <div className="console-page finance-v4"><PageHeader title={consoleText(locale, "page.finance.title")} description={consoleText(locale, "page.finance.description")} /><ConsoleTabs value={tab} onChange={setTab} items={[["ecosystem", "생태계 재무"], ["profit", "서비스별 손익"], ["approval", "승인·정산"], ["reconciliation", "대사"]]} />
    {tab === "ecosystem" ? <EcosystemFinanceView data={data} /> : null}
    {tab === "profit" ? <ProfitView data={data} /> : null}
    {tab === "approval" ? <LedgerApprovalsPage data={data} onRefresh={onRefresh} /> : null}
    {tab === "reconciliation" ? <ReconciliationView data={data} /> : null}
  </div>;
}

function EcosystemFinanceView({ data }: { data: AppData }) {
  const rows = data.balance?.services ?? [];
  const totals = data.balance?.totals;
  const knownCash = rows.reduce<number | null>((total, row) => row.cashBalance == null ? total : (total ?? 0) + number(row.cashBalance), null);
  const partial = data.balance?.balanceStatus === "PARTIAL_DATA" || rows.some((row) => row.balance === "NO_DATA");
  const approvals = data.externalApprovals;
  const waitingSettlement = approvals.filter((approval) => ["PENDING", "CALLBACK_PENDING", "HOLD"].includes(approval.status)).length;
  return <div className="page-stack finance-ecosystem-view">
    <div className="finance-context-note"><strong>합성 데이터 기준</strong><span>실제 고객·결제·계좌·금융 데이터는 사용하지 않습니다. GMV는 매출과 이익 계산에 포함하지 않습니다.</span></div>
    <section className="kpi-command-grid finance-kpi-grid">
      <MetricCard label="인식 매출" value={amount(totals?.revenue)} hint="현재 수집된 서비스 기준" status={totals ? "healthy" : "empty"} />
      <MetricCard label="총 비용" value={amount(totals?.cost)} hint="현재 수집된 서비스 기준" status={totals ? "healthy" : "empty"} />
      <MetricCard label="영업이익" value={amount(totals?.profit)} hint="수익 - 비용" status={totals?.profit == null ? "empty" : number(totals.profit) >= 0 ? "healthy" : "warning"} />
      <MetricCard label="보유자금" value={knownCash == null ? "데이터 없음" : amount(knownCash)} hint="현금값을 제공한 서비스 합계" status={knownCash == null ? "empty" : "working"} />
      <MetricCard label="정산 대기" value={approvals.length ? waitingSettlement.toLocaleString() : "데이터 없음"} hint="승인·콜백 상태 기준" status={waitingSettlement > 0 ? "warning" : approvals.length ? "healthy" : "empty"} />
      <MetricCard label="균형 상태" value={balanceLabel(data.balance?.balanceStatus)} hint={data.balance?.reviewReason || "마지막 계산 기준"} status={partial ? "empty" : data.balance?.balanceStatus === "COMPLETE_BALANCED" ? "healthy" : "warning"} />
    </section>
    {partial ? <div className="finance-data-note"><strong>부분 수집 상태</strong><span>일부 서비스의 재무 Runtime Mesh가 아직 값을 제공하지 않습니다. 데이터 없음은 실제 0원이 아니며, 전체 균형을 확정하지 않습니다.</span></div> : null}
    <section className="finance-overview-grid">
      <SectionCard title="수집 범위" eyebrow="DATA AVAILABILITY"><div className="finance-availability-list">{rows.map((row) => <div key={row.serviceId}><strong>{row.serviceName}</strong><StatusBadge status={row.balance === "NO_DATA" ? "empty" : row.status}>{row.balance === "NO_DATA" ? "데이터 없음" : "수집됨"}</StatusBadge><span>{row.balanceReason || "계산 범위 정보 없음"}</span></div>)}{!rows.length ? <p className="empty-copy">재무 Runtime Mesh를 아직 수집하지 못했습니다.</p> : null}</div></SectionCard>
      <SectionCard title="최근 재무 스냅샷" eyebrow="READ ONLY"><FinanceSnapshot systems={data.gameFinance?.systems ?? {}} /></SectionCard>
    </section>
  </div>;
}

function ProfitView({ data }: { data: AppData }) { const rows = data.balance?.services ?? []; const noDataRows = rows.filter((row) => row.balance === "NO_DATA"); if (!rows.length) return <DataState kind={data.loading ? "loading" : Object.keys(data.errors).length ? "error" : "empty"} title={data.loading ? "손익 데이터를 수집하는 중입니다." : "서비스별 손익 데이터가 없습니다."} description={data.loading ? "각 서비스 Runtime Mesh의 재무 요약을 기다리고 있습니다." : "데이터 없음은 실제 0원이 아니며, 서비스별 재무 계약이 제공되면 표시됩니다."} />; return <section className="finance-table-card finance-profit-view"><header><div><span className="eyebrow">SYNTHETIC FINANCE / READ ONLY</span><h2>서비스별 손익과 균형</h2><p>수수료와 비용 구조를 변경하지 않는 읽기 전용 분석입니다.</p></div><span className={`finance-status finance-${data.balance?.balanceStatus?.toLowerCase()}`}>{balanceLabel(data.balance?.balanceStatus)}</span></header>{noDataRows.length ? <div className="finance-data-note"><strong>데이터 없음과 0의 구분</strong><span>{noDataRows.map((row) => row.serviceName).join(", ")}은 실제 0원이 아니라 수집되지 않은 상태입니다.</span></div> : null}<div className="table-scroll"><table><thead><tr><th>서비스</th><th>매출</th><th>비용</th><th>영업이익</th><th>이익률</th><th>목표 범위</th><th>상태</th></tr></thead><tbody>{rows.map((row) => <tr key={row.serviceId} className={row.balance === "NO_DATA" ? "no-data-row" : ""}><td><strong>{row.serviceName}</strong><small>{row.balanceReason || "계산 범위 정보 없음"}</small></td><td>{amount(row.revenue)}</td><td>{amount(row.cost)}</td><td>{amount(row.profit)}</td><td>{row.operatingMargin == null ? "데이터 없음" : `${row.operatingMargin}%`}</td><td>{row.balance === "NO_DATA" ? "데이터 없음" : `${row.targetMinMargin}% ~ ${row.targetMaxMargin}%`}</td><td><span className={`finance-cell-badge balance-${row.balance.toLowerCase()}`}>{rowLabel(row.balance)}</span></td></tr>)}</tbody></table></div><div className="finance-recommendation-grid">{data.balanceRecommendations?.recommendations.map((item) => <article className="recommendation-card" key={`${item.serviceId}-${item.title}`}><strong>{item.title}</strong><p>{item.reason}</p><small>{item.serviceId} · {item.mode}</small></article>)}{!data.balanceRecommendations?.recommendations.length ? <p className="empty-copy">현재 수집 범위에서 추가 권장 조치가 없습니다.</p> : null}</div></section>; }

function ReconciliationView({ data }: { data: AppData }) { const ledger = data.ecosystem?.services?.ledger?.summary ?? {}; const reconciliation = recordValue(ledger, ["reconciliation", "reconciliationSummary"]); const entries = reconciliation ? Object.entries(reconciliation).filter(([, value]) => typeof value !== "object").slice(0, 10) : []; return <section className="finance-table-card reconciliation-view"><header><div><span className="eyebrow">LEDGER RECONCILIATION</span><h2>대사 상태</h2><p>Ledger가 제공하는 합성 정산·대사 요약을 읽기 전용으로 표시합니다.</p></div><StatusBadge status={String(reconciliation?.status ?? reconciliation?.reconciliationStatus ?? "empty")}>{String(reconciliation?.status ?? reconciliation?.reconciliationStatus ?? "데이터 없음")}</StatusBadge></header>{entries.length ? <div className="reconciliation-metric-grid">{entries.map(([key, value]) => <span key={key}><small>{humanize(key)}</small><strong>{String(value)}</strong></span>)}</div> : <div className="empty-copy">대사 요약 연동이 준비되지 않았거나 수집된 데이터가 없습니다.</div>}</section>; }

function FinanceSnapshot({ systems }: { systems: Record<string, unknown> }) { const entries = Object.entries(systems); if (!entries.length) return <p className="empty-copy">저장된 재무 스냅샷이 없습니다. 데이터가 생성되면 읽기 전용으로 표시합니다.</p>; return <div className="finance-snapshot-list">{entries.slice(0, 6).map(([id, snapshot]) => { const value = snapshot as Record<string, unknown>; return <div key={id}><strong>{String(value.service_name ?? value.serviceName ?? id)}</strong><span>보유자금 {amount(value.cash_balance ?? value.cashBalance)}</span><small>최근 계산 {String(value.tick_id ?? value.tickId ?? "정보 없음")}</small></div>; })}</div>; }
function recordValue(source: Record<string, unknown>, paths: string[]) { for (const path of paths) { const value = source[path]; if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>; } return null; }
function number(value: string | number | null | undefined) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function amount(value: unknown) { if (value == null || value === "") return "데이터 없음"; const parsed = Number(value); return Number.isFinite(parsed) ? `${parsed.toLocaleString()} KRW` : String(value); }
function balanceLabel(value?: string) { if (value === "COMPLETE_BALANCED" || value === "BALANCED") return "균형"; if (value === "PARTIAL_DATA") return "부분 수집"; if (value === "NO_DATA" || !value) return "데이터 없음"; return "검토"; }
function rowLabel(value: string) { return value === "WITHIN_RANGE" ? "목표 범위" : value === "CONCENTRATED" ? "집중 검토" : value === "UNDER_PRESSURE" ? "손익 주의" : value === "NO_DATA" ? "데이터 없음" : value; }
function humanize(value: string) { return value.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim(); }
