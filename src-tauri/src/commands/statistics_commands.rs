use std::path::PathBuf;

use tauri::Emitter;

use crate::core::statistics_service::StatisticsService;
use crate::models::statistics::{RepositoryStatisticsOverview, RepositoryStatisticsReport};

#[tauri::command]
pub fn get_repository_statistics_overview(
    repository_path: String,
) -> Result<RepositoryStatisticsOverview, String> {
    StatisticsService::new()
        .get_overview(&PathBuf::from(repository_path))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn analyze_repository_statistics(
    app: tauri::AppHandle,
    repository_path: String,
) -> Result<RepositoryStatisticsReport, String> {
    tauri::async_runtime::spawn_blocking(move || {
        StatisticsService::new()
            .analyze_repository(&PathBuf::from(repository_path), |progress| {
                let _ = app.emit("repository-statistics-progress", progress);
            })
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}
