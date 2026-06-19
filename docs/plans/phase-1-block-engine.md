# Phase 1 Block Engine Implementation Plan

## Goal

Implement Chrona repository creation/opening, fixed-size block ingest, duplicate block reuse, path safety, progress events, and a minimal UI for running ingest.

## Checklist

- [x] Create Rust crate and frontend scaffold
- [x] Add failing Rust tests for repository layout, path safety, chunking, hashing, block storage, and ingest progress
- [x] Implement repository manifest creation/opening
- [x] Implement source/repository containment guard
- [x] Normalize metadata relative paths with `/`
- [x] Implement fixed-size chunker
- [x] Implement SHA-256 block hashing
- [x] Implement `.tmp` then rename block writes
- [x] Implement block ingest summary
- [x] Emit ingest progress events from the Tauri command
- [x] Add minimal React repository/ingest UI
- [x] Add frontend test for create repository, progress display, and ingest summary
- [x] Add Phase 1 specs and implementation record

## Verification

Required commands:

```bash
cd src-tauri && cargo test
npm test
npm run build
```

Expected result: all commands pass before Phase 2 begins.
