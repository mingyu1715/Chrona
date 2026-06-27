# Chrona Project Plan

## 1. 프로젝트 정의

Chrona는 파일과 폴더를 고정 크기 데이터 블록으로 분할하고, 각 시점의 파일 상태를 스냅샷 메타데이터로 저장하는 데스크톱 응용프로그램이다. 목표는 상용 백업 프로그램을 대체하는 것이 아니라, 블록 기반 저장, 블록 재사용, 스냅샷 생성, 복원, 비교, 무결성 검증, 시각화를 직접 설계하고 구현하는 것이다.

2인 기준 4~6주 안에 공개 가능한 MVP를 만든다. MVP는 "선택한 폴더를 Chrona 저장소에 스냅샷으로 저장하고, 스냅샷 간 변화를 시각적으로 확인하며, 원하는 스냅샷을 다른 폴더로 복원할 수 있는 앱"으로 한정한다.

## 2. 권장 기술 스택

### 선택안

| 선택지 | 장점 | 단점 | 판단 |
| --- | --- | --- | --- |
| Tauri + Rust + React/TypeScript | 파일 I/O, 해시, 블록 저장에 강함. 데스크톱 배포가 가볍고 UI 개발 생산성이 높음 | Rust와 프론트엔드 연동 학습 필요 | 권장 |
| Electron + Node.js + React | 개발 진입 장벽 낮음, UI 생태계 풍부 | 앱이 무겁고 대용량 파일 처리 안정성에서 Rust보다 불리함 | 차선 |
| Python + Qt | 빠른 프로토타입 가능 | 배포, UI 완성도, 장기 유지보수에서 부담 | 비권장 |

### 최종 권장

- Desktop shell: Tauri
- Core engine: Rust
- UI: React + TypeScript
- Visualization: Recharts, CSS grid, 필요 시 SVG 기반 Block Map
- MVP metadata: JSON files
- Future metadata: SQLite
- Hash: SHA-256
- Block size: 기본 1 MiB fixed-size chunk
- Test: Rust unit/integration test, Vitest, Playwright smoke test

## 3. MVP 범위와 현재 상태

현재 상태의 상세 matrix는 `docs/phase-status.md`를 기준으로 관리한다.

### 구현 완료 또는 현재 브랜치에서 완료

- Chrona 저장소 생성 및 열기
- 파일 또는 폴더 선택
- 파일 스캔
- 1 MiB 고정 크기 블록 분할
- SHA-256 기반 블록 식별
- 동일 블록 재사용
- 스냅샷 생성
- 스냅샷 목록 조회
- 스냅샷 상세 조회
- 두 스냅샷 비교
- 선택 스냅샷을 지정 폴더로 복원
- Home/adaptive navigation
- 블록 무결성 검증
- README, 개발 로그, 구현 기록 문서

### 다음 구현 대상

- Repository Inventory Explorer
  - repository에 기록된 원본 파일 목록
  - 파일 종류 분류
  - 최신 snapshot 기준 존재/삭제 상태
  - 현재 원본 파일 경로 존재/누락 상태

### 아직 세부 계획 없음

- 블록 압축: `docs/specs/0005-block-compression.md`에 설계만 있고 구현 계획은 없음
- 저장 공간 분석 대시보드
- 파일별 블록 목록 및 변경 이력
- File Inspector / Block Map
- 패키징된 `.app` 릴리스와 signing

### MVP에서 제외하거나 Future로 유지

- 자동 백업 스케줄러
- 암호화
- 압축
- 내용 기반 청킹
- 클라우드 연동
- 완전한 macOS 권한 자동 처리
- 스냅샷 삭제와 가비지 컬렉션
- 실시간 파일 감시

## 4. 전체 목표 시스템 아키텍처

아래 구조는 최종적으로 지향하는 목표 구조다. 현재 구현된 부분과 아직 없는 부분은 `docs/phase-status.md`와 이 문서의 상태 표를 기준으로 판단한다.

