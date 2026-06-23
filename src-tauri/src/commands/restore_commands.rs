use std::path::PathBuf;

use crate::core::restore_service::RestoreService;
use crate::models::restore::RestoreReport;

#[tauri::command]
pub fn restore_snapshot(
    repository_path: String,
    snapshot_id: String,
    target_path: String,
) -> Result<RestoreReport, String> {
    RestoreService::new()
        .restore_snapshot(
            &PathBuf::from(repository_path),
            &snapshot_id,
            &PathBuf::from(target_path),
        )
        .map_err(|error| error.to_string())
}
