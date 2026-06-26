use chrona::commands::home_commands;
use chrona::core::access_index::AccessIndex;
use chrona::core::access_store::AccessStore;
use chrona::core::repository::RepositoryManager;
use chrona::models::access::{AccessEvent, AccessNodeKind};
use tempfile::TempDir;

fn event(key: &str, kind: AccessNodeKind, action: &str, accessed_at: &str) -> AccessEvent {
    AccessEvent {
        key: key.to_string(),
        kind,
        label: key.to_string(),
        path: Some(format!("/tmp/{key}")),
        repository_id: Some("repo-1".to_string()),
        snapshot_id: None,
        base_snapshot_id: None,
        target_snapshot_id: None,
        action: action.to_string(),
        accessed_at: accessed_at.to_string(),
    }
}

#[test]
fn access_record_inserts_and_splays_accessed_item_to_root() {
    let mut index = AccessIndex::new();

    index.record_access_event(event(
        "source:/tmp/alpha",
        AccessNodeKind::Source,
        "source_selected",
        "2026-06-26T00:00:00Z",
    ));
    index.record_access_event(event(
        "source:/tmp/beta",
        AccessNodeKind::Source,
        "source_selected",
        "2026-06-26T00:01:00Z",
    ));

    assert_eq!(index.root_key(), Some("source:/tmp/beta"));
    assert_eq!(index.len(), 2);
}

#[test]
fn repeated_access_updates_count_and_last_action() {
    let mut index = AccessIndex::new();

    index.record_access_event(event(
        "snapshot:snap-1",
        AccessNodeKind::Snapshot,
        "snapshot_created",
        "2026-06-26T00:00:00Z",
    ));
    let node = index.record_access_event(event(
        "snapshot:snap-1",
        AccessNodeKind::Snapshot,
        "snapshot_opened",
        "2026-06-26T00:03:00Z",
    ));

    assert_eq!(index.root_key(), Some("snapshot:snap-1"));
    assert_eq!(node.access_count, 2);
    assert_eq!(node.last_action, "snapshot_opened");
    assert_eq!(node.last_accessed_at, "2026-06-26T00:03:00Z");
}

#[test]
fn home_summary_ranks_pinned_items_before_recent_items() {
    let mut index = AccessIndex::new();

    index.record_access_event(event(
        "source:/tmp/recent",
        AccessNodeKind::Source,
        "source_selected",
        "2026-06-26T00:02:00Z",
    ));
    index.record_access_event(event(
        "source:/tmp/pinned",
        AccessNodeKind::Source,
        "source_selected",
        "2026-06-26T00:01:00Z",
    ));
    index.pin("source:/tmp/pinned").unwrap();

    let summary = index.home_summary(10);

    assert_eq!(summary.pinned[0].key, "source:/tmp/pinned");
    assert_eq!(summary.recent_sources[0].key, "source:/tmp/recent");
}

#[test]
fn clear_unpinned_history_preserves_pinned_items() {
    let mut index = AccessIndex::new();

    index.record_access_event(event(
        "source:/tmp/pinned",
        AccessNodeKind::Source,
        "source_selected",
        "2026-06-26T00:01:00Z",
    ));
    index.record_access_event(event(
        "source:/tmp/unpinned",
        AccessNodeKind::Source,
        "source_selected",
        "2026-06-26T00:02:00Z",
    ));
    index.pin("source:/tmp/pinned").unwrap();

    let removed = index.clear_unpinned();

    assert_eq!(removed, 1);
    assert_eq!(index.len(), 1);
    assert!(index.get("source:/tmp/pinned").unwrap().pinned);
}

#[test]
fn access_store_missing_index_loads_empty_and_persists_items() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    RepositoryManager::create(&repo_path).unwrap();
    let store = AccessStore::new(repo_path.clone());

    let mut index = store.load().unwrap();
    assert_eq!(index.len(), 0);

    index.record_access_event(event(
        "compare:base->target",
        AccessNodeKind::ComparePair,
        "compare_pair_opened",
        "2026-06-26T00:04:00Z",
    ));
    store.save(&index).unwrap();

    let reloaded = AccessStore::new(repo_path).load().unwrap();
    assert_eq!(reloaded.len(), 1);
    assert_eq!(reloaded.root_key(), Some("compare:base->target"));
    assert_eq!(
        reloaded
            .home_summary(10)
            .recent_compare_pairs
            .first()
            .unwrap()
            .key,
        "compare:base->target"
    );
}

#[test]
fn home_commands_record_pin_and_clear_access_history() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    RepositoryManager::create(&repo_path).unwrap();
    let repository_path = repo_path.to_string_lossy().to_string();

    let source_node = home_commands::record_access_event(
        repository_path.clone(),
        event(
            "source:/tmp/source",
            AccessNodeKind::Source,
            "source_selected",
            "2026-06-26T00:05:00Z",
        ),
    )
    .unwrap();
    assert_eq!(source_node.access_count, 1);

    home_commands::record_access_event(
        repository_path.clone(),
        event(
            "snapshot:snap-1",
            AccessNodeKind::Snapshot,
            "snapshot_opened",
            "2026-06-26T00:06:00Z",
        ),
    )
    .unwrap();

    let pinned =
        home_commands::pin_access_item(repository_path.clone(), "source:/tmp/source".to_string())
            .unwrap();
    assert!(pinned.pinned);

    let summary = home_commands::get_home_summary(repository_path.clone()).unwrap();
    assert_eq!(summary.continue_working.unwrap().key, "snapshot:snap-1");
    assert_eq!(summary.pinned[0].key, "source:/tmp/source");

    let cleared = home_commands::clear_access_history(repository_path.clone()).unwrap();
    assert_eq!(cleared.removed_count, 1);
    assert_eq!(cleared.remaining_count, 1);

    let summary = home_commands::get_home_summary(repository_path).unwrap();
    assert_eq!(summary.pinned.len(), 1);
    assert!(summary.recent_snapshots.is_empty());
}
