# Archive 1.0 RC 보안 운영 기준

## 인증 경계

ArchiveOS runtime ingest의 검증 기준은 다음과 같다.

| 요청 | 기대 결과 |
|---|---:|
| token 없음 | 401 |
| 유효하지 않은 token | 401 |
| 유효 token + 잘못된 scope | 403 |
| header/body source 불일치 | 403 |
| canonical service identity와 scope가 일치하는 요청 | 2xx |

인증 실패는 무한 retry 대상이 아니다. 401/403 반복은 설정 또는 권한 오류로 보고 중단·조사한다.

## 네트워크와 설정 보호

- 앱 host publish는 loopback만 사용한다.
- PostgreSQL은 host에 publish하지 않는다.
- `.env`, `.env.rc`, `.env.local` 및 key 파일은 Git tracked/staged 상태가 아니어야 한다.
- secret, raw token, webhook URL, private key를 로그·문서·Slack에 기록하지 않는다.
- 환경 파일은 소유자 전용 권한을 우선 적용한다.

## RAG와 Decision Record의 경계

- RAG search와 ask는 별도 principal 기준 rate limit을 적용한다. 현재 기본값은 search 분당 60, ask 분당 12이며 초과 시 429와 재시도 정보를 반환한다.
- rate limit은 단일 인스턴스 메모리 기반이다. 다중 인스턴스 운영에는 shared 또는 edge rate limit이 추가로 필요하다.
- Decision Record는 사람 검토 기반 운영 기록이다. 자동 모델 학습·자동 모델 업데이트·자동 outcome feedback을 수행하지 않는다.
- AI가 비활성·검색 전용·모델 미사용 상태인 경우, UI와 API는 해당 상태를 구분해 표시해야 한다.
