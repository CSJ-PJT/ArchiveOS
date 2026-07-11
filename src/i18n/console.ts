import type { Locale } from "./types";

type ConsoleTextKey = keyof typeof ko;
const ko = {
  "nav.dashboard": "대시보드", "nav.services": "서비스", "nav.operations": "운영", "nav.finance": "재무", "nav.records": "기록", "nav.settings": "설정",
  "dashboard.title": "Archive 생태계 운영 현황", "dashboard.description": "핵심 서비스의 상태, 실시간 이벤트, 병목과 균형 상태를 한 화면에서 확인합니다.",
  "page.services.title": "서비스", "page.services.description": "Archive 핵심 서비스의 연결 상태와 운영 지표를 확인합니다.",
  "page.operations.title": "운영", "page.operations.description": "서비스별 에이전트, 처리 역량, 작업 흐름과 자동화 상태를 관리합니다.",
  "page.finance.title": "재무", "page.finance.description": "모든 금액은 합성 데이터이며, 정산 흐름·서비스별 손익·승인·대사를 함께 확인합니다.",
  "page.records.title": "기록", "page.records.description": "실시간 이벤트, 감사 이력과 운영 지식을 읽기 전용으로 확인합니다.",
  "page.settings.title": "설정", "page.settings.description": "일반 설정, 연동 상태와 권한이 필요한 고급 도구를 관리합니다.",
  "common.live": "실시간 연결", "common.refresh": "새로고침", "common.noData": "데이터 없음", "common.healthy": "정상", "common.warning": "주의", "common.notConnected": "연결 안 됨",
  "mesh.title": "라이브 메쉬 토폴로지", "mesh.description": "실제 수집된 합성 런타임 이벤트만 표시합니다.",
} as const;
const en: Record<ConsoleTextKey, string> = {
  "nav.dashboard":"Dashboard","nav.services":"Services","nav.operations":"Operations","nav.finance":"Finance","nav.records":"Records","nav.settings":"Settings",
  "dashboard.title":"Archive ecosystem operations","dashboard.description":"Review core service status, live events, bottlenecks, and balance in one view.",
  "page.services.title":"Services","page.services.description":"Review core Archive service connectivity and operational indicators.","page.operations.title":"Operations","page.operations.description":"Manage service agents, capacity, workflows, and automation.","page.finance.title":"Finance","page.finance.description":"All amounts are synthetic data. Review settlement, P&L, approvals, and reconciliation.","page.records.title":"Records","page.records.description":"Read live events, audit history, and operational knowledge.","page.settings.title":"Settings","page.settings.description":"Manage general settings, integrations, and permissioned advanced tools.","common.live":"Live connected","common.refresh":"Refresh","common.noData":"No data","common.healthy":"Healthy","common.warning":"Attention","common.notConnected":"Not connected","mesh.title":"Live mesh topology","mesh.description":"Only collected synthetic runtime events are shown.",
};
const ja: Record<ConsoleTextKey, string> = {
  "nav.dashboard":"ダッシュボード","nav.services":"サービス","nav.operations":"運用","nav.finance":"財務","nav.records":"記録","nav.settings":"設定","dashboard.title":"Archive エコシステムの運用状況","dashboard.description":"主要サービスの状態、リアルタイムイベント、ボトルネック、バランスを一画面で確認します。","page.services.title":"サービス","page.services.description":"Archive コアサービスの接続状態と運用指標を確認します。","page.operations.title":"運用","page.operations.description":"サービス別エージェント、処理能力、ワークフロー、自動化を管理します。","page.finance.title":"財務","page.finance.description":"すべての金額は合成データです。精算、損益、承認、照合を確認します。","page.records.title":"記録","page.records.description":"リアルタイムイベント、監査履歴、運用ナレッジを参照します。","page.settings.title":"設定","page.settings.description":"一般設定、連携、権限付きの高度なツールを管理します。","common.live":"リアルタイム接続","common.refresh":"更新","common.noData":"データなし","common.healthy":"正常","common.warning":"注意","common.notConnected":"未接続","mesh.title":"ライブメッシュトポロジー","mesh.description":"収集済みの合成ランタイムイベントのみを表示します。",
};
const zhCN: Record<ConsoleTextKey, string> = {
  "nav.dashboard":"仪表板","nav.services":"服务","nav.operations":"运营","nav.finance":"财务","nav.records":"记录","nav.settings":"设置","dashboard.title":"Archive 生态系统运行概况","dashboard.description":"在一个视图中查看核心服务状态、实时事件、瓶颈和均衡状态。","page.services.title":"服务","page.services.description":"查看 Archive 核心服务连接状态和运行指标。","page.operations.title":"运营","page.operations.description":"管理各服务的代理、处理能力、工作流和自动化。","page.finance.title":"财务","page.finance.description":"所有金额均为合成数据。查看结算、损益、审批和对账。","page.records.title":"记录","page.records.description":"只读查看实时事件、审计记录和运行知识。","page.settings.title":"设置","page.settings.description":"管理常规设置、集成和受权限控制的高级工具。","common.live":"实时连接","common.refresh":"刷新","common.noData":"暂无数据","common.healthy":"正常","common.warning":"注意","common.notConnected":"未连接","mesh.title":"实时网格拓扑","mesh.description":"仅显示已收集的合成运行时事件。",
};
const tables: Record<Locale, Record<ConsoleTextKey, string>> = { ko, en, ja, "zh-CN": zhCN };
export function consoleText(locale: Locale, key: ConsoleTextKey) { return tables[locale]?.[key] ?? ko[key]; }
