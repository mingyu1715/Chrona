# Block Compression Implementation

## Status

Implemented as Phase 6 storage-format optimization.

## Implemented Modes

- off: stores new blocks as raw bytes.
- standard: attempts Zstd level 3 and falls back to raw.
- fast: attempts LZ4 frame encoding and falls back to raw.
- standard is the default for newly created schema 2 repositories.

## Identity and Deduplication

Block identity remains SHA-256 of the uncompressed raw block.

~~~text
raw block
  -> SHA-256 raw bytes
  -> existing hash-path lookup
  -> encode only when the block is new
  -> atomic temporary write and rename
~~~

Changing compression mode does not change block hashes or rewrite existing block files.

## Repository Compatibility

- Schema 1 repositories remain readable and default to compression off.
- New repositories use schema 2, block encoding version 2, and standard mode.
- Changing compression mode upgrades only manifest metadata to schema 2.
- Existing raw block payloads remain readable without migration.
- Compressed block payloads use a self-describing CHRBLK01 envelope.
- Raw blocks that begin with CHRBLK01 are distinguished by their complete raw SHA-256 before envelope parsing.

## Envelope

The compressed envelope stores magic/version, codec, raw and payload sizes, raw SHA-256, and the codec frame. Decode is bounded to 1 MiB and validates every header field, decoded size, and raw hash.

## Raw Fallback

Compression is used only when the complete envelope is at least 3% smaller than raw bytes. Small or incompressible blocks stay raw.

## Integration

- BlockStore encodes new payloads and returns decoded raw bytes to readers.
- RestoreService reconstructs files from raw, Zstd, and LZ4 blocks.
- IntegrityService reports blockDecodeFailed for invalid compressed payloads.
- Ingest and snapshot summaries record logical bytes, physical bytes, saved bytes, and encoding counts.
- Repository UI exposes the selected mode and a minimal mode control.

## Limits

- No existing block recompression.
- No per-extension codec selection or compression dictionary.
- No garbage collection or encryption.

## Verification

Phase 6 tests cover schema compatibility, all modes, fallback, dedup reuse, restore, and corruption detection. Full verification results are recorded in the development log.
