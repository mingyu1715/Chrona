use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use crate::core::errors::{ChronaError, ChronaResult};
use crate::models::snapshot::{Snapshot, SnapshotIndex, SnapshotIndexItem};

const SNAPSHOT_INDEX_FILE: &str = "snapshot-index.json";

pub struct SnapshotStore {
    repository_path: PathBuf,
}

impl SnapshotStore {
    pub fn new(repository_path: PathBuf) -> Self {
        Self { repository_path }
    }

    pub fn ensure_layout(&self) -> ChronaResult<()> {
        fs::create_dir_all(self.snapshots_dir())?;
        fs::create_dir_all(self.indexes_dir())?;
        let index_path = self.index_path();
        if !index_path.is_file() {
            self.write_index(&SnapshotIndex {
                schema_version: 1,
                snapshots: Vec::new(),
            })?;
        }
        Ok(())
    }

    pub fn write_snapshot(&self, snapshot: &Snapshot) -> ChronaResult<()> {
        validate_snapshot_id(&snapshot.id)?;
        self.ensure_layout()?;
        let final_path = self.snapshot_path(&snapshot.id)?;
        let tmp_path = final_path.with_extension("json.tmp");
        let bytes = serde_json::to_vec(snapshot)?;
        write_tmp_then_rename(&tmp_path, &final_path, &bytes)
    }

    pub fn get_snapshot(&self, snapshot_id: &str) -> ChronaResult<Snapshot> {
        validate_snapshot_id(snapshot_id)?;
        let path = self.snapshot_path(snapshot_id)?;
        if !path.is_file() {
            return Err(ChronaError::SnapshotNotFound(snapshot_id.to_string()));
        }
        Ok(serde_json::from_str(&fs::read_to_string(path)?)?)
    }

    pub fn list_snapshots(&self) -> ChronaResult<Vec<SnapshotIndexItem>> {
        self.ensure_layout()?;
        Ok(self.read_index()?.snapshots)
    }

    pub fn add_to_index(&self, snapshot: &Snapshot) -> ChronaResult<()> {
        validate_snapshot_id(&snapshot.id)?;
        self.ensure_layout()?;
        let mut index = self.read_index()?;
        index.snapshots.retain(|item| item.id != snapshot.id);
        index.snapshots.push(SnapshotIndexItem {
            id: snapshot.id.clone(),
            name: snapshot.name.clone(),
            created_at: snapshot.created_at.clone(),
            source_root: snapshot.source_root.clone(),
            file_count: snapshot.summary.file_count,
            total_original_bytes: snapshot.summary.total_original_bytes,
            new_stored_bytes: snapshot.summary.new_stored_bytes,
        });
        index
            .snapshots
            .sort_by(|left, right| right.created_at.cmp(&left.created_at));
        self.write_index(&index)
    }

    fn read_index(&self) -> ChronaResult<SnapshotIndex> {
        let index_path = self.index_path();
        if !index_path.is_file() {
            return Ok(SnapshotIndex {
                schema_version: 1,
                snapshots: Vec::new(),
            });
        }
        Ok(serde_json::from_str(&fs::read_to_string(index_path)?)?)
    }

    fn write_index(&self, index: &SnapshotIndex) -> ChronaResult<()> {
        fs::create_dir_all(self.indexes_dir())?;
        let final_path = self.index_path();
        let tmp_path = final_path.with_extension("json.tmp");
        let bytes = serde_json::to_vec(index)?;
        write_tmp_then_rename(&tmp_path, &final_path, &bytes)
    }

    fn snapshot_path(&self, snapshot_id: &str) -> ChronaResult<PathBuf> {
        validate_snapshot_id(snapshot_id)?;
        Ok(self.snapshots_dir().join(format!("{snapshot_id}.json")))
    }

    fn snapshots_dir(&self) -> PathBuf {
        self.repository_path.join("snapshots")
    }

    fn indexes_dir(&self) -> PathBuf {
        self.repository_path.join("indexes")
    }

    fn index_path(&self) -> PathBuf {
        self.indexes_dir().join(SNAPSHOT_INDEX_FILE)
    }
}

fn validate_snapshot_id(snapshot_id: &str) -> ChronaResult<()> {
    if snapshot_id.is_empty()
        || !snapshot_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
    {
        return Err(ChronaError::InvalidSnapshotId(snapshot_id.to_string()));
    }
    Ok(())
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
