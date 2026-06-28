use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

use chrono::Utc;

use crate::core::errors::ChronaResult;
use crate::core::path_safety::metadata_relative_path_to_path_buf;
use crate::core::repository::RepositoryManager;
use crate::core::snapshot_store::SnapshotStore;
use crate::models::inventory::{
    FileKind, FileKindStat, InventoryFileEntry, RepositoryInventoryReport, SnapshotPresenceState,
    SourceExistenceState,
};
use crate::models::snapshot::SnapshotFile;

const REPORT_SCHEMA_VERSION: u32 = 1;

pub struct InventoryService;

impl InventoryService {
    pub fn new() -> Self {
        Self
    }

    pub fn get_repository_inventory(
        &self,
        repository_path: &Path,
    ) -> ChronaResult<RepositoryInventoryReport> {
        RepositoryManager::open(repository_path)?;
        let snapshot_store = SnapshotStore::new(repository_path.to_path_buf());
        let snapshot_items = snapshot_store.list_snapshots()?;
        let latest_snapshot_id = snapshot_items.first().map(|item| item.id.as_str());
        let mut files_by_path: BTreeMap<String, AccumulatedFile> = BTreeMap::new();
        let mut latest_block_hashes = BTreeSet::new();
        let mut total_original_bytes_latest = 0_u64;
        let mut total_block_references_latest = 0_u64;

        for item in snapshot_items.iter().rev() {
            let snapshot = snapshot_store.get_snapshot(&item.id)?;
            let is_latest = latest_snapshot_id == Some(snapshot.id.as_str());

            for file in snapshot.files {
                let entry = files_by_path
                    .entry(file.relative_path.clone())
                    .or_insert_with(|| {
                        AccumulatedFile::new(
                            &snapshot.id,
                            &snapshot.created_at,
                            &snapshot.source_root,
                        )
                    });
                entry.record_seen(
                    &snapshot.id,
                    &snapshot.created_at,
                    &snapshot.source_root,
                    &file,
                    is_latest,
                );

                if is_latest {
                    total_original_bytes_latest += file.size_bytes;
                    total_block_references_latest += file.blocks.len() as u64;
                    latest_block_hashes.extend(file.blocks.iter().map(|block| block.hash.clone()));
                }
            }
        }

        let mut source_exists_count = 0_u64;
        let mut source_missing_count = 0_u64;
        let mut source_root_missing_count = 0_u64;
        let mut kind_counts: BTreeMap<FileKind, (u64, u64)> = BTreeMap::new();
        let mut files = Vec::with_capacity(files_by_path.len());

        for (relative_path, accumulated) in files_by_path {
            let kind = classify_file_kind(&relative_path);
            let snapshot_state = if accumulated.present_in_latest {
                SnapshotPresenceState::PresentInLatest
            } else {
                SnapshotPresenceState::DeletedInLatest
            };
            let source_state = source_state_for(&accumulated.source_root, &relative_path)?;

            match source_state {
                SourceExistenceState::Exists => source_exists_count += 1,
                SourceExistenceState::Missing => source_missing_count += 1,
                SourceExistenceState::SourceRootMissing => source_root_missing_count += 1,
                SourceExistenceState::Unchecked => {}
            }

            if accumulated.present_in_latest {
                let stat = kind_counts.entry(kind.clone()).or_insert((0, 0));
                stat.0 += 1;
                stat.1 += accumulated.latest_size_bytes.unwrap_or(0);
            }

            files.push(accumulated.into_entry(relative_path, kind, snapshot_state, source_state));
        }

        let latest_file_count = files
            .iter()
            .filter(|file| file.snapshot_state == SnapshotPresenceState::PresentInLatest)
            .count() as u64;
        let deleted_in_latest_count = files.len() as u64 - latest_file_count;
        let kind_stats = kind_counts
            .into_iter()
            .map(|(kind, (file_count, total_bytes_latest))| FileKindStat {
                kind,
                file_count,
                total_bytes_latest,
            })
            .collect();

        Ok(RepositoryInventoryReport {
            schema_version: REPORT_SCHEMA_VERSION,
            repository_path: repository_path.display().to_string(),
            generated_at: Utc::now().to_rfc3339(),
            snapshot_count: snapshot_items.len() as u64,
            known_file_count: files.len() as u64,
            latest_file_count,
            deleted_in_latest_count,
            source_exists_count,
            source_missing_count,
            source_root_missing_count,
            total_original_bytes_latest,
            total_block_references_latest,
            unique_block_count_latest: latest_block_hashes.len() as u64,
            kind_stats,
            files,
        })
    }
}

impl Default for InventoryService {
    fn default() -> Self {
        Self::new()
    }
}

