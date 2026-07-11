import type { IconName } from "../components/shared/Icon";

export type CoreRoute = "dashboard" | "services" | "operations" | "finance" | "records" | "settings";
export type LegacyRoute = "overview" | "liveflow" | "ecosystem" | "managed" | "atlas" | "agents" | "workforce" | "workflows" | "batch" | "rpa" | "approvals" | "knowledge" | "history" | "mcp";
export type AppRoute = CoreRoute | LegacyRoute;

export type NavigationItem = { id: CoreRoute; label: string; shortLabel: string; description: string; icon: IconName };

export const navigationItems: NavigationItem[] = [
  { id: "dashboard", label: "대시보드", shortLabel: "대시보드", description: "전체 상태와 라이브 메쉬를 한눈에 확인합니다.", icon: "overview" },
  { id: "services", label: "서비스", shortLabel: "서비스", description: "핵심 서비스와 외부 연동 상태를 확인합니다.", icon: "activity" },
  { id: "operations", label: "운영", shortLabel: "운영", description: "에이전트, 처리 역량, 작업 흐름과 자동화를 관리합니다.", icon: "workflow" },
  { id: "finance", label: "재무", shortLabel: "재무", description: "합성 정산 흐름, 손익, 승인과 대사를 확인합니다.", icon: "health" },
  { id: "records", label: "기록", shortLabel: "기록", description: "실시간 이벤트, 감사 이력과 운영 지식을 조회합니다.", icon: "history" },
  { id: "settings", label: "설정", shortLabel: "설정", description: "연동, 보안, 화면과 고급 도구를 설정합니다.", icon: "settings" },
];

export const legacyRedirects: Record<LegacyRoute, CoreRoute> = {
  overview: "dashboard",
  liveflow: "dashboard",
  ecosystem: "services",
  managed: "services",
  atlas: "services",
  agents: "operations",
  workforce: "operations",
  workflows: "operations",
  batch: "operations",
  rpa: "operations",
  approvals: "finance",
  knowledge: "records",
  history: "records",
  mcp: "settings",
};

export function normalizeRoute(value: string | null | undefined): CoreRoute {
  if (!value) return "dashboard";
  if (navigationItems.some((item) => item.id === value)) return value as CoreRoute;
  return legacyRedirects[value as LegacyRoute] ?? "dashboard";
}
