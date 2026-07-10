use std::collections::{HashMap, HashSet};
use std::path::Path;

use crate::core::block_store::BlockStore;
use crate::core::errors::{ChronaError, ChronaResult};
use crate::core::path_safety::metadata_relative_path_to_path_buf;
use crate::core::repository::RepositoryManager;
use crate::core::snapshot_store::SnapshotStore;
use crate::models::file_inspector::{
    FileBlockInspection, FileInspectionReport, FileInspectionVersion, FileVersionState,
    PhysicalBlockInspection,
};
use crate::models::snapshot::SnapshotFile;

const REPORT_SCHEMA_VERSION: u32 = 1;

pub struct FileInspectorService;

impl FileInspectorService {
    pub fn new() -> Self {
        Self
    }

    pub fn inspect_repository_file(
        &self,
        repository_path: &Path,
        relative_path: &str,
        source_id: Option<&str>,
    ) -> ChronaResult<FileInspectionReport> {
        RepositoryManager::open(repository_path)?;
        metadata_relative_path_to_path_buf(relative_path)?;

        let snapshot_store = SnapshotStore::new(repository_path.to_path_buf());
        let snapshot_items = snapshot_store.list_snapshots()?;
        let mut previous_file: Option<SnapshotFile> = None;
        let mut drafts = Vec::new();
        let mut version_count = 0_u64;
        let mut first_seen_at = None;
        let mut last_seen_at = None;
        let mut latest_present_source_root = None;
        let mut seen_in_versions: HashMap<String, u64> = HashMap::new();

        for item in snapshot_items.iter().rev() {
            let snapshot = snapshot_store.get_snapshot(&item.id)?;
            if let Some(expected_source_id) = source_id {
                if snapshot.source_id.as_deref() != Some(expected_source_id) {
                    continue;
                }
            }
            let snapshot_source_root = snapshot.source_root.clone();
            let current_file = snapshot
                .files
                .into_iter()
                .find(|file| file.relative_path == relative_path);

            match current_file {
                Some(file) => {
                    latest_present_source_root = Some(snapshot_source_root);
                    let state = match previous_file.as_ref() {
                        None => FileVersionState::Added,
                        Some(previous) if same_file_content(previous, &file) => {
                            FileVersionState::Unchanged
                        }
                        Some(_) => FileVersionState::Modified,
                    };
                    first_seen_at.get_or_insert_with(|| snapshot.created_at.clone());
                    last_seen_at = Some(snapshot.created_at.clone());
                    version_count += 1;
                    let unique_hashes = file
                        .blocks
                        .iter()
                        .map(|block| block.hash.clone())
                        .collect::<HashSet<_>>();
                    for hash in unique_hashes {
                        *seen_in_versions.entry(hash).or_insert(0) += 1;
                    }
                    drafts.push(VersionDraft {
                        snapshot_id: snapshot.id,
                        snapshot_name: snapshot.name,
                        snapshot_created_at: snapshot.created_at,
                        state,
                        file: Some(file.clone()),
                    });
                    previous_file = Some(file);
                }
                None if previous_file.is_some() => {
                    drafts.push(VersionDraft {
                        snapshot_id: snapshot.id,
                        snapshot_name: snapshot.name,
                        snapshot_created_at: snapshot.created_at,
                        state: FileVersionState::Deleted,
                        file: None,
                    });
                    previous_file = None;
                }
                None => {}
            }
        }

        if version_count == 0 {
            return Err(ChronaError::RepositoryFileNotFound(
                relative_path.to_string(),
            ));
        }

        let block_store = BlockStore::new(repository_path.to_path_buf());
        let mut physical_blocks: HashMap<(String, u64), PhysicalBlockInspection> = HashMap::new();
        for draft in &drafts {
            if let Some(file) = &draft.file {
                for block in &file.blocks {
                    let key = (block.hash.clone(), block.size_bytes);
                    if !physical_blocks.contains_key(&key) {
                        let inspection =
                            block_store.inspect_block(&block.hash, block.size_bytes)?;
                        physical_blocks.insert(key, inspection);
                    }
                }
            }
        }

        let latest_state = drafts
            .last()
            .map(|draft| draft.state)
            .expect("a present file creates at least one history draft");
        let current_source_path =
            current_source_path(latest_present_source_root.as_deref(), relative_path)?;
        let mut versions = drafts
            .into_iter()
            .map(|draft| draft.into_version(&physical_blocks, &seen_in_versions))
            .collect::<Vec<_>>();
        versions.reverse();

        Ok(FileInspectionReport {
            schema_version: REPORT_SCHEMA_VERSION,
            repository_path: repository_path.display().to_string(),
            relative_path: relative_path.to_string(),
            file_name: relative_path
                .rsplit('/')
                .next()
                .unwrap_or(relative_path)
                .to_string(),
            version_count,
            first_seen_at: first_seen_at.expect("present file has first seen time"),
            last_seen_at: last_seen_at.expect("present file has last seen time"),
            latest_state,
            current_source_path,
            versions,
        })
    }
}

