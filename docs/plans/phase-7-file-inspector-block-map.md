# File Inspector and Block Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users select a Repository Explorer file and inspect its content-based snapshot history, ordered block references, and raw/Zstd/LZ4 physical storage metadata.

**Architecture:** `FileInspectorService` reads existing snapshot JSON and computes transitions without changing repository format. `BlockStore` adds header-only physical inspection with a streaming-hash fallback for magic-prefixed raw blocks; the React Explorer loads one complete report and switches versions locally. The current Repository page remains the workspace shell while a focused `FileInspectorPanel` owns detail rendering.

**Tech Stack:** Rust, serde, SHA-256, existing Chrona block envelope, Tauri 2, React, TypeScript, Vitest, Testing Library, Cargo integration tests.

---

## Scope

Included:

- Explorer file selection
- added/modified/unchanged/deleted history
- deleted then re-added history
- ordered block sequence per available version
- physical raw/Zstd/LZ4 encoding and stored size
- per-history block reuse count
- missing, unreadable, and invalid block metadata states
- responsive Explorer master-detail layout
- Rust and UI regression tests

Excluded:

- block payload decode or preview
- file and snapshot mutation
- integrity repair
- source-root-aware identity migration
- graph library or canvas visualization
- global UI redesign

## File Structure

Create:

- `src-tauri/src/models/file_inspector.rs`: serialized report, history, block metadata, and status enums
- `src-tauri/src/core/file_inspector_service.rs`: snapshot traversal and history aggregation
- `src-tauri/src/commands/file_inspector_commands.rs`: Tauri command boundary
- `src-tauri/tests/phase7_file_inspector.rs`: physical metadata, history, and command integration tests
- `src/features/explorer/FileInspectorPanel.tsx`: version selector, block sequence, and history UI
- `src/features/explorer/FileInspectorPanel.test.tsx`: focused component tests
- `docs/implemented/file-inspector-block-map.md`: completion record

Modify:

- `src-tauri/src/core/block_codec.rs`: non-decompressing envelope header parser
- `src-tauri/src/core/block_store.rs`: physical block inspection
- `src-tauri/src/core/hasher.rs`: streaming SHA-256 helper
- `src-tauri/src/core/errors.rs`: unknown repository file error
- `src-tauri/src/{core,models,commands}/mod.rs`: module exports
- `src-tauri/src/main.rs`: command registration
- `src/shared/types/chrona.ts`: report types
- `src/shared/api/chronaApi.ts`: `inspectRepositoryFile`
- `src/features/repository/RepositoryPage.tsx`: selection state and request orchestration
- `src/features/repository/RepositoryPage.css`: master-detail, block strip, history styles
- `src/features/repository/RepositoryPage.test.tsx`: row selection integration test and API fixture
- current status, README, and archive documents

## Task 1: Physical Block Metadata Inspection

**Files:**

- Create: `src-tauri/src/models/file_inspector.rs`
- Create: `src-tauri/tests/phase7_file_inspector.rs`
- Modify: `src-tauri/src/models/mod.rs`
- Modify: `src-tauri/src/core/block_codec.rs`
- Modify: `src-tauri/src/core/block_store.rs`
- Modify: `src-tauri/src/core/hasher.rs`

- [ ] **Step 1: Write failing raw and compressed metadata tests**

Create `phase7_file_inspector.rs` with real `BlockStore` writes:

~~~rust
#[test]
fn block_storage_inspection_reports_raw_zstd_and_lz4() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("repo");
    RepositoryManager::create(&repository_path).unwrap();

    for (mode, byte, expected) in [
        (CompressionMode::Off, b'a', BlockStorageEncoding::Raw),
        (CompressionMode::Standard, b'b', BlockStorageEncoding::Zstd),
        (CompressionMode::Fast, b'c', BlockStorageEncoding::Lz4),
    ] {
        let raw = vec![byte; 1_048_576];
        let hash = sha256_hex(&raw);
        let store = BlockStore::with_compression_mode(repository_path.clone(), mode);
        let write = store.store_block(&hash, &raw, &format!("{byte}")).unwrap();
        let inspected = store.inspect_block(&hash, raw.len() as u64).unwrap();

        assert_eq!(inspected.storage_state, BlockStorageState::Available);
        assert_eq!(inspected.encoding, expected);
        assert_eq!(inspected.stored_size_bytes, Some(write.stored_size_bytes));
        assert_eq!(
            inspected.compression_saved_bytes,
            Some(raw.len() as u64 - write.stored_size_bytes)
        );
    }
}
~~~

