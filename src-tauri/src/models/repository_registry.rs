use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::models::repository::RepositoryManifest;

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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RepositoryConnectionState {
    Connected,
    Disconnected,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryLibraryItem {
    pub repository_id: String,
    pub display_name: String,
    pub path: PathBuf,
    pub added_at: String,
    pub last_opened_at: String,
    pub connection_state: RepositoryConnectionState,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryLibrary {
    pub active_repository_id: Option<String>,
    pub repositories: Vec<RepositoryLibraryItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenedRepository {
    pub registration: RepositoryLibraryItem,
    pub manifest: RepositoryManifest,
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
