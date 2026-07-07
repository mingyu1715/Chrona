use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryInventoryReport {
    pub schema_version: u32,
    pub repository_path: String,
    pub generated_at: String,
    pub snapshot_count: u64,
    pub known_file_count: u64,
    pub latest_file_count: u64,
    pub deleted_in_latest_count: u64,
    pub source_exists_count: u64,
    pub source_missing_count: u64,
    pub source_root_missing_count: u64,
    pub total_original_bytes_latest: u64,
    pub total_block_references_latest: u64,
    pub unique_block_count_latest: u64,
    pub kind_stats: Vec<FileKindStat>,
    pub files: Vec<InventoryFileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileKindStat {
    pub kind: FileKind,
    pub file_count: u64,
    pub total_bytes_latest: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InventoryFileEntry {
    pub relative_path: String,
    pub file_name: String,
    pub extension: Option<String>,
    pub kind: FileKind,
    pub snapshot_state: SnapshotPresenceState,
    pub source_state: SourceExistenceState,
    pub latest_size_bytes: Option<u64>,
    pub latest_modified_at: Option<String>,
    pub first_seen_snapshot_id: String,
    pub first_seen_at: String,
    pub last_seen_snapshot_id: String,
    pub last_seen_at: String,
    pub seen_in_snapshot_count: u64,
    pub block_reference_count_latest: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[serde(rename_all = "camelCase")]
pub enum FileKind {
    Document,
    Image,
    Video,
    Audio,
    Archive,
    Code,
    Text,
    Data,
    Binary,
    Folderless,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SnapshotPresenceState {
    PresentInLatest,
    DeletedInLatest,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SourceExistenceState {
    Exists,
    Missing,
    SourceRootMissing,
    Unchecked,
}
