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