impl Default for FileInspectorService {
    fn default() -> Self {
        Self::new()
    }
}

struct VersionDraft {
    snapshot_id: String,
    snapshot_name: String,
    snapshot_created_at: String,
    state: FileVersionState,
    file: Option<SnapshotFile>,
}

impl VersionDraft {
    fn into_version(
        self,
        physical_blocks: &HashMap<(String, u64), PhysicalBlockInspection>,
        seen_in_versions: &HashMap<String, u64>,
    ) -> FileInspectionVersion {
        let Some(file) = self.file else {
            return FileInspectionVersion {
                snapshot_id: self.snapshot_id,
                snapshot_name: self.snapshot_name,
                snapshot_created_at: self.snapshot_created_at,
                state: self.state,
                size_bytes: None,
                modified_at: None,
                total_block_references: 0,
                unique_block_count: 0,
                blocks: Vec::new(),
            };
        };

        let unique_block_count = file
            .blocks
            .iter()
            .map(|block| &block.hash)
            .collect::<HashSet<_>>()
            .len() as u64;
        let blocks = file
            .blocks
            .into_iter()
            .map(|block| {
                let physical = physical_blocks
                    .get(&(block.hash.clone(), block.size_bytes))
                    .expect("physical inspection exists for every block reference");
                FileBlockInspection {
                    index: block.index,
                    offset: block.offset,
                    size_bytes: block.size_bytes,
                    hash: block.hash.clone(),
                    was_new: block.was_new,
                    encoding: physical.encoding,
                    storage_state: physical.storage_state,
                    stored_size_bytes: physical.stored_size_bytes,
                    compression_saved_bytes: physical.compression_saved_bytes,
                    seen_in_version_count: seen_in_versions.get(&block.hash).copied().unwrap_or(0),
                    issue: physical.issue.clone(),
                }
            })
            .collect::<Vec<_>>();

        FileInspectionVersion {
            snapshot_id: self.snapshot_id,
            snapshot_name: self.snapshot_name,
            snapshot_created_at: self.snapshot_created_at,
            state: self.state,
            size_bytes: Some(file.size_bytes),
            modified_at: Some(file.modified_at),
            total_block_references: blocks.len() as u64,
            unique_block_count,
            blocks,
        }
    }
}

fn same_file_content(left: &SnapshotFile, right: &SnapshotFile) -> bool {
    left.size_bytes == right.size_bytes
        && left
            .blocks
            .iter()
            .map(|block| (&block.hash, block.size_bytes))
            .eq(right
                .blocks
                .iter()
                .map(|block| (&block.hash, block.size_bytes)))
}

fn current_source_path(
    source_root: Option<&str>,
    relative_path: &str,
) -> ChronaResult<Option<String>> {
    let Some(source_root) = source_root else {
        return Ok(None);
    };
    if source_root.is_empty() {
        return Ok(None);
    }

    let relative_path = metadata_relative_path_to_path_buf(relative_path)?;
    let root = Path::new(source_root);
    if root.is_file() {
        let is_source_file = relative_path.components().count() == 1
            && root.file_name() == relative_path.file_name();
        return if is_source_file {
            Ok(Some(path_to_string(&root.canonicalize()?)))
        } else {
            Ok(None)
        };
    }
    if !root.is_dir() {
        return Ok(None);
    }

    let candidate = root.join(relative_path);
    if candidate.is_file() {
        return Ok(Some(path_to_string(&candidate.canonicalize()?)));
    }

    Ok(None)
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}
