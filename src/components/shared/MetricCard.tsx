import type { IconName } from "./Icon";
import { Icon } from "./Icon";
import { StatusBadge, type SemanticStatus } from "./StatusBadge";

export function MetricCard({
  label,
  value,
  hint,
  status = "unknown",
  onClick,
  description,
  updatedAt,
  icon,
  actionLabel,
}: {
  label: string;
  value: string | number;
  hint?: string;
  status?: SemanticStatus | string;
  onClick?: () => void;
  description?: string;
  updatedAt?: string | null;
  icon?: IconName;
  actionLabel?: string;
}) {
  const Element = onClick ? "button" : "div";
  return (
    <Element className={`metric-tile ${onClick ? "interactive" : ""}`} onClick={onClick} type={onClick ? "button" : undefined}>
      <div className="metric-tile-heading">{icon ? <span className="metric-icon"><Icon name={icon} /></span> : null}<span>{label}</span></div>
      <strong title={String(value)}>{value}</strong>
      {description ? <p>{description}</p> : null}
      <div className="metric-tile-footer">
        <small>{updatedAt ? `갱신 ${updatedAt}` : hint || "상태"}</small>
        <StatusBadge status={status}>{statusLabel(status)}</StatusBadge>
      </div>
      {onClick && actionLabel ? <span className="metric-action">{actionLabel} →</span> : null}
    </Element>
  );
}

function statusLabel(value: SemanticStatus | string) {
  const status = String(value || "").toLowerCase();
  if (status === "healthy" || status === "normal" || status === "completed" || status === "settled" || status === "approved") return "정상";
  if (status === "degraded" || status === "warning" || status === "delayed") return "주의";
  if (status === "unavailable" || status === "not_connected" || status === "disconnected") return "연결 안 됨";
  if (status === "blocked") return "차단됨";
  if (status === "idle" || status === "empty" || status === "waiting") return "대기";
  if (status === "critical" || status === "failed" || status === "rejected") return "긴급";
  if (status === "info") return "정보";
  if (status === "working" || status === "running" || status === "moving") return "진행 중";
  return String(value);
}
