use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SourceStatus {
    Available,
    Missing,
}

impl Default for SourceStatus {
    fn default() -> Self {
        Self::Available
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BackupSource {
    pub id: String,
    pub display_name: String,
    pub path: String,
    pub created_at: String,
    pub updated_at: String,
    pub latest_snapshot_id: Option<String>,
    pub latest_snapshot_at: Option<String>,
    pub snapshot_count: u64,
    #[serde(default)]
    pub status: SourceStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SourceIndex {
    pub schema_version: u32,
    pub sources: Vec<BackupSource>,
}
