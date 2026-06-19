# Block Engine Implementation Record

## Goal

Store source files as reusable SHA-256-addressed fixed-size blocks in a Chrona repository.

## Implemented Scope

- Repository layout and manifest
- Source/repository containment guard
- Metadata-safe relative path normalization
- Fixed-size chunking at 1 MiB
- SHA-256 block identity
- Prefix-based block storage path
- `.tmp` write followed by rename
- Duplicate block reuse
- Ingest summary
- Progress event payload and Tauri event bridge
- Minimal repository ingest UI

## Data Flow

```text
source path
  -> path safety check
  -> file scan
  -> normalized relative paths
  -> fixed-size chunks
  -> SHA-256 hashes
  -> block store write or reuse
  -> ingest summary and progress events
```

## Validation Coverage

- Repository layout creation
- Unsupported schema rejection
- Source/repository containment rejection
- Relative path normalization and unsafe path rejection
- Empty, exact-size, and multi-block chunking
- SHA-256 consistency
- Hash prefix block path convention
- Duplicate block reuse
- `.tmp` cleanup after successful rename
- Folder ingest summary
- Progress event sequence
- Minimal UI ingest flow

## Known Limits

- Snapshot metadata is not implemented in Phase 1.
- Ingest cancellation is not implemented.
- Orphan `.tmp` cleanup is best-effort and remains a later stabilization task.
- MVP supports UTF-8 metadata paths only.
- File/folder picker integration is not implemented; the Phase 1 UI accepts paths directly.
