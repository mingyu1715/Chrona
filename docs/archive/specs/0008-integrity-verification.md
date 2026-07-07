# 0008. Integrity Verification

## Status

Implemented in the Phase 5 integrity verification slice.

## Goal

Verify that a Chrona repository can still restore its recorded snapshots by checking snapshot block references against physical block files.

## Scope

Included:

- open repository validation
- snapshot index traversal
- snapshot JSON loading
- unique block reference collection
- missing block detection
- raw block SHA-256 mismatch detection
- block size mismatch detection
- user-facing integrity report

Excluded:

- automatic repair
- block garbage collection
- compressed block decoding
- encryption verification
- permission test automation beyond normal read failures

## Data Flow

```text
repository path
  -> RepositoryManager::open
  -> SnapshotStore::list_snapshots
  -> SnapshotStore::get_snapshot for each index item
  -> collect unique block hashes and expected raw sizes
  -> read blocks/{hash[0..2]}/{hash[2..4]}/{hash}.blk
  -> compare file size and SHA-256(raw bytes)
  -> IntegrityReport
```

## Report Model

The report is intentionally summary-first so the UI can show repository health without rendering every block.

```rust
pub struct IntegrityReport {
    pub schema_version: u32,
    pub repository_path: String,
    pub checked_at: String,
    pub status: IntegrityStatus,
    pub snapshot_count: u64,
    pub file_count: u64,
    pub block_reference_count: u64,
    pub unique_block_count: u64,
    pub missing_block_count: u64,
    pub corrupt_block_count: u64,
    pub issues: Vec<IntegrityIssue>,
}
```

Status values:

```text
healthy | warning | failed
```

Issue severity values:

```text
warning | error
```

## Rules

- Empty files are valid and create no block references.
- Duplicate block references are checked once physically but counted in `blockReferenceCount`.
- A missing block is an error.
- A block size mismatch is an error.
- A SHA-256 mismatch is an error.
- If one raw block hash is referenced with multiple expected sizes, the repository is inconsistent and verification fails.
- Verification does not mutate repository contents.

## UI

MVP UI should expose:

- Verify Repository action
- status: healthy, warning, or failed
- snapshot/file/block counts
- missing/corrupt block counts
- issue list with code, message, snapshot id, relative path, and block hash when available

## Completion Criteria

- A healthy repository reports `healthy`.
- Removing a referenced block reports `failed` with `missingBlock`.
- Corrupting a referenced block reports `failed` with `blockHashMismatch`.
- Existing restore behavior remains unchanged.
