use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use chrono::Utc;
use uuid::Uuid;

use crate::core::errors::{ChronaError, ChronaResult};
use crate::models::snapshot::SnapshotIndexItem;
use crate::models::source::{BackupSource, SourceIndex, SourceStatus};

const SOURCE_INDEX_FILE: &str = "source-index.json";
const SOURCE_INDEX_SCHEMA_VERSION: u32 = 1;

pub struct SourceStore {
    repository_path: PathBuf,
}

impl SourceStore {
    pub fn new(repository_path: PathBuf) -> Self {
        Self { repository_path }
    }

    pub fn ensure_layout(&self) -> ChronaResult<()> {
        fs::create_dir_all(self.indexes_dir())?;
        if !self.index_path().is_file() {
            self.write_index(&SourceIndex {
                schema_version: SOURCE_INDEX_SCHEMA_VERSION,
                sources: Vec::new(),
            })?;
        }
        Ok(())
    }

    pub fn list_sources(&self) -> ChronaResult<SourceIndex> {
        self.ensure_layout()?;
        let mut index = self.read_index()?;
        for source in &mut index.sources {
            source.status = status_for_path(&source.path);
        }
        Ok(index)
    }

    pub fn find_or_create_for_path(&self, source_path: &Path) -> ChronaResult<BackupSource> {
        self.ensure_layout()?;
        let canonical_path = source_path.canonicalize()?;
        let canonical = path_to_string(&canonical_path)?;
        let mut index = self.read_index()?;

        if let Some(existing) = index.sources.iter().find(|source| source.path == canonical) {
            let mut existing = existing.clone();
            existing.status = status_for_path(&existing.path);
            return Ok(existing);
        }

        let now = Utc::now().to_rfc3339();
        let source = BackupSource {
            id: generate_source_id(),
            display_name: default_display_name(&canonical_path),
            path: canonical,
            created_at: now.clone(),
            updated_at: now,
            latest_snapshot_id: None,
            latest_snapshot_at: None,
            snapshot_count: 0,
            status: SourceStatus::Available,
        };
        index.sources.push(source.clone());
        index.sources.sort_by(|left, right| {
            left.display_name
                .to_ascii_lowercase()
                .cmp(&right.display_name.to_ascii_lowercase())
                .then_with(|| left.path.cmp(&right.path))
        });
        self.write_index(&index)?;
        Ok(source)
    }

    pub fn rename_source(&self, source_id: &str, display_name: &str) -> ChronaResult<SourceIndex> {
        let next_name = display_name.trim();
        if next_name.is_empty() {
            return Err(ChronaError::InvalidSourceIndex(
                "source display name cannot be empty".to_string(),
            ));
        }
        self.ensure_layout()?;
        let mut index = self.read_index()?;
        let source = index
            .sources
            .iter_mut()
            .find(|source| source.id == source_id)
            .ok_or_else(|| ChronaError::SourceNotFound(source_id.to_string()))?;
        source.display_name = next_name.to_string();
        source.updated_at = Utc::now().to_rfc3339();
        self.write_index(&index)?;
        self.list_sources()
    }

    pub fn remove_source(&self, source_id: &str) -> ChronaResult<SourceIndex> {
        self.ensure_layout()?;
        let mut index = self.read_index()?;
        let original_len = index.sources.len();
        index.sources.retain(|source| source.id != source_id);
        if index.sources.len() == original_len {
            return Err(ChronaError::SourceNotFound(source_id.to_string()));
        }
        self.write_index(&index)?;
        self.list_sources()
    }

    pub fn record_snapshot(
        &self,
        source_id: &str,
        snapshot_id: &str,
        snapshot_created_at: &str,
    ) -> ChronaResult<BackupSource> {
        self.ensure_layout()?;
        let mut index = self.read_index()?;
        let source = index
            .sources
            .iter_mut()
            .find(|source| source.id == source_id)
            .ok_or_else(|| ChronaError::SourceNotFound(source_id.to_string()))?;
        source.latest_snapshot_id = Some(snapshot_id.to_string());
        source.latest_snapshot_at = Some(snapshot_created_at.to_string());
        source.snapshot_count += 1;
        source.updated_at = Utc::now().to_rfc3339();
        source.status = status_for_path(&source.path);
        let updated = source.clone();
        self.write_index(&index)?;
        Ok(updated)
    }

