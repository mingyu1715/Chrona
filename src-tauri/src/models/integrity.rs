use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IntegrityReport {
    pub schema_version: u32,
    pub repository_path: String,
    pub checked_at: String,
    pub status: IntegrityStatus,
    pub snapshot_count: u64,
    pub file_count: u64,
    pub block_reference_count: u64,
    pub unique_block_count: u64,
    pub missing_block_count: u64,
    pub corrupt_block_count: u64,
    pub issues: Vec<IntegrityIssue>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum IntegrityStatus {
    Healthy,
    Warning,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IntegrityIssue {
    pub severity: IntegrityIssueSeverity,
    pub code: String,
    pub message: String,
    pub snapshot_id: Option<String>,
    pub relative_path: Option<String>,
    pub block_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum IntegrityIssueSeverity {
    Warning,
    Error,
}
