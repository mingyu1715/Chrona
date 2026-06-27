# Integrity Verification Implementation

## Status

Implemented as the first Phase 5 stabilization slice.

## Implemented Scope

- Added `IntegrityReport`, issue, severity, and status models.
- Added `IntegrityService::verify_repository` as a read-only repository verifier.
- Traversed snapshot index entries and loaded each persisted snapshot.
- Counted snapshot files, block references, and unique physical block hashes.
- Detected missing referenced block files.
- Detected block size mismatches.
- Recomputed raw SHA-256 for stored block files and detected hash mismatches.
- Added `verify_repository` Tauri command.
- Added TypeScript API wrapper and shared integrity report types.
- Added an Integrity workspace section with Verify Repository action, health summary, checked counts, and issue rows.

## Data Flow

```text
repository path
  -> verify_repository command
  -> IntegrityService
  -> RepositoryManager::open
  -> SnapshotStore::list_snapshots
  -> SnapshotStore::get_snapshot
  -> collect unique block references
  -> read physical .blk files
  -> compare size and SHA-256(raw bytes)
  -> IntegrityReport
  -> React Integrity panel
```

## Safety and Limits

- Verification is read-only and does not repair, rewrite, delete, or garbage-collect repository data.
- Duplicate block references are counted in the report but physical block contents are checked once per unique hash.
- Current verification expects raw `.blk` payloads. Future compression must add decoding before hash verification while keeping raw-byte block identity.
- Auto-repair, block garbage collection, scheduled checks, and restore preflight verification remain future work.

## Verification

- `cargo test --test phase5_integrity`: passed, 3 integrity integration tests.
- `cargo test`: passed, existing Phase 1-4/Home tests plus Phase 5 integrity tests.
- `npm test`: passed, 3 UI test files and 8 UI tests.
- `npm run build`: passed, TypeScript and Vite production build.
