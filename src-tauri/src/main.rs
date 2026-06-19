use chrona::models::ingest::BlockIngestSummary;
use chrona::models::repository::RepositoryManifest;

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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            create_repository,
            open_repository,
            ingest_blocks
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Chrona application");
}
