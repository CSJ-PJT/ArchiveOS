import { StatusBadge, type SemanticStatus } from "./StatusBadge";

export function MetricCard({
  label,
  value,
  hint,
  status = "unknown",
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  status?: SemanticStatus | string;
  onClick?: () => void;
}) {
  const Element = onClick ? "button" : "div";
  return (
    <Element className="metric-tile" onClick={onClick} type={onClick ? "button" : undefined}>
      <span>{label}</span>
      <strong title={String(value)}>{value}</strong>
      <div className="metric-tile-footer">
        {hint ? <small>{hint}</small> : <small>&nbsp;</small>}
        <StatusBadge status={status}>{status}</StatusBadge>
      </div>
    </Element>
  );
}
