# Block Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Store new Chrona blocks with raw, Zstd level 3, or LZ4 frame encoding while preserving raw SHA-256 identity and legacy raw repository compatibility.

**Architecture:** BlockStore remains the only physical block payload boundary. A new block codec writes a versioned self-describing envelope only when compressed output including envelope overhead is at least 3% smaller than raw bytes; otherwise it stores legacy-compatible raw bytes. Restore and integrity verification receive decoded raw bytes through BlockStore, while repository schema 2 records the selected mode and schema 1 repositories open as compression off until explicitly upgraded.

**Tech Stack:** Rust, serde, SHA-256, zstd 0.13.3, lz4_flex 0.13.1 frame format, Tauri 2, React, TypeScript, Cargo integration tests, Vitest.

---

## Scope

Included:

- repository schema 2 with compression mode
- schema 1 read compatibility
- off, standard, and fast modes
- Zstd level 3 standard encoding
- LZ4 frame fast encoding
- 3% raw fallback threshold including envelope bytes
- self-describing compressed block envelope
- atomic temporary-file write and rename
- decoded block reads for restore and integrity verification
- compression statistics in ingest and snapshot summaries
- minimal repository compression mode control
- Rust and UI regression tests

Excluded:

- rewriting existing raw blocks
- per-file or per-extension codec selection
- dictionary training
- background recompression
- garbage collection
- encryption
- content-defined chunking

## Storage Format

Compressed block files keep the existing path:

~~~text
blocks/{hash[0..2]}/{hash[2..4]}/{hash}.blk
~~~

Raw fallback files remain raw bytes. Compressed files use this 60-byte header:

~~~text
offset  size  field
0       8     magic = CHRBLK01
8       1     envelope version = 1
9       1     encoding = 1(zstd) | 2(lz4)
10      2     reserved = 0
12      8     raw size, little endian u64
20      8     compressed payload size, little endian u64
28      32    raw SHA-256 bytes
60      N     codec frame payload
~~~

Decoder rules:

- no magic prefix means legacy/raw payload
- known magic with unsupported version or encoding is an error
- payload length must match the header
- raw size must not exceed the fixed 1 MiB block limit
- decoded size must match raw size
- header hash and decoded raw SHA-256 must match the block path hash

## Task 1: Repository Compression Configuration

**Files:**

- Modify: src-tauri/src/models/repository.rs
- Modify: src-tauri/src/core/repository.rs
- Modify: src-tauri/src/commands/repository_commands.rs
- Test: src-tauri/tests/phase6_compression.rs
- Modify: src-tauri/tests/phase1_core.rs

- [x] **Step 1: Add a failing schema compatibility test**

Create phase6_compression.rs with a test that:

~~~rust
#[test]
fn legacy_schema_one_repository_opens_with_compression_off() {
    let repository = create_schema_one_repository_fixture();
    let manifest = RepositoryManager::open(repository.path()).unwrap();

    assert_eq!(manifest.schema_version, 1);
    assert_eq!(manifest.block_strategy.encoding_version, 1);
    assert_eq!(
        manifest.block_strategy.compression_mode,
        CompressionMode::Off
    );
}
~~~

- [x] **Step 2: Run the test and verify RED**

~~~bash
cd src-tauri
cargo test --test phase6_compression legacy_schema_one_repository_opens_with_compression_off
~~~

Expected: compile failure because CompressionMode and encoding_version do not exist.

- [x] **Step 3: Add repository model fields**

Add CompressionMode with serde camelCase values off, standard, fast. Missing mode must default to Off. Add encoding_version to BlockStrategy with a serde default of 1.

New repositories use:

~~~rust
RepositoryManifest {
    schema_version: 2,
    block_strategy: BlockStrategy {
        strategy_type: "fixed".to_string(),
        size_bytes: 1_048_576,
        hash: "sha256".to_string(),
        encoding_version: 2,
        compression_mode: CompressionMode::Standard,
    },
    // existing fields unchanged
}
~~~

RepositoryManager::open accepts schema versions 1 and 2 and rejects all others.

- [x] **Step 4: Add atomic mode update**

Add:

~~~rust
pub fn set_compression_mode(
    repository_path: &Path,
    mode: CompressionMode,
) -> ChronaResult<RepositoryManifest>
~~~

