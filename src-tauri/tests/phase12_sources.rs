use std::fs;
use std::io::Write;
use std::path::Path;

use chrona::core::repository::RepositoryManager;
use chrona::core::snapshot_service::SnapshotService;
use chrona::core::source_store::SourceStore;
use chrona::models::source::SourceStatus;
use tempfile::TempDir;

fn write_file(path: &Path, bytes: &[u8]) {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    let mut file = fs::File::create(path).unwrap();
    file.write_all(bytes).unwrap();
}

#[test]
fn find_or_create_source_reuses_the_same_canonical_path() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("Documents");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("a.txt"), b"hello");

    let store = SourceStore::new(repo_path.clone());
    let first = store.find_or_create_for_path(&source_path).unwrap();
    let second = store.find_or_create_for_path(&source_path).unwrap();
    let index = store.list_sources().unwrap();

    assert_eq!(first.id, second.id);
    assert_eq!(first.display_name, "Documents");
    assert_eq!(index.sources.len(), 1);
    assert_eq!(index.sources[0].snapshot_count, 0);
    assert_eq!(index.sources[0].status, SourceStatus::Available);
}

#[test]
fn snapshots_are_attached_to_the_reused_source_id() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("a.txt"), b"hello");

    let service = SnapshotService::new();
    let first = service
        .create_snapshot(&repo_path, &source_path, "First", |_| {})
        .unwrap();
    write_file(&source_path.join("b.txt"), b"world");
    let second = service
        .create_snapshot(&repo_path, &source_path, "Second", |_| {})
        .unwrap();

    let source_id = first.source_id.expect("new snapshots have source id");
    assert_eq!(second.source_id.as_deref(), Some(source_id.as_str()));

    let sources = SourceStore::new(repo_path.clone()).list_sources().unwrap();
    assert_eq!(sources.sources.len(), 1);
    assert_eq!(sources.sources[0].id, source_id);
    assert_eq!(
        sources.sources[0].latest_snapshot_id,
        Some(second.id.clone())
    );
    assert_eq!(sources.sources[0].snapshot_count, 2);

    let snapshot_items = service.list_snapshots(&repo_path).unwrap();
    assert_eq!(
        snapshot_items[0].source_id.as_deref(),
        Some(source_id.as_str())
    );
    assert_eq!(
        snapshot_items[1].source_id.as_deref(),
        Some(source_id.as_str())
    );
}

#[test]
fn source_status_reports_missing_paths_without_losing_identity() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("a.txt"), b"hello");

    let store = SourceStore::new(repo_path);
    let source = store.find_or_create_for_path(&source_path).unwrap();
    fs::remove_dir_all(&source_path).unwrap();

    let sources = store.list_sources().unwrap();

    assert_eq!(sources.sources[0].id, source.id);
    assert_eq!(sources.sources[0].status, SourceStatus::Missing);
}

#[test]
fn deleting_snapshots_refreshes_source_snapshot_counts() {
    let temp = tempfile::tempdir().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    fs::create_dir_all(&source_path).unwrap();
    write_file(&source_path.join("a.txt"), b"hello");

    let service = SnapshotService::new();
    let first = service
        .create_snapshot(&repo_path, &source_path, "First", |_| {})
        .unwrap();
    write_file(&source_path.join("b.txt"), b"world");
    let second = service
        .create_snapshot(&repo_path, &source_path, "Second", |_| {})
        .unwrap();

    service.delete_snapshot(&repo_path, &first.id).unwrap();

    let sources = SourceStore::new(repo_path.clone()).list_sources().unwrap();
    assert_eq!(sources.sources[0].snapshot_count, 1);
    assert_eq!(
        sources.sources[0].latest_snapshot_id.as_deref(),
        Some(second.id.as_str())
    );
    assert!(!repo_path
        .join("snapshots")
        .join(format!("{}.json", first.id))
        .exists());

    service.delete_snapshot(&repo_path, &second.id).unwrap();

    let sources = SourceStore::new(repo_path).list_sources().unwrap();
    assert_eq!(sources.sources[0].snapshot_count, 0);
    assert_eq!(sources.sources[0].latest_snapshot_id, None);
    assert_eq!(sources.sources[0].latest_snapshot_at, None);
}
