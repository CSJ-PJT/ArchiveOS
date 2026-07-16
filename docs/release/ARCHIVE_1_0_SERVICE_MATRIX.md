# Archive 1.0 RC 서비스 매트릭스

| 서비스 | 구현/빌드 기준 | Health URL | loopback publish | DB volume | Runtime 역할 |
|---|---|---|---|---|---|
| ArchiveOS backend | Node 24 Alpine image | `http://127.0.0.1:4000/health` | `4000` | `archiveos_archiveos-postgres` | Runtime 진입·프론트엔드 backend |
| ArchiveOS AI | Java 21, Gradle 8.10.2 | `http://127.0.0.1:4100/health` | `4100` | ArchiveOS PostgreSQL 사용 | ingest, timeline, RAG, Decision Record |
| ArchiveOS frontend | Node 24 / nginx | `http://127.0.0.1:5173/` | `5173` | 없음 | 운영 UI |
| Market | Java 21, Gradle 8.10.2 | `http://127.0.0.1:8094/actuator/health` | `8094` | `archive-market_archive-market-postgres-data` | 주문·결제·outbox |
| Nexus | Java 21, Gradle 8.14.5 / Node 20 frontend | `http://127.0.0.1:8080/actuator/health` | `8080` | `archive-nexus_postgres-data` | routing·outbox·delivery |
| Logistics | Java 21, Gradle 8.14.5 | `http://127.0.0.1:8092/actuator/health` | `8092` | `archive-logistics_archive-logitics-postgres-data` | route·lifecycle·outbox·delivery |
| Ledger | Java 21, Gradle 8.14.5 | `http://127.0.0.1:18080/actuator/health` | `18080` | `archive-ledger_archive-ledger-postgres-data` | transaction·entry·settlement·delivery |

PostgreSQL은 host port를 publish하지 않는다. 표의 앱 포트는 검증용 loopback publish이며 외부 공개 endpoint가 아니다.

## Migration 방식

각 Java Runtime 서비스는 versioned SQL을 `src/main/resources/db/migration`에 두고 application startup에서 Flyway로 적용한다. 기동 후 migration error가 있으면 다음 서비스 기동·E2E·push를 진행하지 않는다. 기존 PostgreSQL volume을 삭제하거나 직접 SQL로 상태를 맞추지 않는다.

## 의존 및 lineage 계약

```text
Market → Nexus → Logistics → Ledger
   └────────── ArchiveOS runtime ingest ◀─────────┘
```

- canonical source identity: `archive-market`, `archive-nexus`, `archive-logistics`, `archive-ledger`
- 각 서비스는 자신의 runtime event를 ArchiveOS의 canonical ingest 경로로 전달한다.
- correlationId, orderId, simulationRunId 및 upstream causation은 전달 체인에서 보존한다.
- outbox publisher는 business transaction과 분리되며, duplicate eventId는 멱등 처리한다.
- Ledger 금융 입력은 canonical 금융 이벤트만 처리한다. 관제 전용 이벤트는 Ledger 금융 입력으로 확장하지 않는다.

## Compose와 비추적 설정

| 저장소 | 실제 Compose 조합 | 필요한 비추적 파일 |
|---|---|---|
| ArchiveOS | `docker-compose.yml` + `docker-compose.rc.yml` | `.env`, `.env.rc`, `backend/.env` |
| Ledger | `docker-compose.yml` | `.env.rc` |
| Logistics | `docker-compose.yml` + `../.runtime-integration-overrides/archive-logistics.runtime.yml` | `.env`, `.env.rc` |
| Nexus | `docker-compose.yml` + `../.runtime-integration-overrides/archive-nexus.runtime.yml` | `.env.rc`, `frontend/.env.local` |
| Market | `docker-compose.yml` + `docker-compose.rc.yml` | `.env.rc` |

실제 값은 이 문서와 Git에 넣지 않는다.
