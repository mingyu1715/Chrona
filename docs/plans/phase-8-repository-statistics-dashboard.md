# Repository Statistics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight latest-snapshot overview to Home and an on-demand Statistics chapter that separates logical history, dedup savings, compression savings, referenced storage, and unreferenced physical blocks.

**Architecture:** `StatisticsService` exposes a latest-snapshot fast path and a full repository analysis path. The detailed path traverses snapshot metadata, enumerates final `.blk` files, reuses `BlockStore::inspect_block` for referenced metadata, and reports partial issues while an async Tauri command emits progress. React keeps Home compact and renders the full report in a separate Statistics chapter.

**Tech Stack:** Rust, serde, existing SHA-256 block layout, Tauri 2 async runtime/events, React, TypeScript, Vitest, Testing Library, Cargo integration tests.

---

## Scope

Included:

- latest-snapshot Home overview and file kinds
- retained logical bytes, unique referenced raw bytes, dedup savings
- all/referenced/unreferenced physical `.blk` counts and bytes
- compression savings and raw/Zstd/LZ4 distribution for valid referenced blocks
- missing, unreadable, invalid-header, invalid-filename, and conflicting-size issues
- oldest-first snapshot trend and detailed scan progress
- responsive Statistics chapter without a chart dependency

Excluded:

- persisted cache/index, block deletion/repair, payload preview, automatic scan, global UI redesign

## Files

Create:

- `src-tauri/src/models/statistics.rs`
- `src-tauri/src/core/statistics_service.rs`
- `src-tauri/src/commands/statistics_commands.rs`
- `src-tauri/tests/phase8_statistics.rs`
- `src/features/statistics/RepositoryOverview.tsx`
- `src/features/statistics/RepositoryOverview.test.tsx`
- `src/features/statistics/StatisticsDashboard.tsx`
- `src/features/statistics/StatisticsDashboard.test.tsx`
- `docs/implemented/repository-statistics-dashboard.md`

Modify:

- `src-tauri/src/{models,core,commands}/mod.rs`
- `src-tauri/src/main.rs`
- `src/shared/types/chrona.ts`
- `src/shared/api/chronaApi.ts`
- `src/features/repository/RepositoryPage.tsx`
- `src/features/repository/RepositoryPage.css`
- `src/features/repository/RepositoryPage.test.tsx`
- README and current status/development documents

## Task 1: Models and Home Overview

**Files:** models, service, module exports, `phase8_statistics.rs`.

- [x] **Step 1: Write failing overview tests**

```rust
#[test]
fn statistics_overview_is_empty_without_snapshots() {
    let temp = TempDir::new().unwrap();
    let repo = temp.path().join("repo");
    RepositoryManager::create(&repo).unwrap();
    let report = StatisticsService::new().get_overview(&repo).unwrap();
    assert!(!report.has_snapshot);
    assert_eq!(report.latest_file_count, 0);
    assert_eq!(report.latest_logical_bytes, 0);
    assert!(report.file_kind_stats.is_empty());
}

#[test]
fn statistics_overview_uses_only_the_latest_snapshot() {
    let fixture = statistics_fixture();
    let report = StatisticsService::new().get_overview(&fixture.repository_path).unwrap();
    assert_eq!(report.latest_snapshot_id.as_deref(), Some("snapshot-2"));
    assert_eq!(report.latest_file_count, 3);
    assert_eq!(report.latest_logical_bytes, 18);
    assert_eq!(report.latest_unique_block_count, 2);
}
```

- [x] **Step 2: Verify RED**

```bash
cd src-tauri
cargo test --test phase8_statistics statistics_overview
```

Expected: compile failure because statistics models and service do not exist.

- [x] **Step 3: Add serialized models**

Define camelCase `RepositoryStatisticsOverview` with repository/generated fields, optional latest snapshot identity, latest file/byte/unique-block counts, and `Vec<FileKindStat>`.

Also define the exact detailed contracts from spec: `RepositoryStatisticsReport`, `RepositoryStorageSummary`, `SnapshotStatisticsPoint`, `EncodingStatistics`, `StatisticsIssue`, `StatisticsIssueKind`, and `RepositoryStatisticsProgress`. Enums use camelCase serde names; the report uses `PartialEq` rather than `Eq` because efficiency is `Option<f64>`.

