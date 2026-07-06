use std::path::{Path, PathBuf};

use chrona::core::hasher::sha256_hex;
use chrona::core::repository::RepositoryManager;
use chrona::core::snapshot_store::SnapshotStore;
use chrona::core::statistics_service::StatisticsService;
use chrona::models::block::BlockReference;
use chrona::models::inventory::FileKind;
use chrona::models::snapshot::{Snapshot, SnapshotFile, SnapshotSummary};
use chrona::models::statistics::RepositoryStatisticsOverview;
use tempfile::TempDir;

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
