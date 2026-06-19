use std::path::PathBuf;

use crate::core::repository::RepositoryManager;
use crate::models::repository::RepositoryManifest;

#[tauri::command]
pub fn create_repository(repository_path: String) -> Result<RepositoryManifest, String> {
    RepositoryManager::create(&PathBuf::from(repository_path)).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn open_repository(repository_path: String) -> Result<RepositoryManifest, String> {
    RepositoryManager::open(&PathBuf::from(repository_path)).map_err(|error| error.to_string())
}
