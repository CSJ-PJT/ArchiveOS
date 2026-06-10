# ArchiveOS Reality Validation Report

## 목적

이 문서는 ArchiveOS 확장 아이디어가 멋져 보이는 구조에 그치지 않고 실제 운영 가능한 시스템인지 검토합니다.

ArchiveOS의 원칙은 다음입니다.

```text
Human PM 중심
AI Agent 보조
읽기 전용 가시성 우선
실행 제어는 검증 이후
```

## 지금 추가하면 안 되는 기능

### 완전한 Agent Mesh 실행 구조

지금 바로 에이전트 간 자유 통신과 동적 실행을 넣으면 디버깅이 어려워집니다. 현재는 선형 파이프라인을 유지하고 Mesh는 관계/이벤트 시각화로만 도입하는 것이 안전합니다.

### GitHub Webhook 자동화

현재 우선순위는 로컬 런타임 진실성을 확보하는 것입니다. GitHub는 먼저 read-only 상태 표시부터 도입해야 합니다.

### MCP 또는 Codex 직접 제어

대시보드가 아직 visibility를 검증하는 단계입니다. start/stop/approve/execute 버튼이 실제 실행을 트리거하면 PM이 추적하기 어려운 경로가 생깁니다.

### OpenAI API 자동 리뷰

리뷰 기준과 데이터 모델이 안정화되기 전까지 자동 리뷰를 붙이면 판단 근거 추적이 어려워집니다.

### Bidirectional Obsidian Sync

초기에는 충돌, source of truth, 포맷 정합성 문제가 큽니다. Markdown export only가 적절합니다.

## 지금 추가해야 하는 기능

- 런타임 상태 정확도 개선
- 큐 카운트와 프론트 표시값 일치 확인
- 빌더/리뷰어 결과의 timestamp와 source 표시
- idle, stale, failed, usage-limit stop 구분
- 결정 기록과 리뷰 결과 연결
- DeepStake3D milestone 결과를 PM이 검토할 수 있는 요약

## Agent 필요성 감사

| Agent | 실제 필요성 | 지금 필요 여부 | 권장 단계 |
| --- | --- | --- | --- |
| Implementer | 구현 담당 | 필요 | Phase 1 |
| Reviewer | 품질 검토 | 필요 | Phase 1 |
| Loop | 큐 흐름 유지 | 필요 | Phase 1 |
| PM | 승인, 반려, 우선순위 | 필요 | Phase 2 |
| Architect | 구조 검토 | 아직 선택 | Phase 3 |
| Historian | 장기 기억 정리 | 아직 선택 | Phase 3 |
| Incident | 장애 분석 | 선택 | Phase 3 |
| UX | 화면 품질 검토 | 나중 | Phase 4 |
| GitHub Sync | PR/CI 읽기 | 나중 | Phase 3 |

## Mesh 복잡도 감사

Mesh 장점:

- 실제 조직형 협업 구조 표현 가능
- Agent 간 관계와 메시지 기록 가능
- Architect, Historian 같은 역할 추가 용이

Mesh 단점:

- 상태 추적 난이도 증가
- PM이 현재 책임자를 알기 어려워질 수 있음
- 디버깅과 rollback 경로 복잡

권장안:

```text
실행은 Pipeline
표시는 Hybrid Mesh
기록은 Event/Message 모델
```

## Obsidian ROI

추천 순서:

1. Markdown Export Only
2. Read Only Integration
3. Knowledge Graph Integration
4. Bidirectional Sync는 장기 후보

초기 ROI가 가장 큰 것은 결정과 리뷰 요약을 Markdown으로 export하는 것입니다.

## Knowledge Graph 현실 점검

MVP 데이터 소스는 다음만으로 충분합니다.

- Task
- Review
- Decision
- Commit
- Incident
- Screenshot

초기에는 복잡한 그래프 UI보다 “선택한 작업의 관련 리뷰/결정/커밋”을 보여주는 관계 패널이 더 실용적입니다.

## Phase 평가

### Phase 1: PM Dashboard

완료 수준: 대부분 완료

핵심:

- Runtime Flow
- Agent State
- Task Queue State
- Command Center
- Event Timeline
- Data Consistency
- Decisions

### Phase 2: 운영 기록 안정화

목표:

- 명령/결정/리뷰/이벤트 기록 구조 안정화
- DeepStake3D 같은 실제 작업 프로젝트의 milestone 검증 흐름 추적
- Obsidian Markdown export 준비

위험도: 낮음에서 중간

### Phase 3: 관계형 운영 모델

목표:

- Agent Mesh read-only view
- Knowledge Graph MVP
- GitHub read-only status
- Incident record

위험도: 중간

### Phase 4: 제한적 자동화

목표:

- 명시 승인 기반 자동화
- GitHub PR/CI 통합
- AI review job
- MCP 실행 제어 검토

위험도: 높음

## 실제 가치가 큰 기능

- 정확한 런타임 상태 표시
- 작업/리뷰/결정/커밋 연결
- stale과 usage limit 구분
- milestone별 검증 증거 보관
- DeepStake3D 같은 장기 프로젝트의 작업 흐름 회고

## 결론

ArchiveOS는 AI 자동화 도구보다 먼저 **AI 작업을 사람이 이해하고 신뢰할 수 있게 만드는 운영 시스템**이어야 합니다.

지금은 더 많은 에이전트를 추가하기보다, 현재 파이프라인의 사실성, 기록성, 설명 가능성을 강화하는 것이 운영 가치가 큽니다.
