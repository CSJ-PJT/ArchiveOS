import { useCallback, useEffect, useState } from "react";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { getSpringBatchExecution, getSpringBatchExecutions, getSpringBatchJobs, runSpringBatchJob, type SpringBatchExecution, type SpringBatchJob } from "../lib/backendApi";
import { formatTimeAgo } from "./pageUtils";
import type { PlatformRole } from "../lib/backendApi";

export function BatchPage({ role }: { role: PlatformRole }) {
  const [jobs, setJobs] = useState<SpringBatchJob[]>([]);
  const [executions, setExecutions] = useState<SpringBatchExecution[]>([]);
  const [selected, setSelected] = useState<SpringBatchExecution | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [nextJobs, nextExecutions] = await Promise.all([getSpringBatchJobs(), getSpringBatchExecutions(30)]);
      setJobs(nextJobs); setExecutions(nextExecutions);
      if (!selected && nextExecutions[0]) setSelected(nextExecutions[0]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }, [selected]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function run(name: string) {
    setBusy(name);
    try { const result = await runSpringBatchJob(name); setSelected(await getSpringBatchExecution(result.id)); await refresh(); }
    finally { setBusy(null); }
  }

  async function inspect(item: SpringBatchExecution) { setSelected(await getSpringBatchExecution(item.id)); }

  return (
    <div className="page-stack">
      <header className="page-heading"><div><span className="eyebrow">공개 자동화 상태</span><h2>자동화·배치 현황</h2><p>작업 목록과 실행 이력은 외부에서도 조회할 수 있으며, 실행과 설정 변경은 관리자에게만 허용됩니다.</p></div><button className="button button-secondary" type="button" onClick={refresh}>새로고침</button></header>
      {error ? <div className="empty-state error-state">Batch 서비스에 연결할 수 없습니다. {error}</div> : null}
      <section className="batch-job-grid">
        {jobs.map((job) => (
          <article className="batch-job-card" key={job.name}>
            <div className="batch-job-header"><div><strong>{job.name}</strong><p>{job.description}</p></div><StatusBadge status={job.manualRunAllowed ? "healthy" : "waiting"}>{job.manualRunAllowed ? "관리자 실행 가능" : "자동 전용"}</StatusBadge></div>
            <div className="batch-job-meta"><span>최근 실행 {job.recentExecutions.length}건</span><span>{job.launchable ? "관리자 수동 실행" : "조회 전용"}</span></div>
            <button className="button button-primary" type="button" disabled={!job.manualRunAllowed || busy === job.name || role !== "ADMIN"} onClick={() => run(job.name)}>{busy === job.name ? "실행 중…" : role === "ADMIN" ? "작업 실행" : "공개 조회 전용"}</button>
          </article>
        ))}
        {!jobs.length && !error ? <div className="empty-state">Spring Batch 카탈로그를 불러오는 중입니다.</div> : null}
      </section>
      <section className="workflows-layout">
        <SectionCard title="실행 이력" eyebrow="최신순">
          <div className="execution-list">{executions.map((item) => <button className={`execution-row ${selected?.id === item.id ? "selected" : ""}`} key={item.id} type="button" onClick={() => inspect(item)}><div><strong>{item.jobName || `실행 ${item.id}`}</strong><span>{formatTimeAgo(item.startTime || item.createTime)}</span></div><StatusBadge status={item.status}>{batchStatusLabel(item.status)}</StatusBadge></button>)}</div>
        </SectionCard>
        <SectionCard title="실행 상세" eyebrow="단계별 처리 결과">
          {selected ? <ExecutionDetail execution={selected} /> : <div className="empty-state">실행 항목을 선택하면 기록을 확인할 수 있습니다.</div>}
        </SectionCard>
      </section>
    </div>
  );
}

function ExecutionDetail({ execution }: { execution: SpringBatchExecution }) {
  return <div className="detail-stack"><div className="detail-title"><div><h3>{execution.jobName || "배치 실행"}</h3><span>실행 #{execution.id}</span></div><StatusBadge status={execution.status}>{batchStatusLabel(execution.status)}</StatusBadge></div><div className="detail-grid"><span>종료 코드<strong>{execution.exitCode}</strong></span><span>시작<strong>{formatTimeAgo(execution.startTime)}</strong></span><span>완료<strong>{formatTimeAgo(execution.endTime)}</strong></span></div><details className="details-box" open><summary>단계별 실행 기록</summary><div className="step-list">{(execution.steps || []).map((step) => <div className="step-row" key={step.stepName}><strong>{step.stepName}</strong><StatusBadge status={step.status}>{batchStatusLabel(step.status)}</StatusBadge><span>읽기 {step.readCount} · 쓰기 {step.writeCount} · 롤백 {step.rollbackCount}</span></div>)}</div></details></div>;
}

function batchStatusLabel(value: string) {
  return ({ COMPLETED: "완료", STARTED: "실행 중", STARTING: "시작 중", FAILED: "실패", STOPPED: "중지", STOPPING: "중지 중", ABANDONED: "폐기", UNKNOWN: "확인 중" } as Record<string, string>)[value.toUpperCase()] ?? value;
}
