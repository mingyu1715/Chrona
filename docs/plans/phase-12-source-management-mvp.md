# Phase 12 백업 대상 관리 MVP

## 목표

Chrona 저장소 안에서 백업 대상을 관리해 같은 폴더나 파일을 매번 새로 선택하지 않고 반복 백업할 수 있게 한다.

저장소는 백업 데이터를 저장하는 위치이고, 백업 대상은 실제로 백업하려는 원본 폴더/파일이다.

## 구현 범위

- 저장소 내부에 `indexes/source-index.json`을 추가한다.
- 백업 생성 시 선택된 경로가 기존 백업 대상인지 canonical path 기준으로 찾고, 없으면 새로 등록한다.
- 새 스냅샷과 `snapshot-index.json` 항목에 `sourceId`를 기록한다.
- 기존 스냅샷처럼 `sourceId`가 없는 항목은 `묶이지 않음` 그룹으로 유지한다.
- Home에 백업 대상 목록을 표시하고, 대상별 다시 백업 진입점을 제공한다.
- Files 화면에 백업 대상 필터를 추가하고, 같은 상대경로가 다른 대상에 있어도 파일 검사에서 섞이지 않게 한다.
- Snapshots 화면은 백업 대상별로 스냅샷을 묶어 보여주고, 선택한 대상만 필터링할 수 있게 한다.
- 기존 통계, 비교, 무결성 검증, 지정 폴더 복원 흐름은 유지한다.

## 제외 범위

- 백업 전 전체 변경 preview.
- 파일 감시와 자동 스냅샷.
- 백업 대상별 통계 대시보드 재설계.
- 스냅샷 삭제와 블록 정리.
- 원본 위치를 특정 시점으로 되돌리는 복원 구현.

## 구현 체크리스트

- [x] `BackupSource`, `SourceIndex` 모델 추가
- [x] `SourceStore` 추가
- [x] source 등록/목록/이름 변경/등록 제거 Tauri command 추가
- [x] snapshot metadata와 snapshot index에 `sourceId` 추가
- [x] snapshot 생성 시 source 자동 등록/재사용
- [x] inventory key를 `(sourceId, relativePath)` 기준으로 변경
- [x] file inspector에 optional `sourceId` 필터 추가
- [x] Home 백업 대상 목록과 대상별 다시 백업 버튼 추가
- [x] Files 백업 대상 필터 추가
- [x] Snapshots 백업 대상별 그룹과 필터 추가
- [x] 한국어/영어 UI 문구 추가

## 검증

- `cargo test --manifest-path src-tauri/Cargo.toml`
- `npm test -- --run`
- `npm run build`

## 다음 후속 작업

원본 위치 시점 복원은 이 작업 위에서 이어간다. 해당 복원은 `sourceId`로 대상과 스냅샷 관계를 확인하고, 실행 전 안전 스냅샷을 만든 뒤, 임시 파일 작성 후 교체하는 방식으로 설계한다. 선택 시점에 없는 파일은 바로 삭제하지 않고 격리 폴더로 옮기는 방식을 우선 검토한다.
