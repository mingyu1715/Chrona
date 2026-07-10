use std::path::PathBuf;

use crate::core::restore_service::RestoreService;
use crate::models::restore::{OriginalLocationRestoreReport, RestoreReport};

#[tauri::command]
pub async fn restore_snapshot(
    repository_path: String,
    snapshot_id: String,
    target_path: String,
) -> Result<RestoreReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        RestoreService::new()
            .restore_snapshot(
                &PathBuf::from(repository_path),
                &snapshot_id,
                &PathBuf::from(target_path),
            )
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn restore_snapshot_to_source(
    repository_path: String,
    source_id: String,
    snapshot_id: String,
) -> Result<OriginalLocationRestoreReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        RestoreService::new()
            .restore_snapshot_to_source(&PathBuf::from(repository_path), &source_id, &snapshot_id)
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}
