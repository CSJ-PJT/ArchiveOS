import type { SemanticStatus } from "./StatusBadge";
import { StatusBadge } from "./StatusBadge";
import { Icon } from "./Icon";
import { navigationItems, type CoreRoute } from "../../app/navigation";
import type { PlatformRole } from "../../lib/backendApi";
import { useI18n } from "../../i18n/I18nProvider";
import { consoleText } from "../../i18n/console";

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
  route: CoreRoute;
  open: boolean;
  onNavigate: (route: CoreRoute) => void;
  health: SemanticStatus;
  loading: boolean;
  branch?: string | null;
  commitSha?: string | null;
  role: PlatformRole;
}) {
  const { locale } = useI18n();
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
        {navigationItems.map((item) => (
          <button
            className={`sidebar-link ${route === item.id ? "active" : ""}`}
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-current={route === item.id ? "page" : undefined}
            title={item.description}
          >
            <Icon name={item.icon} />
            <span>{consoleText(locale, `nav.${item.id}`)}</span>
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
