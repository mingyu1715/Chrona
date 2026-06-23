use std::path::PathBuf;

use tauri::Emitter;

use crate::core::snapshot_service::SnapshotService;
use crate::models::diff::SnapshotComparison;
use crate::models::snapshot::{Snapshot, SnapshotIndexItem};

const BLOCK_INGEST_PROGRESS_EVENT: &str = "block-ingest-progress";

#[tauri::command]
pub fn create_snapshot(
    app: tauri::AppHandle,
    repository_path: String,
    source_path: String,
    name: String,
) -> Result<Snapshot, String> {
    SnapshotService::new()
        .create_snapshot(
            &PathBuf::from(repository_path),
            &PathBuf::from(source_path),
            &name,
            |event| {
                let _ = app.emit(BLOCK_INGEST_PROGRESS_EVENT, event);
            },
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_snapshots(repository_path: String) -> Result<Vec<SnapshotIndexItem>, String> {
    SnapshotService::new()
        .list_snapshots(&PathBuf::from(repository_path))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_snapshot(repository_path: String, snapshot_id: String) -> Result<Snapshot, String> {
    SnapshotService::new()
        .get_snapshot(&PathBuf::from(repository_path), &snapshot_id)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn compare_snapshots(
    repository_path: String,
    base_snapshot_id: String,
    target_snapshot_id: String,
) -> Result<SnapshotComparison, String> {
    SnapshotService::new()
        .compare_snapshots(
            &PathBuf::from(repository_path),
            &base_snapshot_id,
            &target_snapshot_id,
        )
        .map_err(|error| error.to_string())
}