- [x] **Step 4: Implement latest-snapshot fast path**

```rust
pub fn get_overview(&self, repository_path: &Path) -> ChronaResult<RepositoryStatisticsOverview> {
    RepositoryManager::open(repository_path)?;
    let store = SnapshotStore::new(repository_path.to_path_buf());
    let Some(item) = store.list_snapshots()?.into_iter().next() else {
        return Ok(empty_overview(repository_path));
    };
    let snapshot = store.get_snapshot(&item.id)?;
    Ok(overview_from_snapshot(repository_path, &snapshot))
}
```

Sum latest file sizes, collect unique hashes in `BTreeSet`, and aggregate file kinds with `inventory_service::classify_file_kind` into stable `FileKindStat` ordering.

- [x] **Step 5: Verify GREEN and regression**

```bash
cd src-tauri
cargo test --test phase8_statistics statistics_overview
cargo test --test phase5_inventory
```

- [x] **Step 6: Commit**

```bash
git add src-tauri/src/models/statistics.rs src-tauri/src/models/mod.rs src-tauri/src/core/statistics_service.rs src-tauri/src/core/mod.rs src-tauri/tests/phase8_statistics.rs
git commit -m "feat: add repository statistics overview"
```

## Task 2: Full Repository Analysis

**Files:** statistics models/service/tests.

- [ ] **Step 1: Write failing logical and trend tests**

Persist two snapshots sharing one hash and adding another. Assert exact totals:

```rust
let report = StatisticsService::new().analyze_repository(&repo, |_| {}).unwrap();
assert_eq!(report.storage.snapshot_count, 2);
assert_eq!(report.storage.retained_logical_bytes, 30);
assert_eq!(report.storage.total_block_references, 4);
assert_eq!(report.storage.referenced_unique_block_count, 2);
assert_eq!(report.storage.referenced_unique_raw_bytes, 12);
assert_eq!(report.storage.dedup_saved_bytes, 18);
assert_eq!(report.snapshot_trend[0].snapshot_id, "snapshot-1");
assert_eq!(report.snapshot_trend[1].snapshot_id, "snapshot-2");
```

Add a conflicting hash-size case and require a `ConflictingRawSize` issue without failing the report.

- [ ] **Step 2: Write failing physical storage tests**

Store raw, Zstd, and LZ4 referenced blocks; add an unreferenced valid `.blk`, invalid-name `.blk`, `.tmp-*`, and missing reference. Assert all/referenced/unreferenced/missing counts, encoding counts, compression savings, issues, and `storage_efficiency_percent == None` with a missing block. `.tmp-*` must not affect totals.

- [ ] **Step 3: Verify RED**

```bash
cd src-tauri
cargo test --test phase8_statistics full_statistics
```

- [ ] **Step 4: Aggregate snapshots and emit progress**

Implement:

```rust
pub fn analyze_repository<F>(&self, repository_path: &Path, mut emit: F) -> ChronaResult<RepositoryStatisticsReport>
where
    F: FnMut(RepositoryStatisticsProgress),
```

Iterate `list_snapshots()?.iter().rev()` for oldest-first trend. Keep first raw size in `BTreeMap<String, u64>`; append `ConflictingRawSize` when the same hash has another size. Emit `snapshots` after each snapshot.

- [ ] **Step 5: Enumerate final physical blocks**

Use a std-only recursive helper that returns sorted files whose extension is exactly `blk`. Add every final file's metadata length to all-physical totals. A 64-hex stem identifies a block; invalid names are unreferenced plus `InvalidBlockFileName`. Ignore `.tmp-*`.

- [ ] **Step 6: Inspect referenced blocks and calculate metrics**

Call `BlockStore::inspect_block(hash, raw_size)` once per referenced hash. Available valid blocks contribute comparison bytes and encoding distribution; missing/unreadable/invalid blocks become issues.

