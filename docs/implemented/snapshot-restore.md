# Snapshot Restore Implementation Record

## Goal

Restore a selected Chrona snapshot into a separate target directory using the snapshot metadata and stored block files.

## Implemented Scope

- Added `RestoreReport` and `RestoreFileResult` models.
- Added `RestoreService::restore_snapshot`.
- Added `BlockStore::read_block` for SHA-256 addressed physical block files.
- Added restore target safety checks that reject repository/target containment in either direction.
- Added conversion from snapshot metadata `relativePath` strings to safe OS paths.
- Added `.tmp-{operationId}` then rename writes for restored files.
- Added `UnsafeRestoreTarget`, `MissingBlock`, and `Restore` error variants.
- Added `restore_snapshot` Tauri command and command handler registration.
- Added TypeScript restore types and `chronaApi.restoreSnapshot`.
- Added restore target selection and result metrics to the snapshot detail UI.

## Restore Algorithm

For each snapshot file, Chrona validates the stored relative path, creates parent directories under the target folder, then writes a temp output file. Block bytes are read in the order recorded in the snapshot file and appended to the temp file. After the temp file is synced, it is renamed to the final path.

Zero-byte files have no block references and are restored as empty files through the same temp/rename flow.

## Safety Rules

- The restore target cannot equal the repository path.
- The restore target cannot be inside the repository.
- The repository cannot be inside the restore target.
- The restore target must be missing or empty.
- Final output files must not already exist.
- Snapshot metadata paths are rejected if they are absolute, contain backslashes, contain `.` or `..`, or look like a drive-prefixed path.

## Validation Coverage

- Restores regular, nested, and zero-byte files.
- Rejects target inside repository.
- Rejects non-empty target directory.
- Returns `MissingBlock` when a referenced block file is absent.
- UI test covers target path input, command invocation, and restore result rendering.

## Known Limits

- Restore progress events are not implemented.
- Restore cancelation is not implemented.
- Original modified timestamps are not restored yet.
- Full SHA-256 block integrity verification is not part of restore yet.
- In-place restore and overwrite/merge conflict handling are intentionally excluded from the MVP restore flow.
