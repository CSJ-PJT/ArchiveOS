# ArchiveOS → Atlas 단방향 SSO

## 계약

- ArchiveOS만 사용자를 인증한다.
- Atlas는 ArchiveOS가 발급한 1회성 PKCE 코드를 교환해 Atlas 공통 세션을 만든다.
- Atlas 계정이나 세션으로 ArchiveOS에 로그인하는 역방향 경로는 제공하지 않는다.
- ArchiveOS 관리 계정은 Atlas 포털 인증이 가능하다. 개별 Atlas 앱은 ArchiveOS 관리자가 별도로 부여한 권한만 사용한다.
- ArchiveOS 비밀번호와 패스키 원문은 Atlas로 전달하거나 복제하지 않는다.

## 보안 경계

- authorization code 유효 시간은 기본 90초이며 30~180초 범위로 제한된다.
- DB에는 authorization code의 SHA-256 해시만 저장한다.
- code는 `SELECT ... FOR UPDATE`와 `used_at` 조건으로 한 번만 교환한다.
- redirect URI는 정확한 allowlist 일치만 허용한다.
- Atlas 세션 쿠키는 HMAC 서명, `HttpOnly`, `Secure`, `SameSite=Lax`를 사용한다.
- `OPERATOR`, `PM`, `ADMIN` 관리 계정만 SSO code를 발급할 수 있다. 서비스 토큰과 공개/조회 전용 주체는 차단한다.

## 운영 설정

ArchiveOS:

- `ARCHIVEOS_ATLAS_SSO_ENABLED=true`
- `ARCHIVEOS_ATLAS_SSO_GATEWAY_URL=https://161.33.17.84`
- `ARCHIVEOS_ATLAS_SSO_ALLOWED_REDIRECTS=https://161.33.17.84/auth/archiveos/callback`
- `ARCHIVEOS_ATLAS_SSO_CODE_TTL_SECONDS=90`

Atlas gateway:

- `ARCHIVEOS_SSO_BASE_URL=https://archiveos.kr/archiveos`
- `ATLAS_SSO_PUBLIC_ORIGIN=https://161.33.17.84`
- `ATLAS_SSO_SESSION_SECRET`: 32바이트 이상의 별도 랜덤 비밀값
- `PORT=4179`

비밀값은 저장소, systemd unit, Nginx 설정, 브라우저 번들에 기록하지 않는다. Atlas gateway의 환경 파일은 root 소유 0600으로 둔다.

## 배포 게이트

1. ArchiveOS DB custom-format 전체 논리 백업과 `pg_restore --list`를 검증한다.
2. ArchiveOS 테스트, 백엔드 테스트, Java 테스트, Atlas gateway 테스트를 모두 통과시킨다.
3. ArchiveOS에 V41을 적용하고 신규 테이블 2개 및 Flyway 성공을 확인한다.
4. Atlas gateway를 loopback에서 실행하고 Nginx의 `/auth/archiveos/`만 프록시한다.
5. ArchiveOS 관리 화면에서 계정별 앱 권한을 부여한다.
6. portal 로그인, 권한 허용 앱, 권한 미부여 앱, code 재사용, 잘못된 state/redirect를 검증한다.
7. 기존 Atlas 공개 페이지와 API가 변경 전처럼 응답하는지 전수 확인한다.

## 범위

이 SSO는 Atlas 경로 전체에서 공유하는 우산형 인증과 앱 권한 계약이다. 각 앱이 자체 Supabase 등 별도 사용자 DB를 사용하는 경우 그 네이티브 세션을 임의로 생성하지 않는다. 앱별 쓰기 기능을 SSO 사용자에게 연결하려면 해당 앱이 `/auth/archiveos/session` 또는 Nginx `auth_request`의 검증된 주체/권한을 소비하도록 별도 연결한다.

## 롤백

- Atlas: Nginx `/auth/archiveos/` include와 client 주입을 제거하고 gateway unit을 중지한다.
- ArchiveOS: `ARCHIVEOS_ATLAS_SSO_ENABLED=false`로 code 발급/교환을 중지한다.
- V41 테이블은 인증 이력 보존을 위해 즉시 DROP하지 않는다. 스키마 제거는 별도 승인 작업으로 진행한다.
