# Phase 5 Integrity Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add repository integrity verification for snapshot block references and expose the result in the desktop UI.

**Architecture:** Keep verification read-only. Reuse repository validation, snapshot loading, block path convention, and SHA-256 raw block identity. The UI receives a summarized report and renders health counts plus issue rows.

**Tech Stack:** Rust, serde, Tauri 2 commands, React, TypeScript, Vitest, Cargo integration tests, JSON metadata.

---

## Scope

Included:

- `IntegrityReport` and issue models
- `IntegrityService::verify_repository`
- `verify_repository` Tauri command
- TypeScript API/types
- Integrity UI panel
- tests for healthy, missing block, and corrupt block repositories

Excluded:

- auto-repair
- block deletion/GC
- compressed block decoding
- encryption
- watcher/scheduled verification

## Tasks

### Task 1: Rust Model and Service

- [x] Add `src-tauri/src/models/integrity.rs`.
- [x] Add `src-tauri/src/core/integrity_service.rs`.
- [x] Add `src-tauri/tests/phase5_integrity.rs`.
- [x] Verify healthy repositories.
- [x] Detect missing referenced blocks.
- [x] Detect SHA-256 mismatched blocks.
- [x] Run `cd src-tauri && cargo test --test phase5_integrity`.

### Task 2: Command and TypeScript API

- [x] Add `src-tauri/src/commands/integrity_commands.rs`.
- [x] Register `verify_repository` in `src-tauri/src/main.rs`.
- [x] Add `IntegrityReport` types to `src/shared/types/chrona.ts`.
- [x] Add `chronaApi.verifyRepository`.
- [x] Update UI test mocks.

### Task 3: Integrity UI

- [x] Add Integrity section to the workspace sidebar.
- [x] Add Verify Repository action.
- [x] Render status, checked snapshot/file/block counts, missing/corrupt counts, and issue rows.
- [x] Add UI test for invoking verification and rendering report.
- [x] Run `npm test` and `npm run build`.

### Task 4: Documentation

- [x] Add `docs/implemented/integrity-verification.md`.
- [x] Update README status.
- [x] Update `docs/development-log.md`.
- [x] Archive this plan when complete.
- [x] Run `cargo test`, `npm test`, and `npm run build`.

## Completion Criteria

- App can run repository verification from UI.
- Healthy repository reports `healthy`.
- Missing block reports `failed`.
- Corrupt block reports `failed`.
- Verification is read-only.
- Existing snapshot/restore tests still pass.
