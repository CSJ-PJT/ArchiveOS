import type { AppData } from "../app/AppShell";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { formatTimeAgo } from "./pageUtils";

export function McpRegistryPage({ data }: { data: AppData }) {
  if (data.auth.role === "PUBLIC") {
    return <div className="empty-state">MCP 도구 레지스트리는 운영자·PM·관리자 세션에서만 조회할 수 있습니다.</div>;
  }
  return <div className="page-stack">
    <SectionCard title="MCP 도구 레지스트리" eyebrow="읽기 전용 도구 거버넌스">
      <div className="history-table">
        {data.mcpRegistry.map((entry) => <div className="history-row" key={entry.id}>
          <summary><strong>{entry.tool}</strong><StatusBadge status={entry.health}>{entry.health}</StatusBadge><span>{entry.provider}</span><p>{entry.capability}</p></summary>
          <div className="detail-grid">
            <span>권한<strong>{entry.permission}</strong></span>
            <span>승인<strong>{entry.approval_required ? "필요" : "불필요"}</strong></span>
            <span>활성<strong>{entry.enabled ? "예" : "아니요"}</strong></span>
            <span>마지막 실행<strong>{entry.last_run ? formatTimeAgo(entry.last_run) : "실행 이력 없음"}</strong></span>
          </div>
        </div>)}
        {!data.mcpRegistry.length ? <div className="empty-state">레지스트리를 조회할 수 없거나 등록된 도구가 없습니다.</div> : null}
      </div>
      <p className="small-note">이 화면에서는 실행할 수 없습니다. 도구 변경은 관리자 통제 백엔드 설정을 통해서만 가능합니다.</p>
    </SectionCard>
  </div>;
}
