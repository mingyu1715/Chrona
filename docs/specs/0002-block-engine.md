# 0002. Block Engine

## Scope

Phase 1 implements fixed-size block ingest and duplicate block reuse. It does not create snapshots. The output is a block ingest summary that Phase 2 can use to build snapshot metadata.

## Chunking

- Chunking strategy: fixed size
- Chunk size: `1_048_576` bytes
- Empty files produce zero block references
- The final block of a file may be smaller than the fixed chunk size
- Ingest processes files through a streaming callback path; it does not need to hold an entire source file in memory

## Block Identity

Each block is identified by SHA-256 over the exact block bytes. Equal bytes must produce the same block hash and therefore the same storage path.

## Compression

Current block files are stored as raw, uncompressed block bytes. Compression is not implemented in the Phase 1/2/3 engine.

Future compression must preserve the current identity invariant: block hash is SHA-256 over the raw, uncompressed chunk bytes. See `docs/specs/0005-block-compression.md` for the future design constraints.

## Atomic-like Write

New blocks are written as:

```text
{hash}.blk.tmp-{operationId}
```

After writing and syncing the temporary file, Chrona renames it to:

```text
{hash}.blk
```

If the final `.blk` already exists, Chrona treats the block as reused and does not rewrite it.

## Path Safety

Before ingest starts, Chrona canonicalizes source and repository paths and rejects these cases:

- source path equals repository path
- source path is inside repository path
- repository path is inside source path

This prevents Chrona from ingesting its own block store or writing repository data into the source tree being analyzed.

## Metadata Relative Paths

All metadata-facing relative paths use `/` separators regardless of operating system.

Rejected relative paths:

- absolute paths
- drive/root prefixes
- `..` parent segments
- non-UTF-8 paths in MVP

## Progress Event Shape

Event name:

```text
block-ingest-progress
```

Payload fields:

```text
operationId
phase
currentFile
processedFiles
totalFiles
currentFileBytesProcessed
currentFileSizeBytes
totalBytesProcessed
totalBytes
```

Phase 1 emits at least `scanning`, `chunking`, `storing`, and `completed` states.
