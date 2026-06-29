# Chrona

Chrona is a desktop application for block-based, point-in-time data management.

The project stores files as reusable data blocks and records file state over time through snapshots. The goal is not to replace commercial backup products, but to implement and visualize core storage-system ideas such as fixed-size block chunking, block identity, block reuse, snapshot metadata, restore flows, and integrity verification.

## Current Status

Chrona has completed the Phase 4 snapshot restore core flow, the Home/adaptive navigation MVP, Phase 5 integrity verification, and the repository inventory explorer.

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
- Snapshot comparison command and UI
- Added/deleted/modified/unchanged file classification
- Block-reference multiset change counts
- Native macOS file/folder picker
- Snapshot restore command and minimal UI
- Safe restore target checks and `.tmp` then rename output writes
- Home workspace section with Continue Working, pinned items, and recent access lists
- Repository-local adaptive access history in `indexes/access-index.json`
- Pin/unpin and clear-history controls for access items
- Read-only repository integrity verification command and UI
- Missing block, block size mismatch, and raw SHA-256 mismatch detection
- Repository Explorer for recorded files, file kinds, and latest-snapshot presence state
- Current source existence, missing-file, and missing-root status
- Path search plus file-kind, snapshot-state, and source-state filters
- Schema 2 raw/off, Zstd level 3 standard, and LZ4 fast compression modes
- 3% raw fallback and schema 1 legacy raw block compatibility
- Compressed-block restore and decoded raw SHA-256 integrity verification

Not implemented yet:

- Auto-repair and block garbage collection
- Packaged `.app` release

## Tech Stack

- Desktop shell: Tauri 2
- Core engine: Rust
- UI: React + TypeScript + Vite
- Test: Cargo test, Vitest
- Initial metadata format: JSON files
- Block hash: SHA-256
- Block size: 1 MiB fixed chunks

## Core Algorithms

Chrona is built around a small set of storage algorithms rather than a custom compression format.

### 1. Fixed-block content addressing

Each file is treated as an ordered byte stream and split into fixed-size blocks.

```text
B = 1 MiB
H(x) = SHA-256(x)

for each file f in source_set:
  offset = 0
  block_index = 0

  while chunk = read_at_most_B_bytes(f):
    hash = H(chunk)

    emit BlockReference(
      index = block_index,
      offset = offset,
      size = len(chunk),
      hash = hash
    )

    offset += len(chunk)
    block_index += 1
```

Properties:

- Equal bytes always produce the same block hash.
- The same file content always produces the same ordered block-reference sequence.
- The last block may be smaller than `B`.
- A zero-byte file produces an empty block-reference sequence.

### 2. Hash-based block deduplication

Chrona uses the block hash as the identity key.

```text
repository_blocks = set(existing_block_hashes)
new_blocks = 0
reused_blocks = 0

for each chunk in file_stream:
  hash = SHA-256(chunk)

  if hash in repository_blocks:
    reused_blocks += 1
    reuse existing block
  else:
    write chunk as block(hash)
    repository_blocks.add(hash)
    new_blocks += 1
```

Properties:

- Ingest is idempotent for unchanged input: running the same source twice stores no new blocks on the second run.
- Two different files with identical chunk bytes point to the same physical block.
- Storage grows by the number of new unique block bytes, not by total input bytes.

### 3. Snapshot as a persistent reference graph

A snapshot does not copy file bytes again. It records a stable graph from files to block hashes.

```text
Snapshot = {
  id,
  created_at,
  source_root,
  files: [
    {
      relative_path,
      size_bytes,
      modified_at,
      blocks: [BlockReference]
    }
  ],
  summary
}
```

Conceptually:

```text
Snapshot
  -> FileEntry(relative_path)
    -> BlockReference(hash)
      -> PhysicalBlock(bytes)
```

This makes snapshot creation mostly metadata work after block ingest has identified which bytes are new and which bytes are reused.

### 4. Snapshot comparison by path map and block multiset

Snapshot comparison uses metadata only. Files are matched by normalized relative path, then content identity is checked through size and ordered block hash sequence.

