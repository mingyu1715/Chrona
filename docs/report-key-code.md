# 프로젝트 보고서용 주요 코드

이 문서는 Chrona의 전체 코드를 나열하지 않고, 프로젝트의 핵심 알고리즘과 안정성 설계를 설명하기 좋은 부분만 실제 구현에서 추린 것이다.

보고서 분량이 짧다면 1~5번을 우선 사용하고, 안정성 설명이 필요하면 6~8번을 추가한다.

## 1. 1 MiB 스트리밍 블록 분할

출처: `src-tauri/src/core/chunker.rs`

```rust
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
```

### 설명

파일 전체를 메모리에 올리지 않고 `1 MiB`씩 읽어 callback으로 전달한다. 마지막 블록은 실제로 읽은 크기만 남기며, 각 블록에 순서와 원본 파일 내 offset을 기록한다.

Chrona의 ingest는 모든 블록을 `Vec`에 저장하는 함수 대신 이 streaming 함수를 사용한다. 따라서 파일 크기가 커져도 필요한 메모리는 블록 하나 수준으로 유지된다.

### 복잡도

- 시간 복잡도: `O(N)`
- 추가 메모리: `O(B)`
- `N`: 파일 크기, `B`: 블록 크기 1 MiB

### 보고서용 문장

> 대용량 파일을 한 번에 메모리에 올리지 않고 1 MiB 단위로 순차 처리하여 파일 크기와 관계없이 일정한 수준의 메모리만 사용하도록 구현했다.

## 2. SHA-256 기반 중복 제거 파이프라인

출처: `src-tauri/src/core/block_ingest_service.rs`, `src-tauri/src/core/hasher.rs`

```rust
chunker.for_each_chunk(&file.absolute_path, |chunk| {
    let hash = sha256_hex(&chunk.bytes);
    let write = store.store_block(&hash, &chunk.bytes, &operation_id)?;
    let size_bytes = chunk.bytes.len() as u64;

    summary.total_block_references += 1;
    if write.was_new {
        summary.new_block_count += 1;
        summary.new_logical_bytes += write.raw_size_bytes;
        summary.newly_stored_bytes += write.stored_size_bytes;
        summary.compression_saved_bytes +=
            write.raw_size_bytes.saturating_sub(write.stored_size_bytes);
    } else {
        summary.reused_block_count += 1;
    }

    file_result.blocks.push(BlockReference {
        index: chunk.index,
        offset: chunk.offset,
        size_bytes,
        hash,
        was_new: write.was_new,
    });
    Ok(())
})?;
```

```rust
pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}
```

### 설명

각 블록의 원본 바이트로 SHA-256을 계산하고 hash를 블록 ID로 사용한다. 같은 내용은 파일명과 위치가 달라도 같은 hash를 만들기 때문에 기존 블록을 재사용할 수 있다.

압축 방식이 바뀌더라도 ID는 압축 전 원본으로 계산한다. 따라서 raw, Zstd, LZ4 중 어떤 방식으로 저장해도 동일한 원본 블록은 하나의 ID를 유지한다.

### 데이터 흐름

```text
원본 파일 -> 1 MiB 블록 -> SHA-256 -> 기존 블록 확인
                                     ├─ 존재: 참조만 추가
                                     └─ 없음: 압축 후 저장
```

### 보고서용 문장

> 블록의 원본 데이터에서 SHA-256을 계산해 내용 자체를 식별자로 사용했다. 이 방식은 파일명이나 저장 위치가 달라도 내용이 같은 블록을 찾아 재사용할 수 있다.

## 3. 중복 블록 재사용과 atomic 저장

출처: `src-tauri/src/core/block_store.rs`

```rust
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

let tmp_path = tmp_path_for(parent, hash, operation_id);
let encoded = encode_block(bytes, hash, self.compression_mode)?;
let write_result = write_tmp_then_rename(&tmp_path, &final_path, &encoded.bytes);
if let Err(error) = write_result {
    let _ = fs::remove_file(&tmp_path);
    return Err(error);
}
```

```rust
fn write_tmp_then_rename(
    tmp_path: &Path,
    final_path: &Path,
    bytes: &[u8],
) -> ChronaResult<()> {
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
```

### 설명

