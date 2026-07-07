use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use chrona::core::block_ingest_service::BlockIngestService;
use chrona::core::block_store::BlockStore;
use chrona::core::chunker::FixedChunker;
use chrona::core::hasher::sha256_hex;
use chrona::core::path_safety::{assert_source_repository_separate, normalize_relative_path};
use chrona::core::repository::RepositoryManager;
use chrona::models::progress::BlockIngestProgress;
use chrona::models::repository::CompressionMode;
use tempfile::TempDir;

fn write_file(path: &Path, bytes: &[u8]) {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    let mut file = fs::File::create(path).unwrap();
    file.write_all(bytes).unwrap();
}

fn collect_block_files(repository_path: &Path) -> Vec<PathBuf> {
    let blocks = repository_path.join("blocks");
    let mut files = Vec::new();
    if !blocks.exists() {
        return files;
    }

    for first in fs::read_dir(blocks).unwrap() {
        let first = first.unwrap();
        if !first.file_type().unwrap().is_dir() {
            continue;
        }
        for second in fs::read_dir(first.path()).unwrap() {
            let second = second.unwrap();
            if !second.file_type().unwrap().is_dir() {
                continue;
            }
            for entry in fs::read_dir(second.path()).unwrap() {
                let entry = entry.unwrap();
                if entry.file_type().unwrap().is_file()
                    && entry.path().extension().is_some_and(|ext| ext == "blk")
                {
                    files.push(entry.path());
                }
            }
        }
    }
    files.sort();
    files
}

#[test]
fn creates_repository_layout_and_manifest() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");

    let manifest = RepositoryManager::create(&repo_path).unwrap();

    assert_eq!(manifest.schema_version, 2);
    assert_eq!(manifest.block_strategy.strategy_type, "fixed");
    assert_eq!(manifest.block_strategy.size_bytes, 1_048_576);
    assert_eq!(manifest.block_strategy.hash, "sha256");
    assert_eq!(manifest.block_strategy.encoding_version, 2);
    assert_eq!(
        manifest.block_strategy.compression_mode,
        CompressionMode::Standard
    );
    assert!(repo_path.join("manifest.json").is_file());
    assert!(repo_path.join("blocks").is_dir());
    assert!(repo_path.join("indexes").is_dir());
    assert!(repo_path.join("logs").is_dir());
}

#[test]
fn rejects_unsupported_repository_version() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    RepositoryManager::create(&repo_path).unwrap();
    let manifest_path = repo_path.join("manifest.json");
    let mut manifest: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(&manifest_path).unwrap()).unwrap();
    manifest["schemaVersion"] = serde_json::json!(99);
    fs::write(manifest_path, serde_json::to_vec(&manifest).unwrap()).unwrap();

    let error = RepositoryManager::open(&repo_path).unwrap_err();

    assert!(error.to_string().contains("UnsupportedRepositoryVersion"));
}

#[test]
fn rejects_source_repository_containment() {
    let temp = TempDir::new().unwrap();
    let source = temp.path().join("source");
    let repo = temp.path().join("source").join("repo");
    fs::create_dir_all(&repo).unwrap();

    let same = assert_source_repository_separate(&source, &source).unwrap_err();
    let repo_inside_source = assert_source_repository_separate(&source, &repo).unwrap_err();
    let source_inside_repo = assert_source_repository_separate(&repo, &source).unwrap_err();

    assert!(same.to_string().contains("SourceInsideRepository"));
    assert!(repo_inside_source
        .to_string()
        .contains("RepositoryInsideSource"));
    assert!(source_inside_repo
        .to_string()
        .contains("SourceInsideRepository"));
}

#[test]
fn normalizes_relative_paths_to_forward_slashes() {
    let normalized = normalize_relative_path(Path::new("child").join("note.txt")).unwrap();
    assert_eq!(normalized, "child/note.txt");

    assert!(normalize_relative_path(Path::new("/absolute/file.txt")).is_err());
    assert!(normalize_relative_path(Path::new("../escape.txt")).is_err());
}

