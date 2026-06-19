use std::path::Path;

use uuid::Uuid;

use crate::core::block_store::BlockStore;
use crate::core::chunker::FixedChunker;
use crate::core::errors::ChronaResult;
use crate::core::hasher::sha256_hex;
use crate::core::path_safety::assert_source_repository_separate;
use crate::core::repository::RepositoryManager;
use crate::core::scanner::FileScanner;
use crate::models::block::BlockReference;
use crate::models::ingest::{BlockIngestSummary, FileIngestResult};
use crate::models::progress::BlockIngestProgress;

const BLOCK_SIZE: usize = 1_048_576;

pub struct BlockIngestService;

impl BlockIngestService {
    pub fn new() -> Self {
        Self
    }

    pub fn ingest<F>(
        &self,
        repository_path: &Path,
        source_path: &Path,
        mut on_progress: F,
    ) -> ChronaResult<BlockIngestSummary>
    where
        F: FnMut(BlockIngestProgress),
    {
        RepositoryManager::open(repository_path)?;
        assert_source_repository_separate(source_path, repository_path)?;

        let operation_id = Uuid::new_v4().to_string();
        let files = FileScanner::scan(source_path)?;
        let total_files = files.len() as u64;
        let total_bytes = files.iter().map(|file| file.size_bytes).sum::<u64>();

        emit_progress(
            &mut on_progress,
            &operation_id,
            "scanning",
            None,
            0,
            total_files,
            0,
            0,
            0,
            total_bytes,
        );

        let store = BlockStore::new(repository_path.to_path_buf());
        let chunker = FixedChunker::new(BLOCK_SIZE);
        let mut summary = BlockIngestSummary {
            file_count: total_files,
            total_input_bytes: total_bytes,
            total_block_references: 0,
            new_block_count: 0,
            reused_block_count: 0,
            newly_stored_bytes: 0,
            files: Vec::new(),
        };
        let mut total_bytes_processed = 0_u64;

        for (file_position, file) in files.iter().enumerate() {
            let processed_files = file_position as u64;
            let mut current_file_bytes_processed = 0_u64;
            let mut file_result = FileIngestResult {
                relative_path: file.relative_path.clone(),
                size_bytes: file.size_bytes,
                blocks: Vec::new(),
            };

            emit_progress(
                &mut on_progress,
                &operation_id,
                "chunking",
                Some(file.relative_path.clone()),
                processed_files,
                total_files,
                current_file_bytes_processed,
                file.size_bytes,
                total_bytes_processed,
                total_bytes,
            );

            chunker.for_each_chunk(&file.absolute_path, |chunk| {
                let hash = sha256_hex(&chunk.bytes);
                let write = store.store_block(&hash, &chunk.bytes, &operation_id)?;
                let size_bytes = chunk.bytes.len() as u64;
                current_file_bytes_processed += size_bytes;
                total_bytes_processed += size_bytes;
                summary.total_block_references += 1;
                if write.was_new {
                    summary.new_block_count += 1;
                    summary.newly_stored_bytes += write.size_bytes;
                } else {
                    summary.reused_block_count += 1;
                }
                file_result.blocks.push(BlockReference {
                    index: chunk.index,
                    offset: chunk.offset,
                    size_bytes,
                    hash,
                    was_new: write.was_new,
                });

                emit_progress(
                    &mut on_progress,
                    &operation_id,
                    "storing",
                    Some(file.relative_path.clone()),
                    processed_files,
                    total_files,
                    current_file_bytes_processed,
                    file.size_bytes,
                    total_bytes_processed,
                    total_bytes,
                );
                Ok(())
            })?;

            summary.files.push(file_result);
        }

        emit_progress(
            &mut on_progress,
            &operation_id,
            "completed",
            None,
            total_files,
            total_files,
            0,
            0,
            total_bytes_processed,
            total_bytes,
        );

        Ok(summary)
    }
}

impl Default for BlockIngestService {
    fn default() -> Self {
        Self::new()
    }
}

#[allow(clippy::too_many_arguments)]
fn emit_progress<F>(
    on_progress: &mut F,
    operation_id: &str,
    phase: &str,
    current_file: Option<String>,
    processed_files: u64,
    total_files: u64,
    current_file_bytes_processed: u64,
    current_file_size_bytes: u64,
    total_bytes_processed: u64,
    total_bytes: u64,
) where
    F: FnMut(BlockIngestProgress),
{
    on_progress(BlockIngestProgress {
        operation_id: operation_id.to_string(),
        phase: phase.to_string(),
        current_file,
        processed_files,
        total_files,
        current_file_bytes_processed,
        current_file_size_bytes,
        total_bytes_processed,
        total_bytes,
    });
}
