import type { SemanticStatus } from "./StatusBadge";
import { StatusBadge } from "./StatusBadge";
import { Icon } from "./Icon";
import { navigationItems, type AppRoute } from "../../app/navigation";
import type { PlatformRole } from "../../lib/backendApi";

export function Sidebar({
  route,
  open,
  onNavigate,
  health,
  loading,
  branch,
  commitSha,
  role,
}: {
  route: AppRoute;
  open: boolean;
  onNavigate: (route: AppRoute) => void;
  health: SemanticStatus;
  loading: boolean;
  branch?: string | null;
  commitSha?: string | null;
  role: PlatformRole;
}) {
  const displayedCommit = commitSha ? commitSha.slice(0, 7) : "local";
  const displayedBranch = branch || "main";

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand-lockup">
        <div className="brand-mark">
          <img
            src="/archiveos-mark.svg"
            alt=""
            aria-hidden="true"
            style={{ width: "1.75rem", height: "1.75rem", display: "block" }}
          />
        </div>
        <div>
          <strong>ArchiveOS</strong>
          <span>운영 콘솔</span>
        </div>
      </div>
      <nav className="sidebar-nav" aria-label="ArchiveOS 메뉴">
        {navigationItems.filter((item) => item.id !== "mcp" || role !== "PUBLIC").map((item) => (
          <button
            className={`sidebar-link ${route === item.id ? "active" : ""}`}
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-current={route === item.id ? "page" : undefined}
            title={item.description}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
            <i aria-hidden="true" />
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span>플랫폼 상태</span>
        <StatusBadge status={health}>{loading ? "초기화 중" : health}</StatusBadge>
        <small>
          {displayedBranch} · {displayedCommit}
        </small>
      </div>
    </aside>
  );
}
