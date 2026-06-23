use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotComparison {
    pub schema_version: u32,
    pub base_snapshot_id: String,
    pub target_snapshot_id: String,
    pub summary: SnapshotComparisonSummary,
    pub files: Vec<SnapshotFileDiff>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotComparisonSummary {
    pub added_file_count: u64,
    pub deleted_file_count: u64,
    pub modified_file_count: u64,
    pub unchanged_file_count: u64,
    pub total_before_bytes: u64,
    pub total_after_bytes: u64,
    pub added_bytes: u64,
    pub deleted_bytes: u64,
    pub modified_before_bytes: u64,
    pub modified_after_bytes: u64,
    pub added_block_references: u64,
    pub removed_block_references: u64,
    pub shared_block_references: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotFileDiff {
    pub relative_path: String,
    pub change_type: SnapshotChangeType,
    pub before: Option<SnapshotFileDigest>,
    pub after: Option<SnapshotFileDigest>,
    pub blocks: SnapshotBlockDiffSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotFileDigest {
    pub size_bytes: u64,
    pub modified_at: String,
    pub block_hashes: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotBlockDiffSummary {
    pub before_block_references: u64,
    pub after_block_references: u64,
    pub added_block_references: u64,
    pub removed_block_references: u64,
    pub shared_block_references: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SnapshotChangeType {
    Added,
    Deleted,
    Modified,
    Unchanged,
}