```text
React UI
  ├─ Dashboard
  ├─ Snapshot List / Detail
  ├─ Snapshot Compare
  ├─ Repository Explorer / Inventory
  ├─ File Inspector
  ├─ Block Map
  └─ Restore Dialog

Tauri Commands
  ├─ create_repository
  ├─ open_repository
  ├─ create_snapshot
  ├─ list_snapshots
  ├─ get_snapshot
  ├─ compare_snapshots
  ├─ restore_snapshot
  ├─ verify_repository
  ├─ get_repository_inventory
  └─ get_statistics

Rust Core
  ├─ RepositoryManager
  ├─ FileScanner
  ├─ FixedChunker
  ├─ BlockHasher
  ├─ BlockStore
  ├─ SnapshotStore
  ├─ SnapshotService
  ├─ DiffService
  ├─ RestoreService
  ├─ IntegrityService
  ├─ InventoryService
  └─ StatisticsService

Chrona Repository
  ├─ manifest.json
  ├─ blocks/
  ├─ snapshots/
  ├─ indexes/
  └─ logs/
```

UI는 도메인 로직을 갖지 않고 Tauri command를 호출한다. Rust core는 UI와 독립적으로 테스트 가능해야 한다. 저장소 포맷은 앱 버전과 분리해 관리하며, `manifest.json`에 repository schema version을 둔다.

## 5. 저장 구조

현재 구현된 저장소 구조는 다음과 같다.

```text
chrona-repository/
  manifest.json
  blocks/
    ab/
      cd/
        abcdef...sha256.blk
  snapshots/
    20260619T103000Z_8f31c2.json
  indexes/
    snapshot-index.json
    access-index.json
  logs/
```

현재 구현 기준:

- `manifest.json`: repository schema와 block strategy 기록
- `blocks/`: raw `.blk` block payload 저장
- `snapshots/`: snapshot JSON 저장
- `indexes/snapshot-index.json`: snapshot 목록 index
- `indexes/access-index.json`: Home/adaptive navigation 접근 기록
- `logs/`: 예약된 디렉터리. structured app log는 아직 구현하지 않음

아직 구현되지 않은 저장 구조:

- `indexes/block-index.json`: 현재 없음. physical block은 hash path 존재 여부로 확인한다.
- SQLite metadata backend: Future
- compressed block envelope: Future
- snapshot delete/GC metadata: Future

### manifest.json

```json
{
  "schemaVersion": 1,
  "appVersion": "0.1.0",
  "repositoryId": "uuid",
  "createdAt": "2026-06-19T10:30:00Z",
  "blockStrategy": {
    "type": "fixed",
    "sizeBytes": 1048576,
    "hash": "sha256"
  }
}
```

### snapshot 파일

```json
{
  "schemaVersion": 1,
  "id": "20260619T103000Z_8f31c2",
  "name": "Initial import",
  "createdAt": "2026-06-19T10:30:00Z",
  "sourceRoot": "/Users/example/Documents/demo",
  "summary": {
    "fileCount": 12,
    "totalOriginalBytes": 7340032,
    "totalBlockReferences": 21,
    "newBlockCount": 8,
    "reusedBlockCount": 13,
    "newStoredBytes": 4194304
  },
  "files": [
    {
      "relativePath": "notes/a.txt",
      "sizeBytes": 1024,
      "modifiedAt": "2026-06-19T10:00:00Z",
      "blocks": [
        {
          "index": 0,
          "offset": 0,
          "sizeBytes": 1024,
          "hash": "sha256hex",
          "wasNew": true
        }
      ]
    }
  ]
}
```

## 6. 핵심 데이터 흐름

### 구현 완료: Block ingest

1. 사용자가 repository path와 source path를 지정한다.
2. `RepositoryManager`가 repository를 검증한다.
3. source/repository 포함 관계를 차단한다.
4. `FileScanner`가 source 파일 목록을 만든다.
5. `FixedChunker`가 1 MiB 단위로 streaming read한다.
6. `Hasher`가 raw chunk SHA-256을 계산한다.
7. `BlockStore`가 block path 존재 여부로 reuse/new를 판정한다.
8. 새 block이면 `.tmp-{operationId}`로 쓴 뒤 rename한다.
9. UI는 progress event와 summary를 받는다.

### 구현 완료: Snapshot 생성

