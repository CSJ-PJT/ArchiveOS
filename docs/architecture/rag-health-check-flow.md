# RAG 점검 흐름

RAG 점검은 `archiveos-ai`의 실제 runtime telemetry와 Spring Batch Job으로 수행한다.

## Runtime API

`GET /api/ai/runtime`

확인 항목:

- Spring Boot 상태
- Spring AI 상태
- ChatModel 설정과 최근 호출 상태
- EmbeddingModel 설정과 vector dimension
- PostgreSQL 연결
- pgvector extension
- vector index
- documents/chunks/embeddedChunks
- 최근 sync/search/ask 시각
- 최근 latency와 reference count

## 수동 모델 점검

`POST /api/ai/runtime/check`

명시적으로 호출할 때만 실제 ChatModel/EmbeddingModel smoke check를 수행한다.

## Batch 점검

`ragHealthCheckJob`

- 유료 OpenAI 호출 없이 `/api/ai/runtime` 수준의 관측 데이터를 확인한다.
- JobExecution과 StepExecution metadata에 runtime status, ragReady, databaseConnected, indexReady를 기록한다.

실행:

```powershell
curl -X POST http://localhost:4100/api/batch/jobs/ragHealthCheckJob/run
curl "http://localhost:4100/api/batch/executions?limit=5"
```

## 화면

Workflows 화면의 `Spring Batch Jobs`와 `Execution Detail` 영역에서 실행 결과를 확인한다.

## 실패 처리

- DB 연결 실패는 degraded/unavailable 상태로 표시한다.
- secret은 runtime 응답과 execution description에 노출하지 않는다.
- fake healthy 응답을 반환하지 않는다.
