# Repository Inventory Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Repository Explorer/Inventory view that shows recorded source files, file kinds, snapshot presence/deletion state, and current original-file existence status.

**Architecture:** Keep this feature metadata-first and read-only. Rust loads snapshot metadata through `SnapshotStore`, aggregates file entries by normalized relative path, classifies file kind by extension, optionally checks source-root file existence, and returns a summary-first report to React. The UI adds an Explorer section to the existing workspace sidebar and renders summary cards, filters, and a file table.

**Tech Stack:** Rust, serde, Tauri 2 commands, React, TypeScript, Vitest, Cargo integration tests, JSON snapshot metadata.

---

## Scope

Included:

- repository inventory report models
- metadata-only inventory service
- source existence check using snapshot source root and relative path
- file kind classification by extension
- Tauri command and TypeScript API
- Explorer UI section
- Rust and UI tests
- docs and development-log updates

Excluded:

- compression and compressed block format
- raw block reading or hash verification
- block garbage collection
- snapshot deletion
- filesystem watcher
- automatic repair
- MIME sniffing from file contents
- SQLite migration

## File Structure

Create:

- `src-tauri/src/models/inventory.rs`
  - Defines `RepositoryInventoryReport`, `InventoryFileEntry`, `FileKindStat`, `FileKind`, `SnapshotPresenceState`, and `SourceExistenceState`.
- `src-tauri/src/core/inventory_service.rs`
  - Loads snapshots, aggregates paths, classifies kinds, checks source existence, and returns report.
- `src-tauri/src/commands/inventory_commands.rs`
  - Exposes `get_repository_inventory(repository_path)`.
- `src-tauri/tests/phase5_inventory.rs`
  - Integration tests for one snapshot, deleted paths, kind classification, and source existence.
- `docs/implemented/repository-inventory-explorer.md`
  - Written after implementation.

Modify:

- `src-tauri/src/models/mod.rs`
  - Export `inventory`.
- `src-tauri/src/core/mod.rs`
  - Export `inventory_service`.
- `src-tauri/src/commands/mod.rs`
  - Export `inventory_commands`.
- `src-tauri/src/main.rs`
  - Register `get_repository_inventory`.
- `src/shared/types/chrona.ts`
  - Add TypeScript inventory types.
- `src/shared/api/chronaApi.ts`
  - Add `getRepositoryInventory(repositoryPath)`.
- `src/features/repository/RepositoryPage.tsx`
  - Add Explorer chapter, filters, table, and refresh action.
- `src/features/repository/RepositoryPage.css`
  - Add Explorer table/filter styles using existing design tokens.
- `src/features/repository/RepositoryPage.test.tsx`
  - Add UI coverage for Explorer invocation and rendering.
- `src/features/snapshots/SnapshotPanel.test.tsx`
  - Add `getRepositoryInventory` mock method returning an empty inventory report.
- `src/features/snapshots/SnapshotComparePanel.test.tsx`
  - Add `getRepositoryInventory` mock method returning an empty inventory report.
- `docs/plans/README.md`
  - Archive plan after implementation.
- `docs/development-log.md`
  - Record implementation and verification.
- `README.md`, `README.ko.md`
  - Add feature status after implementation.

## Task 1: Rust Inventory Models and Kind Classifier

**Files:**

- Create: `src-tauri/src/models/inventory.rs`
- Modify: `src-tauri/src/models/mod.rs`
- Test: `src-tauri/tests/phase5_inventory.rs`

- [ ] **Step 1: Write failing kind classification test**

Add `src-tauri/tests/phase5_inventory.rs`:

```rust
use chrona::models::inventory::FileKind;
use chrona::core::inventory_service::classify_file_kind;

#[test]
fn classifies_file_kind_from_extension() {
    assert_eq!(classify_file_kind("notes.md"), FileKind::Document);
    assert_eq!(classify_file_kind("photo.PNG"), FileKind::Image);
    assert_eq!(classify_file_kind("clip.mp4"), FileKind::Video);
    assert_eq!(classify_file_kind("main.rs"), FileKind::Code);
    assert_eq!(classify_file_kind("archive.zip"), FileKind::Archive);
    assert_eq!(classify_file_kind("unknown.custom"), FileKind::Unknown);
}
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
cd src-tauri && cargo test --test phase5_inventory classifies_file_kind_from_extension
```

Expected: compile failure because `inventory` model and `inventory_service` do not exist.

- [ ] **Step 3: Add inventory models**

