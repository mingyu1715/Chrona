# Chrona

Chrona는 블록 기반 시점별 데이터 관리 데스크톱 애플리케이션입니다.

파일을 재사용 가능한 데이터 블록으로 저장하고, 여러 시점의 파일 상태를 스냅샷으로 관리하는 것을 목표로 합니다. 상용 백업 프로그램을 대체하는 것이 아니라, 고정 크기 블록 분할, 블록 식별, 블록 재사용, 스냅샷 메타데이터, 복원 흐름, 무결성 검증 같은 저장 시스템의 핵심 구조를 직접 구현하고 시각화하는 프로젝트입니다.

## 현재 상태

현재는 Phase 4 스냅샷 복원 core flow, Home/adaptive navigation MVP, Phase 5 무결성 검증과 저장소 인벤토리 탐색까지 완료된 상태입니다.

구현됨:

- Tauri + Rust + React 프로젝트 구조
- Chrona repository 생성 및 열기
- `manifest.json`, `blocks/`, `indexes/`, `logs/` 저장소 구조
- 1 MiB 고정 크기 블록 분할
- SHA-256 기반 블록 식별
- 동일 블록 재사용
- `.tmp` 파일 기록 후 rename하는 atomic-like block write
- source/repository 포함 관계 차단
- `/` 구분자 기반 metadata relative path 정규화
- block ingest progress event
- 최소 repository ingest UI
- 스냅샷 생성 및 목록
- 스냅샷 상세 조회
- 스냅샷 비교 command와 UI
- added/deleted/modified/unchanged 파일 분류
- block reference multiset 변화량 계산
- macOS native 파일/폴더 선택창
- 스냅샷 복원 command와 최소 UI
- 안전한 복원 target 검사와 `.tmp` 후 rename output write
- Continue Working, pinned item, recent access list를 포함한 Home workspace section
- `indexes/access-index.json` 기반 repository-local adaptive access history
- access item pin/unpin과 clear-history control
- 읽기 전용 repository 무결성 검증 command와 UI
- 누락 block, block size mismatch, raw SHA-256 mismatch 감지
- 저장소에 기록된 파일, 파일 종류, 최신 스냅샷 존재/삭제 상태를 보여주는 Explorer
- 현재 원본 파일의 존재, 누락, 원본 루트 누락 상태 확인
- 경로 검색과 파일 종류·스냅샷 상태·원본 상태 필터
- schema 2 repository의 raw/off, Zstd level 3 표준, LZ4 빠른 압축 모드
- 3% 미만 절감 시 raw fallback과 schema 1 legacy raw block 호환
- 압축 block 복원 및 decoded raw SHA-256 무결성 검증

아직 구현되지 않음:

- 자동 복구와 block garbage collection
- 패키징된 `.app` 릴리스

## 기술 스택

- Desktop shell: Tauri 2
- Core engine: Rust
- UI: React + TypeScript + Vite
- Test: Cargo test, Vitest
- 초기 metadata format: JSON files
- Block hash: SHA-256
- Block size: 1 MiB fixed chunks

## 핵심 알고리즘

Chrona는 새로운 압축 포맷을 만드는 프로젝트라기보다, 몇 가지 저장 알고리즘을 조합해 동작합니다.

### 1. Fixed-block content addressing

각 파일을 순서가 있는 byte stream으로 보고, 고정 크기 block으로 나눕니다.

```text
B = 1 MiB
H(x) = SHA-256(x)

for each file f in source_set:
  offset = 0
  block_index = 0

  while chunk = read_at_most_B_bytes(f):
    hash = H(chunk)

    emit BlockReference(
      index = block_index,
      offset = offset,
      size = len(chunk),
      hash = hash
    )

    offset += len(chunk)
    block_index += 1
```

성질:

- 같은 byte는 항상 같은 block hash를 만듭니다.
- 같은 파일 content는 항상 같은 순서의 block reference sequence를 만듭니다.
- 마지막 block은 `B`보다 작을 수 있습니다.
- 0 byte 파일은 빈 block reference sequence를 만듭니다.

