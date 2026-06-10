# ArchiveOS Phase 2 아키텍처 제안

## 방향

ArchiveOS는 단순 AI 대시보드가 아니라 AI 조직 운영체계로 확장될 수 있습니다. 다만 Phase 2의 핵심은 실행 자동화가 아니라 **사람이 이해하고 추적할 수 있는 운영 가시성**입니다.

현재 구조는 다음 선형 흐름을 기준으로 합니다.

```text
Inbox -> Implementer -> Reviewer -> Decision
```

이 구조는 안정적이고 디버깅하기 쉽습니다. 따라서 즉시 Mesh 실행 구조로 바꾸지 않고, 먼저 기록과 시각화 모델만 확장합니다.

## Phase 2 목표

- 작업 상태, 결과, 리뷰, 결정의 출처를 명확히 표시
- PM이 터미널 없이 현재 병목과 다음 행동을 판단
- 명령과 승인/반려를 실행하지 않고 안전하게 기록
- 향후 Architect, Historian, GitHub Sync 같은 역할을 추가할 수 있는 데이터 모델 마련
- DeepStake3D 같은 외부 작업 프로젝트의 빌더/리뷰어 결과를 읽기 전용으로 관찰

## 구성 계층

### 1. Visibility Layer

Dashboard, Timeline, Operators, Decisions, GitHub, Settings 탭이 여기에 해당합니다.

### 2. Coordination Record Layer

명령 기록, 결정 기록, 작업 로그, 런타임 이벤트, 에이전트 상태를 저장합니다. 이 계층은 실행이 아니라 기록을 담당합니다.

### 3. External Runtime Layer

MCP 큐 파일, Codex 세션, Supabase 기록, Git/GitHub 상태, 향후 Obsidian export가 포함됩니다.

## 실행 제어 금지

Phase 2에서는 다음을 추가하지 않습니다.

- OpenAI API 호출
- MCP 직접 명령 실행
- Codex 직접 제어
- GitHub Webhook 자동화
- 임의 셸 실행
- UI 기반 프로세스 시작/중지

## DeepStake3D 관찰 모델

DeepStake3D는 ArchiveOS가 관찰하는 Unity 게임 PoC입니다. ArchiveOS는 DeepStake3D의 Unity 에디터나 게임 런타임을 직접 제어하지 않습니다.

ArchiveOS가 읽는 정보:

- MCP inbox / processing / outbox / review 큐 상태
- 최신 빌더 결과
- 최신 리뷰어 verdict
- 테스트 성공/실패 요약
- Codex 구현자/리뷰어 프로세스 감지 상태

## 성공 기준

Phase 2가 성공하려면 PM이 터미널을 열지 않고 다음 질문에 답할 수 있어야 합니다.

- 지금 시스템이 활성 상태인가?
- 현재 작업은 무엇인가?
- 누가 작업 중인가?
- 최신 빌더 결과는 무엇인가?
- 최신 리뷰 verdict는 무엇인가?
- 어디가 병목인가?
- 작업은 idle 상태인가, 실패 상태인가?

## 다음 단계

1. 읽기 전용 PM 가시성 안정화
2. Agent Mesh를 실행 구조가 아니라 관계/이벤트 시각화로 도입
3. Markdown export 방식으로 Obsidian 연계
4. GitHub는 자동화가 아니라 read-only status부터 도입
