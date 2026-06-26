# 0006. Home and Adaptive Navigation

## Status

Future design. Not implemented in the current application.

This document defines a future Chrona home screen and adaptive access index for recent and repeated work. It records how splay tree behavior may be used without changing the visible filesystem hierarchy.

## Goal

Help users continue work quickly by surfacing recently or repeatedly used repositories, sources, folders, files, snapshots, and comparison pairs.

The intended user-facing outcome is:

- open the last repository quickly
- resume the last source or folder context
- revisit recently inspected files
- reuse recently compared snapshot pairs
- start common actions from one home screen

## Non-Goals

- Do not represent the actual filesystem hierarchy as a splay tree.
- Do not reorder the main source tree based on access frequency.
- Do not replace stable sorting in Source or Snapshot tabs.
- Do not use adaptive ranking for destructive actions.
- Do not sync activity metadata to cloud storage in MVP.
- Do not create snapshots automatically from filesystem watch events in this feature.

## Core Principle

Chrona keeps the source tree stable and path-based. Splay tree behavior is used only for an adaptive access index.

```text
Filesystem/source view
  - stable path hierarchy
  - normal sorting: name, modified time, size, status
  - user keeps spatial orientation

Adaptive access index
  - records recent/repeated access events
  - splays accessed nodes toward the root
  - powers Home, Recents, Continue Working, and Quick Access
```

In Korean terms:

```text
폴더 구조 자체를 splay tree로 만들지 않는다.
폴더/파일 접근 기록만 splay tree 방식으로 관리한다.
```

## Home Screen

The future Home screen should be the first workspace-level view before the user enters a specific repository/source/snapshot workflow.

Minimum sections:

- Continue Working
- Recent Repositories
- Recent Sources
- Recent Folders or Files
- Recent Snapshots
- Recent Compare Pairs
- Quick Actions

Example layout:

```text
Chrona Home

Continue Working
- Repository: ~/ChronaRepo
- Source: ~/Documents/demo
- Last action: Compared Monday -> Tuesday

Quick Access
- ~/Documents/demo
- ~/Documents/demo/images
- Snapshot: Initial import
- Compare: Monday -> Tuesday

Actions
- Open Repository
- Create Repository
- Select Source
- Create Snapshot
```

## Future Watched Sources

Automatic change detection is a later feature, not part of the Home/adaptive navigation MVP. The Home model may eventually display watched-source status, but it should not own the watcher itself.

Future watched-source status can include:

```text
source path
watch enabled/paused
last detected change time
last automatic snapshot time
pending change count
last watcher error
```

That future feature should reuse the existing snapshot creation path after a debounce window, so automatic snapshots produce the same metadata and block reuse summary as manual snapshots. The adaptive access index may record that an automatic snapshot occurred, but it should not decide when filesystem events become snapshots.

## Access Events

Chrona may record activity events such as:

```text
repository_opened
source_selected
folder_expanded
file_inspected
snapshot_created
snapshot_opened
compare_pair_opened
ingest_completed
restore_target_selected
cleanup_candidate_reviewed
```

Each event updates the adaptive index but does not mutate the source tree ordering.

## Access Node Model

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

Recommended key patterns:

```text
repository:{repositoryId}
source:{normalizedAbsolutePath}
folder:{repositoryId}:{normalizedRelativePath}
file:{repositoryId}:{normalizedRelativePath}
snapshot:{snapshotId}
compare:{baseSnapshotId}->{targetSnapshotId}
```

Paths stored in metadata should follow existing Chrona path rules:

- internal relative paths use `/`
- repository/source containment rules still apply
- non-UTF-8 paths remain outside MVP support unless path policy changes

## Splay Tree Role

The splay tree is a memory/data-structure choice for adaptive locality.

On access:

```text
record_access(key)
  if key exists:
    update metadata
    splay node to root
  else:
    insert node
    splay node to root
```

Query examples:

```text
recent_items(limit)
frequent_items(limit)
continue_working()
recent_compare_pairs(limit)
recent_sources(limit)
```

The UI should not expose raw tree shape. It should expose ranked cards/lists.

## Ranking Rules

Pinned items must outrank adaptive ordering.

Recommended priority:

```text
1. pinned items
2. current session recent items
3. splay tree adaptive recent/frequent items
4. normal stable source/snapshot lists
```

A future ranking score can combine:

```text
score = recency_weight + frequency_weight + action_importance + context_match
```

Splay order can provide locality, but it should not be the only ranking signal once metadata exists.

## Persistence

MVP persistence can be JSON:

```text
indexes/access-index.json
```

Candidate shape:

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-06-23T00:00:00Z",
  "items": [
    {
      "key": "source:/Users/example/Documents/demo",
      "kind": "source",
      "label": "demo",
      "path": "/Users/example/Documents/demo",
      "repositoryId": "repo-id",
      "accessCount": 4,
      "lastAccessedAt": "2026-06-23T00:00:00Z",
      "lastAction": "source_selected",
      "pinned": false
    }
  ]
}
```

The in-memory splay tree can be rebuilt from persisted items at startup.

## Commands

Future command candidates:

```rust
record_access_event(repository_path, event) -> AccessNode
list_home_items(repository_path) -> HomeSummary
pin_access_item(repository_path, key) -> AccessNode
unpin_access_item(repository_path, key) -> AccessNode
clear_access_history(repository_path) -> AccessHistorySummary
```

`clear_access_history` should preserve pinned items only if the user explicitly chooses that behavior.

## UI Requirements

Home MVP:

- show repository open/closed state
- show Continue Working card
- show recent repositories/sources/folders/files
- show recent snapshots and compare pairs
- show quick actions for repository/source/snapshot workflows
- allow pin/unpin for access items
- allow clearing access history from settings or a secondary action

Source tab MVP additions:

- keep source tree stable
- show Recent Folders above or beside the tree
- show Continue from Last Source when available
- jump to a recent path without reordering the full tree

Snapshots tab MVP additions:

- keep snapshot list newest-first
- show Recent Snapshots
- show Recent Compare Pairs
- preselect the most recent compare pair when opening compare UI

## Privacy and Safety

Access history can reveal local file paths and work habits. It should be treated as local repository/app metadata.

Rules:

- Do not sync access history by default.
- Do not include access history in exported examples or public fixtures.
- Offer clear history later if the feature persists local path data.
- Do not record full file contents, only metadata needed for navigation.

## Testing Requirements

Rust unit tests:

- access inserts create retrievable nodes
- repeated access updates `accessCount` and `lastAccessedAt`
- splay operation moves accessed node to root
- pinned items rank before unpinned items
- filesystem tree ordering is not affected by access recording

Integration tests:

- persisted `access-index.json` reloads into the adaptive index
- recent source appears in Home summary after `source_selected`
- recent compare pair appears after `compare_pair_opened`
- clearing history removes unpinned items

UI tests:

- Home renders Continue Working from supplied access summary
- Source tab shows Recent Folders without changing main source order
- Snapshot compare panel can preselect a recent pair

## Open Questions

- Should access history be repository-local, app-global, or both?
- Should paths outside an opened repository be stored in app settings instead of repository metadata?
- Should access scoring decay over time?
- Should pinned items be stored separately from adaptive items?
- Should watched sources be repository-local, app-global, or both?
- What debounce/quiescence window should be used before automatic snapshots?

## Completion Criteria

This future feature is complete when:

- Home screen can resume the last meaningful workflow.
- Recent/frequent items are powered by an adaptive access index.
- Main source and snapshot lists remain stable and predictable.
- Access history is persisted locally and can be cleared.
- Tests prove splay access behavior and stable tree ordering are separate.
