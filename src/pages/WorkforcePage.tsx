import { useEffect, useState } from "react";
import type { AppData } from "../app/AppShell";
import { MetricCard } from "../components/shared/MetricCard";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { getWorkforceOverview, type WorkforceOverview, type WorkforceServiceSummary } from "../lib/backendApi";
import { formatTimeAgo, stringifyMeta } from "./pageUtils";

function money(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return String(value ?? "0");
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(numeric);
}

function percent(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return String(value ?? "0");
  return `${numeric.toFixed(numeric % 1 === 0 ? 0 : 1)}%`;
}

function capacityPercent(service: WorkforceServiceSummary) {
  const effective = Number(service.effectiveCapacity);
  const used = Number(service.usedCapacity);
  if (service.serviceId === "archive-nexus" && used === 0) return "시뮬레이터 정지";
  if (Number.isFinite(effective) && effective > 0 && Number.isFinite(used)) return percent((used / effective) * 100);
  return service.serviceId === "archive-nexus" ? "시뮬레이터 정지" : "기준 역량 없음";
}

function productivityLabel(service: WorkforceServiceSummary) {
  return service.serviceId === "archive-nexus" && Number(service.usedCapacity) === 0
    ? "시뮬레이터 정지"
    : percent(service.productivityScore);
}

function modeLabel(value: string) {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("propos")) return "제안 전용";
  if (normalized.includes("read")) return "읽기 전용";
  if (normalized.includes("safe")) return "안전 모드";
  return value ? value.replace(/_/g, " ") : "운영 모드 미수집";
}

function externalWriteLabel(value: string) {
  const normalized = String(value || "").toLowerCase();
  if (["false", "blocked", "disabled", "denied", "none", "없음"].some((token) => normalized.includes(token))) return "외부 쓰기 차단";
  if (["true", "enabled", "allowed"].some((token) => normalized.includes(token))) return "외부 쓰기 허용";
  return value ? value.replace(/_/g, " ") : "외부 쓰기 상태 미수집";
}

function roleLabel(value: string | null | undefined) {
  const normalized = String(value || "").toLowerCase().replace(/-/g, "_");
  return ({ order_review: "주문 검토", production_operator: "생산 운영", quality_inspector: "품질 검사", maintenance_technician: "정비", delivery_driver: "배송 운영", route_planner: "경로 계획", approval_reviewer: "승인 검토", transaction_processor: "거래 처리", settlement_operator: "정산 운영" } as Record<string, string>)[normalized] || (value ? value.replace(/[_-]/g, " ") : "병목 역할 미수집");
}

function recommendationSeverityLabel(value: string) {
  return ({ low: "낮음", medium: "보통", high: "높음", critical: "매우 높음", warning: "주의" } as Record<string, string>)[String(value || "").toLowerCase()] || value;
}

function localizeRecommendation(value: string) {
  return value.replace(/APPROVAL_REVIEWER/g, "승인 검토").replace(/TRANSACTION_PROCESSOR/g, "거래 처리").replace(/PRODUCTION_OPERATOR/g, "생산 운영").replace(/DELIVERY_DRIVER/g, "배송 운영");
}

function statusLabel(value: string) { return value === "HEALTHY" ? "정상" : value === "DEGRADED" ? "부분 수집" : value === "UNAVAILABLE" ? "연결 안 됨" : value; }

function statusTone(service: WorkforceServiceSummary) {
  if (service.status === "UNAVAILABLE") return "critical";
  if (service.status === "DEGRADED" || service.capacityShortage) return "degraded";
  if (service.backlog > 0) return "warning";
  return "healthy";
}

