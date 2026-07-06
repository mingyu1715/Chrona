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
