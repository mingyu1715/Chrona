# Snapshot Comparison Implementation Record

## Goal

Compare two persisted Chrona snapshots and explain how file content and block references changed between them.

## Implemented Scope

- Added `SnapshotComparison`, `SnapshotComparisonSummary`, `SnapshotFileDiff`, `SnapshotFileDigest`, `SnapshotBlockDiffSummary`, and `SnapshotChangeType` models.
- Added pure `DiffService::compare(&Snapshot, &Snapshot)` with no filesystem writes.
- Added `SnapshotService::compare_snapshots` to load two snapshot JSON files through `SnapshotStore` and delegate to `DiffService`.
- Added the `compare_snapshots` Tauri command and registered it in the app command handler.
- Added TypeScript comparison result types and `chronaApi.compareSnapshots`.
- Added a minimal compare UI with base snapshot selector, target snapshot selector, summary metrics, and file diff rows.
- Updated Phase 3 specs, plan, and development log.

## Comparison Algorithm

Files are matched by normalized `relativePath`. The comparison builds a path map for each snapshot, sorts the union of paths, and classifies each path as:

- `added`: path exists only in the target snapshot.
- `deleted`: path exists only in the base snapshot.
- `unchanged`: both snapshots contain the path, sizes match, and ordered block hash sequences match.
- `modified`: both snapshots contain the path but content identity differs.

`modifiedAt` is preserved in result metadata but does not alone mark a file as modified. Phase 3 comparison is content-oriented.

Block-reference changes are counted as a multiset difference by block hash:

- `sharedBlockReferences`: sum of `min(before_count, after_count)` for each hash.
- `addedBlockReferences`: references present more times in the target snapshot.
- `removedBlockReferences`: references present more times in the base snapshot.

This handles duplicate block references correctly.

## Validation Coverage

- Added/deleted/modified/unchanged file classification.
- Stable relative-path sorted output.
- Duplicate block references counted as multisets.
- Persisted snapshot comparison through `SnapshotService`.
- Existing Phase 1 and Phase 2 Rust tests still pass.
- UI test covers selecting default snapshots, invoking comparison, rendering summary counts, and rendering file diff rows.

## Known Limits

- Rename detection is not implemented.
- Restore is not implemented.
- Byte-level diff inside a changed block is not implemented.
- Advanced block map visualization is not implemented.
- Comparison is based on snapshot metadata and does not re-hash physical block files.
