use std::fs;
use std::path::{Path, PathBuf};

use chrona::core::block_store::BlockStore;
use chrona::core::hasher::sha256_hex;
use chrona::core::repository::RepositoryManager;
use chrona::core::snapshot_store::SnapshotStore;
use chrona::core::statistics_service::StatisticsService;
use chrona::models::block::BlockReference;
use chrona::models::inventory::FileKind;
use chrona::models::repository::CompressionMode;
use chrona::models::snapshot::{Snapshot, SnapshotFile, SnapshotSummary};
use chrona::models::statistics::{RepositoryStatisticsOverview, StatisticsIssueKind};
use tempfile::TempDir;

use chrona::commands::statistics_commands::get_repository_statistics_overview;

#[test]
fn statistics_overview_is_empty_without_snapshots() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("repo");
    RepositoryManager::create(&repository_path).unwrap();

    let report = StatisticsService::new()
        .get_overview(&repository_path)
        .unwrap();

    assert!(!report.has_snapshot);
    assert_eq!(report.latest_file_count, 0);
    assert_eq!(report.latest_logical_bytes, 0);
    assert_eq!(report.latest_unique_block_count, 0);
    assert!(report.file_kind_stats.is_empty());
}

#[test]
fn statistics_overview_uses_only_the_latest_snapshot() {
    let fixture = create_overview_fixture();

    let report = StatisticsService::new()
        .get_overview(&fixture.repository_path)
        .unwrap();

    assert!(report.has_snapshot);
    assert_eq!(report.latest_snapshot_id.as_deref(), Some("snapshot-2"));
    assert_eq!(report.latest_file_count, 3);
    assert_eq!(report.latest_logical_bytes, 18);
    assert_eq!(report.latest_unique_block_count, 2);
    assert_eq!(kind_count(&report, FileKind::Document), 1);
    assert_eq!(kind_count(&report, FileKind::Code), 1);
    assert_eq!(kind_count(&report, FileKind::Folderless), 1);
}

#[test]
fn statistics_command_returns_camel_case_overview() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("repo");
    RepositoryManager::create(&repository_path).unwrap();

    let overview =
        get_repository_statistics_overview(repository_path.display().to_string()).unwrap();
    let json = serde_json::to_value(overview).unwrap();

    assert!(json.get("latestFileCount").is_some());
    assert!(json.get("latestUniqueBlockCount").is_some());
    assert!(json.get("fileKindStats").is_some());
}

#[test]
fn full_statistics_calculates_logical_dedup_trend_and_progress() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("repo");
    RepositoryManager::create(&repository_path).unwrap();
    let hash_a = sha256_hex(b"aaaaaa");
    let hash_b = sha256_hex(b"bbbbbb");

    persist_snapshot(
        &repository_path,
        "snapshot-1",
        "Old",
        "2026-07-01T00:00:00Z",
        vec![
            snapshot_file("a.txt", &hash_a, 6),
            snapshot_file("copy.txt", &hash_a, 6),
        ],
    );
    persist_snapshot(
        &repository_path,
        "snapshot-2",
        "Latest",
        "2026-07-02T00:00:00Z",
        vec![
            snapshot_file("a.txt", &hash_a, 6),
            snapshot_file("b.txt", &hash_b, 6),
        ],
    );

    let mut phases = Vec::new();
    let report = StatisticsService::new()
        .analyze_repository(&repository_path, |progress| phases.push(progress.phase))
        .unwrap();

    assert_eq!(report.storage.snapshot_count, 2);
    assert_eq!(report.storage.retained_logical_bytes, 24);
    assert_eq!(report.storage.total_block_references, 4);
    assert_eq!(report.storage.referenced_unique_block_count, 2);
    assert_eq!(report.storage.referenced_unique_raw_bytes, 12);
    assert_eq!(report.storage.dedup_saved_bytes, 12);
    assert_eq!(report.snapshot_trend[0].snapshot_id, "snapshot-1");
    assert_eq!(report.snapshot_trend[1].snapshot_id, "snapshot-2");
    assert_eq!(phases.first().map(String::as_str), Some("snapshots"));
    assert!(phases.iter().any(|phase| phase == "blocks"));
    assert_eq!(phases.last().map(String::as_str), Some("completed"));
}

#[test]
fn full_statistics_reports_conflicting_raw_sizes_without_failing() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("repo");
    RepositoryManager::create(&repository_path).unwrap();
    let hash = sha256_hex(b"aaaaaa");

    persist_snapshot(
        &repository_path,
        "snapshot-1",
        "Conflict",
        "2026-07-01T00:00:00Z",
        vec![
            snapshot_file("a.txt", &hash, 6),
            snapshot_file("bad.txt", &hash, 7),
        ],
    );

    let report = StatisticsService::new()
        .analyze_repository(&repository_path, |_| {})
        .unwrap();

    assert!(report
        .issues
        .iter()
        .any(|issue| issue.kind == StatisticsIssueKind::ConflictingRawSize));
}

