import type { ReactNode } from "react";
import { Icon } from "./Icon";

export type DataStateKind = "loading" | "empty" | "error" | "stale";

export function DataState({ kind, title, description, action }: { kind: DataStateKind; title: string; description: string; action?: ReactNode }) {
  const icon = kind === "error" ? "alert" : kind === "loading" ? "activity" : kind === "stale" ? "history" : "overview";
  return <div className={`data-state data-state-${kind}`} role={kind === "error" ? "alert" : "status"}>
    <span className="data-state-icon"><Icon name={icon} /></span><div><strong>{title}</strong><p>{description}</p>{action}</div>
  </div>;
}
