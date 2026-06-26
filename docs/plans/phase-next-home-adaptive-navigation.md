# Next Phase: Home and Adaptive Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Chrona Home screen and adaptive quick-access navigation for recent/repeated repositories, sources, folders, files, snapshots, and compare pairs.

**Architecture:** Keep the visible source tree and snapshot list stable. Add a separate adaptive access index that can use splay tree behavior internally, persist access metadata locally, and expose a Home summary through Rust/Tauri commands. React renders Home cards and quick actions without reordering canonical source/snapshot views.

**Tech Stack:** Rust, serde, Tauri 2 commands, React, TypeScript, Vitest, Cargo tests, JSON metadata.

---

## Scope

Included:

- Home workspace screen
- adaptive access event model
- access index persistence
- splay-tree-backed recent/frequent access behavior
- Continue Working summary
- Recent repositories/sources/folders/files/snapshots/compare pairs
- pin/unpin access items
- clear unpinned access history
- UI tests for Home and stable Source/Snapshot ordering assumptions

Excluded:

- modeling the filesystem tree itself as a splay tree
- changing source tree sort order based on recent access
- changing snapshot list newest-first behavior
- cloud sync of access history
- restore implementation
- block compression implementation
- automatic filesystem watching
- automatic snapshot creation from file changes
- scheduled background backups

## File Structure

Create:

- `src-tauri/src/models/access.rs`: access node, event, summary, kind, and ranking models.
- `src-tauri/src/core/access_index.rs`: in-memory adaptive index with splay operations and ranking helpers.
- `src-tauri/src/core/access_store.rs`: JSON persistence for `indexes/access-index.json`.
- `src-tauri/src/core/home_service.rs`: combines repository state and access index into Home summary.
- `src-tauri/src/commands/home_commands.rs`: Tauri command wrappers.
- `src-tauri/tests/home_access.rs`: Rust tests for index behavior and persistence.
- `src/features/home/HomePage.tsx`: Home screen UI.
- `src/features/home/HomePage.test.tsx`: Home UI tests.
- `src/features/home/homeTypes.ts`: optional UI-local grouping helpers if shared types become too broad.
- `docs/implemented/home-adaptive-navigation.md`: implementation record after completion.

Modify:

- `src-tauri/src/models/mod.rs`: export `access`.
- `src-tauri/src/core/mod.rs`: export access/home modules.
- `src-tauri/src/commands/mod.rs`: export `home_commands`.
- `src-tauri/src/main.rs`: register home/adaptive navigation commands.
- `src/shared/types/chrona.ts`: add access and Home summary types.
- `src/shared/api/chronaApi.ts`: add Home/access API wrappers.
- `src/features/repository/RepositoryPage.tsx`: add Home section in sidebar or split app shell to route Home vs workspace sections.
- `src/features/repository/RepositoryPage.css`: style Home cards and quick access rows.
- `docs/development-log.md`: record implementation and verification.
- `README.md` and `README.ko.md`: update status after implementation.

## Data Model

Initial Rust model target:

```rust
pub struct AccessNode {
    pub key: String,
    pub kind: AccessNodeKind,
    pub label: String,
    pub path: Option<String>,
    pub repository_id: Option<String>,
    pub snapshot_id: Option<String>,
    pub base_snapshot_id: Option<String>,
    pub target_snapshot_id: Option<String>,
    pub access_count: u64,
    pub last_accessed_at: String,
    pub last_action: String,
    pub pinned: bool,
}
```

```rust
pub enum AccessNodeKind {
    Repository,
    Source,
    Folder,
    File,
    Snapshot,
    ComparePair,
}
```

```rust
pub struct HomeSummary {
    pub continue_working: Option<AccessNode>,
    pub pinned: Vec<AccessNode>,
    pub recent_repositories: Vec<AccessNode>,
    pub recent_sources: Vec<AccessNode>,
    pub recent_files: Vec<AccessNode>,
    pub recent_snapshots: Vec<AccessNode>,
    pub recent_compare_pairs: Vec<AccessNode>,
}
```

## Data Flow

```text
User action
  -> record_access_event command
  -> AccessIndex insert/update
  -> splay accessed node
  -> AccessStore writes indexes/access-index.json with .tmp then rename
  -> HomeService builds HomeSummary
  -> UI renders Continue/Recent/Quick Actions
```

The source tree and snapshot list continue to come from their existing stable sources.


## Future Extension: Watched Sources and Automatic Snapshots

The Home/adaptive navigation work should leave a clean path for future automatic backup, but this plan must not implement filesystem watchers or automatic snapshot creation.

