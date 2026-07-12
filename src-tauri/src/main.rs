#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use chrona::models::access::{AccessEvent, AccessHistorySummary, AccessNode, HomeSummary};
use chrona::models::diff::SnapshotComparison;
use chrona::models::file_inspector::FileInspectionReport;
use chrona::models::ingest::BlockIngestSummary;
use chrona::models::integrity::IntegrityReport;
use chrona::models::inventory::RepositoryInventoryReport;
use chrona::models::repository::{CompressionMode, RepositoryManifest};
use chrona::models::repository_registry::{OpenedRepository, RepositoryLibrary};
use chrona::models::restore::{OriginalLocationRestoreReport, RestoreReport};
use chrona::models::snapshot::{Snapshot, SnapshotIndexItem};
use chrona::models::source::{BackupSource, SourceIndex};
use chrona::models::statistics::{RepositoryStatisticsOverview, RepositoryStatisticsReport};

#[tauri::command]
fn create_repository(repository_path: String) -> Result<RepositoryManifest, String> {
    chrona::commands::repository_commands::create_repository(repository_path)
}

#[tauri::command]
fn open_repository(repository_path: String) -> Result<RepositoryManifest, String> {
    chrona::commands::repository_commands::open_repository(repository_path)
}

#[tauri::command]
fn get_repository_library(app: tauri::AppHandle) -> Result<RepositoryLibrary, String> {
    chrona::commands::repository_library_commands::get_repository_library(app)
}

#[tauri::command]
fn create_managed_repository(
    app: tauri::AppHandle,
    display_name: String,
) -> Result<OpenedRepository, String> {
    chrona::commands::repository_library_commands::create_managed_repository(app, display_name)
}

#[tauri::command]
fn create_repository_at(
    app: tauri::AppHandle,
    display_name: String,
    parent_path: String,
) -> Result<OpenedRepository, String> {
    chrona::commands::repository_library_commands::create_repository_at(
        app,
        display_name,
        parent_path,
    )
}

#[tauri::command]
fn register_existing_repository(
    app: tauri::AppHandle,
    path: String,
    display_name: Option<String>,
) -> Result<OpenedRepository, String> {
    chrona::commands::repository_library_commands::register_existing_repository(
        app,
        path,
        display_name,
    )
}

#[tauri::command]
fn activate_registered_repository(
    app: tauri::AppHandle,
    repository_id: String,
) -> Result<OpenedRepository, String> {
    chrona::commands::repository_library_commands::activate_registered_repository(
        app,
        repository_id,
    )
}

#[tauri::command]
fn remove_repository_registration(
    app: tauri::AppHandle,
    repository_id: String,
) -> Result<RepositoryLibrary, String> {
    chrona::commands::repository_library_commands::remove_repository_registration(
        app,
        repository_id,
    )
}

#[tauri::command]
fn rename_repository_registration(
    app: tauri::AppHandle,
    repository_id: String,
    display_name: String,
) -> Result<RepositoryLibrary, String> {
    chrona::commands::repository_library_commands::rename_repository_registration(
        app,
        repository_id,
        display_name,
    )
}

#[tauri::command]
fn relink_registered_repository(
    app: tauri::AppHandle,
    repository_id: String,
    path: String,
) -> Result<OpenedRepository, String> {
    chrona::commands::repository_library_commands::relink_registered_repository(
        app,
        repository_id,
        path,
    )
}

#[tauri::command]
fn set_repository_compression_mode(
    repository_path: String,
    compression_mode: CompressionMode,
) -> Result<RepositoryManifest, String> {
    chrona::commands::repository_commands::set_repository_compression_mode(
        repository_path,
        compression_mode,
    )
}

#[tauri::command]
async fn ingest_blocks(
    app: tauri::AppHandle,
    repository_path: String,
    source_path: String,
) -> Result<BlockIngestSummary, String> {
    chrona::commands::block_commands::ingest_blocks(app, repository_path, source_path).await
}

#[tauri::command]
async fn create_snapshot(
    app: tauri::AppHandle,
    repository_path: String,
    source_path: String,
    name: String,
) -> Result<Snapshot, String> {
    chrona::commands::snapshot_commands::create_snapshot(app, repository_path, source_path, name)
        .await
}

#[tauri::command]
fn list_snapshots(repository_path: String) -> Result<Vec<SnapshotIndexItem>, String> {
    chrona::commands::snapshot_commands::list_snapshots(repository_path)
}

#[tauri::command]
fn delete_snapshot(
    repository_path: String,
    snapshot_id: String,
) -> Result<Vec<SnapshotIndexItem>, String> {
    chrona::commands::snapshot_commands::delete_snapshot(repository_path, snapshot_id)
}

