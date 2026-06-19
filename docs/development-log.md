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

- Phase 2 should build snapshot metadata on top of `BlockIngestSummary` and `FileIngestResult`.