1. `SnapshotService`가 block ingest를 실행한다.
2. ingest 결과의 file/block metadata를 snapshot JSON으로 변환한다.
3. `SnapshotStore`가 snapshot 파일을 `.tmp` 후 rename으로 저장한다.
4. `indexes/snapshot-index.json`을 최신순으로 갱신한다.

### 구현 완료: Snapshot 비교

1. 두 snapshot JSON을 읽는다.
2. relative path 기준으로 파일 집합을 비교한다.
3. size와 ordered block hash sequence로 unchanged/modified를 판정한다.
4. block reference multiset으로 added/removed/shared reference counts를 계산한다.

### 구현 완료: Snapshot 복원

1. 사용자가 snapshot과 target folder를 선택한다.
2. target이 repository 내부이거나 non-empty이면 거부한다.
3. snapshot file entry의 block hash 순서대로 `.blk` 파일을 읽는다.
4. target file을 `.tmp-{operationId}`로 쓴 뒤 rename한다.
5. block 누락과 size mismatch는 오류로 반환한다.

### 구현 완료: Integrity 검증

1. snapshot index와 snapshot JSON을 읽는다.
2. unique block hash와 expected size를 수집한다.
3. physical `.blk` 파일 존재 여부를 확인한다.
4. size와 raw SHA-256을 검증한다.
5. missing/corrupt issue를 report로 반환한다.

### 다음 구현 대상: Repository Inventory Explorer

1. snapshot index와 snapshot JSON을 읽는다.
2. relative path별로 기록된 파일을 aggregate한다.
3. 확장자로 file kind를 분류한다.
4. 최신 snapshot 기준 present/deleted 상태를 계산한다.
5. source root가 있으면 현재 원본 파일 존재 여부를 best-effort로 확인한다.
6. Explorer UI가 summary, kind breakdown, filterable table을 표시한다.

## 7. 모듈 구조

### 현재 구현된 Rust modules

```text
src-tauri/src/
  commands/
    block_commands.rs
    home_commands.rs
    integrity_commands.rs
    repository_commands.rs
    restore_commands.rs
    snapshot_commands.rs
  core/
    access_index.rs
    access_store.rs
    block_ingest_service.rs
    block_store.rs
    chunker.rs
    diff_service.rs
    errors.rs
    hasher.rs
    home_service.rs
    integrity_service.rs
    path_safety.rs
    repository.rs
    restore_service.rs
    scanner.rs
    snapshot_service.rs
    snapshot_store.rs
  models/
    access.rs
    block.rs
    diff.rs
    ingest.rs
    integrity.rs
    progress.rs
    repository.rs
    restore.rs
    snapshot.rs
```

### 현재 구현된 UI modules

```text
src/
  features/
    repository/
      RepositoryPage.tsx
      RepositoryPage.css
      RepositoryPage.test.tsx
    snapshots/
      SnapshotPanel.tsx
      SnapshotComparePanel.tsx
      *.test.tsx
  shared/
    api/chronaApi.ts
    types/chrona.ts
```

### 다음 추가 예정 modules

```text
src-tauri/src/
  commands/inventory_commands.rs
  core/inventory_service.rs
  models/inventory.rs
src-tauri/tests/phase5_inventory.rs
```

아직 없는 modules:

- `statistics_service.rs`
- dashboard feature module
- file-inspector feature module
- block-map visualization module
- compression module
- garbage collection module
- watcher module

## 8. 핵심 클래스와 객체 상태

### 구현 완료

- `RepositoryManager`: 저장소 생성, 열기, manifest 검증
- `FileScanner`: 파일 목록 수집과 metadata relative path 정규화
- `FixedChunker`: 파일을 고정 크기 block으로 streaming
- `BlockStore`: block 저장, reuse 판정, block read
- `SnapshotStore`: snapshot JSON과 snapshot index 저장/조회
- `SnapshotService`: block ingest와 snapshot metadata 생성을 조율
- `DiffService`: snapshot comparison 계산
- `RestoreService`: snapshot에서 파일 재조립
- `IntegrityService`: 저장된 block 존재/size/hash 검증
- `AccessIndex`, `AccessStore`, `HomeService`: Home/adaptive access 기록

