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

- Implement `docs/plans/phase-2-snapshot-engine.md`.
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

### Next Work

- Plan Phase 3 around snapshot comparison and visualizing changed/reused blocks.
