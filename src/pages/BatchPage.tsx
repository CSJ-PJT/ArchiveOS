import { useCallback, useEffect, useState } from "react";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { getSpringBatchExecution, getSpringBatchExecutions, getSpringBatchJobs, runSpringBatchJob, type SpringBatchExecution, type SpringBatchJob } from "../lib/backendApi";
import { formatTimeAgo, stringifyMeta } from "./pageUtils";
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
      <header className="page-heading"><div><span className="eyebrow">SPRING BATCH OPERATIONS</span><h2>배치 작업</h2><p>Job 실행 상태와 step 단위 기록을 확인하고 허용된 작업만 수동 실행합니다.</p></div><button className="button button-secondary" type="button" onClick={refresh}>새로고침</button></header>
      {error ? <div className="empty-state error-state">Batch 서비스에 연결할 수 없습니다. {error}</div> : null}
      <section className="batch-job-grid">
        {jobs.map((job) => (
          <article className="batch-job-card" key={job.name}>
            <div className="batch-job-header"><div><strong>{job.name}</strong><p>{job.description}</p></div><StatusBadge status={job.manualRunAllowed ? "healthy" : "waiting"}>{job.manualRunAllowed ? "실행 가능" : "전용 흐름"}</StatusBadge></div>
            <div className="batch-job-meta"><span>최근 실행 {job.recentExecutions.length}건</span><span>{job.launchable ? "실행 가능" : "조회 전용"}</span></div>
            <button className="button button-primary" type="button" disabled={!job.manualRunAllowed || busy === job.name || role !== "ADMIN"} onClick={() => run(job.name)}>{busy === job.name ? "실행 중…" : role === "ADMIN" ? "작업 실행" : "관리자 권한 필요"}</button>
          </article>
        ))}
        {!jobs.length && !error ? <div className="empty-state">Spring Batch 카탈로그를 불러오는 중입니다.</div> : null}
      </section>
      <section className="workflows-layout">
        <SectionCard title="실행 이력" eyebrow="최신순">
          <div className="execution-list">{executions.map((item) => <button className={`execution-row ${selected?.id === item.id ? "selected" : ""}`} key={item.id} type="button" onClick={() => inspect(item)}><div><strong>{item.jobName || `Execution ${item.id}`}</strong><span>{formatTimeAgo(item.startTime || item.createTime)}</span></div><StatusBadge status={item.status}>{item.status}</StatusBadge></button>)}</div>
        </SectionCard>
        <SectionCard title="실행 상세" eyebrow="Step 및 실행 기록">
          {selected ? <ExecutionDetail execution={selected} /> : <div className="empty-state">실행 항목을 선택하면 기록을 확인할 수 있습니다.</div>}
        </SectionCard>
      </section>
    </div>
  );
}

function ExecutionDetail({ execution }: { execution: SpringBatchExecution }) {
  return <div className="detail-stack"><div className="detail-title"><div><h3>{execution.jobName || "Batch execution"}</h3><span>Execution #{execution.id}</span></div><StatusBadge status={execution.status}>{execution.status}</StatusBadge></div><div className="detail-grid"><span>Exit code<strong>{execution.exitCode}</strong></span><span>Started<strong>{formatTimeAgo(execution.startTime)}</strong></span><span>Finished<strong>{formatTimeAgo(execution.endTime)}</strong></span></div><details className="details-box" open><summary>Step executions</summary><div className="step-list">{(execution.steps || []).map((step) => <div className="step-row" key={step.stepName}><strong>{step.stepName}</strong><StatusBadge status={step.status}>{step.status}</StatusBadge><span>read {step.readCount} · write {step.writeCount} · rollback {step.rollbackCount}</span></div>)}</div></details><details className="details-box"><summary>Execution context</summary><pre>{stringifyMeta(execution.executionContext)}</pre></details></div>;
}
