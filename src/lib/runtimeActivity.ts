export type RuntimeActivityState = {
  runtimeStatus?: string | null;
  runtimeActive?: boolean;
  recentThroughput?: number | null;
  throughputSource?: string | null;
  schedulerStatus?: string | null;
  pipelineStatus?: string | null;
};

/**
 * Describes measured work without presenting a completed tick or rolling
 * window as the number of jobs that are currently in flight.
 */
export function runtimeActivityLabel(nodeId: string, fallbackCount: number, state?: RuntimeActivityState) {
  const scheduler = String(state?.schedulerStatus || "").toUpperCase();
  const pipeline = String(state?.pipelineStatus || "").toUpperCase();
  if (nodeId === "nexus" && (scheduler === "DISABLED" || pipeline === "DISABLED")) {
    return "시뮬레이터 안전 정지";
  }

  const hasRuntimeThroughput = typeof state?.recentThroughput === "number";
  const throughput = hasRuntimeThroughput ? state.recentThroughput! : fallbackCount;
  if (throughput > 0) {
    const source = String(state?.throughputSource || "").toLowerCase();
    if (source === "runtime_tick") return `최근 실행 ${throughput.toLocaleString()}건`;
    if (source.includes("30m")) return `최근 30분 ${throughput.toLocaleString()}건`;
    if (source === "upstream") return `최근 수집 ${throughput.toLocaleString()}건`;
    return `최근 이벤트 ${throughput.toLocaleString()}건`;
  }

  if (nodeId === "settlement") return "정산 배치 대기";
  if (state?.runtimeActive || ["PROCESSING", "RUNNING"].includes(String(state?.runtimeStatus || "").toUpperCase())) {
    return "실시간 감시 중";
  }
  return "신규 작업 대기";
}