Create `src-tauri/src/models/inventory.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryInventoryReport {
    pub schema_version: u32,
    pub repository_path: String,
    pub generated_at: String,
    pub snapshot_count: u64,
    pub known_file_count: u64,
    pub latest_file_count: u64,
    pub deleted_in_latest_count: u64,
    pub source_exists_count: u64,
    pub source_missing_count: u64,
    pub source_root_missing_count: u64,
    pub total_original_bytes_latest: u64,
    pub total_block_references_latest: u64,
    pub unique_block_count_latest: u64,
    pub kind_stats: Vec<FileKindStat>,
    pub files: Vec<InventoryFileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileKindStat {
    pub kind: FileKind,
    pub file_count: u64,
    pub total_bytes_latest: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InventoryFileEntry {
    pub relative_path: String,
    pub file_name: String,
    pub extension: Option<String>,
    pub kind: FileKind,
    pub snapshot_state: SnapshotPresenceState,
    pub source_state: SourceExistenceState,
    pub latest_size_bytes: Option<u64>,
    pub latest_modified_at: Option<String>,
    pub first_seen_snapshot_id: String,
    pub first_seen_at: String,
    pub last_seen_snapshot_id: String,
    pub last_seen_at: String,
    pub seen_in_snapshot_count: u64,
    pub block_reference_count_latest: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[serde(rename_all = "camelCase")]
pub enum FileKind {
    Document,
    Image,
    Video,
    Audio,
    Archive,
    Code,
    Text,
    Data,
    Binary,
    Folderless,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SnapshotPresenceState {
    PresentInLatest,
    DeletedInLatest,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SourceExistenceState {
    Exists,
    Missing,
    SourceRootMissing,
    Unchecked,
}
```

Modify `src-tauri/src/models/mod.rs`:

```rust
pub mod inventory;
```

- [ ] **Step 4: Add minimal classifier**

Create `src-tauri/src/core/inventory_service.rs`:

```rust
use crate::models::inventory::FileKind;

pub fn classify_file_kind(relative_path: &str) -> FileKind {
    let Some(file_name) = relative_path.rsplit('/').next() else {
        return FileKind::Unknown;
    };
    if !file_name.contains('.') {
        return FileKind::Folderless;
    }
    let extension = file_name
        .rsplit('.')
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase();

    match extension.as_str() {
        "pdf" | "doc" | "docx" | "ppt" | "pptx" | "xls" | "xlsx" | "md" | "rtf" => FileKind::Document,
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "heic" | "svg" => FileKind::Image,
        "mp4" | "mov" | "mkv" | "avi" | "webm" => FileKind::Video,
        "mp3" | "wav" | "flac" | "aac" | "m4a" | "ogg" => FileKind::Audio,
        "zip" | "tar" | "gz" | "bz2" | "xz" | "7z" | "rar" => FileKind::Archive,
        "rs" | "ts" | "tsx" | "js" | "jsx" | "py" | "java" | "c" | "cpp" | "h" | "go" | "swift" | "kt" | "html" | "css" | "json" | "toml" | "yaml" | "yml" => FileKind::Code,
        "txt" | "log" | "csv" => FileKind::Text,
        "sqlite" | "db" | "parquet" | "xml" => FileKind::Data,
        "bin" | "dat" => FileKind::Binary,
        _ => FileKind::Unknown,
    }
}
```

Modify `src-tauri/src/core/mod.rs`:

```rust
pub mod inventory_service;
```

- [ ] **Step 5: Run test to verify GREEN**

Run:

```bash
cd src-tauri && cargo test --test phase5_inventory classifies_file_kind_from_extension
```

Expected: test passes.

## Task 2: Metadata-Only Inventory Service

**Files:**

- Modify: `src-tauri/src/core/inventory_service.rs`
- Test: `src-tauri/tests/phase5_inventory.rs`

- [ ] **Step 1: Write failing one-snapshot inventory test**

Append to `src-tauri/tests/phase5_inventory.rs`:

```rust
use std::fs;
use std::io::Write;
use std::path::Path;

use chrona::core::inventory_service::InventoryService;
use chrona::core::repository::RepositoryManager;
use chrona::core::snapshot_service::SnapshotService;
use chrona::models::inventory::{SnapshotPresenceState, SourceExistenceState};
use tempfile::TempDir;

fn write_file(path: &Path, bytes: &[u8]) {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    let mut file = fs::File::create(path).unwrap();
    file.write_all(bytes).unwrap();
}

#[test]
fn inventory_reports_files_from_latest_snapshot() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("notes.md"), b"hello");
    write_file(&source_path.join("images/photo.png"), b"png bytes");

    SnapshotService::new()
        .create_snapshot(&repo_path, &source_path, "Initial", |_| {})
        .unwrap();

    let report = InventoryService::new()
        .get_repository_inventory(&repo_path)
        .unwrap();

    assert_eq!(report.snapshot_count, 1);
    assert_eq!(report.known_file_count, 2);
    assert_eq!(report.latest_file_count, 2);
    assert_eq!(report.deleted_in_latest_count, 0);
    assert_eq!(report.source_exists_count, 2);
    assert!(report.files.iter().any(|file| {
        file.relative_path == "notes.md"
            && file.snapshot_state == SnapshotPresenceState::PresentInLatest
            && file.source_state == SourceExistenceState::Exists
    }));
}
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
cd src-tauri && cargo test --test phase5_inventory inventory_reports_files_from_latest_snapshot
```

Expected: compile failure because `InventoryService` is not implemented.

- [ ] **Step 3: Implement `InventoryService::get_repository_inventory`**

Extend `src-tauri/src/core/inventory_service.rs` with:

```rust
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use chrono::Utc;

use crate::core::errors::{ChronaError, ChronaResult};
use crate::core::repository::RepositoryManager;
use crate::core::snapshot_store::SnapshotStore;
use crate::models::inventory::{
    FileKind, FileKindStat, InventoryFileEntry, RepositoryInventoryReport,
    SnapshotPresenceState, SourceExistenceState,
};
use crate::models::snapshot::SnapshotFile;

const REPORT_SCHEMA_VERSION: u32 = 1;

pub struct InventoryService;

impl InventoryService {
    pub fn new() -> Self {
        Self
    }

    pub fn get_repository_inventory(&self, repository_path: &Path) -> ChronaResult<RepositoryInventoryReport> {
        RepositoryManager::open(repository_path)?;
        let snapshot_store = SnapshotStore::new(repository_path.to_path_buf());
        let snapshot_items = snapshot_store.list_snapshots()?;
        let latest_snapshot_id = snapshot_items.first().map(|item| item.id.clone());
        let mut files_by_path: BTreeMap<String, AccumulatedFile> = BTreeMap::new();
        let mut latest_block_hashes = BTreeSet::new();
        let mut total_original_bytes_latest = 0_u64;
        let mut total_block_references_latest = 0_u64;

        for item in snapshot_items.iter().rev() {
            let snapshot = snapshot_store.get_snapshot(&item.id)?;
            let is_latest = latest_snapshot_id.as_deref() == Some(snapshot.id.as_str());
            for file in snapshot.files {
                let entry = files_by_path.entry(file.relative_path.clone()).or_insert_with(|| {
                    AccumulatedFile::new(&snapshot.id, &snapshot.created_at, &snapshot.source_root, &file)
                });
                entry.record_seen(&snapshot.id, &snapshot.created_at, &snapshot.source_root, &file, is_latest);
                if is_latest {
                    total_original_bytes_latest += file.size_bytes;
                    total_block_references_latest += file.blocks.len() as u64;
                    for block in &file.blocks {
                        latest_block_hashes.insert(block.hash.clone());
                    }
                }
            }
        }

        let mut source_exists_count = 0_u64;
        let mut source_missing_count = 0_u64;
        let mut source_root_missing_count = 0_u64;
        let mut kind_counts: BTreeMap<FileKind, (u64, u64)> = BTreeMap::new();
        let mut files = Vec::new();

        for (relative_path, accumulated) in files_by_path {
            let kind = classify_file_kind(&relative_path);
            let snapshot_state = if accumulated.present_in_latest {
                SnapshotPresenceState::PresentInLatest
            } else {
                SnapshotPresenceState::DeletedInLatest
            };
            let source_state = source_state_for(&accumulated.source_root, &relative_path)?;
            match source_state {
                SourceExistenceState::Exists => source_exists_count += 1,
                SourceExistenceState::Missing => source_missing_count += 1,
                SourceExistenceState::SourceRootMissing => source_root_missing_count += 1,
                SourceExistenceState::Unchecked => {}
            }
            if accumulated.present_in_latest {
                let stat = kind_counts.entry(kind.clone()).or_insert((0, 0));
                stat.0 += 1;
                stat.1 += accumulated.latest_size_bytes.unwrap_or(0);
            }
            files.push(accumulated.into_entry(relative_path, kind, snapshot_state, source_state));
        }

        let kind_stats = kind_counts
            .into_iter()
            .map(|(kind, (file_count, total_bytes_latest))| FileKindStat {
                kind,
                file_count,
                total_bytes_latest,
            })
            .collect();

        Ok(RepositoryInventoryReport {
            schema_version: REPORT_SCHEMA_VERSION,
            repository_path: repository_path.display().to_string(),
            generated_at: Utc::now().to_rfc3339(),
            snapshot_count: snapshot_items.len() as u64,
            known_file_count: files.len() as u64,
            latest_file_count: files.iter().filter(|file| file.snapshot_state == SnapshotPresenceState::PresentInLatest).count() as u64,
            deleted_in_latest_count: files.iter().filter(|file| file.snapshot_state == SnapshotPresenceState::DeletedInLatest).count() as u64,
            source_exists_count,
            source_missing_count,
            source_root_missing_count,
            total_original_bytes_latest,
            total_block_references_latest,
            unique_block_count_latest: latest_block_hashes.len() as u64,
            kind_stats,
            files,
        })
    }
}
```