최종 hash 경로에 블록이 있으면 새로 저장하지 않고 기존 블록의 encoding과 크기를 반환한다. 새 블록은 바로 최종 파일에 쓰지 않고 `.tmp-{operationId}`에 기록한다. 디스크 동기화가 끝난 뒤 rename하여 작업 도중 오류가 발생했을 때 불완전한 최종 블록이 남는 위험을 줄인다.

### 안정성 포인트

- `create_new(true)`: 같은 임시 파일을 덮어쓰지 않음
- `sync_all()`: rename 전에 파일 내용을 디스크에 반영
- `rename`: 완성된 파일만 최종 경로로 이동
- 오류 발생 시 임시 파일을 best-effort로 정리

### 보고서용 문장

> 블록은 임시 파일에 완전히 기록하고 디스크 동기화를 수행한 뒤 최종 파일명으로 변경한다. 이를 통해 저장 중 프로그램이 중단되더라도 불완전한 블록이 정상 블록으로 인식될 가능성을 줄였다.

## 4. Zstd/LZ4 압축과 3% raw fallback

출처: `src-tauri/src/core/block_codec.rs`

```rust
let (encoding, encoding_byte, payload) = match mode {
    CompressionMode::Off => return Ok(raw_block(raw)),
    CompressionMode::Standard => (
        BlockEncoding::Zstd,
        ZSTD_ENCODING,
        zstd::stream::encode_all(Cursor::new(raw), 3)
            .map_err(|error| ChronaError::Compression(error.to_string()))?,
    ),
    CompressionMode::Fast => {
        let mut encoder = FrameEncoder::new(Vec::new());
        encoder.write_all(raw)
            .map_err(|error| ChronaError::Compression(error.to_string()))?;
        let payload = encoder.finish()
            .map_err(|error| ChronaError::Compression(error.to_string()))?;
        (BlockEncoding::Lz4, LZ4_ENCODING, payload)
    }
};

let envelope = build_envelope(raw, &raw_hash_bytes, encoding_byte, &payload);
if envelope.len() * 100 > raw.len() * 97 {
    return Ok(raw_block(raw));
}
```

### 설명

- 표준 모드: Zstd level 3
- 빠른 모드: LZ4 frame
- 끔 모드: 원본 저장

압축 데이터와 header를 합친 최종 크기가 원본보다 최소 3% 작을 때만 압축본을 사용한다. JPEG, ZIP, 영상처럼 이미 압축된 데이터는 다시 압축해도 크기가 거의 줄지 않으므로 원본으로 되돌린다.

조건식의 의미는 다음과 같다.

```text
compressed_size <= raw_size × 0.97 이면 압축 저장
그 외에는 raw 저장
```

### 보고서용 문장

> 모든 블록을 무조건 압축하지 않고 최종 저장 크기가 원본보다 3% 이상 줄어드는 경우에만 압축을 적용했다. 압축 효율이 낮은 데이터는 원본으로 저장해 CPU 사용과 용량 증가를 방지했다.

## 5. 스냅샷 생성

출처: `src-tauri/src/core/snapshot_service.rs`

```rust
let summary =
    BlockIngestService::new().ingest(repository_path, source_path, on_progress)?;
let created_at = Utc::now();
let snapshot = Snapshot {
    schema_version: 1,
    id: generate_snapshot_id(created_at),
    name: normalize_snapshot_name(name),
    created_at: created_at.to_rfc3339(),
    source_root,
    summary: SnapshotSummary {
        file_count: summary.file_count,
        total_original_bytes: summary.total_input_bytes,
        total_block_references: summary.total_block_references,
        new_block_count: summary.new_block_count,
        reused_block_count: summary.reused_block_count,
        new_stored_bytes: summary.newly_stored_bytes,
        compression_saved_bytes: summary.compression_saved_bytes,
        new_raw_block_count: summary.new_raw_block_count,
        new_zstd_block_count: summary.new_zstd_block_count,
        new_lz4_block_count: summary.new_lz4_block_count,
        new_logical_bytes: summary.new_logical_bytes,
    },
    files: summary.files.into_iter().map(|file| SnapshotFile {
        relative_path: file.relative_path,
        size_bytes: file.size_bytes,
        modified_at: file.modified_at,
        blocks: file.blocks,
    }).collect(),
};

store.write_snapshot(&snapshot)?;
store.add_to_index(&snapshot)?;
```

