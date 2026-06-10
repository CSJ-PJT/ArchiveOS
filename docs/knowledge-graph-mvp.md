# Knowledge Graph MVP

## 목적

ArchiveOS는 Obsidian 전체 Graph 기능을 복제할 필요가 없습니다. MVP에서는 PM이 작업 맥락을 이해할 수 있는 최소 관계 그래프만 필요합니다.

## 우선 노드

| 노드 | 의미 |
| --- | --- |
| Task | 작업 단위 |
| Review | 리뷰 결과 |
| Decision | 승인, 반려, 보류 |
| Commit | Git commit 또는 향후 GitHub commit |
| Incident | 실패, stale, 사용량 제한, 런타임 장애 |
| Screenshot | 결과 증거 이미지 |

## 우선 관계

```text
Task -> Review
Review -> Decision
Decision -> Commit
Incident -> Task
Screenshot -> Review
```

## DeepStake3D 예시

```text
Task: Chunk World Foundation Milestone 1
  -> Review: final approve
  -> Decision: commit allowed
  -> Commit: Add chunk world construction grouping
```

이 정도 관계만 있어도 PM은 어떤 작업이 어떤 검증을 거쳐 commit으로 이어졌는지 추적할 수 있습니다.

## MVP 화면

초기 화면은 복잡한 그래프 엔진이 아니라 단순 관계 리스트로 충분합니다.

- 선택한 Task의 관련 Review
- 관련 Decision
- 관련 Commit
- 관련 Incident
- 관련 Screenshot

## 나중에 추가할 수 있는 것

- Agent 간 메시지 관계
- GitHub PR / CI 관계
- Obsidian note backlink
- 검색 가능한 graph view

## 도입 원칙

- PM이 이해할 수 없는 자동 관계 생성을 피합니다.
- seed/demo 데이터는 live operational truth처럼 표시하지 않습니다.
- 모든 관계에는 source와 created_at이 있어야 합니다.