Then add private helpers in the same file:

```rust
struct AccumulatedFile {
    source_root: String,
    first_seen_snapshot_id: String,
    first_seen_at: String,
    last_seen_snapshot_id: String,
    last_seen_at: String,
    seen_in_snapshot_count: u64,
    present_in_latest: bool,
    latest_size_bytes: Option<u64>,
    latest_modified_at: Option<String>,
    block_reference_count_latest: u64,
}

impl AccumulatedFile {
    fn new(snapshot_id: &str, snapshot_created_at: &str, source_root: &str, file: &SnapshotFile) -> Self {
        Self {
            source_root: source_root.to_string(),
            first_seen_snapshot_id: snapshot_id.to_string(),
            first_seen_at: snapshot_created_at.to_string(),
            last_seen_snapshot_id: snapshot_id.to_string(),
            last_seen_at: snapshot_created_at.to_string(),
            seen_in_snapshot_count: 0,
            present_in_latest: false,
            latest_size_bytes: Some(file.size_bytes),
            latest_modified_at: Some(file.modified_at.clone()),
            block_reference_count_latest: 0,
        }
    }

    fn record_seen(&mut self, snapshot_id: &str, snapshot_created_at: &str, source_root: &str, file: &SnapshotFile, is_latest: bool) {
        self.source_root = source_root.to_string();
        self.last_seen_snapshot_id = snapshot_id.to_string();
        self.last_seen_at = snapshot_created_at.to_string();
        self.seen_in_snapshot_count += 1;
        if is_latest {
            self.present_in_latest = true;
            self.latest_size_bytes = Some(file.size_bytes);
            self.latest_modified_at = Some(file.modified_at.clone());
            self.block_reference_count_latest = file.blocks.len() as u64;
        }
    }

    fn into_entry(
        self,
        relative_path: String,
        kind: FileKind,
        snapshot_state: SnapshotPresenceState,
        source_state: SourceExistenceState,
    ) -> InventoryFileEntry {
        InventoryFileEntry {
            file_name: file_name(&relative_path),
            extension: extension(&relative_path),
            relative_path,
            kind,
            snapshot_state,
            source_state,
            latest_size_bytes: self.latest_size_bytes,
            latest_modified_at: self.latest_modified_at,
            first_seen_snapshot_id: self.first_seen_snapshot_id,
            first_seen_at: self.first_seen_at,
            last_seen_snapshot_id: self.last_seen_snapshot_id,
            last_seen_at: self.last_seen_at,
            seen_in_snapshot_count: self.seen_in_snapshot_count,
            block_reference_count_latest: self.block_reference_count_latest,
        }
    }
}

fn source_state_for(source_root: &str, relative_path: &str) -> ChronaResult<SourceExistenceState> {
    if source_root.is_empty() {
        return Ok(SourceExistenceState::Unchecked);
    }
    let root = PathBuf::from(source_root);
    if !root.is_dir() {
        return Ok(SourceExistenceState::SourceRootMissing);
    }
    let relative = safe_relative_path(relative_path)?;
    if root.join(relative).is_file() {
        Ok(SourceExistenceState::Exists)
    } else {
        Ok(SourceExistenceState::Missing)
    }
}

fn safe_relative_path(relative_path: &str) -> ChronaResult<PathBuf> {
    if relative_path.starts_with('/') || relative_path.contains("..") || relative_path.contains('\') {
        return Err(ChronaError::UnsafeRelativePath(relative_path.to_string()));
    }
    Ok(relative_path.split('/').collect())
}

fn file_name(relative_path: &str) -> String {
    relative_path.rsplit('/').next().unwrap_or(relative_path).to_string()
}

fn extension(relative_path: &str) -> Option<String> {
    let name = file_name(relative_path);
    name.rsplit_once('.').map(|(_, extension)| extension.to_ascii_lowercase())
}
```

