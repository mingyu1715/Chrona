use std::collections::BTreeSet;
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
use crate::core::scanner::FileScanner;
use crate::core::snapshot_service::SnapshotService;
use crate::core::snapshot_store::SnapshotStore;
use crate::core::source_store::SourceStore;
use crate::models::restore::{
    OriginalLocationRestoreReport, QuarantinedFileResult, RestoreFileResult, RestoreReport,
};
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

    pub fn restore_snapshot_to_source(
        &self,
        repository_path: &Path,
        source_id: &str,
        snapshot_id: &str,
    ) -> ChronaResult<OriginalLocationRestoreReport> {
        RepositoryManager::open(repository_path)?;
        let source_store = SourceStore::new(repository_path.to_path_buf());
        let source = source_store
            .list_sources()?
            .sources
            .into_iter()
            .find(|source| source.id == source_id)
            .ok_or_else(|| ChronaError::SourceNotFound(source_id.to_string()))?;
        let source_path = PathBuf::from(&source.path);
        if !source_path.exists() {
            return Err(ChronaError::Restore(format!(
                "source path is unavailable: {}",
                source.path
            )));
        }
        let source_path = source_path.canonicalize()?;
        if !source_path.is_dir() {
            return Err(ChronaError::Restore(
                "original-location restore currently supports directory sources".to_string(),
            ));
        }

        let snapshot_store = SnapshotStore::new(repository_path.to_path_buf());
        let snapshot = snapshot_store.get_snapshot(snapshot_id)?;
        if snapshot.source_id.as_deref() != Some(source_id) {
            return Err(ChronaError::Restore(format!(
                "snapshot `{}` does not belong to source `{}`",
                snapshot.id, source_id
            )));
        }

        let safety_snapshot = SnapshotService::new().create_snapshot(
            repository_path,
            &source_path,
            &format!("Safety before restoring {}", snapshot.name),
            |_| {},
        )?;
        let operation_id = Uuid::new_v4().to_string();
        let snapshot_relative_paths = snapshot
            .files
            .iter()
            .map(|file| file.relative_path.clone())
            .collect::<BTreeSet<_>>();
        let quarantined_files =
            quarantine_extra_files(&source_path, &snapshot_relative_paths, &operation_id)?;
        let block_store = BlockStore::new(repository_path.to_path_buf());
        let mut files = Vec::with_capacity(snapshot.files.len());
        let mut restored_bytes = 0;
        let mut restored_block_count = 0;

        for file in &snapshot.files {
            let relative_path = metadata_relative_path_to_path_buf(&file.relative_path)?;
            let final_path = source_path.join(relative_path);
            restore_file_replacing(&block_store, file, &final_path, &operation_id)?;
            restored_bytes += file.size_bytes;
            restored_block_count += file.blocks.len() as u64;
            files.push(RestoreFileResult {
                relative_path: file.relative_path.clone(),
                size_bytes: file.size_bytes,
                block_count: file.blocks.len() as u64,
            });
        }

        Ok(OriginalLocationRestoreReport {
            schema_version: 1,
            snapshot_id: snapshot.id,
            source_id: source_id.to_string(),
            source_path: path_to_string(&source_path)?,
            safety_snapshot_id: safety_snapshot.id,
            operation_id,
            restored_file_count: files.len() as u64,
            restored_bytes,
            restored_block_count,
            quarantined_file_count: quarantined_files.len() as u64,
            files,
            quarantined_files,
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

fn restore_file_replacing(
    block_store: &BlockStore,
    file: &SnapshotFile,
    final_path: &Path,
    operation_id: &str,
) -> ChronaResult<()> {
    if final_path.is_dir() {
        return Err(ChronaError::Restore(format!(
            "restore output conflicts with a directory: {}",
            final_path.display()
        )));
    }

    if let Some(parent) = final_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let tmp_path = tmp_path_for_file(final_path, operation_id)?;
    let write_result = write_tmp_then_replace(block_store, file, &tmp_path, final_path);
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

fn write_tmp_then_replace(
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
    if final_path.exists() {
        fs::remove_file(final_path)?;
    }
    fs::rename(tmp_path, final_path)?;
    Ok(())
}

fn quarantine_extra_files(
    source_path: &Path,
    snapshot_relative_paths: &BTreeSet<String>,
    operation_id: &str,
) -> ChronaResult<Vec<QuarantinedFileResult>> {
    let mut quarantined = Vec::new();
    for file in FileScanner::scan(source_path)? {
        if is_quarantine_relative_path(&file.relative_path)
            || snapshot_relative_paths.contains(&file.relative_path)
        {
            continue;
        }

        let relative_path = metadata_relative_path_to_path_buf(&file.relative_path)?;
        let quarantine_path = source_path
            .join(".chrona-quarantine")
            .join(operation_id)
            .join(relative_path);
        if let Some(parent) = quarantine_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::rename(&file.absolute_path, &quarantine_path)?;
        quarantined.push(QuarantinedFileResult {
            relative_path: file.relative_path,
            quarantine_path: path_to_string(&quarantine_path)?,
        });
    }
    Ok(quarantined)
}

fn is_quarantine_relative_path(relative_path: &str) -> bool {
    relative_path == ".chrona-quarantine" || relative_path.starts_with(".chrona-quarantine/")
}

fn path_to_string(path: &Path) -> ChronaResult<String> {
    path.to_str().map(str::to_string).ok_or_else(|| {
        ChronaError::UnsafeRestoreTarget(format!("path is not valid UTF-8: {}", path.display()))
    })
}