### 설명

스냅샷은 원본 파일을 다시 복사하는 데이터가 아니라 특정 시점의 파일 목록과 각 파일이 참조하는 블록 순서를 기록한 metadata다. 실제 block payload는 공용 저장소에 한 번만 존재한다.

이 구조에서는 두 스냅샷이 같은 블록을 참조할 수 있으므로 변경되지 않은 데이터가 다시 저장되지 않는다.

### 보고서용 문장

> 스냅샷에는 파일별 블록 참조와 통계만 저장하고 실제 데이터 블록은 공용 저장소에서 공유한다. 따라서 새로운 스냅샷을 만들어도 변경되지 않은 블록은 추가 용량을 사용하지 않는다.

## 6. 스냅샷 비교와 블록 멀티셋

출처: `src-tauri/src/core/diff_service.rs`

```rust
fn diff_blocks(
    before: Option<&SnapshotFile>,
    after: Option<&SnapshotFile>,
) -> SnapshotBlockDiffSummary {
    let before_counts = block_counts(before);
    let after_counts = block_counts(after);
    let hashes = before_counts
        .keys()
        .chain(after_counts.keys())
        .copied()
        .collect::<BTreeSet<_>>();

    let mut summary = SnapshotBlockDiffSummary {
        before_block_references: before.map_or(0, |file| file.blocks.len() as u64),
        after_block_references: after.map_or(0, |file| file.blocks.len() as u64),
        ..SnapshotBlockDiffSummary::default()
    };

    for hash in hashes {
        let before_count = before_counts.get(hash).copied().unwrap_or(0);
        let after_count = after_counts.get(hash).copied().unwrap_or(0);
        summary.shared_block_references += before_count.min(after_count);
        summary.added_block_references += after_count.saturating_sub(before_count);
        summary.removed_block_references += before_count.saturating_sub(after_count);
    }

    summary
}
```

### 설명

블록 hash를 단순 집합으로 비교하지 않고 hash별 등장 횟수를 세는 멀티셋으로 비교한다. 같은 hash가 한 파일에서 여러 번 나타나는 경우에도 추가·삭제·공유 참조 수를 정확히 계산할 수 있다.

파일의 수정 여부는 수정 시각만으로 판단하지 않는다. 파일 크기와 순서가 있는 block hash 목록이 같으면 내용이 같다고 판정한다.

### 복잡도

- 파일 경로 정렬·결합: `O(F log F)`
- block hash count 집계: `O(R log U)`
- `F`: 파일 수, `R`: 블록 참조 수, `U`: 고유 block 수

### 보고서용 문장

> 중복 블록 참조를 정확히 비교하기 위해 블록 hash를 집합이 아닌 멀티셋으로 계산했다. 각 hash의 이전·이후 등장 횟수를 비교하여 추가, 삭제, 공유 블록 수를 구한다.

## 7. 블록 기반 파일 복원

출처: `src-tauri/src/core/restore_service.rs`

```rust
let mut output = OpenOptions::new()
    .write(true)
    .create_new(true)
    .open(tmp_path)?;

for block in &file.blocks {
    let bytes = block_store.read_block(&block.hash)?;
    if bytes.len() as u64 != block.size_bytes {
        return Err(ChronaError::Restore(format!(
            "block `{}` has {} bytes but snapshot expects {} bytes",
            block.hash,
            bytes.len(),
            block.size_bytes
        )));
    }
    output.write_all(&bytes)?;
}

output.sync_all()?;
drop(output);
fs::rename(tmp_path, final_path)?;
```

### 설명

스냅샷에 기록된 순서대로 블록을 읽어 파일을 재구성한다. 압축 블록은 `BlockStore::read_block` 내부에서 원본으로 해제된다. 각 블록의 실제 크기와 스냅샷 metadata 크기를 비교한 뒤 출력한다.

복원 파일도 임시 경로에 먼저 작성하고 완료 후 rename한다. 복원 중 오류가 나면 불완전한 파일이 최종 파일명으로 남지 않는다.

### 보고서용 문장

> 복원 시 스냅샷의 블록 순서대로 원본 데이터를 이어 붙여 파일을 재구성한다. 블록 크기를 검증하고 임시 파일 작성 후 rename하여 손상되거나 불완전한 복원 결과가 남는 것을 방지했다.