#[test]
fn full_statistics_separates_physical_encodings_and_unreferenced_blocks() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("repo");
    RepositoryManager::create(&repository_path).unwrap();
    let raw_bytes = b"rawraw".to_vec();
    let zstd_bytes = vec![b'z'; 1_048_576];
    let lz4_bytes = vec![b'l'; 1_048_576];
    let orphan_bytes = b"orphan".to_vec();
    let missing_bytes = b"missing".to_vec();
    let raw_hash = sha256_hex(&raw_bytes);
    let zstd_hash = sha256_hex(&zstd_bytes);
    let lz4_hash = sha256_hex(&lz4_bytes);
    let orphan_hash = sha256_hex(&orphan_bytes);
    let missing_hash = sha256_hex(&missing_bytes);

    BlockStore::with_compression_mode(repository_path.clone(), CompressionMode::Off)
        .store_block(&raw_hash, &raw_bytes, "raw")
        .unwrap();
    BlockStore::with_compression_mode(repository_path.clone(), CompressionMode::Standard)
        .store_block(&zstd_hash, &zstd_bytes, "zstd")
        .unwrap();
    BlockStore::with_compression_mode(repository_path.clone(), CompressionMode::Fast)
        .store_block(&lz4_hash, &lz4_bytes, "lz4")
        .unwrap();
    BlockStore::with_compression_mode(repository_path.clone(), CompressionMode::Off)
        .store_block(&orphan_hash, &orphan_bytes, "orphan")
        .unwrap();

    let invalid_dir = repository_path.join("blocks/invalid");
    fs::create_dir_all(&invalid_dir).unwrap();
    fs::write(invalid_dir.join("not-a-hash.blk"), b"invalid").unwrap();
    fs::write(invalid_dir.join("ignored.blk.tmp-operation"), b"temp").unwrap();

    persist_snapshot(
        &repository_path,
        "snapshot-1",
        "Physical",
        "2026-07-01T00:00:00Z",
        vec![
            snapshot_file("raw.bin", &raw_hash, raw_bytes.len() as u64),
            snapshot_file("standard.bin", &zstd_hash, zstd_bytes.len() as u64),
            snapshot_file("fast.bin", &lz4_hash, lz4_bytes.len() as u64),
            snapshot_file("missing.bin", &missing_hash, missing_bytes.len() as u64),
        ],
    );

    let report = StatisticsService::new()
        .analyze_repository(&repository_path, |_| {})
        .unwrap();

    assert_eq!(report.storage.all_physical_block_count, 5);
    assert_eq!(report.storage.referenced_physical_block_count, 3);
    assert_eq!(report.storage.unreferenced_block_count, 2);
    assert_eq!(report.storage.missing_referenced_block_count, 1);
    assert_eq!(report.encodings.raw_block_count, 1);
    assert_eq!(report.encodings.zstd_block_count, 1);
    assert_eq!(report.encodings.lz4_block_count, 1);
    assert!(report.storage.compression_saved_bytes > 0);
    assert_eq!(report.storage.storage_efficiency_percent, None);
    assert!(report
        .issues
        .iter()
        .any(|issue| issue.kind == StatisticsIssueKind::InvalidBlockFileName));
    assert!(report
        .issues
        .iter()
        .any(|issue| issue.kind == StatisticsIssueKind::MissingBlock));
}

fn kind_count(report: &RepositoryStatisticsOverview, kind: FileKind) -> u64 {
    report
        .file_kind_stats
        .iter()
        .find(|stat| stat.kind == kind)
        .map(|stat| stat.file_count)
        .unwrap_or(0)
}

struct OverviewFixture {
    _temp: TempDir,
    repository_path: PathBuf,
}

fn create_overview_fixture() -> OverviewFixture {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("repo");
    RepositoryManager::create(&repository_path).unwrap();
    let hash_a = sha256_hex(b"aaaaaa");
    let hash_b = sha256_hex(b"bbbbbb");

    persist_snapshot(
        &repository_path,
        "snapshot-1",
        "Old",
        "2026-07-01T00:00:00Z",
        vec![snapshot_file("old.txt", &hash_a, 6)],
    );
    persist_snapshot(
        &repository_path,
        "snapshot-2",
        "Latest",
        "2026-07-02T00:00:00Z",
        vec![
            snapshot_file("report.pdf", &hash_a, 6),
            snapshot_file("src/main.rs", &hash_a, 6),
            snapshot_file("README", &hash_b, 6),
        ],
    );

    OverviewFixture {
        _temp: temp,
        repository_path,
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

fn snapshot_file(relative_path: &str, hash: &str, size_bytes: u64) -> SnapshotFile {
    SnapshotFile {
        relative_path: relative_path.to_string(),
        size_bytes,
        modified_at: "2026-07-02T00:00:00Z".to_string(),
        blocks: vec![BlockReference {
            index: 0,
            offset: 0,
            size_bytes,
            hash: hash.to_string(),
            was_new: false,
        }],
    }
}