```text
before = map(base.files by relative_path)
after = map(target.files by relative_path)

for path in sorted(union(before.keys, after.keys)):
  if path not in before:
    emit added
  else if path not in after:
    emit deleted
  else if before[path].size == after[path].size
       and hashes(before[path]) == hashes(after[path]):
    emit unchanged
  else:
    emit modified
```

Block-reference changes are counted as a multiset difference, not a simple set difference.

```text
shared = sum(min(count_before[h], count_after[h]))
added = sum(max(count_after[h] - count_before[h], 0))
removed = sum(max(count_before[h] - count_after[h], 0))
```

This keeps repeated block references meaningful when a file contains the same block more than once.

### 5. Snapshot restore by ordered block materialization

Restore walks the snapshot reference graph and rebuilds each file by reading physical blocks in the recorded order.

```text
for each file in snapshot.files:
  output = open_tmp(target / file.relative_path)

  for block_ref in file.blocks ordered by index:
    block_bytes = read(block_path(block_ref.hash))
    append(output, block_bytes)

  sync(output)
  rename_tmp_to_final(output)
```

Properties:

- Restore is `O(R)`, where `R` is the total number of restored bytes.
- Memory remains bounded by the largest block read at a time.
- The restore target must be outside the repository and must be empty or newly created.
- Output files use a `.tmp-{operationId}` path before final rename.

### 6. Repository integrity verification

Integrity verification checks whether recorded snapshot references still point to valid physical block files. It does not repair data; it produces a report.

```text
unique_blocks = map()

for each snapshot in snapshot_index:
  for each file in snapshot.files:
    for each ref in file.blocks:
      unique_blocks[ref.hash] = expected_size(ref)

for each (hash, expected_size) in unique_blocks:
  path = block_path(hash)

  if path is missing:
    emit missingBlock
    continue

  bytes = read(path)

  if len(bytes) != expected_size:
    emit blockSizeMismatch

  if SHA-256(bytes) != hash:
    emit blockHashMismatch
```

Properties:

- Duplicate references are counted in metadata statistics but the physical block is checked once per unique hash.
- Verification is read-only and never rewrites repository contents.
- A healthy report means every referenced block's decoded raw bytes match snapshot metadata.

### 7. Raw-identity block compression

Chrona keeps block identity based on uncompressed raw bytes and compresses only new physical payloads. Standard uses Zstd level 3, fast uses LZ4 frame encoding, and off stores raw blocks.

```text
raw_chunk
  -> SHA-256(raw_chunk)
  -> dedup lookup by raw hash
  -> optional compression for new blocks (standard zstd or fast lz4)
  -> write encoded payload
```

Compressed storage is selected only when the complete envelope is at least 3% smaller than raw bytes. Existing schema 1 raw blocks remain readable without rewriting.

### Complexity

Let:

- `N` = total input bytes
- `B` = block size, currently `1 MiB`
- `K` = number of block references
- `P` = number of snapshot file paths being compared
- `U` = total bytes of newly unique blocks

Then:

- Chunking and hashing time: `O(N)`
- Dedup lookup time: `O(K)` average with hash-set/path existence checks
- Streaming memory for file bytes: `O(B)`
- Metadata memory/output: `O(K)`
- Snapshot comparison path matching: `O(P log P)` for stable sorted output
- Snapshot comparison block multiset counting: `O(K)`
- New physical storage growth: `O(U)`

### Current algorithmic trade-offs

- Fixed-size chunking is deterministic and simple, but less effective than content-defined chunking when bytes are inserted near the beginning of a large file.
- Chrona supports raw/off, standard Zstd level 3, and fast LZ4 frame modes while keeping raw-byte hashes as block identity.
- Chrona currently stores a snapshot reference graph, not a Merkle tree.
- Block garbage collection, auto-repair, encryption, and content-defined chunking remain future algorithm candidates. Compression implementation details are in `docs/implemented/block-compression.md`.

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
- `docs/plans/`: active or next-up implementation plans
- `docs/implemented/`: completed feature records
- `docs/archive/`: completed or retired working plans
- `docs/development-log.md`: chronological development log

## License

Chrona is source-available for non-commercial use under the PolyForm Noncommercial License 1.0.0.

Commercial use is prohibited unless separate written permission is granted by the copyright holder.
See `LICENSE` for details.
