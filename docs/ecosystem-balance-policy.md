# 생태계 균형 분석 정책

모든 금액은 Synthetic Runtime Data다. ArchiveOS는 수수료·자금을 자동으로 이동하거나 외부 서비스 설정을 변경하지 않는다.

초기 권장 영업이익률 범위는 설정 가능한 정책값으로 관리한다.

- Market: 8~18%
- Nexus: 5~12%
- Logistics: 3~10%
- Ledger: 4~12%
- ArchiveOS: 0~8% 비용 회수 기준

읽기 전용 분석은 매출·비용·이익·현금·적체·이익 집중도를 비교한다. 40% 초과 이익률은 집중 검토, -10% 미만은 손익 압박으로 표시한다. GMV와 인식 매출은 같은 값으로 취급하지 않는다.

`POST /api/ecosystem/balance/simulate`은 ADMIN 전용 DRY_RUN이며 외부 자금·수수료를 변경하지 않는다.
