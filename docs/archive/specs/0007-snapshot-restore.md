# 0007. Snapshot Restore

## Status

Implemented in Phase 4.

## Scope

This spec defines the first restore implementation on top of existing snapshot metadata and physical block files. It does not change the repository format created by Phase 1 or the snapshot JSON format created by Phase 2.

Included:

- `restore_snapshot` core service and Tauri command
- restore report models
- target path safety checks
- empty/new target directory requirement
- block read by SHA-256 path
- file materialization by ordered block references
- `.tmp` then rename writes for restored files
- minimal restore UI in the snapshot detail panel

Excluded:

- in-place restore
- overwrite/merge conflict handling
- partial file restore
- restore progress events
- integrity re-hashing before restore
- preserving original file modification times
- restore cancelation

## Command

```rust
restore_snapshot(
  repository_path: String,
  snapshot_id: String,
  target_path: String,
) -> RestoreReport
```

Rules:

- The repository is opened through `RepositoryManager::open`.
- The snapshot is loaded through `SnapshotStore`, so snapshot ID validation still applies.
- The target path must be outside the repository.
- The repository must not be inside the target path.
- The target path may be missing or may be an empty directory.
- Existing non-empty target directories are rejected.
- Existing files at final restore output paths are rejected.

## Restore Models

```rust
pub struct RestoreReport {
    pub schema_version: u32,
    pub snapshot_id: String,
    pub target_path: String,
    pub restored_file_count: u64,
    pub restored_bytes: u64,
    pub restored_block_count: u64,
    pub files: Vec<RestoreFileResult>,
}

pub struct RestoreFileResult {
    pub relative_path: String,
    pub size_bytes: u64,
    pub block_count: u64,
}
```

## Data Flow

```text
input
repository path, snapshot id, restore target path

processing
open repository
validate target/repository containment
create target directory if missing
reject non-empty target directory
load snapshot JSON
for each snapshot file:
  validate metadata relative path
  map `relativePath` to an OS path under target
  read each block by SHA-256 path
  append block bytes in snapshot order

storage
write target file as `{filename}.tmp-{operationId}`
fsync file where available
rename tmp file to final output path

result
return `RestoreReport` with restored file, byte, and block-reference counts
```

## Path Safety

Restore target safety is separate from ingest source safety.

The restore command rejects:

- `target == repository`
- `target` inside `repository`
- `repository` inside `target`
- target paths whose existing parent cannot be canonicalized
- existing non-empty target directories
- final output paths that already exist

Snapshot metadata paths are still treated as untrusted input. A snapshot file `relativePath` must:

- be non-empty
- not be absolute
- not contain `..` or `.` path segments
- not contain backslash separators
- not contain a drive prefix
- resolve under the selected restore target

## Block Read Rules

A block hash is mapped with the existing Phase 1 convention:

```text
blocks/{hash[0..2]}/{hash[2..4]}/{hash}.blk
```

If a referenced block file is missing, restore fails with `MissingBlock`. Phase 4 does not re-hash block bytes during restore; full integrity verification remains a later feature.

## File Write Rules

For each output file:

1. Create parent directories.
2. Open a unique temp file with `create_new`.
3. Append block bytes in snapshot order.
4. Check each stored block byte length against the snapshot block reference size.
5. Sync the temp file where available.
6. Rename the temp file to the final path.
7. Best-effort remove the temp file on failure.

Zero-byte files have no block references and are restored by creating an empty temp file and renaming it.

## UI Requirements

The minimal UI lives in the selected snapshot detail panel:

- restore target path input
- `Choose Restore Target` directory picker
- `Restore Snapshot` action
- disabled state while busy
- result metrics for restored files, restored bytes, and block references

The first restore UI does not implement overwrite prompts, conflict resolution, partial selection, or progress events.
