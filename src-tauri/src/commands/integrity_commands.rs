use std::path::PathBuf;

use crate::core::integrity_service::IntegrityService;
use crate::models::integrity::IntegrityReport;

#[tauri::command]
pub fn verify_repository(repository_path: String) -> Result<IntegrityReport, String> {
    IntegrityService::new()
        .verify_repository(&PathBuf::from(repository_path))
        .map_err(|error| error.to_string())
}
