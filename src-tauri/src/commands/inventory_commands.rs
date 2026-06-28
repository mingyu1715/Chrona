use std::path::PathBuf;

use crate::core::inventory_service::InventoryService;
use crate::models::inventory::RepositoryInventoryReport;

#[tauri::command]
pub fn get_repository_inventory(
    repository_path: String,
) -> Result<RepositoryInventoryReport, String> {
    InventoryService::new()
        .get_repository_inventory(&PathBuf::from(repository_path))
        .map_err(|error| error.to_string())
}
