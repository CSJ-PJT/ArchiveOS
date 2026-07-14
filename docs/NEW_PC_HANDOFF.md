# ArchiveOS 새 PC 이전 핸드오프

작성 기준: 2026-07-14. 이 문서는 원격 브랜치와 현재 커밋을 읽기 전용으로 확인한 결과를 기록한다. **어떤 저장소도 main에 병합하지 않았다.**

## 1. 원격 브랜치 기준점

새 PC에서는 아래 URL을 clone한 뒤, 반드시 해당 브랜치와 커밋을 확인한다. `main`을 checkout하거나 merge하지 않는다.

| 저장소 | Clone URL | checkout 브랜치 | 기준 커밋 |
| --- | --- | --- | --- |
| ArchiveOS | `https://github.com/CSJ-PJT/ArchiveOS.git` | `feat/archiveos-productization-v4` | `7dd775d` |
| Archive-Market | `https://github.com/CSJ-PJT/Archive-Market.git` | `feat/final-runtime-lineage` | `968640e` |
| Archive-Nexus | `https://github.com/CSJ-PJT/Archive-Nexus.git` | `feat/final-runtime-lineage` | `b97fdeb` |
| Archive-Logistics | `https://github.com/CSJ-PJT/Archive-Logistics.git` | `chore/rc-security-baseline` | `f32de4f` |
| Archive-Ledger | `https://github.com/CSJ-PJT/Archive-Ledger.git` | `feat/rc-security-baseline` | `3de85fa` |

예시:

```powershell
git clone https://github.com/CSJ-PJT/ArchiveOS.git
Set-Location ArchiveOS
git switch feat/archiveos-productization-v4
git rev-parse --short HEAD  # 7dd775d 이어야 함
git status --short
```

각 저장소에서 같은 방식으로 branch와 SHA를 확인한다. 작업 폴더 권장 구조는 다음과 같다.

```text
<workspace>\ArchivePJT\
  ArchiveOS\
  Archive-Market\
  Archive-Nexus\
  Archive-Logitics\     # 현재 로컬 폴더명(원격 저장소명은 Archive-Logistics)
  Archive-Ledger\
  Archive-World\        # 별도 Git LFS 기반 Digital Twin 저장소
  .runtime-integration-overrides\
```

## 2. 비밀 및 로컬 설정 이전 원칙

값, 토큰, API 키, Vault 절대 경로, DB 비밀번호는 Git·문서·스크린샷·채팅에 넣지 않는다. 새 PC에 다음 파일을 일반 파일 복사, Git add 또는 클라우드 공유 폴더로 옮기지 않는다.

- `ArchiveOS\.env`, `ArchiveOS\.env.rc`, `ArchiveOS\backend\.env`
- `ArchiveOS\tools\runtime\runtime.config.json`
- `Archive-Market\.env.rc`
- `Archive-Nexus\.env.rc`, `Archive-Nexus\frontend\.env.local`
- `Archive-Logitics\.env`, `Archive-Logitics\.env.rc`
- `Archive-Ledger\.env.rc`

위 파일은 현재 PC에서 Git 비추적/ignored 상태다. 꼭 이전해야 할 경우에는 **파일명 목록만 확인한 뒤**, 암호화된 비밀관리 도구 또는 암호화된 오프라인 매체로 운영자가 직접 이전한다. 새 PC에서는 저장소의 `.env.example`을 기반으로 새 파일을 만들고, 값은 비밀관리 도구에서 주입하는 방식을 우선한다.

다음은 비밀 자체가 아니라 Compose 통합용 로컬 오버라이드이다. 그래도 토큰 환경변수 참조를 포함할 수 있으므로 Git에 추가하지 말고, 내용 검토 후 안전한 채널로만 이전한다.

- `.runtime-integration-overrides\archive-nexus.runtime.yml`
- `.runtime-integration-overrides\archive-logistics.runtime.yml`

### 새 PC에서 필요한 환경변수 이름

아래는 **이름만** 정리한 것이다. 동일한 통합 토큰은 발급 정책에 따라 새 PC에서 다시 주입하거나 안전한 비밀관리 경로로 복원한다.

