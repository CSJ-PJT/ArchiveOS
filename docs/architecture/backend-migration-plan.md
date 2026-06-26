# Backend Migration Plan

ArchiveOS backend는 단번에 교체하지 않고 기능별 책임을 Spring Boot 계층으로 이동한다.

## 유지되는 Node/Express 책임

- 기존 PM 운영 화면 API
- Supabase 운영 데이터 조회
- Discord 알림 송신
- Agent/runtime visibility
- Spring API proxy
- 기존 frontend와의 호환 레이어

## Spring Boot로 이동 중인 책임

- Obsidian 문서 수집
- chunking
- embedding
- pgvector 저장
- vector search
- RAG answer
- Spring Batch Job 실행과 이력
- Intelligent RPA classification
- PM approval decision 저장

## 이전 순서

1. RAG engine 분리
2. Runtime telemetry 실제 데이터 연결
3. RPA classify Job 도입
4. RPA decision record 저장
5. Batch catalog/execution API 도입
6. Nightly/Daily batch를 Spring Batch로 이전
7. Queue/Pipeline audit를 Spring Batch로 이전
8. UI Workflows를 Spring Batch execution 중심으로 연결

## 중간 상태의 규칙

- Node와 Spring이 같은 기능을 동시에 쓰지 않는다.
- Node에 남아 있는 API는 Spring proxy 또는 기존 운영 데이터 조회로 역할을 명확히 둔다.
- Spring API가 꺼져 있으면 fake success를 반환하지 않는다.
- 위험 작업 실행은 PM Approval Gate 이전에 수행하지 않는다.