- [ ] **Step 4: Run one-snapshot test**

Run:

```bash
cd src-tauri && cargo test --test phase5_inventory inventory_reports_files_from_latest_snapshot
```

Expected: test passes.

## Task 3: Deleted and Missing Source States

**Files:**

- Modify: `src-tauri/tests/phase5_inventory.rs`
- Modify: `src-tauri/src/core/inventory_service.rs`

- [ ] **Step 1: Write failing deleted/missing test**

Append:

```rust
#[test]
fn inventory_distinguishes_deleted_in_latest_from_missing_source_file() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("kept.txt"), b"kept");
    write_file(&source_path.join("deleted.txt"), b"deleted");

    SnapshotService::new()
        .create_snapshot(&repo_path, &source_path, "Before delete", |_| {})
        .unwrap();

    fs::remove_file(source_path.join("deleted.txt")).unwrap();
    write_file(&source_path.join("missing-latest.txt"), b"will disappear after latest snapshot");

    SnapshotService::new()
        .create_snapshot(&repo_path, &source_path, "After delete", |_| {})
        .unwrap();

    fs::remove_file(source_path.join("missing-latest.txt")).unwrap();

    let report = InventoryService::new()
        .get_repository_inventory(&repo_path)
        .unwrap();

    let deleted = report.files.iter().find(|file| file.relative_path == "deleted.txt").unwrap();
    assert_eq!(deleted.snapshot_state, SnapshotPresenceState::DeletedInLatest);

    let missing_latest = report.files.iter().find(|file| file.relative_path == "missing-latest.txt").unwrap();
    assert_eq!(missing_latest.snapshot_state, SnapshotPresenceState::PresentInLatest);
    assert_eq!(missing_latest.source_state, SourceExistenceState::Missing);
}
```

- [ ] **Step 2: Run test to verify RED or behavior gap**

Run:

```bash
cd src-tauri && cargo test --test phase5_inventory inventory_distinguishes_deleted_in_latest_from_missing_source_file
```

Expected: fail until source-root state and latest presence aggregation are correct.

- [ ] **Step 3: Fix source-root tracking and latest presence**

In `inventory_service.rs`, ensure each accumulated file tracks the source root from the newest snapshot where the file appears:

```rust
fn record_seen(
    &mut self,
    snapshot_id: &str,
    snapshot_created_at: &str,
    source_root: &str,
    file: &SnapshotFile,
    is_latest: bool,
) {
    self.source_root = source_root.to_string();
    self.last_seen_snapshot_id = snapshot_id.to_string();
    self.last_seen_at = snapshot_created_at.to_string();
    self.seen_in_snapshot_count += 1;
    if is_latest {
        self.present_in_latest = true;
        self.latest_size_bytes = Some(file.size_bytes);
        self.latest_modified_at = Some(file.modified_at.clone());
        self.block_reference_count_latest = file.blocks.len() as u64;
    }
}
```

Call it with:

```rust
entry.record_seen(&snapshot.id, &snapshot.created_at, &snapshot.source_root, &file, is_latest);
```

- [ ] **Step 4: Add source-root-missing test**

Append:

```rust
#[test]
fn inventory_marks_source_root_missing_without_failing_report() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("gone.txt"), b"gone");

    SnapshotService::new()
        .create_snapshot(&repo_path, &source_path, "Source root", |_| {})
        .unwrap();
    fs::remove_dir_all(&source_path).unwrap();

    let report = InventoryService::new()
        .get_repository_inventory(&repo_path)
        .unwrap();

    assert_eq!(report.source_root_missing_count, 1);
    assert_eq!(report.files[0].source_state, SourceExistenceState::SourceRootMissing);
}
```

- [ ] **Step 5: Add empty repository test**

Append:

```rust
#[test]
fn inventory_handles_repository_without_snapshots() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    RepositoryManager::create(&repo_path).unwrap();

    let report = InventoryService::new()
        .get_repository_inventory(&repo_path)
        .unwrap();

    assert_eq!(report.snapshot_count, 0);
    assert_eq!(report.known_file_count, 0);
    assert!(report.files.is_empty());
}
```

- [ ] **Step 6: Run inventory tests**

Run:

```bash
cd src-tauri && cargo test --test phase5_inventory
```

Expected: all Phase 5 inventory tests pass.

## Task 4: Command and TypeScript API

**Files:**

