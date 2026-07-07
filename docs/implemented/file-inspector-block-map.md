# 파일 검사기 / 블록 지도 구현 기록

## 상태

- Phase 7 구현 완료
- Explorer의 기존 인벤토리 목록과 같은 화면에서 동작하는 읽기 전용 상세 기능
- 저장소 포맷 변경 없음

## 구현 범위

- Explorer 파일 선택과 비동기 검사 요청
- snapshot 전체를 순회하는 파일 이력 계산
- `added`, `modified`, `unchanged`, `deleted` 상태 분류
- 선택한 snapshot 버전의 ordered block reference 표시
- block별 logical size, physical stored size, history 내 reuse count 표시
- raw, Zstd, LZ4 encoding 판별
- missing, unreadable, invalid header 상태의 부분 보고
- 좁은 화면에서 세로로 쌓이는 Explorer master-detail UI

## 파일 이력 판정

같은 normalized relative path를 snapshot 생성 순서대로 찾고, 이전에 존재한 버전과 현재 버전의 파일 크기 및 ordered `(hash, size)` block sequence를 비교한다.

- 이전에 없고 현재 있으면 `added`
- 이전과 현재가 있고 내용 sequence가 같으면 `unchanged`
- 이전과 현재가 있고 내용 sequence가 다르면 `modified`
- 이전에 있고 현재 없으면 `deleted`
- 삭제 뒤 다시 나타나면 `added`

수정 시각만 달라지고 block sequence가 같으면 내용 변경으로 보지 않는다. 결과는 UI에서 최신 snapshot부터 표시한다.

## Physical block 검사

정상 compressed block은 envelope header만 읽어 encoding과 크기를 확인하며 payload를 전체 압축 해제하지 않는다. block 파일이 envelope magic으로 시작하는 기존 raw block일 수 있으므로, 이 경우 먼저 파일 전체의 raw SHA-256을 streaming 방식으로 확인해 정상 raw block을 잘못 판정하지 않는다.

각 unique `(hash, raw size)` 조합의 physical metadata는 한 번만 검사하고 보고서 내 block reference에서 재사용한다. block 누락이나 잘못된 header는 전체 요청을 실패시키지 않고 해당 block 상태와 원인을 함께 반환한다.

## UI 흐름

1. 사용자가 Explorer 표에서 파일 경로를 선택한다.
2. `inspect_repository_file` command가 해당 파일의 전체 이력과 block 정보를 반환한다.
3. Inspector에서 snapshot 버전을 선택한다.
4. 선택한 버전의 block 순서와 physical metadata를 확인한다.
5. 같은 패널의 history 목록에서 snapshot별 변경 상태를 확인한다.

연속 선택 시 이전 요청 결과가 늦게 도착해 최신 선택을 덮어쓰지 않도록 request id를 비교한다. 검사 실패 시 인벤토리 목록은 유지하고 Inspector에만 오류를 표시한다.

## 제한 사항

- 파일 identity는 현재 repository 전체의 normalized relative path 기준이다. 서로 다른 source root에 같은 relative path가 있으면 하나의 파일 이력처럼 집계될 수 있다.
- block payload 내용 미리보기와 압축 해제 결과 표시는 제공하지 않는다.
- 파일, snapshot, block의 수정·삭제·복구 기능은 제공하지 않는다.
- 고급 graph/canvas 시각화와 전체 UI 재설계는 이후 작업으로 남긴다.

## 검증

- Rust 통합 테스트: physical metadata, magic-prefixed raw, missing/invalid block, content history, delete/re-add, command serialization
- UI 테스트: 기본 상태, block/history rendering, version 변경, 부분 오류, Explorer 선택 및 API 오류
- 전체 검증 결과는 `docs/development-log.md`의 2026-06-30 Phase 7 항목에 기록한다.
