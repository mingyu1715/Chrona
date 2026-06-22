use std::collections::{BTreeMap, BTreeSet};

use crate::models::diff::{
    SnapshotBlockDiffSummary, SnapshotChangeType, SnapshotComparison, SnapshotComparisonSummary,
    SnapshotFileDiff, SnapshotFileDigest,
};
use crate::models::snapshot::{Snapshot, SnapshotFile};

pub struct DiffService;

impl DiffService {
    pub fn compare(base: &Snapshot, target: &Snapshot) -> SnapshotComparison {
        let base_files = files_by_path(base);
        let target_files = files_by_path(target);
        let paths = all_paths(&base_files, &target_files);
        let mut summary = SnapshotComparisonSummary::default();
        let mut files = Vec::with_capacity(paths.len());

        for path in paths {
            let before = base_files.get(path.as_str()).copied();
            let after = target_files.get(path.as_str()).copied();
            let change_type = classify_change(before, after);
            let blocks = diff_blocks(before, after);

            if let Some(file) = before {
                summary.total_before_bytes += file.size_bytes;
            }
            if let Some(file) = after {
                summary.total_after_bytes += file.size_bytes;
            }

            match change_type {
                SnapshotChangeType::Added => {
                    summary.added_file_count += 1;
                    summary.added_bytes += after.map_or(0, |file| file.size_bytes);
                }
                SnapshotChangeType::Deleted => {
                    summary.deleted_file_count += 1;
                    summary.deleted_bytes += before.map_or(0, |file| file.size_bytes);
                }
                SnapshotChangeType::Modified => {
                    summary.modified_file_count += 1;
                    summary.modified_before_bytes += before.map_or(0, |file| file.size_bytes);
                    summary.modified_after_bytes += after.map_or(0, |file| file.size_bytes);
                }
                SnapshotChangeType::Unchanged => {
                    summary.unchanged_file_count += 1;
                }
            }

            summary.added_block_references += blocks.added_block_references;
            summary.removed_block_references += blocks.removed_block_references;
            summary.shared_block_references += blocks.shared_block_references;

            files.push(SnapshotFileDiff {
                relative_path: path,
                change_type,
                before: before.map(digest_file),
                after: after.map(digest_file),
                blocks,
            });
        }

        SnapshotComparison {
            schema_version: 1,
            base_snapshot_id: base.id.clone(),
            target_snapshot_id: target.id.clone(),
            summary,
            files,
        }
    }
}

impl Default for DiffService {
    fn default() -> Self {
        Self
    }
}

fn files_by_path(snapshot: &Snapshot) -> BTreeMap<String, &SnapshotFile> {
    snapshot
        .files
        .iter()
        .map(|file| (file.relative_path.clone(), file))
        .collect()
}

fn all_paths(
    base_files: &BTreeMap<String, &SnapshotFile>,
    target_files: &BTreeMap<String, &SnapshotFile>,
) -> Vec<String> {
    base_files
        .keys()
        .chain(target_files.keys())
        .cloned()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

fn classify_change(
    before: Option<&SnapshotFile>,
    after: Option<&SnapshotFile>,
) -> SnapshotChangeType {
    match (before, after) {
        (None, Some(_)) => SnapshotChangeType::Added,
        (Some(_), None) => SnapshotChangeType::Deleted,
        (Some(before), Some(after)) if same_content(before, after) => SnapshotChangeType::Unchanged,
        (Some(_), Some(_)) => SnapshotChangeType::Modified,
        (None, None) => SnapshotChangeType::Unchanged,
    }
}

fn same_content(before: &SnapshotFile, after: &SnapshotFile) -> bool {
    before.size_bytes == after.size_bytes
        && before
            .blocks
            .iter()
            .map(|block| block.hash.as_str())
            .eq(after.blocks.iter().map(|block| block.hash.as_str()))
}

fn digest_file(file: &SnapshotFile) -> SnapshotFileDigest {
    SnapshotFileDigest {
        size_bytes: file.size_bytes,
        modified_at: file.modified_at.clone(),
        block_hashes: file.blocks.iter().map(|block| block.hash.clone()).collect(),
    }
}

fn diff_blocks(
    before: Option<&SnapshotFile>,
    after: Option<&SnapshotFile>,
) -> SnapshotBlockDiffSummary {
    let before_counts = block_counts(before);
    let after_counts = block_counts(after);
    let hashes = before_counts
        .keys()
        .chain(after_counts.keys())
        .copied()
        .collect::<BTreeSet<_>>();

    let mut summary = SnapshotBlockDiffSummary {
        before_block_references: before.map_or(0, |file| file.blocks.len() as u64),
        after_block_references: after.map_or(0, |file| file.blocks.len() as u64),
        ..SnapshotBlockDiffSummary::default()
    };

    for hash in hashes {
        let before_count = before_counts.get(hash).copied().unwrap_or(0);
        let after_count = after_counts.get(hash).copied().unwrap_or(0);
        summary.shared_block_references += before_count.min(after_count);
        summary.added_block_references += after_count.saturating_sub(before_count);
        summary.removed_block_references += before_count.saturating_sub(after_count);
    }

    summary
}

fn block_counts(file: Option<&SnapshotFile>) -> BTreeMap<&str, u64> {
    let mut counts = BTreeMap::new();
    if let Some(file) = file {
        for block in &file.blocks {
            *counts.entry(block.hash.as_str()).or_insert(0) += 1;
        }
    }
    counts
}
