use std::fs::File;
use std::io::Read;
use std::path::Path;

use crate::core::errors::ChronaResult;
use crate::models::block::FileChunk;

pub struct FixedChunker {
    block_size: usize,
}

impl FixedChunker {
    pub fn new(block_size: usize) -> Self {
        Self { block_size }
    }

    pub fn chunks_for_file(&self, path: &Path) -> ChronaResult<Vec<FileChunk>> {
        let mut chunks = Vec::new();
        self.for_each_chunk(path, |chunk| {
            chunks.push(chunk);
            Ok(())
        })?;
        Ok(chunks)
    }

    pub fn for_each_chunk<F>(&self, path: &Path, mut on_chunk: F) -> ChronaResult<()>
    where
        F: FnMut(FileChunk) -> ChronaResult<()>,
    {
        let mut file = File::open(path)?;
        let mut index = 0_u64;
        let mut offset = 0_u64;

        loop {
            let mut buffer = vec![0_u8; self.block_size];
            let read = file.read(&mut buffer)?;
            if read == 0 {
                break;
            }
            buffer.truncate(read);
            on_chunk(FileChunk {
                index,
                offset,
                bytes: buffer,
            })?;
            index += 1;
            offset += read as u64;
        }

        Ok(())
    }
}