#[test]
fn chunks_files_by_fixed_size() {
    let temp = TempDir::new().unwrap();
    let file_path = temp.path().join("large.bin");
    let bytes = vec![7_u8; 1_048_576 + 1];
    write_file(&file_path, &bytes);

    let chunks = FixedChunker::new(1_048_576)
        .chunks_for_file(&file_path)
        .unwrap();

    assert_eq!(chunks.len(), 2);
    assert_eq!(chunks[0].index, 0);
    assert_eq!(chunks[0].offset, 0);
    assert_eq!(chunks[0].bytes.len(), 1_048_576);
    assert_eq!(chunks[1].index, 1);
    assert_eq!(chunks[1].offset, 1_048_576);
    assert_eq!(chunks[1].bytes.len(), 1);
}

#[test]
fn empty_file_has_no_blocks() {
    let temp = TempDir::new().unwrap();
    let file_path = temp.path().join("empty.bin");
    write_file(&file_path, b"");

    let chunks = FixedChunker::new(1_048_576)
        .chunks_for_file(&file_path)
        .unwrap();

    assert!(chunks.is_empty());
}

#[test]
fn hashes_same_bytes_to_same_sha256() {
    let first = sha256_hex(b"chrona");
    let second = sha256_hex(b"chrona");
    let third = sha256_hex(b"other");

    assert_eq!(first, second);
    assert_ne!(first, third);
    assert_eq!(first.len(), 64);
}

#[test]
fn stores_blocks_by_hash_path_and_reuses_existing_blocks() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    RepositoryManager::create(&repo_path).unwrap();
    let store = BlockStore::new(repo_path.clone());
    let bytes = b"same block";
    let hash = sha256_hex(bytes);

    let first = store.store_block(&hash, bytes, "op-1").unwrap();
    let second = store.store_block(&hash, bytes, "op-2").unwrap();

    assert!(first.was_new);
    assert!(!second.was_new);
    assert_eq!(
        first.storage_path,
        PathBuf::from("blocks")
            .join(&hash[0..2])
            .join(&hash[2..4])
            .join(format!("{hash}.blk"))
    );
    assert_eq!(collect_block_files(&repo_path).len(), 1);
    assert!(!repo_path
        .join("blocks")
        .join(&hash[0..2])
        .join(&hash[2..4])
        .join(format!("{hash}.blk.tmp-op-1"))
        .exists());
}

#[test]
fn ingests_folder_reuses_duplicate_blocks_and_emits_progress() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("a.txt"), b"duplicate");
    write_file(&source_path.join("nested").join("b.txt"), b"duplicate");

    let mut events: Vec<BlockIngestProgress> = Vec::new();
    let service = BlockIngestService::new();
    let summary = service
        .ingest(&repo_path, &source_path, |event| events.push(event))
        .unwrap();

    assert_eq!(summary.file_count, 2);
    assert_eq!(summary.total_input_bytes, 18);
    assert_eq!(summary.total_block_references, 2);
    assert_eq!(summary.new_block_count, 1);
    assert_eq!(summary.reused_block_count, 1);
    assert_eq!(summary.newly_stored_bytes, 9);
    assert_eq!(collect_block_files(&repo_path).len(), 1);
    assert!(summary
        .files
        .iter()
        .any(|file| file.relative_path == "nested/b.txt"));
    assert_eq!(events.first().unwrap().phase, "scanning");
    assert!(events.iter().any(|event| event.phase == "storing"));
    assert_eq!(events.last().unwrap().phase, "completed");
    assert_eq!(events.last().unwrap().total_bytes_processed, 18);
    assert_eq!(events.last().unwrap().total_bytes, 18);
}

#[test]
fn ingest_fails_when_repository_is_inside_source() {
    let temp = TempDir::new().unwrap();
    let source_path = temp.path().join("source");
    let repo_path = source_path.join("chrona-repo");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("a.txt"), b"data");

    let service = BlockIngestService::new();
    let error = service
        .ingest(&repo_path, &source_path, |_| {})
        .unwrap_err();

    assert!(error.to_string().contains("RepositoryInsideSource"));
}
#[test]
fn ingest_results_include_file_modified_time() {
    let temp = TempDir::new().unwrap();
    let repo_path = temp.path().join("chrona-repo");
    let source_path = temp.path().join("source");
    RepositoryManager::create(&repo_path).unwrap();
    write_file(&source_path.join("a.txt"), b"data");

    let summary = BlockIngestService::new()
        .ingest(&repo_path, &source_path, |_| {})
        .unwrap();

    assert_eq!(summary.files.len(), 1);
    assert!(summary.files[0].modified_at.contains('T'));
}
