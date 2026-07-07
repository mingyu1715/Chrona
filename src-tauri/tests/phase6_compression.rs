use std::fs;
use std::path::{Path, PathBuf};

use chrona::commands::repository_commands::set_repository_compression_mode;
use chrona::core::block_codec::{decode_block, encode_block, BLOCK_ENVELOPE_MAGIC};
use chrona::core::block_ingest_service::BlockIngestService;
use chrona::core::block_store::BlockStore;
use chrona::core::hasher::sha256_hex;
use chrona::core::integrity_service::IntegrityService;
use chrona::core::repository::RepositoryManager;
use chrona::core::restore_service::RestoreService;
use chrona::core::snapshot_service::SnapshotService;
use chrona::models::block::BlockEncoding;
use chrona::models::integrity::IntegrityStatus;
use chrona::models::repository::CompressionMode;
use tempfile::TempDir;

struct RepositoryFixture {
    _temp: TempDir,
    path: PathBuf,
}

impl RepositoryFixture {
    fn path(&self) -> &Path {
        &self.path
    }
}

fn create_schema_one_repository_fixture() -> RepositoryFixture {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("chrona-repo");
    RepositoryManager::create(&path).unwrap();

    let manifest_path = path.join("manifest.json");
    let mut manifest: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(&manifest_path).unwrap()).unwrap();
    manifest["schemaVersion"] = serde_json::json!(1);
    let strategy = manifest["blockStrategy"].as_object_mut().unwrap();
    strategy.remove("encodingVersion");
    strategy.remove("compressionMode");
    fs::write(&manifest_path, serde_json::to_vec(&manifest).unwrap()).unwrap();

    RepositoryFixture { _temp: temp, path }
}

#[test]
fn legacy_schema_one_repository_opens_with_compression_off() {
    let repository = create_schema_one_repository_fixture();

    let manifest = RepositoryManager::open(repository.path()).unwrap();

    assert_eq!(manifest.schema_version, 1);
    assert_eq!(manifest.block_strategy.encoding_version, 1);
    assert_eq!(
        manifest.block_strategy.compression_mode,
        CompressionMode::Off
    );
}

#[test]
fn repository_compression_mode_update_persists_without_rewriting_blocks() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("chrona-repo");
    RepositoryManager::create(&repository_path).unwrap();

    let updated =
        RepositoryManager::set_compression_mode(&repository_path, CompressionMode::Fast).unwrap();
    let reopened = RepositoryManager::open(&repository_path).unwrap();

    assert_eq!(updated.schema_version, 2);
    assert_eq!(updated.block_strategy.encoding_version, 2);
    assert_eq!(
        updated.block_strategy.compression_mode,
        CompressionMode::Fast
    );
    assert_eq!(reopened, updated);
}

#[test]
fn repository_compression_command_updates_mode() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("chrona-repo");
    RepositoryManager::create(&repository_path).unwrap();

    let manifest = set_repository_compression_mode(
        repository_path.display().to_string(),
        CompressionMode::Off,
    )
    .unwrap();

    assert_eq!(
        manifest.block_strategy.compression_mode,
        CompressionMode::Off
    );
}

#[test]
fn codec_standard_round_trips_compressible_bytes() {
    let raw = vec![b'a'; 1_048_576];
    let hash = sha256_hex(&raw);

    let encoded = encode_block(&raw, &hash, CompressionMode::Standard).unwrap();
    let decoded = decode_block(&encoded.bytes, &hash).unwrap();

    assert_eq!(encoded.encoding, BlockEncoding::Zstd);
    assert!(encoded.stored_size_bytes < encoded.raw_size_bytes);
    assert_eq!(decoded.encoding, BlockEncoding::Zstd);
    assert_eq!(decoded.bytes, raw);
}

#[test]
fn codec_fast_round_trips_compressible_bytes() {
    let raw = vec![b'b'; 1_048_576];
    let hash = sha256_hex(&raw);

    let encoded = encode_block(&raw, &hash, CompressionMode::Fast).unwrap();
    let decoded = decode_block(&encoded.bytes, &hash).unwrap();

    assert_eq!(encoded.encoding, BlockEncoding::Lz4);
    assert!(encoded.stored_size_bytes < encoded.raw_size_bytes);
    assert_eq!(decoded.encoding, BlockEncoding::Lz4);
    assert_eq!(decoded.bytes, raw);
}

