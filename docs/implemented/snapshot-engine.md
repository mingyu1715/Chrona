# Snapshot Engine Implementation Record

## Goal

Persist point-in-time snapshot metadata on top of the Phase 1 block engine so Chrona can create, list, and inspect saved source states.

## Implemented Scope

- `FileIngestResult` now includes file modification time as `modifiedAt`/`modified_at`.
- Repository creation/opening ensures `snapshots/` and `indexes/snapshot-index.json` exist.
- Snapshot JSON files are written to `snapshots/{snapshotId}.json`.
- Snapshot index is written to `indexes/snapshot-index.json` and sorted newest first.
- Snapshot metadata writes use `.tmp` files followed by rename.
- Snapshot IDs reject path traversal by allowing only ASCII alphanumeric, `_`, and `-`.
- `SnapshotService` coordinates repository validation, block ingest, snapshot file write, and index update.
- Tauri commands expose `create_snapshot`, `list_snapshots`, and `get_snapshot`.
- Minimal UI creates snapshots, refreshes the snapshot list, and displays snapshot details and files.
- Native picker buttons fill repository/source paths while preserving direct path entry.

## Snapshot JSON Format

Snapshot files use schema version `1` and contain:

- `id`
- `name`
- `createdAt`
- `sourceRoot`
- `summary`
- `files`

Each file entry preserves the normalized relative path, original size, modification time, and block references produced by Phase 1 ingest.

## Snapshot Index Behavior

`indexes/snapshot-index.json` stores compact snapshot list items for fast listing. Adding a snapshot removes any existing item with the same ID, inserts the current item, and sorts by `createdAt` newest first.

## Validation Coverage

- Snapshot creation writes both snapshot file and index.
- Snapshot listing returns newest-first index items.
- Snapshot detail lookup returns stored file metadata and missing IDs return `SnapshotNotFound`.
- Opening an older repository recreates missing snapshot layout files.
- Snapshot store rejects traversal-style IDs such as `../escape`.
- Repeated snapshots of unchanged content reuse existing blocks.
- Existing Phase 1 block engine tests still pass after adding `modifiedAt`.
- Minimal snapshot UI can create and display snapshot details.

## Known Limits

- Snapshot comparison is not implemented.
- Restore is not implemented.
- Snapshot delete and block garbage collection are not implemented.
- Integrity verification UI is not implemented.
