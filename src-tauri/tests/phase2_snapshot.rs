use std::fs;
use std::io::Write;
use std::path::Path;
use std::thread;
use std::time::Duration;

use chrona::core::repository::RepositoryManager;
use chrona::core::snapshot_service::SnapshotService;
use chrona::core::snapshot_store::SnapshotStore;
use tempfile::TempDir;

fn write_file(path: &Path, bytes: &[u8]) {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    let mut file = fs::File::create(path).unwrap();
    file.write_all(bytes).unwrap();
}

#[test]
fn create_snapshot_writes_snapshot_file_and_index() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("a.txt"), b"hello");

    let snapshot = SnapshotService::new()
        .create_snapshot(&repo_path, &source_path, "Initial import", |_| {})
        .unwrap();

    assert_eq!(snapshot.name, "Initial import");
    assert_eq!(snapshot.summary.file_count, 1);
    assert!(repo_path
        .join("snapshots")
        .join(format!("{}.json", snapshot.id))
        .is_file());
    assert!(repo_path
        .join("indexes")
        .join("snapshot-index.json")
        .is_file());
}

#[test]
fn snapshot_store_rejects_path_traversal_ids() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    RepositoryManager::create(&repo_path).unwrap();

    let error = SnapshotStore::new(repo_path)
        .get_snapshot("../escape")
        .unwrap_err();

    assert!(error.to_string().contains("InvalidSnapshotId"));
}

#[test]
fn second_snapshot_reuses_existing_blocks() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("a.txt"), b"hello");

    let service = SnapshotService::new();
    let first = service
        .create_snapshot(&repo_path, &source_path, "First", |_| {})
        .unwrap();
    let second = service
        .create_snapshot(&repo_path, &source_path, "Second", |_| {})
        .unwrap();

    assert_eq!(first.summary.new_block_count, 1);
    assert_eq!(second.summary.new_block_count, 0);
    assert_eq!(second.summary.reused_block_count, 1);
}

#[test]
fn list_snapshots_returns_newest_first_items() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("a.txt"), b"hello");

    let service = SnapshotService::new();
    let first = service
        .create_snapshot(&repo_path, &source_path, "First", |_| {})
        .unwrap();
    thread::sleep(Duration::from_millis(5));
    let second = service
        .create_snapshot(&repo_path, &source_path, "Second", |_| {})
        .unwrap();

    let snapshots = service.list_snapshots(&repo_path).unwrap();

    assert_eq!(snapshots.len(), 2);
    assert_eq!(snapshots[0].id, second.id);
    assert_eq!(snapshots[1].id, first.id);
}

#[test]
fn get_snapshot_returns_details_and_missing_snapshot_errors() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("nested").join("a.txt"), b"hello");

    let service = SnapshotService::new();
    let created = service
        .create_snapshot(&repo_path, &source_path, "Details", |_| {})
        .unwrap();

    let loaded = service.get_snapshot(&repo_path, &created.id).unwrap();
    let missing = service
        .get_snapshot(&repo_path, "missing_snapshot")
        .unwrap_err();

    assert_eq!(loaded.id, created.id);
    assert_eq!(loaded.files.len(), 1);
    assert_eq!(loaded.files[0].relative_path, "nested/a.txt");
    assert!(missing.to_string().contains("SnapshotNotFound"));
}

#[test]
fn opening_existing_phase1_repository_creates_snapshot_layout() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    RepositoryManager::create(&repo_path).unwrap();
    fs::remove_dir_all(repo_path.join("snapshots")).unwrap();
    fs::remove_file(repo_path.join("indexes").join("snapshot-index.json")).unwrap();

    RepositoryManager::open(&repo_path).unwrap();

    assert!(repo_path.join("snapshots").is_dir());
    assert!(repo_path
        .join("indexes")
        .join("snapshot-index.json")
        .is_file());
}
