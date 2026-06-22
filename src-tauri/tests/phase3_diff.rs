use std::collections::HashMap;

use chrona::core::diff_service::DiffService;
use chrona::models::block::BlockReference;
use chrona::models::diff::SnapshotChangeType;
use chrona::models::snapshot::{Snapshot, SnapshotFile, SnapshotSummary};

fn block(index: u64, hash: &str) -> BlockReference {
    BlockReference {
        index,
        offset: index * 1_048_576,
        size_bytes: 1,
        hash: hash.to_string(),
        was_new: false,
    }
}

fn file(relative_path: &str, size_bytes: u64, hashes: &[&str]) -> SnapshotFile {
    SnapshotFile {
        relative_path: relative_path.to_string(),
        size_bytes,
        modified_at: "2026-06-23T00:00:00Z".to_string(),
        blocks: hashes
            .iter()
            .enumerate()
            .map(|(index, hash)| block(index as u64, hash))
            .collect(),
    }
}

fn snapshot(id: &str, files: Vec<SnapshotFile>) -> Snapshot {
    Snapshot {
        schema_version: 1,
        id: id.to_string(),
        name: id.to_string(),
        created_at: "2026-06-23T00:00:00Z".to_string(),
        source_root: "/tmp/source".to_string(),
        summary: SnapshotSummary {
            file_count: files.len() as u64,
            total_original_bytes: files.iter().map(|file| file.size_bytes).sum(),
            total_block_references: files.iter().map(|file| file.blocks.len() as u64).sum(),
            new_block_count: 0,
            reused_block_count: 0,
            new_stored_bytes: 0,
        },
        files,
    }
}

#[test]
fn phase3_diff_classifies_files_by_path_and_block_sequence() {
    let base = snapshot(
        "base",
        vec![
            file("deleted.txt", 8, &["deleted"]),
            file("modified.txt", 8, &["old"]),
            file("same.txt", 4, &["same"]),
        ],
    );
    let target = snapshot(
        "target",
        vec![
            file("added.txt", 6, &["added"]),
            file("modified.txt", 8, &["new"]),
            file("same.txt", 4, &["same"]),
        ],
    );

    let comparison = DiffService::compare(&base, &target);

    assert_eq!(comparison.base_snapshot_id, "base");
    assert_eq!(comparison.target_snapshot_id, "target");
    assert_eq!(comparison.summary.added_file_count, 1);
    assert_eq!(comparison.summary.deleted_file_count, 1);
    assert_eq!(comparison.summary.modified_file_count, 1);
    assert_eq!(comparison.summary.unchanged_file_count, 1);
    assert_eq!(comparison.summary.total_before_bytes, 20);
    assert_eq!(comparison.summary.total_after_bytes, 18);
    assert_eq!(comparison.summary.added_bytes, 6);
    assert_eq!(comparison.summary.deleted_bytes, 8);
    assert_eq!(comparison.summary.modified_before_bytes, 8);
    assert_eq!(comparison.summary.modified_after_bytes, 8);

    let paths: Vec<_> = comparison
        .files
        .iter()
        .map(|file| file.relative_path.as_str())
        .collect();
    assert_eq!(
        paths,
        vec!["added.txt", "deleted.txt", "modified.txt", "same.txt"]
    );

    let by_path: HashMap<_, _> = comparison
        .files
        .iter()
        .map(|file| (file.relative_path.as_str(), &file.change_type))
        .collect();

    assert_eq!(by_path["added.txt"], &SnapshotChangeType::Added);
    assert_eq!(by_path["deleted.txt"], &SnapshotChangeType::Deleted);
    assert_eq!(by_path["modified.txt"], &SnapshotChangeType::Modified);
    assert_eq!(by_path["same.txt"], &SnapshotChangeType::Unchanged);
}

#[test]
fn phase3_diff_counts_duplicate_block_references_as_multisets() {
    let base = snapshot("base", vec![file("repeated.bin", 3, &["a", "a", "b"])]);
    let target = snapshot(
        "target",
        vec![file("repeated.bin", 4, &["a", "b", "b", "c"])],
    );

    let comparison = DiffService::compare(&base, &target);
    let file_diff = comparison
        .files
        .iter()
        .find(|file| file.relative_path == "repeated.bin")
        .unwrap();

    assert_eq!(file_diff.change_type, SnapshotChangeType::Modified);
    assert_eq!(file_diff.blocks.shared_block_references, 2);
    assert_eq!(file_diff.blocks.added_block_references, 2);
    assert_eq!(file_diff.blocks.removed_block_references, 1);
    assert_eq!(comparison.summary.shared_block_references, 2);
    assert_eq!(comparison.summary.added_block_references, 2);
    assert_eq!(comparison.summary.removed_block_references, 1);
}