export function WorkforcePage({ data }: { data: AppData }) {
  const [fallbackWorkforce, setFallbackWorkforce] = useState<WorkforceOverview | null>(null);
  const [fallbackError, setFallbackError] = useState<string | null>(null);

  useEffect(() => {
    if (data.workforce) {
      setFallbackWorkforce(null);
      setFallbackError(null);
      return;
    }

    let cancelled = false;
    getWorkforceOverview()
      .then((overview) => {
        if (!cancelled) {
          setFallbackWorkforce(overview);
          setFallbackError(null);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) setFallbackError(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, [data.workforce]);

  const workforce = data.workforce ?? fallbackWorkforce;
  if (!workforce) {
    return (
      <div className="empty-state">
        작업 역량 현황을 불러오지 못했습니다. archiveos-ai workforce API 상태를 확인하세요.
        {fallbackError ? <span className="small-note">{fallbackError}</span> : null}
      </div>
    );
  }

  const summary = workforce.summary;
  return (
    <div className="page-stack workforce-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">작업 역량 관제 · 합성 데이터 전용</span>
          <h2>작업 역량 현황</h2>
          <p>
            Market, Nexus, Logistics, Ledger의 작업 인원, 처리 역량, 생산성, 현금흐름 요약을 읽어 병목을 확인합니다.
            실제 직원, 급여, 개인정보는 사용하지 않습니다.
          </p>
        </div>
      </header>

      <p className="small-note">{workforce.dataPolicy} 생성 시각: {formatTimeAgo(workforce.generatedAt)}.</p>

      <section className="kpi-command-grid">
        <MetricCard label="총 인원" value={summary.totalHeadcount} status="healthy" description="합성 작업 인력 기준" />
        <MetricCard label="평균 생산성" value={percent(summary.averageProductivity)} status={Number(summary.averageProductivity) >= 80 ? "healthy" : "warning"} description="서비스 통합 점수" />
        <MetricCard label="가장 큰 병목" value={roleLabel(summary.largestBottleneck)} status={summary.totalBacklog > 0 ? "warning" : "healthy"} description={summary.largestBottleneckService} />
        <MetricCard label="전체 적체" value={summary.totalBacklog} status={summary.totalBacklog > 0 ? "blocked" : "healthy"} description="처리 대기 중인 합성 작업" />
        <MetricCard label="인건비성 비용" value={money(summary.payrollBurn)} status={Number(summary.payrollBurn) > 0 ? "working" : "idle"} description="합성 비용 요약" />
        <MetricCard label="권장 조치" value={localizeRecommendation(summary.recommendedAction)} status={summary.totalBacklog > 0 ? "warning" : "healthy"} description="제안 전용" />
      </section>

      <section className="overview-layout">
        <SectionCard title="서비스별 작업 역량" eyebrow="처리 역량 / 적체 / 생산성" className="span-7">
          <div className="history-table">
            {workforce.services.map((service) => (
              <article className="history-row" key={service.serviceId}>
                <summary>
                  <strong>{service.serviceName}</strong>
                  <StatusBadge status={statusTone(service)}>{statusLabel(service.status)}</StatusBadge>
                  <span>{roleLabel(service.bottleneckRole)}</span>
                  <p>적체 {service.backlog}건 · 사용 역량 {service.usedCapacity}/{service.effectiveCapacity} ({capacityPercent(service)}) · 생산성 {productivityLabel(service)}</p>
                </summary>
                <div className="detail-grid">
                  <span>인원<strong>{service.headcount}</strong></span>
                  <span>유효 처리 역량<strong>{String(service.effectiveCapacity)}</strong></span>
                  <span>사용한 처리 역량<strong>{String(service.usedCapacity)}</strong></span>
                  <span>역량 사용률<strong>{capacityPercent(service)}</strong></span>
                  <span>적체<strong>{service.backlog}</strong></span>
                  <span>인건비성 비용<strong>{money(service.payrollCost)}</strong></span>
                  <span>생산성<strong>{productivityLabel(service)}</strong></span>
                </div>
                <details><summary>수집 상태</summary><pre>{stringifyMeta(service.source)}</pre></details>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="에이전트 제안" eyebrow="제안 전용 · 안전 모드 유지" className="span-5">
          <div className="event-list compact">
            {workforce.recommendations.map((item) => (
              <article className="event-row" key={item.serviceId}>
                <span>{item.serviceName}</span>
                <StatusBadge status={item.severity}>{recommendationSeverityLabel(item.severity)}</StatusBadge>
                <strong>{item.title}</strong>
                <p>{item.reason}</p>
                <small>{modeLabel(item.mode)} · {externalWriteLabel(item.externalWrite)}</small>
              </article>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
