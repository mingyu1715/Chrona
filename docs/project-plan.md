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

## 3. MVP 범위

### 포함

- Chrona 저장소 생성 및 열기
- 파일 또는 폴더 선택
- 파일 스캔
- 1 MiB 고정 크기 블록 분할
- SHA-256 기반 블록 식별
- 동일 블록 재사용
- 스냅샷 생성
- 스냅샷 목록 조회
- 스냅샷 상세 통계
- 두 스냅샷 비교
- 선택 스냅샷을 지정 폴더로 복원
- 저장 공간 분석 대시보드
- 파일별 블록 목록 및 변경 이력
- 블록 무결성 검증
- README, 개발 가이드, 개발 로그, 구현 기록 문서

### 제외

- 자동 백업 스케줄러
- 암호화
- 압축
- 내용 기반 청킹
- 클라우드 연동
- 완전한 macOS 권한 자동 처리
- 스냅샷 삭제와 가비지 컬렉션
- 실시간 파일 감시

## 4. 전체 시스템 아키텍처

```text
React UI
  ├─ Dashboard
  ├─ Snapshot List / Detail
  ├─ Snapshot Compare
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
  ├─ verify_blocks
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

Chrona는 사용자가 선택한 저장소 폴더 안에 다음 구조를 만든다.

```text
chrona-repository/
  manifest.json
  blocks/
    ab/
      cd/
        abcdef...sha256.blk
  snapshots/
    2026-06-19T10-30-00Z_8f31c2.json
  indexes/
    block-index.json
    snapshot-index.json
  logs/
    development-events.jsonl
```

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

### block-index.json

MVP에서는 JSON으로 시작한다. 블록 수가 늘어나면 SQLite로 전환한다.

```json
{
  "blocks": {
    "sha256hex": {
      "hash": "sha256hex",
      "sizeBytes": 1048576,
      "path": "blocks/ab/cd/sha256hex.blk",
      "firstSeenSnapshotId": "snapshot-id",
      "createdAt": "2026-06-19T10:30:00Z"
    }
  }
}
```

### snapshot 파일

```json
{
  "id": "2026-06-19T10-30-00Z_8f31c2",
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
          "hash": "sha256hex"
        }
      ]
    }
  ]
}
```

## 6. 핵심 데이터 흐름

### 스냅샷 생성

1. 사용자가 source folder와 snapshot name을 선택한다.
2. `FileScanner`가 하위 파일 목록을 만든다.
3. 각 파일을 `FixedChunker`가 1 MiB 단위로 읽는다.
4. `BlockHasher`가 블록 SHA-256을 계산한다.
5. `BlockStore`가 이미 존재하는 블록이면 저장하지 않고 참조만 기록한다.
6. 새 블록이면 `blocks/xx/yy/hash.blk`에 쓴다.
7. `SnapshotService`가 파일 메타데이터와 블록 목록을 snapshot JSON으로 저장한다.
8. `StatisticsService`가 대시보드 수치를 계산한다.

### 스냅샷 비교

1. 두 snapshot JSON을 읽는다.
2. relative path 기준으로 파일 집합을 비교한다.
3. 추가 파일: 이전에는 없고 이후에는 있음.
4. 삭제 파일: 이전에는 있고 이후에는 없음.
5. 수정 파일: 경로는 같지만 size, modifiedAt, block hash list 중 하나가 다름.
6. 블록 집합 차이로 새 저장 블록, 재사용 블록, 저장량 증가분을 계산한다.

### 복원

1. 사용자가 snapshot과 target folder를 선택한다.
2. 앱은 기본적으로 비어 있거나 새로 만든 폴더로 복원하도록 안내한다.
3. `RestoreService`가 snapshot의 파일 목록을 순회한다.
4. 각 파일의 block hash 순서대로 `.blk` 파일을 읽어 target path에 이어 쓴다.
5. 파일 크기가 snapshot metadata와 일치하는지 확인한다.
6. 옵션으로 복원 전 `IntegrityService`가 필요한 블록 해시를 검증한다.

## 7. 모듈 구조

```text
src-tauri/src/
  main.rs
  commands/
    repository_commands.rs
    snapshot_commands.rs
    restore_commands.rs
    statistics_commands.rs
  core/
    repository.rs
    scanner.rs
    chunker.rs
    hasher.rs
    block_store.rs
    snapshot_store.rs
    snapshot_service.rs
    diff_service.rs
    restore_service.rs
    integrity_service.rs
    statistics_service.rs
    errors.rs
  models/
    repository.rs
    block.rs
    snapshot.rs
    diff.rs
    statistics.rs

