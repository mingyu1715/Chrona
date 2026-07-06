use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use chrono::Utc;

use crate::core::errors::ChronaResult;
use crate::core::inventory_service::classify_file_kind;
use crate::core::repository::RepositoryManager;
use crate::core::snapshot_store::SnapshotStore;
use crate::models::inventory::{FileKind, FileKindStat};
use crate::models::snapshot::Snapshot;
use crate::models::statistics::RepositoryStatisticsOverview;

const REPORT_SCHEMA_VERSION: u32 = 1;

pub struct StatisticsService;

impl StatisticsService {
    pub fn new() -> Self {
        Self
    }

    pub fn get_overview(
        &self,
        repository_path: &Path,
    ) -> ChronaResult<RepositoryStatisticsOverview> {
        RepositoryManager::open(repository_path)?;
        let store = SnapshotStore::new(repository_path.to_path_buf());
        let Some(item) = store.list_snapshots()?.into_iter().next() else {
            return Ok(empty_overview(repository_path));
        };
        let snapshot = store.get_snapshot(&item.id)?;
        Ok(overview_from_snapshot(repository_path, &snapshot))
    }
}

impl Default for StatisticsService {
    fn default() -> Self {
        Self::new()
    }
}

fn empty_overview(repository_path: &Path) -> RepositoryStatisticsOverview {
    RepositoryStatisticsOverview {
        schema_version: REPORT_SCHEMA_VERSION,
        repository_path: repository_path.display().to_string(),
        generated_at: Utc::now().to_rfc3339(),
        has_snapshot: false,
        latest_snapshot_id: None,
        latest_snapshot_name: None,
        latest_snapshot_created_at: None,
        latest_file_count: 0,
        latest_logical_bytes: 0,
        latest_unique_block_count: 0,
        file_kind_stats: Vec::new(),
    }
}

fn overview_from_snapshot(
    repository_path: &Path,
    snapshot: &Snapshot,
) -> RepositoryStatisticsOverview {
    let mut unique_hashes = BTreeSet::new();
    let mut kind_counts: BTreeMap<FileKind, (u64, u64)> = BTreeMap::new();
    let mut latest_logical_bytes = 0_u64;

    for file in &snapshot.files {
        latest_logical_bytes += file.size_bytes;
        unique_hashes.extend(file.blocks.iter().map(|block| block.hash.clone()));
        let kind = classify_file_kind(&file.relative_path);
        let stat = kind_counts.entry(kind).or_insert((0, 0));
        stat.0 += 1;
        stat.1 += file.size_bytes;
    }

    RepositoryStatisticsOverview {
        schema_version: REPORT_SCHEMA_VERSION,
        repository_path: repository_path.display().to_string(),
        generated_at: Utc::now().to_rfc3339(),
        has_snapshot: true,
        latest_snapshot_id: Some(snapshot.id.clone()),
        latest_snapshot_name: Some(snapshot.name.clone()),
        latest_snapshot_created_at: Some(snapshot.created_at.clone()),
        latest_file_count: snapshot.files.len() as u64,
        latest_logical_bytes,
        latest_unique_block_count: unique_hashes.len() as u64,
        file_kind_stats: kind_counts
            .into_iter()
            .map(|(kind, (file_count, total_bytes_latest))| FileKindStat {
                kind,
                file_count,
                total_bytes_latest,
            })
            .collect(),
    }
}
