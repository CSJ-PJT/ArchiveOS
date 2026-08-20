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
  const display = value && value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value || "없음";

  return (
    <span className={`compact-value ${className}`} title={value || "없음"}>
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
  if (!value) return "알 수 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR");
}

export function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "알 수 없음";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(diff)) return value;
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}

export function knowledgeNodeTypeLabel(value: string | null | undefined) {
  return ({ obsidian_document: "Obsidian 문서", obsidian_chunk: "Obsidian 청크", obsidian_note: "Obsidian 노트", decision: "의사결정", architecture_review: "아키텍처 검토", reviewer_result: "검토 결과", builder_result: "구현 결과", incident: "장애", daily_report: "일일 보고서", nightly_review: "야간 검토", command: "명령", task: "작업", audit: "감사" } as Record<string, string>)[String(value || "").toLowerCase()] || (value ? value.replace(/_/g, " ") : "유형 없음");
}

export function knowledgeEdgeTypeLabel(value: string | null | undefined) {
  return ({ contains_chunk: "청크 포함", exported_to: "내보냄", reviewed_by: "검토자", decided_by: "결정자", reviewed_architecture_of: "아키텍처 검토", references_memory: "메모리 참조", mentioned_in: "언급됨", relates_to: "관련", caused_by: "원인", resolved_by: "해결", blocks: "차단" } as Record<string, string>)[String(value || "").toLowerCase()] || (value ? value.replace(/_/g, " ") : "관계 없음");
}

export function knowledgeImportanceLabel(value: string | null | undefined) {
  return ({ low: "낮음", medium: "보통", high: "높음", critical: "긴급" } as Record<string, string>)[String(value || "").toLowerCase()] || (value ? value.replace(/_/g, " ") : "미평가");
}

export function knowledgeStateLabel(value: string | null | undefined) {
  const normalized = String(value || "").toLowerCase();
  return ({ idle: "대기", loading: "불러오는 중", ready: "준비됨", empty: "데이터 없음", error: "오류", linked: "연결됨", recent: "최근", pending: "대기", "not linked": "연결 없음", succeeded: "완료", working: "진행 중", reviewing: "검토 중", failed: "실패", "pm decision recorded": "PM 결정 기록됨", "pm decision required": "PM 결정 필요", "review pending": "검토 대기", "building context": "맥락 구성 중" } as Record<string, string>)[normalized] || (value ? value.replace(/_/g, " ") : "상태 없음");
}

export function localizeKnowledgeText(value: string | null | undefined) {
  if (!value) return "기록 없음";
  return value
    .replace(/^(\d+) graph links?$/i, "그래프 연결 $1개")
    .replace(/^No decision chains yet\..*$/i, "아직 결정 체인이 없습니다. 명령·검토·결정·보고 노드가 연결되면 추적 경로가 표시됩니다.")
    .replace(/^None$/i, "없음");
}

export async function copyText(value: string) {
  if (!value) return;
  await navigator.clipboard?.writeText(value);
}
