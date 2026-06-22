# Chrona

Chrona is a desktop application for block-based, point-in-time data management.

The project stores files as reusable data blocks and records file state over time through snapshots. The goal is not to replace commercial backup products, but to implement and visualize core storage-system ideas such as fixed-size block chunking, block identity, block reuse, snapshot metadata, restore flows, and integrity verification.

## Current Status

Chrona has completed Phase 2.

Implemented:

- Tauri + Rust + React project scaffold
- Chrona repository creation and opening
- `manifest.json`, `blocks/`, `indexes/`, and `logs/` repository layout
- 1 MiB fixed-size block chunking
- SHA-256 block identity
- Duplicate block reuse
- Atomic-like block write using `.tmp` then rename
- Source/repository containment safety checks
- `/`-normalized metadata relative paths
- Block ingest progress events
- Minimal repository ingest UI
- Snapshot creation and listing
- Snapshot detail lookup
- Native macOS file/folder picker

Not implemented yet:

- Snapshot comparison
- Restore
- Integrity verification UI
- Packaged `.app` release

## Tech Stack

- Desktop shell: Tauri 2
- Core engine: Rust
- UI: React + TypeScript + Vite
- Test: Cargo test, Vitest
- Initial metadata format: JSON files
- Block hash: SHA-256
- Block size: 1 MiB fixed chunks

## Storage Algorithm

Chrona currently uses a content-addressed fixed-block storage model.

### Block ingest

1. Validate that the source path and repository path are not the same path and neither contains the other.
2. Scan the selected file or folder and convert metadata paths to OS-independent `/`-separated relative paths.
3. Stream each file in fixed `1 MiB` chunks. The final chunk may be smaller.
4. Compute `SHA-256` over the exact chunk bytes.
5. Store each block by hash at `blocks/{hash[0..2]}/{hash[2..4]}/{hash}.blk`.
6. If a block already exists, reuse it instead of writing duplicate bytes.
7. If a block is new, write `{hash}.blk.tmp-{operationId}` first, then rename it to the final `.blk` path.
8. Emit progress events with current file and processed byte counts while ingest runs.

### Snapshot creation

A snapshot is metadata over the block engine, not a second copy of file bytes.

- Snapshot creation runs block ingest for the selected source.
- File entries store normalized relative paths, file sizes, modified times, and ordered block references.
- Snapshot JSON is written to `snapshots/{snapshotId}.json` using `.tmp` then rename.
- `indexes/snapshot-index.json` stores newest-first snapshot summaries for fast listing.
- Snapshot IDs are restricted to ASCII letters, digits, `_`, and `-` to prevent path traversal.

### Current trade-offs

- Fixed-size chunking is simple and deterministic, but does not detect shifted content as efficiently as content-defined chunking.
- Blocks are not compressed or encrypted yet.
- Delete, garbage collection, restore, and integrity verification are future phases.
- MVP path metadata requires UTF-8-compatible paths.

## Development

Install dependencies:

```bash
npm install
```

Run frontend only:

```bash
npm run dev
```

Run desktop app in development mode:

```bash
npm run tauri dev
```

Run tests:

```bash
npm test
cd src-tauri && cargo test
```

Build frontend:

```bash
npm run build
```

## Documentation

- `docs/project-plan.md`: overall project plan
- `docs/specs/`: design decisions and formats
- `docs/plans/`: phase implementation plans
- `docs/implemented/`: completed feature records
- `docs/development-log.md`: chronological development log

## License

Chrona is source-available for non-commercial use under the PolyForm Noncommercial License 1.0.0.

Commercial use is prohibited unless separate written permission is granted by the copyright holder.
See `LICENSE` for details.
