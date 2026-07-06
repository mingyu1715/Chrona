# 0011. File Inspector and Block Map

## Status

Approved for Phase 7 implementation.

## Goal

Repository Explorer에서 파일을 선택하면 해당 파일이 스냅샷마다 어떻게 변했는지와 각 버전이 어떤 순서의 블록으로 구성되는지 확인할 수 있게 한다.

이번 Phase는 기존 저장 포맷을 변경하지 않는 읽기 전용 기능이다. 파일 내용과 decoded block payload를 미리보기로 노출하지 않는다. 정상 경로는 snapshot metadata와 block storage header만 사용하고, malformed magic header를 raw block과 구분할 때만 physical block을 streaming hash한다.

## User Flow

```text
Repository open
  -> Explorer inventory load
  -> user selects one recorded file
  -> file inspection report load
  -> newest available version selected
  -> ordered block map and snapshot history shown
  -> user selects another version
  -> block map changes without another backend request
```

## Chosen UI Approach

Explorer 안의 master-detail 구성을 사용한다.

- 왼쪽: 검색과 필터가 적용된 파일 목록
- 오른쪽: 선택한 파일의 요약, 버전 선택, block sequence, snapshot history
- 좁은 화면: 파일 목록 아래에 상세 영역 배치
- 파일 선택 전: Inspector가 파일 선택 안내 상태 표시

별도 File Inspector chapter는 만들지 않는다. 하단 drawer도 사용하지 않는다. 이 방식은 기존 Explorer의 반복 탐색 흐름을 유지하면서 새 navigation을 추가하지 않는다.

## Scope

Included:

- inventory file row selection
- repository-wide relative path 기준 file history 조회
- snapshot별 `added`, `modified`, `unchanged`, `deleted` 상태 계산
- 선택한 snapshot version의 ordered block reference map
- block index, offset, logical raw size, hash prefix 표시
- physical block 존재 상태와 raw/Zstd/LZ4 encoding 표시
- physical stored bytes와 compression saved bytes 표시
- 같은 block이 file history에서 몇 개 version에 나타나는지 표시
- loading, empty, missing block, invalid storage header, error UI

Excluded:

- block payload decode, 내용 미리보기 또는 파일 미리보기
- 파일/스냅샷 수정이나 삭제
- snapshot restore 동작 변경
- block integrity 전체 재검증
- graph/chart library 추가
- zoomable canvas 또는 고급 graph visualization
- 서로 다른 source root에 존재하는 동일 relative path 구분
- 전체 Repository UI 재설계

## Identity and History Semantics

MVP file identity는 현재 Inventory와 동일하게 normalized `relative_path` 문자열이다.

Snapshot index를 오래된 순서부터 순회하면서 ordered block digest를 비교한다.

```text
missing -> present                         = added
present -> present, same ordered digest   = unchanged
present -> present, different digest      = modified
present -> missing                         = deleted
missing -> missing                         = no history row
deleted -> present                         = added
```

Ordered digest는 아래 값으로 구성한다.

```text
file.size_bytes
block[index].hash
block[index].size_bytes
```

`modified_at`만 달라진 경우에는 `modified`로 판단하지 않는다. 이 규칙은 snapshot comparison의 content-first 규칙과 일치한다.

Report는 newest-first history를 반환한다. UI의 초기 선택은 block references가 있는 가장 최신 version이다. 최신 event가 `deleted`이면 마지막으로 존재했던 version을 선택한다.

`version_count`는 파일이 실제로 존재하는 snapshot version 수다. `seen_in_version_count`는 해당 hash가 최소 한 번 나타나는 존재 version 수이며, 같은 version 안의 중복 reference는 한 번으로 센다. `latest_state`는 newest-first history의 첫 event 상태다.

## Block Storage Inspection

Block map은 snapshot의 logical `BlockReference` 순서를 그대로 유지한다. 각 unique hash의 physical storage 정보는 한 번만 조회한 뒤 version references에 결합한다.

Physical inspection은 full decompression을 하지 않는다.

```text
block hash
  -> BlockStore block path validation
  -> file metadata and first 60 bytes read
  -> no CHRBLK01 magic: raw
  -> valid CHRBLK01 header: zstd or lz4
  -> malformed magic header: stream raw SHA-256 only to distinguish
       valid magic-prefixed raw block from invalid envelope
  -> missing/unreadable/invalid state returned in report
```

Compressed header validation:

- envelope version is supported
- encoding is Zstd or LZ4
- reserved bytes are zero
- header raw hash equals block path hash
- header raw size equals snapshot logical block size
- physical file size equals header size plus payload size

This inspection reports storage metadata only. Full payload decompression and raw hash verification remain the responsibility of Integrity Verification.

## Rust Models

Create `src-tauri/src/models/file_inspector.rs`.

```rust
pub struct FileInspectionReport {
    pub schema_version: u32,
    pub repository_path: String,
    pub relative_path: String,
    pub file_name: String,
    pub version_count: u64,
    pub first_seen_at: String,
    pub last_seen_at: String,
    pub latest_state: FileVersionState,
    pub versions: Vec<FileInspectionVersion>,
}

pub struct FileInspectionVersion {
    pub snapshot_id: String,
    pub snapshot_name: String,
    pub snapshot_created_at: String,
    pub state: FileVersionState,
    pub size_bytes: Option<u64>,
    pub modified_at: Option<String>,
    pub total_block_references: u64,
    pub unique_block_count: u64,
    pub blocks: Vec<FileBlockInspection>,
}

pub enum FileVersionState {
    Added,
    Modified,
    Unchanged,
    Deleted,
}

pub struct FileBlockInspection {
    pub index: u64,
    pub offset: u64,
    pub size_bytes: u64,
    pub hash: String,
    pub was_new: bool,
    pub encoding: BlockStorageEncoding,
    pub storage_state: BlockStorageState,
    pub stored_size_bytes: Option<u64>,
    pub compression_saved_bytes: Option<u64>,
    pub seen_in_version_count: u64,
    pub issue: Option<String>,
}

pub enum BlockStorageEncoding {
    Raw,
    Zstd,
    Lz4,
    Unknown,
}

pub enum BlockStorageState {
    Available,
    Missing,
    Unreadable,
    InvalidHeader,
}
```

