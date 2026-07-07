# 저장소 통계 대시보드 구현 기록

## 상태

- Phase 8 구현 완료
- 저장소 포맷 변경 없음
- 별도 통계 index/cache 없음

## 구현 범위

- Home의 최신 Snapshot 기반 compact repository overview
- 전체 Snapshot과 physical `.blk`를 읽는 on-demand 상세 분석
- 전체/참조/미참조 physical block count와 byte 분리
- 중복 제거 절감량과 압축 절감량 분리
- referenced raw/Zstd/LZ4 encoding 분포
- oldest-first Snapshot 변화 추이
- 상세 분석 progress event
- 누락, 읽기 실패, invalid header/filename, raw size 충돌의 부분 issue

## Home Fast Path

Home은 최신 Snapshot JSON 하나만 읽고 다음 값을 표시한다.

- 파일 수
- 전체 원본 크기
- 고유 block 수
- 파일 종류별 개수

Home에서는 repository 전체 block scan을 실행하지 않는다. 실제 physical 저장량과 절감량은 상세 Statistics 화면에서만 계산한다.

## 상세 계산

정의:

- `retainedLogicalBytes`: 모든 Snapshot 파일 크기 합계
- `referencedUniqueRawBytes`: Snapshot이 참조하는 unique hash별 raw size 합계
- `dedupSavedBytes = retainedLogicalBytes - referencedUniqueRawBytes`
- `allPhysicalBytes`: `blocks/` 아래 최종 `.blk` 파일 크기 합계
- `referencedPhysicalBytes`: referenced hash의 canonical `.blk` 크기 합계
- `unreferencedBytes`: Snapshot에서 참조하지 않는 최종 `.blk` 크기 합계
- `compressionSavedBytes = compressionComparedRawBytes - compressionComparedPhysicalBytes`

Dedup과 compression은 서로 다른 저장 단계의 효과이므로 하나의 수치로 합치지 않는다. 누락 referenced block이 있으면 실제 저장량이 작아 보일 수 있어 전체 storage reduction 비율을 제공하지 않는다.

## Physical Block Scan

- `.blk` 확장자의 최종 파일만 집계한다.
- `.tmp-*` 파일은 제외한다.
- referenced block encoding은 `BlockStore::inspect_block`을 재사용한다.
- 정상 compressed block은 payload 전체를 decode하지 않고 header를 검사한다.
- 미참조 block은 expected raw size가 없으므로 encoding 분포에는 포함하지 않는다.
- 개별 block metadata를 읽지 못해도 issue를 남기고 나머지 scan을 계속한다.

## UI와 비동기 처리

- 상세 command는 `spawn_blocking`에서 filesystem scan을 실행한다.
- `repository-statistics-progress` event가 `snapshots`, `blocks`, `completed` phase를 전달한다.
- Statistics chapter는 사용자가 `Analyze repository`를 실행할 때만 scan한다.
- 새 repository를 열면 이전 repository의 overview, report, progress, error를 모두 초기화한다.
- Dashboard는 CSS bar와 semantic 목록을 사용하며 chart library를 추가하지 않았다.

## 제한 사항

- 미참조 block은 표시만 하며 삭제하지 않는다.
- historical physical disk usage를 역산하지 않는다.
- 자동 scan, 통계 cache, Snapshot 삭제, garbage collection은 포함하지 않는다.
- 파일별 압축률 순위와 payload preview는 포함하지 않는다.

## 검증

- Rust: overview, logical/dedup, raw/Zstd/LZ4, 미참조, 누락, invalid filename, raw size 충돌, unreadable metadata, progress, command serialization
- UI: Home overview, independent error state, detailed report, progress, repository scope reset, trend/encoding/issues
- 최종 전체 검증 수치는 `docs/development-log.md`의 2026-07-07 Phase 8 항목에 기록한다.