src/
  app/
    App.tsx
    routes.tsx
  features/
    dashboard/
    repository/
    snapshots/
    compare/
    restore/
    file-inspector/
    visualization/
  shared/
    api/
    components/
    formatting/
    types/
```

Rust core는 파일 시스템과 저장소 포맷을 책임진다. React는 조회, 상태 표시, 사용자 입력, 시각화만 담당한다.

## 8. 핵심 클래스와 객체

### Rust service

- `RepositoryManager`: 저장소 생성, 열기, manifest 검증
- `FileScanner`: 파일 목록 수집, 제외 규칙 처리
- `FixedChunker`: 파일을 고정 크기 블록 iterator로 제공
- `BlockHasher`: SHA-256 해시 계산
- `BlockStore`: 블록 존재 확인, 저장, 읽기
- `SnapshotStore`: snapshot JSON 저장과 조회
- `SnapshotService`: 스캔, 청킹, 저장, metadata 생성을 조율
- `DiffService`: 스냅샷 비교 결과 생성
- `RestoreService`: snapshot에서 파일 재조립
- `IntegrityService`: 저장된 블록 해시 재계산
- `StatisticsService`: 저장 공간, 재사용률, 시계열 통계 계산

### 주요 모델

- `RepositoryManifest`
- `BlockRecord`
- `Snapshot`
- `FileRecord`
- `BlockReference`
- `SnapshotSummary`
- `SnapshotDiff`
- `RepositoryStatistics`
- `RestoreReport`
- `IntegrityReport`

## 9. 화면 구성

### 메인 대시보드

- 전체 파일 수
- 전체 블록 수
- 스냅샷 개수
- 원본 총량
- 실제 저장량
- 절약량
- 블록 재사용률
- 최근 스냅샷 목록
- 스냅샷별 추가 저장량 bar chart

### Repository 화면

- 저장소 생성/열기
- 현재 저장소 위치
- source folder 선택
- snapshot name 입력
- snapshot 생성 진행률

### Snapshot List

- 스냅샷 생성 시간
- 이름
- 파일 수
- 새 블록 수
- 재사용 블록 수
- 추가 저장량

### Snapshot Detail

- 스냅샷 요약 카드
- 파일 트리
- 선택 파일의 블록 목록
- Block Map

### Compare

- 기준 스냅샷과 비교 스냅샷 선택
- added / modified / deleted 파일 탭
- 추가 저장량
- 새 블록 수
- 재사용 블록 수

### Restore

- 복원할 스냅샷 선택
- target folder 선택
- 복원 전 검증 여부
- 결과 리포트

## 10. 시각화 기준

시각화는 MVP의 핵심 기능이다. 단, 복잡한 그래프 라이브러리보다 이해 가능한 기본 시각화를 우선한다.

- 저장 공간 분석: 카드 + bar chart
- 시점별 변화: line chart 또는 stacked bar chart
- 블록 구조: 파일 1개를 기준으로 block strip map 표시
- 블록 재사용: 같은 hash를 같은 색으로 표시
- 스냅샷 비교: added/modified/deleted 요약과 상세 목록
- 데이터 흐름: 첫 화면 또는 docs에 pipeline diagram 제공

MVP에서는 전체 저장소의 거대한 block graph를 만들지 않는다. 대신 파일 단위 Block Map과 스냅샷별 통계 시각화에 집중한다.

## 11. 테스트 구조

```text
src-tauri/src/core/*_test.rs
tests/
  fixtures/
    initial/
    changed/
    duplicate-blocks/
  integration/
    snapshot_restore_test.rs
src/**/*.test.tsx
e2e/
  app-smoke.spec.ts
