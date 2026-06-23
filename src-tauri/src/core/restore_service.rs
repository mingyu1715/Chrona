use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use uuid::Uuid;

use crate::core::block_store::BlockStore;
use crate::core::errors::{ChronaError, ChronaResult};
use crate::core::path_safety::{
    assert_repository_restore_target_separate, metadata_relative_path_to_path_buf,
};
use crate::core::repository::RepositoryManager;
use crate::core::snapshot_store::SnapshotStore;
use crate::models::restore::{RestoreFileResult, RestoreReport};
use crate::models::snapshot::SnapshotFile;

pub struct RestoreService;

impl RestoreService {
    pub fn new() -> Self {
        Self
    }

    pub fn restore_snapshot(
        &self,
        repository_path: &Path,
        snapshot_id: &str,
        target_path: &Path,
    ) -> ChronaResult<RestoreReport> {
        RepositoryManager::open(repository_path)?;
        let target_path = assert_repository_restore_target_separate(repository_path, target_path)?;
        prepare_restore_target(&target_path)?;

        let snapshot =
            SnapshotStore::new(repository_path.to_path_buf()).get_snapshot(snapshot_id)?;
        let block_store = BlockStore::new(repository_path.to_path_buf());
        let operation_id = Uuid::new_v4().to_string();
        let mut files = Vec::with_capacity(snapshot.files.len());
        let mut restored_bytes = 0;
        let mut restored_block_count = 0;

        for file in &snapshot.files {
            let relative_path = metadata_relative_path_to_path_buf(&file.relative_path)?;
            let final_path = target_path.join(relative_path);
            restore_file(&block_store, file, &final_path, &operation_id)?;
            restored_bytes += file.size_bytes;
            restored_block_count += file.blocks.len() as u64;
            files.push(RestoreFileResult {
                relative_path: file.relative_path.clone(),
                size_bytes: file.size_bytes,
                block_count: file.blocks.len() as u64,
            });
        }

        let target_path = target_path.to_str().ok_or_else(|| {
            ChronaError::UnsafeRestoreTarget(format!(
                "restore target is not valid UTF-8: {}",
                target_path.display()
            ))
        })?;

        Ok(RestoreReport {
            schema_version: 1,
            snapshot_id: snapshot.id,
            target_path: target_path.to_string(),
            restored_file_count: files.len() as u64,
            restored_bytes,
            restored_block_count,
            files,
        })
    }
}

impl Default for RestoreService {
    fn default() -> Self {
        Self::new()
    }
}

fn prepare_restore_target(target_path: &Path) -> ChronaResult<()> {
    if target_path.exists() {
        if !target_path.is_dir() {
            return Err(ChronaError::UnsafeRestoreTarget(format!(
                "restore target must be a directory: {}",
                target_path.display()
            )));
        }
        if fs::read_dir(target_path)?.next().transpose()?.is_some() {
            return Err(ChronaError::UnsafeRestoreTarget(format!(
                "restore target must be empty: {}",
                target_path.display()
            )));
        }
        return Ok(());
    }

    fs::create_dir_all(target_path)?;
    Ok(())
}

fn restore_file(
    block_store: &BlockStore,
    file: &SnapshotFile,
    final_path: &Path,
    operation_id: &str,
) -> ChronaResult<()> {
    if final_path.exists() {
        return Err(ChronaError::UnsafeRestoreTarget(format!(
            "restore output already exists: {}",
            final_path.display()
        )));
    }

    if let Some(parent) = final_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let tmp_path = tmp_path_for_file(final_path, operation_id)?;
    let write_result = write_tmp_then_rename(block_store, file, &tmp_path, final_path);
    if let Err(error) = write_result {
        let _ = fs::remove_file(&tmp_path);
        return Err(error);
    }

    Ok(())
}

fn tmp_path_for_file(final_path: &Path, operation_id: &str) -> ChronaResult<PathBuf> {
    let file_name = final_path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| {
            ChronaError::UnsafeRelativePath(format!(
                "restore output has no valid file name: {}",
                final_path.display()
            ))
        })?;
    Ok(final_path.with_file_name(format!("{file_name}.tmp-{operation_id}")))
}

fn write_tmp_then_rename(
    block_store: &BlockStore,
    file: &SnapshotFile,
    tmp_path: &Path,
    final_path: &Path,
) -> ChronaResult<()> {
    let mut output = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(tmp_path)?;

    for block in &file.blocks {
        let bytes = block_store.read_block(&block.hash)?;
        if bytes.len() as u64 != block.size_bytes {
            return Err(ChronaError::Restore(format!(
                "block `{}` has {} bytes but snapshot expects {} bytes",
                block.hash,
                bytes.len(),
                block.size_bytes
            )));
        }
        output.write_all(&bytes)?;
    }

    output.sync_all()?;
    drop(output);
    fs::rename(tmp_path, final_path)?;
    Ok(())
}
