use std::fs;
use std::io::Write;
use std::path::Path;

use chrona::core::block_store::BlockStore;
use chrona::core::repository::RepositoryManager;
use chrona::core::restore_service::RestoreService;
use chrona::core::snapshot_service::SnapshotService;
use tempfile::TempDir;

fn write_file(path: &Path, bytes: &[u8]) {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    let mut file = fs::File::create(path).unwrap();
    file.write_all(bytes).unwrap();
}

fn read_file(path: &Path) -> Vec<u8> {
    fs::read(path).unwrap()
}

#[test]
fn restore_snapshot_recreates_files_from_stored_blocks() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    let target_path = temp.path().join("restore-target");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("root.txt"), b"root file");
    write_file(&source_path.join("child").join("note.txt"), b"nested file");
    write_file(&source_path.join("empty.bin"), b"");

    let snapshot = SnapshotService::new()
        .create_snapshot(&repo_path, &source_path, "Restore me", |_| {})
        .unwrap();

    let report = RestoreService::new()
        .restore_snapshot(&repo_path, &snapshot.id, &target_path)
        .unwrap();

    assert_eq!(report.snapshot_id, snapshot.id);
    assert_eq!(report.restored_file_count, 3);
    assert_eq!(report.restored_bytes, snapshot.summary.total_original_bytes);
    assert_eq!(read_file(&target_path.join("root.txt")), b"root file");
    assert_eq!(
        read_file(&target_path.join("child").join("note.txt")),
        b"nested file"
    );
    assert_eq!(read_file(&target_path.join("empty.bin")), b"");
}

#[test]
fn restore_rejects_target_inside_repository() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    let target_path = repo_path.join("restored");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("a.txt"), b"hello");
    let snapshot = SnapshotService::new()
        .create_snapshot(&repo_path, &source_path, "Unsafe target", |_| {})
        .unwrap();

    let error = RestoreService::new()
        .restore_snapshot(&repo_path, &snapshot.id, &target_path)
        .unwrap_err();

    assert!(error.to_string().contains("UnsafeRestoreTarget"));
}

#[test]
fn restore_rejects_non_empty_target_directory() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    let target_path = temp.path().join("restore-target");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("a.txt"), b"hello");
    write_file(&target_path.join("existing.txt"), b"do not overwrite");
    let snapshot = SnapshotService::new()
        .create_snapshot(&repo_path, &source_path, "Non-empty target", |_| {})
        .unwrap();

    let error = RestoreService::new()
        .restore_snapshot(&repo_path, &snapshot.id, &target_path)
        .unwrap_err();

    assert!(error.to_string().contains("UnsafeRestoreTarget"));
    assert_eq!(
        read_file(&target_path.join("existing.txt")),
        b"do not overwrite"
    );
}

#[test]
fn restore_fails_when_a_referenced_block_is_missing() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    let target_path = temp.path().join("restore-target");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("a.txt"), b"hello");
    let snapshot = SnapshotService::new()
        .create_snapshot(&repo_path, &source_path, "Missing block", |_| {})
        .unwrap();
    let block = &snapshot.files[0].blocks[0];
    let block_path = repo_path.join(BlockStore::block_relative_path(&block.hash).unwrap());
    fs::remove_file(block_path).unwrap();

    let error = RestoreService::new()
        .restore_snapshot(&repo_path, &snapshot.id, &target_path)
        .unwrap_err();

    assert!(error.to_string().contains("MissingBlock"));
}