```

### 필수 테스트

- 동일한 입력 블록은 동일한 hash를 만든다.
- 동일 블록은 중복 저장하지 않는다.
- 파일 하나를 snapshot으로 저장하면 block reference가 순서대로 기록된다.
- 두 snapshot의 added/modified/deleted 결과가 정확하다.
- snapshot에서 복원한 파일 내용이 원본과 동일하다.
- 블록 파일이 손상되면 integrity 검증이 실패한다.
- UI dashboard가 repository statistics를 렌더링한다.

## 12. 개발 우선순위

1. 저장소 포맷과 block engine
2. snapshot 생성
3. snapshot 조회와 기본 통계
4. restore
5. snapshot diff
6. dashboard와 핵심 시각화
7. integrity verification
8. 문서와 GitHub 운영 정리
9. 패키징과 릴리스 준비

복원보다 시각화를 먼저 만들면 데모는 좋아지지만 핵심 신뢰성이 약해진다. 따라서 Phase 3까지는 core correctness를 우선한다.

## 13. Phase별 개발 계획

### Phase 0. 프로젝트 부트스트랩

- 기간: 2~3일
- 목표: 실행 가능한 Tauri 앱과 문서 기반 개발 흐름 확보
- 구현 기능: Tauri/React 초기화, Rust test 환경, README, docs 구조, AGENTS.md 초안
- 필요한 모듈: app shell, docs
- 구현 방식: 빈 화면이 아닌 repository open/create 화면부터 시작
- 데이터 흐름: 없음
- 화면 구성: repository landing 화면
- 테스트 방법: 앱 실행, Rust 기본 test, UI smoke test
- 완료 기준: `npm run tauri dev`, `cargo test`, `npm test`가 통과
- 다음 조건: 저장소 생성 기능을 붙일 준비 완료

### Phase 1. 기본 저장 구조와 블록 엔진

- 기간: 1주
- 목표: 파일을 블록으로 나누고 중복 블록을 재사용해 저장
- 구현 기능: repository 생성, manifest 저장, file scan, fixed chunking, SHA-256 hash, block store
- 필요한 모듈: `RepositoryManager`, `FileScanner`, `FixedChunker`, `BlockHasher`, `BlockStore`
- 구현 방식: 1 MiB 단위 streaming read. hash 앞 4자를 디렉터리 prefix로 사용해 block 파일 분산 저장
- 데이터 흐름: source file -> chunk -> hash -> block exists check -> write or reuse
- 화면 구성: source folder 선택, scan 결과, 저장된 block count 표시
- 테스트 방법: fixture 파일로 chunk 수, hash, 중복 저장 방지 검증
- 완료 기준: 같은 파일을 두 번 처리해도 block 파일 수가 증가하지 않음
- 다음 조건: block reference를 snapshot metadata로 저장할 수 있음

### Phase 2. 스냅샷 시스템

- 기간: 1주
- 목표: 특정 시점의 파일 상태를 snapshot으로 저장하고 목록으로 조회
- 구현 기능: snapshot 생성, snapshot JSON 저장, snapshot index, summary statistics
- 필요한 모듈: `SnapshotStore`, `SnapshotService`, `StatisticsService`
- 구현 방식: relative path, size, modifiedAt, block list를 snapshot file에 기록
- 데이터 흐름: scanned files -> block refs -> snapshot metadata -> snapshot index update
- 화면 구성: snapshot 생성 버튼, snapshot list, snapshot detail summary
- 테스트 방법: snapshot JSON schema, 파일 수, block refs, summary 값 검증
- 완료 기준: 앱에서 스냅샷 생성 후 재시작해도 목록과 상세 조회 가능
- 다음 조건: snapshot 두 개 이상을 비교하고 복원할 수 있음

### Phase 3. 복원과 비교

- 기간: 1주
- 목표: snapshot을 실제 파일로 복원하고 두 snapshot 차이를 계산
- 구현 기능: restore, restore report, diff added/modified/deleted, conflict-safe target restore
- 필요한 모듈: `RestoreService`, `DiffService`
- 구현 방식: MVP에서는 기존 폴더 덮어쓰기를 기본 제공하지 않고 새 target folder 복원을 기본으로 함
- 데이터 흐름: snapshot file records -> block reads -> reconstructed files -> restore report
- 화면 구성: compare 화면, restore dialog, restore result
- 테스트 방법: snapshot 생성 후 복원 파일 byte equality 검증, diff fixture 검증
- 완료 기준: 변경된 파일, 삭제된 파일, 추가된 파일이 UI에 정확히 표시되고 복원이 성공
- 다음 조건: 사용자가 변화와 저장량을 이해할 수 있는 시각화 추가 가능

### Phase 4. 시각화와 UX

- 기간: 1주
- 목표: Chrona의 핵심 가치인 블록 재사용과 시점별 변화를 시각적으로 표현
- 구현 기능: dashboard cards, storage chart, snapshot timeline, file block map, file inspector
- 필요한 모듈: `StatisticsService` 확장, UI visualization components
- 구현 방식: repository statistics API를 만들고 UI는 계산 대신 렌더링에 집중
- 데이터 흐름: snapshots + block index -> statistics -> charts/cards/block map
- 화면 구성: dashboard, snapshot detail block map, file timeline
- 테스트 방법: statistics unit test, chart component rendering test, Playwright screenshot smoke
- 완료 기준: 새 snapshot을 만들면 대시보드 수치와 그래프가 갱신됨
- 다음 조건: 공개용 README와 데모 캡처를 만들 수 있음

### Phase 5. 안정화, 무결성, 문서화

- 기간: 1~2주
- 목표: 공개 가능한 오픈소스 MVP로 정리
- 구현 기능: integrity verification, error handling, progress reporting, docs 정리, implemented 문서 작성
- 필요한 모듈: `IntegrityService`, `errors.rs`, docs
- 구현 방식: block read 실패, hash mismatch, permission error를 사용자 메시지로 변환
- 데이터 흐름: block index -> block read -> hash verify -> integrity report
- 화면 구성: verify action, error report, about/project docs link
- 테스트 방법: 손상 block fixture, permission error 가능한 범위의 integration test, 전체 smoke test
- 완료 기준: README만 보고 설치/실행/테스트가 가능하고 주요 기능이 검증됨
- 다음 조건: v0.1.0 release tag 생성 가능

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
  README.md
  development-roadmap.md
  development-guide.md
  development-log.md
  implemented/
    block-engine.md
    snapshot-engine.md
    restore-engine.md
    visualization.md
  specs/
    0001-storage-format.md
    0002-snapshot-format.md
  plans/
    phase-1-block-engine.md
    phase-2-snapshot-engine.md
  archive/
```

