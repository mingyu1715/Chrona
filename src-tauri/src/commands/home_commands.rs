use std::path::PathBuf;

use crate::core::home_service::HomeService;
use crate::models::access::{AccessEvent, AccessHistorySummary, AccessNode, HomeSummary};

#[tauri::command]
pub fn record_access_event(
    repository_path: String,
    event: AccessEvent,
) -> Result<AccessNode, String> {
    HomeService::new()
        .record_access_event(&PathBuf::from(repository_path), event)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_home_summary(repository_path: String) -> Result<HomeSummary, String> {
    HomeService::new()
        .get_home_summary(&PathBuf::from(repository_path))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn pin_access_item(repository_path: String, key: String) -> Result<AccessNode, String> {
    HomeService::new()
        .pin_access_item(&PathBuf::from(repository_path), &key)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn unpin_access_item(repository_path: String, key: String) -> Result<AccessNode, String> {
    HomeService::new()
        .unpin_access_item(&PathBuf::from(repository_path), &key)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn clear_access_history(repository_path: String) -> Result<AccessHistorySummary, String> {
    HomeService::new()
        .clear_access_history(&PathBuf::from(repository_path))
        .map_err(|error| error.to_string())
}
