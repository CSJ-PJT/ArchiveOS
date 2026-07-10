import type { IconName } from "../components/shared/Icon";

export type AppRoute = "overview" | "ecosystem" | "liveflow" | "workforce" | "finance" | "managed" | "approvals" | "agents" | "workflows" | "knowledge" | "history" | "batch" | "rpa" | "atlas" | "mcp" | "settings";

export type NavigationItem = {
  id: AppRoute;
  label: string;
  shortLabel: string;
  description: string;
  icon: IconName;
};

export const navigationItems: NavigationItem[] = [
  {
    id: "overview",
    label: "운영 개요",
    shortLabel: "홈",
    description: "현재 상태와 우선 조치를 빠르게 확인합니다",
    icon: "overview",
  },
  {
    id: "agents",
    label: "에이전트",
    shortLabel: "에이전트",
    description: "서비스별 에이전트 상태와 담당 작업을 확인합니다",
    icon: "agents",
  },
  {
    id: "ecosystem",
    label: "에코시스템",
    shortLabel: "에코",
    description: "Market, Nexus, Logistics, Ledger, ArchiveOS 연결 상태를 봅니다",
    icon: "activity",
  },
  {
    id: "liveflow",
    label: "실시간 흐름",
    shortLabel: "흐름",
    description: "실제 런타임 이벤트 기반 운영 흐름을 추적합니다",
    icon: "workflow",
  },
  {
    id: "workforce",
    label: "작업 역량",
    shortLabel: "역량",
    description: "서비스별 처리 역량, 적체, 병목을 확인합니다",
    icon: "agents",
  },
  {
    id: "finance",
    label: "재무 흐름",
    shortLabel: "재무",
    description: "정산 흐름, 보유자금, 수입과 지출을 확인합니다",
    icon: "health",
  },
  {
    id: "managed",
    label: "관리 시스템",
    shortLabel: "관제",
    description: "외부 시스템과 PM Inbox를 관리합니다",
    icon: "activity",
  },
  {
    id: "approvals",
    label: "Ledger 승인",
    shortLabel: "Ledger",
    description: "Ledger 승인 요청과 callback 상태를 확인합니다",
    icon: "approval",
  },
  {
    id: "workflows",
    label: "작업 흐름",
    shortLabel: "작업",
    description: "작업 큐, 파이프라인, PM 결정을 관리합니다",
    icon: "workflow",
  },
  {
    id: "knowledge",
    label: "운영 지식",
    shortLabel: "지식",
    description: "운영 메모리, 지식 그래프, RAG 상태를 확인합니다",
    icon: "knowledge",
  },
  {
    id: "history",
    label: "이력",
    shortLabel: "로그",
    description: "결정, 명령, 오류, KPI 이력을 확인합니다",
    icon: "history",
  },
  {
    id: "batch",
    label: "배치",
    shortLabel: "Batch",
    description: "Spring Batch 작업과 실행 근거를 확인합니다",
    icon: "batch",
  },
  {
    id: "rpa",
    label: "RPA",
    shortLabel: "RPA",
    description: "분류된 작업과 PM 결정 이력을 확인합니다",
    icon: "rpa",
  },
  {
    id: "atlas",
    label: "Atlas",
    shortLabel: "Atlas",
    description: "외부 Atlas 플랫폼 상태와 작업 로그를 확인합니다",
    icon: "activity",
  },
  {
    id: "mcp",
    label: "MCP Registry",
    shortLabel: "MCP",
    description: "도구 권한과 승인 레지스트리를 확인합니다",
    icon: "activity",
  },
  {
    id: "settings",
    label: "설정",
    shortLabel: "설정",
    description: "런타임, 연동, 보안, 화면, 빌드 상태를 관리합니다",
    icon: "settings",
  },
];
