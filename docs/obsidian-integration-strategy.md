# Obsidian 연계 전략

## 역할 분리

ArchiveOS와 Obsidian은 같은 역할을 하면 안 됩니다.

ArchiveOS는 실시간 운영 화면입니다.

- Runtime
- Queue
- Decisions
- Agent Operations
- Builder / Reviewer 결과
- PM 승인/반려 기록

Obsidian은 장기 기억 저장소입니다.

- 설계 기록
- 아키텍처 노트
- 결정 기록
- 리뷰 요약
- 장애/사고 회고
- 배운 점

## 권장 Vault 구조

```text
Vault/
  Projects/
    ArchiveOS/
    DeepStake3D/
  Decisions/
  Architecture/
    ArchiveOS/
    DeepStake3D/
  Incidents/
  Reviews/
  Daily/
```

## 1차 구현 권장안

초기에는 **Markdown Export Only**가 가장 적절합니다.

이유:

- 구현 비용이 낮습니다.
- ArchiveOS 런타임 안정성을 해치지 않습니다.
- Obsidian 포맷 오류가 ArchiveOS 운영에 영향을 주지 않습니다.
- 사람이 export 결과를 검토하고 정리할 수 있습니다.

## 권장하지 않는 방식

초기 단계에서 Bidirectional Sync는 권장하지 않습니다.

위험:

- 충돌 처리 비용 증가
- 어느 쪽이 source of truth인지 불명확
- PM이 추적하기 어려운 변경 경로 발생

## Export 대상

- PM 결정
- 리뷰 verdict
- milestone summary
- incident report
- DeepStake3D construction validation 결과
- ArchiveOS 운영 회고

## Markdown 예시

```markdown
# Decision: Add settlement-scale construction validation

- Project: DeepStake3D
- Source: ArchiveOS
- Type: PM Decision
- Status: approved
- Created: 2026-06-10

## Context

World Construction Milestone 1 검증 결과를 바탕으로 settlement-scale validation을 승인했다.

## Evidence

- 필수 PlayMode 테스트 통과
- chunk boundary validation 통과
- persistence regression 없음
```

## ArchiveOS UI 연계

- Decisions 탭: 선택한 결정 export
- Timeline 탭: 이벤트 묶음 export
- Settings 탭: 로컬 vault 경로 안내

설정에 secret 값을 표시하지 않습니다. Export 경로도 로컬 설정으로만 관리합니다.
