import type { SemanticStatus } from "./StatusBadge";
import { StatusBadge } from "./StatusBadge";
import { Icon } from "./Icon";
import { navigationItems, type AppRoute } from "../../app/navigation";

export function Sidebar({ route, open, onNavigate, health, loading, branch, commitSha }: { route: AppRoute; open: boolean; onNavigate: (route: AppRoute) => void; health: SemanticStatus; loading: boolean; branch?: string | null; commitSha?: string | null }) {
  return <aside className={`sidebar ${open ? "open" : ""}`}>
    <div className="brand-lockup"><div className="brand-mark">A</div><div><strong>ArchiveOS</strong><span>Operations Console</span></div></div>
    <nav className="sidebar-nav" aria-label="ArchiveOS sections">
      {navigationItems.map((item) => <button className={`sidebar-link ${route === item.id ? "active" : ""}`} key={item.id} type="button" onClick={() => onNavigate(item.id)} aria-current={route === item.id ? "page" : undefined} title={item.description}><Icon name={item.icon} /><span>{item.label}</span><i aria-hidden="true" /></button>)}
    </nav>
    <div className="sidebar-footer"><span>Platform status</span><StatusBadge status={health}>{loading ? "Initializing" : health}</StatusBadge><small>{branch || "main"} · {commitSha?.slice(0, 7) || "local"}</small></div>
  </aside>;
}