| 범위 | 필수/주요 환경변수 이름 |
| --- | --- |
| ArchiveOS DB·AI | `POSTGRES_DB`, `POSTGRES_USER`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `OPENAI_API_KEY`, `SPRING_AI_OPENAI_CHAT_OPTIONS_MODEL`, `SPRING_AI_OPENAI_EMBEDDING_OPTIONS_MODEL`, `OBSIDIAN_VAULT_PATH`, `HOST_OBSIDIAN_VAULT_PATH` |
| ArchiveOS 내부 인증·생태계 | `ARCHIVE_TOKEN_MARKET_TO_OS`, `ARCHIVE_TOKEN_NEXUS_TO_OS`, `ARCHIVE_TOKEN_LOGISTICS_TO_OS`, `ARCHIVE_TOKEN_LEDGER_TO_OS`, `ARCHIVE_TOKEN_AUTHENTICATED_READ`, `ARCHIVE_TOKEN_ADMIN_OPERATOR`, `ARCHIVE_TOKEN_OS_TO_LEDGER`, `ARCHIVEOS_INTEGRATION_TOKEN`, `ARCHIVE_ECOSYSTEM_SERVICES_MARKET_BASE_URL`, `ARCHIVE_ECOSYSTEM_SERVICES_NEXUS_BASE_URL`, `ARCHIVE_ECOSYSTEM_SERVICES_LOGITICS_BASE_URL`, `ARCHIVE_ECOSYSTEM_SERVICES_LEDGER_BASE_URL`, `ARCHIVE_WORLD_ADAPTER_MODE`, `ARCHIVE_WORLD_MANIFEST_PATH` |
| Archive-Market | `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `ARCHIVEOS_BASE_URL`, `ARCHIVEOS_PUBLISH_PATH`, `ARCHIVE_TOKEN_MARKET_TO_OS`, `ARCHIVE_TOKEN_MARKET_TO_NEXUS`, `ARCHIVE_TOKEN_MARKET_TO_LEDGER`, `NEXUS_BASE_URL`, `LEDGER_BASE_URL`, `MARKET_INTERNAL_SYNTHETIC_PUBLISH_ENABLED`, `MARKET_OUTBOX_SCHEDULER_ENABLED`, `ARCHIVE_RUNTIME_AUTORUN_ENABLED` |
| Archive-Nexus | `ARCHIVE_NEXUS_DB_URL`, `ARCHIVE_NEXUS_DB_USERNAME`, `ARCHIVE_NEXUS_DB_PASSWORD`, `ARCHIVEOS_BASE_URL`, `ARCHIVEOS_RUNTIME_INGEST_ENABLED`, `ARCHIVEOS_RUNTIME_INGEST_SCHEDULER_ENABLED`, `ARCHIVE_TOKEN_NEXUS_TO_OS`, `ARCHIVE_TOKEN_MARKET_TO_NEXUS`, `ARCHIVE_TOKEN_NEXUS_TO_LOGISTICS`, `ARCHIVE_TOKEN_NEXUS_TO_LEDGER`, `ARCHIVE_TOKEN_AUTHENTICATED_READ`, `ARCHIVE_TOKEN_ADMIN_OPERATOR`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD` |
| Archive-Logistics | `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `ARCHIVEOS_BASE_URL`, `ARCHIVEOS_RUNTIME_INGEST_ENABLED`, `ARCHIVEOS_RUNTIME_INGEST_SCHEDULER_ENABLED`, `ARCHIVE_TOKEN_LOGISTICS_TO_OS`, `ARCHIVE_TOKEN_NEXUS_TO_LOGISTICS`, `ARCHIVE_TOKEN_LOGISTICS_TO_LEDGER`, `ARCHIVE_TOKEN_AUTHENTICATED_READ`, `ARCHIVE_TOKEN_ADMIN_OPERATOR`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` |
| Archive-Ledger | `ARCHIVE_LEDGER_DB_URL`, `ARCHIVE_LEDGER_DB_USERNAME`, `ARCHIVE_LEDGER_DB_PASSWORD`, `ARCHIVE_LEDGER_POSTGRES_DB`, `ARCHIVE_LEDGER_POSTGRES_USER`, `ARCHIVE_LEDGER_POSTGRES_PASSWORD`, `ARCHIVEOS_BASE_URL`, `ARCHIVEOS_RUNTIME_INGEST_ENABLED`, `ARCHIVEOS_RUNTIME_INGEST_SCHEDULER_ENABLED`, `ARCHIVE_TOKEN_LEDGER_TO_OS`, `ARCHIVE_TOKEN_MARKET_TO_LEDGER`, `ARCHIVE_TOKEN_NEXUS_TO_LEDGER`, `ARCHIVE_TOKEN_LOGISTICS_TO_LEDGER`, `ARCHIVE_TOKEN_OS_TO_LEDGER`, `ARCHIVE_TOKEN_AUTHENTICATED_READ`, `ARCHIVE_TOKEN_ADMIN_OPERATOR` |
| Slack | `SLACK_BOT_TOKEN`, `SLACK_CHANNEL`, `SLACK_WEBHOOK_URL` |

