# Phase 13 원본 위치 시점 복원 계획

## 목표

선택한 백업 대상(source)을 특정 스냅샷 시점으로 되돌린다.

## 구현 범위

- [x] `restore_snapshot_to_source(repository_path, source_id, snapshot_id)` command 추가
- [x] 복원 전 현재 원본 위치를 안전 스냅샷으로 저장
- [x] 대상 스냅샷의 `sourceId`가 요청 source와 다르면 중단
- [x] 스냅샷에 있는 파일은 `.tmp` 파일에 먼저 복원한 뒤 rename
- [x] 스냅샷에 없지만 현재 원본에 있는 파일은 `.chrona-quarantine/{operationId}/` 아래로 이동
- [x] 복원 결과에 안전 스냅샷 ID, 격리 파일 수, 복원 파일 수를 반환
- [x] Snapshots UI에 원본 위치 복원 진입점 추가

## 제외 범위

- 복원 preview
- 자동 충돌 해결 UI
- 파일 감시/자동 백업
- 스냅샷 삭제/GC
- 파일 source 원본 위치 복원 세부 UX

## 검증

- `cargo test --manifest-path src-tauri/Cargo.toml --test phase13_original_location_restore --test phase4_restore`
- `npm test -- --run src/features/snapshots/SnapshotsPage.test.tsx`
- `npm run build`

## 남은 확인

- Windows File Explorer 환경에서 원본 위치 복원 후 격리 폴더 경로 확인
