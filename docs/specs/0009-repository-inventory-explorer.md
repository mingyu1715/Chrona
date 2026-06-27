# 0009. Repository Inventory Explorer

## Status

Next Phase 5 slice plan. Not implemented yet.

## Goal

Show what a Chrona repository contains in human-readable form: recorded source files, file kinds, snapshot presence/deletion state, stored size statistics, and whether the original source files still exist on disk.

## Why This Comes Before Compression

Compression changes the physical block payload format and therefore affects restore, integrity verification, and future block metadata. Repository Inventory Explorer only reads existing snapshot metadata and performs optional source-path existence checks, so it improves user visibility without changing storage format.

Compression remains a future storage optimization in `docs/specs/0005-block-compression.md`.

## Scope

Included:

- open repository validation
- snapshot index traversal
- snapshot JSON loading
- aggregate all known relative file paths across snapshots
- classify file kind from metadata path/extension
- summarize file counts, original bytes, block reference counts, and unique block hashes
- show latest snapshot presence state
- show whether a path existed before but is absent from latest snapshot
- best-effort original source file existence check
- user-facing Repository Explorer / Inventory UI

Excluded:

- block compression
- block decompression
- block garbage collection
- snapshot delete
- automatic filesystem watching
- automatic repair of missing original files
- full MIME sniffing by reading file contents
- SQLite migration

## Key Semantics

Repository Inventory must distinguish three different ideas.

### Repository-recorded file

A file path recorded in at least one snapshot. This file is known to Chrona even if it no longer exists in the original source folder.

### Snapshot state

State derived only from Chrona snapshot metadata.

```text
presentInLatest | deletedInLatest
```

- `presentInLatest`: the relative path exists in the newest snapshot.
- `deletedInLatest`: the relative path existed in an older snapshot but does not exist in the newest snapshot.

### Source existence state

State derived by checking the current filesystem path under the snapshot source root.

```text
exists | missing | sourceRootMissing | unchecked
```

- `exists`: latest known source root exists and the file exists at `sourceRoot/relativePath`.
- `missing`: latest known source root exists but the file path is missing.
- `sourceRootMissing`: the source root itself is unavailable.
- `unchecked`: existence check was disabled or impossible because metadata is insufficient.

These states should be rendered separately so users can tell the difference between "deleted in a later snapshot" and "missing from the current original folder".

## File Kind Classification

MVP classification is extension-based and metadata-only.

```text
document | image | video | audio | archive | code | text | data | binary | folderless | unknown
```

Suggested extension groups:

- document: `pdf`, `doc`, `docx`, `ppt`, `pptx`, `xls`, `xlsx`, `md`, `rtf`
- image: `jpg`, `jpeg`, `png`, `gif`, `webp`, `heic`, `svg`
- video: `mp4`, `mov`, `mkv`, `avi`, `webm`
- audio: `mp3`, `wav`, `flac`, `aac`, `m4a`, `ogg`
- archive: `zip`, `tar`, `gz`, `bz2`, `xz`, `7z`, `rar`
- code: `rs`, `ts`, `tsx`, `js`, `jsx`, `py`, `java`, `c`, `cpp`, `h`, `go`, `swift`, `kt`, `html`, `css`, `json`, `toml`, `yaml`, `yml`
- text: `txt`, `log`, `csv`
- data: `sqlite`, `db`, `parquet`, `xml`

Unknown extensions should not fail inventory generation.

## Data Flow

```text
repository path
  -> RepositoryManager::open
  -> SnapshotStore::list_snapshots
  -> SnapshotStore::get_snapshot for each index item
  -> sort snapshots newest-first using index order
  -> aggregate by normalized relative path
  -> classify file kind from extension
  -> calculate counts and byte totals
  -> optionally check source_root + relative_path on disk
  -> RepositoryInventoryReport
```

## Report Model

```rust
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

pub struct FileKindStat {
    pub kind: FileKind,
    pub file_count: u64,
    pub total_bytes_latest: u64,
}

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
```

## UI

MVP UI should expose a new `Explorer` or `Inventory` workspace section.

Minimum view:

- summary cards: snapshots, known files, latest files, deleted in latest, source missing
- file kind breakdown
- searchable file table
- filters for kind, snapshot state, and source state
- columns: relative path, kind, latest size, snapshot state, source state, last seen snapshot

The UI should not show raw block paths by default. Block detail can remain in later visualization work.

## Testing

Rust tests:

- inventory for a repository with one snapshot returns all files.
- file kinds are classified from extension.
- a path present in older snapshot but absent from latest is `deletedInLatest`.
- source existence check returns `exists` and `missing` correctly.
- missing source root returns `sourceRootMissing` without failing the whole report.
- empty repository with no snapshots returns an empty healthy report.

UI tests:

- Repository page opens Explorer section and invokes `getRepositoryInventory`.
- summary cards render known/latest/deleted/source-missing counts.
- file table renders kind and state labels.
- filters narrow visible rows.

## Completion Criteria

- App can show repository contents without reading physical block bytes.
- User can see what original files were recorded.
- User can see file kinds and basic counts.
- User can see whether paths are present in the latest snapshot or deleted from latest.
- User can see whether the original source files currently exist on disk when the source root is available.
- `cargo test`, `npm test`, and `npm run build` pass.
- Implemented docs and development log are updated.