## 8. 저장소 무결성 검증

출처: `src-tauri/src/core/integrity_service.rs`

```rust
let bytes = match block_store.read_block(hash) {
    Ok(bytes) => bytes,
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
}

let actual_hash = sha256_hex(&bytes);
if actual_hash != *hash {
    corrupt_block_hashes.insert(hash.clone());
    issues.push(IntegrityIssue {
        severity: IntegrityIssueSeverity::Error,
        code: "blockHashMismatch".to_string(),
        message: format!("block `{hash}` content hash is `{actual_hash}"),
        snapshot_id: Some(expected.snapshot_id.clone()),
        relative_path: Some(expected.relative_path.clone()),
        block_hash: Some(hash.clone()),
    });
}
```

### 설명

모든 스냅샷에서 참조하는 고유 블록을 모은 뒤 다음을 확인한다.

1. 블록 파일 존재 여부
2. 압축 envelope 해제 가능 여부
3. 저장된 블록 크기와 metadata 크기 일치 여부
4. 원본 바이트의 SHA-256과 block ID 일치 여부

한 블록이 손상되어도 전체 검사를 즉시 중단하지 않고 issue 목록에 추가해 가능한 검사를 계속한다.

### 보고서용 문장

> 무결성 검사는 블록의 존재 여부, 크기, 압축 해제, SHA-256을 검증한다. 일부 블록에서 오류가 발견되어도 검사를 계속하여 저장소 전체 문제 목록을 한 번에 확인할 수 있도록 했다.

## 9. 경로 포함 관계와 metadata 경로 안전성

출처: `src-tauri/src/core/path_safety.rs`

```rust
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
```

```rust
for component in path.components() {
    match component {
        Component::Normal(part) => {
            let part = part.to_str().ok_or_else(|| {
                ChronaError::UnsafeRelativePath(
                    format!("path is not valid UTF-8: {}", path.display())
                )
            })?;
            parts.push(part.to_string());
        }
        Component::CurDir => {}
        Component::ParentDir => {
            return Err(ChronaError::UnsafeRelativePath(
                format!("parent segments are not allowed: {}", path.display())
            ));
        }
        Component::RootDir | Component::Prefix(_) => {
            return Err(ChronaError::UnsafeRelativePath(
                format!("root or drive prefix is not allowed: {}", path.display())
            ));
        }
    }
}

Ok(parts.join("/"))
```

### 설명

원본과 저장소가 서로 포함되면 저장소가 자기 자신을 다시 백업하는 순환 문제가 생길 수 있으므로 ingest 전에 중단한다. metadata 상대 경로에는 절대 경로, drive prefix, `..`를 허용하지 않고 운영체제와 무관하게 `/`로 저장한다.

### 보고서용 문장

> 원본과 저장소가 서로 포함되는 경우 재귀적으로 저장소를 백업할 수 있으므로 canonical path 기준으로 작업을 차단했다. 내부 경로는 절대 경로와 상위 이동을 금지하고 `/` 구분자로 통일했다.

## 보고서 추천 구성

### 코드 3개만 넣는 경우

1. SHA-256 기반 중복 제거 파이프라인
2. Zstd/LZ4 압축과 raw fallback
3. 스냅샷 비교 멀티셋

### 코드 5개를 넣는 경우

1. 스트리밍 블록 분할
2. SHA-256 기반 중복 제거
3. atomic block 저장
4. 압축 전략
5. 스냅샷 비교 또는 복원

### 안정성 중심으로 설명하는 경우

1. atomic block 저장
2. atomic 복원
3. 무결성 검증
4. 경로 포함 관계 검사

## 전체 핵심 알고리즘 요약

```text
원본 파일
  -> 경로 안전성 검사
  -> 1 MiB streaming chunk
  -> raw SHA-256
  -> 기존 hash block 재사용
  -> 신규 block만 Zstd/LZ4 압축
  -> 3% 미만 절감이면 raw fallback
  -> .tmp 작성 + sync_all + rename
  -> snapshot metadata에 ordered block reference 저장
  -> 비교 시 path map + block multiset 계산
  -> 복원 시 ordered block decode + atomic file write
  -> 무결성 검사 시 size + SHA-256 재검증
```
