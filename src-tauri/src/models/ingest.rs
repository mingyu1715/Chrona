use serde::{Deserialize, Serialize};

use crate::models::block::BlockReference;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileIngestResult {
    pub relative_path: String,
    pub size_bytes: u64,
    pub modified_at: String,
    pub blocks: Vec<BlockReference>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BlockIngestSummary {
    pub file_count: u64,
    pub total_input_bytes: u64,
    pub total_block_references: u64,
    pub new_block_count: u64,
    pub reused_block_count: u64,
    pub newly_stored_bytes: u64,
    #[serde(default)]
    pub new_logical_bytes: u64,
    #[serde(default)]
    pub compression_saved_bytes: u64,
    #[serde(default)]
    pub new_raw_block_count: u64,
    #[serde(default)]
    pub new_zstd_block_count: u64,
    #[serde(default)]
    pub new_lz4_block_count: u64,
    pub files: Vec<FileIngestResult>,
}
