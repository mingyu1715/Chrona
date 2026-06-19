use std::path::PathBuf;

use tauri::Emitter;

use crate::core::block_ingest_service::BlockIngestService;
use crate::models::ingest::BlockIngestSummary;

const BLOCK_INGEST_PROGRESS_EVENT: &str = "block-ingest-progress";

#[tauri::command]
pub fn ingest_blocks(
    app: tauri::AppHandle,
    repository_path: String,
    source_path: String,
) -> Result<BlockIngestSummary, String> {
    BlockIngestService::new()
        .ingest(
            &PathBuf::from(repository_path),
            &PathBuf::from(source_path),
            |event| {
                let _ = app.emit(BLOCK_INGEST_PROGRESS_EVENT, event);
            },
        )
        .map_err(|error| error.to_string())
}
