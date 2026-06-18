import type { ReactNode } from "react";

type PanelProps = {
  title: string;
  eyebrow?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function KnowledgePanel({ title, eyebrow, right, children, className = "" }: PanelProps) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-header">
        <div>
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h2>{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function KnowledgeMetric({ label, value, tone = "default" }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function KnowledgeStatusBadge({ children, tone = "default" }: { children: ReactNode; tone?: string }) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}

export function KnowledgeSourceLabel({ children }: { children: ReactNode }) {
  return <span className="source-label">{children}</span>;
}

export function KnowledgeEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

export function KnowledgeCompactValue({
  value,
  maxLength = 36,
  className = "",
}: {
  value: string | null | undefined;
  maxLength?: number;
  className?: string;
}) {
  const display = value && value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value || "None";

  return (
    <span className={`compact-value ${className}`} title={value || "None"}>
      {display}
    </span>
  );
}

export function GraphToggle({
  active,
  children,
  onClick,
  title,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button className={`graph-toggle ${active ? "active" : ""}`} type="button" onClick={onClick} title={title}>
      {children}
    </button>
  );
}

export function formatExactDate(value: string | null | undefined) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Unknown";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(diff)) return value;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export async function copyText(value: string) {
  if (!value) return;
  await navigator.clipboard?.writeText(value);
}
