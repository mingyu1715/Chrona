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
}