### 다음 구현 대상

- `InventoryService`: repository에 기록된 파일, 종류, 상태를 metadata-only로 집계

### 아직 없음

- `StatisticsService`
- `CompressionService`
- `GarbageCollectionService`
- `WatcherService`

## 9. 화면 구성 상태

### 구현 완료

- Repository 생성/열기
- Source file/folder 선택
- Block ingest progress/result
- Snapshot 생성/list/detail
- Snapshot comparison
- Snapshot restore target/result
- Home/adaptive navigation
- Integrity verification report
- Light/dark theme과 Docker Desktop 참고 sidebar layout

### 다음 구현 대상

- Repository Explorer / Inventory
  - summary cards
  - file kind breakdown
  - search/filter controls
  - file table
  - latest snapshot presence state
  - source existence state

### 아직 없음

- Repository Statistics Dashboard
- File Inspector
- File Block Map
- Advanced visualization charts
- Release/About screen

## 10. 시각화 기준

현재 구현된 시각화는 summary cards, status panels, list/table 중심이다. 고급 block visualization은 아직 없다.

다음 우선순위는 Repository Inventory Explorer처럼 metadata를 사용자가 이해할 수 있게 보여주는 화면이다. 그 다음에 필요하면 statistics dashboard와 file block map을 별도 spec/plan으로 설계한다.

MVP에서는 전체 저장소의 거대한 block graph를 만들지 않는다. 파일 단위 block map과 snapshot별 통계 시각화는 아직 세부 계획이 없다.

## 11. 테스트 구조

### 현재 구현된 테스트

```text
src-tauri/tests/
  phase1_core.rs
  phase2_snapshot.rs
  phase3_diff.rs
  phase4_restore.rs
  phase5_integrity.rs
  home_access.rs
src/features/**/*.test.tsx
```

### 검증 기준

- Rust core 변경: `cd src-tauri && cargo test`
- UI 변경: `npm test`
- TypeScript/Vite build: `npm run build`
- whitespace: `git diff --check`

### 다음 추가 예정 테스트

```text
src-tauri/tests/phase5_inventory.rs
```

Repository Inventory Explorer 구현 시 다음을 검증한다.

- one snapshot inventory
- file kind classification
- deleted in latest snapshot
- current source missing
- source root missing
- Explorer UI render/filter behavior

## 12. 현재 상태 요약

상세 상태표는 `docs/phase-status.md`에 둔다. 이 문서는 큰 방향을 유지하고, 실제 완료/진행/미계획 상태는 아래 기준으로 해석한다.

### 구현 완료

- Phase 0/1: 프로젝트 초기 구조, GitHub 운영 문서, 저장소 포맷, 블록 엔진
- Phase 2: 스냅샷 엔진
- Phase 3: 스냅샷 비교
- Phase 4: 스냅샷 복원
- 별도 작업: 홈/적응형 탐색
- Phase 5a: 무결성 검증, 현재 브랜치에서 구현 완료 상태이며 커밋/병합 대기

완료된 설계 문서는 `docs/archive/specs/`에 보관한다.

### 현재 구현 계획

- Phase 5b: Repository Inventory Explorer
  - Spec: `docs/specs/0009-repository-inventory-explorer.md`
  - Plan: `docs/plans/phase-5-repository-inventory-explorer.md`

### 설계는 있지만 구현 계획이 없는 작업

- Block compression
  - Spec: `docs/specs/0005-block-compression.md`
  - 구현 계획 없음
  - Repository Inventory Explorer 범위에서 제외

### 설계와 상세 계획이 모두 없는 후보

- Repository Statistics Dashboard
- File Inspector / Block Map
- Packaged `.app` release/signing
- Snapshot delete and garbage collection
- Watcher/automatic snapshots
- SQLite metadata backend
- Encryption
- Content-defined chunking
- Cloud block storage adapter
- Repository migration tool

## 13. Phase별 개발 계획

### Phase 0/1. Project Scaffold + Block Engine

