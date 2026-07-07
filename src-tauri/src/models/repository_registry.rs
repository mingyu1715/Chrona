use std::path::PathBuf;

use serde::{Deserialize, Serialize};

pub const REPOSITORY_REGISTRY_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RegisteredRepository {
    pub repository_id: String,
    pub display_name: String,
    pub path: PathBuf,
    pub added_at: String,
    pub last_opened_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryRegistry {
    pub schema_version: u32,
    pub active_repository_id: Option<String>,
    pub repositories: Vec<RegisteredRepository>,
}

impl Default for RepositoryRegistry {
    fn default() -> Self {
        Self {
            schema_version: REPOSITORY_REGISTRY_SCHEMA_VERSION,
            active_repository_id: None,
            repositories: Vec::new(),
        }
    }
}