#[test]
fn codec_off_and_small_standard_payloads_stay_raw() {
    let raw = b"short block".to_vec();
    let hash = sha256_hex(&raw);

    let off = encode_block(&raw, &hash, CompressionMode::Off).unwrap();
    let standard = encode_block(&raw, &hash, CompressionMode::Standard).unwrap();

    assert_eq!(off.encoding, BlockEncoding::Raw);
    assert_eq!(off.bytes, raw);
    assert_eq!(standard.encoding, BlockEncoding::Raw);
    assert_eq!(standard.bytes, raw);
}

#[test]
fn codec_treats_magic_prefixed_raw_payload_as_raw() {
    let raw = b"CHRBLK01 legacy raw bytes".to_vec();
    let hash = sha256_hex(&raw);

    let decoded = decode_block(&raw, &hash).unwrap();

    assert_eq!(decoded.encoding, BlockEncoding::Raw);
    assert_eq!(decoded.bytes, raw);
}

#[test]
fn codec_rejects_corrupt_compressed_payload() {
    let raw = vec![b'c'; 1_048_576];
    let hash = sha256_hex(&raw);
    let mut encoded = encode_block(&raw, &hash, CompressionMode::Standard)
        .unwrap()
        .bytes;
    let final_byte = encoded.last_mut().unwrap();
    *final_byte ^= 0xff;

    let error = decode_block(&encoded, &hash).unwrap_err();

    assert!(
        error.to_string().contains("Decompression")
            || error.to_string().contains("InvalidBlockEnvelope")
    );
}

#[test]
fn block_store_standard_writes_compressed_payload_and_reads_raw_bytes() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("chrona-repo");
    RepositoryManager::create(&repository_path).unwrap();
    let store =
        BlockStore::with_compression_mode(repository_path.clone(), CompressionMode::Standard);
    let raw = vec![b'd'; 1_048_576];
    let hash = sha256_hex(&raw);

    let write = store.store_block(&hash, &raw, "standard-op").unwrap();
    let stored = fs::read(repository_path.join(&write.storage_path)).unwrap();

    assert!(write.was_new);
    assert_eq!(write.encoding, BlockEncoding::Zstd);
    assert_eq!(write.raw_size_bytes, raw.len() as u64);
    assert!(write.stored_size_bytes < write.raw_size_bytes);
    assert!(stored.starts_with(BLOCK_ENVELOPE_MAGIC));
    assert_eq!(store.read_block(&hash).unwrap(), raw);
}

#[test]
fn block_store_fast_writes_lz4_payload_and_reads_raw_bytes() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("chrona-repo");
    RepositoryManager::create(&repository_path).unwrap();
    let store = BlockStore::with_compression_mode(repository_path, CompressionMode::Fast);
    let raw = vec![b'e'; 1_048_576];
    let hash = sha256_hex(&raw);

    let write = store.store_block(&hash, &raw, "fast-op").unwrap();

    assert!(write.was_new);
    assert_eq!(write.encoding, BlockEncoding::Lz4);
    assert_eq!(store.read_block(&hash).unwrap(), raw);
}

#[test]
fn block_store_reads_legacy_raw_payload() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("chrona-repo");
    RepositoryManager::create(&repository_path).unwrap();
    let raw = b"legacy raw block";
    let hash = sha256_hex(raw);
    let relative_path = BlockStore::block_relative_path(&hash).unwrap();
    let block_path = repository_path.join(relative_path);
    fs::create_dir_all(block_path.parent().unwrap()).unwrap();
    fs::write(&block_path, raw).unwrap();

    let store = BlockStore::new(repository_path);

    assert_eq!(store.read_block(&hash).unwrap(), raw);
}

#[test]
fn block_store_reuses_existing_block_across_compression_modes() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("chrona-repo");
    RepositoryManager::create(&repository_path).unwrap();
    let raw = vec![b'f'; 1_048_576];
    let hash = sha256_hex(&raw);

    let first =
        BlockStore::with_compression_mode(repository_path.clone(), CompressionMode::Standard)
            .store_block(&hash, &raw, "first-op")
            .unwrap();
    let second = BlockStore::with_compression_mode(repository_path, CompressionMode::Fast)
        .store_block(&hash, &raw, "second-op")
        .unwrap();

    assert!(first.was_new);
    assert!(!second.was_new);
    assert_eq!(second.encoding, BlockEncoding::Zstd);
    assert_eq!(second.stored_size_bytes, first.stored_size_bytes);
}

