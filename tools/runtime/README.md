# ArchiveOS 로컬 런타임 오케스트레이터

이 스크립트들은 ArchiveOS와 DeepStake3D / WorldPrototype3D 작업 주변에서 사용하는 비대화형 로컬 프로세스를 시작, 중지, 조회하기 위한 개발자 도구입니다.

ArchiveOS UI는 계속 읽기 전용입니다. 이 스크립트들은 프론트엔드나 백엔드 API로 노출하지 않습니다.

## 관리 대상 프로세스

예시 설정에는 다음 프로세스가 포함됩니다.

- ArchiveOS 프론트엔드
- ArchiveOS 백엔드
- MCP 큐 루프
- reviewer bridge
- 선택적 queue watcher placeholder

대화형 Codex 구현자/리뷰어 세션은 이 스크립트가 시작하지 않습니다. 해당 세션은 수동으로 시작하고, `CODEX_IMPLEMENTER_PID`, `CODEX_REVIEWER_PID` 같은 PID 힌트로 ArchiveOS에서 감지합니다.

`Run-ModularLoop.ps1`은 내부적으로 `src/gpt-session-bridge.mjs`를 시작합니다. reviewer bridge 중복 실행을 피하기 위해 독립 `reviewer-bridge` 항목은 기본적으로 비활성화되어 있습니다.

## 설정

예시 설정을 복사한 뒤 로컬 경로와 PID를 수정합니다.

```powershell
Copy-Item .\tools\runtime\runtime.config.example.json .\tools\runtime\runtime.config.json
notepad .\tools\runtime\runtime.config.json
```

시작하지 않을 항목은 `enabled`를 `false`로 설정합니다. MCP 루프를 시작하기 전에 DeepStake3D / WorldPrototype3D placeholder 경로와 `MANUAL_IMPLEMENTER_PID` 값을 로컬 환경에 맞게 바꿉니다.

커밋된 예시 설정은 안전한 기본값으로 `-MaxAutoTasks`를 `1`로 둡니다. 루프를 계속 돌리려는 경우에만 git에서 무시되는 로컬 `runtime.config.json`에서 `unlimited`로 변경합니다.

구현자 PID는 설정 파일 대신 환경 변수로도 전달할 수 있습니다.

```powershell
$env:IMPLEMENTER_PID = "15232"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\runtime\start-all.ps1
```

## 명령어

설정된 프로세스 시작:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\runtime\start-all.ps1
```

상태 확인:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\runtime\status.ps1
```

오케스트레이터가 시작한 프로세스 중지:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\runtime\stop-all.ps1
```

## 생성 파일

- 로그: `tools/runtime/logs/{id}.log`
- PID 파일: `tools/runtime/pids/{id}.pid`
- `runtime.config.json`, 로그, PID 파일은 로컬 전용이며 git에서 무시합니다.

## 보안

이 도구는 로컬 전용 프로세스 오케스트레이션입니다. 로컬 JSON 설정에서 프로세스 항목을 읽으며, ArchiveOS 프론트엔드에서 임의 명령 입력을 받지 않습니다. 별도 보안 설계 없이 백엔드 API로 노출하지 마세요.

## DeepStake3D 작업에서의 역할

DeepStake3D 작업은 Unity 게임 PoC의 건설/청크/저장 검증을 진행하는 별도 프로젝트입니다. 이 오케스트레이터는 해당 작업을 직접 구현하지 않고, MCP 큐 루프와 reviewer bridge를 켜서 ArchiveOS가 런타임 상태를 읽을 수 있게 돕습니다.
