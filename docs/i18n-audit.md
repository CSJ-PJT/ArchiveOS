# ArchiveOS i18n Audit

## Scope

ArchiveOS UI language support now covers:

- Top-right globe language selector
- Sidebar and topbar labels
- Navigation labels and descriptions
- Common buttons and action labels
- Empty states and loading/waiting labels
- Overview, Managed Systems, Ecosystem, Survival Mode, Ledger Approvals, Workflows, Knowledge, RPA, MCP, Atlas, Batch, and Settings display labels
- Display-only status labels for approval, outbox, settlement, reconciliation, healthy/degraded/unavailable states

## Translation structure

Translation files:

- `src/i18n/types.ts`
- `src/i18n/ko.ts`
- `src/i18n/en.ts`
- `src/i18n/ja.ts`
- `src/i18n/zh-CN.ts`
- `src/i18n/index.ts`

The runtime uses `archive.locale` in `localStorage` and falls back to `ko` for unsupported locale values.

## Implementation note

ArchiveOS already had a large set of static strings spread across many React components. To avoid changing business logic, API contracts, or component data models, the first i18n pass adds a key-based translation table and a small DOM application layer that translates static UI text after React renders.

This keeps the change limited to presentation while allowing the existing views to switch language immediately.

## Screens and components processed

- `AppShell`
- `Sidebar`
- `navigationItems`
- `OverviewPage`
- `ManagedSystemsPage`
- `EcosystemPage`
- `SettlementGamePage`
- `LedgerApprovalsPage`
- `WorkflowsPage`
- `KnowledgePage` and knowledge panels
- `HistoryPage`
- `AgentsPage`
- `BatchPage`
- `RpaPage`
- `AtlasPage`
- `McpRegistryPage`
- `SettingsPage`
- shared metric, section, button, and status badge UI

## Remaining hardcoded text

Some strings intentionally remain unmodified:

- Service names: `ArchiveOS`, `Archive-Nexus`, `Archive-Logistics`, `Archive-Ledger`, `Atlas`
- Internal compatibility spelling: `Archive-Logitics`, `logitics`
- API paths: `/api/ecosystem/summary`, `/api/approvals/external`, etc.
- Event types: `LOGISTICS_DISPATCHED`, `APPROVAL_REQUIRED`, `SETTLEMENT_READY`, etc.
- Enum/status raw values when shown as audit evidence
- Trace IDs and correlation IDs
- GitHub URLs, file paths, port numbers, shell commands
- Dynamic backend messages that do not have stable error codes yet

## Translation exclusions

The following are not translated because they are operating contracts rather than natural-language UI:

- API routes
- database identifiers
- Java/TypeScript class and package names
- repository names
- event IDs and idempotency keys
- local runtime process names

## Future improvement

The current pass is deliberately low-risk. A later cleanup can replace DOM application with direct `t("key")` calls inside every component once the UI stabilizes further. That would improve static analysis coverage and allow stricter missing-key tests.
# Console V3 i18n 감사

- 기본 언어: 한국어(`ko`), localStorage 키: `archive.locale`
- 지원 언어: `ko`, `en`, `ja`, `zh-CN`
- 변경: native select 및 MutationObserver 기반 DOM 재작성 제거
- 구조: `I18nProvider`와 `useI18n`을 사용해 React 렌더 단계에서 선택 언어를 유지
- 언어 선택: 우측 상단 지구본 popover, ESC 및 ARIA 상태 지원

번역하지 않는 값: API path, eventType, enum, correlationId, service ID, repository 이름, 내부 `logitics` 호환 키.

기존 상세 하위 화면에는 한국어 중심 운영 문구가 남아 있다. V3의 6개 핵심 메뉴·헤더·상태 선택기는 key 기반으로 우선 전환했으며, 이후 상세 화면별 문구 키 보강은 API/도메인 식별자에 영향을 주지 않는 범위에서 진행한다.
