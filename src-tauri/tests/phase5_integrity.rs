use std::fs;
use std::io::Write;
use std::path::Path;

use chrona::core::block_store::BlockStore;
use chrona::core::integrity_service::IntegrityService;
use chrona::core::repository::RepositoryManager;
use chrona::core::snapshot_service::SnapshotService;
use chrona::models::integrity::IntegrityStatus;
use tempfile::TempDir;

fn write_file(path: &Path, bytes: &[u8]) {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    let mut file = fs::File::create(path).unwrap();
    file.write_all(bytes).unwrap();
}

#[test]
fn integrity_reports_healthy_repository() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("root.txt"), b"hello");
    write_file(&source_path.join("child").join("note.txt"), b"nested");

    SnapshotService::new()
        .create_snapshot(&repo_path, &source_path, "Healthy", |_| {})
        .unwrap();

    let report = IntegrityService::new()
        .verify_repository(&repo_path)
        .unwrap();

    assert_eq!(report.status, IntegrityStatus::Healthy);
    assert_eq!(report.snapshot_count, 1);
    assert_eq!(report.file_count, 2);
    assert_eq!(report.missing_block_count, 0);
    assert_eq!(report.corrupt_block_count, 0);
    assert!(report.issues.is_empty());
}

#[test]
fn integrity_reports_missing_referenced_block() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("a.txt"), b"hello");
    let snapshot = SnapshotService::new()
        .create_snapshot(&repo_path, &source_path, "Missing block", |_| {})
        .unwrap();
    let block = &snapshot.files[0].blocks[0];
    let block_path = repo_path.join(BlockStore::block_relative_path(&block.hash).unwrap());
    fs::remove_file(block_path).unwrap();

    let report = IntegrityService::new()
        .verify_repository(&repo_path)
        .unwrap();

    assert_eq!(report.status, IntegrityStatus::Failed);
    assert_eq!(report.missing_block_count, 1);
    assert_eq!(report.corrupt_block_count, 0);
    assert!(report
        .issues
        .iter()
        .any(|issue| issue.code == "missingBlock"));
}

#[test]
fn integrity_reports_corrupt_referenced_block() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("a.txt"), b"hello");
    let snapshot = SnapshotService::new()
        .create_snapshot(&repo_path, &source_path, "Corrupt block", |_| {})
        .unwrap();
    let block = &snapshot.files[0].blocks[0];
    let block_path = repo_path.join(BlockStore::block_relative_path(&block.hash).unwrap());
    write_file(&block_path, b"changed");

    let report = IntegrityService::new()
        .verify_repository(&repo_path)
        .unwrap();

    assert_eq!(report.status, IntegrityStatus::Failed);
    assert_eq!(report.missing_block_count, 0);
    assert_eq!(report.corrupt_block_count, 1);
    assert!(report
        .issues
        .iter()
        .any(|issue| issue.code == "blockHashMismatch"));
}