```rust
dedup_saved_bytes = retained_logical_bytes.saturating_sub(referenced_unique_raw_bytes);
compression_saved_bytes = compression_compared_raw_bytes.saturating_sub(compression_compared_physical_bytes);
storage_efficiency_percent = (missing_referenced_block_count == 0 && retained_logical_bytes > 0)
    .then(|| retained_logical_bytes.saturating_sub(all_physical_bytes) as f64 / retained_logical_bytes as f64 * 100.0);
```

Emit `blocks` while inspecting and exactly one `completed` event before return.

- [ ] **Step 7: Verify and commit**

```bash
cd src-tauri
cargo test --test phase8_statistics
cargo test --test phase6_compression
cargo test --test phase7_file_inspector
cd ..
git add src-tauri/src/core/statistics_service.rs src-tauri/src/models/statistics.rs src-tauri/tests/phase8_statistics.rs
git commit -m "feat: analyze repository storage statistics"
```

## Task 3: Tauri and TypeScript Boundary

**Files:** command module, module exports, main, Rust test, shared types/API, existing API mocks.

- [ ] **Step 1: Write failing camelCase command test**

```rust
let overview = get_repository_statistics_overview(repo.display().to_string()).unwrap();
let json = serde_json::to_value(overview).unwrap();
assert!(json.get("latestFileCount").is_some());
assert!(json.get("latestUniqueBlockCount").is_some());
assert!(json.get("fileKindStats").is_some());
```

- [ ] **Step 2: Add sync overview and async analysis commands**

```rust
pub fn get_repository_statistics_overview(repository_path: String) -> Result<RepositoryStatisticsOverview, String>;
pub async fn analyze_repository_statistics(app: tauri::AppHandle, repository_path: String) -> Result<RepositoryStatisticsReport, String>;
```

Run detailed analysis inside `tauri::async_runtime::spawn_blocking`. Emit `repository-statistics-progress` with `Emitter`; convert service and join errors to strings. Add matching `main.rs` wrappers and handler registrations.

- [ ] **Step 3: Add exact TS contracts and API**

Mirror every Rust camelCase field. Extend `ChronaApi` with:

```ts
getRepositoryStatisticsOverview(repositoryPath: string): Promise<RepositoryStatisticsOverview>;
analyzeRepositoryStatistics(repositoryPath: string): Promise<RepositoryStatisticsReport>;
onRepositoryStatisticsProgress(handler: (event: RepositoryStatisticsProgress) => void): Promise<() => void>;
```

Invoke `get_repository_statistics_overview` and `analyze_repository_statistics`; listen to `repository-statistics-progress`. Update every test double satisfying `ChronaApi`.

- [ ] **Step 4: Verify and commit**

```bash
cd src-tauri
cargo test --test phase8_statistics command
cd ..
npm run build
git add src-tauri/src/commands src-tauri/src/main.rs src-tauri/tests/phase8_statistics.rs src/shared src/features
git commit -m "feat: expose repository statistics API"
```

## Task 4: Compact Home Overview

**Files:** `RepositoryOverview` component/test and RepositoryPage TSX/CSS/test.

- [ ] **Step 1: Write failing component tests**

Test latest files, formatted bytes, unique blocks, file kind labels, no-snapshot state, loading, error, and `Detailed analysis` callback. The error test must keep existing Continue Working content visible in RepositoryPage.

```tsx
await userEvent.click(screen.getByRole('button', { name: /detailed analysis/i }));
expect(onOpenDetails).toHaveBeenCalledOnce();
```

- [ ] **Step 2: Implement compact overview**

Render stable cells for Files, Data size, Unique blocks; one compact file-kind band; and an icon/text detailed-analysis button. Do not show physical storage or savings on Home.

- [ ] **Step 3: Connect state and refresh behavior**

RepositoryPage owns overview/loading/error independently from access history. Refresh after repository create/open and Home refresh; reset on repository change. `onOpenDetails` sets chapter to `statistics`.

- [ ] **Step 4: Style, verify, and commit**

Use three columns on desktop and one at the existing narrow breakpoint. Run:

```bash
npm test -- --run src/features/statistics/RepositoryOverview.test.tsx src/features/repository/RepositoryPage.test.tsx
git add src/features/statistics/RepositoryOverview.tsx src/features/statistics/RepositoryOverview.test.tsx src/features/repository/RepositoryPage.tsx src/features/repository/RepositoryPage.css src/features/repository/RepositoryPage.test.tsx
git commit -m "feat: show repository overview on home"
```

## Task 5: Detailed Statistics Chapter

**Files:** `StatisticsDashboard` component/test and RepositoryPage TSX/CSS/test.

- [ ] **Step 1: Write failing dashboard tests**

Cover not-run, progress, error, separated Dedup/Compression values, all/referenced/unreferenced/missing blocks, oldest-first trend, labeled raw/Zstd/LZ4 distribution, and issue list.

```tsx
expect(screen.getByText('Dedup saved')).toBeInTheDocument();
expect(screen.getByText('Compression saved')).toBeInTheDocument();
expect(screen.getByText('Unreferenced blocks')).toBeInTheDocument();
expect(screen.getByRole('list', { name: /snapshot trend/i })).toBeInTheDocument();
```

- [ ] **Step 2: Implement `StatisticsDashboard`**

Props are repository-open, report, progress, loading, error, and `onAnalyze`. Render metric grid, savings bars, physical status, semantic snapshot trend list, encoding distribution, and issues. Use CSS only; all colors have text labels.

- [ ] **Step 3: Add Statistics chapter and progress listener**

Add `'statistics'` to `ChapterId`, a Lucide chart icon sidebar item, and a DropPanel. Opening does not auto-scan. Subscribe/unsubscribe with the existing effect pattern. During refresh keep the previous report visible and show progress.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- --run
npm run build
git add src/features/statistics/StatisticsDashboard.tsx src/features/statistics/StatisticsDashboard.test.tsx src/features/repository/RepositoryPage.tsx src/features/repository/RepositoryPage.css src/features/repository/RepositoryPage.test.tsx
git commit -m "feat: add repository statistics dashboard"
```

## Task 6: Documentation and Final Verification

**Files:** implementation record, README files, development log, phase status, project plan, plan/archive indexes; archive spec and this plan.

- [ ] **Step 1: Record implementation and limits**

Document exact formulas, Home fast path, detailed live scan, partial issues, async progress, and that unreferenced blocks are reported but never deleted.

- [ ] **Step 2: Update status and archive**

Mark Phase 8 implemented, add `docs/implemented/repository-statistics-dashboard.md`, move spec/plan to archive, update indexes, and verify links with:

```bash
rg -n "0010-repository-statistics|phase-8-repository-statistics" README.md README.ko.md docs
```

- [ ] **Step 3: Run fresh final verification**

```bash
cd src-tauri
cargo fmt --all -- --check
cargo test
cd ..
npm test -- --run
npm run build
git diff --check HEAD
git status --short --branch
```

Record exact test counts in Korean development log.

- [ ] **Step 4: Commit documentation**

```bash
git add README.md README.ko.md docs
git commit -m "docs: record repository statistics implementation"
```

## Commit Sequence

1. `docs: define repository statistics dashboard` (`ddc39a9`)
2. `docs: add repository statistics implementation plan`
3. `feat: add repository statistics overview`
4. `feat: analyze repository storage statistics`
5. `feat: expose repository statistics API`
6. `feat: show repository overview on home`
7. `feat: add repository statistics dashboard`
8. `docs: record repository statistics implementation`

## Completion Criteria

- Home reads only the latest snapshot and shows files, logical bytes, unique blocks, and file kinds.
- Detailed analysis scans all snapshots and final physical `.blk` files on demand.
- All, referenced, unreferenced, and missing block values are distinct.
- Dedup and compression savings use the approved formulas and remain separate.
- Missing/invalid blocks produce partial issues instead of discarding the report.
- Detailed scan runs off the UI event loop and emits progress.
- Statistics UI uses semantic text plus restrained CSS visualization.
- Existing snapshot, restore, integrity, inventory, compression, and file-inspector behavior remains green.
- Documentation and archive indexes match implementation status.
