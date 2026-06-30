use std::path::PathBuf;

use crate::core::file_inspector_service::FileInspectorService;
use crate::models::file_inspector::FileInspectionReport;

#[tauri::command]
pub fn inspect_repository_file(
    repository_path: String,
    relative_path: String,
) -> Result<FileInspectionReport, String> {
    FileInspectorService::new()
        .inspect_repository_file(&PathBuf::from(repository_path), &relative_path)
        .map_err(|error| error.to_string())
}
