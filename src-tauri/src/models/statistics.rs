use serde::{Deserialize, Serialize};

use crate::models::inventory::FileKindStat;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryStatisticsOverview {
    pub schema_version: u32,
    pub repository_path: String,
    pub generated_at: String,
    pub has_snapshot: bool,
    pub latest_snapshot_id: Option<String>,
    pub latest_snapshot_name: Option<String>,
    pub latest_snapshot_created_at: Option<String>,
    pub latest_file_count: u64,
    pub latest_logical_bytes: u64,
    pub latest_unique_block_count: u64,
    pub file_kind_stats: Vec<FileKindStat>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryStatisticsReport {
    pub schema_version: u32,
    pub repository_path: String,
    pub generated_at: String,
    pub overview: RepositoryStatisticsOverview,
    pub storage: RepositoryStorageSummary,
    pub encodings: EncodingStatistics,
    pub snapshot_trend: Vec<SnapshotStatisticsPoint>,
    pub issues: Vec<StatisticsIssue>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryStorageSummary {
    pub snapshot_count: u64,
    pub retained_logical_bytes: u64,
    pub total_block_references: u64,
    pub referenced_unique_block_count: u64,
    pub referenced_unique_raw_bytes: u64,
    pub dedup_saved_bytes: u64,
    pub referenced_physical_block_count: u64,
    pub referenced_physical_bytes: u64,
    pub all_physical_block_count: u64,
    pub all_physical_bytes: u64,
    pub unreferenced_block_count: u64,
    pub unreferenced_bytes: u64,
    pub missing_referenced_block_count: u64,
    pub invalid_referenced_block_count: u64,
    pub compression_compared_raw_bytes: u64,
    pub compression_compared_physical_bytes: u64,
    pub compression_saved_bytes: u64,
    pub storage_efficiency_percent: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotStatisticsPoint {
    pub snapshot_id: String,
    pub snapshot_name: String,
    pub created_at: String,
    pub file_count: u64,
    pub logical_bytes: u64,
    pub total_block_references: u64,
    pub unique_block_count: u64,
    pub new_block_count: u64,
    pub reused_block_count: u64,
    pub new_logical_bytes: u64,
    pub new_stored_bytes: u64,
    pub compression_saved_bytes: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EncodingStatistics {
    pub raw_block_count: u64,
    pub raw_physical_bytes: u64,
    pub zstd_block_count: u64,
    pub zstd_physical_bytes: u64,
    pub lz4_block_count: u64,
    pub lz4_physical_bytes: u64,
    pub unknown_block_count: u64,
    pub unknown_physical_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StatisticsIssue {
    pub kind: StatisticsIssueKind,
    pub hash: Option<String>,
    pub path: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum StatisticsIssueKind {
    MissingBlock,
    UnreadableBlock,
    InvalidHeader,
    InvalidBlockFileName,
    ConflictingRawSize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryStatisticsProgress {
    pub phase: String,
    pub processed_snapshots: u64,
    pub total_snapshots: u64,
    pub processed_blocks: u64,
    pub total_blocks: u64,
}
