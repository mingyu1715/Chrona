# Phase 4: Snapshot Restore

## Goal

Materialize a persisted snapshot into a user-selected target directory by reading the snapshot file list and restoring physical block bytes in recorded order.

This phase completes the first end-to-end backup loop: create repository, ingest/source snapshot, compare snapshots, and restore a selected snapshot to another folder.

## Implementation Checklist

- [x] Add restore result models.
- [x] Add restore-specific errors for unsafe target and missing blocks.
- [x] Add block read API using the existing block path convention.
- [x] Add restore target/source containment safety checks.
- [x] Validate snapshot metadata relative paths before writing files.
- [x] Restore files with `.tmp-{operationId}` then rename.
- [x] Reject non-empty restore target directories.
- [x] Add `restore_snapshot` Tauri command.
- [x] Add TypeScript restore API wrapper and types.
- [x] Add minimal restore UI in snapshot detail.
- [x] Add Rust integration tests for restore success, unsafe target, non-empty target, and missing block.
- [x] Add UI test for restore command invocation and result rendering.

## Test Checklist

- [x] Restore nested files and zero-byte files from a snapshot.
- [x] Reject restore target inside repository.
- [x] Reject non-empty target directories.
- [x] Fail clearly when a referenced block is missing.
- [x] UI invokes `restoreSnapshot(repositoryPath, snapshotId, targetPath)`.
- [x] Full `cargo test`.
- [x] Full `npm test`.
- [x] `npm run build`.

## MVP Limits

- Restore target must be missing or empty.
- Restore does not overwrite existing files.
- Restore does not preserve original modified time yet.
- Restore does not emit progress events yet.
- Restore does not verify SHA-256 integrity of every block yet.
- Restore cancelation remains future work.

## Next Work After Phase 4

- Add Home/adaptive quick access from `docs/plans/phase-4-home-adaptive-navigation.md` or renumber it as the next UX phase.
- Add restore progress events if large target restores become a UX issue.
- Add integrity verification before restore in a later stability phase.
