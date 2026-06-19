use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};

use crate::core::errors::{ChronaError, ChronaResult};
use crate::core::path_safety::normalize_from_base;
use crate::models::block::ScannedFile;

pub struct FileScanner;

impl FileScanner {
    pub fn scan(source_path: &Path) -> ChronaResult<Vec<ScannedFile>> {
        let source_path = source_path.canonicalize()?;
        let metadata = fs::metadata(&source_path)?;

        let base = if metadata.is_file() {
            source_path
                .parent()
                .map(Path::to_path_buf)
                .ok_or_else(|| ChronaError::Scan("source file has no parent".to_string()))?
        } else {
            source_path.clone()
        };

        let mut files = Vec::new();
        if metadata.is_file() {
            files.push(scanned_file(&base, source_path)?);
        } else if metadata.is_dir() {
            collect_files(&base, &source_path, &mut files)?;
        } else {
            return Err(ChronaError::Scan(format!(
                "source path is neither file nor directory: {}",
                source_path.display()
            )));
        }

        files.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));
        Ok(files)
    }
}

fn collect_files(base: &Path, current: &Path, files: &mut Vec<ScannedFile>) -> ChronaResult<()> {
    for entry in fs::read_dir(current)? {
        let entry = entry?;
        let path = entry.path();
        let metadata = entry.metadata()?;
        if metadata.is_dir() {
            collect_files(base, &path, files)?;
        } else if metadata.is_file() {
            files.push(scanned_file(base, path)?);
        }
    }
    Ok(())
}

fn scanned_file(base: &Path, absolute_path: PathBuf) -> ChronaResult<ScannedFile> {
    let metadata = fs::metadata(&absolute_path)?;
    let modified_at = metadata.modified().ok().map(DateTime::<Utc>::from);
    Ok(ScannedFile {
        relative_path: normalize_from_base(base, &absolute_path)?,
        absolute_path,
        size_bytes: metadata.len(),
        modified_at: modified_at
            .map(|date| date.to_rfc3339())
            .unwrap_or_else(|| Utc::now().to_rfc3339()),
    })
}
