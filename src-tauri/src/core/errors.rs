use std::path::PathBuf;

#[derive(Debug, thiserror::Error)]
pub enum ChronaError {
    #[error("InvalidRepository: {0}")]
    InvalidRepository(String),
    #[error("UnsupportedRepositoryVersion: {0}")]
    UnsupportedRepositoryVersion(u32),
    #[error("SourceInsideRepository: source path `{source_path}` is inside repository path `{repository_path}`")]
    SourceInsideRepository {
        source_path: PathBuf,
        repository_path: PathBuf,
    },
    #[error("RepositoryInsideSource: repository path `{repository_path}` is inside source path `{source_path}`")]
    RepositoryInsideSource {
        source_path: PathBuf,
        repository_path: PathBuf,
    },
    #[error("UnsafeRelativePath: {0}")]
    UnsafeRelativePath(String),
    #[error("Io: {0}")]
    Io(String),
    #[error("Scan: {0}")]
    Scan(String),
    #[error("Hash: {0}")]
    Hash(String),
    #[error("InvalidSnapshotId: {0}")]
    InvalidSnapshotId(String),
    #[error("SnapshotNotFound: {0}")]
    SnapshotNotFound(String),
    #[error("UnsafeRestoreTarget: {0}")]
    UnsafeRestoreTarget(String),
    #[error("MissingBlock: {0}")]
    MissingBlock(String),
    #[error("Restore: {0}")]
    Restore(String),
}

impl From<std::io::Error> for ChronaError {
    fn from(error: std::io::Error) -> Self {
        ChronaError::Io(error.to_string())
    }
}

impl From<serde_json::Error> for ChronaError {
    fn from(error: serde_json::Error) -> Self {
        ChronaError::InvalidRepository(error.to_string())
    }
}

pub type ChronaResult<T> = Result<T, ChronaError>;
