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

## 저장 알고리즘

Chrona는 현재 content-addressed fixed-block storage 모델을 사용합니다.

### Block ingest

1. source path와 repository path가 같은 경로이거나 서로 포함 관계인지 먼저 검사합니다.
2. 선택한 파일 또는 폴더를 scan하고, metadata path를 OS와 무관한 `/` 구분 relative path로 변환합니다.
3. 각 파일을 `1 MiB` 고정 크기 chunk로 streaming 처리합니다. 마지막 chunk는 더 작을 수 있습니다.
4. chunk의 실제 byte에 대해 `SHA-256` hash를 계산합니다.
5. block은 hash 기준으로 `blocks/{hash[0..2]}/{hash[2..4]}/{hash}.blk`에 저장합니다.
6. 같은 hash의 block이 이미 있으면 중복 저장하지 않고 재사용합니다.
7. 새 block은 `{hash}.blk.tmp-{operationId}`에 먼저 쓴 뒤 최종 `.blk` 경로로 rename합니다.
8. ingest 중에는 현재 파일명과 처리 byte 수를 progress event로 전달합니다.

### Snapshot creation

스냅샷은 파일 byte를 다시 복사하는 기능이 아니라 block engine 위에 얹는 metadata입니다.

- Snapshot 생성 시 선택한 source에 대해 block ingest를 실행합니다.
- File entry에는 정규화된 relative path, file size, modified time, ordered block reference를 저장합니다.
- Snapshot JSON은 `snapshots/{snapshotId}.json`에 `.tmp` 기록 후 rename 방식으로 저장합니다.
- `indexes/snapshot-index.json`은 목록 조회를 위해 최신순 snapshot summary를 저장합니다.
- Snapshot ID는 path traversal 방지를 위해 ASCII letter, digit, `_`, `-`만 허용합니다.

### 현재 trade-off

- Fixed-size chunking은 단순하고 결정적이지만, content-defined chunking보다 중간 삽입/삭제로 밀린 content 재사용에는 불리합니다.
- Block compression과 encryption은 아직 구현하지 않았습니다.
- Delete, garbage collection, restore, integrity verification은 이후 Phase 범위입니다.
- MVP metadata path는 UTF-8 변환 가능한 path만 지원합니다.

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