struct AccumulatedFile {
    source_root: String,
    first_seen_snapshot_id: String,
    first_seen_at: String,
    last_seen_snapshot_id: String,
    last_seen_at: String,
    seen_in_snapshot_count: u64,
    present_in_latest: bool,
    latest_size_bytes: Option<u64>,
    latest_modified_at: Option<String>,
    block_reference_count_latest: u64,
}

impl AccumulatedFile {
    fn new(snapshot_id: &str, snapshot_created_at: &str, source_root: &str) -> Self {
        Self {
            source_root: source_root.to_string(),
            first_seen_snapshot_id: snapshot_id.to_string(),
            first_seen_at: snapshot_created_at.to_string(),
            last_seen_snapshot_id: snapshot_id.to_string(),
            last_seen_at: snapshot_created_at.to_string(),
            seen_in_snapshot_count: 0,
            present_in_latest: false,
            latest_size_bytes: None,
            latest_modified_at: None,
            block_reference_count_latest: 0,
        }
    }

    fn record_seen(
        &mut self,
        snapshot_id: &str,
        snapshot_created_at: &str,
        source_root: &str,
        file: &SnapshotFile,
        is_latest: bool,
    ) {
        self.source_root = source_root.to_string();
        self.last_seen_snapshot_id = snapshot_id.to_string();
        self.last_seen_at = snapshot_created_at.to_string();
        self.seen_in_snapshot_count += 1;

        if is_latest {
            self.present_in_latest = true;
            self.latest_size_bytes = Some(file.size_bytes);
            self.latest_modified_at = Some(file.modified_at.clone());
            self.block_reference_count_latest = file.blocks.len() as u64;
        }
    }

    fn into_entry(
        self,
        relative_path: String,
        kind: FileKind,
        snapshot_state: SnapshotPresenceState,
        source_state: SourceExistenceState,
    ) -> InventoryFileEntry {
        InventoryFileEntry {
            file_name: file_name(&relative_path),
            extension: extension(&relative_path),
            relative_path,
            kind,
            snapshot_state,
            source_state,
            latest_size_bytes: self.latest_size_bytes,
            latest_modified_at: self.latest_modified_at,
            first_seen_snapshot_id: self.first_seen_snapshot_id,
            first_seen_at: self.first_seen_at,
            last_seen_snapshot_id: self.last_seen_snapshot_id,
            last_seen_at: self.last_seen_at,
            seen_in_snapshot_count: self.seen_in_snapshot_count,
            block_reference_count_latest: self.block_reference_count_latest,
        }
    }
}

fn source_state_for(source_root: &str, relative_path: &str) -> ChronaResult<SourceExistenceState> {
    if source_root.is_empty() {
        return Ok(SourceExistenceState::Unchecked);
    }

    let relative_path = metadata_relative_path_to_path_buf(relative_path)?;
    let root = Path::new(source_root);
    if root.is_file() {
        let is_source_file = relative_path.components().count() == 1
            && root.file_name() == relative_path.file_name();
        return Ok(if is_source_file {
            SourceExistenceState::Exists
        } else {
            SourceExistenceState::Missing
        });
    }
    if !root.is_dir() {
        return Ok(SourceExistenceState::SourceRootMissing);
    }

    Ok(if root.join(relative_path).is_file() {
        SourceExistenceState::Exists
    } else {
        SourceExistenceState::Missing
    })
}

fn file_name(relative_path: &str) -> String {
    relative_path
        .rsplit('/')
        .next()
        .unwrap_or(relative_path)
        .to_string()
}

fn extension(relative_path: &str) -> Option<String> {
    file_name(relative_path)
        .rsplit_once('.')
        .map(|(_, extension)| extension.to_ascii_lowercase())
}

pub fn classify_file_kind(relative_path: &str) -> FileKind {
    let file_name = relative_path.rsplit('/').next().unwrap_or_default();
    if !file_name.contains('.') {
        return FileKind::Folderless;
    }

    let extension = file_name
        .rsplit('.')
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase();

    match extension.as_str() {
        "pdf" | "doc" | "docx" | "ppt" | "pptx" | "xls" | "xlsx" | "md" | "rtf" => {
            FileKind::Document
        }
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "heic" | "svg" => FileKind::Image,
        "mp4" | "mov" | "mkv" | "avi" | "webm" => FileKind::Video,
        "mp3" | "wav" | "flac" | "aac" | "m4a" | "ogg" => FileKind::Audio,
        "zip" | "tar" | "gz" | "bz2" | "xz" | "7z" | "rar" => FileKind::Archive,
        "rs" | "ts" | "tsx" | "js" | "jsx" | "py" | "java" | "c" | "cpp" | "h" | "go" | "swift"
        | "kt" | "html" | "css" | "json" | "toml" | "yaml" | "yml" => FileKind::Code,
        "txt" | "log" | "csv" => FileKind::Text,
        "sqlite" | "db" | "parquet" | "xml" => FileKind::Data,
        "bin" | "dat" => FileKind::Binary,
        _ => FileKind::Unknown,
    }
}
