use chrona::models::diff::SnapshotComparison;
use chrona::models::ingest::BlockIngestSummary;
use chrona::models::repository::RepositoryManifest;
use chrona::models::snapshot::{Snapshot, SnapshotIndexItem};

#[tauri::command]
fn create_repository(repository_path: String) -> Result<RepositoryManifest, String> {
    chrona::commands::repository_commands::create_repository(repository_path)
}

#[tauri::command]
fn open_repository(repository_path: String) -> Result<RepositoryManifest, String> {
    chrona::commands::repository_commands::open_repository(repository_path)
}

#[tauri::command]
fn ingest_blocks(
    app: tauri::AppHandle,
    repository_path: String,
    source_path: String,
) -> Result<BlockIngestSummary, String> {
    chrona::commands::block_commands::ingest_blocks(app, repository_path, source_path)
}

#[tauri::command]
fn create_snapshot(
    app: tauri::AppHandle,
    repository_path: String,
    source_path: String,
    name: String,
) -> Result<Snapshot, String> {
    chrona::commands::snapshot_commands::create_snapshot(app, repository_path, source_path, name)
}

#[tauri::command]
fn list_snapshots(repository_path: String) -> Result<Vec<SnapshotIndexItem>, String> {
    chrona::commands::snapshot_commands::list_snapshots(repository_path)
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            create_repository,
            open_repository,
            ingest_blocks,
            create_snapshot,
            list_snapshots,
            get_snapshot,
            compare_snapshots
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Chrona application");
}
