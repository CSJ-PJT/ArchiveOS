# ArchiveOS 에이전트 작업 규칙

## 목표 구조

ArchiveOS는 React 기반 운영 콘솔과 Java/Spring 기반 백엔드 런타임으로 구성합니다.

- `src/`: React, Vite, TypeScript 기반 Operator Console
- `archiveos-ai/`: Java 21, Spring Boot, Spring AI, Spring Batch 기반 핵심 백엔드
- `backend/`: Java 전환이 끝날 때까지 유지하는 기존 Node/Express 호환 계층
- `docs/`: 아키텍처, 운영, 마이그레이션, 브랜드 문서

프론트엔드 TypeScript는 유지합니다. 백엔드의 비즈니스 로직, 스케줄러, 프록시와 데이터 접근은 단계적으로 Java로 이전합니다.

## 저장소 작업 원칙

- `main`에 직접 작업하지 않고 기능 브랜치와 Pull Request를 사용합니다.
- 작업 전 현재 브랜치, 변경 상태와 최근 커밋을 확인합니다.
- 사용자의 기존 변경을 임의로 되돌리지 않습니다.
- 한 커밋에는 하나의 논리적 변경만 포함합니다.
- 커밋 제목은 `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:` 형식을 사용합니다.
- 초기 스캐폴드 메시지를 후속 커밋에 재사용하지 않습니다.
- 비밀정보, 개인 경로, 로컬 로그와 런타임 상태 파일을 커밋하지 않습니다.
- 브랜드 파일은 별도 요청이 없는 한 수정하지 않습니다.

## Java 전환 원칙

- 새 백엔드 기능은 우선 Java에서 구현합니다.
- Node 기능을 제거하기 전에 Java API의 응답 계약, 테스트와 Compose 통합 검증을 완료합니다.
- Controller는 요청 검증과 HTTP 계약을 담당하고 핵심 로직은 Service 또는 Gateway에 둡니다.
- 데이터베이스 스키마 변경은 Flyway migration을 기준으로 관리합니다.
- ChatModel과 EmbeddingModel은 Gateway 경계를 통해 사용합니다.
- AI 공급자 설정이 없어도 애플리케이션과 health API는 시작되어야 합니다.
- DB, pgvector, AI 공급자 상태는 각각 구분해서 보고합니다.
- 테스트와 기본 부팅 과정에서 실제 외부 AI 호출을 요구하지 않습니다.

## 보안 원칙

- service-role key, API key, webhook과 DB 비밀번호를 프론트엔드에 노출하지 않습니다.
- 쓰기 API는 인증과 역할 검사를 통과해야 합니다.
- 전달 헤더만으로 사용자를 신뢰하지 않습니다.
- shell, MCP, Codex, 배포와 프로세스 제어는 명시적인 allowlist와 승인 경계를 통과해야 합니다.
- 공개 또는 원격 접속 환경에서는 DB와 내부 API 포트를 불필요하게 외부 인터페이스에 노출하지 않습니다.

## 검증

```text
frontend: npm ci, npm run test, npm run build
backend: npm ci, npm run test, npm run typecheck, npm run build
archiveos-ai: gradlew clean test bootJar --no-daemon
integration: docker compose config, docker compose up --build -d, docker compose ps
```

Windows에서는 `gradlew.bat`, WSL과 Linux에서는 `./gradlew`를 사용합니다. Gradle wrapper와 Docker 관련 파일은 LF 줄바꿈을 유지합니다.
