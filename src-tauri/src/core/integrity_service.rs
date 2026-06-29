use std::collections::{HashMap, HashSet};
use std::path::Path;

use chrono::Utc;

use crate::core::block_store::BlockStore;
use crate::core::errors::{ChronaError, ChronaResult};
use crate::core::hasher::sha256_hex;
use crate::core::repository::RepositoryManager;
use crate::core::snapshot_store::SnapshotStore;
use crate::models::integrity::{
    IntegrityIssue, IntegrityIssueSeverity, IntegrityReport, IntegrityStatus,
};

const REPORT_SCHEMA_VERSION: u32 = 1;

pub struct IntegrityService;

impl IntegrityService {
    pub fn new() -> Self {
        Self
    }

    pub fn verify_repository(&self, repository_path: &Path) -> ChronaResult<IntegrityReport> {
        RepositoryManager::open(repository_path)?;
        let snapshot_store = SnapshotStore::new(repository_path.to_path_buf());
        let block_store = BlockStore::new(repository_path.to_path_buf());
        let snapshot_items = snapshot_store.list_snapshots()?;
        let mut issues = Vec::new();
        let mut file_count = 0_u64;
        let mut block_reference_count = 0_u64;
        let mut expected_blocks: HashMap<String, ExpectedBlock> = HashMap::new();

        for item in &snapshot_items {
            let snapshot = match snapshot_store.get_snapshot(&item.id) {
                Ok(snapshot) => snapshot,
                Err(error) => {
                    issues.push(IntegrityIssue {
                        severity: IntegrityIssueSeverity::Error,
                        code: "snapshotReadFailed".to_string(),
                        message: format!("failed to read snapshot `{}`: {error}", item.id),
                        snapshot_id: Some(item.id.clone()),
                        relative_path: None,
                        block_hash: None,
                    });
                    continue;
                }
            };

            file_count += snapshot.files.len() as u64;
            for file in snapshot.files {
                block_reference_count += file.blocks.len() as u64;
                for block in file.blocks {
                    match expected_blocks.get(&block.hash) {
                        Some(expected) if expected.size_bytes != block.size_bytes => {
                            issues.push(IntegrityIssue {
                                severity: IntegrityIssueSeverity::Error,
                                code: "blockSizeConflict".to_string(),
                                message: format!(
                                    "block `{}` is referenced with conflicting sizes: {} and {} bytes",
                                    block.hash, expected.size_bytes, block.size_bytes
                                ),
                                snapshot_id: Some(snapshot.id.clone()),
                                relative_path: Some(file.relative_path.clone()),
                                block_hash: Some(block.hash.clone()),
                            });
                        }
                        Some(_) => {}
                        None => {
                            expected_blocks.insert(
                                block.hash.clone(),
                                ExpectedBlock {
                                    size_bytes: block.size_bytes,
                                    snapshot_id: snapshot.id.clone(),
                                    relative_path: file.relative_path.clone(),
                                },
                            );
                        }
                    }
                }
            }
        }

        let mut missing_block_count = 0_u64;
        let mut corrupt_block_hashes = HashSet::new();

        for (hash, expected) in &expected_blocks {
            let relative_path = match BlockStore::block_relative_path(hash) {
                Ok(path) => path,
                Err(error) => {
                    corrupt_block_hashes.insert(hash.clone());
                    issues.push(IntegrityIssue {
                        severity: IntegrityIssueSeverity::Error,
                        code: "invalidBlockHash".to_string(),
                        message: format!("invalid block hash `{hash}`: {error}"),
                        snapshot_id: Some(expected.snapshot_id.clone()),
                        relative_path: Some(expected.relative_path.clone()),
                        block_hash: Some(hash.clone()),
                    });
                    continue;
                }
            };
            let block_path = repository_path.join(relative_path);
            if !block_path.is_file() {
                missing_block_count += 1;
                issues.push(IntegrityIssue {
                    severity: IntegrityIssueSeverity::Error,
                    code: "missingBlock".to_string(),
                    message: format!("missing block file for `{hash}`"),
                    snapshot_id: Some(expected.snapshot_id.clone()),
                    relative_path: Some(expected.relative_path.clone()),
                    block_hash: Some(hash.clone()),
                });
                continue;
            }

            let bytes = match block_store.read_block(hash) {
                Ok(bytes) => bytes,
                Err(
                    error @ (ChronaError::Decompression(_)
                    | ChronaError::InvalidBlockEnvelope(_)
                    | ChronaError::UnsupportedBlockEncoding(_)),
                ) => {
                    corrupt_block_hashes.insert(hash.clone());
                    issues.push(IntegrityIssue {
                        severity: IntegrityIssueSeverity::Error,
                        code: "blockDecodeFailed".to_string(),
                        message: format!("failed to decode block `{hash}`: {error}"),
                        snapshot_id: Some(expected.snapshot_id.clone()),
                        relative_path: Some(expected.relative_path.clone()),
                        block_hash: Some(hash.clone()),
                    });
                    continue;
                }
                Err(error) => {
                    corrupt_block_hashes.insert(hash.clone());
                    issues.push(IntegrityIssue {
                        severity: IntegrityIssueSeverity::Error,
                        code: "blockReadFailed".to_string(),
                        message: format!("failed to read block `{hash}`: {error}"),
                        snapshot_id: Some(expected.snapshot_id.clone()),
                        relative_path: Some(expected.relative_path.clone()),
                        block_hash: Some(hash.clone()),
                    });
                    continue;
                }
            };

            if bytes.len() as u64 != expected.size_bytes {
                corrupt_block_hashes.insert(hash.clone());
                issues.push(IntegrityIssue {
                    severity: IntegrityIssueSeverity::Error,
                    code: "blockSizeMismatch".to_string(),
                    message: format!(
                        "block `{hash}` has {} bytes but snapshot expects {} bytes",
                        bytes.len(),
                        expected.size_bytes
                    ),
                    snapshot_id: Some(expected.snapshot_id.clone()),
                    relative_path: Some(expected.relative_path.clone()),
                    block_hash: Some(hash.clone()),
                });
            }

            let actual_hash = sha256_hex(&bytes);
            if actual_hash != *hash {
                corrupt_block_hashes.insert(hash.clone());
                issues.push(IntegrityIssue {
                    severity: IntegrityIssueSeverity::Error,
                    code: "blockHashMismatch".to_string(),
                    message: format!("block `{hash}` content hash is `{actual_hash}`"),
                    snapshot_id: Some(expected.snapshot_id.clone()),
                    relative_path: Some(expected.relative_path.clone()),
                    block_hash: Some(hash.clone()),
                });
            }
        }

        let status = report_status(&issues);
        Ok(IntegrityReport {
            schema_version: REPORT_SCHEMA_VERSION,
            repository_path: repository_path.display().to_string(),
            checked_at: Utc::now().to_rfc3339(),
            status,
            snapshot_count: snapshot_items.len() as u64,
            file_count,
            block_reference_count,
            unique_block_count: expected_blocks.len() as u64,
            missing_block_count,
            corrupt_block_count: corrupt_block_hashes.len() as u64,
            issues,
        })
    }
}

impl Default for IntegrityService {
    fn default() -> Self {
        Self::new()
    }
}

struct ExpectedBlock {
    size_bytes: u64,
    snapshot_id: String,
    relative_path: String,
}

fn report_status(issues: &[IntegrityIssue]) -> IntegrityStatus {
    if issues
        .iter()
        .any(|issue| issue.severity == IntegrityIssueSeverity::Error)
    {
        IntegrityStatus::Failed
    } else if issues.is_empty() {
        IntegrityStatus::Healthy
    } else {
        IntegrityStatus::Warning
    }
}
