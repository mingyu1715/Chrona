use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BlockStorageEncoding {
    Raw,
    Zstd,
    Lz4,
    Unknown,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum BlockStorageState {
    Available,
    Missing,
    Unreadable,
    InvalidHeader,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PhysicalBlockInspection {
    pub encoding: BlockStorageEncoding,
    pub storage_state: BlockStorageState,
    pub stored_size_bytes: Option<u64>,
    pub compression_saved_bytes: Option<u64>,
    pub issue: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileInspectionReport {
    pub schema_version: u32,
    pub repository_path: String,
    pub relative_path: String,
    pub file_name: String,
    pub version_count: u64,
    pub first_seen_at: String,
    pub last_seen_at: String,
    pub latest_state: FileVersionState,
    pub current_source_path: Option<String>,
    pub versions: Vec<FileInspectionVersion>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileInspectionVersion {
    pub snapshot_id: String,
    pub snapshot_name: String,
    pub snapshot_created_at: String,
    pub state: FileVersionState,
    pub size_bytes: Option<u64>,
    pub modified_at: Option<String>,
    pub total_block_references: u64,
    pub unique_block_count: u64,
    pub blocks: Vec<FileBlockInspection>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileBlockInspection {
    pub index: u64,
    pub offset: u64,
    pub size_bytes: u64,
    pub hash: String,
    pub was_new: bool,
    pub encoding: BlockStorageEncoding,
    pub storage_state: BlockStorageState,
    pub stored_size_bytes: Option<u64>,
    pub compression_saved_bytes: Option<u64>,
    pub seen_in_version_count: u64,
    pub issue: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum FileVersionState {
    Added,
    Modified,
    Unchanged,
    Deleted,
}
