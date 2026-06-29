use std::path::PathBuf;

use crate::core::repository::RepositoryManager;
use crate::models::repository::{CompressionMode, RepositoryManifest};

#[tauri::command]
pub fn create_repository(repository_path: String) -> Result<RepositoryManifest, String> {
    RepositoryManager::create(&PathBuf::from(repository_path)).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn open_repository(repository_path: String) -> Result<RepositoryManifest, String> {
    RepositoryManager::open(&PathBuf::from(repository_path)).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_repository_compression_mode(
    repository_path: String,
    compression_mode: CompressionMode,
) -> Result<RepositoryManifest, String> {
    RepositoryManager::set_compression_mode(&PathBuf::from(repository_path), compression_mode)
        .map_err(|error| error.to_string())
}
