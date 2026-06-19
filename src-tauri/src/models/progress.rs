use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BlockIngestProgress {
    pub operation_id: String,
    pub phase: String,
    pub current_file: Option<String>,
    pub processed_files: u64,
    pub total_files: u64,
    pub current_file_bytes_processed: u64,
    pub current_file_size_bytes: u64,
    pub total_bytes_processed: u64,
    pub total_bytes: u64,
}
