use std::path::PathBuf;

use crate::core::repository::RepositoryManager;
use crate::core::source_store::SourceStore;
use crate::models::source::{BackupSource, SourceIndex};

pub fn list_sources(repository_path: String) -> Result<SourceIndex, String> {
    RepositoryManager::open(&PathBuf::from(&repository_path)).map_err(|error| error.to_string())?;
    SourceStore::new(PathBuf::from(repository_path))
        .list_sources()
        .map_err(|error| error.to_string())
}

pub fn register_source(
    repository_path: String,
    source_path: String,
) -> Result<BackupSource, String> {
    RepositoryManager::open(&PathBuf::from(&repository_path)).map_err(|error| error.to_string())?;
    SourceStore::new(PathBuf::from(repository_path))
        .find_or_create_for_path(&PathBuf::from(source_path))
        .map_err(|error| error.to_string())
}

pub fn rename_source(
    repository_path: String,
    source_id: String,
    display_name: String,
) -> Result<SourceIndex, String> {
    RepositoryManager::open(&PathBuf::from(&repository_path)).map_err(|error| error.to_string())?;
    SourceStore::new(PathBuf::from(repository_path))
        .rename_source(&source_id, &display_name)
        .map_err(|error| error.to_string())
}

pub fn remove_source(repository_path: String, source_id: String) -> Result<SourceIndex, String> {
    RepositoryManager::open(&PathBuf::from(&repository_path)).map_err(|error| error.to_string())?;
    SourceStore::new(PathBuf::from(repository_path))
        .remove_source(&source_id)
        .map_err(|error| error.to_string())
}