- 상태: 완료
- Spec: `docs/archive/specs/0001-repository-format.md`, `docs/archive/specs/0002-block-engine.md`
- Plan: `docs/archive/plans/phase-1-block-engine.md`
- Implemented: `docs/implemented/block-engine.md`, `docs/implemented/phase-1-summary.md`
- 완료 범위: repository 생성/열기, fixed chunking, SHA-256 block identity, duplicate block reuse, `.tmp` then rename writes, progress events, minimal ingest UI

### Phase 2. Snapshot Engine

- 상태: 완료
- Spec: `docs/archive/specs/0003-snapshot-format.md`
- Plan: `docs/archive/plans/phase-2-snapshot-engine.md`
- Implemented: `docs/implemented/snapshot-engine.md`
- 완료 범위: snapshot create/list/detail, snapshot index, snapshot JSON persistence, minimal snapshot UI

### Phase 3. Snapshot Comparison

- 상태: 완료
- Spec: `docs/archive/specs/0004-snapshot-comparison.md`
- Plan: `docs/archive/plans/phase-3-snapshot-comparison.md`
- Implemented: `docs/implemented/snapshot-comparison.md`
- 완료 범위: added/deleted/modified/unchanged classification, block-reference multiset counts, compare command and UI

### Phase 4. Snapshot Restore

- 상태: 완료
- Spec: `docs/archive/specs/0007-snapshot-restore.md`
- Plan: `docs/archive/plans/phase-4-snapshot-restore.md`
- Implemented: `docs/implemented/snapshot-restore.md`
- 완료 범위: restore to empty/new target, target safety checks, block read, file materialization, `.tmp` then rename output writes

### Side Slice. Home and Adaptive Navigation

- 상태: 완료
- Spec: `docs/archive/specs/0006-home-adaptive-navigation.md`
- Plan: `docs/archive/plans/phase-next-home-adaptive-navigation.md`
- Implemented: `docs/implemented/home-adaptive-navigation.md`
- 완료 범위: Continue Working, pinned/recent items, repository-local access index, pin/unpin, clear history

### Phase 5a. Integrity Verification

- 상태: 현재 브랜치에서 구현 완료, commit/merge 대기
- Spec: `docs/archive/specs/0008-integrity-verification.md`
- Plan: `docs/archive/plans/phase-5-integrity-verification.md`
- Implemented: `docs/implemented/integrity-verification.md`
- 완료 범위: read-only verification, missing block detection, block size mismatch, raw SHA-256 mismatch, Integrity UI

### Phase 5b. Repository Inventory Explorer

- 상태: 다음 active plan, 미구현
- Spec: `docs/specs/0009-repository-inventory-explorer.md`
- Plan: `docs/plans/phase-5-repository-inventory-explorer.md`
- Implemented: 없음
- 목표: repository에 기록된 파일, 파일 종류, 최신 snapshot 기준 삭제 여부, 현재 원본 파일 존재 여부를 보여줌
- 제외: compression, block payload read, garbage collection, snapshot delete, watcher

### Phase 5c. Repository Statistics Dashboard

- 상태: 후보, 세부 spec/plan 없음
- 목표: 저장량, 절약량, reuse ratio, snapshot별 변화량을 dashboard로 표시
- 다음 문서 후보: `docs/specs/0010-repository-statistics-dashboard.md`

### Phase 5d. File Inspector / Block Map

- 상태: 후보, 세부 spec/plan 없음
- 목표: 특정 파일의 block reference sequence와 snapshot별 변경 이력을 시각화
- 다음 문서 후보: `docs/specs/0011-file-inspector-block-map.md`

### Release Phase. Packaging and Release Hardening

- 상태: 후보, 세부 plan 없음
- 목표: README 기준 설치/실행/테스트 정리, macOS `.app` packaging, release note, smoke test
- 다음 문서 후보: `docs/plans/phase-release-packaging.md`

### Future. Compression and Storage Extensions

- 상태: Future
- Compression spec: `docs/specs/0005-block-compression.md`
- 구현 plan: 없음
- 원칙: raw chunk SHA-256 identity 유지, payload만 optional encoding
- 다른 future: SQLite backend, encryption, content-defined chunking, snapshot delete/GC, watcher, cloud adapter, migration tool

## 14. 2인 역할 분담

### Developer A: Core/Storage 담당

