# Archive 1.0 RC 변경 정책과 운영 프리즈

## 프리즈 원칙

- RC 기준선 이후 기능 변경은 별도 branch에서 시작한다.
- `main` 후보는 보안 수정, 검증된 버그 수정, 명시적 운영 안정화 변경으로 제한한다.
- Runtime과 Archive-World 변경은 같은 변경 묶음으로 취급하지 않는다.
- 환경 파일·secret·로컬 절대경로는 commit 대상이 아니다.

## main 후보 gate

1. 영향 저장소의 test/build와 Compose config를 실행한다.
2. migration 추가·변경 여부와 기존 volume 호환성을 검토한다.
3. 5개 Runtime 서비스 health, restart/OOM, fatal log를 확인한다.
4. 공식 correlation을 read-only로 재조회하거나, 변경 목적상 필요하면 새 correlation으로 E2E를 수행한다.
5. token 경계와 source/scope 계약을 재검증한다.
6. 저장소별 독립 commit·review·일반 push를 수행한다.

## 표현 정책

문서와 UI는 구현된 범위만 말한다. 검색 전용, proposal, dry-run, 사람 검토 상태를 실제 상태와 구분한다. 근거 없는 성숙도·자율성·학습 주장은 허용하지 않는다.
