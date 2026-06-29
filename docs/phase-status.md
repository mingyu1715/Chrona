# Chrona 단계 및 문서 상태

## 목적

이 문서는 현재 Chrona에서 무엇이 구현됐고, 무엇이 다음 작업이며, 무엇이 아직 세부 구현 계획도 없는지 확인하기 위한 기준 문서다.

문서 위치 기준:

- `docs/specs/`: 아직 구현하지 않았거나 다음에 구현할 설계 문서
- `docs/archive/specs/`: 구현 완료 후 보관된 설계 문서
- `docs/plans/`: 현재 진행 중이거나 다음에 구현할 작업 체크리스트
- `docs/archive/plans/`: 완료된 구현 계획 보관 위치
- `docs/implemented/`: 완료된 기능의 구현 기록
- `docs/project-plan.md`: 장기 프로젝트 방향

현재 `docs/specs/`와 `docs/plans/`에는 활성 설계/계획이 없다.

## 현재 구현 상태

| 영역 | 상태 | 설계 문서 | 계획 문서 | 구현 기록 | 비고 |
| --- | --- | --- | --- | --- | --- |
| 프로젝트 초기 구조, 저장소 문서, 라이선스, CLA | 구현 완료 | 없음 | 없음 | `docs/implemented/phase-1-summary.md` | 프로젝트 초기 설정은 Phase 1 요약 문서에 함께 기록함. |
| 저장소 포맷 | 구현 완료 | `docs/archive/specs/0001-repository-format.md` | `docs/archive/plans/phase-1-block-engine.md` | `docs/implemented/block-engine.md` | `manifest.json`, `blocks/`, `indexes/`, `logs/`와 스냅샷 저장 구조 호환성 포함. |
| 블록 엔진 | 구현 완료 | `docs/archive/specs/0002-block-engine.md` | `docs/archive/plans/phase-1-block-engine.md` | `docs/implemented/block-engine.md` | 1 MiB 고정 블록 분할, SHA-256 식별, 중복 블록 재사용, `.tmp` 작성 후 이름 변경 저장. |
| 스냅샷 엔진 | 구현 완료 | `docs/archive/specs/0003-snapshot-format.md` | `docs/archive/plans/phase-2-snapshot-engine.md` | `docs/implemented/snapshot-engine.md` | 스냅샷 생성, 목록 조회, 상세 조회, 스냅샷 인덱스 구현 완료. |
| 스냅샷 비교 | 구현 완료 | `docs/archive/specs/0004-snapshot-comparison.md` | `docs/archive/plans/phase-3-snapshot-comparison.md` | `docs/implemented/snapshot-comparison.md` | 파일 단위 비교와 블록 참조 멀티셋 비교 구현 완료. |
| 스냅샷 복원 | 구현 완료 | `docs/archive/specs/0007-snapshot-restore.md` | `docs/archive/plans/phase-4-snapshot-restore.md` | `docs/implemented/snapshot-restore.md` | 비어 있거나 새 대상 폴더로 복원하는 MVP 구현 완료. |
| 홈/적응형 탐색 | 구현 완료 | `docs/archive/specs/0006-home-adaptive-navigation.md` | `docs/archive/plans/phase-next-home-adaptive-navigation.md` | `docs/implemented/home-adaptive-navigation.md` | 접근 기록은 저장소 내부 메타데이터로 관리하며 실제 파일 시스템 트리 정렬은 바꾸지 않음. |
| 무결성 검증 | 구현 완료, 원격 기능 브랜치 푸시 완료 | `docs/archive/specs/0008-integrity-verification.md` | `docs/archive/plans/phase-5-integrity-verification.md` | `docs/implemented/integrity-verification.md` | 누락 블록, 손상 블록, SHA-256 불일치를 읽기 전용으로 검증함. |
| 저장소 인벤토리 탐색 | 구현 완료 | `docs/archive/specs/0009-repository-inventory-explorer.md` | `docs/archive/plans/phase-5-repository-inventory-explorer.md` | `docs/implemented/repository-inventory-explorer.md` | 기록된 파일, 파일 종류, 최신 스냅샷 존재/삭제 상태, 현재 원본 파일 존재 여부, 검색/필터 UI 구현 완료. |
| 블록 압축 | 구현 완료 | `docs/archive/specs/0005-block-compression.md` | `docs/archive/plans/phase-6-block-compression.md` | `docs/implemented/block-compression.md` | raw/off, Zstd 표준, LZ4 빠른 모드, 3% raw fallback, schema 1 legacy raw 호환 구현 완료. |

## 현재 `docs/specs/`에 남은 설계 문서

현재 없음.

## 보관된 완료 설계 문서

