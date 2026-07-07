use std::fs;
use std::io::Write;
use std::path::Path;

use chrona::commands::inventory_commands::get_repository_inventory;
use chrona::core::inventory_service::{classify_file_kind, InventoryService};
use chrona::core::repository::RepositoryManager;
use chrona::core::snapshot_service::SnapshotService;
use chrona::models::inventory::{FileKind, SnapshotPresenceState, SourceExistenceState};
use tempfile::TempDir;

fn write_file(path: &Path, bytes: &[u8]) {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    let mut file = fs::File::create(path).unwrap();
    file.write_all(bytes).unwrap();
}

#[test]
fn classifies_file_kind_from_extension() {
    assert_eq!(classify_file_kind("notes.md"), FileKind::Document);
    assert_eq!(classify_file_kind("photo.PNG"), FileKind::Image);
    assert_eq!(classify_file_kind("clip.mp4"), FileKind::Video);
    assert_eq!(classify_file_kind("main.rs"), FileKind::Code);
    assert_eq!(classify_file_kind("archive.zip"), FileKind::Archive);
    assert_eq!(classify_file_kind("README"), FileKind::Folderless);
    assert_eq!(classify_file_kind("unknown.custom"), FileKind::Unknown);
}

#[test]
fn inventory_reports_files_from_latest_snapshot() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("notes.md"), b"hello");
    write_file(&source_path.join("images/photo.png"), b"png bytes");

    SnapshotService::new()
        .create_snapshot(&repo_path, &source_path, "Initial", |_| {})
        .unwrap();

    let report = InventoryService::new()
        .get_repository_inventory(&repo_path)
        .unwrap();

    assert_eq!(report.snapshot_count, 1);
    assert_eq!(report.known_file_count, 2);
    assert_eq!(report.latest_file_count, 2);
    assert_eq!(report.deleted_in_latest_count, 0);
    assert_eq!(report.source_exists_count, 2);
    assert_eq!(report.total_original_bytes_latest, 14);
    assert_eq!(report.total_block_references_latest, 2);
    assert_eq!(report.unique_block_count_latest, 2);
    assert!(report.files.iter().any(|file| {
        file.relative_path == "notes.md"
            && file.snapshot_state == SnapshotPresenceState::PresentInLatest
            && file.source_state == SourceExistenceState::Exists
    }));
}

#[test]
fn inventory_distinguishes_deleted_in_latest_from_missing_source_file() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("kept.txt"), b"kept");
    write_file(&source_path.join("deleted.txt"), b"deleted");

    SnapshotService::new()
        .create_snapshot(&repo_path, &source_path, "Before delete", |_| {})
        .unwrap();

    fs::remove_file(source_path.join("deleted.txt")).unwrap();
    write_file(
        &source_path.join("missing-latest.txt"),
        b"will disappear after latest snapshot",
    );

    SnapshotService::new()
        .create_snapshot(&repo_path, &source_path, "After delete", |_| {})
        .unwrap();

    fs::remove_file(source_path.join("missing-latest.txt")).unwrap();

    let report = InventoryService::new()
        .get_repository_inventory(&repo_path)
        .unwrap();

    let deleted = report
        .files
        .iter()
        .find(|file| file.relative_path == "deleted.txt")
        .unwrap();
    assert_eq!(
        deleted.snapshot_state,
        SnapshotPresenceState::DeletedInLatest
    );
    assert_eq!(deleted.latest_size_bytes, None);
    assert_eq!(deleted.latest_modified_at, None);

    let missing_latest = report
        .files
        .iter()
        .find(|file| file.relative_path == "missing-latest.txt")
        .unwrap();
    assert_eq!(
        missing_latest.snapshot_state,
        SnapshotPresenceState::PresentInLatest
    );
    assert_eq!(missing_latest.source_state, SourceExistenceState::Missing);
}

#[test]
fn inventory_marks_source_root_missing_without_failing_report() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("gone.txt"), b"gone");

    SnapshotService::new()
        .create_snapshot(&repo_path, &source_path, "Source root", |_| {})
        .unwrap();
    fs::remove_dir_all(&source_path).unwrap();

    let report = InventoryService::new()
        .get_repository_inventory(&repo_path)
        .unwrap();

    assert_eq!(report.source_root_missing_count, 1);
    assert_eq!(
        report.files[0].source_state,
        SourceExistenceState::SourceRootMissing
    );
}

#[test]
fn inventory_handles_repository_without_snapshots() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    RepositoryManager::create(&repo_path).unwrap();

    let report = InventoryService::new()
        .get_repository_inventory(&repo_path)
        .unwrap();

    assert_eq!(report.snapshot_count, 0);
    assert_eq!(report.known_file_count, 0);
    assert_eq!(report.latest_file_count, 0);
    assert_eq!(report.deleted_in_latest_count, 0);
    assert!(report.kind_stats.is_empty());
    assert!(report.files.is_empty());
}

#[test]
fn inventory_checks_a_single_file_source() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("single.txt");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path, b"single source");

    SnapshotService::new()
        .create_snapshot(&repo_path, &source_path, "Single file", |_| {})
        .unwrap();

    let report = InventoryService::new()
        .get_repository_inventory(&repo_path)
        .unwrap();

    assert_eq!(report.known_file_count, 1);
    assert_eq!(report.source_exists_count, 1);
    assert_eq!(report.files[0].relative_path, "single.txt");
    assert_eq!(report.files[0].source_state, SourceExistenceState::Exists);
}

#[test]
fn inventory_command_returns_a_serializable_report() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    RepositoryManager::create(&repo_path).unwrap();

    let report = get_repository_inventory(repo_path.display().to_string()).unwrap();

    assert_eq!(report.schema_version, 1);
    assert_eq!(report.repository_path, repo_path.display().to_string());
}
