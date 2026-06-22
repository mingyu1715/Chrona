# Phase 2 Snapshot Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add snapshot creation, persistence, listing, and detail lookup on top of the Phase 1 block engine.

**Architecture:** Reuse `BlockIngestService` as the source of file/block metadata, extend its file result with `modifiedAt`, and persist snapshot JSON through a new `SnapshotStore`. Tauri commands expose create/list/detail operations, and the React UI adds a minimal snapshot workflow without implementing comparison or restore.

**Tech Stack:** Rust, Tauri 2 commands/events, React, TypeScript, Vitest, Cargo integration tests, JSON metadata files.

---

## File Structure

Create:

- `src-tauri/src/models/snapshot.rs`: snapshot structs and index structs.
- `src-tauri/src/core/snapshot_store.rs`: snapshot path validation, atomic writes, index read/write, snapshot read/write.
- `src-tauri/src/core/snapshot_service.rs`: creates snapshots by coordinating block ingest and snapshot store.
- `src-tauri/src/commands/snapshot_commands.rs`: Tauri command wrappers.
- `src-tauri/tests/phase2_snapshot.rs`: snapshot integration tests.
- `src/features/snapshots/SnapshotPanel.tsx`: minimal snapshot create/list/detail UI.
- `src/features/snapshots/SnapshotPanel.test.tsx`: UI behavior test.

Modify:

- `src-tauri/src/models/mod.rs`: export `snapshot`.
- `src-tauri/src/core/mod.rs`: export `snapshot_store` and `snapshot_service`.
- `src-tauri/src/commands/mod.rs`: export `snapshot_commands`.
- `src-tauri/src/main.rs`: register `create_snapshot`, `list_snapshots`, `get_snapshot`.
- `src-tauri/src/core/repository.rs`: create/ensure `snapshots/` and `indexes/snapshot-index.json`.
- `src-tauri/src/models/ingest.rs`: add `modified_at` to `FileIngestResult`.
- `src-tauri/src/core/block_ingest_service.rs`: copy `ScannedFile.modified_at` into `FileIngestResult`.
- `src-tauri/tests/phase1_core.rs`: update expected ingest file shape if needed.
- `src/shared/types/chrona.ts`: add snapshot types and `modifiedAt` on `FileIngestResult`.
- `src/shared/api/chronaApi.ts`: add snapshot command wrappers.
- `src/features/repository/RepositoryPage.tsx`: include `SnapshotPanel` below repository controls.
- `docs/development-log.md`: record Phase 2 start and verification.

## Task 1: Extend Ingest Metadata With `modifiedAt`

- [x] **Step 1: Write failing Rust test**

Add to `src-tauri/tests/phase1_core.rs`:

```rust
#[test]
fn ingest_results_include_file_modified_time() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("a.txt"), b"data");

    let summary = BlockIngestService::new()
        .ingest(&repo_path, &source_path, |_| {})
        .unwrap();

    assert_eq!(summary.files.len(), 1);
    assert!(summary.files[0].modified_at.contains('T'));
}
```

- [x] **Step 2: Run test to verify failure**

```bash
cd src-tauri && cargo test ingest_results_include_file_modified_time
```

Expected: compile failure because `FileIngestResult.modified_at` does not exist.

- [x] **Step 3: Implement minimal model change**

Update `src-tauri/src/models/ingest.rs`:

```rust
pub struct FileIngestResult {
    pub relative_path: String,
    pub size_bytes: u64,
    pub modified_at: String,
    pub blocks: Vec<BlockReference>,
}
```

Update `src-tauri/src/core/block_ingest_service.rs` file result construction:

```rust
let mut file_result = FileIngestResult {
    relative_path: file.relative_path.clone(),
    size_bytes: file.size_bytes,
    modified_at: file.modified_at.clone(),
    blocks: Vec::new(),
};
```

Update `src/shared/types/chrona.ts`:

```ts
export interface FileIngestResult {
  relativePath: string;
  sizeBytes: number;
  modifiedAt: string;
  blocks: BlockReference[];
}
```

- [x] **Step 4: Verify**

```bash
cd src-tauri && cargo test ingest_results_include_file_modified_time
```

Expected: pass.

- [x] **Step 5: Commit**

```bash
git add src-tauri/src/models/ingest.rs src-tauri/src/core/block_ingest_service.rs src-tauri/tests/phase1_core.rs src/shared/types/chrona.ts
git commit -m "feat: include file modified time in ingest results"
```

## Task 2: Add Snapshot Models and Format Tests

- [x] **Step 1: Write failing integration test**

Create `src-tauri/tests/phase2_snapshot.rs`:

```rust
use std::fs;
use std::io::Write;
use std::path::Path;

use chrona::core::repository::RepositoryManager;
use chrona::core::snapshot_service::SnapshotService;
use tempfile::TempDir;

fn write_file(path: &Path, bytes: &[u8]) {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    let mut file = fs::File::create(path).unwrap();
    file.write_all(bytes).unwrap();
}

#[test]
fn create_snapshot_writes_snapshot_file_and_index() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("a.txt"), b"hello");

    let snapshot = SnapshotService::new()
        .create_snapshot(&repo_path, &source_path, "Initial import", |_| {})
        .unwrap();

    assert_eq!(snapshot.name, "Initial import");
    assert_eq!(snapshot.summary.file_count, 1);
    assert!(repo_path.join("snapshots").join(format!("{}.json", snapshot.id)).is_file());
    assert!(repo_path.join("indexes").join("snapshot-index.json").is_file());
}
```

- [x] **Step 2: Run test to verify failure**

```bash
cd src-tauri && cargo test create_snapshot_writes_snapshot_file_and_index
```

Expected: compile failure because snapshot modules do not exist.

- [x] **Step 3: Add snapshot structs**

Create `src-tauri/src/models/snapshot.rs`:

```rust
use serde::{Deserialize, Serialize};
use crate::models::block::BlockReference;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub source_root: String,
    pub summary: SnapshotSummary,
    pub files: Vec<SnapshotFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotSummary {
    pub file_count: u64,
    pub total_original_bytes: u64,
    pub total_block_references: u64,
    pub new_block_count: u64,
    pub reused_block_count: u64,
    pub new_stored_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotFile {
    pub relative_path: String,
    pub size_bytes: u64,
    pub modified_at: String,
    pub blocks: Vec<BlockReference>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotIndex {
    pub schema_version: u32,
    pub snapshots: Vec<SnapshotIndexItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotIndexItem {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub source_root: String,
    pub file_count: u64,
    pub total_original_bytes: u64,
    pub new_stored_bytes: u64,
}
```

- [x] **Step 4: Export model**

Update `src-tauri/src/models/mod.rs`:

```rust
pub mod snapshot;
```

- [x] **Step 5: Verify compile failure moves to missing service**

```bash
cd src-tauri && cargo test create_snapshot_writes_snapshot_file_and_index
```

Expected: failure now references missing `snapshot_service`.

## Task 3: Implement Snapshot Store

- [x] **Step 1: Write failing store tests**

Add to `src-tauri/tests/phase2_snapshot.rs`:

```rust
use chrona::core::snapshot_store::SnapshotStore;

#[test]
fn snapshot_store_rejects_path_traversal_ids() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    RepositoryManager::create(&repo_path).unwrap();

    let error = SnapshotStore::new(repo_path)
        .get_snapshot("../escape")
        .unwrap_err();

    assert!(error.to_string().contains("InvalidSnapshotId"));
}
```

- [x] **Step 2: Run test to verify failure**

```bash
cd src-tauri && cargo test snapshot_store_rejects_path_traversal_ids
```

Expected: compile failure because `SnapshotStore` does not exist.

- [x] **Step 3: Add error variants**

Update `src-tauri/src/core/errors.rs`:

```rust
#[error("InvalidSnapshotId: {0}")]
InvalidSnapshotId(String),
#[error("SnapshotNotFound: {0}")]
SnapshotNotFound(String),
```

- [x] **Step 4: Implement `SnapshotStore`**

Create `src-tauri/src/core/snapshot_store.rs` with these public methods:

```rust
pub struct SnapshotStore {
    repository_path: PathBuf,
}

impl SnapshotStore {
    pub fn new(repository_path: PathBuf) -> Self;
    pub fn ensure_layout(&self) -> ChronaResult<()>;
    pub fn write_snapshot(&self, snapshot: &Snapshot) -> ChronaResult<()>;
    pub fn get_snapshot(&self, snapshot_id: &str) -> ChronaResult<Snapshot>;
    pub fn list_snapshots(&self) -> ChronaResult<Vec<SnapshotIndexItem>>;
    pub fn add_to_index(&self, snapshot: &Snapshot) -> ChronaResult<()>;
}
```

Implementation rules:

- `ensure_layout` creates `snapshots/` and initializes `indexes/snapshot-index.json` if missing.
- `validate_snapshot_id` allows only ASCII alphanumeric, `_`, and `-`.
- `write_snapshot` writes `snapshots/{id}.json.tmp` then renames to `snapshots/{id}.json`.
- `add_to_index` reads existing index, removes any same-id item, inserts the new item, sorts newest first, writes `snapshot-index.json.tmp`, then renames.
- `get_snapshot` returns `SnapshotNotFound` when the file is missing.

