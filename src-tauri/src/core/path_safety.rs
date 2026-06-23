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

pub fn assert_repository_restore_target_separate(
    repository: &Path,
    restore_target: &Path,
) -> ChronaResult<PathBuf> {
    let repository = repository.canonicalize()?;
    let restore_target = canonicalize_existing_or_parent(restore_target)?;

    if restore_target == repository || restore_target.starts_with(&repository) {
        return Err(ChronaError::UnsafeRestoreTarget(format!(
            "restore target `{}` must not be inside repository `{}`",
            restore_target.display(),
            repository.display()
        )));
    }

    if repository.starts_with(&restore_target) {
        return Err(ChronaError::UnsafeRestoreTarget(format!(
            "repository `{}` must not be inside restore target `{}`",
            repository.display(),
            restore_target.display()
        )));
    }

    Ok(restore_target)
}

pub fn metadata_relative_path_to_path_buf(relative_path: &str) -> ChronaResult<PathBuf> {
    if relative_path.is_empty() {
        return Err(ChronaError::UnsafeRelativePath(
            "relative path cannot be empty".to_string(),
        ));
    }
    if relative_path.starts_with('/') || relative_path.starts_with('\\') {
        return Err(ChronaError::UnsafeRelativePath(format!(
            "absolute path is not allowed: {relative_path}"
        )));
    }
    if relative_path.contains('\\') {
        return Err(ChronaError::UnsafeRelativePath(format!(
            "metadata paths must use `/` separators only: {relative_path}"
        )));
    }

    let mut path = PathBuf::new();
    for part in relative_path.split('/') {
        if part.is_empty() || part == "." || part == ".." {
            return Err(ChronaError::UnsafeRelativePath(format!(
                "unsafe relative path segment in {relative_path}"
            )));
        }
        if path.as_os_str().is_empty() && part.ends_with(':') {
            return Err(ChronaError::UnsafeRelativePath(format!(
                "drive prefix is not allowed: {relative_path}"
            )));
        }
        path.push(part);
    }

    normalize_relative_path(&path)?;
    Ok(path)
}

fn canonicalize_existing_or_parent(path: &Path) -> ChronaResult<PathBuf> {
    if path.exists() {
        return Ok(path.canonicalize()?);
    }

    let parent = path.parent().ok_or_else(|| {
        ChronaError::Io(format!(
            "restore target has no parent directory: {}",
            path.display()
        ))
    })?;
    let file_name = path.file_name().ok_or_else(|| {
        ChronaError::Io(format!(
            "restore target has no final path component: {}",
            path.display()
        ))
    })?;

    Ok(parent.canonicalize()?.join(file_name))
}
