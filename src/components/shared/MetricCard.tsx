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
        <small>{updatedAt ? `Updated ${updatedAt}` : hint || "Current state"}</small>
        <StatusBadge status={status}>{status}</StatusBadge>
      </div>
      {onClick && actionLabel ? <span className="metric-action">{actionLabel} →</span> : null}
    </Element>
  );
}
