# Chrona

Chrona는 블록 기반 시점별 데이터 관리 데스크톱 애플리케이션입니다.

파일을 재사용 가능한 데이터 블록으로 저장하고, 여러 시점의 파일 상태를 스냅샷으로 관리하는 것을 목표로 합니다. 상용 백업 프로그램을 대체하는 것이 아니라, 고정 크기 블록 분할, 블록 식별, 블록 재사용, 스냅샷 메타데이터, 복원 흐름, 무결성 검증 같은 저장 시스템의 핵심 구조를 직접 구현하고 시각화하는 프로젝트입니다.

## 현재 상태

현재는 Phase 2까지 완료된 상태입니다.

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
- macOS native 파일/폴더 선택창

아직 구현되지 않음:

- 스냅샷 비교
- 복원
- 무결성 검증 UI
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

### Complexity

정의:

- `N` = 전체 입력 byte 수
- `B` = block size, 현재 `1 MiB`
- `K` = block reference 개수
- `U` = 새로 저장되는 unique block byte 수

복잡도:

- Chunking + hashing time: `O(N)`
- Dedup lookup time: hash set/path existence check 기준 평균 `O(K)`
- File streaming memory: `O(B)`
- Metadata memory/output: `O(K)`
- Physical storage growth: `O(U)`

### 현재 알고리즘 trade-off

- Fixed-size chunking은 단순하고 결정적이지만, 큰 파일 앞부분에 byte가 삽입되면 content-defined chunking보다 재사용 효율이 떨어질 수 있습니다.
- Chrona는 현재 deduplication을 수행하며, compression 알고리즘은 아직 없습니다.
- Chrona의 snapshot은 Merkle tree가 아니라 reference graph입니다.
- Restore, integrity verification, block garbage collection, compression, encryption, content-defined chunking은 이후 알고리즘 후보입니다.

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
- `docs/plans/`: Phase별 실행 계획
- `docs/implemented/`: 완료된 기능 구현 기록
- `docs/development-log.md`: 날짜별 개발 로그

## 라이선스

Chrona는 PolyForm Noncommercial License 1.0.0에 따라 비상업적 사용만 허용되는 source-available 프로젝트입니다.

저작권자의 별도 서면 허가 없이 상업적 이용은 금지됩니다.
자세한 내용은 `LICENSE`를 확인하세요.
