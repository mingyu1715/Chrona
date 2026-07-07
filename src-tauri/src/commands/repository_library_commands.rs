use std::path::PathBuf;

use tauri::Manager;

use crate::core::repository_library_service::RepositoryLibraryService;
use crate::models::repository_registry::{OpenedRepository, RepositoryLibrary};

fn service(app: &tauri::AppHandle) -> Result<RepositoryLibraryService, String> {
    let app_local_data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    Ok(RepositoryLibraryService::new(app_local_data_dir))
}

pub fn get_repository_library(app: tauri::AppHandle) -> Result<RepositoryLibrary, String> {
    service(&app)?.list().map_err(|error| error.to_string())
}

pub fn create_managed_repository(
    app: tauri::AppHandle,
    display_name: String,
) -> Result<OpenedRepository, String> {
    service(&app)?
        .create_managed(&display_name)
        .map_err(|error| error.to_string())
}

pub fn create_repository_at(
    app: tauri::AppHandle,
    display_name: String,
    parent_path: String,
) -> Result<OpenedRepository, String> {
    service(&app)?
        .create_at(&display_name, &PathBuf::from(parent_path))
        .map_err(|error| error.to_string())
}

pub fn register_existing_repository(
    app: tauri::AppHandle,
    path: String,
    display_name: Option<String>,
) -> Result<OpenedRepository, String> {
    service(&app)?
        .register_existing(&PathBuf::from(path), display_name.as_deref())
        .map_err(|error| error.to_string())
}

pub fn activate_registered_repository(
    app: tauri::AppHandle,
    repository_id: String,
) -> Result<OpenedRepository, String> {
    service(&app)?
        .activate(&repository_id)
        .map_err(|error| error.to_string())
}

pub fn remove_repository_registration(
    app: tauri::AppHandle,
    repository_id: String,
) -> Result<RepositoryLibrary, String> {
    service(&app)?
        .remove_registration(&repository_id)
        .map_err(|error| error.to_string())
}

pub fn relink_registered_repository(
    app: tauri::AppHandle,
    repository_id: String,
    path: String,
) -> Result<OpenedRepository, String> {
    service(&app)?
        .relink(&repository_id, &PathBuf::from(path))
        .map_err(|error| error.to_string())
}