It opens the repository, sets schema_version and encoding_version to 2, updates compression_mode, writes manifest.json.tmp, syncs, and renames to manifest.json. It never rewrites block files.

- [x] **Step 5: Add command wrapper test and implementation**

Expose:

~~~rust
set_repository_compression_mode(repository_path, compression_mode)
    -> RepositoryManifest
~~~

Test that setting Fast persists after reopening the repository.

- [x] **Step 6: Update Phase 1 expectations and run tests**

New repository tests expect schema 2, encoding version 2, and Standard mode. Unsupported-version tests must edit parsed JSON rather than string-replacing schema version 1.

~~~bash
cd src-tauri
cargo test --test phase6_compression
cargo test --test phase1_core
~~~

## Task 2: Versioned Block Codec

**Files:**

- Create: src-tauri/src/core/block_codec.rs
- Modify: src-tauri/src/core/mod.rs
- Modify: src-tauri/src/core/errors.rs
- Modify: src-tauri/src/models/block.rs
- Modify: src-tauri/Cargo.toml
- Test: src-tauri/tests/phase6_compression.rs

- [x] **Step 1: Add dependencies**

~~~toml
zstd = "0.13.3"
lz4_flex = "0.13.1"
~~~

- [x] **Step 2: Write failing codec round-trip tests**

Add tests for:

- Standard compresses 1 MiB of repeated bytes and decodes to identical raw bytes.
- Fast compresses 1 MiB of repeated bytes and decodes to identical raw bytes.
- Off returns raw bytes.
- A short input in Standard falls back to raw because envelope overhead exceeds the 3% threshold.
- Corrupt envelope payload returns a Decompression or InvalidBlockEnvelope error.

- [x] **Step 3: Run codec tests and verify RED**

~~~bash
cd src-tauri
cargo test --test phase6_compression codec_
~~~

Expected: compile failure because block_codec does not exist.

- [x] **Step 4: Implement encoding types**

Add:

~~~rust
pub enum BlockEncoding {
    Raw,
    Zstd,
    Lz4,
}

pub struct EncodedBlock {
    pub bytes: Vec<u8>,
    pub encoding: BlockEncoding,
    pub raw_size_bytes: u64,
    pub stored_size_bytes: u64,
}

pub struct DecodedBlock {
    pub bytes: Vec<u8>,
    pub encoding: BlockEncoding,
    pub stored_size_bytes: u64,
}
~~~

- [x] **Step 5: Implement encode_block**

Signature:

~~~rust
pub fn encode_block(
    raw: &[u8],
    raw_hash: &str,
    mode: CompressionMode,
) -> ChronaResult<EncodedBlock>
~~~

Standard uses zstd::stream::encode_all with level 3. Fast uses lz4_flex::frame::FrameEncoder. Off returns raw. Compressed output is wrapped in the 60-byte envelope only when:

~~~rust
enveloped_len * 100 <= raw_len * 97
~~~

Otherwise return raw encoding.

- [x] **Step 6: Implement bounded decode_block**

Signature:

~~~rust
pub fn decode_block(
    stored: &[u8],
    expected_hash: &str,
) -> ChronaResult<DecodedBlock>
~~~

Use streaming decoders limited to 1_048_577 output bytes. Validate header, payload length, decoded length, header hash, and decoded raw SHA-256. Return raw bytes directly when the magic prefix is absent.

- [x] **Step 7: Run codec tests**

~~~bash
cd src-tauri
cargo test --test phase6_compression codec_
~~~

Expected: all codec tests pass.

## Task 3: BlockStore Compression Integration

**Files:**

- Modify: src-tauri/src/core/block_store.rs
- Modify: src-tauri/src/models/block.rs
- Test: src-tauri/tests/phase6_compression.rs
- Test: src-tauri/tests/phase1_core.rs

- [x] **Step 1: Write failing BlockStore tests**

Add tests that:

- with Standard, a compressible block is physically smaller and read_block returns raw bytes
- with Fast, the stored encoding is Lz4 and read_block returns raw bytes
- a legacy raw block written directly to the existing block path still reads correctly
- a second store of the same raw hash reuses the existing file regardless of current mode
- final block files exist only after temporary-file rename

- [x] **Step 2: Run tests and verify RED**

~~~bash
cd src-tauri
cargo test --test phase6_compression block_store_
~~~

