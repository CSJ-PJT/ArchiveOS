# ArchiveOS 에이전트 작업 규칙

## 제품 범위

- ArchiveOS는 AI 에이전트 운영 가시화에 집중합니다.
- 현재 단계는 실행 콘솔이 아니라 읽기 전용 PM 운영 대시보드와 안전한 기록 화면입니다.
- 대시보드 흐름에 실제 필요성이 생기기 전까지 인증을 추가하지 않습니다.
- OpenAI API 호출은 아직 추가하지 않습니다.
- MCP 직접 통합과 직접 실행 제어는 아직 추가하지 않습니다.
- 프론트엔드의 현재 Supabase 읽기는 의도적인 마이그레이션 전까지 유지합니다.
- 쓰기 작업과 향후 통합은 백엔드를 통해 처리합니다.
- Command Center 액션은 OpenAI, GitHub, MCP 통합이 명시적으로 추가되기 전까지 기록 전용입니다.
- 로컬 프로젝트 액션은 allowlist 기반이어야 하며, 사용자 입력 셸 명령이나 임의 경로를 실행하면 안 됩니다.
- 로컬 런타임 상태는 읽기 전용 가시화입니다. 별도 설계 검토 없이 프로세스 제어 기능을 추가하지 않습니다.
- 수동 Codex 구현자/리뷰어 PID 힌트는 로컬 런타임 메타데이터일 뿐이며, 프로세스 제어 기능으로 확장하지 않습니다.

## 엔지니어링 규칙

- React, Vite, TypeScript, Tailwind CSS, Supabase를 사용합니다.
- 브라우저에서 안전한 Supabase 설정은 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`에 저장합니다.
- Supabase secret key 또는 service role key를 커밋하지 않습니다.
- `SUPABASE_SERVICE_ROLE_KEY`를 프론트엔드 코드나 `VITE_` 환경 변수로 노출하지 않습니다.
- 프론트엔드는 `VITE_SUPABASE_ANON_KEY`만 사용합니다. service-role 쓰기는 백엔드가 담당합니다.
- 스키마 변경은 `supabase/schema.sql`에 반영합니다.
- 샘플 데이터는 `supabase/seed.sql`에 유지합니다.
- 큰 추상화보다 작고 읽기 쉬운 컴포넌트를 우선합니다.

## 데이터 모델

- `agents`: AI 작업자 정체성과 운영 상태
- `tasks`: 큐 작업과 선택적 담당 에이전트
- `work_logs`: 요약, 결정, 오류, 리뷰 기록
- Memory / Decisions: `work_logs` 중 `log_type = 'decision'`인 행을 읽습니다.