Future behavior:

- user explicitly marks a source as watched
- app observes create/modify/delete events for that source
- rapid changes are debounced before snapshot creation
- automatic snapshot creation reuses the existing snapshot service and block ingest path
- Home can show watched source status, last automatic snapshot time, and last detected change
- users can pause watching per source and still run manual snapshots

Candidate future data flow:

```text
filesystem event
  -> watched source registry
  -> debounce/coalesce window
  -> source/repository containment check
  -> create snapshot with generated name
  -> record access event
  -> Home watched-source status card
```

Design constraints for that later phase:

- watch mode is opt-in per source, never enabled implicitly by recent access
- source/repository containment guard still runs before automatic ingest
- automatic snapshots must surface progress and errors instead of silently failing
- the main source tree remains stable; watcher state appears as status metadata only
- missed events should fall back to a full rescan before creating the next snapshot
- implementation should prefer an established cross-platform watcher crate rather than a hand-rolled polling loop


## Task 1: Access Models and Pure Index

- [ ] Add Rust tests for insert, repeated access, root splay behavior, pinned ranking, and stable external ordering assumptions.
- [ ] Create `models/access.rs`.
- [ ] Create `core/access_index.rs` with insert/update/splay/query helpers.
- [ ] Export modules from `models/mod.rs` and `core/mod.rs`.
- [ ] Run `cd src-tauri && cargo test home_access`.
- [ ] Commit: `feat: add adaptive access index`.

## Task 2: Access Persistence

- [ ] Add tests for writing and reloading `indexes/access-index.json`.
- [ ] Create `core/access_store.rs` using `.tmp` then rename writes.
- [ ] Ensure missing index returns an empty access index.
- [ ] Keep repository open validation through `RepositoryManager`.
- [ ] Run `cd src-tauri && cargo test home_access`.
- [ ] Commit: `feat: persist adaptive access index`.

## Task 3: Home Service and Commands

- [ ] Add `HomeService::record_access_event`, `HomeService::get_home_summary`, `pin_access_item`, `unpin_access_item`, and `clear_access_history`.
- [ ] Add Tauri command wrappers in `home_commands.rs`.
- [ ] Register commands in `main.rs`.
- [ ] Add integration tests for source selected, snapshot opened, compare pair opened, and history clear.
- [ ] Run `cd src-tauri && cargo test`.
- [ ] Commit: `feat: expose home adaptive navigation commands`.

## Task 4: TypeScript API and Types

- [ ] Add `AccessNode`, `AccessNodeKind`, `AccessEvent`, and `HomeSummary` types.
- [ ] Add API wrappers in `chronaApi.ts`.
- [ ] Update existing API mocks.
- [ ] Run `npm test`.
- [ ] Commit: `feat: add home access api types`.

## Task 5: Home UI

- [ ] Create `HomePage.tsx` with Continue Working, pinned items, recent sections, and quick actions.
- [ ] Add Home to the workspace sidebar without removing existing Repository/Sources/Snapshots/Review sections.
- [ ] Record access events from existing repository/source/snapshot/compare actions.
- [ ] Add pin/unpin controls for Home items.
- [ ] Add clear history secondary action.
- [ ] Run `npm test` and `npm run build`.
- [ ] Commit: `feat: add adaptive home screen`.

## Task 6: Documentation Finish

- [ ] Add `docs/implemented/home-adaptive-navigation.md`.
- [ ] Update README status and known limitations.
- [ ] Update `docs/development-log.md` with verification results.
- [ ] Move this plan to `docs/archive/plans/` after implementation is complete.
- [ ] Run `cargo test`, `npm test`, and `npm run build`.
- [ ] Commit: `docs: record home adaptive navigation implementation`.

## Testing Checklist

Rust:

- splay access moves accessed item to root
- repeated access increments count
- pinned items rank first
- persisted access index reloads correctly
- clear history removes unpinned items
- source tree order is not derived from access index

UI:

- Home renders Continue Working
- Home renders recent sources and compare pairs
- Pin/unpin updates UI state
- Clear history hides unpinned recent items
- Source/Snapshot tabs still render stable lists

## Completion Criteria

- Home screen exists and is reachable from the app shell.
- Recent/repeated work is driven by an adaptive access index.
- Splay tree behavior is internal only and does not reorder the main filesystem view.
- Users can pin/unpin and clear access history.
- Access history persists locally and reloads across app starts.
- `cargo test`, `npm test`, and `npm run build` pass.