### 2. Hash-based block deduplication

Chrona는 block hash를 identity key로 사용합니다.

```text
repository_blocks = set(existing_block_hashes)
new_blocks = 0
reused_blocks = 0

for each chunk in file_stream:
  hash = SHA-256(chunk)

  if hash in repository_blocks:
    reused_blocks += 1
    reuse existing block
  else:
    write chunk as block(hash)
    repository_blocks.add(hash)
    new_blocks += 1
```

성질:

- 같은 source를 다시 ingest하면 두 번째 실행에서는 새 block이 저장되지 않습니다.
- 서로 다른 파일이라도 같은 chunk byte를 가지면 같은 physical block을 참조합니다.
- 저장소는 전체 입력 크기가 아니라 새로 발견된 unique block byte만큼 증가합니다.

### 3. Snapshot as a persistent reference graph

스냅샷은 파일 byte를 다시 복사하지 않습니다. 파일이 어떤 block hash들을 어떤 순서로 참조하는지 기록하는 reference graph입니다.

```text
Snapshot = {
  id,
  created_at,
  source_root,
  files: [
    {
      relative_path,
      size_bytes,
      modified_at,
      blocks: [BlockReference]
    }
  ],
  summary
}
```

개념적으로는 다음 구조입니다.

```text
Snapshot
  -> FileEntry(relative_path)
    -> BlockReference(hash)
      -> PhysicalBlock(bytes)
```

따라서 snapshot 생성은 block ingest가 새 byte와 재사용 byte를 구분한 뒤, 그 결과를 metadata로 고정하는 작업에 가깝습니다.

### 4. Path map과 block multiset 기반 snapshot comparison

스냅샷 비교는 파일 byte를 다시 읽지 않고 metadata만 사용합니다. 파일은 정규화된 relative path로 매칭하고, content identity는 size와 순서가 있는 block hash sequence로 판정합니다.

```text
before = map(base.files by relative_path)
after = map(target.files by relative_path)

for path in sorted(union(before.keys, after.keys)):
  if path not in before:
    emit added
  else if path not in after:
    emit deleted
  else if before[path].size == after[path].size
       and hashes(before[path]) == hashes(after[path]):
    emit unchanged
  else:
    emit modified
```

Block reference 변화량은 단순 set 차이가 아니라 multiset 차이로 계산합니다.

```text
shared = sum(min(count_before[h], count_after[h]))
added = sum(max(count_after[h] - count_before[h], 0))
removed = sum(max(count_before[h] - count_after[h], 0))
```

이 방식은 같은 block이 한 파일 안에 여러 번 등장하는 경우에도 reference 수 변화를 보존합니다.

### 5. Ordered block materialization 기반 snapshot restore

복원은 snapshot reference graph를 따라가며, 기록된 순서대로 physical block을 읽어 파일을 다시 만듭니다.

```text
for each file in snapshot.files:
  output = open_tmp(target / file.relative_path)

  for block_ref in file.blocks ordered by index:
    block_bytes = read(block_path(block_ref.hash))
    append(output, block_bytes)

  sync(output)
  rename_tmp_to_final(output)
```

성질:

- 복원 시간은 복원되는 전체 byte 수 `R`에 대해 `O(R)`입니다.
- 메모리는 한 번에 읽는 block 크기 안에서 유지됩니다.
- 복원 target은 repository 밖에 있어야 하며 비어 있거나 새로 생성되는 폴더여야 합니다.
- Output file은 최종 rename 전 `.tmp-{operationId}` 경로로 먼저 기록됩니다.

### 6. Repository integrity verification

무결성 검증은 snapshot에 기록된 block reference가 실제 physical block file과 여전히 일치하는지 확인합니다. 데이터를 고치지는 않고 report를 생성합니다.

