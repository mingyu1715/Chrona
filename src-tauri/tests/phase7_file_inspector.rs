use std::fs;
use std::path::{Path, PathBuf};

use chrona::core::block_store::BlockStore;
use chrona::core::errors::ChronaError;
use chrona::core::file_inspector_service::FileInspectorService;
use chrona::core::hasher::sha256_hex;
use chrona::core::repository::RepositoryManager;
use chrona::core::snapshot_store::SnapshotStore;
use chrona::models::block::BlockReference;
use chrona::models::file_inspector::{BlockStorageEncoding, BlockStorageState, FileVersionState};
use chrona::models::repository::CompressionMode;
use chrona::models::snapshot::{Snapshot, SnapshotFile, SnapshotSummary};
use tempfile::TempDir;

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
        let write = store
            .store_block(&hash, &raw, &format!("operation-{byte}"))
            .unwrap();

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

#[test]
fn block_storage_inspection_keeps_magic_prefixed_raw_as_raw() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("repo");
    RepositoryManager::create(&repository_path).unwrap();
    let raw = b"CHRBLK01 legacy raw bytes".to_vec();
    let hash = sha256_hex(&raw);
    let store = BlockStore::with_compression_mode(repository_path, CompressionMode::Off);
    store.store_block(&hash, &raw, "magic-raw").unwrap();

    let inspected = store.inspect_block(&hash, raw.len() as u64).unwrap();

    assert_eq!(inspected.storage_state, BlockStorageState::Available);
    assert_eq!(inspected.encoding, BlockStorageEncoding::Raw);
    assert_eq!(inspected.stored_size_bytes, Some(raw.len() as u64));
    assert_eq!(inspected.compression_saved_bytes, Some(0));
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
    assert_eq!(missing.encoding, BlockStorageEncoding::Unknown);
    assert_eq!(missing.stored_size_bytes, None);

    let raw = vec![b'z'; 1_048_576];
    let hash = sha256_hex(&raw);
    let compressed =
        BlockStore::with_compression_mode(repository_path.clone(), CompressionMode::Standard);
    let write = compressed
        .store_block(&hash, &raw, "invalid-header")
        .unwrap();
    let block_path = repository_path.join(write.storage_path);
    let mut stored = fs::read(&block_path).unwrap();
    stored[10] = 1;
    fs::write(block_path, stored).unwrap();

    let invalid = compressed.inspect_block(&hash, raw.len() as u64).unwrap();

    assert_eq!(invalid.storage_state, BlockStorageState::InvalidHeader);
    assert_eq!(invalid.encoding, BlockStorageEncoding::Unknown);
    assert!(invalid.issue.is_some());
}

#[test]
fn file_inspector_classifies_content_history_newest_first() {
    let fixture = create_history_fixture();

    let report = FileInspectorService::new()
        .inspect_repository_file(&fixture.repository_path, "notes.txt")
        .unwrap();

    assert_eq!(report.version_count, 4);
    assert_eq!(report.first_seen_at, "2026-06-26T00:00:00Z");
    assert_eq!(report.last_seen_at, "2026-06-30T00:00:00Z");
    assert_eq!(report.latest_state, FileVersionState::Added);
    assert_eq!(
        report
            .versions
            .iter()
            .map(|version| version.state)
            .collect::<Vec<_>>(),
        vec![
            FileVersionState::Added,
            FileVersionState::Deleted,
            FileVersionState::Modified,
            FileVersionState::Unchanged,
            FileVersionState::Added,
        ]
    );
    assert_eq!(
        report
            .versions
            .iter()
            .map(|version| version.snapshot_id.as_str())
            .collect::<Vec<_>>(),
        vec![
            "snapshot-5",
            "snapshot-4",
            "snapshot-3",
            "snapshot-2",
            "snapshot-1"
        ]
    );
}

#[test]
fn file_inspector_preserves_order_and_counts_hash_once_per_version() {
    let fixture = create_history_fixture();

    let report = FileInspectorService::new()
        .inspect_repository_file(&fixture.repository_path, "notes.txt")
        .unwrap();
    let modified = report
        .versions
        .iter()
        .find(|version| version.snapshot_id == "snapshot-3")
        .unwrap();

    assert_eq!(modified.total_block_references, 3);
    assert_eq!(modified.unique_block_count, 2);
    assert_eq!(
        modified
            .blocks
            .iter()
            .map(|block| block.hash.as_str())
            .collect::<Vec<_>>(),
        vec![
            fixture.hash_a.as_str(),
            fixture.hash_a.as_str(),
            fixture.hash_b.as_str()
        ]
    );
    assert_eq!(modified.blocks[0].index, 0);
    assert_eq!(modified.blocks[1].index, 1);
    assert_eq!(modified.blocks[2].index, 2);
    assert_eq!(modified.blocks[0].seen_in_version_count, 3);
    assert_eq!(modified.blocks[1].seen_in_version_count, 3);
    assert_eq!(modified.blocks[2].seen_in_version_count, 1);
}

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
        vec![snapshot_file(
            "notes.txt",
            "2026-06-30T00:00:00Z",
            &[(&missing_hash, 7)],
        )],
    );

    let report = FileInspectorService::new()
        .inspect_repository_file(&repository_path, "notes.txt")
        .unwrap();

    assert_eq!(
        report.versions[0].blocks[0].storage_state,
        BlockStorageState::Missing
    );
    assert_eq!(
        report.versions[0].blocks[0].encoding,
        BlockStorageEncoding::Unknown
    );
}

struct HistoryFixture {
    _temp: TempDir,
    repository_path: PathBuf,
    hash_a: String,
    hash_b: String,
}

fn create_history_fixture() -> HistoryFixture {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("repo");
    RepositoryManager::create(&repository_path).unwrap();
    let hash_a = sha256_hex(b"alpha");
    let hash_b = sha256_hex(b"beta");
    let hash_c = sha256_hex(b"charlie");

    persist_snapshot(
        &repository_path,
        "snapshot-1",
        "Added",
        "2026-06-26T00:00:00Z",
        vec![snapshot_file(
            "notes.txt",
            "2026-06-26T00:00:00Z",
            &[(&hash_a, 5)],
        )],
    );
    persist_snapshot(
        &repository_path,
        "snapshot-2",
        "Timestamp only",
        "2026-06-27T00:00:00Z",
        vec![snapshot_file(
            "notes.txt",
            "2026-06-27T12:00:00Z",
            &[(&hash_a, 5)],
        )],
    );
    persist_snapshot(
        &repository_path,
        "snapshot-3",
        "Modified",
        "2026-06-28T00:00:00Z",
        vec![snapshot_file(
            "notes.txt",
            "2026-06-28T00:00:00Z",
            &[(&hash_a, 5), (&hash_a, 5), (&hash_b, 4)],
        )],
    );
    persist_snapshot(
        &repository_path,
        "snapshot-4",
        "Deleted",
        "2026-06-29T00:00:00Z",
        vec![],
    );
    persist_snapshot(
        &repository_path,
        "snapshot-5",
        "Re-added",
        "2026-06-30T00:00:00Z",
        vec![snapshot_file(
            "notes.txt",
            "2026-06-30T00:00:00Z",
            &[(&hash_c, 7)],
        )],
    );

    HistoryFixture {
        _temp: temp,
        repository_path,
        hash_a,
        hash_b,
    }
}

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

fn snapshot_file(relative_path: &str, modified_at: &str, blocks: &[(&str, u64)]) -> SnapshotFile {
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
        size_bytes: offset,
        modified_at: modified_at.to_string(),
        blocks: references,
    }
}
