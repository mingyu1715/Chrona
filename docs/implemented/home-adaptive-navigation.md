# Home and Adaptive Navigation Implementation

## Status

Implemented in the Home/adaptive navigation MVP.

## Implemented Scope

- Added access history models for repository, source, folder/file, snapshot, and compare-pair entries.
- Added an in-memory adaptive access index with splay-to-root behavior for recently accessed items.
- Persisted access history in `indexes/access-index.json` using `.tmp` then rename writes.
- Added `HomeService` and Tauri commands for recording access, reading Home summary, pinning, unpinning, and clearing unpinned history.
- Added TypeScript API wrappers and shared Home/access types.
- Added a Home section to the workspace sidebar with Continue Working, pinned items, recent repositories, recent sources, recent snapshots, and recent compare pairs.
- Recorded access events from repository open/create, source block ingest, snapshot create/open, and snapshot comparison.

## Data Flow

```text
user action
  -> record_access_event command
  -> HomeService
  -> AccessStore loads indexes/access-index.json
  -> AccessIndex updates metadata and splays accessed key to root
  -> AccessStore writes .tmp then rename
  -> get_home_summary returns grouped Home data
  -> React Home panel renders Continue/Pinned/Recent lists
```

## Persistence

Access history is repository-local for this MVP:

```text
indexes/access-index.json
```

The file stores schema version, update timestamp, and access nodes. The tree shape is rebuilt in memory from stored access node metadata.

## Safety and Limits

- Source and snapshot canonical ordering remains unchanged; the adaptive index only powers Home/quick access.
- Access history can reveal local paths, so it stays local metadata and can be cleared.
- Automatic filesystem watching and automatic snapshot creation are still future work.
- Cloud sync for access history is out of scope.

## Verification

- `cargo test`: passed, including 6 Home/access integration tests and existing Phase 1-4 tests.
- `npm test`: passed, 3 UI test files and 7 UI tests.
- `npm run build`: passed, TypeScript and Vite production build.
