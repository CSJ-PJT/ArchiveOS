/**
 * DeepStake Steam Windows PC development read model.
 * This is deliberately NOT the original 72-item acceptance ledger.
 * Percentages here are reviewer-scored MVP estimates with explicit evidence.
 */
export const DEEPSTAKE_SCHEMA = "deepstake-steam-progress-v1" as const;

export type DevelopmentGateStatus = "pass" | "partial" | "fail" | "not_run" | "blocked";

export type Original72ItemStatus = "completed" | "in_progress" | "unimplemented" | "external";
export type Original72Counts = Record<Original72ItemStatus, number>;

export type Original72Item = {
  id: string;
  status: Original72ItemStatus;
  title?: string;
  evidenceRef?: string;
};

export type Original72Snapshot = {
  total: number;
  historicalPercent: number;
  historicalAtUtc: string;
  historicalCounts: Original72Counts;
  source: string;
  /** Absent until the genuine per-item ledger is recovered. Never synthesize its rows. */
  items?: Original72Item[];
};

export type SteamWorkstream = {
  id: string;
  label: string;
  weight: number;
  estimate: number;
  gate: DevelopmentGateStatus;
  note: string;
  evidence: string[];
};

export type SteamGate = {
  id: string;
  label: string;
  status: DevelopmentGateStatus;
  detail: string;
  evidence: string;
};

export type SteamEvent = {
  id: string;
  atUtc: string;
  label: string;
  status: DevelopmentGateStatus;
  evidence: string;
};

export type DeveloperReport = {
  /** A user-supplied screenshot of local Codex output is not a native test receipt. */
  source: "user-provided-codex-screenshots";
  reportedAtUtc: string;
  builds: string[];
  nativeRuns: Array<{ pid: number; reportedExitCode: number; purpose: string }>;
  tests: Array<{ label: string; passed: number; total: number }>;
  movement: { routes: number; stopPoints: number; maxStopDistanceMeters: number; reportedAllWithin: boolean };
  reportedFirstDayFlow: string;
  firstVillageMvpEvidenceScore: { score: number; maximum: number; method: string };
  unresolved: string[];
  independentlyVerified: false;
};

export type SteamSnapshot = {
  schema: typeof DEEPSTAKE_SCHEMA;
  asOfUtc: string;
  scope: "steam-windows-pc";
  sourceLabel: string;
  developerReport?: DeveloperReport;
  original72: Original72Snapshot;
  steamMvp: {
    method: string;
    workstreams: SteamWorkstream[];
    /** Only dated, independently calculated points from this SAME Steam MVP model. */
    history: Array<{ atUtc: string; estimate: number; source: string }>;
  };
  verification: {
    suite: string;
    editorPassed: number;
    editorTotal: number;
    nativePid: number | null;
    nativeExitCode: number | null;
    nativeStatus: DevelopmentGateStatus;
    nativeFailure: string;
    isIndependentQA: boolean;
  };
  gates: SteamGate[];
  events: SteamEvent[];
};

export function evaluateSteamSnapshot(value: unknown) {
  const data = parseSteamSnapshot(value);
  const counts = data.original72.items ? itemCounts(data.original72.items) : data.original72.historicalCounts;
  const mapped = Array.isArray(data.original72.items);
  const total = data.original72.total;
  const weighted = data.steamMvp.workstreams.reduce((sum, item) => sum + item.weight * item.estimate, 0);
  const weights = data.steamMvp.workstreams.reduce((sum, item) => sum + item.weight, 0);
  const estimate = round1(weighted / weights);
  return {
    snapshot: data,
    steamEstimate: estimate,
    counts,
    original72Mapped: mapped,
    original72VerifiedFloor: round1((counts.completed / total) * 100),
    original72InProgressUpperBound: round1(((counts.completed + counts.in_progress) / total) * 100),
    stale: Date.now() - Date.parse(data.asOfUtc) > 24 * 60 * 60 * 1000,
  };
}

function itemCounts(items: Original72Item[]): Original72Counts {
  const result: Original72Counts = { completed: 0, in_progress: 0, unimplemented: 0, external: 0 };
  for (const item of items) result[item.status] += 1;
  return result;
}

