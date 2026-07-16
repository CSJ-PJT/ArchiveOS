# Archive 1.0 RC 알려진 제한

- RAG rate limit은 단일 인스턴스 메모리 기반이다. 수평 확장 환경에는 공유 제한 저장소 또는 edge 정책이 필요하다.
- Decision Record는 자동 모델 학습이 아닌 사람 검토 운영 기록이다. outcome feedback API와 모델 업데이트는 이 RC 범위에 없다.
- Archive-World는 manifest 및 adapter 경계 수준으로만 Runtime과 연결된다. World의 GLB 렌더·Blender build는 Runtime 기능이나 이 릴리스 기준선의 검증 범위가 아니다.
- source feature branch는 의도적으로 보존된다.
- 정식 GA 전에는 외부 부하, 장애 주입, 다중 인스턴스 RAG 제한, 장기 outbox recovery 검증이 추가로 필요하다.
- Ledger와 Market의 Windows checkout에서는 Gradle wrapper CRLF가 직접 WSL shebang 실행을 막을 수 있다. 컨테이너 build 단계의 wrapper 보정 또는 LF checkout을 사용하며, wrapper를 임의로 작업 트리에서 다시 쓰지 않는다.
