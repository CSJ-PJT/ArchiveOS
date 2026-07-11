# ArchiveOS Console V3 진단

## 작업 시작 기준

- 기준 HEAD: `f2ed9d9355e1d5f74e91b33af1746abb68016bca`
- 기준 화면: `OS.zip`에 포함된 기존 운영 개요, 실시간 관제, 재무, 작업 역량, 시스템 관리 화면
- 대상: ArchiveOS 콘솔만 수정하며 Market, Nexus, Logistics, Ledger는 읽기 전용 계약으로 확인한다.

## 발견 사항

| 항목 | 기존 상태 | V3 처리 |
| --- | --- | --- |
| 탐색 | 16개 상위 메뉴 | 대시보드·서비스·운영·재무·기록·설정 6개로 통합 |
| 초기 조회 | AppShell에서 약 30개 API를 45초마다 전체 조회 | 현재 화면에 필요한 API만 조회 |
| 실시간 관제 | 15초 수집 기반 화면 갱신 | SSE 우선, 연결 실패 때만 최근 이벤트 폴백 |
| DeepStake | placeholder가 핵심 관리 시스템 집계에 포함 | 핵심 화면·집계에서 분리, 향후 Labs 전용 |
| Atlas | 핵심 대시보드 상태와 섞임 | 서비스 > 외부 연동으로 분리 |
| 무데이터 | 0과 미수집 상태가 혼재 | 없음·연동 안 됨·데이터 없음으로 구분 |
| 언어 | native select + DOM MutationObserver 교체 | React I18nProvider + popover 선택기 |

## 반응형 확인 대상

390px, 430px, 768px, 1440px, 1920px에서 6개 핵심 화면과 언어 선택 메뉴를 확인한다.