#[test]
fn compressed_ingest_reports_physical_savings() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repository_path).unwrap();
    fs::create_dir_all(&source_path).unwrap();
    fs::write(source_path.join("compressible.bin"), vec![b'g'; 1_048_576]).unwrap();

    let summary = BlockIngestService::new()
        .ingest(&repository_path, &source_path, |_| {})
        .unwrap();

    assert_eq!(summary.new_block_count, 1);
    assert_eq!(summary.new_logical_bytes, 1_048_576);
    assert!(summary.newly_stored_bytes < summary.new_logical_bytes);
    assert_eq!(
        summary.compression_saved_bytes,
        summary.new_logical_bytes - summary.newly_stored_bytes
    );
    assert_eq!(summary.new_raw_block_count, 0);
    assert_eq!(summary.new_zstd_block_count, 1);
    assert_eq!(summary.new_lz4_block_count, 0);
}

#[test]
fn fast_mode_ingest_uses_lz4_encoding() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repository_path).unwrap();
    RepositoryManager::set_compression_mode(&repository_path, CompressionMode::Fast).unwrap();
    fs::create_dir_all(&source_path).unwrap();
    fs::write(source_path.join("fast.bin"), vec![b'j'; 1_048_576]).unwrap();

    let summary = BlockIngestService::new()
        .ingest(&repository_path, &source_path, |_| {})
        .unwrap();

    assert_eq!(summary.new_lz4_block_count, 1);
    assert_eq!(summary.new_zstd_block_count, 0);
    assert_eq!(summary.new_raw_block_count, 0);
}

#[test]
fn off_mode_ingest_keeps_raw_encoding() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repository_path).unwrap();
    RepositoryManager::set_compression_mode(&repository_path, CompressionMode::Off).unwrap();
    fs::create_dir_all(&source_path).unwrap();
    fs::write(source_path.join("raw.bin"), vec![b'k'; 1_048_576]).unwrap();

    let summary = BlockIngestService::new()
        .ingest(&repository_path, &source_path, |_| {})
        .unwrap();

    assert_eq!(summary.new_raw_block_count, 1);
    assert_eq!(summary.new_zstd_block_count, 0);
    assert_eq!(summary.new_lz4_block_count, 0);
    assert_eq!(summary.compression_saved_bytes, 0);
    assert_eq!(summary.newly_stored_bytes, summary.new_logical_bytes);
}

#[test]
fn compressed_snapshot_restores_original_bytes() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    let restore_path = temp.path().join("restore");
    let raw = vec![b'h'; 1_048_576];
    RepositoryManager::create(&repository_path).unwrap();
    fs::create_dir_all(&source_path).unwrap();
    fs::write(source_path.join("archive.bin"), &raw).unwrap();

    let snapshot = SnapshotService::new()
        .create_snapshot(
            &repository_path,
            &source_path,
            "Compressed snapshot",
            |_| {},
        )
        .unwrap();
    let hash = &snapshot.files[0].blocks[0].hash;
    let block_path = repository_path.join(BlockStore::block_relative_path(hash).unwrap());
    assert!(fs::read(&block_path)
        .unwrap()
        .starts_with(BLOCK_ENVELOPE_MAGIC));

    RestoreService::new()
        .restore_snapshot(&repository_path, &snapshot.id, &restore_path)
        .unwrap();

    assert_eq!(fs::read(restore_path.join("archive.bin")).unwrap(), raw);
}

#[test]
fn compressed_corruption_is_reported_as_decode_failure() {
    let temp = TempDir::new().unwrap();
    let repository_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repository_path).unwrap();
    fs::create_dir_all(&source_path).unwrap();
    fs::write(source_path.join("archive.bin"), vec![b'i'; 1_048_576]).unwrap();

    let snapshot = SnapshotService::new()
        .create_snapshot(
            &repository_path,
            &source_path,
            "Corrupt compressed block",
            |_| {},
        )
        .unwrap();
    let hash = &snapshot.files[0].blocks[0].hash;
    let block_path = repository_path.join(BlockStore::block_relative_path(hash).unwrap());
    let mut stored = fs::read(&block_path).unwrap();
    *stored.last_mut().unwrap() ^= 0xff;
    fs::write(&block_path, stored).unwrap();

    let report = IntegrityService::new()
        .verify_repository(&repository_path)
        .unwrap();

    assert_eq!(report.status, IntegrityStatus::Failed);
    assert!(report
        .issues
        .iter()
        .any(|issue| issue.code == "blockDecodeFailed"));
}
