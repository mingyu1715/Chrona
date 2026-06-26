# 0005. Block Compression Future Design

## Status

Future design. Not implemented in the current application.

This document records the constraints Chrona must preserve if block payload compression is added later.

## Goal

Reduce physical repository size by compressing newly stored block payloads while preserving Chrona's existing content-addressed identity model.

## Non-Goals

- Do not change the logical block identity algorithm.
- Do not change fixed-size chunking as part of compression.
- Do not make compression a prerequisite for snapshot comparison.
- Do not silently rewrite existing raw `.blk` files.
- Do not enable compression by default before restore and integrity verification exist.

## Identity Invariant

Block identity must remain based on the raw, uncompressed block bytes.

```text
raw_chunk = read_chunk(file)
hash = SHA-256(raw_chunk)
```

Compression must happen only after the raw hash is calculated and duplicate block reuse is checked.

```text
raw_chunk
  -> SHA-256(raw_chunk)
  -> dedup lookup by raw hash
  -> if block is new, optionally compress payload
  -> write block payload atomically
```

Consequences:

- The same source bytes always produce the same block hash.
- Snapshot comparison can continue to compare ordered raw block hash sequences.
- Compression settings can change later without changing logical block identity.
- Integrity verification should decompress first, then hash the restored raw bytes.

## Recommended Compression Modes

Chrona should keep compression mode selection simple and explicit. The preferred future modes are:

| Mode | Codec | Purpose |
| --- | --- | --- |
| `off` | raw | No compression, easiest compatibility path. |
| `standard` | `zstd` level 3 | Default mode for normal backup usage. |
| `fast` | `lz4` | Speed-first mode when low CPU overhead matters more than compression ratio. |

`standard` should be the default once compressed block restore and integrity verification exist. `fast` should be an opt-in mode, not an automatic per-file-type decision.

## Recommended Algorithm

```text
for each raw_chunk:
  raw_hash = SHA-256(raw_chunk)

  if block_exists(raw_hash):
    reuse block
    continue

  match compression_mode:
    off:
      write encoded block with compression = none
      continue
    standard:
      compressed = zstd(raw_chunk, level = 3)
      selected_encoding = zstd
    fast:
      compressed = lz4(raw_chunk)
      selected_encoding = lz4

  if len(compressed) + envelope_overhead <= len(raw_chunk) * 0.97:
    write encoded block with compression = selected_encoding
  else:
    write encoded block with compression = none
```

Codec policy:

- `zstd` level 3 is the default standard mode because it balances speed and compression ratio for backup-style storage.
- `lz4` is reserved for fast mode where throughput is more important than maximum compression ratio.
- `gzip`, `brotli`, and `lzma/xz` are not preferred for the MVP compression path because they add restore/test complexity without improving the core block identity model.
- File extension or MIME type may be used only as a skip hint later; it should not choose a different codec in the first compression implementation.

## Storage Format Constraint

Current Phase 1 block files are raw payloads at:

```text
blocks/{hash[0..2]}/{hash[2..4]}/{hash}.blk
```

A future compressed block format must be introduced as an explicit repository format extension. Two viable designs are:

1. Self-describing block envelope inside `.blk` files.
2. Raw/compression metadata stored in a block index.

The preferred future direction is a self-describing envelope because restore and verification can decode a block without relying on a separate index file.

Example envelope fields:

```text
magic = CHRBLK1
encoding = none | zstd | lz4
raw_size_bytes
stored_size_bytes
raw_sha256
payload
```

Compatibility rule:

- Existing schema version 1 `.blk` files are interpreted as raw payloads.
- Compressed/enveloped blocks require a repository schema or block encoding version bump.
- A migration path must be documented before writing enveloped blocks in existing repositories.

## Metadata Additions

Snapshot `BlockReference` should continue to store logical raw block data:

```json
{
  "index": 0,
  "offset": 0,
  "sizeBytes": 1048576,
  "hash": "sha256-of-raw-block"
}
```

Physical storage metadata may add fields such as:

```json
{
  "hash": "sha256-of-raw-block",
  "sizeBytes": 1048576,
  "storedSizeBytes": 324112,
  "compression": {
    "mode": "standard",
    "algorithm": "zstd",
    "level": 3
  }
}
```

This metadata belongs to block storage/indexing, not to the logical file snapshot identity.

## Safety Rules

- Atomic-like write still applies: write temporary encoded payload, sync, then rename.
- If compression fails, the write should fail or fall back to raw according to an explicit policy.
- If compressed payload is not at least 3% smaller than raw payload after envelope overhead, store raw.
- Decompression errors must surface as integrity/restore errors.
- Integrity verification must compare `SHA-256(decompressed_payload)` against the block hash.

## UI Implications

Future UI can expose:

- original input bytes
- logical unique raw bytes
- physical stored bytes
- compression saved bytes
- compression ratio
- selected compression mode: off, standard, or fast

Compression should not be shown as implemented until the block read/restore path can decode compressed blocks.
