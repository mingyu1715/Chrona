use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BlockEncoding {
    Raw,
    Zstd,
    Lz4,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScannedFile {
    pub absolute_path: PathBuf,
    pub relative_path: String,
    pub size_bytes: u64,
    pub modified_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BlockReference {
    pub index: u64,
    pub offset: u64,
    pub size_bytes: u64,
    pub hash: String,
    pub was_new: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileChunk {
    pub index: u64,
    pub offset: u64,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BlockStoreWrite {
    pub hash: String,
    pub raw_size_bytes: u64,
    pub stored_size_bytes: u64,
    pub encoding: BlockEncoding,
    pub storage_path: PathBuf,
    pub was_new: bool,
}
