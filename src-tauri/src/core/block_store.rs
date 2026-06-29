use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use crate::core::block_codec::{decode_block, encode_block};
use crate::core::errors::{ChronaError, ChronaResult};
use crate::models::block::BlockStoreWrite;
use crate::models::repository::CompressionMode;

pub struct BlockStore {
    repository_path: PathBuf,
    compression_mode: CompressionMode,
}

impl BlockStore {
    pub fn new(repository_path: PathBuf) -> Self {
        Self {
            repository_path,
            compression_mode: CompressionMode::Off,
        }
    }

    pub fn with_compression_mode(
        repository_path: PathBuf,
        compression_mode: CompressionMode,
    ) -> Self {
        Self {
            repository_path,
            compression_mode,
        }
    }

    pub fn block_relative_path(hash: &str) -> ChronaResult<PathBuf> {
        if hash.len() < 4 {
            return Err(ChronaError::Hash(format!(
                "block hash must have at least 4 characters: {hash}"
            )));
        }

        Ok(PathBuf::from("blocks")
            .join(&hash[0..2])
            .join(&hash[2..4])
            .join(format!("{hash}.blk")))
    }

    pub fn read_block(&self, hash: &str) -> ChronaResult<Vec<u8>> {
        let relative_path = Self::block_relative_path(hash)?;
        let path = self.repository_path.join(relative_path);
        if !path.is_file() {
            return Err(ChronaError::MissingBlock(hash.to_string()));
        }
        let stored = fs::read(path)?;
        Ok(decode_block(&stored, hash)?.bytes)
    }

    pub fn store_block(
        &self,
        hash: &str,
        bytes: &[u8],
        operation_id: &str,
    ) -> ChronaResult<BlockStoreWrite> {
        let relative_path = Self::block_relative_path(hash)?;
        let final_path = self.repository_path.join(&relative_path);
        if final_path.is_file() {
            let stored = fs::read(&final_path)?;
            let decoded = decode_block(&stored, hash)?;
            return Ok(BlockStoreWrite {
                hash: hash.to_string(),
                raw_size_bytes: decoded.bytes.len() as u64,
                stored_size_bytes: decoded.stored_size_bytes,
                encoding: decoded.encoding,
                storage_path: relative_path,
                was_new: false,
            });
        }

        let parent = final_path.parent().ok_or_else(|| {
            ChronaError::Io(format!(
                "block path has no parent directory: {}",
                final_path.display()
            ))
        })?;
        fs::create_dir_all(parent)?;

        let tmp_path = tmp_path_for(parent, hash, operation_id);
        let encoded = encode_block(bytes, hash, self.compression_mode)?;
        let write_result = write_tmp_then_rename(&tmp_path, &final_path, &encoded.bytes);
        if let Err(error) = write_result {
            let _ = fs::remove_file(&tmp_path);
            return Err(error);
        }

        Ok(BlockStoreWrite {
            hash: hash.to_string(),
            raw_size_bytes: encoded.raw_size_bytes,
            stored_size_bytes: encoded.stored_size_bytes,
            encoding: encoded.encoding,
            storage_path: relative_path,
            was_new: true,
        })
    }
}

fn tmp_path_for(parent: &Path, hash: &str, operation_id: &str) -> PathBuf {
    parent.join(format!("{hash}.blk.tmp-{operation_id}"))
}

fn write_tmp_then_rename(tmp_path: &Path, final_path: &Path, bytes: &[u8]) -> ChronaResult<()> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(tmp_path)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    drop(file);
    fs::rename(tmp_path, final_path)?;
    Ok(())
}
