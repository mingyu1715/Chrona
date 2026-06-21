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

Not implemented yet:

- Snapshot comparison
- Restore
- Integrity verification UI
- Native file/folder picker
- Packaged `.app` release

## Tech Stack

- Desktop shell: Tauri 2
- Core engine: Rust
- UI: React + TypeScript + Vite
- Test: Cargo test, Vitest
- Initial metadata format: JSON files
- Block hash: SHA-256
- Block size: 1 MiB fixed chunks

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