- [x] **Step 3: Extend BlockStore construction**

Keep BlockStore::new as Off for existing direct callers and add:

~~~rust
pub fn with_compression_mode(
    repository_path: PathBuf,
    compression_mode: CompressionMode,
) -> Self
~~~

- [x] **Step 4: Encode on write and decode on read**

store_block calls encode_block only after confirming the hash path does not exist. It writes encoded bytes through the existing temporary-file, sync, and rename flow.

read_block loads physical bytes and calls decode_block, so restore and future readers always receive raw bytes.

BlockStoreWrite records:

~~~rust
pub raw_size_bytes: u64,
pub stored_size_bytes: u64,
pub encoding: BlockEncoding,
pub was_new: bool,
~~~

- [x] **Step 5: Run BlockStore and Phase 1 tests**

~~~bash
cd src-tauri
cargo test --test phase6_compression block_store_
cargo test --test phase1_core
~~~

## Task 4: Ingest and Snapshot Compression Statistics

**Files:**

- Modify: src-tauri/src/models/ingest.rs
- Modify: src-tauri/src/models/snapshot.rs
- Modify: src-tauri/src/core/block_ingest_service.rs
- Modify: src-tauri/src/core/snapshot_service.rs
- Modify: src/shared/types/chrona.ts
- Test: src-tauri/tests/phase6_compression.rs
- Modify: existing Rust and UI fixtures

- [x] **Step 1: Write a failing compressed ingest summary test**

Create a Standard repository, ingest a 1 MiB repeated-byte file, and assert:

~~~rust
assert_eq!(summary.new_block_count, 1);
assert_eq!(summary.new_logical_bytes, 1_048_576);
assert!(summary.newly_stored_bytes < summary.new_logical_bytes);
assert_eq!(
    summary.compression_saved_bytes,
    summary.new_logical_bytes - summary.newly_stored_bytes
);
assert_eq!(summary.new_zstd_block_count, 1);
~~~

- [x] **Step 2: Run the test and verify RED**

~~~bash
cd src-tauri
cargo test --test phase6_compression compressed_ingest_reports_physical_savings
~~~

- [x] **Step 3: Add summary fields**

Add serde-defaulted fields to BlockIngestSummary and SnapshotSummary:

~~~rust
pub new_logical_bytes: u64,
pub compression_saved_bytes: u64,
pub new_raw_block_count: u64,
pub new_zstd_block_count: u64,
pub new_lz4_block_count: u64,
~~~

TypeScript interfaces use the corresponding camelCase fields.

- [x] **Step 4: Use manifest mode during ingest**

BlockIngestService keeps the manifest returned by RepositoryManager::open and constructs BlockStore with manifest.block_strategy.compression_mode.

For each new block:

- add raw_size_bytes to new_logical_bytes
- add stored_size_bytes to newly_stored_bytes
- add the non-negative difference to compression_saved_bytes
- increment the matching encoding count

- [x] **Step 5: Persist snapshot statistics**

SnapshotService copies the new ingest summary fields into SnapshotSummary. New fields use serde defaults so existing snapshot JSON remains readable.

- [x] **Step 6: Run ingest and snapshot tests**

~~~bash
cd src-tauri
cargo test --test phase6_compression compressed_ingest_reports_physical_savings
cargo test --test phase1_core
cargo test --test phase2_snapshot
~~~

## Task 5: Restore and Integrity Decoding

**Files:**

- Modify: src-tauri/src/core/integrity_service.rs
- Test: src-tauri/tests/phase4_restore.rs
- Test: src-tauri/tests/phase5_integrity.rs
- Test: src-tauri/tests/phase6_compression.rs

- [x] **Step 1: Write a failing compressed restore test**

Create a Standard repository, create a snapshot from compressible data, confirm the physical block has the envelope magic, restore the snapshot, and assert restored bytes equal the source.

- [x] **Step 2: Write a failing compressed corruption test**

Create a compressed snapshot, flip one payload byte in its block file, run IntegrityService, and assert failed status with blockDecodeFailed or blockHashMismatch.

- [x] **Step 3: Run tests and verify RED**

~~~bash
cd src-tauri
cargo test --test phase6_compression compressed_
~~~

- [x] **Step 4: Route integrity reads through BlockStore**