## 3. Docker volumes와 기동 순서

기존 PC의 volume을 새 PC로 옮기는 작업은 별도 백업/복구 절차가 필요한 운영 작업이다. `docker compose down -v`, volume 삭제, DB 초기화는 하지 않는다. 새 PC에서는 새 volume으로 기동하고 필요한 경우에만 검증된 DB backup을 복원한다.

현재 로컬에서 사용하는 주요 named volume 이름:

- `archiveos_archiveos-postgres`
- `archive-market_archive-market-postgres-data`
- `archive-nexus_postgres-data`
- `archive-nexus_grafana-data`
- `archive-nexus_prometheus-data`
- `archive-logitics_archive-logitics-postgres-data`
- `archive-ledger_archive-ledger-postgres-data`

기동 전 모든 `.env`/오버라이드 파일을 안전하게 주입하고, 다음 순서를 지킨다. 각 단계의 health가 정상일 때만 다음 서비스로 진행한다.

1. **ArchiveOS**: PostgreSQL, archiveos-ai, backend, frontend를 기동한다.
2. **Archive-Ledger**: Ledger와 Ledger PostgreSQL을 기동한다.
3. **Archive-Logistics**: Logistics와 PostgreSQL을 기동한다. 필요하면 `.runtime-integration-overrides\archive-logistics.runtime.yml`을 함께 사용한다.
4. **Archive-Nexus**: Nexus, PostgreSQL, Prometheus, Grafana를 기동한다. 필요하면 `.runtime-integration-overrides\archive-nexus.runtime.yml`을 함께 사용한다.
5. **Archive-Market**: Market과 PostgreSQL을 기동한다.

기본 명령 예시(각 저장소 루트에서 실행):

```powershell
# ArchiveOS
docker compose up -d --build

# Archive-Ledger
docker compose up -d --build

# Archive-Logistics (통합 오버라이드가 필요한 경우)
docker compose -f docker-compose.yml -f ..\.runtime-integration-overrides\archive-logistics.runtime.yml up -d --build

# Archive-Nexus (통합 오버라이드가 필요한 경우)
docker compose -f docker-compose.yml -f ..\.runtime-integration-overrides\archive-nexus.runtime.yml up -d --build

# Archive-Market
docker compose -f docker-compose.yml -f docker-compose.rc.yml up -d --build
```

실제 Compose 파일 조합은 새 PC에 복원한 로컬 환경 파일과 일치해야 한다. 실행 전에는 각 저장소에서 `docker compose ... config --quiet`로 interpolation을 확인한다.

## 4. Health URL 및 최초 기동 검증

현재 로컬 포트 기준 URL은 다음과 같다. 새 PC에서 포트 정책을 바꿨다면 해당 Compose 포트에 맞춰 수정한다.

| 대상 | URL |
| --- | --- |
| ArchiveOS UI | `http://127.0.0.1:5173/` |
| ArchiveOS backend | `http://127.0.0.1:4000/health` |
| ArchiveOS AI | `http://127.0.0.1:4100/health` |
| Archive-Market | `http://127.0.0.1:8094/actuator/health` |
| Archive-Nexus | `http://127.0.0.1:8080/actuator/health` |
| Archive-Logistics | `http://127.0.0.1:8092/actuator/health` |
| Archive-Ledger | `http://127.0.0.1:18080/actuator/health` |
| Nexus Grafana (선택) | `http://127.0.0.1:13000/` |
| Nexus Prometheus (선택) | `http://127.0.0.1:19090/` |

최초 기동 후의 최소 검증 명령:

```powershell
# 각 저장소에서 Compose 계약 검증
docker compose config --quiet

# ArchiveOS
npm.cmd run test
npm.cmd run build
Set-Location backend; npm.cmd run test; npm.cmd run typecheck; npm.cmd run build
Set-Location ..\archiveos-ai; .\gradlew.bat test --no-daemon --console=plain --no-watch-fs; .\gradlew.bat bootJar --no-daemon --console=plain --no-watch-fs

# Market/Nexus/Logistics/Ledger: 각 저장소의 Gradle wrapper 위치에서
.\gradlew.bat test --no-daemon --console=plain --no-watch-fs
.\gradlew.bat bootJar --no-daemon --console=plain --no-watch-fs

# 서비스 health
Invoke-WebRequest http://127.0.0.1:8094/actuator/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8080/actuator/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:8092/actuator/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:18080/actuator/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:4000/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:4100/health -UseBasicParsing
```

