import { useState } from "react";
import type { AppData } from "../app/AppShell";
import { LedgerApprovalsPage } from "./LedgerApprovalsPage";
import { SettlementGamePage } from "./SettlementGamePage";
import { ConsoleTabs, PageHeader } from "./ConsoleServicesPage";
import { useI18n } from "../i18n/I18nProvider";
import { consoleText } from "../i18n/console";

export function ConsoleFinancePage({ data, onRefresh }: { data: AppData; onRefresh: () => Promise<void> }) {
  const { locale } = useI18n();
  const [tab, setTab] = useState<"ecosystem" | "profit" | "approval" | "reconciliation">("ecosystem");
  return <div className="console-page"><PageHeader title={consoleText(locale, "page.finance.title")} description={consoleText(locale, "page.finance.description")} /><ConsoleTabs value={tab} onChange={setTab} items={[["ecosystem", "생태계 재무"], ["profit", "서비스별 손익"], ["approval", "승인·정산"], ["reconciliation", "대사"]]} />
    {tab === "ecosystem" ? <SettlementGamePage data={data} onRefresh={onRefresh} /> : null}
    {tab === "profit" ? <ProfitView data={data} /> : null}
    {tab === "approval" ? <LedgerApprovalsPage data={data} onRefresh={onRefresh} /> : null}
    {tab === "reconciliation" ? <ReconciliationView data={data} /> : null}
  </div>;
}
function ProfitView({ data }: { data: AppData }) { const rows = data.balance?.services ?? []; return <section className="finance-table-card"><h2>서비스별 손익과 균형</h2><p>수수료·비용 구조를 바꾸지 않는 read-only 분석입니다.</p><div className="table-scroll"><table><thead><tr><th>서비스</th><th>매출</th><th>비용</th><th>영업이익</th><th>이익률</th><th>판정</th></tr></thead><tbody>{rows.map((row) => <tr key={row.serviceId}><td>{row.serviceName}</td><td>{amount(row.revenue)}</td><td>{amount(row.cost)}</td><td>{amount(row.profit)}</td><td>{row.operatingMargin}%</td><td>{row.balance === "WITHIN_RANGE" ? "균형 범위" : row.balance === "CONCENTRATED" ? "집중 검토" : "주의"}</td></tr>)}</tbody></table></div>{data.balanceRecommendations?.recommendations.map((item) => <article className="recommendation-card" key={`${item.serviceId}-${item.title}`}><strong>{item.title}</strong><p>{item.reason}</p></article>)}</section>; }
function ReconciliationView({ data }: { data: AppData }) { const ledger = data.ecosystem?.services?.ledger?.summary ?? {}; const reconciliation = (ledger.reconciliation ?? ledger.reconciliationSummary) as Record<string, unknown> | undefined; return <section className="finance-table-card"><h2>대사 상태</h2><p>Ledger가 제공하는 합성 정산·대사 요약을 표시합니다.</p>{reconciliation && Object.keys(reconciliation).length ? <pre>{JSON.stringify(reconciliation, null, 2)}</pre> : <div className="empty-copy">대사 요약 연동이 준비되지 않았거나 수집된 데이터가 없습니다.</div>}</section>; }
function amount(value: string | number) { const number = Number(value); return Number.isFinite(number) ? `${number.toLocaleString()} KRW` : String(value); }