    pub fn rebuild_snapshot_links(
        &self,
        snapshots: &[SnapshotIndexItem],
    ) -> ChronaResult<SourceIndex> {
        self.ensure_layout()?;
        let mut index = self.read_index()?;
        let now = Utc::now().to_rfc3339();

        for source in &mut index.sources {
            source.latest_snapshot_id = None;
            source.latest_snapshot_at = None;
            source.snapshot_count = 0;
            source.updated_at = now.clone();
        }

        for snapshot in snapshots {
            let Some(source_id) = snapshot.source_id.as_deref() else {
                continue;
            };
            let Some(source) = index
                .sources
                .iter_mut()
                .find(|source| source.id == source_id)
            else {
                continue;
            };
            source.snapshot_count += 1;
            let is_latest = source
                .latest_snapshot_at
                .as_deref()
                .map_or(true, |current| snapshot.created_at.as_str() > current);
            if is_latest {
                source.latest_snapshot_id = Some(snapshot.id.clone());
                source.latest_snapshot_at = Some(snapshot.created_at.clone());
            }
        }

        self.write_index(&index)?;
        self.list_sources()
    }

    fn read_index(&self) -> ChronaResult<SourceIndex> {
        let path = self.index_path();
        if !path.is_file() {
            return Ok(SourceIndex {
                schema_version: SOURCE_INDEX_SCHEMA_VERSION,
                sources: Vec::new(),
            });
        }
        let mut index: SourceIndex = serde_json::from_str(&fs::read_to_string(path)?)?;
        if index.schema_version != SOURCE_INDEX_SCHEMA_VERSION {
            return Err(ChronaError::InvalidSourceIndex(format!(
                "unsupported source index schema {}",
                index.schema_version
            )));
        }
        validate_unique_sources(&index)?;
        for source in &mut index.sources {
            source.status = status_for_path(&source.path);
        }
        Ok(index)
    }

    fn write_index(&self, index: &SourceIndex) -> ChronaResult<()> {
        validate_unique_sources(index)?;
        fs::create_dir_all(self.indexes_dir())?;
        let final_path = self.index_path();
        let tmp_path = final_path.with_extension("json.tmp");
        let bytes = serde_json::to_vec_pretty(index)?;
        write_tmp_then_rename(&tmp_path, &final_path, &bytes)
    }

    fn indexes_dir(&self) -> PathBuf {
        self.repository_path.join("indexes")
    }

    fn index_path(&self) -> PathBuf {
        self.indexes_dir().join(SOURCE_INDEX_FILE)
    }
}

fn validate_unique_sources(index: &SourceIndex) -> ChronaResult<()> {
    let mut ids = std::collections::BTreeSet::new();
    let mut paths = std::collections::BTreeSet::new();
    for source in &index.sources {
        if source.id.trim().is_empty() {
            return Err(ChronaError::InvalidSourceIndex(
                "source id cannot be empty".to_string(),
            ));
        }
        if !ids.insert(source.id.clone()) {
            return Err(ChronaError::InvalidSourceIndex(format!(
                "duplicate source id {}",
                source.id
            )));
        }
        if !paths.insert(source.path.clone()) {
            return Err(ChronaError::SourceAlreadyRegistered(source.path.clone()));
        }
    }
    Ok(())
}

fn status_for_path(path: &str) -> SourceStatus {
    if Path::new(path).exists() {
        SourceStatus::Available
    } else {
        SourceStatus::Missing
    }
}

fn default_display_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().trim().to_string())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "Backup Source".to_string())
}

fn generate_source_id() -> String {
    format!("source-{}", Uuid::new_v4())
}

fn path_to_string(path: &Path) -> ChronaResult<String> {
    path.to_str().map(str::to_string).ok_or_else(|| {
        ChronaError::UnsafeRelativePath(format!(
            "source path is not valid UTF-8: {}",
            path.display()
        ))
    })
}

fn write_tmp_then_rename(tmp_path: &Path, final_path: &Path, bytes: &[u8]) -> ChronaResult<()> {
    let write_result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(tmp_path)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        drop(file);
        fs::rename(tmp_path, final_path)?;
        Ok(())
    })();

    if let Err(error) = write_result {
        let _ = fs::remove_file(tmp_path);
        return Err(error);
    }

    Ok(())
}