Add separate tests:

~~~rust
#[test]
fn block_storage_inspection_keeps_magic_prefixed_raw_as_raw() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("repo");
    RepositoryManager::create(&repository_path).unwrap();
    let raw = b"CHRBLK01 legacy raw bytes".to_vec();
    let hash = sha256_hex(&raw);
    let store = BlockStore::with_compression_mode(
        repository_path,
        CompressionMode::Off,
    );
    store.store_block(&hash, &raw, "magic-raw").unwrap();

    let inspected = store.inspect_block(&hash, raw.len() as u64).unwrap();

    assert_eq!(inspected.storage_state, BlockStorageState::Available);
    assert_eq!(inspected.encoding, BlockStorageEncoding::Raw);
    assert_eq!(inspected.stored_size_bytes, Some(raw.len() as u64));
}

#[test]
fn block_storage_inspection_reports_missing_and_invalid_header() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("repo");
    RepositoryManager::create(&repository_path).unwrap();
    let store = BlockStore::new(repository_path.clone());
    let missing_hash = sha256_hex(b"missing block");
    let missing = store.inspect_block(&missing_hash, 13).unwrap();
    assert_eq!(missing.storage_state, BlockStorageState::Missing);

    let raw = vec![b'z'; 1_048_576];
    let hash = sha256_hex(&raw);
    let compressed = BlockStore::with_compression_mode(
        repository_path.clone(),
        CompressionMode::Standard,
    );
    let write = compressed.store_block(&hash, &raw, "invalid-header").unwrap();
    let block_path = repository_path.join(write.storage_path);
    let mut stored = fs::read(&block_path).unwrap();
    stored[10] = 1;
    fs::write(block_path, stored).unwrap();

    let invalid = compressed.inspect_block(&hash, raw.len() as u64).unwrap();
    assert_eq!(invalid.storage_state, BlockStorageState::InvalidHeader);
    assert_eq!(invalid.encoding, BlockStorageEncoding::Unknown);
    assert!(invalid.issue.is_some());
}
~~~

- [ ] **Step 2: Run Task 1 tests and verify RED**

~~~bash
cd src-tauri
cargo test --test phase7_file_inspector block_storage_inspection
~~~

Expected: compile failure because `file_inspector` models and `BlockStore::inspect_block` do not exist.

- [ ] **Step 3: Add serialized storage models**

In `models/file_inspector.rs` add:

~~~rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BlockStorageEncoding {
    Raw,
    Zstd,
    Lz4,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BlockStorageState {
    Available,
    Missing,
    Unreadable,
    InvalidHeader,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PhysicalBlockInspection {
    pub encoding: BlockStorageEncoding,
    pub storage_state: BlockStorageState,
    pub stored_size_bytes: Option<u64>,
    pub compression_saved_bytes: Option<u64>,
    pub issue: Option<String>,
}
~~~

Export the module from `models/mod.rs`.

- [ ] **Step 4: Add streaming SHA-256 and envelope header inspection**

Add to `core/hasher.rs`:

~~~rust
pub fn sha256_reader_hex<R: Read>(mut reader: R) -> std::io::Result<String> {
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hex::encode(hasher.finalize()))
}
~~~

In `block_codec.rs`, expose the header size and add:

~~~rust
pub const BLOCK_ENVELOPE_HEADER_SIZE: usize = 60;

pub struct BlockEnvelopeMetadata {
    pub encoding: BlockEncoding,
    pub raw_size_bytes: u64,
    pub payload_size_bytes: u64,
}

pub fn inspect_envelope_header(
    header: &[u8],
    physical_size_bytes: u64,
    expected_hash: &str,
    expected_raw_size_bytes: u64,
) -> ChronaResult<Option<BlockEnvelopeMetadata>>
~~~

Return `Ok(None)` when magic is absent. For an envelope, validate version, encoding, reserved bytes, raw size, payload size, physical file size, and raw hash exactly as defined in spec 0011. Do not instantiate a decoder.

- [ ] **Step 5: Implement `BlockStore::inspect_block`**

Add:

~~~rust
pub fn inspect_block(
    &self,
    hash: &str,
    expected_raw_size_bytes: u64,
) -> ChronaResult<PhysicalBlockInspection>
~~~

Implementation rules:

1. Validate the hash path with `block_relative_path`.
2. Missing file returns `BlockStorageState::Missing` and `Unknown` encoding.
3. Read at most 60 header bytes and physical file metadata.
4. If magic is present, stream-hash the physical file first. When the physical hash equals `hash` and physical size equals expected raw size, return Raw. This preserves magic-prefixed raw compatibility.
5. Otherwise parse the compressed header.
6. Header errors return `InvalidHeader` with issue text instead of failing the whole inspection.
7. Open/read errors return `Unreadable` with issue text.
8. Available entries return physical stored bytes and `expected_raw_size_bytes.saturating_sub(physical_size)`.

- [ ] **Step 6: Run Task 1 tests and existing compression tests**

~~~bash
cd src-tauri
cargo test --test phase7_file_inspector block_storage_inspection
cargo test --test phase6_compression
~~~

Expected: all targeted tests pass, including the existing magic-prefixed raw decode test.

- [ ] **Step 7: Commit Task 1**

~~~bash
git add src-tauri/src/models/file_inspector.rs src-tauri/src/models/mod.rs \
  src-tauri/src/core/block_codec.rs src-tauri/src/core/block_store.rs \
  src-tauri/src/core/hasher.rs src-tauri/tests/phase7_file_inspector.rs
git commit -m "feat: inspect physical block metadata"
~~~

## Task 2: Content-Based File History Service

**Files:**

- Modify: `src-tauri/src/models/file_inspector.rs`
- Create: `src-tauri/src/core/file_inspector_service.rs`
- Modify: `src-tauri/src/core/mod.rs`
- Modify: `src-tauri/src/core/errors.rs`
- Modify: `src-tauri/tests/phase7_file_inspector.rs`

- [ ] **Step 1: Add deterministic snapshot fixture helpers**

Use `SnapshotStore` directly so history times and IDs are deterministic:

~~~rust
fn persist_snapshot(
    repository_path: &Path,
    id: &str,
    name: &str,
    created_at: &str,
    files: Vec<SnapshotFile>,
) {
    let snapshot = Snapshot {
        schema_version: 1,
        id: id.to_string(),
        name: name.to_string(),
        created_at: created_at.to_string(),
        source_root: "/tmp/source".to_string(),
        summary: SnapshotSummary {
            file_count: files.len() as u64,
            total_original_bytes: files.iter().map(|file| file.size_bytes).sum(),
            total_block_references: files.iter().map(|file| file.blocks.len() as u64).sum(),
            new_block_count: 0,
            reused_block_count: 0,
            new_stored_bytes: 0,
            new_logical_bytes: 0,
            compression_saved_bytes: 0,
            new_raw_block_count: 0,
            new_zstd_block_count: 0,
            new_lz4_block_count: 0,
        },
        files,
    };
    let store = SnapshotStore::new(repository_path.to_path_buf());
    store.write_snapshot(&snapshot).unwrap();
    store.add_to_index(&snapshot).unwrap();
}

fn snapshot_file(
    relative_path: &str,
    size_bytes: u64,
    blocks: &[(&str, u64)],
) -> SnapshotFile {
    let mut offset = 0_u64;
    let mut references = Vec::with_capacity(blocks.len());
    for (index, (hash, block_size)) in blocks.iter().enumerate() {
        references.push(BlockReference {
            index: index as u64,
            offset,
            size_bytes: *block_size,
            hash: (*hash).to_string(),
            was_new: false,
        });
        offset += block_size;
    }
    SnapshotFile {
        relative_path: relative_path.to_string(),
        size_bytes,
        modified_at: "2026-06-30T00:00:00Z".to_string(),
        blocks: references,
    }
}
~~~

- [ ] **Step 2: Write failing history transition tests**

Create snapshots where `notes.txt` is added, unchanged with a different `modified_at`, modified with a different ordered block list, deleted, and added again. Assert newest-first states:

~~~rust
let report = FileInspectorService::new()
    .inspect_repository_file(&repository_path, "notes.txt")
    .unwrap();

assert_eq!(report.version_count, 4);
assert_eq!(
    report.versions.iter().map(|version| &version.state).collect::<Vec<_>>(),
    vec![
        &FileVersionState::Added,
        &FileVersionState::Deleted,
        &FileVersionState::Modified,
        &FileVersionState::Unchanged,
        &FileVersionState::Added,
    ]
);
~~~

Add tests that ordered references are preserved, duplicate hashes in one version count once, and a hash seen in two present versions gets `seen_in_version_count == 2`.

- [ ] **Step 3: Write failing validation and partial-storage tests**

Add:

~~~rust
#[test]
fn file_inspector_rejects_unsafe_and_unknown_paths() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("repo");
    RepositoryManager::create(&repository_path).unwrap();
    let service = FileInspectorService::new();

    assert!(matches!(
        service.inspect_repository_file(&repository_path, "../outside.txt"),
        Err(ChronaError::UnsafeRelativePath(_))
    ));
    assert!(matches!(
        service.inspect_repository_file(&repository_path, "unknown.txt"),
        Err(ChronaError::RepositoryFileNotFound(path)) if path == "unknown.txt"
    ));
}