- Rust core 설계
- repository format
- block engine
- snapshot engine
- restore/diff/integrity
- Rust 테스트
- implemented 문서 중 core 영역 작성

### Developer B: UI/Visualization/Docs 담당

- Tauri command 연동
- React 화면 구성
- dashboard, chart, block map
- GitHub issue/label/PR template
- README, development guide, development log 관리
- Playwright smoke test

### 함께 처리할 작업

- Phase 시작 전 spec 리뷰
- Phase 종료 전 데모 확인
- PR 리뷰
- release note 작성

## 15. Git/GitHub 운영

### Branch 규칙

- `main`: 항상 실행 가능한 상태
- `feature/block-engine`: 새 기능
- `feature/snapshot-engine`: 새 기능
- `feature/visualization`: 새 기능
- `fix/restore-corruption`: 버그 수정
- `docs/development-guide`: 문서 작업
- `chore/project-setup`: 설정, 빌드, CI

브랜치는 issue 하나 또는 작게 쪼갠 기능 하나에 대응한다. 3일 이상 걸리는 브랜치는 scope가 큰 것으로 보고 issue를 나눈다.

### Commit 규칙

- `feat: add fixed-size block store`
- `fix: prevent restore outside target directory`
- `refactor: split snapshot metadata models`
- `docs: add development guide`
- `test: add snapshot restore integration test`
- `chore: configure tauri build`

커밋은 빌드 가능한 단위로 작게 만든다. 대규모 phase 종료 시 squash하지 말고 구현 흐름을 추적할 수 있게 의미 있는 커밋을 남긴다.

### Label 구조

- type: `type:feature`, `type:bug`, `type:docs`, `type:test`, `type:refactor`, `type:chore`
- area: `area:block`, `area:snapshot`, `area:restore`, `area:statistics`, `area:visualization`, `area:docs`, `area:ui`
- priority: `priority:p1`, `priority:p2`, `priority:p3`
- status: `status:needs-design`, `status:ready`, `status:blocked`, `status:in-review`

### 개발 흐름

```text
issue -> spec/plan -> branch -> commit -> PR -> review -> merge
  -> development-log 갱신
  -> 큰 기능이면 docs/implemented 문서 작성
```

## 16. 문서 구조

```text
README.md
README.ko.md
CONTRIBUTING.md
AGENTS.md
LICENSE
docs/
  development-log.md
  phase-status.md
  project-plan.md
  implemented/
    block-engine.md
    snapshot-engine.md
    snapshot-comparison.md
    snapshot-restore.md
    home-adaptive-navigation.md
    integrity-verification.md
  specs/
    0005-block-compression.md
    0009-repository-inventory-explorer.md
  plans/
    README.md
    phase-5-repository-inventory-explorer.md
  archive/
    README.md
    specs/
      README.md
      0001-repository-format.md
      0002-block-engine.md
      0003-snapshot-format.md
      0004-snapshot-comparison.md
      0006-home-adaptive-navigation.md
      0007-snapshot-restore.md
      0008-integrity-verification.md
    plans/
      phase-1-block-engine.md
      phase-2-snapshot-engine.md
      phase-3-snapshot-comparison.md
      phase-4-snapshot-restore.md
      phase-5-integrity-verification.md
      phase-next-home-adaptive-navigation.md
```

### 역할

- `README.md`: 프로젝트 소개, 빠른 실행, 데모 이미지
- `README.ko.md`: 한국어 소개
- `CONTRIBUTING.md`: 외부 기여 방법
- `AGENTS.md`: AI coding agent 작업 규칙
- `docs/development-log.md`: 날짜별 작업 기록
- `docs/implemented/`: 큰 기능 완료 후 구현 기록
- `docs/specs/`: 아직 구현하지 않았거나 다음에 구현할 설계 문서
- `docs/plans/`: 현재 진행 또는 다음 작업 체크리스트
- `docs/archive/specs/`: 구현 완료 후 보관한 설계 문서
- `docs/archive/plans/`: 완료되었거나 폐기된 작업 계획
- `docs/archive/`: 완료되었거나 폐기된 오래된 작업 문서

## 17. Development Guide 규칙