- [x] **Step 5: Export core module**

Update `src-tauri/src/core/mod.rs`:

```rust
pub mod snapshot_store;
```

- [x] **Step 6: Verify store tests**

```bash
cd src-tauri && cargo test snapshot_store_rejects_path_traversal_ids
```

Expected: pass.

## Task 4: Implement Snapshot Service

- [x] **Step 1: Run existing failing create snapshot test**

```bash
cd src-tauri && cargo test create_snapshot_writes_snapshot_file_and_index
```

Expected: failure because `SnapshotService` does not exist.

- [x] **Step 2: Implement `SnapshotService`**

Create `src-tauri/src/core/snapshot_service.rs`:

```rust
pub struct SnapshotService;

impl SnapshotService {
    pub fn new() -> Self;

    pub fn create_snapshot<F>(
        &self,
        repository_path: &Path,
        source_path: &Path,
        name: &str,
        on_progress: F,
    ) -> ChronaResult<Snapshot>
    where
        F: FnMut(BlockIngestProgress);

    pub fn list_snapshots(&self, repository_path: &Path) -> ChronaResult<Vec<SnapshotIndexItem>>;
    pub fn get_snapshot(&self, repository_path: &Path, snapshot_id: &str) -> ChronaResult<Snapshot>;
}
```

Implementation details:

- `create_snapshot` calls `RepositoryManager::open`.
- It calls `SnapshotStore::ensure_layout` before ingest.
- It runs `BlockIngestService::ingest` with the same progress callback.
- It builds `SnapshotSummary` from `BlockIngestSummary`:
  - `file_count = summary.file_count`
  - `total_original_bytes = summary.total_input_bytes`
  - `total_block_references = summary.total_block_references`
  - `new_block_count = summary.new_block_count`
  - `reused_block_count = summary.reused_block_count`
  - `new_stored_bytes = summary.newly_stored_bytes`
- It maps `FileIngestResult` to `SnapshotFile`, preserving `relative_path`, `size_bytes`, `modified_at`, and `blocks`.
- Empty or whitespace snapshot names become `Untitled Snapshot`.
- `source_root` stores the canonical source path as a string.

Snapshot ID helper:

```rust
fn generate_snapshot_id(created_at: DateTime<Utc>) -> String {
    let prefix = created_at.format("%Y%m%dT%H%M%SZ");
    let suffix = Uuid::new_v4().to_string()[0..6].to_string();
    format!("{prefix}_{suffix}")
}
```

- [x] **Step 3: Export core module**

Update `src-tauri/src/core/mod.rs`:

```rust
pub mod snapshot_service;
```

- [x] **Step 4: Verify create snapshot test**

```bash
cd src-tauri && cargo test create_snapshot_writes_snapshot_file_and_index
```

Expected: pass.

- [x] **Step 5: Add duplicate snapshot reuse test**

Add to `src-tauri/tests/phase2_snapshot.rs`:

```rust
#[test]
fn second_snapshot_reuses_existing_blocks() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("a.txt"), b"hello");

    let service = SnapshotService::new();
    let first = service.create_snapshot(&repo_path, &source_path, "First", |_| {}).unwrap();
    let second = service.create_snapshot(&repo_path, &source_path, "Second", |_| {}).unwrap();

    assert_eq!(first.summary.new_block_count, 1);
    assert_eq!(second.summary.new_block_count, 0);
    assert_eq!(second.summary.reused_block_count, 1);
}
```

- [x] **Step 6: Verify duplicate reuse**

```bash
cd src-tauri && cargo test second_snapshot_reuses_existing_blocks
```

Expected: pass.

- [x] **Step 7: Commit**

```bash
git add src-tauri/src/models src-tauri/src/core src-tauri/tests/phase1_core.rs src-tauri/tests/phase2_snapshot.rs src/shared/types/chrona.ts
git commit -m "feat: add snapshot storage service"
```

## Task 5: Add Snapshot Tauri Commands

- [x] **Step 1: Add command wrappers**

Create `src-tauri/src/commands/snapshot_commands.rs`:

```rust
use std::path::PathBuf;
use tauri::Emitter;
use crate::core::snapshot_service::SnapshotService;
use crate::models::snapshot::{Snapshot, SnapshotIndexItem};

const BLOCK_INGEST_PROGRESS_EVENT: &str = "block-ingest-progress";

#[tauri::command]
pub fn create_snapshot(
    app: tauri::AppHandle,
    repository_path: String,
    source_path: String,
    name: String,
) -> Result<Snapshot, String> {
    SnapshotService::new()
        .create_snapshot(
            &PathBuf::from(repository_path),
            &PathBuf::from(source_path),
            &name,
            |event| {
                let _ = app.emit(BLOCK_INGEST_PROGRESS_EVENT, event);
            },
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_snapshots(repository_path: String) -> Result<Vec<SnapshotIndexItem>, String> {
    SnapshotService::new()
        .list_snapshots(&PathBuf::from(repository_path))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_snapshot(repository_path: String, snapshot_id: String) -> Result<Snapshot, String> {
    SnapshotService::new()
        .get_snapshot(&PathBuf::from(repository_path), &snapshot_id)
        .map_err(|error| error.to_string())
}
```

- [x] **Step 2: Export command module**

Update `src-tauri/src/commands/mod.rs`:

```rust
pub mod snapshot_commands;
```

- [x] **Step 3: Register commands in `src-tauri/src/main.rs`**

Import and register:

```rust
use chrona::commands::snapshot_commands::{create_snapshot, get_snapshot, list_snapshots};
```

Add to `generate_handler!`:

```rust
create_snapshot,
list_snapshots,
get_snapshot
```

- [x] **Step 4: Verify command compile**

```bash
cd src-tauri && cargo test
```

Expected: all Rust tests pass.

- [x] **Step 5: Commit**

```bash
git add src-tauri/src/commands src-tauri/src/main.rs
git commit -m "feat: expose snapshot commands"
```

## Task 6: Add TypeScript API and Minimal Snapshot UI

- [x] **Step 1: Add TypeScript types**

Update `src/shared/types/chrona.ts`:

```ts
export interface SnapshotSummary {
  fileCount: number;
  totalOriginalBytes: number;
  totalBlockReferences: number;
  newBlockCount: number;
  reusedBlockCount: number;
  newStoredBytes: number;
}

export interface SnapshotFile {
  relativePath: string;
  sizeBytes: number;
  modifiedAt: string;
  blocks: BlockReference[];
}

export interface Snapshot {
  schemaVersion: number;
  id: string;
  name: string;
  createdAt: string;
  sourceRoot: string;
  summary: SnapshotSummary;
  files: SnapshotFile[];
}

export interface SnapshotIndexItem {
  id: string;
  name: string;
  createdAt: string;
  sourceRoot: string;
  fileCount: number;
  totalOriginalBytes: number;
  newStoredBytes: number;
}
```

- [x] **Step 2: Add API wrappers**

Update `src/shared/api/chronaApi.ts` interface and `chronaApi` object:

```ts
createSnapshot(repositoryPath: string, sourcePath: string, name: string): Promise<Snapshot>;
listSnapshots(repositoryPath: string): Promise<SnapshotIndexItem[]>;
getSnapshot(repositoryPath: string, snapshotId: string): Promise<Snapshot>;
```

Use Tauri command names:

```ts
invoke<Snapshot>('create_snapshot', { repositoryPath, sourcePath, name })
invoke<SnapshotIndexItem[]>('list_snapshots', { repositoryPath })
invoke<Snapshot>('get_snapshot', { repositoryPath, snapshotId })
```

- [x] **Step 3: Write failing UI test**

Create `src/features/snapshots/SnapshotPanel.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { SnapshotPanel } from './SnapshotPanel';
import type { ChronaApi } from '../../shared/api/chronaApi';

function apiMock(): ChronaApi {
  return {
    createRepository: vi.fn(),
    openRepository: vi.fn(),
    ingestBlocks: vi.fn(),
    onBlockIngestProgress: vi.fn(async () => () => undefined),
    createSnapshot: vi.fn(async () => ({
      schemaVersion: 1,
      id: '20260619T103000Z_8f31c2',
      name: 'Initial import',
      createdAt: '2026-06-19T10:30:00Z',
      sourceRoot: '/tmp/source',
      summary: {
        fileCount: 1,
        totalOriginalBytes: 5,
        totalBlockReferences: 1,
        newBlockCount: 1,
        reusedBlockCount: 0,
        newStoredBytes: 5,
      },
      files: [],
    })),
    listSnapshots: vi.fn(async () => [
      {
        id: '20260619T103000Z_8f31c2',
        name: 'Initial import',
        createdAt: '2026-06-19T10:30:00Z',
        sourceRoot: '/tmp/source',
        fileCount: 1,
        totalOriginalBytes: 5,
        newStoredBytes: 5,
      },
    ]),
    getSnapshot: vi.fn(async () => ({
      schemaVersion: 1,
      id: '20260619T103000Z_8f31c2',
      name: 'Initial import',
      createdAt: '2026-06-19T10:30:00Z',
      sourceRoot: '/tmp/source',
      summary: {
        fileCount: 1,
        totalOriginalBytes: 5,
        totalBlockReferences: 1,
        newBlockCount: 1,
        reusedBlockCount: 0,
        newStoredBytes: 5,
      },
      files: [{ relativePath: 'a.txt', sizeBytes: 5, modifiedAt: '2026-06-19T10:00:00Z', blocks: [] }],
    })),
  };
}

describe('SnapshotPanel', () => {
  test('creates and displays a snapshot', async () => {
    const api = apiMock();
    const user = userEvent.setup();
    render(<SnapshotPanel api={api} repositoryPath="/tmp/repo" sourcePath="/tmp/source" repositoryOpen />);

    await user.type(screen.getByLabelText(/snapshot name/i), 'Initial import');
    await user.click(screen.getByRole('button', { name: /create snapshot/i }));

    await waitFor(() => expect(api.createSnapshot).toHaveBeenCalledWith('/tmp/repo', '/tmp/source', 'Initial import'));
    expect(screen.getByText('Initial import')).toBeInTheDocument();
    expect(screen.getByText('a.txt')).toBeInTheDocument();
  });
});
```

