use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;

use chrono::Utc;
use uuid::Uuid;

use crate::core::errors::{ChronaError, ChronaResult};
use crate::models::repository::{BlockStrategy, CompressionMode, RepositoryManifest};

const CURRENT_SCHEMA_VERSION: u32 = 2;
const LEGACY_SCHEMA_VERSION: u32 = 1;
const BLOCK_SIZE_BYTES: u64 = 1_048_576;
const SNAPSHOT_INDEX_FILE: &str = "snapshot-index.json";

pub struct RepositoryManager;

impl RepositoryManager {
    pub fn create(repository_path: &Path) -> ChronaResult<RepositoryManifest> {
        fs::create_dir_all(repository_path)?;
        fs::create_dir_all(repository_path.join("blocks"))?;
        fs::create_dir_all(repository_path.join("indexes"))?;
        fs::create_dir_all(repository_path.join("logs"))?;
        ensure_snapshot_layout(repository_path)?;

        let manifest = RepositoryManifest {
            schema_version: CURRENT_SCHEMA_VERSION,
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            repository_id: Uuid::new_v4().to_string(),
            created_at: Utc::now().to_rfc3339(),
            block_strategy: BlockStrategy {
                strategy_type: "fixed".to_string(),
                size_bytes: BLOCK_SIZE_BYTES,
                hash: "sha256".to_string(),
                encoding_version: 2,
                compression_mode: CompressionMode::Standard,
            },
        };

        write_manifest(repository_path, &manifest)?;
        Ok(manifest)
    }

    pub fn open(repository_path: &Path) -> ChronaResult<RepositoryManifest> {
        let manifest_path = repository_path.join("manifest.json");
        if !manifest_path.is_file() {
            return Err(ChronaError::InvalidRepository(format!(
                "missing manifest at {}",
                manifest_path.display()
            )));
        }

        for required in ["blocks", "indexes", "logs"] {
            let required_path = repository_path.join(required);
            if !required_path.is_dir() {
                return Err(ChronaError::InvalidRepository(format!(
                    "missing directory {}",
                    required_path.display()
                )));
            }
        }

        ensure_snapshot_layout(repository_path)?;

        let manifest: RepositoryManifest =
            serde_json::from_str(&fs::read_to_string(manifest_path)?)?;
        if !matches!(
            manifest.schema_version,
            LEGACY_SCHEMA_VERSION | CURRENT_SCHEMA_VERSION
        ) {
            return Err(ChronaError::UnsupportedRepositoryVersion(
                manifest.schema_version,
            ));
        }
        Ok(manifest)
    }

    pub fn set_compression_mode(
        repository_path: &Path,
        compression_mode: CompressionMode,
    ) -> ChronaResult<RepositoryManifest> {
        let mut manifest = Self::open(repository_path)?;
        manifest.schema_version = CURRENT_SCHEMA_VERSION;
        manifest.block_strategy.encoding_version = 2;
        manifest.block_strategy.compression_mode = compression_mode;
        write_manifest(repository_path, &manifest)?;
        Ok(manifest)
    }
}

fn write_manifest(repository_path: &Path, manifest: &RepositoryManifest) -> ChronaResult<()> {
    let final_path = repository_path.join("manifest.json");
    let tmp_path = repository_path.join("manifest.json.tmp");
    let bytes = serde_json::to_vec(manifest)?;
    let write_result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&tmp_path)?;
        file.write_all(&bytes)?;
        file.sync_all()?;
        drop(file);
        fs::rename(&tmp_path, &final_path)?;
        Ok(())
    })();

    if let Err(error) = write_result {
        let _ = fs::remove_file(tmp_path);
        return Err(error);
    }

    Ok(())
}

fn ensure_snapshot_layout(repository_path: &Path) -> ChronaResult<()> {
    fs::create_dir_all(repository_path.join("snapshots"))?;
    let index_path = repository_path.join("indexes").join(SNAPSHOT_INDEX_FILE);
    if !index_path.is_file() {
        fs::write(index_path, r#"{"schemaVersion":1,"snapshots":[]}"#)?;
    }
    Ok(())
}