작업 전 확인 순서:

1. `git status`로 작업트리 확인
2. 관련 issue 확인
3. 관련 spec과 plan 확인
4. 최근 development log 확인
5. 새 브랜치 생성

문서 수정 규칙:

- 데이터 포맷이 바뀌면 현재 `docs/specs/` 또는 보관된 `docs/archive/specs/` 문서를 갱신
- 큰 기능이 완료되면 implemented 문서 작성
- phase가 끝나면 development log 갱신
- 구현 완료된 spec은 `docs/archive/specs/`로 이동
- README는 사용자 관점, docs는 개발자 관점으로 작성

테스트 기준:

- Rust core 변경은 `cargo test`
- UI 변경은 `npm test`
- 주요 흐름 변경은 Playwright smoke test
- restore 관련 변경은 byte equality integration test 필수

금지 사항:

- unrelated 파일 수정 금지
- 검증 없이 "완료" 표시 금지
- block format 변경 후 migration 설명 없이 merge 금지
- destructive Git command 금지
- 사용자 원본 폴더에 직접 복원하는 기능을 MVP 기본값으로 두지 않기

## 18. Development Log 형식

```markdown
## 2026-06-19

### 완료 사항
- Fixed-size block store 구현
- 동일 블록 중복 저장 방지 테스트 추가

### 검증 결과
- `cargo test` 통과
- duplicate fixture에서 block file count 유지 확인

### 결정 사항
- MVP block size는 1 MiB로 고정
- block id는 SHA-256 hex 사용

### 다음 작업
- snapshot metadata schema 구현
```

## 19. Implemented 문서 형식

```markdown
# Block Engine 구현 기록

## 목표
파일을 고정 크기 블록으로 분할하고 중복 블록을 저장하지 않는다.

## 구현 범위
- FixedChunker
- BlockHasher
- BlockStore

## 데이터 흐름
source file -> chunk -> hash -> block store

## 주요 결정
- 1 MiB fixed chunk
- SHA-256 hash
- hash prefix 기반 block path

## 검증
- `cargo test core::block_store`
- duplicate fixture 테스트

## 한계
- 내용 기반 청킹 미지원
- block garbage collection 미지원

## 다음 개선
- SQLite index
- content-defined chunking
```

## 20. Specs와 Plans 분리

- Spec은 "무엇을 왜 만들지"를 기록한다.
- Plan은 "어떤 파일을 어떤 순서로 바꿀지"를 기록한다.
- 아직 구현하지 않았거나 다음 구현 대상인 Spec은 `docs/specs/`에 둔다.
- 구현 완료된 Spec은 `docs/archive/specs/`로 이동한다.
- Plan은 실행 체크리스트이므로 완료 후 `docs/archive/plans/`로 이동한다.
- 구현이 끝난 큰 기능은 `docs/implemented/`에 결과 중심 문서를 남긴다.

권장 흐름:

```text
docs/specs/00NN-current-work.md
docs/plans/phase-N-current-work.md
implementation
docs/implemented/current-work.md
docs/archive/specs/00NN-current-work.md
docs/archive/plans/phase-N-current-work.md
```

## 21. AGENTS.md 초안 규칙

- 작업 전 `git status`를 확인한다.
- 관련 spec, plan, development log를 먼저 읽는다.
- 사용자 요청 범위 밖의 파일을 수정하지 않는다.
- 구현 전 실패하는 테스트를 먼저 추가한다.
- 작업 후 관련 테스트를 실행한다.
- 저장 포맷, 명령 API, 사용자 흐름이 바뀌면 문서를 갱신한다.
- 큰 기능 완료 시 `docs/implemented/`에 구현 기록을 추가한다.
- destructive Git 명령을 사용하지 않는다.
- 기존 사용자 변경을 되돌리지 않는다.
- 복원 기능은 path traversal과 overwrite 위험을 반드시 검증한다.

## 22. 예상 어려움과 해결 방안

