# Development Log

## 2026-06-19

### Completed

- Created the Phase 1 Tauri/Rust/React scaffold.
- Implemented repository creation/opening with `manifest.json`, `blocks/`, `indexes/`, and `logs/`.
- Implemented source/repository containment checks.
- Implemented `/`-normalized metadata relative paths.
- Implemented 1 MiB fixed-size chunking, SHA-256 block identity, block reuse, and `.tmp` then rename writes.
- Implemented block ingest progress payloads and Tauri event emission.
- Added a minimal repository ingest UI with progress and summary display.
- Added Phase 1 specs and implementation record.
- Added `@tauri-apps/cli` so `npm run tauri dev` works from a fresh install.
- Added README, README.ko, CONTRIBUTING, AGENTS, and non-commercial license documentation.
- Cleaned ignored local/generated artifacts from the working tree.
- Added Phase 1 summary and Phase 2 snapshot planning documents.

### Verification

- `cargo test`: passed, 10 Phase 1 integration tests.
- `npm test`: passed, 1 RepositoryPage test.
- `npm run build`: passed, TypeScript and Vite production build.
- `npm run tauri dev`: passed, Vite started and Tauri launched the macOS app process.

### Decisions

- MVP block size is fixed at 1 MiB.
- MVP block identity is SHA-256 hex.
- MVP metadata paths require UTF-8 and `/` separators.
- Snapshot JSON remains Phase 2 work.
- Chrona is currently licensed for non-commercial use under PolyForm Noncommercial License 1.0.0.

### Next Work

- Implement the Phase 2 snapshot engine plan, now archived at `docs/archive/plans/phase-2-snapshot-engine.md`.
- Phase 2 should build snapshot metadata on top of `BlockIngestSummary` and `FileIngestResult`.

## 2026-06-22

### Completed

- Implemented Phase 2 snapshot metadata persistence on top of the Phase 1 block engine.
- Added `snapshots/` repository layout support and `indexes/snapshot-index.json`.
- Added snapshot JSON model, newest-first snapshot index behavior, and `.tmp` then rename writes for snapshot metadata.
- Added `create_snapshot`, `list_snapshots`, and `get_snapshot` Tauri commands.
- Added minimal snapshot UI for create/list/detail workflows.
- Added Phase 2 hardening tests for snapshot ordering, detail lookup, missing snapshots, and opening older repositories.
- Added Tauri native file/folder picker support for repository and source path inputs.
- Reworked the UI into a Docker Desktop-inspired desktop workflow with unnumbered left section navigation, sidebar product/status area, resource overview strip, drop-down work panels, compact path/status strips, sticky progress footer, and embedded snapshot/result panels.
- Updated README status and implementation records for Phase 2.

### Verification

- `cargo test`: passed, 11 Phase 1 tests and 6 Phase 2 snapshot tests.
- `npm test`: passed, 3 UI tests.
- `npm run build`: passed, TypeScript and Vite production build.
- `npm run tauri dev`: passed with Tauri dialog plugin initialized and `dialog:allow-open` permission.

### Decisions

- Snapshot files are JSON metadata only; block data remains owned by the block engine.
- Snapshot IDs allow only ASCII alphanumeric, `_`, and `-` to prevent path traversal.
- Empty snapshot names are normalized to `Untitled Snapshot`.
- Snapshot comparison, restore, delete, garbage collection, and integrity verification remain outside Phase 2.
- Repository/source path selection uses Tauri dialog plugin; direct text entry remains available.
- Product UI direction is warm gray, deep teal, and muted blue with dense desktop utility spacing.

### Next Work

- Plan Phase 3 around snapshot comparison and visualizing changed/reused blocks.

## 2026-06-23

### Started

- Cleaned local Tauri-run repository artifacts from the working tree.
- Added ignore rules for local Chrona repositories accidentally created under `src-tauri/`.
- Scoped Phase 3 to snapshot comparison first; restore is deferred to a later Phase.
- Added `docs/specs/0004-snapshot-comparison.md` and `docs/archive/plans/phase-3-snapshot-comparison.md`.
- Started Phase 3 implementation with pure `DiffService::compare` models and tests.
- Added `compare_snapshots` service and Tauri command registration for persisted snapshots.
- Added TypeScript comparison result types and `chronaApi.compareSnapshots` wrapper.
- Added minimal snapshot comparison UI with base/target selectors, summary metrics, and file diff rows.

### Decisions

- Phase 3 comparison is content-oriented: size and ordered block hash sequence determine modified/unchanged.
- `modifiedAt` remains visible metadata but does not alone mark a file as modified.
- Block-reference changes use multiset counts so duplicate block references are handled correctly.

### Completed

- Completed Phase 3 snapshot comparison across Rust core, Tauri command, TypeScript API, and minimal UI.
- Added `docs/implemented/snapshot-comparison.md`.
- Updated README and README.ko status plus the core algorithm description for snapshot comparison.
- Archived completed Phase 1, Phase 2, and Phase 3 execution plans under `docs/archive/plans/`.

### Verification

- `cargo test`: passed, 11 Phase 1 tests, 6 Phase 2 tests, and 3 Phase 3 diff tests.
- `npm test`: passed, 3 UI test files and 5 UI tests.
- `npm run build`: passed, TypeScript and Vite production build.

### Next Work

- Choose the next Phase between restore and deeper visualization.

### Documentation Update

- Added future block compression design spec in `docs/specs/0005-block-compression.md`.
- Recorded the raw-byte identity rule: SHA-256 must be calculated before compression, and compression may only affect the physical block payload.
- Documented `zstd` level 3 as the preferred future default candidate with raw fallback when compression is not beneficial.

### Planning Update

- Added `docs/specs/0006-home-adaptive-navigation.md` for Home and adaptive quick access.
- Added active Phase 4 plan in `docs/plans/phase-4-home-adaptive-navigation.md`.
- Recorded the design constraint that filesystem/source hierarchy remains a stable path-based view; splay tree behavior is limited to the adaptive access index for recent/repeated work.

### Restore Implementation Update

- Ignored local manual test repositories under `test/` so they do not pollute source control.
- Started Phase 4 restore work on `feature/restore-engine`.
- Added `docs/specs/0007-snapshot-restore.md`, `docs/plans/phase-4-snapshot-restore.md`, and `docs/implemented/snapshot-restore.md`.
- Implemented snapshot restore from stored block files into an empty or new target directory.
- Added restore target containment checks and safe metadata relative path conversion.
- Added `.tmp-{operationId}` then rename writes for restored files.
- Added the `restore_snapshot` Tauri command, TypeScript API, and minimal snapshot detail restore UI.

### Restore Verification

- `cargo test --test phase4_restore`: passed, 4 restore integration tests.
- `npm test -- SnapshotPanel.test.tsx`: passed, 2 SnapshotPanel UI tests.
- `cargo test`: passed, 24 Rust integration tests across Phase 1-4 plus lib/main/doc test targets.
- `npm test`: passed, 3 UI test files and 6 UI tests.
- `npm run build`: passed, TypeScript and Vite production build.
