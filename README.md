# ArchiveOS

> **AI 프로젝트를 실행하고 관리하는 차세대 운영 플랫폼**

ArchiveOS는 AI 에이전트, 지능형 RPA, 배치 작업, 마이크로서비스, 이벤트 스트림, 외부 도구를 하나의 환경에서 실행하고 관제하는 **엔터프라이즈 AI 런타임 플랫폼**입니다.

사람이 모든 시스템을 직접 운영하는 방식을 넘어, AI가 반복 업무와 시스템 운영을 지원하고 사람은 중요한 의사결정과 승인에 집중하는 환경을 지향합니다.

---

## Vision

> **AI가 일하고, 사람은 설계하고 결정한다.**

ArchiveOS의 목표는 다양한 업무 애플리케이션과 자동화 워크플로우를 하나의 런타임에서 연결하고 오케스트레이션하는 것입니다.

ArchiveOS는 특정 산업이나 서비스에 종속되지 않습니다. 제조, 물류, 지식 관리, 개발 운영, 문서 처리 등 여러 도메인의 애플리케이션이 동일한 AI 런타임 위에서 동작할 수 있도록 설계합니다.

---

## Core Features

### AI Agent Runtime

* AI Agent 실행 및 생명주기 관리
* Multi-Agent 협업 구조
* LLM 연동
* Tool Calling
* MCP 기반 외부 도구 연동
* 메모리와 실행 문맥 관리

### Workflow & Batch Engine

* Spring Batch 기반 Job 및 Step 실행
* 스케줄링과 반복 작업 관리
* 이벤트 기반 워크플로우
* 병렬 처리 및 재시도
* 실행 이력과 실패 원인 추적

### Intelligent RPA

* AI 기반 작업 분류와 판단
* 승인 기반 자동화
* 실패 복구 및 재시도 추천
* 외부 시스템 연동
* 위험 작업에 대한 Approval Gate

### Knowledge & RAG

* 문서 수집 및 동기화
* 청크 생성과 임베딩
* PostgreSQL 및 pgvector 기반 검색
* 과거 사례와 운영 지식 검색
* AI 응답과 출처 추적

### Operations & Observability

* 시스템 상태 대시보드
* 서비스 Health Check
* 로그, 메트릭, 트레이스 수집
* 배치 및 워크플로우 실행 현황
* 장애 감지와 알림
* AI 기반 원인 분석 및 조치 추천

### Project Runtime

ArchiveOS 위에서는 여러 독립 애플리케이션이 동작할 수 있습니다.

첫 번째 산업 애플리케이션은 **Archive-Nexus**입니다.

* **Archive-Nexus**: 가상 공장, 재고, 물류, 품질, 정비 시스템을 연결하는 제조 AX 애플리케이션
* 향후 다양한 산업과 업무 도메인의 애플리케이션으로 확장 가능

---

## Architecture

```text
ArchiveOS
├── AI Agent Runtime
├── Spring AI
├── Spring Batch
├── Intelligent RPA
├── Workflow Engine
├── RAG Engine
├── MCP / Tool Registry
├── Scheduler
├── Event Bus
├── Authentication
├── Observability
└── Project Runtime
    ├── Archive-Nexus
    └── Future Applications
```

ArchiveOS는 플랫폼과 애플리케이션의 책임을 분리합니다.

* **ArchiveOS**
  AI 실행, 배치, 워크플로우, RPA, 지식 검색, 관제를 담당하는 공통 런타임

* **Archive-Nexus**
  ArchiveOS 위에서 동작하는 제조 AX 애플리케이션

---

## Tech Stack

### Backend

* Java 21
* Spring Boot
* Spring AI
* Spring Batch
* Spring Data JPA
* PostgreSQL
* pgvector

### Frontend

* React
* Vite
* TypeScript

### Infrastructure

* Docker
* Docker Compose
* Kubernetes
* Prometheus
* Grafana
* OpenTelemetry

### Integration

* MCP
* REST API
* Webhook
* Discord
* GitHub

---

## Philosophy

### One AI Runtime, Infinite Business Applications

ArchiveOS는 하나의 AI 런타임 위에서 다양한 업무 애플리케이션을 실행하는 것을 목표로 합니다.

플랫폼은 공통 실행 환경을 제공하고, 각 애플리케이션은 자신의 도메인 문제에 집중합니다.

### Human-in-the-Loop

AI는 반복 작업, 분석, 추천, 요약을 수행하지만 위험하거나 중요한 작업은 사용자의 승인 이후에 실행합니다.

### Platform First

ArchiveOS는 특정 프로젝트에 종속되지 않는 범용 플랫폼을 지향합니다.

제조, 물류, 개발 운영, 지식 관리 등 여러 애플리케이션이 동일한 방식으로 ArchiveOS에 연결될 수 있어야 합니다.

### Observable by Default

모든 Job, Step, Agent, RPA 작업은 실행 이력과 상태를 남깁니다.

실패 원인, 재시도 여부, 승인 상태, 실행 결과를 추적할 수 있어야 합니다.

---

## Archive-Nexus

Archive-Nexus는 ArchiveOS 위에서 동작하는 첫 번째 산업 애플리케이션입니다.

여러 가상 공장, 재고 허브, 물류 시스템, 품질 시스템, 정비 시스템을 하나의 생태계로 연결합니다.

ArchiveOS의 AI Runtime과 지능형 RPA를 활용하여 다음 기능을 수행합니다.

* 공장별 생산 데이터 수집
* 설비 이상 감지
* 품질 이상 분석
* 재고 부족 및 납기 지연 감지
* 과거 사례 기반 원인 분석
* AI 조치 추천
* 승인 기반 RPA 실행
* 공장과 물류 시스템 통합 관제

```text
ArchiveOS
    │
    ├── AI Runtime
    ├── Batch / Workflow
    ├── RPA / Approval
    └── Observability
          │
          ▼
Archive-Nexus
    ├── Virtual Factories
    ├── Inventory
    ├── Logistics
    ├── Quality
    └── Maintenance
```

---

## Roadmap

* [ ] AI Agent Runtime 고도화
* [ ] Spring Batch 기반 작업 오케스트레이션
* [ ] Intelligent RPA 및 Approval Gate
* [ ] Workflow Designer
* [ ] MCP 기반 Tool Registry
* [ ] Multi-Agent 협업
* [ ] RAG 및 지식 동기화
* [ ] 프로젝트별 Runtime 관리
* [ ] Observability 대시보드
* [ ] Archive-Nexus 연동
* [ ] Kubernetes 배포
* [ ] Plugin SDK
* [ ] Multi-LLM 지원

---

## Slogan

> **AI가 일하는 플랫폼, 사람은 설계하고 결정하는 플랫폼.**

> **One AI Runtime. Infinite Business Applications.**

---

## License

라이선스 정책은 프로젝트 운영 방침에 따라 추후 정의합니다.
