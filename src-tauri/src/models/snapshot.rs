use serde::{Deserialize, Serialize};

use crate::models::block::BlockReference;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub source_root: String,
    pub summary: SnapshotSummary,
    pub files: Vec<SnapshotFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotSummary {
    pub file_count: u64,
    pub total_original_bytes: u64,
    pub total_block_references: u64,
    pub new_block_count: u64,
    pub reused_block_count: u64,
    pub new_stored_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotFile {
    pub relative_path: String,
    pub size_bytes: u64,
    pub modified_at: String,
    pub blocks: Vec<BlockReference>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotIndex {
    pub schema_version: u32,
    pub snapshots: Vec<SnapshotIndexItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotIndexItem {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub source_root: String,
    pub file_count: u64,
    pub total_original_bytes: u64,
    pub new_stored_bytes: u64,
}