통합 런타임을 시작하기 전에는 `ARCHIVEOS_RUNTIME_INGEST_ENABLED=true` 및 각 scheduler enabled 환경변수가 **Nexus/Logistics/Ledger**에 설정되어 있는지, ArchiveOS의 source별 token mapping과 allowlist가 설정되어 있는지 확인한다. 값은 출력하지 않는다.

## 5. Slack 재연결

1. 새 PC의 ArchiveOS 로컬 비밀 설정에 `SLACK_BOT_TOKEN`, `SLACK_CHANNEL`, `SLACK_WEBHOOK_URL` 중 현재 배포 방식에서 사용하는 값만 비밀관리 도구로 주입한다.
2. Slack App을 다시 설치하거나 workspace 권한이 바뀌었다면 Bot Token Scopes와 대상 channel 접근 권한을 Slack 관리 화면에서 재승인한다.
3. 대상 channel에 앱을 초대한다.
4. ArchiveOS를 재기동한 뒤, 민감정보를 포함하지 않는 테스트 알림 1건으로 webhook/bot 연결을 확인한다.
5. 실패 시 token 값이나 webhook URL을 로그·문서에 붙이지 말고, HTTP status와 안전하게 정제된 오류만 기록한다.

GitHub Actions 실패 알림을 메일 대신 Slack으로 바꾸는 작업은 GitHub 조직/저장소 알림 또는 Slack GitHub App 설정에서 별도로 수행한다. 이 저장소의 Slack 환경변수와 GitHub 알림 수신 설정은 서로 다른 설정 경계다.

## 6. Archive-World 상태

- 원격: `https://github.com/CSJ-PJT/Archive-World.git`
- 준비 브랜치: `feat/archive-world-v1` (main merge 금지)
- 현재 상태: 실제 GLB 24개와 road GLB 7개가 Blender Scene에 배치됐고, layout·Viewer typecheck/test/build·원본 checksum 검증은 통과했다.
- 초기 커밋과 push는 보류 상태다. `archive-city-v1.blend`가 약 2.42GiB로 GitHub Free/Pro Git LFS의 단일 파일 2GiB 제한을 초과한다. Scene을 분할하거나 GitHub Team/Enterprise LFS 한도를 확보한 뒤에만 커밋한다.
- 새 PC에서 Archive-World를 clone 대상으로 추가하기 전, 원격 branch와 첫 commit SHA를 확인한다. 아직 SHA가 없으면 World 자산을 임의로 복사하거나 생성하지 않는다.
- ArchiveOS World Adapter는 manifest를 읽는 경계만 가지므로, World 소스/자산을 자동으로 복사하거나 컨테이너에 포함하지 않는다.

## 7. 이전 완료 체크리스트

- [ ] 5개 원격 브랜치를 정확히 checkout했고 SHA가 표의 기준과 일치한다.
- [ ] local `.env`와 통합 오버라이드를 Git에 추가하지 않았다.
- [ ] 필요한 secret은 비밀관리 도구에서만 주입했다.
- [ ] 각 Compose configuration 검증이 성공했다.
- [ ] DB volume을 삭제하거나 초기화하지 않았다.
- [ ] 순서대로 기동한 모든 health URL이 200이다.
- [ ] ArchiveOS SSE 및 live-flow 조회가 정상이다.
- [ ] Slack 테스트 알림이 지정 channel에서 수신된다.
- [ ] `git status --short`가 clean이며 main merge가 수행되지 않았다.

## 8. 원격 검증 결과

2026-07-14에 `git fetch origin --prune` 및 `git ls-remote --heads`로 확인했다. 모든 원격 브랜치가 존재하며 local HEAD, origin branch, 기준 SHA가 일치한다.

| 저장소 | 원격 브랜치 존재 | local/origin SHA 일치 |
| --- | --- | --- |
| ArchiveOS | 예 | 예 (`7dd775d`) |
| Archive-Market | 예 | 예 (`968640e`) |
| Archive-Nexus | 예 | 예 (`b97fdeb`) |
| Archive-Logistics | 예 | 예 (`f32de4f`) |
| Archive-Ledger | 예 | 예 (`3de85fa`) |

이 핸드오프 시점에 main merge는 수행되지 않았다.