| 설계 문서 | 상태 | 구현 상태 | 계획 상태 |
| --- | --- | --- | --- |
| `docs/archive/specs/0001-repository-format.md` | 구현 완료 | 현재 원본 블록 저장소 포맷 기준 완료 | Phase 1 계획 보관 완료 |
| `docs/archive/specs/0002-block-engine.md` | 구현 완료 | 원본 고정 크기 블록 엔진 완료 | Phase 1 계획 보관 완료 |
| `docs/archive/specs/0003-snapshot-format.md` | 구현 완료 | 스냅샷 생성, 목록 조회, 상세 조회 완료 | Phase 2 계획 보관 완료 |
| `docs/archive/specs/0004-snapshot-comparison.md` | 구현 완료 | 메타데이터 기반 비교 완료 | Phase 3 계획 보관 완료 |
| `docs/archive/specs/0005-block-compression.md` | 구현 완료 | schema 2 envelope와 legacy raw 호환 완료 | Phase 6 계획 보관 완료 |
| `docs/archive/specs/0006-home-adaptive-navigation.md` | 구현 완료 | 홈/적응형 접근 MVP 완료 | 홈/적응형 탐색 계획 보관 완료 |
| `docs/archive/specs/0007-snapshot-restore.md` | 구현 완료 | 빈 대상 폴더 복원 MVP 완료 | Phase 4 계획 보관 완료 |
| `docs/archive/specs/0008-integrity-verification.md` | 구현 완료 | 원격 기능 브랜치 푸시 완료 | Phase 5 무결성 검증 계획 보관 완료 |
| `docs/archive/specs/0009-repository-inventory-explorer.md` | 구현 완료 | 메타데이터 기반 저장소 탐색과 UI 완료 | Phase 5 인벤토리 계획 보관 완료 |

## 현재 진행 계획

현재 활성 구현 계획은 없다.

## 설계 문서는 있지만 구현 계획은 없는 작업

현재 없음.

## 설계와 세부 구현 계획이 모두 없는 작업

아래 항목은 방향성은 있지만 아직 구체적인 설계 문서나 구현 계획이 없다.

| 영역 | 현재 상세 수준 | 다음 문서 후보 |
| --- | --- | --- |
| 통계 대시보드 | `project-plan`에만 언급됨 | `docs/specs/0010-repository-statistics-dashboard.md` |
| 파일 검사기 / 파일 블록 지도 | `project-plan`에만 언급됨 | `docs/specs/0011-file-inspector-block-map.md` |
| 패키징된 `.app` 릴리스 / 서명 | 릴리스 준비 후보로만 언급됨 | `docs/plans/phase-release-packaging.md` |
| 스냅샷 삭제 / 블록 정리 | 향후 작업 | `docs/specs/00xx-snapshot-delete-gc.md` |
| 파일 감시 / 자동 스냅샷 | 향후 작업 | `docs/specs/00xx-watched-sources.md` |
| SQLite 메타데이터 백엔드 | 향후 작업 | `docs/specs/00xx-sqlite-metadata.md` |
| 암호화 | 향후 작업 | `docs/specs/00xx-encryption.md` |
| 내용 기반 블록 분할 | 향후 작업 | `docs/specs/00xx-content-defined-chunking.md` |
| 클라우드 블록 저장 어댑터 | 향후 작업 | `docs/specs/00xx-cloud-storage-adapter.md` |
| 저장소 마이그레이션 도구 | 향후 작업 | `docs/specs/00xx-repository-migration.md` |

## 재정리된 단계 로드맵

### 완료된 기반 작업

- Phase 0/1: 초기 구조, 문서, 저장소 포맷, 블록 엔진
- Phase 2: 스냅샷 엔진
- Phase 3: 스냅샷 비교
- Phase 4: 스냅샷 복원
- 별도 작업: 홈/적응형 탐색
- Phase 5a: 무결성 검증
- Phase 5b: 저장소 인벤토리 탐색
- Phase 6: 블록 압축

### 현재 다음 작업

- 파일 검사기 / 블록 지도 상세화
  - 인벤토리 파일 선택
  - snapshot별 block reference sequence
  - 파일 변경 이력
  - 저장 block encoding과 크기 정보

### 다음 계획 후보

파일 검사기 / 블록 지도 이후 아래 중 하나를 선택한다.

1. 저장소 통계 대시보드
2. 릴리스 패키징 및 기본 실행 테스트 강화
3. 스냅샷 삭제 / 블록 정리

### 향후 작업

- 스냅샷 삭제 / 블록 정리
- 파일 감시 / 자동 스냅샷
- SQLite 전환
- 암호화
- 내용 기반 블록 분할
- 클라우드 어댑터

## 즉시 다음 작업

1. 현재 압축 브랜치를 최종 검증하고 커밋·푸시한다.
2. 파일 검사기 / 블록 지도의 현재 Phase spec과 plan을 작성한다.
3. 별도 기능 브랜치에서 테스트 우선으로 구현한다.
4. 핵심 기능 완료 뒤 전체 UI 사용성 개선 Phase를 진행한다.