Keep explicit missing-file detection. Replace direct fs::read payload validation with BlockStore::read_block so checks operate on decoded raw bytes. Map envelope/decompression failures to a blockDecodeFailed issue.

RestoreService already uses BlockStore::read_block; retain its decoded-size check and atomic output write.

- [x] **Step 5: Run restore and integrity suites**

~~~bash
cd src-tauri
cargo test --test phase4_restore
cargo test --test phase5_integrity
cargo test --test phase6_compression
~~~

## Task 6: Tauri API and Minimal Compression Controls

**Files:**

- Modify: src-tauri/src/main.rs
- Modify: src/shared/api/chronaApi.ts
- Modify: src/shared/types/chrona.ts
- Modify: src/features/repository/RepositoryPage.tsx
- Modify: src/features/repository/RepositoryPage.test.tsx
- Modify: src/features/snapshots/SnapshotPanel.test.tsx
- Modify: src/features/snapshots/SnapshotComparePanel.test.tsx

- [x] **Step 1: Write a failing UI test**

Open a repository, select Fast in a Compression mode control, apply it, and assert:

~~~ts
expect(api.setRepositoryCompressionMode)
  .toHaveBeenCalledWith('/tmp/chrona-repo', 'fast');
expect(screen.getByText(/compression mode/i).nextElementSibling)
  .toHaveTextContent('fast');
~~~

- [x] **Step 2: Run the UI test and verify RED**

~~~bash
npm test -- RepositoryPage.test.tsx
~~~

- [x] **Step 3: Add API types and wrapper**

Add CompressionMode = 'off' | 'standard' | 'fast', extend BlockStrategy with encodingVersion and compressionMode, and expose:

~~~ts
setRepositoryCompressionMode(
  repositoryPath: string,
  compressionMode: CompressionMode,
): Promise<RepositoryManifest>
~~~

- [x] **Step 4: Add minimal Repository control**

The Repository chapter shows the current mode, a select control, and Apply Compression Mode. Applying updates the manifest in state. It does not redesign the current UI.

The Review result adds logical new bytes, physically stored bytes, compression saved bytes, and encoding counts.

- [x] **Step 5: Update API mocks and run UI tests**

~~~bash
npm test
npm run build
~~~

## Task 7: Documentation, Archive, and Verification

**Files:**

- Create: docs/implemented/block-compression.md
- Modify: docs/development-log.md
- Modify: docs/phase-status.md
- Modify: docs/project-plan.md
- Modify: docs/plans/README.md
- Modify: README.md
- Modify: README.ko.md
- Move: docs/specs/0005-block-compression.md to docs/archive/specs/0005-block-compression.md
- Move: docs/plans/phase-6-block-compression.md to docs/archive/plans/phase-6-block-compression.md

- [x] **Step 1: Document compatibility**

Record schema 1 raw read compatibility, schema 2 mode configuration, envelope layout, raw fallback threshold, and the rule that existing raw blocks are never rewritten.

- [x] **Step 2: Update user-facing status**

The Korean development log records implemented modes, physical format, compatibility, tests, and remaining exclusions. README status moves block compression from future to implemented.

- [x] **Step 3: Archive completed spec and plan**

Move the completed compression spec and plan to archive directories and update all current references.

- [x] **Step 4: Run final verification**

~~~bash
cd src-tauri
cargo fmt --all -- --check
cargo test
cd ..
npm test -- --run
npm run build
git diff --check HEAD
~~~

Expected:

- all Rust tests pass
- all UI tests pass
- production build succeeds
- no formatting or whitespace errors

## Recommended Commits

1. feat: add versioned block compression codec
2. feat: integrate compression with restore and integrity
3. feat: expose repository compression controls
4. docs: record block compression implementation

## Completion Criteria

- New repositories default to Standard Zstd level 3.
- Existing schema 1 repositories open as raw/off without rewriting blocks.
- Users can select off, standard, or fast per repository.
- New compressible blocks use Zstd or LZ4 envelope storage.
- Incompressible or small blocks fall back to raw storage.
- SHA-256 identity remains based on raw bytes.
- Duplicate lookup happens before compression.
- Restore reconstructs files from raw and compressed blocks.
- Integrity verification validates decoded raw size and hash.
- Compression statistics report logical, physical, and saved bytes.
- All tests and builds pass.