- Create: `src-tauri/src/commands/inventory_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src/shared/types/chrona.ts`
- Modify: `src/shared/api/chronaApi.ts`

- [ ] **Step 1: Add command wrapper**

Create `src-tauri/src/commands/inventory_commands.rs`:

```rust
use std::path::PathBuf;

use crate::core::inventory_service::InventoryService;
use crate::models::inventory::RepositoryInventoryReport;

#[tauri::command]
pub fn get_repository_inventory(repository_path: String) -> Result<RepositoryInventoryReport, String> {
    InventoryService::new()
        .get_repository_inventory(&PathBuf::from(repository_path))
        .map_err(|error| error.to_string())
}
```

- [ ] **Step 2: Register Rust modules and handler**

Modify `src-tauri/src/commands/mod.rs`:

```rust
pub mod inventory_commands;
```

Modify `src-tauri/src/main.rs`:

```rust
use chrona::models::inventory::RepositoryInventoryReport;

#[tauri::command]
fn get_repository_inventory(repository_path: String) -> Result<RepositoryInventoryReport, String> {
    chrona::commands::inventory_commands::get_repository_inventory(repository_path)
}
```

Add `get_repository_inventory` to `tauri::generate_handler![...]`.

- [ ] **Step 3: Add TypeScript types**

Add to `src/shared/types/chrona.ts`:

```ts
export type FileKind = 'document' | 'image' | 'video' | 'audio' | 'archive' | 'code' | 'text' | 'data' | 'binary' | 'folderless' | 'unknown';
export type SnapshotPresenceState = 'presentInLatest' | 'deletedInLatest';
export type SourceExistenceState = 'exists' | 'missing' | 'sourceRootMissing' | 'unchecked';

export interface FileKindStat {
  kind: FileKind;
  fileCount: number;
  totalBytesLatest: number;
}

export interface InventoryFileEntry {
  relativePath: string;
  fileName: string;
  extension: string | null;
  kind: FileKind;
  snapshotState: SnapshotPresenceState;
  sourceState: SourceExistenceState;
  latestSizeBytes: number | null;
  latestModifiedAt: string | null;
  firstSeenSnapshotId: string;
  firstSeenAt: string;
  lastSeenSnapshotId: string;
  lastSeenAt: string;
  seenInSnapshotCount: number;
  blockReferenceCountLatest: number;
}

export interface RepositoryInventoryReport {
  schemaVersion: number;
  repositoryPath: string;
  generatedAt: string;
  snapshotCount: number;
  knownFileCount: number;
  latestFileCount: number;
  deletedInLatestCount: number;
  sourceExistsCount: number;
  sourceMissingCount: number;
  sourceRootMissingCount: number;
  totalOriginalBytesLatest: number;
  totalBlockReferencesLatest: number;
  uniqueBlockCountLatest: number;
  kindStats: FileKindStat[];
  files: InventoryFileEntry[];
}
```

- [ ] **Step 4: Add API wrapper**

Modify `src/shared/api/chronaApi.ts`:

```ts
getRepositoryInventory(repositoryPath: string): Promise<RepositoryInventoryReport>;
```

Implementation:

```ts
getRepositoryInventory(repositoryPath) {
  return invoke<RepositoryInventoryReport>('get_repository_inventory', { repositoryPath });
}
```

- [ ] **Step 5: Verify Rust compile and TS compile**

Run:

```bash
cd src-tauri && cargo test --test phase5_inventory
npm run build
```

Expected: Rust inventory tests pass and TypeScript build succeeds after test mocks are updated in Task 5.

## Task 5: Explorer UI

**Files:**

- Modify: `src/features/repository/RepositoryPage.tsx`
- Modify: `src/features/repository/RepositoryPage.css`
- Modify: `src/features/repository/RepositoryPage.test.tsx`
- Modify: `src/features/snapshots/SnapshotPanel.test.tsx`
- Modify: `src/features/snapshots/SnapshotComparePanel.test.tsx`

- [ ] **Step 1: Add failing UI test**

In `RepositoryPage.test.tsx`, add mock `getRepositoryInventory` returning:

```ts
getRepositoryInventory: vi.fn(async () => ({
  schemaVersion: 1,
  repositoryPath: '/tmp/chrona-repo',
  generatedAt: '2026-06-27T00:00:00Z',
  snapshotCount: 2,
  knownFileCount: 3,
  latestFileCount: 2,
  deletedInLatestCount: 1,
  sourceExistsCount: 1,
  sourceMissingCount: 1,
  sourceRootMissingCount: 0,
  totalOriginalBytesLatest: 12,
  totalBlockReferencesLatest: 2,
  uniqueBlockCountLatest: 2,
  kindStats: [
    { kind: 'document', fileCount: 1, totalBytesLatest: 5 },
    { kind: 'image', fileCount: 1, totalBytesLatest: 7 },
  ],
  files: [
    {
      relativePath: 'notes.md',
      fileName: 'notes.md',
      extension: 'md',
      kind: 'document',
      snapshotState: 'presentInLatest',
      sourceState: 'exists',
      latestSizeBytes: 5,
      latestModifiedAt: '2026-06-27T00:00:00Z',
      firstSeenSnapshotId: 'first',
      firstSeenAt: '2026-06-26T00:00:00Z',
      lastSeenSnapshotId: 'latest',
      lastSeenAt: '2026-06-27T00:00:00Z',
      seenInSnapshotCount: 2,
      blockReferenceCountLatest: 1,
    },
    {
      relativePath: 'old.txt',
      fileName: 'old.txt',
      extension: 'txt',
      kind: 'text',
      snapshotState: 'deletedInLatest',
      sourceState: 'missing',
      latestSizeBytes: null,
      latestModifiedAt: null,
      firstSeenSnapshotId: 'first',
      firstSeenAt: '2026-06-26T00:00:00Z',
      lastSeenSnapshotId: 'first',
      lastSeenAt: '2026-06-26T00:00:00Z',
      seenInSnapshotCount: 1,
      blockReferenceCountLatest: 0,
    },
  ],
})),
```

Add test:

```ts
test('opens repository explorer and renders inventory rows', async () => {
  const { api } = createApiMock();
  const user = userEvent.setup();
  render(<RepositoryPage api={api} />);

  await user.type(screen.getByLabelText(/repository path/i), '/tmp/chrona-repo');
  await user.click(screen.getByRole('button', { name: /open repository/i }));

  await user.click(screen.getByRole('button', { name: /explorer/i }));
  await user.click(screen.getByRole('button', { name: /refresh inventory/i }));

  await waitFor(() => expect(api.getRepositoryInventory).toHaveBeenCalledWith('/tmp/chrona-repo'));
  expect(screen.getByText('Known files').nextElementSibling).toHaveTextContent('3');
  expect(screen.getByText('Deleted in latest').nextElementSibling).toHaveTextContent('1');
  expect(screen.getByText('notes.md')).toBeInTheDocument();
  expect(screen.getByText('old.txt')).toBeInTheDocument();
  expect(screen.getByText('deletedInLatest')).toBeInTheDocument();
  expect(screen.getByText('missing')).toBeInTheDocument();
});
```

Run:

```bash
npm test -- RepositoryPage.test.tsx
```

Expected: fail because Explorer UI does not exist.

- [ ] **Step 2: Add Explorer chapter and state**

Modify `RepositoryPage.tsx`:

- Add a sidebar chapter `Explorer` with a `Search` or `Files` icon from `lucide-react`.
- Add state:

```ts
const [inventoryReport, setInventoryReport] = useState<RepositoryInventoryReport | null>(null);
const [inventoryQuery, setInventoryQuery] = useState('');
const [inventoryKindFilter, setInventoryKindFilter] = useState<FileKind | 'all'>('all');
const [inventorySnapshotFilter, setInventorySnapshotFilter] = useState<SnapshotPresenceState | 'all'>('all');
const [inventorySourceFilter, setInventorySourceFilter] = useState<SourceExistenceState | 'all'>('all');
```

- Add action:

```ts
async function refreshInventory() {
  await runAction(async () => {
    setInventoryReport(await api.getRepositoryInventory(repositoryPath));
  });
}
```

- Reset `inventoryReport` when repository is created/opened.

- [ ] **Step 3: Add Explorer rendering**

Render a `DropPanel` for active `explorer`:

```tsx
<DropPanel
  title="Repository inventory"
  kicker="Explorer"
  status={inventoryReport ? 'Loaded' : manifest ? 'Ready' : 'Waiting'}
  icon={Files}
  open={openPanels.explorer}
  onToggle={() => togglePanel('explorer')}
>
  <div className="run-card">
    <div>
      <strong>Repository Explorer</strong>
      <p>Shows recorded files, file kinds, snapshot state, and current source existence.</p>
    </div>
    <button type="button" disabled={busy || !manifest} onClick={refreshInventory}>
      <RotateCw size={16} />
      Refresh Inventory
    </button>
  </div>
  <InventoryContent
    report={inventoryReport}
    repositoryOpen={Boolean(manifest)}
    query={inventoryQuery}
    kindFilter={inventoryKindFilter}
    snapshotFilter={inventorySnapshotFilter}
    sourceFilter={inventorySourceFilter}
    onQueryChange={setInventoryQuery}
    onKindFilterChange={setInventoryKindFilter}
    onSnapshotFilterChange={setInventorySnapshotFilter}
    onSourceFilterChange={setInventorySourceFilter}
  />
</DropPanel>
```