### 역할

- `README.md`: 프로젝트 소개, 빠른 실행, 데모 이미지
- `README.ko.md`: 한국어 소개
- `CONTRIBUTING.md`: 외부 기여 방법
- `AGENTS.md`: AI coding agent 작업 규칙
- `docs/development-roadmap.md`: phase와 milestone
- `docs/development-guide.md`: 작업 전 확인, 테스트, Git 규칙
- `docs/development-log.md`: 날짜별 작업 기록
- `docs/implemented/`: 큰 기능 완료 후 구현 기록
- `docs/specs/`: 설계 결정과 데이터 포맷
- `docs/plans/`: 실제 작업 체크리스트
- `docs/archive/`: 완료되었거나 폐기된 오래된 계획

## 17. Development Guide 규칙

작업 전 확인 순서:

1. `git status`로 작업트리 확인
2. 관련 issue 확인
3. 관련 spec과 plan 확인
4. 최근 development log 확인
5. 새 브랜치 생성

문서 수정 규칙:

- 데이터 포맷이 바뀌면 specs 갱신
- 큰 기능이 완료되면 implemented 문서 작성
- phase가 끝나면 development log 갱신
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
- Spec은 설계 결정이므로 오래 유지한다.
- Plan은 실행 체크리스트이므로 완료 후 `docs/archive/plans/`로 이동할 수 있다.
- 구현이 끝난 큰 기능은 `docs/implemented/`에 결과 중심 문서를 남긴다.

권장 흐름:

```text
docs/specs/0001-storage-format.md
docs/plans/phase-1-block-engine.md
implementation
docs/implemented/block-engine.md
docs/archive/plans/phase-1-block-engine.md
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

## 23. 확장 기능

- SQLite metadata backend
- compression
- encryption
- content-defined chunking
- snapshot delete and garbage collection
- automatic scheduled snapshots
- file watch mode
- cloud block storage adapter
- repository migration tool
- macOS app signing and packaging
- advanced block graph visualization
- restore preview

## 24. 4~6주 일정 요약

| 주차 | 목표 | 산출물 |
| --- | --- | --- |
| 1주차 | 앱 부트스트랩, 저장소 포맷, block engine | 실행 앱, block tests, storage spec |
| 2주차 | snapshot 생성/조회 | snapshot list/detail, snapshot spec |
| 3주차 | restore/diff | 복원 기능, 비교 화면, integration test |
| 4주차 | dashboard/visualization | 저장량 그래프, block map, file inspector |
| 5주차 | integrity/error/docs | 검증 기능, 문서, implemented 기록 |
| 6주차 | polish/release buffer | v0.1.0 tag, demo screenshots, known limitations |

## 25. 최종 MVP 완료 기준

- 사용자가 저장소를 만들고 폴더를 선택해 snapshot을 생성할 수 있다.
- 동일 데이터 블록이 중복 저장되지 않는다.
- snapshot 목록과 상세 통계를 볼 수 있다.
- 두 snapshot 사이의 added/modified/deleted 파일을 확인할 수 있다.
- 선택 snapshot을 새 target folder에 복원할 수 있다.
- 복원 파일 내용이 원본 snapshot과 byte-level로 일치한다.
- 저장 공간 절약량과 블록 재사용률을 dashboard에서 확인할 수 있다.
- 파일 단위 block map으로 블록 구성과 재사용을 확인할 수 있다.
- block integrity 검증을 실행할 수 있다.
- README와 docs만 보고 개발자가 빌드, 테스트, 구조 이해를 할 수 있다.
