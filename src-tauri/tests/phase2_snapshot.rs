use std::fs;
use std::io::Write;
use std::path::Path;

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