export function parseSteamSnapshot(value: unknown): SteamSnapshot {
  if (!isRecord(value)) throw new Error("스냅샷 객체가 아닙니다.");
  if (value.schema !== DEEPSTAKE_SCHEMA || value.scope !== "steam-windows-pc") throw new Error("지원되지 않는 Steam PC 스냅샷입니다.");
  const data = value as SteamSnapshot;
  if (!validTime(data.asOfUtc)) throw new Error("스냅샷 관측 시각이 올바르지 않습니다.");
  if (!data.original72 || data.original72.total !== 72) throw new Error("원래 기준 72건을 임의로 변경할 수 없습니다.");
  if (!validTime(data.original72.historicalAtUtc) || !Number.isFinite(data.original72.historicalPercent)) throw new Error("역사적 기준값이 올바르지 않습니다.");
  if (!validCounts(data.original72.historicalCounts, 72)) throw new Error("원본 72건의 집계 합계가 맞지 않습니다.");
  if (data.original72.items !== undefined) {
    if (!Array.isArray(data.original72.items) || data.original72.items.length !== 72) throw new Error("원래 72개 개별 항목이 완전하지 않습니다.");
    const ids = new Set<string>();
    for (const item of data.original72.items) {
      if (!item || !safeId(item.id) || ids.has(item.id) || !validOriginalStatus(item.status)) throw new Error("72개 원본 항목 ID 또는 상태가 잘못되었습니다.");
      ids.add(item.id);
    }
  }
  if (!data.steamMvp || !Array.isArray(data.steamMvp.workstreams) || data.steamMvp.workstreams.length === 0) throw new Error("Steam MVP 평가 항목이 없습니다.");
  const ids = new Set<string>();
  let totalWeight = 0;
  for (const w of data.steamMvp.workstreams) {
    if (!w || !safeId(w.id) || ids.has(w.id) || typeof w.label !== "string" || !Number.isFinite(w.weight) || w.weight <= 0 ||
      !Number.isFinite(w.estimate) || w.estimate < 0 || w.estimate > 100 || !validGate(w.gate) ||
      !Array.isArray(w.evidence) || (w.estimate > 0 && w.evidence.length === 0)) throw new Error("MVP 점수에 유효한 항목·근거가 필요합니다.");
    ids.add(w.id);
    totalWeight += w.weight;
  }
  if (Math.abs(totalWeight - 100) > 0.00001) throw new Error("Steam MVP 가중치의 합계는 100이어야 합니다.");
  if (!Array.isArray(data.steamMvp.history) || data.steamMvp.history.some((p) => !validTime(p.atUtc) || !Number.isFinite(p.estimate) || p.estimate < 0 || p.estimate > 100)) {
    throw new Error("MVP 추세 데이터가 잘못되었습니다.");
  }
  if (!data.verification || !Number.isInteger(data.verification.editorPassed) || !Number.isInteger(data.verification.editorTotal) ||
    data.verification.editorPassed < 0 || data.verification.editorTotal < data.verification.editorPassed ||
    !validGate(data.verification.nativeStatus)) throw new Error("시험 검증 수치가 잘못되었습니다.");
  if (data.developerReport !== undefined) {
    const report = data.developerReport;
    if (!report || report.source !== "user-provided-codex-screenshots" || !validTime(report.reportedAtUtc) ||
      report.independentlyVerified !== false || !Array.isArray(report.builds) || !Array.isArray(report.nativeRuns) ||
      !Array.isArray(report.tests) || !Array.isArray(report.unresolved) ||
      !report.firstVillageMvpEvidenceScore || !Number.isFinite(report.firstVillageMvpEvidenceScore.score) ||
      !Number.isFinite(report.firstVillageMvpEvidenceScore.maximum) || report.firstVillageMvpEvidenceScore.maximum <= 0 ||
      report.firstVillageMvpEvidenceScore.score < 0 ||
      report.firstVillageMvpEvidenceScore.score > report.firstVillageMvpEvidenceScore.maximum ||
      !report.movement || !Number.isInteger(report.movement.routes) || report.movement.routes < 0 ||
      !Number.isInteger(report.movement.stopPoints) || report.movement.stopPoints < 0 ||
      !Number.isFinite(report.movement.maxStopDistanceMeters) || report.movement.maxStopDistanceMeters <= 0 ||
      report.nativeRuns.some((r) => !Number.isInteger(r.pid) || r.pid < 1 || !Number.isInteger(r.reportedExitCode)) ||
      report.tests.some((t) => !t.label || !Number.isInteger(t.passed) || !Number.isInteger(t.total) || t.passed < 0 || t.total < t.passed)) {
      throw new Error("로컬 개발자 보고가 올바르지 않거나 독립 검증으로 오표기되었습니다.");
    }
  }
  if (!Array.isArray(data.gates) || data.gates.some((g) => !g || !safeId(g.id) || !validGate(g.status) || typeof g.evidence !== "string")) throw new Error("출시 게이트 상태가 잘못되었습니다.");
  if (!Array.isArray(data.events) || data.events.some((e) => !e || !safeId(e.id) || !validTime(e.atUtc) || !validGate(e.status))) throw new Error("개발 이벤트가 잘못되었습니다.");
  return data;
}

function round1(value: number) { return Math.round(value * 10) / 10; }
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }
function safeId(value: unknown): value is string { return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(value); }
function validTime(value: unknown): value is string { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
function validGate(value: unknown): value is DevelopmentGateStatus { return value === "pass" || value === "partial" || value === "fail" || value === "not_run" || value === "blocked"; }
function validOriginalStatus(value: unknown): value is Original72ItemStatus { return value === "completed" || value === "in_progress" || value === "unimplemented" || value === "external"; }
function validCounts(value: unknown, total: number): value is Original72Counts {
  if (!isRecord(value)) return false;
  const counts = ["completed", "in_progress", "unimplemented", "external"].map((key) => value[key]);
  return counts.every((v) => typeof v === "number" && Number.isInteger(v) && v >= 0) &&
    (counts as number[]).reduce((sum, num) => sum + num, 0) === total;
}
