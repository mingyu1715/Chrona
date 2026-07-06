# 0010 Repository Statistics Dashboard

## 상태

- Phase 8 설계 승인: 2026-07-06
- 구현 전
- 기준 브랜치: `feature/file-inspector-block-map`

## 목표

사용자가 Home에서 현재 저장소의 파일 구성과 대략적인 데이터·block 규모를 즉시 파악하고, 별도 Statistics 화면에서 전체 snapshot 이력에 대한 중복 제거·압축·physical block 사용량을 정확히 분석할 수 있게 한다.

Home 진입 때문에 repository 전체를 scan하지 않는다. 비용이 큰 계산은 사용자가 Statistics 상세 화면을 열거나 새로 고칠 때만 수행한다.

## 사용자 흐름

```text
Home
  -> 최신 Snapshot 기준 파일 수 / 데이터 크기 / 고유 block 수 / 파일 종류 확인
  -> 상세 분석 선택
Statistics
  -> 전체 Snapshot과 physical block scan 진행 상태 확인
  -> 전체 이력 논리량 / 고유 원본 block / 실제 저장량 확인
  -> 중복 제거 절감량과 압축 절감량을 분리 확인
  -> 참조 / 미참조 / 누락 block 상태 확인
  -> snapshot별 변화 추이와 encoding 분포 확인
```

## 범위

### 구현 대상

- Home의 lightweight repository overview
- 별도 Statistics sidebar chapter
- 전체 snapshot metadata 집계
- 실제 `blocks/` 디렉터리의 최종 `.blk` 파일 scan
- 참조 physical block과 미참조 physical block 분리
- 누락·읽기 실패·잘못된 header를 포함하는 부분 보고
- raw/Zstd/LZ4 referenced block 분포
- snapshot별 file/byte/block 변화 추이
- 상세 분석 progress event
- Rust, Tauri, TypeScript, React 테스트

### 구현 제외

- 통계 index 또는 SQLite cache
- 미참조 block 삭제와 garbage collection
- snapshot 삭제
- 자동 주기 scan
- 파일별 압축률 순위
- payload 전체 decode를 이용한 통계
- chart library 도입
- 전체 UI 재설계

## 화면 설계

### Home 저장소 요약

기존 Home의 `Continue working` 흐름을 유지하고 compact overview를 추가한다. 최신 Snapshot JSON 하나만 읽어 다음을 표시한다.

- 최신 Snapshot 파일 수
- 최신 Snapshot 전체 원본 크기
- 최신 Snapshot이 참조하는 고유 block 수
- 최신 Snapshot의 파일 종류별 개수
- `상세 분석` 이동 command

Home에는 실제 physical 저장량, 중복 제거 절감량, 압축 절감량, 미참조 block을 표시하지 않는다. 이 값들은 전체 scan 없이는 정확하지 않기 때문이다.

### Statistics 상세 화면

기존 sidebar에 `Statistics` chapter를 추가한다. 화면은 다음 순서로 구성한다.

1. 전체 이력 논리량, 고유 원본 block 크기, 전체 physical 저장량, 계산 상태
2. 중복 제거 절감량과 압축 절감량
3. 참조 physical block, 미참조 physical block, 누락/잘못된 block
4. snapshot 변화 추이
5. referenced block의 raw/Zstd/LZ4 분포

그래프는 현재 UI 체계에 맞는 CSS bar와 목록을 사용한다. 색만으로 상태를 구분하지 않고 label과 수치를 함께 표시한다.

## 통계 정의

### Home overview

| 필드 | 정의 |
| --- | --- |
| `latestFileCount` | 최신 Snapshot의 `files.len()` |
| `latestLogicalBytes` | 최신 Snapshot의 모든 `file.sizeBytes` 합계 |
| `latestUniqueBlockCount` | 최신 Snapshot의 unique block hash 개수 |
| `fileKindStats` | 최신 Snapshot 파일을 기존 FileKind 규칙으로 분류한 개수와 byte 합계 |

Snapshot이 없으면 오류 대신 `hasSnapshot = false`인 empty overview를 반환한다.

### 상세 repository 통계