- [x] **Step 4: Run UI test to verify failure**

```bash
npm test SnapshotPanel
```

Expected: compile failure because `SnapshotPanel` does not exist.

- [x] **Step 5: Implement `SnapshotPanel`**

Create `src/features/snapshots/SnapshotPanel.tsx` with:

- snapshot name input
- create snapshot button disabled unless repository is open and source path is non-empty
- list snapshots button or automatic refresh after create
- list of snapshot index items
- selected snapshot detail with file count, original bytes, new stored bytes, and first-level file list

Props:

```ts
interface SnapshotPanelProps {
  api?: ChronaApi;
  repositoryPath: string;
  sourcePath: string;
  repositoryOpen: boolean;
}
```

- [x] **Step 6: Mount panel**

Update `RepositoryPage.tsx`:

```tsx
<SnapshotPanel
  api={api}
  repositoryPath={repositoryPath}
  sourcePath={sourcePath}
  repositoryOpen={Boolean(manifest)}
/>
```

- [x] **Step 7: Verify frontend**

```bash
npm test
npm run build
```

Expected: both pass.

- [x] **Step 8: Commit**

```bash
git add src/shared src/features src/App.tsx
git commit -m "feat: add snapshot UI"
```

## Task 7: Update Docs and Final Verification

- [x] **Step 1: Update development log**

Add Phase 2 implementation notes to `docs/development-log.md`:

```markdown
### Completed
- Implemented snapshot metadata persistence.
- Added snapshot create/list/detail commands.
- Added minimal snapshot UI.

### Verification
- `cargo test`: passed.
- `npm test`: passed.
- `npm run build`: passed.
```

- [x] **Step 2: Create implemented record**

Create `docs/implemented/snapshot-engine.md` after code completion. Include:

- goal
- implemented scope
- snapshot JSON format
- snapshot index behavior
- tests
- known limits

- [x] **Step 3: Run full verification**

```bash
npm test
npm run build
cd src-tauri && cargo test
```

Expected:

- Vitest passes all UI tests.
- TypeScript production build passes.
- Cargo passes Phase 1 and Phase 2 integration tests.

- [x] **Step 4: Commit docs**

```bash
git add docs
git commit -m "docs: record snapshot engine implementation"
```

## Phase 2 Completion Criteria

Phase 2 is complete when:

- New and existing repositories have a `snapshots/` directory.
- New and existing repositories have `indexes/snapshot-index.json`.
- `create_snapshot` creates block data and snapshot metadata.
- `list_snapshots` returns newest-first index items.
- `get_snapshot` returns full snapshot details.
- Snapshot files and index writes use `.tmp` then rename.
- Invalid snapshot IDs cannot escape `snapshots/`.
- `FileIngestResult` includes `modifiedAt`.
- Minimal UI can create and display snapshots.
- Snapshot comparison and restore remain unimplemented.
- `cargo test`, `npm test`, and `npm run build` pass.

## Self-Review

- Spec coverage: this plan covers snapshot format, index format, command API, persistence, UI, and tests from `docs/specs/0003-snapshot-format.md`.
- Placeholder scan: no unresolved marker language is used.
- Type consistency: Rust `modified_at` maps to TypeScript `modifiedAt`; Rust `new_stored_bytes` maps to TypeScript `newStoredBytes`; command names use snake_case Tauri names and camelCase JS arguments.