#[tauri::command]
fn get_snapshot(repository_path: String, snapshot_id: String) -> Result<Snapshot, String> {
    chrona::commands::snapshot_commands::get_snapshot(repository_path, snapshot_id)
}

#[tauri::command]
fn compare_snapshots(
    repository_path: String,
    base_snapshot_id: String,
    target_snapshot_id: String,
) -> Result<SnapshotComparison, String> {
    chrona::commands::snapshot_commands::compare_snapshots(
        repository_path,
        base_snapshot_id,
        target_snapshot_id,
    )
}

#[tauri::command]
fn list_sources(repository_path: String) -> Result<SourceIndex, String> {
    chrona::commands::source_commands::list_sources(repository_path)
}

#[tauri::command]
fn register_source(repository_path: String, source_path: String) -> Result<BackupSource, String> {
    chrona::commands::source_commands::register_source(repository_path, source_path)
}

#[tauri::command]
fn rename_source(
    repository_path: String,
    source_id: String,
    display_name: String,
) -> Result<SourceIndex, String> {
    chrona::commands::source_commands::rename_source(repository_path, source_id, display_name)
}

#[tauri::command]
fn remove_source(repository_path: String, source_id: String) -> Result<SourceIndex, String> {
    chrona::commands::source_commands::remove_source(repository_path, source_id)
}

#[tauri::command]
fn record_access_event(repository_path: String, event: AccessEvent) -> Result<AccessNode, String> {
    chrona::commands::home_commands::record_access_event(repository_path, event)
}

#[tauri::command]
fn get_home_summary(repository_path: String) -> Result<HomeSummary, String> {
    chrona::commands::home_commands::get_home_summary(repository_path)
}

#[tauri::command]
fn pin_access_item(repository_path: String, key: String) -> Result<AccessNode, String> {
    chrona::commands::home_commands::pin_access_item(repository_path, key)
}

#[tauri::command]
fn unpin_access_item(repository_path: String, key: String) -> Result<AccessNode, String> {
    chrona::commands::home_commands::unpin_access_item(repository_path, key)
}

#[tauri::command]
fn clear_access_history(repository_path: String) -> Result<AccessHistorySummary, String> {
    chrona::commands::home_commands::clear_access_history(repository_path)
}

#[tauri::command]
async fn restore_snapshot(
    repository_path: String,
    snapshot_id: String,
    target_path: String,
) -> Result<RestoreReport, String> {
    chrona::commands::restore_commands::restore_snapshot(repository_path, snapshot_id, target_path)
        .await
}

#[tauri::command]
async fn restore_snapshot_to_source(
    repository_path: String,
    source_id: String,
    snapshot_id: String,
) -> Result<OriginalLocationRestoreReport, String> {
    chrona::commands::restore_commands::restore_snapshot_to_source(
        repository_path,
        source_id,
        snapshot_id,
    )
    .await
}

#[tauri::command]
async fn verify_repository(repository_path: String) -> Result<IntegrityReport, String> {
    chrona::commands::integrity_commands::verify_repository(repository_path).await
}

#[tauri::command]
fn get_repository_inventory(repository_path: String) -> Result<RepositoryInventoryReport, String> {
    chrona::commands::inventory_commands::get_repository_inventory(repository_path)
}

#[tauri::command]
fn inspect_repository_file(
    repository_path: String,
    relative_path: String,
    source_id: Option<String>,
) -> Result<FileInspectionReport, String> {
    chrona::commands::file_inspector_commands::inspect_repository_file(
        repository_path,
        relative_path,
        source_id,
    )
}

#[tauri::command]
fn get_repository_statistics_overview(
    repository_path: String,
) -> Result<RepositoryStatisticsOverview, String> {
    chrona::commands::statistics_commands::get_repository_statistics_overview(repository_path)
}

#[tauri::command]
async fn analyze_repository_statistics(
    app: tauri::AppHandle,
    repository_path: String,
) -> Result<RepositoryStatisticsReport, String> {
    chrona::commands::statistics_commands::analyze_repository_statistics(app, repository_path).await
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            create_repository,
            open_repository,
            get_repository_library,
            create_managed_repository,
            create_repository_at,
            register_existing_repository,
            activate_registered_repository,
            remove_repository_registration,
            rename_repository_registration,
            relink_registered_repository,
            set_repository_compression_mode,
            ingest_blocks,
            create_snapshot,
            list_snapshots,
            delete_snapshot,
            get_snapshot,
            compare_snapshots,
            list_sources,
            register_source,
            rename_source,
            remove_source,
            record_access_event,
            get_home_summary,
            pin_access_item,
            unpin_access_item,
            clear_access_history,
            restore_snapshot,
            restore_snapshot_to_source,
            verify_repository,
            get_repository_inventory,
            inspect_repository_file,
            get_repository_statistics_overview,
            analyze_repository_statistics
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Chrona application");
}
