# Archive 1.0 RC 릴리스 체크리스트

| 항목 | 상태 | 근거 |
|---|---|---|
| 5개 main 동기화 | PASS | local main = origin/main 확인 |
| 저장소별 test/build | PASS | main 병합 직후 각 저장소 최소 검증 완료 |
| Compose config | PASS | 5개 실제 RC 조합 검증 완료 |
| 순차 기동과 health | PASS | 8개 앱 endpoint HTTP 200 |
| restart/OOM | PASS | restart 0, OOMKilled false |
| migration | PASS | post-merge 기동에서 migration/fatal 오류 0 |
| 공식 E2E | PASS | COMPLETE_CHAIN, source 4, event 35 |
| security smoke | PASS | 401/401/403/canonical 성공 계약 확인 |
| env 보호 | PASS | runtime env tracked/staged 0 |
| network | PASS | PostgreSQL host publish 0, 앱 loopback only |
| background activity | PASS | 외부 요청 없는 60초 count 증가 0 |
| rollback 정보 | PASS | merge commit과 source branch 보존 |
| known limitations | PASS | [Known Limitations](ARCHIVE_1_0_KNOWN_LIMITATIONS.md) |
| World 분리 | PASS | Archive-World는 별도 branch, 미병합·미수정 |
| 외부 부하/장애 주입 | PENDING | GA 전 별도 검증 필요 |

## 서비스별 검증 명령 기준

| 저장소 | 검증 |
|---|---|
| ArchiveOS | `archiveos-ai/gradlew test bootJar`, frontend `npm test`, `npm run build` |
| Archive-Ledger | `gradlew clean test bootJar` |
| Archive-Logistics | `gradlew ciTest bootJar` (`integrationTest` 포함) |
| Archive-Nexus | `backend/gradlew test bootJar`, frontend `npm test`, `npm run build` |
| Archive-Market | `gradlew clean test bootJar` |

각 command는 해당 저장소의 현재 wrapper/manifest를 기준으로 한다. 운영 기동은 [Startup and Recovery](ARCHIVE_1_0_STARTUP_AND_RECOVERY.md)의 Compose 명령을 사용한다. Slack 완료 통지는 ArchiveOS의 기존 `POST /api/notifications` runner를 관리자 인증으로 사용하며, payload에 secret을 넣지 않는다.
