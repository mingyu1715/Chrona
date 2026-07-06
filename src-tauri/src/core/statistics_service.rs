use std::collections::btree_map::Entry;
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;

use crate::core::block_store::BlockStore;
use crate::core::errors::ChronaResult;
use crate::core::inventory_service::classify_file_kind;
use crate::core::repository::RepositoryManager;
use crate::core::snapshot_store::SnapshotStore;
use crate::models::file_inspector::{BlockStorageEncoding, BlockStorageState};
use crate::models::inventory::{FileKind, FileKindStat};
use crate::models::snapshot::Snapshot;
use crate::models::statistics::{
    EncodingStatistics, RepositoryStatisticsOverview, RepositoryStatisticsProgress,
    RepositoryStatisticsReport, RepositoryStorageSummary, SnapshotStatisticsPoint, StatisticsIssue,
    StatisticsIssueKind,
};

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

    pub fn analyze_repository<F>(
        &self,
        repository_path: &Path,
        mut emit: F,
    ) -> ChronaResult<RepositoryStatisticsReport>
    where
        F: FnMut(RepositoryStatisticsProgress),
    {
        RepositoryManager::open(repository_path)?;
        let snapshot_store = SnapshotStore::new(repository_path.to_path_buf());
        let snapshot_items = snapshot_store.list_snapshots()?;
        let overview = match snapshot_items.first() {
            Some(item) => {
                let snapshot = snapshot_store.get_snapshot(&item.id)?;
                overview_from_snapshot(repository_path, &snapshot)
            }
            None => empty_overview(repository_path),
        };
        let total_snapshots = snapshot_items.len() as u64;
        let mut referenced_sizes = BTreeMap::<String, u64>::new();
        let mut issues = Vec::new();
        let mut snapshot_trend = Vec::with_capacity(snapshot_items.len());
        let mut retained_logical_bytes = 0_u64;
        let mut total_block_references = 0_u64;

        if snapshot_items.is_empty() {
            emit(progress("snapshots", 0, 0, 0, 0));
        }
        for (index, item) in snapshot_items.iter().rev().enumerate() {
            let snapshot = snapshot_store.get_snapshot(&item.id)?;
            let logical_bytes = snapshot.files.iter().map(|file| file.size_bytes).sum();
            let block_references = snapshot
                .files
                .iter()
                .map(|file| file.blocks.len() as u64)
                .sum();
            let mut snapshot_hashes = BTreeSet::new();

            for block in snapshot.files.iter().flat_map(|file| &file.blocks) {
                snapshot_hashes.insert(block.hash.clone());
                match referenced_sizes.entry(block.hash.clone()) {
                    Entry::Vacant(entry) => {
                        entry.insert(block.size_bytes);
                    }
                    Entry::Occupied(entry) if *entry.get() != block.size_bytes => {
                        issues.push(StatisticsIssue {
                            kind: StatisticsIssueKind::ConflictingRawSize,
                            hash: Some(block.hash.clone()),
                            path: None,
                            message: format!(
                                "block metadata reports raw sizes {} and {}",
                                entry.get(),
                                block.size_bytes
                            ),
                        });
                    }
                    Entry::Occupied(_) => {}
                }
            }

            retained_logical_bytes += logical_bytes;
            total_block_references += block_references;
            snapshot_trend.push(SnapshotStatisticsPoint {
                snapshot_id: snapshot.id,
                snapshot_name: snapshot.name,
                created_at: snapshot.created_at,
                file_count: snapshot.files.len() as u64,
                logical_bytes,
                total_block_references: block_references,
                unique_block_count: snapshot_hashes.len() as u64,
                new_block_count: snapshot.summary.new_block_count,
                reused_block_count: snapshot.summary.reused_block_count,
                new_logical_bytes: snapshot.summary.new_logical_bytes,
                new_stored_bytes: snapshot.summary.new_stored_bytes,
                compression_saved_bytes: snapshot.summary.compression_saved_bytes,
            });
            emit(progress(
                "snapshots",
                index as u64 + 1,
                total_snapshots,
                0,
                0,
            ));
        }

        let block_files = collect_final_block_files(&repository_path.join("blocks"))?;
        let mut all_physical_bytes = 0_u64;
        let mut unreferenced_block_count = 0_u64;
        let mut unreferenced_bytes = 0_u64;
        for path in &block_files {
            let size = fs::metadata(path)?.len();
            all_physical_bytes += size;
            let hash = block_hash_from_path(path);
            let is_referenced = hash
                .as_ref()
                .is_some_and(|hash| referenced_sizes.contains_key(hash));
            if !is_referenced {
                unreferenced_block_count += 1;
                unreferenced_bytes += size;
            }
            if hash.is_none() {
                issues.push(StatisticsIssue {
                    kind: StatisticsIssueKind::InvalidBlockFileName,
                    hash: None,
                    path: Some(path.display().to_string()),
                    message: "block filename is not a 64-character SHA-256 hash".to_string(),
                });
            }
        }

        let block_store = BlockStore::new(repository_path.to_path_buf());
        let total_blocks = referenced_sizes.len() as u64;
        let mut referenced_physical_block_count = 0_u64;
        let mut referenced_physical_bytes = 0_u64;
        let mut missing_referenced_block_count = 0_u64;
        let mut invalid_referenced_block_count = 0_u64;
        let mut compression_compared_raw_bytes = 0_u64;
        let mut compression_compared_physical_bytes = 0_u64;
        let mut encodings = EncodingStatistics::default();

        if referenced_sizes.is_empty() {
            emit(progress("blocks", total_snapshots, total_snapshots, 0, 0));
        }
        for (index, (hash, raw_size)) in referenced_sizes.iter().enumerate() {
            let canonical_path = repository_path.join(BlockStore::block_relative_path(hash)?);
            if let Ok(metadata) = fs::metadata(&canonical_path) {
                if metadata.is_file() {
                    referenced_physical_block_count += 1;
                    referenced_physical_bytes += metadata.len();
                }
            }

            let inspection = block_store.inspect_block(hash, *raw_size)?;
            match inspection.storage_state {
                BlockStorageState::Available => {
                    let stored_size = inspection.stored_size_bytes.unwrap_or(0);
                    compression_compared_raw_bytes += raw_size;
                    compression_compared_physical_bytes += stored_size;
                    record_encoding(&mut encodings, inspection.encoding, stored_size);
                }
                BlockStorageState::Missing => {
                    missing_referenced_block_count += 1;
                    issues.push(block_issue(
                        StatisticsIssueKind::MissingBlock,
                        hash,
                        &canonical_path,
                        inspection.issue,
                    ));
                }
                BlockStorageState::Unreadable => {
                    invalid_referenced_block_count += 1;
                    issues.push(block_issue(
                        StatisticsIssueKind::UnreadableBlock,
                        hash,
                        &canonical_path,
                        inspection.issue,
                    ));
                }
                BlockStorageState::InvalidHeader => {
                    invalid_referenced_block_count += 1;
                    issues.push(block_issue(
                        StatisticsIssueKind::InvalidHeader,
                        hash,
                        &canonical_path,
                        inspection.issue,
                    ));
                }
            }
            emit(progress(
                "blocks",
                total_snapshots,
                total_snapshots,
                index as u64 + 1,
                total_blocks,
            ));
        }

        let referenced_unique_raw_bytes = referenced_sizes.values().sum();
        let dedup_saved_bytes = retained_logical_bytes.saturating_sub(referenced_unique_raw_bytes);
        let compression_saved_bytes =
            compression_compared_raw_bytes.saturating_sub(compression_compared_physical_bytes);
        let storage_efficiency_percent =
            (missing_referenced_block_count == 0 && retained_logical_bytes > 0).then(|| {
                retained_logical_bytes.saturating_sub(all_physical_bytes) as f64
                    / retained_logical_bytes as f64
                    * 100.0
            });

        emit(progress(
            "completed",
            total_snapshots,
            total_snapshots,
            total_blocks,
            total_blocks,
        ));

        Ok(RepositoryStatisticsReport {
            schema_version: REPORT_SCHEMA_VERSION,
            repository_path: repository_path.display().to_string(),
            generated_at: Utc::now().to_rfc3339(),
            overview,
            storage: RepositoryStorageSummary {
                snapshot_count: total_snapshots,
                retained_logical_bytes,
                total_block_references,
                referenced_unique_block_count: referenced_sizes.len() as u64,
                referenced_unique_raw_bytes,
                dedup_saved_bytes,
                referenced_physical_block_count,
                referenced_physical_bytes,
                all_physical_block_count: block_files.len() as u64,
                all_physical_bytes,
                unreferenced_block_count,
                unreferenced_bytes,
                missing_referenced_block_count,
                invalid_referenced_block_count,
                compression_compared_raw_bytes,
                compression_compared_physical_bytes,
                compression_saved_bytes,
                storage_efficiency_percent,
            },
            encodings,
            snapshot_trend,
            issues,
        })
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

fn collect_final_block_files(root: &Path) -> ChronaResult<Vec<PathBuf>> {
    let mut files = Vec::new();
    collect_final_block_files_into(root, &mut files)?;
    files.sort();
    Ok(files)
}

fn collect_final_block_files_into(root: &Path, files: &mut Vec<PathBuf>) -> ChronaResult<()> {
    for entry in fs::read_dir(root)? {
        let path = entry?.path();
        if path.is_dir() {
            collect_final_block_files_into(&path, files)?;
        } else if path.extension().and_then(|value| value.to_str()) == Some("blk") {
            files.push(path);
        }
    }
    Ok(())
}

fn block_hash_from_path(path: &Path) -> Option<String> {
    let stem = path.file_stem()?.to_str()?;
    (stem.len() == 64 && stem.bytes().all(|byte| byte.is_ascii_hexdigit()))
        .then(|| stem.to_ascii_lowercase())
}

fn record_encoding(
    statistics: &mut EncodingStatistics,
    encoding: BlockStorageEncoding,
    physical_bytes: u64,
) {
    match encoding {
        BlockStorageEncoding::Raw => {
            statistics.raw_block_count += 1;
            statistics.raw_physical_bytes += physical_bytes;
        }
        BlockStorageEncoding::Zstd => {
            statistics.zstd_block_count += 1;
            statistics.zstd_physical_bytes += physical_bytes;
        }
        BlockStorageEncoding::Lz4 => {
            statistics.lz4_block_count += 1;
            statistics.lz4_physical_bytes += physical_bytes;
        }
        BlockStorageEncoding::Unknown => {
            statistics.unknown_block_count += 1;
            statistics.unknown_physical_bytes += physical_bytes;
        }
    }
}

fn block_issue(
    kind: StatisticsIssueKind,
    hash: &str,
    path: &Path,
    message: Option<String>,
) -> StatisticsIssue {
    StatisticsIssue {
        kind,
        hash: Some(hash.to_string()),
        path: Some(path.display().to_string()),
        message: message.unwrap_or_else(|| "block inspection failed".to_string()),
    }
}

fn progress(
    phase: &str,
    processed_snapshots: u64,
    total_snapshots: u64,
    processed_blocks: u64,
    total_blocks: u64,
) -> RepositoryStatisticsProgress {
    RepositoryStatisticsProgress {
        phase: phase.to_string(),
        processed_snapshots,
        total_snapshots,
        processed_blocks,
        total_blocks,
    }
}
