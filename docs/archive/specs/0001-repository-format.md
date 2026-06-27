# 0001. Repository Format

## Status

Implemented in Phase 1.

## Scope

Phase 1 defines only the repository layout needed by the block engine. Snapshot metadata, deletion, garbage collection, compression, encryption, and SQLite metadata are outside this phase.

## Layout

```text
chrona-repository/
  manifest.json
  blocks/
  indexes/
  logs/
```

`blocks/`, `indexes/`, and `logs/` are created at repository creation time. `indexes/` and `logs/` are reserved in Phase 1 so later phases can add metadata without changing the root layout.

## manifest.json

```json
{
  "schemaVersion": 1,
  "appVersion": "0.1.0",
  "repositoryId": "uuid-v4",
  "createdAt": "2026-06-19T00:00:00Z",
  "blockStrategy": {
    "type": "fixed",
    "sizeBytes": 1048576,
    "hash": "sha256"
  }
}
```

Rules:

- `schemaVersion` must be `1` for Phase 1.
- `blockStrategy.type` is fixed to `fixed`.
- `blockStrategy.sizeBytes` is fixed to `1048576`.
- `blockStrategy.hash` is fixed to `sha256`.
- Opening a repository with another schema version fails with `UnsupportedRepositoryVersion`.

## Block Path Convention

Blocks are stored by SHA-256 hash prefix:

```text
blocks/{hash[0..2]}/{hash[2..4]}/{hash}.blk
```

Example:

```text
blocks/ab/cd/abcdef....blk
```

The path stored or returned by the block engine is repository-relative. Absolute paths are not part of block metadata.
