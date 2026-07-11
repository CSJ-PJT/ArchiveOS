# ArchiveOS Dashboard Rework Phase 1.1 비교 기록

## 기준 이미지

- 목표 시안: 사용자가 제공한 4분할 이미지의 좌측 상단 Dashboard
- 참조 경로: `C:\Users\dan18\Documents\ArchivePJT\.codex-remote-attachments\019f0919-8f68-7b11-a69c-620bc0f0886a\885b3d86-9066-4a8c-85eb-b7289bd4793d\1-Photo-1.jpg`
- 로고: 기존 ArchiveOS 로고와 App Shell을 유지한다.

## 작업 전 비교표

| 시안 요소 | 현재 구현 상태 | 차이 | 수정 방법 | 완료 여부 |
| --- | --- | --- | --- | --- |
| 1440 첫 화면 정보 밀도 | KPI, 메쉬, 이벤트가 표시됨 | 이벤트와 후속 영역의 세로 밀도가 불안정함 | Header·KPI·메쉬·이벤트 높이 재압축 | 진행 중 |
| Header 컨트롤 | 전역 Header와 본문에 상태/갱신/새로고침 존재 | 갱신·새로고침이 중복됨 | 본문에서는 전체 상태/실시간 수집 배지만 유지 | 진행 중 |
| KPI 5개 | 실제 데이터와 trend 사용 | 긴 설명과 CTA가 일부 폭에서 잘림 | 보조 문구 1줄, 모바일 축약 문구, 상태별 trend 색상 | 진행 중 |
| 메쉬 | 실제 runtime event edge/token 표시 | edge 대비와 token/count 위치가 겹칠 수 있음 | edge segment, count anchor, cluster 제거, contrast 강화 | 진행 중 |
| 상세 탐색 | 선택 시 3개 카드가 메쉬 위에 표시됨 | 상세가 넓고 복수 카드로 보임 | 닫힌 기본 상태 + 단일 compact drawer로 변경 | 진행 중 |
| 최근 이벤트 | 메쉬 아래 4건 표시 | 작은 화면에서 항상 보이는 밀도 보강 필요 | 독립 compact card와 4/3건 반응형 유지 | 진행 중 |
| 모바일 Header/KPI | 2열 KPI와 흐름 요약 있음 | 상단 높이, CTA와 status chip 중복 | Header 압축, CTA arrow, status row 단일화 | 진행 중 |
| 모바일 메쉬 | SVG 대신 노드 목록 사용 | 활성 경로 목록이 부족함 | 실제 active edge 목록을 노드 목록 앞에 표시 | 진행 중 |

## 반복 비교 기록

### Pass A — 레이아웃 및 중복 컨트롤

- 산출물: `docs/screenshots/productization-v4-dashboard-rework/desktop-pass-a.png`
- 결과: 본문 갱신 시각과 새로고침을 제거했다. 전역 Header의 연결 상태·언어·갱신 시각·icon refresh만 유지했다.
- 결과: 1440×900에서 KPI 5개, 메쉬 전체, 최근 이벤트 4건이 같은 첫 화면에 표시되며 상세 drawer는 기본 닫힘 상태다.

### Pass B — 메쉬 가독성 및 이벤트

- 산출물: `docs/screenshots/productization-v4-dashboard-rework/desktop-pass-b.png`
- 결과: 중복된 동일 source→target edge를 하나의 시각 edge로 정규화했다. count badge와 token을 분리하고, token은 node card 바깥 edge segment에서 실제 event 1건당 한 번만 이동 후 투명해진다.
- 결과: node, edge, token 클릭 시 단일 drawer가 열리고 ESC와 backdrop click으로 닫힌다.

### Pass C — 모바일 압축

- 산출물: `docs/screenshots/productization-v4-dashboard-rework/mobile-final-390.png`
- 결과: 390px에서는 SVG 대신 실제 active edge 목록과 서비스 상태 목록을 표시한다. 메쉬 status chip은 제목 우측의 한 줄로만 유지한다.
- 결과: KPI CTA는 화살표로 축약하고 실제 추세 설명은 `최근 30분`, `승인 큐 기준`, `처리 대기 기준`으로 축약했다.

## 최종 비교

- 나란히 비교: `docs/screenshots/productization-v4-dashboard-rework/side-by-side-final.png`
- Desktop: `desktop-final-1440.png`, `desktop-final-1920.png`
- Tablet: `tablet-final-768.png`
- Mobile: `mobile-final-390.png`

### 완료 판정

| 항목 | 결과 |
| --- | --- |
| 첫 화면의 KPI 5개·메쉬·최근 이벤트 | 충족 |
| 전역/본문 Header 중복 제거 | 충족 |
| 상세 기본 닫힘·단일 drawer | 충족 |
| 실제 runtime event만 token 처리 | 충족 |
| 모바일 SVG 대체 flow list | 충족 |
| 가짜 metric/무작위 animation | 사용하지 않음 |