`InventoryContent` should render summary cards, filters, and a table. Use exact status strings from the API for MVP labels: `presentInLatest`, `deletedInLatest`, `exists`, `missing`, `sourceRootMissing`, `unchecked`.

- [ ] **Step 4: Add CSS**

Add styles to `RepositoryPage.css`:

```css
.inventory-content {
  display: grid;
  gap: 14px;
  margin-top: 14px;
}

.inventory-filters {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) repeat(3, minmax(130px, auto));
  gap: 8px;
}

.inventory-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}

.inventory-table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
}

.inventory-table th,
.inventory-table td {
  border-bottom: 1px solid var(--border);
  padding: 10px 11px;
  text-align: left;
  vertical-align: middle;
}

.inventory-table th {
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 820;
  text-transform: uppercase;
}

.inventory-path {
  max-width: 360px;
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 5: Update all ChronaApi mocks**

Add this mock to `SnapshotPanel.test.tsx`, `SnapshotComparePanel.test.tsx`, and any other `ChronaApi` mock that does not test inventory directly:

```ts
getRepositoryInventory: vi.fn(async () => ({
  schemaVersion: 1,
  repositoryPath: '/tmp/repo',
  generatedAt: '2026-06-27T00:00:00Z',
  snapshotCount: 0,
  knownFileCount: 0,
  latestFileCount: 0,
  deletedInLatestCount: 0,
  sourceExistsCount: 0,
  sourceMissingCount: 0,
  sourceRootMissingCount: 0,
  totalOriginalBytesLatest: 0,
  totalBlockReferencesLatest: 0,
  uniqueBlockCountLatest: 0,
  kindStats: [],
  files: [],
})),
```

- [ ] **Step 6: Run UI tests**

Run:

```bash
npm test
npm run build
```

Expected: all UI tests and build pass.

## Task 6: Documentation and Verification

**Files:**

- Create: `docs/implemented/repository-inventory-explorer.md`
- Modify: `docs/development-log.md`
- Modify: `docs/plans/README.md`
- Modify: `README.md`
- Modify: `README.ko.md`

- [ ] **Step 1: Add implemented doc**

Create `docs/implemented/repository-inventory-explorer.md` with implemented scope, data flow, safety/limits, and verification commands.

- [ ] **Step 2: Update README status**

Add to implemented feature list:

```text
- Repository Explorer / Inventory view for recorded files, file kinds, snapshot state, and source existence state
```

Keep compression under not implemented/future.

- [ ] **Step 3: Update development log**

Add a `Repository Inventory Explorer Implementation` section with:

```text
- Added metadata-only repository inventory service.
- Added Explorer UI for repository contents, file kinds, snapshot presence state, and source existence state.
- Compression remains future work and is not part of this slice.
```

- [ ] **Step 4: Archive plan after implementation**

Move:

```text
docs/plans/phase-5-repository-inventory-explorer.md
```

to:

```text
docs/archive/plans/phase-5-repository-inventory-explorer.md
```

Update `docs/plans/README.md` so active plans return to `None`.

- [ ] **Step 5: Final verification**

Run:

```bash
cd src-tauri && cargo test
npm test
npm run build
git diff --check
```

Expected:

- Rust tests pass.
- UI tests pass.
- TypeScript/Vite build passes.
- No whitespace errors.

## Recommended Branch and Commits

Recommended branch:

```text
feature/repository-inventory-explorer
```

Recommended commit units:

1. `docs: plan repository inventory explorer`
2. `feat: add repository inventory service`
3. `feat: expose repository inventory command`
4. `feat: add repository explorer UI`
5. `test: add repository inventory coverage`
6. `docs: record repository inventory explorer implementation`

Because `feature/integrity-verification` currently has uncommitted integrity work, finish or commit that branch before starting this feature branch.

## Completion Criteria

- User can open a repository and view recorded files.
- User can see file kinds by extension.
- User can see paths present in latest snapshot and paths deleted from latest snapshot.
- User can see whether the original source file currently exists, is missing, or source root is missing.
- Inventory generation does not read or rewrite physical block payloads.
- Compression remains future work.
- `cargo test`, `npm test`, `npm run build`, and `git diff --check` pass.
