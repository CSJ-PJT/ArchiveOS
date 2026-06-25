import type { ReactNode } from "react";

export type SemanticStatus =
  | "healthy"
  | "working"
  | "waiting"
  | "warning"
  | "critical"
  | "offline"
  | "idle"
  | "success"
  | "failed"
  | "blocked"
  | "empty"
  | "unknown"
  | "not_configured"
  | "disconnected";

export function normalizeStatus(value: string | null | undefined): SemanticStatus {
  const status = (value || "unknown").toLowerCase();
  if (["healthy", "ok", "online", "connected", "clear", "enabled", "detected"].includes(status)) return "healthy";
  if (["working", "running", "building", "review", "processing", "ready_for_build", "architect_review"].includes(status)) {
    return "working";
  }
  if (["waiting", "queued", "pm_decision_required", "pending"].includes(status)) return "waiting";
  if (["warning", "hold", "stale", "skipped"].includes(status)) return "warning";
  if (["critical", "error", "failed", "problem", "missing"].includes(status)) return "critical";
  if (["blocked", "stop", "rejected"].includes(status)) return "blocked";
  if (["success", "succeeded", "sent", "completed", "done", "approved"].includes(status)) return "success";
  if (["offline", "not_detected", "disabled", "disconnected"].includes(status)) return "offline";
  if (["empty", "none"].includes(status)) return "empty";
  if (["not_configured"].includes(status)) return "not_configured";
  return "unknown";
}

export function StatusBadge({ status, children }: { status: SemanticStatus | string | null | undefined; children?: ReactNode }) {
  const tone = normalizeStatus(typeof status === "string" ? status : status || "unknown");
  return <span className={`badge badge-${tone}`}>{children || status || "unknown"}</span>;
}