| 필드 | 정의 |
| --- | --- |
| `snapshotCount` | snapshot index에 기록된 snapshot 수 |
| `retainedLogicalBytes` | 모든 snapshot의 모든 `file.sizeBytes` 합계. 시점별 보관 데이터를 중복 포함한다. |
| `totalBlockReferences` | 모든 snapshot의 block reference 개수 |
| `referencedUniqueBlockCount` | 모든 snapshot이 참조하는 unique block hash 수 |
| `referencedUniqueRawBytes` | unique referenced hash별 raw size 합계 |
| `dedupSavedBytes` | `retainedLogicalBytes - referencedUniqueRawBytes`, 최소 0 |
| `referencedPhysicalBlockCount` | 실제 파일이 존재하는 referenced unique block 수 |
| `referencedPhysicalBytes` | 존재하는 referenced `.blk` 파일의 physical file size 합계 |
| `allPhysicalBlockCount` | `blocks/` 아래의 최종 `.blk` 파일 수 |
| `allPhysicalBytes` | `blocks/` 아래의 최종 `.blk` physical file size 합계 |
| `unreferencedBlockCount` | snapshot에서 참조하지 않는 최종 `.blk` 파일 수 |
| `unreferencedBytes` | 미참조 `.blk` physical file size 합계 |
| `missingReferencedBlockCount` | snapshot에서는 참조하지만 physical 파일이 없는 unique block 수 |
| `invalidReferencedBlockCount` | 읽기 실패 또는 잘못된 envelope/header인 referenced block 수 |
| `compressionComparedRawBytes` | physical 검사가 가능한 referenced block의 raw size 합계 |
| `compressionComparedPhysicalBytes` | raw size와 비교 가능한 referenced block의 physical size 합계 |
| `compressionSavedBytes` | `compressionComparedRawBytes - compressionComparedPhysicalBytes`, 최소 0 |

`dedupSavedBytes`와 `compressionSavedBytes`는 서로 다른 단계의 절감량이므로 합쳐서 하나의 수치처럼 표시하지 않는다.

전체 효율 비율은 누락 referenced block이 없고 `retainedLogicalBytes > 0`일 때 `retainedLogicalBytes` 대비 `allPhysicalBytes` 감소 비율로 계산한다. 실제 저장량이 더 크면 0%로 제한한다. 누락 block이 있으면 실제 저장량이 작아 보이는 왜곡을 막기 위해 `storageEfficiencyPercent = null`로 반환하고 경고를 표시한다.

### Physical block 규칙

- `blocks/` 아래에서 `.blk` 확장자를 가진 최종 파일만 실제 저장량에 포함한다.
- `.tmp-*` 파일과 디렉터리는 제외한다.
- 파일명에서 유효한 SHA-256 hash를 얻을 수 없는 `.blk`는 전체 physical byte에는 포함하고 issue로 기록한다.
- referenced block encoding은 기존 `BlockStore::inspect_block`을 재사용한다.
- 정상 compressed block은 header만 검사하고 payload 전체를 decode하지 않는다.
- 미참조 block은 expected raw size가 없으므로 encoding 통계에는 넣지 않는다.

동일 hash가 snapshot metadata에서 서로 다른 raw size로 나타나면 metadata issue를 기록하고 최초 size를 기준으로 집계한다. 보고서 전체는 유지한다.

### Snapshot trend

각 snapshot마다 다음 값을 생성 시각 오름차순으로 반환한다.

- snapshot id, name, createdAt
- file count
- logical bytes
- total block references
- unique block count within snapshot
- new block count
- reused block count
- new logical bytes
- new stored bytes
- compression saved bytes

기존 schema에서 값이 없는 compression 관련 필드는 현재 serde 기본값 0을 유지한다. 실제 historical physical size를 역산했다고 표현하지 않는다.

## Architecture

### Rust models

`src-tauri/src/models/statistics.rs`

- `RepositoryStatisticsOverview`
- `RepositoryStatisticsReport`
- `RepositoryStorageSummary`
- `SnapshotStatisticsPoint`
- `EncodingStatistics`
- `StatisticsIssue`
- `RepositoryStatisticsProgress`

### Rust core

`src-tauri/src/core/statistics_service.rs`

- `get_overview`: 최신 Snapshot만 읽는 lightweight path
- `analyze_repository`: 전체 snapshot과 physical block을 읽는 detailed path
- snapshot reference aggregation
- physical block enumeration
- dedup/compression metric calculation
- progress callback 호출

파일 종류 판정은 Inventory와 Statistics가 같은 결과를 내도록 기존 `inventory_service::classify_file_kind`를 재사용한다.

### Tauri commands

`src-tauri/src/commands/statistics_commands.rs`