#[test]
fn file_inspector_keeps_report_when_a_block_is_missing() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("repo");
    RepositoryManager::create(&repository_path).unwrap();
    let missing_hash = sha256_hex(b"missing");
    persist_snapshot(
        &repository_path,
        "snapshot-1",
        "Missing block",
        "2026-06-30T00:00:00Z",
        vec![snapshot_file("notes.txt", 7, &[(&missing_hash, 7)])],
    );

    let report = FileInspectorService::new()
        .inspect_repository_file(&repository_path, "notes.txt")
        .unwrap();

    assert_eq!(report.versions[0].blocks[0].storage_state, BlockStorageState::Missing);
    assert_eq!(report.versions[0].blocks[0].encoding, BlockStorageEncoding::Unknown);
}
~~~

- [ ] **Step 4: Run history tests and verify RED**

~~~bash
cd src-tauri
cargo test --test phase7_file_inspector file_inspector_
~~~

Expected: compile failure because report models and `FileInspectorService` do not exist.

- [ ] **Step 5: Add report models and error**

Add the exact serde camelCase types from spec 0011:

~~~rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileInspectionReport {
    pub schema_version: u32,
    pub repository_path: String,
    pub relative_path: String,
    pub file_name: String,
    pub version_count: u64,
    pub first_seen_at: String,
    pub last_seen_at: String,
    pub latest_state: FileVersionState,
    pub versions: Vec<FileInspectionVersion>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileInspectionVersion {
    pub snapshot_id: String,
    pub snapshot_name: String,
    pub snapshot_created_at: String,
    pub state: FileVersionState,
    pub size_bytes: Option<u64>,
    pub modified_at: Option<String>,
    pub total_block_references: u64,
    pub unique_block_count: u64,
    pub blocks: Vec<FileBlockInspection>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileBlockInspection {
    pub index: u64,
    pub offset: u64,
    pub size_bytes: u64,
    pub hash: String,
    pub was_new: bool,
    pub encoding: BlockStorageEncoding,
    pub storage_state: BlockStorageState,
    pub stored_size_bytes: Option<u64>,
    pub compression_saved_bytes: Option<u64>,
    pub seen_in_version_count: u64,
    pub issue: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum FileVersionState { Added, Modified, Unchanged, Deleted }
~~~

Add to `ChronaError`:

~~~rust
#[error("RepositoryFileNotFound: {0}")]
RepositoryFileNotFound(String),
~~~

- [ ] **Step 6: Implement history aggregation**

`FileInspectorService::inspect_repository_file` must:

~~~rust
pub fn inspect_repository_file(
    &self,
    repository_path: &Path,
    relative_path: &str,
) -> ChronaResult<FileInspectionReport>
~~~

Algorithm:

1. Open repository and validate `relative_path` with `metadata_relative_path_to_path_buf`.
2. Load index items and iterate oldest-first.
3. Compare `size_bytes` plus ordered `(hash, size_bytes)` tuples; ignore `modified_at` for state.
4. Emit one Deleted transition when a previously present path disappears; skip repeated missing snapshots.
5. Treat a reappearance as Added.
6. Count present versions and each unique hash once per present version.
7. Inspect each unique `(hash, expected_size)` once through `BlockStore::inspect_block`.
8. Join physical metadata into every ordered block reference.
9. Reverse history to newest-first and derive first seen, last seen, and latest state.
10. Return `RepositoryFileNotFound` when no present version exists.

Keep digest comparison in a focused private helper:

~~~rust
fn same_file_content(left: &SnapshotFile, right: &SnapshotFile) -> bool {
    left.size_bytes == right.size_bytes
        && left.blocks.iter().map(|block| (&block.hash, block.size_bytes))
            .eq(right.blocks.iter().map(|block| (&block.hash, block.size_bytes)))
}
~~~

- [ ] **Step 7: Run Task 2 and prior phase tests**

~~~bash
cd src-tauri
cargo test --test phase7_file_inspector file_inspector_
cargo test --test phase3_diff
cargo test --test phase5_inventory
~~~

Expected: all tests pass and content-first comparison remains unchanged.

- [ ] **Step 8: Commit Task 2**

~~~bash
git add src-tauri/src/models/file_inspector.rs src-tauri/src/core/file_inspector_service.rs \
  src-tauri/src/core/mod.rs src-tauri/src/core/errors.rs \
  src-tauri/tests/phase7_file_inspector.rs
git commit -m "feat: add file inspection history service"
~~~

## Task 3: Tauri Command and TypeScript API

**Files:**

- Create: `src-tauri/src/commands/file_inspector_commands.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src/shared/types/chrona.ts`
- Modify: `src/shared/api/chronaApi.ts`
- Modify: `src-tauri/tests/phase7_file_inspector.rs`
- Modify: existing UI API mocks

- [ ] **Step 1: Write a failing command serialization test**

~~~rust
#[test]
fn file_inspector_command_returns_camel_case_report() {
    let report = inspect_repository_file(
        repository_path.display().to_string(),
        "notes.txt".to_string(),
    ).unwrap();
    let json = serde_json::to_value(report).unwrap();

    assert_eq!(json["relativePath"], "notes.txt");
    assert!(json["versions"][0].get("snapshotCreatedAt").is_some());
    assert!(json["versions"][0]["blocks"][0].get("storageState").is_some());
}
~~~

- [ ] **Step 2: Run command test and verify RED**

~~~bash
cd src-tauri
cargo test --test phase7_file_inspector file_inspector_command
~~~

Expected: compile failure because the command module does not exist.

- [ ] **Step 3: Add command and Tauri registration**

Command:

~~~rust
#[tauri::command]
pub fn inspect_repository_file(
    repository_path: String,
    relative_path: String,
) -> Result<FileInspectionReport, String> {
    FileInspectorService::new()
        .inspect_repository_file(&PathBuf::from(repository_path), &relative_path)
        .map_err(|error| error.to_string())
}
~~~

Export from `commands/mod.rs`, add the typed wrapper in `main.rs`, and register it in `tauri::generate_handler!`.

- [ ] **Step 4: Add exact TypeScript report types**

In `chrona.ts` add camelCase equivalents of all spec models:

~~~ts
export type FileVersionState = 'added' | 'modified' | 'unchanged' | 'deleted';
export type BlockStorageEncoding = 'raw' | 'zstd' | 'lz4' | 'unknown';
export type BlockStorageState = 'available' | 'missing' | 'unreadable' | 'invalidHeader';

export interface FileInspectionReport {
  schemaVersion: number;
  repositoryPath: string;
  relativePath: string;
  fileName: string;
  versionCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  latestState: FileVersionState;
  versions: FileInspectionVersion[];
}

export interface FileInspectionVersion {
  snapshotId: string;
  snapshotName: string;
  snapshotCreatedAt: string;
  state: FileVersionState;
  sizeBytes: number | null;
  modifiedAt: string | null;
  totalBlockReferences: number;
  uniqueBlockCount: number;
  blocks: FileBlockInspection[];
}

export interface FileBlockInspection {
  index: number;
  offset: number;
  sizeBytes: number;
  hash: string;
  wasNew: boolean;
  encoding: BlockStorageEncoding;
  storageState: BlockStorageState;
  storedSizeBytes: number | null;
  compressionSavedBytes: number | null;
  seenInVersionCount: number;
  issue: string | null;
}
~~~

- [ ] **Step 5: Add API wrapper and mock method**

~~~ts
inspectRepositoryFile(
  repositoryPath: string,
  relativePath: string,
): Promise<FileInspectionReport>;
~~~

Implementation invokes:

~~~ts
return invoke<FileInspectionReport>('inspect_repository_file', {
  repositoryPath,
  relativePath,
});
~~~

Add a `vi.fn` implementation to RepositoryPage, SnapshotPanel, and SnapshotComparePanel API mocks so structural typing remains complete.

- [ ] **Step 6: Run Rust command test and TypeScript compile**

~~~bash
cd src-tauri
cargo test --test phase7_file_inspector file_inspector_command
cd ..
npm run build
~~~

- [ ] **Step 7: Commit Task 3**

~~~bash
git add src-tauri/src/commands/file_inspector_commands.rs src-tauri/src/commands/mod.rs \
  src-tauri/src/main.rs src-tauri/tests/phase7_file_inspector.rs \
  src/shared/types/chrona.ts src/shared/api/chronaApi.ts \
  src/features/repository/RepositoryPage.test.tsx \
  src/features/snapshots/SnapshotPanel.test.tsx \
  src/features/snapshots/SnapshotComparePanel.test.tsx
git commit -m "feat: expose file inspector API"
~~~

## Task 4: File Inspector Panel

**Files:**

- Create: `src/features/explorer/FileInspectorPanel.tsx`
- Create: `src/features/explorer/FileInspectorPanel.test.tsx`
- Modify: `src/features/repository/RepositoryPage.css`

- [ ] **Step 1: Write failing no-selection and report render tests**

Create a report fixture with Added, Unchanged, and Deleted history plus raw/Zstd blocks. Assert:

~~~tsx
render(
  <FileInspectorPanel
    selectedPath="notes.txt"
    report={report}
    loading={false}
    error={null}
  />,
);

expect(screen.getByRole('heading', { name: 'notes.txt' })).toBeInTheDocument();
expect(screen.getByText('zstd')).toBeInTheDocument();
expect(screen.getByText(/seen in 2 versions/i)).toBeInTheDocument();
expect(screen.getByText('deleted')).toBeInTheDocument();
~~~

Render with `selectedPath={null}` and assert `Select a file to inspect`.

- [ ] **Step 2: Write failing version-switch test**

~~~tsx
const user = userEvent.setup();
render(<FileInspectorPanel selectedPath="notes.txt" report={report} loading={false} error={null} />);

await user.selectOptions(screen.getByLabelText(/snapshot version/i), 'snapshot-old');
expect(screen.getByText(/block 0/i)).toBeInTheDocument();
expect(screen.queryByText(/block 1/i)).not.toBeInTheDocument();
~~~

- [ ] **Step 3: Run panel tests and verify RED**

~~~bash
npm test -- FileInspectorPanel.test.tsx
~~~

Expected: import failure because the component does not exist.

- [ ] **Step 4: Implement `FileInspectorPanel`**

Props:

~~~ts
interface FileInspectorPanelProps {
  selectedPath: string | null;
  report: FileInspectionReport | null;
  loading: boolean;
  error: string | null;
}
~~~

Behavior:

- no path: selection prompt
- loading: selected path plus loading state
- error: selected path plus error text
- report: select newest version containing blocks by default
- reset selected version whenever `report.relativePath` changes
- version menu includes history state and snapshot date
- deleted selection shows `No blocks in this snapshot`
- ordered blocks render in a semantic `<ol>`
- history renders in a semantic `<ol>` newest-first
- state and encoding always render text; color is supplemental

Use existing `formatBytes` behavior locally or move the formatter to a shared utility only if both files need the exact implementation. Do not add a chart dependency.

- [ ] **Step 5: Add stable responsive styles**

Add classes:

~~~text
.file-inspector
.file-inspector-header
.file-inspector-version
.file-block-map
.file-block-item
.file-block-item-{raw|zstd|lz4|unknown}
.file-history
.file-history-state-{added|modified|unchanged|deleted}
~~~

Use `grid-template-columns: repeat(auto-fill, minmax(132px, 1fr))` for the block map. Keep cards at 8px radius or less and ensure long hashes/paths truncate without changing grid dimensions.

- [ ] **Step 6: Run panel tests**

~~~bash
npm test -- FileInspectorPanel.test.tsx
~~~

Expected: all focused component tests pass.

- [ ] **Step 7: Commit Task 4**

~~~bash
git add src/features/explorer/FileInspectorPanel.tsx \
  src/features/explorer/FileInspectorPanel.test.tsx \
  src/features/repository/RepositoryPage.css
git commit -m "feat: add file inspector panel"
~~~

## Task 5: Explorer Selection and Master-Detail Integration

**Files:**

- Modify: `src/features/repository/RepositoryPage.tsx`
- Modify: `src/features/repository/RepositoryPage.css`
- Modify: `src/features/repository/RepositoryPage.test.tsx`

- [ ] **Step 1: Add failing Explorer selection test**

Extend `createApiMock` with this report. Open a repository, open Explorer, load inventory, click `notes.md`, and assert:

~~~ts
inspectRepositoryFile: vi.fn(async () => ({
  schemaVersion: 1,
  repositoryPath: '/picked/chrona-repo',
  relativePath: 'notes.md',
  fileName: 'notes.md',
  versionCount: 1,
  firstSeenAt: '2026-06-30T00:00:00Z',
  lastSeenAt: '2026-06-30T00:00:00Z',
  latestState: 'added' as const,
  versions: [{
    snapshotId: 'latest',
    snapshotName: 'Latest',
    snapshotCreatedAt: '2026-06-30T00:00:00Z',
    state: 'added' as const,
    sizeBytes: 5,
    modifiedAt: '2026-06-30T00:00:00Z',
    totalBlockReferences: 1,
    uniqueBlockCount: 1,
    blocks: [{
      index: 0,
      offset: 0,
      sizeBytes: 5,
      hash: 'a'.repeat(64),
      wasNew: true,
      encoding: 'zstd' as const,
      storageState: 'available' as const,
      storedSizeBytes: 4,
      compressionSavedBytes: 1,
      seenInVersionCount: 1,
      issue: null,
    }],
  }],
})),
~~~

~~~ts
await waitFor(() => {
  expect(api.inspectRepositoryFile).toHaveBeenCalledWith('/picked/chrona-repo', 'notes.md');
});
expect(await screen.findByRole('heading', { name: 'notes.md' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: /inspect notes.md/i })).toHaveAttribute(
  'aria-current',
  'true',
);
~~~

Also assert a rejected API call renders the error without removing the inventory list.

- [ ] **Step 2: Run integration test and verify RED**

~~~bash
npm test -- RepositoryPage.test.tsx -t "inspects a selected inventory file"
~~~

Expected: failure because inventory rows are not selectable and the API is not called.

- [ ] **Step 3: Add request state with stale-response protection**

In `RepositoryPage` add:

~~~ts
const [selectedInventoryPath, setSelectedInventoryPath] = useState<string | null>(null);
const [fileInspection, setFileInspection] = useState<FileInspectionReport | null>(null);
const [fileInspectionLoading, setFileInspectionLoading] = useState(false);
const [fileInspectionError, setFileInspectionError] = useState<string | null>(null);
const fileInspectionRequestId = useRef(0);
~~~

Handler:

~~~ts
async function inspectInventoryFile(relativePath: string) {
  if (!manifest) return;
  const requestId = ++fileInspectionRequestId.current;
  setSelectedInventoryPath(relativePath);
  setFileInspection(null);
  setFileInspectionError(null);
  setFileInspectionLoading(true);
  try {
    const report = await api.inspectRepositoryFile(repositoryPath, relativePath);
    if (requestId === fileInspectionRequestId.current) setFileInspection(report);
  } catch (error) {
    if (requestId === fileInspectionRequestId.current) setFileInspectionError(String(error));
  } finally {
    if (requestId === fileInspectionRequestId.current) setFileInspectionLoading(false);
  }
}
~~~

Increment the request ID and clear inspection state when repository path/open state or inventory report resets.

- [ ] **Step 4: Make inventory paths accessible selection buttons**

Extend `InventoryView` props with selected path and callback. In the path cell render:

~~~tsx
<button
  type="button"
  className="inventory-file-button"
  aria-label={`Inspect ${file.relativePath}`}
  aria-current={selectedPath === file.relativePath ? 'true' : undefined}
  title={file.relativePath}
  onClick={() => onInspect(file.relativePath)}
>
  {file.relativePath}
</button>
~~~

Do not attach click behavior to the `<tr>` itself.

- [ ] **Step 5: Add master-detail layout**

Keep summary and filters full width. Assign the current `inventory-table-wrap` JSX, after applying the Step 4 path button change, to `const inventoryTable`. Wrap that value and `FileInspectorPanel` in:

~~~tsx
<div className="inventory-browser">
  <div className="inventory-list-pane">{inventoryTable}</div>
  <FileInspectorPanel
    key={selectedPath ?? 'no-selection'}
    selectedPath={selectedPath}
    report={inspectionReport}
    loading={inspectionLoading}
    error={inspectionError}
  />
</div>
~~~

Desktop uses `minmax(360px, 0.9fr) minmax(420px, 1.1fr)`. At the existing responsive breakpoint, switch to one column with Inspector below the list. Each pane owns its vertical scroll so the app shell does not gain an incoherent horizontal scrollbar.

- [ ] **Step 6: Run UI regression tests and build**

~~~bash
npm test -- --run
npm run build
~~~

Expected: RepositoryPage, SnapshotPanel, SnapshotComparePanel, and FileInspectorPanel tests pass; TypeScript build succeeds.

- [ ] **Step 7: Commit Task 5**

~~~bash
git add src/features/repository/RepositoryPage.tsx \
  src/features/repository/RepositoryPage.css \
  src/features/repository/RepositoryPage.test.tsx
git commit -m "feat: connect explorer file inspection"
~~~

## Task 6: Documentation, Archive, and Final Verification

**Files:**

- Create: `docs/implemented/file-inspector-block-map.md`
- Modify: `README.md`
- Modify: `README.ko.md`
- Modify: `docs/development-log.md`
- Modify: `docs/phase-status.md`
- Modify: `docs/project-plan.md`
- Modify: `docs/plans/README.md`
- Move: `docs/specs/0011-file-inspector-block-map.md` to `docs/archive/specs/0011-file-inspector-block-map.md`
- Move: `docs/plans/phase-7-file-inspector-block-map.md` to `docs/archive/plans/phase-7-file-inspector-block-map.md`

- [ ] **Step 1: Write implementation record**

Document:

- content-based transition semantics
- header-only normal path and magic-prefix streaming hash fallback
- master-detail interaction
- missing/invalid partial report behavior
- source-root identity limitation
- excluded payload preview and mutation behavior

- [ ] **Step 2: Update user-visible status documents**

In Korean development log, record implementation, tests, limits, and final command results. Move File Inspector from planned to implemented in phase status and project plan. Update README feature lists without claiming payload preview or repair.

- [ ] **Step 3: Archive completed spec and plan**

Move both documents, update `docs/archive/specs/README.md`, `docs/plans/README.md`, and every current link found by:

~~~bash
rg -n "0011-file-inspector|phase-7-file-inspector" README.md README.ko.md docs
~~~

- [ ] **Step 4: Run final Rust verification**

~~~bash
cd src-tauri
cargo fmt --all -- --check
cargo test
~~~

Expected: all prior tests and Phase 7 tests pass with zero failures.

- [ ] **Step 5: Run final UI and repository verification**

~~~bash
cd ..
npm test -- --run
npm run build
git diff --check HEAD
git status --short --branch
~~~

Expected: all UI tests pass, production build succeeds, no whitespace errors, and only intended Phase 7 changes remain.

- [ ] **Step 6: Commit documentation**

~~~bash
git add README.md README.ko.md docs
git commit -m "docs: record file inspector implementation"
~~~

## Recommended Commit Sequence

1. `docs: define file inspector block map` (already created as `e512de0`)
2. `docs: add file inspector implementation plan`
3. `feat: inspect physical block metadata`
4. `feat: add file inspection history service`
5. `feat: expose file inspector API`
6. `feat: add file inspector panel`
7. `feat: connect explorer file inspection`
8. `docs: record file inspector implementation`

## Completion Criteria

- Explorer selection loads a file inspection report.
- History is newest-first and uses ordered content digests, not timestamp-only changes.
- Deletion emits once and reappearance is Added.
- Any available version shows its exact block reference order.
- Raw, Zstd, LZ4, missing, unreadable, and invalid storage states are representable.
- Physical inspection does not decompress payloads.
- Magic-prefixed raw blocks remain correctly identified.
- Missing/invalid blocks do not prevent other history and blocks from rendering.
- Desktop uses master-detail and narrow screens stack without horizontal overflow.
- Existing restore, integrity, inventory, compression, and snapshot behavior remains green.
- Documentation and archive indexes match implementation status.
