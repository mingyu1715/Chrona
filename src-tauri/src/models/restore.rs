use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RestoreReport {
    pub schema_version: u32,
    pub snapshot_id: String,
    pub target_path: String,
    pub restored_file_count: u64,
    pub restored_bytes: u64,
    pub restored_block_count: u64,
    pub files: Vec<RestoreFileResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RestoreFileResult {
    pub relative_path: String,
    pub size_bytes: u64,
    pub block_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OriginalLocationRestoreReport {
    pub schema_version: u32,
    pub snapshot_id: String,
    pub source_id: String,
    pub source_path: String,
    pub safety_snapshot_id: String,
    pub operation_id: String,
    pub restored_file_count: u64,
    pub restored_bytes: u64,
    pub restored_block_count: u64,
    pub quarantined_file_count: u64,
    pub files: Vec<RestoreFileResult>,
    pub quarantined_files: Vec<QuarantinedFileResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct QuarantinedFileResult {
    pub relative_path: String,
    pub quarantine_path: String,
}
