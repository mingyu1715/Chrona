use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryManifest {
    pub schema_version: u32,
    pub app_version: String,
    pub repository_id: String,
    pub created_at: String,
    pub block_strategy: BlockStrategy,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BlockStrategy {
    #[serde(rename = "type")]
    pub strategy_type: String,
    pub size_bytes: u64,
    pub hash: String,
    #[serde(default = "legacy_encoding_version")]
    pub encoding_version: u32,
    #[serde(default)]
    pub compression_mode: CompressionMode,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CompressionMode {
    Off,
    Standard,
    Fast,
}

impl Default for CompressionMode {
    fn default() -> Self {
        Self::Off
    }
}

fn legacy_encoding_version() -> u32 {
    1
}
