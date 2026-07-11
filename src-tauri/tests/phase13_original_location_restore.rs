use std::fs;
use std::io::Write;
use std::path::Path;

use chrona::core::repository::RepositoryManager;
use chrona::core::restore_service::RestoreService;
use chrona::core::snapshot_service::SnapshotService;
use chrona::core::source_store::SourceStore;
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
fn restore_to_source_creates_safety_snapshot_restores_files_and_quarantines_extra_files() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("keep.txt"), b"old");
    write_file(&source_path.join("nested").join("note.txt"), b"nested old");

    let snapshot_service = SnapshotService::new();
    let target = snapshot_service
        .create_snapshot(&repo_path, &source_path, "Target point", |_| {})
        .unwrap();
    let source_id = target.source_id.clone().unwrap();
    write_file(&source_path.join("keep.txt"), b"new");
    write_file(&source_path.join("nested").join("note.txt"), b"nested new");
    write_file(&source_path.join("extra.txt"), b"not in target");

    let report = RestoreService::new()
        .restore_snapshot_to_source(&repo_path, &source_id, &target.id)
        .unwrap();

    assert_eq!(report.snapshot_id, target.id);
    assert_ne!(report.safety_snapshot_id, target.id);
    assert_eq!(report.restored_file_count, 2);
    assert_eq!(report.quarantined_file_count, 1);
    assert_eq!(read_file(&source_path.join("keep.txt")), b"old");
    assert_eq!(
        read_file(&source_path.join("nested").join("note.txt")),
        b"nested old"
    );
    assert!(!source_path.join("extra.txt").exists());
    assert_eq!(
        read_file(
            &source_path
                .join(".chrona-quarantine")
                .join(&report.operation_id)
                .join("extra.txt"),
        ),
        b"not in target"
    );

    let snapshots = snapshot_service.list_snapshots(&repo_path).unwrap();
    assert!(snapshots
        .iter()
        .any(|snapshot| snapshot.id == report.safety_snapshot_id));
    let sources = SourceStore::new(repo_path).list_sources().unwrap();
    assert_eq!(sources.sources[0].snapshot_count, 2);
}

#[test]
fn restore_to_source_rejects_snapshot_from_another_source_without_changing_files() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_a = temp.path().join("source-a");
    let source_b = temp.path().join("source-b");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_a.join("a.txt"), b"a");
    write_file(&source_b.join("b.txt"), b"b");

    let snapshot_service = SnapshotService::new();
    let snapshot_a = snapshot_service
        .create_snapshot(&repo_path, &source_a, "A", |_| {})
        .unwrap();
    let snapshot_b = snapshot_service
        .create_snapshot(&repo_path, &source_b, "B", |_| {})
        .unwrap();
    let source_b_id = snapshot_b.source_id.clone().unwrap();

    let error = RestoreService::new()
        .restore_snapshot_to_source(&repo_path, &source_b_id, &snapshot_a.id)
        .unwrap_err();

    assert!(error.to_string().contains("Restore"));
    assert_eq!(read_file(&source_b.join("b.txt")), b"b");
    assert!(!source_b.join(".chrona-quarantine").exists());
    assert_eq!(
        SourceStore::new(repo_path)
            .list_sources()
            .unwrap()
            .sources
            .iter()
            .find(|source| source.id == source_b_id)
            .unwrap()
            .snapshot_count,
        1,
    );
}