All serialized names use camelCase.

## Core Modules

Create:

- `src-tauri/src/core/file_inspector_service.rs`
  - validates repository and relative path
  - loads snapshots
  - calculates file history transitions
  - aggregates block reuse counts
  - joins physical block inspection data
- `src-tauri/src/models/file_inspector.rs`
  - report and enum definitions
- `src-tauri/src/commands/file_inspector_commands.rs`
  - Tauri command wrapper
- `src-tauri/tests/phase7_file_inspector.rs`
  - integration and compatibility tests
- `src/features/explorer/FileInspectorPanel.tsx`
  - selected file detail, version selector, block strip, history list
- `src/features/explorer/FileInspectorPanel.test.tsx`
  - component behavior tests

Modify:

- `src-tauri/src/core/block_codec.rs`
  - expose safe envelope header inspection without decompression
- `src-tauri/src/core/block_store.rs`
  - expose physical block metadata inspection
- `src-tauri/src/core/mod.rs`
- `src-tauri/src/models/mod.rs`
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/main.rs`
- `src-tauri/src/core/errors.rs`
- `src/shared/types/chrona.ts`
- `src/shared/api/chronaApi.ts`
- `src/features/repository/RepositoryPage.tsx`
- `src/features/repository/RepositoryPage.css`
- `src/features/repository/RepositoryPage.test.tsx`

## Command API

```rust
inspect_repository_file(
    repository_path: String,
    relative_path: String,
) -> Result<FileInspectionReport, String>
```

Progress event streaming is not required. 정상 경로는 JSON metadata와 작은 block header만 읽고 payload를 decode하지 않는다. Magic collision 판별이 필요한 block만 bounded streaming hash한다.

## Data Flow

```text
input
repository path + normalized relative path

-> validate
RepositoryManager::open
metadata_relative_path_to_path_buf

-> history
SnapshotStore::list_snapshots
SnapshotStore::get_snapshot
ordered content digest transition classification

-> physical storage metadata
deduplicate hashes
BlockStore header inspection
encoding / stored bytes / state aggregation

-> result
FileInspectionReport serialized to React

-> UI
select newest available version
render block sequence and history
```

## Error Handling

Hard command errors:

- invalid repository
- unsafe or absolute relative path
- malformed snapshot index/JSON
- requested relative path never appears in any snapshot

Per-block issues do not fail the complete report:

- missing `.blk` -> `missing`
- block file open/read failure -> `unreadable`
- unsupported or inconsistent compressed header -> `invalidHeader`

The UI shows the affected block and issue text. Repair and full validation remain outside this Phase.

## UI Details

Explorer filters remain above the master-detail area.

File list:

- selectable row/button semantics
- selected state visible in light and dark themes
- path, kind, snapshot state, source state retained
- long paths truncate visually but full path remains in `title`

Inspector:

- file name and full normalized path
- first/last seen and version count
- snapshot version select menu
- block strip in reference order
- encoding color is secondary to text labels
- each block shows index, logical size, hash prefix, encoding, physical size
- history list shows snapshot name/date and state
- deleted event has no block strip

Accessibility:

- file rows are keyboard selectable
- selected file uses `aria-current`
- block items include text, not color-only meaning
- history and block sequence use semantic lists

## Tests

Rust integration tests:

- added/unchanged/modified/deleted transitions are classified in order
- a deleted then reappearing path is classified as added again
- ordered block references are preserved
- duplicate hashes expose correct `seen_in_version_count`
- raw, Zstd, and LZ4 storage metadata is reported
- magic-prefixed raw block remains raw
- missing block returns a partial report with `missing` state
- invalid envelope header returns `invalidHeader`
- unsafe relative path is rejected
- unknown relative path returns a structured error
- Tauri command result serializes with camelCase fields

UI tests:

- selecting an inventory file invokes `inspectRepositoryFile`
- loading and error states render
- initial version is newest available version
- selecting another version changes the block strip
- block encoding, stored size, and reuse count render
- deleted history entry renders without blocks
- no file selected state renders

Regression verification:

```bash
cd src-tauri
cargo fmt --all -- --check
cargo test
cd ..
npm test -- --run
npm run build
git diff --check HEAD
```

## Documentation

During implementation:

- add `docs/plans/phase-7-file-inspector-block-map.md`
- update `docs/development-log.md` in Korean
- update `docs/phase-status.md`
- update `docs/project-plan.md`
- update README feature status

After completion:

- add `docs/implemented/file-inspector-block-map.md`
- move this spec to `docs/archive/specs/`
- move the completed plan to `docs/archive/plans/`

## Completion Criteria

- Explorer file selection opens an Inspector in the same workspace.
- File history follows content-based transition rules.
- Any available version can show its ordered block references.
- Raw, Zstd, and LZ4 physical storage metadata is visible without full decompression.
- Missing or invalid block storage does not prevent the rest of the report from rendering.
- Existing snapshot, inventory, restore, integrity, and compression tests continue to pass.
- Rust tests, UI tests, production build, format, and whitespace checks pass.

## Known Limitation

Current Inventory identifies files by repository-wide normalized relative path. If different source roots contain the same relative path, their history can be combined. Source-root-aware identity is a separate format and inventory design decision and is not introduced in this Phase.
