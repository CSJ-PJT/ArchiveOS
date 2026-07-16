# ArchiveOS Productization V4 Design System

## 기본 테마

ArchiveOS의 기본 제품 테마는 light다. 저장된 `archiveos.theme` 값이 없으면 라이트 테마를 적용한다. 다크 테마는 기존 사용자 선택을 보존하는 선택 기능이다.

## 핵심 토큰

| 토큰 | 용도 |
| --- | --- |
| `--color-bg` | 페이지 배경 |
| `--color-surface` | 카드와 입력 표면 |
| `--color-surface-muted` | 보조 정보와 데이터 셀 |
| `--color-border` | 카드·테이블·필터 경계 |
| `--color-text`, `--color-text-muted` | 주 정보와 보조 설명 |
| `--color-primary` | 이동·새로고침·선택 상태 |
| `--color-success`, `--color-warning`, `--color-danger` | 정상·주의·실패 상태 |
| `--color-unavailable`, `--color-stale`, `--color-no-data` | 연결 실패·오래된 수집·미수집 상태 |
| `--shadow-card`, `--radius-card` | 카드 깊이와 모서리 규칙 |

상태는 색상만으로 전달하지 않는다. 점·배지·텍스트를 함께 사용하며, 수치가 없을 때는 `데이터 없음`을 명시한다.

## 정보 밀도

- KPI는 값, 상태, 기준 시간 또는 계산 범위만 표시한다.
- 추세 데이터가 없으면 sparkline을 만들지 않는다.
- URL, correlationId, traceId는 고정 폭 글꼴·ellipsis·copy 동작을 사용한다.
- raw JSON은 상세 정보 안에서만 접어서 보여 주며 민감해 보이는 key는 마스킹한다.
