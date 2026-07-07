# 0004. Snapshot Comparison

## Status

Implemented in Phase 3.

## Scope

Phase 3 introduces snapshot comparison on top of the Phase 2 snapshot metadata. It compares two persisted snapshot JSON files and reports file-level and block-reference-level changes.

Included in Phase 3:

- `compare_snapshots` core service and Tauri command
- snapshot comparison result models
- added/deleted/modified/unchanged file classification
- block-reference reuse and change counts
- minimal comparison UI
- Rust integration tests and UI tests for the comparison workflow

Excluded from Phase 3:

- restore
- rename detection
- byte-level diff inside a block
- content-defined chunking
- block garbage collection
- integrity verification
- advanced block map visualization

## Command

```rust
compare_snapshots(
  repository_path: String,
  base_snapshot_id: String,
  target_snapshot_id: String,
) -> SnapshotComparison
```

Rules:

- Both snapshot IDs are loaded through `SnapshotStore`, so existing snapshot ID validation applies.
- `base_snapshot_id == target_snapshot_id` is allowed and should produce all files as `unchanged`.
- Missing snapshot IDs return the existing `SnapshotNotFound` error.
- The command does not write repository data.

## Comparison Model

```rust
pub struct SnapshotComparison {
    pub schema_version: u32,
    pub base_snapshot_id: String,
    pub target_snapshot_id: String,
    pub summary: SnapshotComparisonSummary,
    pub files: Vec<SnapshotFileDiff>,
}

pub struct SnapshotComparisonSummary {
    pub added_file_count: u64,
    pub deleted_file_count: u64,
    pub modified_file_count: u64,
    pub unchanged_file_count: u64,
    pub total_before_bytes: u64,
    pub total_after_bytes: u64,
    pub added_bytes: u64,
    pub deleted_bytes: u64,
    pub modified_before_bytes: u64,
    pub modified_after_bytes: u64,
    pub added_block_references: u64,
    pub removed_block_references: u64,
    pub shared_block_references: u64,
}

pub struct SnapshotFileDiff {
    pub relative_path: String,
    pub change_type: SnapshotChangeType,
    pub before: Option<SnapshotFileDigest>,
    pub after: Option<SnapshotFileDigest>,
    pub blocks: SnapshotBlockDiffSummary,
}
```

`SnapshotChangeType` values:

```text
added | deleted | modified | unchanged
```

## File Classification Algorithm

Files are matched by normalized `relativePath`.

```text
before_files = map(base.files by relative_path)
after_files = map(target.files by relative_path)
all_paths = sorted(union(before_files.keys, after_files.keys))

for path in all_paths:
  before = before_files.get(path)
  after = after_files.get(path)

  if before is None:
    change = added
  else if after is None:
    change = deleted
  else if before.size_bytes == after.size_bytes
       and block_hash_sequence(before) == block_hash_sequence(after):
    change = unchanged
  else:
    change = modified
```

`modifiedAt` is preserved in the result but does not by itself classify a file as modified. Chrona's first comparison view is content-oriented: a metadata-only timestamp change with the same block hash sequence is treated as unchanged.

## Block Reference Difference Algorithm

For each matched file, block-reference changes are counted as a multiset difference by hash.

```text
before_counts = count hash occurrences in before.blocks
after_counts = count hash occurrences in after.blocks
all_hashes = union(before_counts.keys, after_counts.keys)

shared = sum(min(before_counts[h], after_counts[h]) for h in all_hashes)
added = sum(max(after_counts[h] - before_counts[h], 0) for h in all_hashes)
removed = sum(max(before_counts[h] - after_counts[h], 0) for h in all_hashes)
```

This preserves duplicate block references. If the same block hash appears three times before and once after, two references are counted as removed.

## Result Ordering

File diffs are sorted by normalized `relativePath` ascending. Stable ordering keeps UI rendering and tests deterministic.

## MVP UI Requirements

The minimal UI should allow the user to:

- select a base snapshot
- select a target snapshot
- run comparison
- see added/deleted/modified/unchanged counts
- see byte totals before and after
- see added/removed/shared block-reference counts
- inspect a simple file diff list

Phase 3 UI should not implement restore, rename detection, or advanced block map visualization.
