use std::path::Path;

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::core::block_ingest_service::BlockIngestService;
use crate::core::diff_service::DiffService;
use crate::core::errors::{ChronaError, ChronaResult};
use crate::core::repository::RepositoryManager;
use crate::core::snapshot_store::SnapshotStore;
use crate::models::diff::SnapshotComparison;
use crate::models::progress::BlockIngestProgress;
use crate::models::snapshot::{Snapshot, SnapshotFile, SnapshotIndexItem, SnapshotSummary};

pub struct SnapshotService;

impl SnapshotService {
    pub fn new() -> Self {
        Self
    }

    pub fn create_snapshot<F>(
        &self,
        repository_path: &Path,
        source_path: &Path,
        name: &str,
        on_progress: F,
    ) -> ChronaResult<Snapshot>
    where
        F: FnMut(BlockIngestProgress),
    {
        RepositoryManager::open(repository_path)?;
        let store = SnapshotStore::new(repository_path.to_path_buf());
        store.ensure_layout()?;

        let source_root = source_path
            .canonicalize()?
            .to_str()
            .ok_or_else(|| {
                ChronaError::UnsafeRelativePath(format!(
                    "source path is not valid UTF-8: {}",
                    source_path.display()
                ))
            })?
            .to_string();

        let summary =
            BlockIngestService::new().ingest(repository_path, source_path, on_progress)?;
        let created_at = Utc::now();
        let snapshot = Snapshot {
            schema_version: 1,
            id: generate_snapshot_id(created_at),
            name: normalize_snapshot_name(name),
            created_at: created_at.to_rfc3339(),
            source_root,
            summary: SnapshotSummary {
                file_count: summary.file_count,
                total_original_bytes: summary.total_input_bytes,
                total_block_references: summary.total_block_references,
                new_block_count: summary.new_block_count,
                reused_block_count: summary.reused_block_count,
                new_stored_bytes: summary.newly_stored_bytes,
                new_logical_bytes: summary.new_logical_bytes,
                compression_saved_bytes: summary.compression_saved_bytes,
                new_raw_block_count: summary.new_raw_block_count,
                new_zstd_block_count: summary.new_zstd_block_count,
                new_lz4_block_count: summary.new_lz4_block_count,
            },
            files: summary
                .files
                .into_iter()
                .map(|file| SnapshotFile {
                    relative_path: file.relative_path,
                    size_bytes: file.size_bytes,
                    modified_at: file.modified_at,
                    blocks: file.blocks,
                })
                .collect(),
        };

        store.write_snapshot(&snapshot)?;
        store.add_to_index(&snapshot)?;
        Ok(snapshot)
    }

    pub fn list_snapshots(&self, repository_path: &Path) -> ChronaResult<Vec<SnapshotIndexItem>> {
        RepositoryManager::open(repository_path)?;
        SnapshotStore::new(repository_path.to_path_buf()).list_snapshots()
    }

    pub fn get_snapshot(
        &self,
        repository_path: &Path,
        snapshot_id: &str,
    ) -> ChronaResult<Snapshot> {
        RepositoryManager::open(repository_path)?;
        SnapshotStore::new(repository_path.to_path_buf()).get_snapshot(snapshot_id)
    }

    pub fn compare_snapshots(
        &self,
        repository_path: &Path,
        base_snapshot_id: &str,
        target_snapshot_id: &str,
    ) -> ChronaResult<SnapshotComparison> {
        RepositoryManager::open(repository_path)?;
        let store = SnapshotStore::new(repository_path.to_path_buf());
        let base = store.get_snapshot(base_snapshot_id)?;
        let target = store.get_snapshot(target_snapshot_id)?;
        Ok(DiffService::compare(&base, &target))
    }
}

impl Default for SnapshotService {
    fn default() -> Self {
        Self::new()
    }
}

fn normalize_snapshot_name(name: &str) -> String {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        "Untitled Snapshot".to_string()
    } else {
        trimmed.to_string()
    }
}

fn generate_snapshot_id(created_at: DateTime<Utc>) -> String {
    let prefix = created_at.format("%Y%m%dT%H%M%SZ");
    let suffix = Uuid::new_v4().to_string()[0..6].to_string();
    format!("{prefix}_{suffix}")
}