```rust
get_repository_statistics_overview(repository_path) -> RepositoryStatisticsOverview
analyze_repository_statistics(repository_path) -> RepositoryStatisticsReport
```

상세 분석은 blocking filesystem scan이 UI event loop를 막지 않도록 async command에서 blocking task로 실행한다.

Progress event:

```text
repository-statistics-progress
```

phase 값:

- `snapshots`
- `blocks`
- `completed`

### React

- `src/features/statistics/RepositoryOverview.tsx`
- `src/features/statistics/StatisticsDashboard.tsx`
- `src/features/statistics/*.test.tsx`
- `RepositoryPage`는 overview/report/progress state와 chapter 이동만 조율한다.
- Home overview 실패는 기존 Home access history를 숨기지 않는다.
- 상세 분석 실패는 Statistics panel 안에서 표시한다.

## 데이터 흐름

### Home

```text
repository path
  -> repository 검증
  -> latest snapshot 1개 read
  -> file kind / byte / unique hash 집계
  -> RepositoryStatisticsOverview
  -> Home compact overview
```

### Statistics

```text
repository path
  -> repository 검증
  -> snapshot index와 snapshot JSON 전체 read
  -> logical/reference/unique hash/trend 집계
  -> progress: snapshots
  -> blocks/ 아래 final .blk scan
  -> referenced/unreferenced/physical bytes 분리
  -> referenced block header inspection
  -> progress: blocks
  -> dedup/compression/issue 계산
  -> RepositoryStatisticsReport
  -> progress: completed
  -> Statistics dashboard
```

## 오류와 부분 결과

다음 오류는 command 실패로 처리한다.

- repository를 열거나 검증할 수 없음
- snapshot index 또는 snapshot JSON을 읽을 수 없음
- `blocks/` root 자체를 열 수 없음
- background task join 실패

다음은 report issue로 남기고 가능한 통계를 반환한다.

- referenced block 누락
- 개별 block metadata read 실패
- invalid compressed header
- hash 형식이 아닌 `.blk` 파일명
- 같은 hash에 충돌하는 raw size metadata

## 테스트

### Rust unit/integration

- snapshot이 없는 overview는 empty 상태다.
- overview는 최신 Snapshot만 반영한다.
- file kind 분류는 Inventory와 동일하다.
- 전체 이력 논리량과 unique raw byte가 정확하다.
- 같은 block의 snapshot 간 재사용이 dedup 절감량에 반영된다.
- raw/Zstd/LZ4 referenced block의 physical byte와 encoding 분포가 정확하다.
- 미참조 `.blk`가 count/byte에 포함된다.
- `.tmp-*` 파일은 제외된다.
- referenced block 누락 시 효율 비율이 `null`이고 report는 유지된다.
- invalid header와 invalid filename이 issue로 남는다.
- snapshot trend가 생성 시각 오름차순이다.
- progress phase가 `snapshots -> blocks -> completed` 순서로 관찰된다.
- command 결과가 camelCase로 serialize된다.

### UI

- Home overview가 파일 수, 크기, 고유 block, file kind를 표시한다.
- Snapshot이 없을 때 compact empty state를 표시한다.
- Home의 상세 분석 command가 Statistics chapter로 이동한다.
- 상세 report의 dedup과 compression 수치를 분리 표시한다.
- 참조/미참조/누락 block 수치를 표시한다.
- progress와 오류 상태를 표시한다.
- snapshot trend와 encoding 분포는 label이 포함된 semantic markup을 사용한다.

## 문서와 완료 기준

수정 대상:

- `README.md`, `README.ko.md`
- `docs/development-log.md`
- `docs/phase-status.md`
- `docs/project-plan.md`
- `docs/plans/README.md`
- `docs/implemented/repository-statistics-dashboard.md`

완료 시 이 spec과 Phase 8 plan을 archive한다.

완료 기준:

- Home이 전체 scan 없이 최신 저장소 규모와 파일 구성을 보여준다.
- 상세 Statistics가 전체/참조/미참조 physical 저장량을 구분한다.
- dedup과 compression 절감량이 정의대로 분리된다.
- 누락/invalid block이 전체 report를 막지 않는다.
- 상세 scan이 UI event loop를 막지 않고 progress를 전달한다.
- 기존 snapshot, inventory, integrity, compression, file inspector 테스트가 유지된다.
- `cargo test`, `npm test -- --run`, `npm run build`가 통과한다.
