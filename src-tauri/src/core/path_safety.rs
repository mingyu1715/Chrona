use std::path::{Component, Path, PathBuf};

use crate::core::errors::{ChronaError, ChronaResult};

pub fn assert_source_repository_separate(source: &Path, repository: &Path) -> ChronaResult<()> {
    let source = source.canonicalize()?;
    let repository = repository.canonicalize()?;

    if source == repository || source.starts_with(&repository) {
        return Err(ChronaError::SourceInsideRepository {
            source_path: source,
            repository_path: repository,
        });
    }

    if repository.starts_with(&source) {
        return Err(ChronaError::RepositoryInsideSource {
            source_path: source,
            repository_path: repository,
        });
    }

    Ok(())
}

pub fn normalize_relative_path(path: impl AsRef<Path>) -> ChronaResult<String> {
    let path = path.as_ref();
    if path.is_absolute() {
        return Err(ChronaError::UnsafeRelativePath(format!(
            "absolute path is not allowed: {}",
            path.display()
        )));
    }

    let mut parts = Vec::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => {
                let part = part.to_str().ok_or_else(|| {
                    ChronaError::UnsafeRelativePath(format!(
                        "path is not valid UTF-8: {}",
                        path.display()
                    ))
                })?;
                parts.push(part.to_string());
            }
            Component::CurDir => {}
            Component::ParentDir => {
                return Err(ChronaError::UnsafeRelativePath(format!(
                    "parent segments are not allowed: {}",
                    path.display()
                )));
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err(ChronaError::UnsafeRelativePath(format!(
                    "root or drive prefix is not allowed: {}",
                    path.display()
                )));
            }
        }
    }

    if parts.is_empty() {
        return Err(ChronaError::UnsafeRelativePath(
            "relative path cannot be empty".to_string(),
        ));
    }

    Ok(parts.join("/"))
}

pub fn normalize_from_base(base: &Path, absolute_path: &Path) -> ChronaResult<String> {
    let relative = absolute_path.strip_prefix(base).map_err(|error| {
        ChronaError::UnsafeRelativePath(format!(
            "failed to derive relative path for {} from {}: {error}",
            absolute_path.display(),
            base.display()
        ))
    })?;
    normalize_relative_path(relative)
}

pub fn canonicalize_existing(path: &Path) -> ChronaResult<PathBuf> {
    Ok(path.canonicalize()?)
}
