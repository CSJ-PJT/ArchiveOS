import { useEffect, useMemo, useRef, useState } from "react";
import { evaluateSteamSnapshot, parseSteamSnapshot, type DevelopmentGateStatus, type SteamSnapshot } from "../../lib/deepstakeProgress";
import "./deepstake-progress.css";

const feedUrl = import.meta.env.VITE_DEEPSTAKE_PROGRESS_FEED_URL || "/deepstake-progress.json";
const statusText: Record<DevelopmentGateStatus, string> = {
  pass: "PASS", partial: "부분 검증", fail: "FAIL", not_run: "미실행", blocked: "차단",
};
const legacyLabels = [
  ["completed", "완료", "done"],
  ["in_progress", "진행", "working"],
  ["unimplemented", "미구현", "pending"],
  ["external", "외부 의존", "external"],
] as const;

export function DeepStakeProgressBoard({ compact = false }: { compact?: boolean }) {
  const [snapshot, setSnapshot] = useState<SteamSnapshot | null>(null);
  const [loadError, setLoadError] = useState("");
  const [sourceKind, setSourceKind] = useState<"feed" | "local">("feed");
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const response = await fetch(feedUrl, { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const next = parseSteamSnapshot(await response.json());
        if (alive) {
          setLastChecked(new Date().toISOString());
          if (sourceKind === "feed") setSnapshot(next);
          setLoadError("");
        }
      } catch (error) {
        if (alive) { setLastChecked(new Date().toISOString()); setLoadError(error instanceof Error ? error.message : String(error)); }
      }
    };
    void refresh();
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 60_000);
    return () => { alive = false; window.clearInterval(interval); };
  }, [sourceKind]);

  const evaluated = useMemo(() => snapshot ? evaluateSteamSnapshot(snapshot) : null, [snapshot]);
  const loadLocal = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setLoadError("스냅샷은 2MB 이하여야 합니다."); return; }
    try {
      const next = parseSteamSnapshot(JSON.parse(await file.text()));
      setSnapshot(next);
      setSourceKind("local");
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  };
  if (!evaluated) return (
    <section className="ds-progress" aria-label="Steam Windows PC 개발 관제">
      <div className="ds-heading"><div><span className="ds-eyebrow">STEAM / WINDOWS PC</span><h2>DeepStake 개발 진척</h2></div></div>
      <p className="ds-notice">검증 가능한 개발 스냅샷을 불러오는 중입니다. {loadError && `불러오기 실패: ${loadError}`}</p>
    </section>
  );
  const { counts, steamEstimate, stale, original72Mapped, original72VerifiedFloor, original72InProgressUpperBound } = evaluated;
  const original = evaluated.snapshot.original72;
  const steam = evaluated.snapshot.steamMvp;
  const scoreReviewedAt = steam.history[steam.history.length - 1]?.atUtc ?? evaluated.snapshot.asOfUtc;
  const scoreIsStale = Date.now() - Date.parse(scoreReviewedAt) > 24 * 60 * 60 * 1000;
  const stages = evaluated.snapshot.gates;
  const verification = evaluated.snapshot.verification;
  const developer = evaluated.snapshot.developerReport;
  const total = original.total;
  const renderStamp = (value: string) => new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  return <section className={`ds-progress ${compact ? "ds-compact" : ""}`} aria-label="DeepStake Steam PC 개발 진척 관제">
    <header className="ds-heading">
      <div>
        <span className="ds-eyebrow">DEEPSTAKE · STEAM WINDOWS PC ONLY</span>
        <h2>게임 개발 진척 · 검증 현황</h2>
        <p>완성률로 오해될 수 있는 검증 수치와 계획 추정치를 분리했습니다.</p>
      </div>
      <span className={`ds-freshness ${stale ? "is-stale" : ""}`}>{stale ? "오래된 스냅샷" : "스냅샷 기준"}</span>
    </header>
    <div className="ds-top-grid">
      <article className="ds-metric is-primary">
        <span>Steam PC MVP · 근거 기반 추정</span>
        <strong>{steamEstimate.toFixed(1)}<small>%</small></strong>
        <div className="ds-bar" role="img" aria-label={`Steam PC MVP 추정 ${steamEstimate.toFixed(1)}퍼센트`}>
          <i style={{ width: `${steamEstimate}%` }} />
        </div>
        <small>9개 영역 가중 평가 · 점수 검토 {renderStamp(scoreReviewedAt)}{scoreIsStale ? " (재평가 필요)" : ""} · 공식 완료율 아님</small>
      </article>
      <article className="ds-metric">
        <span>원래 72개 수용기준</span>
        <strong>{original.historicalPercent}<small>%</small></strong>
        <p>과거 보고치 · {renderStamp(original.historicalAtUtc).split(" ")[0]}</p>
        <small>{original72Mapped ? "원본 72개 ID 연결됨 · 집계 재계산 가능" : "72개 개별 ID 미복구 · 과거 집계 고정"}</small>
      </article>
      <article className="ds-metric">
        <span>최근 Unity 관련 테스트</span>
        <strong>{verification.editorPassed}<small>/{verification.editorTotal}</small></strong>
        <p>{verification.suite}</p>
        <small>전체 회귀·Native·출시 승인과 무관</small>
      </article>
      <article className="ds-metric">
        <span>원본 영수증 기준 Native E2E</span>
        <strong className="ds-fail-label">{statusText[verification.nativeStatus]}</strong>
        <p>PID {verification.nativePid ?? "미기록"} · exit {verification.nativeExitCode ?? "미기록"}</p>
        <small>{developer ? "이전 파일 검증 기준이며, 최신 로컬 Codex 자체 보고는 아래에서 구분" : "단일 플레이 루프의 연속 통과 증거 없음"}</small>
      </article>
    </div>

    {developer ? <section className="ds-developer-report" aria-label="로컬 Codex 개발자 자체 검증 보고">
      <div className="ds-section-heading">
        <h3>로컬 Codex 자체 검증 보고</h3>
        <span>{developer.builds.join(" · ")} · {renderStamp(developer.reportedAtUtc)}</span>
      </div>
      <div className="ds-developer-grid">
        <div><strong>첫날 생활 E2E 통과 보고</strong><small>개발자 자체 시험 · 원본 Native 영수증 및 독립 QA 대조 전</small></div>
        <div><strong>{developer.nativeRuns.map((run) => `PID ${run.pid} exit ${run.reportedExitCode}`).join(" · ")}</strong><small>신규 실행 및 별도 프로세스 복원 (로컬 보고)</small></div>
        <div><strong>{developer.tests.map((test) => `${test.passed}/${test.total}`).join(" · ")}</strong><small>관련 테스트 (자체 보고, 범위별 별도)</small></div>
        <div><strong>{developer.firstVillageMvpEvidenceScore.score}/{developer.firstVillageMvpEvidenceScore.maximum}</strong><small>첫 마을 MVP 증거 점수 · 위 Steam 9영역 추정치와 별개</small></div>
      </div>
      <p>{developer.reportedFirstDayFlow}</p>
      {!compact ? <p>이동 {developer.movement.routes}개 경로 · 정지 {developer.movement.stopPoints}곳: {developer.movement.maxStopDistanceMeters}m 미만 보고. 남은 검증: {developer.unresolved.join(" · ")}</p> : null}
      <small>출처: 사용자가 제공한 DeepStake Project Codex 화면. 이 보고는 원본 실행 파일·테스트 XML·독립 PC 검증의 대체물이 아니며 전체 게임 완성률에 자동 가산하지 않습니다.</small>
    </section> : null}
    <div className="ds-historical">
      <div className="ds-section-heading"><h3>원본 72건 상태 분포</h3><span>항목 연결 {original72Mapped ? "72/72" : "0/72"}</span></div>
      <div className="ds-stacked" role="img" aria-label={`완료 ${counts.completed}, 진행 ${counts.in_progress}, 미구현 ${counts.unimplemented}, 외부 의존 ${counts.external}`}>
        {legacyLabels.map(([key, , color]) => <span key={key} className={`ds-segment ${color}`} style={{ width: `${counts[key] / total * 100}%` }} />)}
      </div>
      <div className="ds-legend">
        {legacyLabels.map(([key, label, color]) => <span key={key}><i className={color} />{label} <strong>{counts[key]}</strong></span>)}
      </div>
      <p className="ds-footnote">개별 원본이 없으므로 72건의 수량·이전 완료 판정은 자동 수정하지 않습니다. 단순 상태 기준 완료 하한 {original72VerifiedFloor}% ~ 진행건 전부 완료 가정 상한 {original72InProgressUpperBound}%는 계산 예시이며, 과거 표시값 {original.historicalPercent}%와 같은 공식이 아닙니다.</p>
    </div>

    {!compact ? <>
      <div className="ds-section-heading"><h3>Steam Windows PC 작업영역별 추정</h3><span>가중합 100 · 각 점수의 근거 검토 필요</span></div>
      <div className="ds-workstream-chart" role="list">
        {steam.workstreams.map((w) => <div className="ds-workstream" key={w.id} role="listitem">
          <div className="ds-workstream-title"><strong>{w.label}</strong><span className={`ds-state state-${w.gate}`}>{statusText[w.gate]}</span></div>
          <div className="ds-workstream-track"><div className="ds-bar" role="img" aria-label={`${w.label} 영역 추정 점수 ${w.estimate}퍼센트, 가중치 ${w.weight}퍼센트`}><i style={{ width: `${w.estimate}%` }} /></div><b>{w.estimate}%</b></div>
          <small>가중치 {w.weight}% · 기여 {(w.weight * w.estimate / 100).toFixed(1)}%p · {w.note}</small>
          <details><summary>검증 근거 {w.evidence.length}건</summary><ul>{w.evidence.length ? w.evidence.map((e) => <li key={e}><code>{e}</code></li>) : <li>독립 PASS 근거 없음</li>}</ul></details>
        </div>)}
      </div>
      <div className="ds-details-grid">
        <div>
          <div className="ds-section-heading"><h3>Windows 출시 차단표</h3></div>
          <div className="ds-gates" role="list">{stages.map((g) => <article role="listitem" key={g.id}><div><b>{g.label}</b><span className={`ds-state state-${g.status}`}>{statusText[g.status]}</span></div><p>{g.detail}</p><small title={g.evidence}>{g.evidence}</small></article>)}</div>
        </div>
        <div>
          <div className="ds-section-heading"><h3>실제 변경·검증 타임라인</h3></div>
          <ol className="ds-events">{evaluated.snapshot.events.slice().sort((a, b) => Date.parse(b.atUtc) - Date.parse(a.atUtc)).map((e) => <li key={e.id}><time>{renderStamp(e.atUtc)}</time><b>{e.label}</b><span className={`ds-state state-${e.status}`}>{statusText[e.status]}</span><small>{e.evidence}</small></li>)}</ol>
        </div>
      </div>
      <div className="ds-section-heading"><h3>Steam MVP 추정 추세</h3></div>
      {steam.history.length < 2 ? <p className="ds-notice">같은 계산식으로 측정한 스냅샷이 1개뿐입니다. 과거 72건의 24%를 이어 붙여 상승 그래프를 만들지 않습니다. 후속 증거가 수집되면 추세를 표시합니다.</p> :
        <div className="ds-trend" role="list">{steam.history.map((p) => <div key={p.atUtc} role="listitem"><span>{renderStamp(p.atUtc)}</span><div className="ds-bar"><i style={{ width: `${p.estimate}%` }}/></div><b>{p.estimate}%</b></div>)}</div>}
      <footer className="ds-footer">
        <div><strong>데이터 수집 기준</strong><p>{evaluated.snapshot.sourceLabel} · 관측 {renderStamp(evaluated.snapshot.asOfUtc)}</p><p>{steam.method}</p></div>
        <label className="ds-import-button">JSON 근거 스냅샷 미리보기<input ref={inputRef} type="file" accept=".json,application/json" onChange={(e) => { void loadLocal(e.currentTarget.files?.[0]); e.currentTarget.value = ""; }} /></label>
        {sourceKind === "local" ? <button type="button" onClick={() => { setSourceKind("feed"); setSnapshot(null); }}>서버 스냅샷으로 복귀</button> : null}
      </footer>
      {sourceKind === "local" ? <p className="ds-notice">현재 브라우저에서만 임시 미리보기 중입니다. 서버나 원본 72건 데이터는 수정되지 않습니다.</p> : null}
      {loadError ? <p className="ds-notice" role="alert">최근 데이터 확인 오류: {loadError}. 마지막 유효 스냅샷만 표시합니다.</p> : null}
      {lastChecked ? <small className="ds-last-checked">마지막 피드 조회 {renderStamp(lastChecked)} · 60초마다 새 스냅샷 확인</small> : null}
    </> : <div className="ds-compact-footer">
      <span>최근 차단: {verification.nativeFailure}</span>
      <button type="button" onClick={() => setExpanded((v) => !v)}>{expanded ? "요약 접기" : "검증 상태 보기"}</button>
      {expanded ? <div className="ds-inline-gates">{stages.map((g) => <span key={g.id}>{g.label}: <b className={`state-${g.status}`}>{statusText[g.status]}</b></span>)}</div> : null}
    </div>}
  </section>;
}