```text
unique_blocks = map()

for each snapshot in snapshot_index:
  for each file in snapshot.files:
    for each ref in file.blocks:
      unique_blocks[ref.hash] = expected_size(ref)

for each (hash, expected_size) in unique_blocks:
  path = block_path(hash)

  if path is missing:
    emit missingBlock
    continue

  bytes = read(path)

  if len(bytes) != expected_size:
    emit blockSizeMismatch

  if SHA-256(bytes) != hash:
    emit blockHashMismatch
```

성질:

- 중복 reference는 metadata 통계에는 반영하지만, physical block 검사는 unique hash마다 한 번만 수행합니다.
- 검증은 읽기 전용이며 repository 내용을 다시 쓰지 않습니다.
- healthy report는 현재 참조되는 block의 decoded raw bytes가 snapshot metadata와 일치한다는 뜻입니다.

### 7. Raw-identity block compression

Chrona는 block identity를 압축 전 raw byte 기준으로 유지하고 신규 physical payload에만 압축을 적용합니다. 기본값은 Zstd level 3이고, 빠른 모드는 LZ4 frame이며, off 모드는 raw block을 저장합니다.

```text
raw_chunk
  -> SHA-256(raw_chunk)
  -> dedup lookup by raw hash
  -> optional compression for new blocks (standard zstd or fast lz4)
  -> write encoded payload
```

envelope 전체가 raw보다 3% 이상 작을 때만 압축본을 저장합니다. 기존 schema 1 raw block은 재작성하지 않고 그대로 읽습니다.

### Complexity

정의:

- `N` = 전체 입력 byte 수
- `B` = block size, 현재 `1 MiB`
- `K` = block reference 개수
- `P` = 비교 대상 snapshot file path 개수
- `U` = 새로 저장되는 unique block byte 수

복잡도:

- Chunking + hashing time: `O(N)`
- Dedup lookup time: hash set/path existence check 기준 평균 `O(K)`
- File streaming memory: `O(B)`
- Metadata memory/output: `O(K)`
- Snapshot comparison path matching: 안정적인 정렬 출력 기준 `O(P log P)`
- Snapshot comparison block multiset counting: `O(K)`
- Physical storage growth: `O(U)`

### 현재 알고리즘 trade-off

- Fixed-size chunking은 단순하고 결정적이지만, 큰 파일 앞부분에 byte가 삽입되면 content-defined chunking보다 재사용 효율이 떨어질 수 있습니다.
- Chrona는 raw/off, standard Zstd level 3, fast LZ4 frame 모드를 지원하며 block identity는 항상 raw byte hash로 유지합니다.
- Chrona의 snapshot은 Merkle tree가 아니라 reference graph입니다.
- Block garbage collection, 자동 복구, encryption, content-defined chunking은 이후 알고리즘 후보입니다. 압축 구현 기록은 `docs/implemented/block-compression.md`에 있습니다.

## 개발 방법

의존성 설치:

```bash
npm install
```

프론트엔드만 실행:

```bash
npm run dev
```

데스크톱 앱 개발 모드 실행:

```bash
npm run tauri dev
```

테스트:

```bash
npm test
cd src-tauri && cargo test
```

프론트엔드 빌드:

```bash
npm run build
```

## 문서

- `docs/project-plan.md`: 전체 프로젝트 계획
- `docs/specs/`: 설계 결정과 포맷
- `docs/plans/`: 현재 진행 또는 다음 구현 계획
- `docs/implemented/`: 완료된 기능 구현 기록
- `docs/archive/`: 완료되었거나 폐기된 작업 문서
- `docs/development-log.md`: 날짜별 개발 로그

## 라이선스

Chrona는 PolyForm Noncommercial License 1.0.0에 따라 비상업적 사용만 허용되는 source-available 프로젝트입니다.

저작권자의 별도 서면 허가 없이 상업적 이용은 금지됩니다.
자세한 내용은 `LICENSE`를 확인하세요.