| 어려움 | 원인 | 해결 |
| --- | --- | --- |
| 대용량 파일 처리 중 UI 멈춤 | 동기 I/O와 UI 상태 갱신 부족 | Rust streaming 처리, progress event 전송 |
| JSON index 성능 저하 | block 수 증가 | MVP는 제한된 데이터셋, Future에서 SQLite 전환 |
| 복원 안전성 | 잘못된 target path, 덮어쓰기 위험 | 새 폴더 복원을 기본값으로 하고 path normalization 검증 |
| 파일 권한 문제 | OS별 접근 권한 차이 | permission error를 구조화해 UI에 표시 |
| 시각화 scope 과대화 | block graph가 복잡해짐 | MVP는 dashboard와 파일 단위 block map에 집중 |
| 스냅샷 삭제 후 block 정리 | ref count와 GC 필요 | MVP 제외, Future에서 SQLite 기반 GC 설계 |
| 내용 기반 청킹 부재 | 중간 삽입 변경에 fixed chunk가 약함 | Future에서 FastCDC/Rabin fingerprinting 검토 |
| 블록 압축 도입 시 dedup 흔들림 | 압축 후 byte를 hash identity로 쓰면 설정 변경에 따라 같은 원본이 다른 block이 됨 | raw chunk SHA-256을 identity로 유지하고 저장 payload만 zstd 등으로 압축 |
| Splay tree로 폴더 구조가 흔들림 | 접근할 때마다 UI tree 순서가 바뀌면 사용자가 위치를 잃음 | source tree는 stable path view로 유지하고 splay tree는 access index에만 사용 |

## 23. 확장 기능

### Future compression rule

Block compression은 저장 공간 최적화 후보지만 현재 MVP 구현 대상은 아니다. 이후 도입 시에도 block hash는 반드시 압축 전 raw chunk의 SHA-256으로 유지하고, 새 block의 물리 payload만 선택적으로 압축한다. 압축 모드는 `off`(raw), `standard`(`zstd` level 3), `fast`(`lz4`)로 제한한다. 기본값은 `standard`이며, 압축 결과가 envelope overhead를 포함해 raw보다 최소 3% 이상 작지 않으면 raw 저장으로 fallback한다.

- SQLite metadata backend
- compression with raw-byte block identity, standard zstd mode, and fast lz4 mode (`docs/specs/0005-block-compression.md`, 설계만 있음, 구현 계획 없음)
- encryption
- content-defined chunking
- snapshot delete and garbage collection
- watched sources with automatic snapshot creation after debounce
- automatic scheduled snapshots
- cloud block storage adapter
- repository migration tool
- macOS app signing and packaging
- advanced block graph visualization
- restore preview
- adaptive home navigation with splay-tree access index

## 24. 4~6주 일정 요약

| 주차 | 목표 | 산출물 |
| --- | --- | --- |
| 1주차 | 앱 부트스트랩, 저장소 포맷, block engine | 실행 앱, block tests, storage spec |
| 2주차 | snapshot 생성/조회 | snapshot list/detail, snapshot spec |
| 3주차 | snapshot comparison | 비교 command/UI, diff integration test |
| 4주차 | home/adaptive navigation | Home 화면, recent/quick access, splay-tree access index |
| 5주차 | restore/integrity/error | 복원 기능, 검증 기능, error report |
| 6주차 | visualization/polish buffer | dashboard/block map 후보, demo screenshots, known limitations |

## 25. 최종 MVP 완료 기준

- 사용자가 저장소를 만들고 폴더를 선택해 snapshot을 생성할 수 있다.
- 동일 데이터 블록이 중복 저장되지 않는다.
- snapshot 목록과 상세 통계를 볼 수 있다.
- 두 snapshot 사이의 added/modified/deleted 파일을 확인할 수 있다.
- Home 화면에서 최근/반복 작업으로 빠르게 복귀할 수 있다.
- 선택 snapshot을 새 target folder에 복원할 수 있다.
- 복원 파일 내용이 원본 snapshot과 byte-level로 일치한다.
- 저장 공간 절약량과 블록 재사용률을 dashboard에서 확인할 수 있다.
- 파일 단위 block map으로 블록 구성과 재사용을 확인할 수 있다.
- block integrity 검증을 실행할 수 있다.
- README와 docs만 보고 개발자가 빌드, 테스트, 구조 이해를 할 수 있다.
