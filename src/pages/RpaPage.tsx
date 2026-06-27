import { useCallback, useEffect, useState } from "react";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { getRpaTaskDetail, getRpaTasks, type RpaTaskDetail, type RpaTaskRecord } from "../lib/backendApi";
import { formatTimeAgo, stringifyMeta } from "./pageUtils";

export function RpaPage() {
  const [tasks, setTasks] = useState<RpaTaskRecord[]>([]);
  const [selected, setSelected] = useState<RpaTaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => { try { setError(null); const next = await getRpaTasks(30); setTasks(next); if (!selected && next[0]) setSelected(await getRpaTaskDetail(next[0].id)); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } }, [selected]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function inspect(task: RpaTaskRecord) { setSelected(await getRpaTaskDetail(task.id)); }

  return <div className="page-stack"><header className="page-heading"><div><span className="eyebrow">Human-in-the-loop automation</span><h2>RPA Decisions</h2><p>자동 분류 결과와 PM 승인 이력을 실행 제어와 분리해 추적합니다.</p></div><button className="button button-secondary" type="button" onClick={refresh}>Refresh</button></header>{error ? <div className="empty-state error-state">RPA history is unavailable. {error}</div> : null}<section className="workflows-layout"><SectionCard title="Classified Tasks" eyebrow="Risk and approval queue"><div className="workflow-list">{tasks.map((task) => <button className={`workflow-row ${selected?.task.id === task.id ? "selected" : ""}`} key={task.id} type="button" onClick={() => inspect(task)}><div><strong>{task.title}</strong><span>{task.category || "Unclassified"}</span></div><StatusBadge status={task.status}>{task.status}</StatusBadge><span>{task.riskLevel || "No risk"}</span><span>{formatTimeAgo(task.updatedAt)}</span></button>)}{!tasks.length && !error ? <div className="empty-state">No RPA tasks have been classified yet.</div> : null}</div></SectionCard><SectionCard title="Decision History" eyebrow="Recorded PM evidence only">{selected ? <RpaDetail detail={selected} /> : <div className="empty-state">Select a task to inspect its decision history.</div>}</SectionCard></section></div>;
}

function RpaDetail({ detail }: { detail: RpaTaskDetail }) {
  return <div className="detail-stack"><div className="detail-title"><div><h3>{detail.task.title}</h3><span>{detail.task.targetProject || "ArchiveOS"}</span></div><StatusBadge status={detail.task.status}>{detail.task.status}</StatusBadge></div><p className="body-copy">{detail.task.summary || detail.task.description}</p><div className="detail-grid"><span>Risk<strong>{detail.task.riskLevel || "Not assessed"}</strong></span><span>Recommendation<strong>{detail.task.recommendation || "No recommendation"}</strong></span><span>Approval<strong>{detail.task.approvalRequired ? "Required" : "Not required"}</strong></span></div><div className="decision-history-list">{detail.decisions.map((decision) => <article className="decision-history-row" key={decision.id}><div><strong>{decision.action.replace(/_/g, " ")}</strong><span>{decision.decidedBy || "Human PM"} · {formatTimeAgo(decision.createdAt)}</span></div><StatusBadge status={decision.nextStatus}>{decision.nextStatus}</StatusBadge><p>{decision.reason || "No reason recorded."}</p></article>)}{!detail.decisions.length ? <div className="empty-state">No PM decisions recorded for this task.</div> : null}</div><details className="details-box"><summary>Classification metadata</summary><pre>{stringifyMeta(detail.task.metadata)}</pre></details></div>;
}
