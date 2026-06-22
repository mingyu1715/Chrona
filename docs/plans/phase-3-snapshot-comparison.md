# Phase 3 Snapshot Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compare two saved Chrona snapshots and show file-level and block-reference-level differences.

**Architecture:** Add a pure Rust `DiffService` that compares two `Snapshot` values without filesystem writes, then expose it through `SnapshotService` and a Tauri command that loads snapshots from `SnapshotStore`. React adds a minimal comparison panel using existing snapshot list data and renders returned summary/file diffs.

**Tech Stack:** Rust, serde, Tauri 2 commands, React, TypeScript, Vitest, Cargo integration tests, JSON snapshot metadata.

---

## File Structure

Create:

- `src-tauri/src/models/diff.rs`: comparison result structs and change type enum.
- `src-tauri/src/core/diff_service.rs`: pure snapshot comparison algorithm.
- `src-tauri/tests/phase3_diff.rs`: Rust tests for file classification, block multiset counts, and command-level snapshot loading.
- `src/features/snapshots/SnapshotComparePanel.tsx`: minimal compare controls and result view.
- `src/features/snapshots/SnapshotComparePanel.test.tsx`: UI behavior tests.
- `docs/implemented/snapshot-comparison.md`: implementation record after Phase 3 is complete.

Modify:

- `src-tauri/src/models/mod.rs`: export `diff`.
- `src-tauri/src/core/mod.rs`: export `diff_service`.
- `src-tauri/src/core/snapshot_service.rs`: add `compare_snapshots` that loads two snapshots and delegates to `DiffService`.
- `src-tauri/src/commands/snapshot_commands.rs`: expose command wrapper.
- `src-tauri/src/main.rs`: register `compare_snapshots`.
- `src/shared/types/chrona.ts`: add comparison types.
- `src/shared/api/chronaApi.ts`: add `compareSnapshots`.
- `src/features/snapshots/SnapshotPanel.tsx`: render `SnapshotComparePanel` near the snapshot list/detail workflow.
- `docs/development-log.md`: record implementation and verification.

## Task 1: Add Pure Diff Model and Algorithm

- [ ] Write `src-tauri/tests/phase3_diff.rs` with tests for added, deleted, modified, unchanged, and duplicate block-reference multiset counts.
- [ ] Create `src-tauri/src/models/diff.rs` with `SnapshotComparison`, `SnapshotComparisonSummary`, `SnapshotFileDiff`, `SnapshotFileDigest`, `SnapshotBlockDiffSummary`, and `SnapshotChangeType`.
- [ ] Create `src-tauri/src/core/diff_service.rs` with `DiffService::compare(&Snapshot, &Snapshot) -> SnapshotComparison`.
- [ ] Export new modules from `models/mod.rs` and `core/mod.rs`.
- [ ] Run `cd src-tauri && cargo test phase3_diff`.
- [ ] Commit: `feat: add snapshot diff algorithm`.

## Task 2: Add Snapshot Comparison Command

- [ ] Add `SnapshotService::compare_snapshots(repository_path, base_snapshot_id, target_snapshot_id)`.
- [ ] Add `compare_snapshots` command wrapper in `snapshot_commands.rs`.
- [ ] Register `compare_snapshots` in `main.rs`.
- [ ] Extend Rust integration tests to create two real snapshots and compare them through `SnapshotService`.
- [ ] Run `cd src-tauri && cargo test phase3_diff phase2_snapshot`.
- [ ] Commit: `feat: expose snapshot comparison command`.

## Task 3: Add TypeScript API Types

- [ ] Add comparison interfaces to `src/shared/types/chrona.ts` mirroring Rust camelCase serialization.
- [ ] Add `compareSnapshots(repositoryPath, baseSnapshotId, targetSnapshotId)` to `ChronaApi`.
- [ ] Update UI API mocks in existing tests to include `compareSnapshots`.
- [ ] Run `npm test`.
- [ ] Commit: `feat: add snapshot comparison api types`.

## Task 4: Add Minimal Comparison UI

- [ ] Create `SnapshotComparePanel.tsx` with base/target selectors, compare action, summary metrics, and file diff list.
- [ ] Mount it from `SnapshotPanel.tsx` after snapshots are loaded.
- [ ] Add disabled states when fewer than two snapshots exist or compare is running.
- [ ] Write Vitest coverage for selecting snapshots and rendering returned diff counts.
- [ ] Run `npm test -- Snapshot` and `npm run build`.
- [ ] Commit: `feat: add snapshot comparison UI`.

## Task 5: Finish Phase 3 Documentation

- [ ] Add `docs/implemented/snapshot-comparison.md` with implemented scope, algorithm, validation coverage, and known limits.
- [ ] Update `docs/development-log.md` with Phase 3 completion notes and verification commands.
- [ ] Update README status if the compare UI is functional.
- [ ] Run `cargo test`, `npm test`, and `npm run build`.
- [ ] Commit: `docs: record snapshot comparison implementation`.

## Completion Criteria

- Two snapshots can be compared from Rust tests and the Tauri command surface.
- Added, deleted, modified, and unchanged files are classified deterministically by normalized relative path.
- Block-reference changes use multiset counts so duplicate block references are handled correctly.
- The UI displays comparison summary and file diff rows.
- Restore, rename detection, byte-level block diff, and advanced visualization remain outside Phase 3.
- `cargo test`, `npm test`, and `npm run build` pass.
