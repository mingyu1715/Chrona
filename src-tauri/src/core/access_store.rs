use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use chrono::Utc;

use crate::core::access_index::AccessIndex;
use crate::core::errors::{ChronaError, ChronaResult};
use crate::core::repository::RepositoryManager;
use crate::models::access::AccessIndexDocument;

const ACCESS_INDEX_FILE: &str = "access-index.json";
const ACCESS_INDEX_SCHEMA_VERSION: u32 = 1;

pub struct AccessStore {
    repository_path: PathBuf,
}

impl AccessStore {
    pub fn new(repository_path: PathBuf) -> Self {
        Self { repository_path }
    }

    pub fn load(&self) -> ChronaResult<AccessIndex> {
        RepositoryManager::open(&self.repository_path)?;
        self.ensure_layout()?;
        let path = self.index_path();
        if !path.is_file() {
            return Ok(AccessIndex::new());
        }
        let document: AccessIndexDocument = serde_json::from_str(&fs::read_to_string(path)?)?;
        if document.schema_version != ACCESS_INDEX_SCHEMA_VERSION {
            return Err(ChronaError::InvalidRepository(format!(
                "unsupported access index schema version {}",
                document.schema_version
            )));
        }
        Ok(AccessIndex::from_nodes(document.items))
    }

    pub fn save(&self, index: &AccessIndex) -> ChronaResult<()> {
        RepositoryManager::open(&self.repository_path)?;
        self.ensure_layout()?;
        let document = AccessIndexDocument {
            schema_version: ACCESS_INDEX_SCHEMA_VERSION,
            updated_at: Utc::now().to_rfc3339(),
            items: index.items(),
        };
        let bytes = serde_json::to_vec(&document)?;
        let final_path = self.index_path();
        let tmp_path = final_path.with_extension("json.tmp");
        write_tmp_then_rename(&tmp_path, &final_path, &bytes)
    }

    fn ensure_layout(&self) -> ChronaResult<()> {
        fs::create_dir_all(self.indexes_dir())?;
        Ok(())
    }

    fn indexes_dir(&self) -> PathBuf {
        self.repository_path.join("indexes")
    }

    fn index_path(&self) -> PathBuf {
        self.indexes_dir().join(ACCESS_INDEX_FILE)
    }
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
