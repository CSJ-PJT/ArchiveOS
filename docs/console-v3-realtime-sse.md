# 실시간 SSE 메쉬

`GET /api/live-flow/stream`은 저장된 `ecosystem_flow_event`를 SSE로 전달한다.

- `snapshot`: 연결 시 현재 요약
- `runtime-event`: 저장된 실제 런타임 이벤트
- `service-status`: 상태 변경용 이벤트
- `heartbeat`: 유휴 연결 유지

SSE 이벤트는 `event_id`로 중복 제거한다. Last-Event-ID가 있으면 서버의 짧은 전송 이력 범위에서 이후 이벤트를 재전송한다. Node 호환 계층은 `text/event-stream`, keep-alive, `X-Accel-Buffering: no`를 유지하며 JSON 버퍼링을 하지 않는다.

메모리 전송 이력에 Last-Event-ID가 없으면 `ecosystem_flow_event`의 `received_at`, `id` 순서를 기준으로 최대 250건을 다시 조회한다. 따라서 ArchiveOS 재기동 뒤에도 저장된 이벤트를 복구할 수 있다. 유효하지 않은 Last-Event-ID는 snapshot만 전달하고 서버 경고 로그로 남긴다.

브라우저는 SSE 연결 중 전체 AppData 폴링을 하지 않는다. 연결이 실패한 경우에만 최근 이벤트 조회를 폴백으로 사용하며, 이것은 상태를 `연결 재시도 중`으로 명확히 표시한다. 수집된 이벤트가 없으면 토큰을 만들지 않는다.

재접속 간격은 1초에서 시작해 2초, 4초, 8초, 16초, 최대 30초까지 증가하며, 성공 시 초기화한다. offline 상태에서는 대기하고 online 이벤트가 발생하면 즉시 재접속을 시도한다. 클라이언트는 최근 750개 eventId만 유지해 snapshot과 재전송 이벤트의 중복을 막는다.
