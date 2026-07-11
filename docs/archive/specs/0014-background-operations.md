# 0014 Background Operations and Non-blocking UX

## 상태

구현 완료.

## 목적

사용자가 시작한 저장소 쓰기 작업이 앱 전체를 멈춘 것처럼 보이지 않게 한다. 백업 생성, 복원, 분석처럼 시간이 걸릴 수 있는 작업은 하단 진행 표시로 넘기고, Home, Files, Snapshots, Statistics, Settings 이동은 계속 가능하게 유지한다.

초기 저장소 불러오기처럼 앱이 실제로 현재 상태를 확인해야 하는 짧은 연결 작업은 기존 loading 상태를 허용한다.

## 원칙

- 긴 작업은 화면 전체 loading으로 막지 않는다.
- 진행 상태는 하단 `OperationBar`에 표시한다.
- 작업 시작용 dialog는 launcher 역할만 하고, 작업이 시작되면 닫히거나 사용자가 닫을 수 있어야 한다.
- 같은 저장소에 쓰는 작업은 한 번에 하나만 허용한다.
- 읽기 중심 탐색, 설정 보기, 파일/스냅샷 목록 이동은 작업 중에도 가능해야 한다.
- 완료와 실패는 작은 알림으로 표시한다.
- 분석 결과는 사용자가 새 분석을 실행하기 전까지 유지한다.

## Phase 11 범위

- 새 백업 생성은 `createSnapshot` 호출 후 dialog를 닫고 하단 진행으로 이어간다.
- block ingest progress listener는 dialog가 아니라 `AppShell`에서 유지한다.
- 스냅샷 복원은 확인 후 dialog를 닫고 하단 불확정 진행으로 이어간다.
- 저장소 통계 분석은 화면 이동 후에도 마지막 report/progress/loading 상태를 유지한다.
- 통계 progress는 하단 진행 바에서 count 기반 퍼센트로 표시한다.
- 백업/복원 중에는 새 백업 시작처럼 충돌 가능한 시작 동작만 막는다.
- 대용량 block ingest, snapshot 생성, snapshot 복원, 무결성 검사는 blocking thread에서 실행한다.
- 라이트/다크 테마의 primary button 글자색을 분리해 대비를 확보한다.

## Phase 11 제외

- 여러 백그라운드 작업 동시 실행 큐
- 복원 byte 단위 progress event
- 작업 취소
- 앱 종료 후 작업 재개
- OS 알림 연동
