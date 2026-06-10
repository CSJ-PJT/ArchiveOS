# Agent Mesh 데이터 모델

## 목적

Agent Mesh는 즉시 복잡한 자동 실행 구조를 만들기 위한 것이 아닙니다. 먼저 에이전트, 메시지, 이벤트, 결정의 관계를 기록하고 PM이 이해할 수 있게 보여주기 위한 모델입니다.

현재 선형 파이프라인은 유지합니다.

```text
Inbox -> Implementer -> Reviewer -> Decision
```

Mesh는 이 위에 읽기 전용 관계 레이어로 추가합니다.

## 기본 에이전트 역할

| 역할 | 책임 | 현재 필요성 | 권장 단계 |
| --- | --- | --- | --- |
| Implementer | 작업 구현, 결과 작성 | 필수 | Phase 1 |
| Reviewer | 구현 결과 검토, 승인/반려 판단 | 필수 | Phase 1 |
| Loop | 큐 이동과 반복 흐름 관리 | 필수 | Phase 1 |
| PM | 우선순위, 승인, 반려, 방향 결정 | 필수 | Phase 2 |
| Architect | 구조 설계와 큰 방향 검토 | 선택 | Phase 3 |
| Historian | 결정과 변경 이력 정리 | 선택 | Phase 3 |
| Incident | 장애와 stale 상태 분석 | 선택 | Phase 3 |
| UX | 사용자 경험과 화면 검토 | 선택 | Phase 4 |
| GitHub Sync | PR, CI, commit 상태 읽기 | 선택 | Phase 3 |

## 상태값

에이전트 상태는 사람이 이해할 수 있어야 합니다.

- `idle`: 대기 중
- `working`: 구현 또는 처리 중
- `reviewing`: 리뷰 중
- `waiting`: 입력 또는 다음 작업 대기
- `failed`: 실패 또는 연결 불가

## 메시지 모델

향후 `agent_messages` 테이블을 둘 수 있습니다.

```text
id
from_agent_id
to_agent_id
task_id
message_type
content
source
created_at
```

메시지는 실행 명령이 아니라 운영 기록입니다.

## 이벤트 모델

```text
id
event_type
source
agent_id
task_id
title
description
status
created_at
```

source 예시:

- `mcp`
- `supabase`
- `backend`
- `github`
- `manual_pm`

## DeepStake3D 적용 예시

DeepStake3D 건설 시스템 작업에서는 다음 이벤트가 유효합니다.

- Implementer가 ModularConstructionPrototype 변경 완료
- Reviewer가 persistence regression 여부 검토
- PM이 milestone approve 또는 hold 기록
- Historian이 settlement validation 결과를 장기 기록으로 export

## 도입 원칙

- Mesh는 먼저 시각화와 기록으로만 도입합니다.
- 에이전트 간 직접 실행 통신은 나중 단계입니다.
- PM이 추적할 수 없는 자동화 경로는 만들지 않습니다.
- 모든 이벤트에는 source와 timestamp가 있어야 합니다.
