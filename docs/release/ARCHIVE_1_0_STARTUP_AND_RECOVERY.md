# Archive 1.0 RC 기동·복구 절차

이 절차는 Ubuntu/WSL의 Archive 프로젝트 루트를 `<ARCHIVE_ROOT>`로 표기한다. 명령 실행 전 비추적 설정 파일을 안전한 경로에서 복원하고, Git에 stage하지 않는다.

## 1. Compose 정적 검증

```bash
cd <ARCHIVE_ROOT>/ArchiveOS
docker compose --env-file .env.rc -f docker-compose.yml -f docker-compose.rc.yml config --quiet

cd <ARCHIVE_ROOT>/Archive-Ledger
docker compose --env-file .env.rc config --quiet

cd <ARCHIVE_ROOT>/Archive-Logistics
docker compose --env-file .env --env-file .env.rc -f docker-compose.yml -f ../.runtime-integration-overrides/archive-logistics.runtime.yml config --quiet

cd <ARCHIVE_ROOT>/Archive-Nexus
docker compose --env-file .env.rc -f docker-compose.yml -f ../.runtime-integration-overrides/archive-nexus.runtime.yml config --quiet

cd <ARCHIVE_ROOT>/Archive-Market
docker compose --env-file .env.rc -f docker-compose.yml -f docker-compose.rc.yml config --quiet
```

하나라도 실패하면 기동하지 않는다. 오류에는 변수명·파일명·경로만 기록하고 값은 기록하지 않는다.

## 2. 순차 기동

```bash
cd <ARCHIVE_ROOT>/ArchiveOS && docker compose --env-file .env.rc -f docker-compose.yml -f docker-compose.rc.yml up -d --build
cd <ARCHIVE_ROOT>/Archive-Ledger && docker compose --env-file .env.rc up -d --build
cd <ARCHIVE_ROOT>/Archive-Logistics && docker compose --env-file .env --env-file .env.rc -f docker-compose.yml -f ../.runtime-integration-overrides/archive-logistics.runtime.yml up -d --build
cd <ARCHIVE_ROOT>/Archive-Nexus && docker compose --env-file .env.rc -f docker-compose.yml -f ../.runtime-integration-overrides/archive-nexus.runtime.yml up -d --build
cd <ARCHIVE_ROOT>/Archive-Market && docker compose --env-file .env.rc -f docker-compose.yml -f docker-compose.rc.yml up -d --build
```

순서는 ArchiveOS → Ledger → Logistics → Nexus → Market이다. 기존 DB volume은 삭제·초기화하지 않는다.

## 3. Health와 컨테이너 상태

```bash
curl -fsS http://127.0.0.1:4000/health
curl -fsS http://127.0.0.1:4100/health
curl -fsS http://127.0.0.1:18080/actuator/health
curl -fsS http://127.0.0.1:8092/actuator/health
curl -fsS http://127.0.0.1:8080/actuator/health
curl -fsS http://127.0.0.1:8094/actuator/health
docker ps -a
```

각 컨테이너의 restart count는 0, `OOMKilled`는 false여야 한다. `docker inspect`로 두 값을 확인한다. fatal startup·migration error·raw token pattern이 있으면 다음 서비스 작업을 중단한다.

## 4. 장애와 outbox

- delivery 실패가 business transaction을 되돌리게 하지 않는다.
- legacy backlog의 일괄 발행은 금지한다.
- 재발행은 correlation-scoped preview 또는 단일 eventId 기능처럼 기존의 범위 제한 경로만 사용한다.
- `FAILED`, `CONFIG_ERROR`, `NON_RETRYABLE` 상태는 해당 서비스의 retry 정책을 확인한 뒤 처리한다.
- stale `PUBLISHING` 상태는 기존 recovery 정책과 감사 로그를 확인한 뒤에만 다룬다.

## 5. 중단·복구 원칙

실패가 발생하면 해당 서비스에서 멈추고 원인·로그·Compose config를 보존한다. volume, DB 데이터, 기존 E2E 증거를 삭제하지 않는다. 재기동 전에는 health와 migration 상태를 재확인한다.
