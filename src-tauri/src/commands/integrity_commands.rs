use std::path::PathBuf;

use crate::core::integrity_service::IntegrityService;
use crate::models::integrity::IntegrityReport;

#[tauri::command]
pub async fn verify_repository(repository_path: String) -> Result<IntegrityReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        IntegrityService::new()
            .verify_repository(&PathBuf::from(repository_path))
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}
