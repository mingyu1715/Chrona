use std::fs;

use chrona::core::block_store::BlockStore;
use chrona::core::hasher::sha256_hex;
use chrona::core::repository::RepositoryManager;
use chrona::models::file_inspector::{BlockStorageEncoding, BlockStorageState};
use chrona::models::repository::CompressionMode;
use tempfile::TempDir;

#[test]
fn block_storage_inspection_reports_raw_zstd_and_lz4() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("repo");
    RepositoryManager::create(&repository_path).unwrap();

    for (mode, byte, expected) in [
        (CompressionMode::Off, b'a', BlockStorageEncoding::Raw),
        (CompressionMode::Standard, b'b', BlockStorageEncoding::Zstd),
        (CompressionMode::Fast, b'c', BlockStorageEncoding::Lz4),
    ] {
        let raw = vec![byte; 1_048_576];
        let hash = sha256_hex(&raw);
        let store = BlockStore::with_compression_mode(repository_path.clone(), mode);
        let write = store
            .store_block(&hash, &raw, &format!("operation-{byte}"))
            .unwrap();

        let inspected = store.inspect_block(&hash, raw.len() as u64).unwrap();

        assert_eq!(inspected.storage_state, BlockStorageState::Available);
        assert_eq!(inspected.encoding, expected);
        assert_eq!(inspected.stored_size_bytes, Some(write.stored_size_bytes));
        assert_eq!(
            inspected.compression_saved_bytes,
            Some(raw.len() as u64 - write.stored_size_bytes)
        );
    }
}

#[test]
fn block_storage_inspection_keeps_magic_prefixed_raw_as_raw() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("repo");
    RepositoryManager::create(&repository_path).unwrap();
    let raw = b"CHRBLK01 legacy raw bytes".to_vec();
    let hash = sha256_hex(&raw);
    let store = BlockStore::with_compression_mode(repository_path, CompressionMode::Off);
    store.store_block(&hash, &raw, "magic-raw").unwrap();

    let inspected = store.inspect_block(&hash, raw.len() as u64).unwrap();

    assert_eq!(inspected.storage_state, BlockStorageState::Available);
    assert_eq!(inspected.encoding, BlockStorageEncoding::Raw);
    assert_eq!(inspected.stored_size_bytes, Some(raw.len() as u64));
    assert_eq!(inspected.compression_saved_bytes, Some(0));
}

#[test]
fn block_storage_inspection_reports_missing_and_invalid_header() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("repo");
    RepositoryManager::create(&repository_path).unwrap();
    let store = BlockStore::new(repository_path.clone());
    let missing_hash = sha256_hex(b"missing block");

    let missing = store.inspect_block(&missing_hash, 13).unwrap();

    assert_eq!(missing.storage_state, BlockStorageState::Missing);
    assert_eq!(missing.encoding, BlockStorageEncoding::Unknown);
    assert_eq!(missing.stored_size_bytes, None);

    let raw = vec![b'z'; 1_048_576];
    let hash = sha256_hex(&raw);
    let compressed =
        BlockStore::with_compression_mode(repository_path.clone(), CompressionMode::Standard);
    let write = compressed
        .store_block(&hash, &raw, "invalid-header")
        .unwrap();
    let block_path = repository_path.join(write.storage_path);
    let mut stored = fs::read(&block_path).unwrap();
    stored[10] = 1;
    fs::write(block_path, stored).unwrap();

    let invalid = compressed.inspect_block(&hash, raw.len() as u64).unwrap();

    assert_eq!(invalid.storage_state, BlockStorageState::InvalidHeader);
    assert_eq!(invalid.encoding, BlockStorageEncoding::Unknown);
    assert!(invalid.issue.is_some());
}
