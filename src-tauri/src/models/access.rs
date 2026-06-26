use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AccessEvent {
    pub key: String,
    pub kind: AccessNodeKind,
    pub label: String,
    pub path: Option<String>,
    pub repository_id: Option<String>,
    pub snapshot_id: Option<String>,
    pub base_snapshot_id: Option<String>,
    pub target_snapshot_id: Option<String>,
    pub action: String,
    pub accessed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AccessNode {
    pub key: String,
    pub kind: AccessNodeKind,
    pub label: String,
    pub path: Option<String>,
    pub repository_id: Option<String>,
    pub snapshot_id: Option<String>,
    pub base_snapshot_id: Option<String>,
    pub target_snapshot_id: Option<String>,
    pub access_count: u64,
    pub last_accessed_at: String,
    pub last_action: String,
    pub pinned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum AccessNodeKind {
    Repository,
    Source,
    Folder,
    File,
    Snapshot,
    ComparePair,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HomeSummary {
    pub continue_working: Option<AccessNode>,
    pub pinned: Vec<AccessNode>,
    pub recent_repositories: Vec<AccessNode>,
    pub recent_sources: Vec<AccessNode>,
    pub recent_files: Vec<AccessNode>,
    pub recent_snapshots: Vec<AccessNode>,
    pub recent_compare_pairs: Vec<AccessNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AccessIndexDocument {
    pub schema_version: u32,
    pub updated_at: String,
    pub items: Vec<AccessNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AccessHistorySummary {
    pub schema_version: u32,
    pub removed_count: u64,
    pub remaining_count: u64,
}
