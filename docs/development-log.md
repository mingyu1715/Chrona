# 개발 로그

## 2026-06-19

### 완료 사항

- Phase 1 Tauri/Rust/React 초기 구조를 생성했다.
- `manifest.json`, `blocks/`, `indexes/`, `logs/` 기반 저장소 생성/열기 기능을 구현했다.
- 원본 경로와 저장소 경로가 서로 포함되는 경우 작업을 막는 로직을 구현했다.
- 메타데이터 상대 경로를 항상 `/` 구분자로 정규화하도록 구현했다.
- 1 MiB 고정 크기 블록 분할, SHA-256 블록 식별, 블록 재사용, `.tmp` 작성 후 이름 변경 저장을 구현했다.
- 블록 저장 진행 상태 데이터와 Tauri 이벤트 발행을 추가했다.
- 진행률과 요약 결과를 보여주는 최소 저장소 저장 UI를 추가했다.
- Phase 1 설계 문서와 구현 기록을 추가했다.
- 새로 설치한 환경에서도 `npm run tauri dev`가 동작하도록 `@tauri-apps/cli`를 추가했다.
- README, README.ko, CONTRIBUTING, AGENTS, 비상업 라이선스 문서를 추가했다.
- 로컬/생성 산출물이 작업 트리에 남지 않도록 정리했다.
- Phase 1 요약 문서와 Phase 2 스냅샷 계획 문서를 추가했다.

### 검증 결과

- `cargo test`: Phase 1 통합 테스트 10개 통과.
- `npm test`: RepositoryPage 테스트 1개 통과.
- `npm run build`: TypeScript 및 Vite 프로덕션 빌드 통과.
- `npm run tauri dev`: Vite 시작 및 macOS Tauri 앱 프로세스 실행 확인.

### 결정 사항

- MVP 블록 크기는 1 MiB로 고정한다.
- MVP 블록 식별자는 SHA-256 hex를 사용한다.
- MVP 메타데이터 경로는 UTF-8과 `/` 구분자를 요구한다.
- 스냅샷 JSON은 Phase 2 작업으로 분리한다.
- Chrona는 현재 PolyForm Noncommercial License 1.0.0 기반 비상업 라이선스로 둔다.

### 다음 작업

- `docs/archive/plans/phase-2-snapshot-engine.md`에 정리된 Phase 2 스냅샷 엔진을 구현한다.
- Phase 2는 `BlockIngestSummary`와 `FileIngestResult` 위에 스냅샷 메타데이터를 쌓는다.

## 2026-06-22

### 완료 사항

- Phase 1 블록 엔진 위에 Phase 2 스냅샷 메타데이터 저장 기능을 구현했다.
- `snapshots/` 저장소 구조와 `indexes/snapshot-index.json`을 추가했다.
- 스냅샷 JSON 모델, 최신순 스냅샷 인덱스, 스냅샷 메타데이터 `.tmp` 작성 후 이름 변경 저장을 추가했다.
- `create_snapshot`, `list_snapshots`, `get_snapshot` Tauri 명령을 추가했다.
- 스냅샷 생성, 목록 조회, 상세 조회를 위한 최소 UI를 추가했다.
- 스냅샷 정렬, 상세 조회, 누락 스냅샷, 기존 저장소 열기 관련 Phase 2 안정성 테스트를 추가했다.
- 저장소/원본 경로 입력을 위한 Tauri 네이티브 파일/폴더 선택기를 추가했다.
- UI를 Docker Desktop을 참고한 데스크톱 작업 흐름으로 재구성했다. 번호 없는 좌측 구역 탐색, 사이드바 제품/상태 영역, 리소스 요약 줄, 펼침 작업 패널, 간결한 경로/상태 줄, 고정 진행률 바, 내장 스냅샷/결과 패널을 적용했다.
- Phase 2 상태와 구현 기록을 README에 반영했다.

### 검증 결과

- `cargo test`: Phase 1 테스트 11개와 Phase 2 스냅샷 테스트 6개 통과.
- `npm test`: UI 테스트 3개 통과.
- `npm run build`: TypeScript 및 Vite 프로덕션 빌드 통과.
- `npm run tauri dev`: Tauri dialog 플러그인 초기화와 `dialog:allow-open` 권한 확인.

### 결정 사항

- 스냅샷 파일은 JSON 메타데이터만 저장하고, 블록 데이터는 블록 엔진이 계속 소유한다.
- 스냅샷 ID는 경로 탈출을 막기 위해 ASCII 영문/숫자, `_`, `-`만 허용한다.
- 빈 스냅샷 이름은 `Untitled Snapshot`으로 정규화한다.
- 스냅샷 비교, 복원, 삭제, 블록 정리, 무결성 검증은 Phase 2 범위 밖으로 둔다.
- 저장소/원본 경로 선택은 Tauri dialog 플러그인을 사용하되 직접 경로 입력도 유지한다.
- 제품 UI 방향은 warm gray, deep teal, muted blue, 촘촘한 데스크톱 유틸리티 간격으로 잡는다.

### 다음 작업

- Phase 3은 스냅샷 비교와 변경/재사용 블록 시각화 방향으로 계획한다.

## 2026-06-23

### 시작한 작업

- 로컬 Tauri 실행 중 생긴 저장소 산출물을 작업 트리에서 정리했다.
- `src-tauri/` 아래에 실수로 생성된 로컬 Chrona 저장소를 ignore 규칙에 추가했다.
- Phase 3 범위를 스냅샷 비교 우선으로 잡았다. 복원은 별도 Phase로 미뤘다.
- `docs/archive/specs/0004-snapshot-comparison.md`와 `docs/archive/plans/phase-3-snapshot-comparison.md`를 추가했다.
- 독립적인 `DiffService::compare` 모델/테스트로 Phase 3 구현을 시작했다.
- 저장된 스냅샷을 비교하는 `compare_snapshots` 서비스와 Tauri 명령 등록을 추가했다.
- TypeScript 비교 결과 타입과 `chronaApi.compareSnapshots` 래퍼를 추가했다.
- 기준/대상 선택, 요약 지표, 파일 차이 행을 포함한 최소 스냅샷 비교 UI를 추가했다.

### 결정 사항

- Phase 3 비교는 파일 내용 중심으로 판단한다. 크기와 순서가 있는 블록 해시 목록이 수정/미수정 판단 기준이다.
- `modifiedAt`은 보이는 메타데이터로 남기지만, 단독으로 파일을 수정됨으로 판정하지 않는다.
- 블록 참조 변화량은 중복 블록 참조를 처리하기 위해 멀티셋 카운트를 사용한다.

### 완료 사항

- Rust core, Tauri 명령, TypeScript API, 최소 UI까지 Phase 3 스냅샷 비교를 완료했다.
- `docs/implemented/snapshot-comparison.md`를 추가했다.
- README와 README.ko의 상태, 핵심 알고리즘 설명에 스냅샷 비교를 반영했다.
- 완료된 Phase 1, Phase 2, Phase 3 실행 계획을 `docs/archive/plans/`로 이동했다.

### 검증 결과

- `cargo test`: Phase 1 테스트 11개, Phase 2 테스트 6개, Phase 3 차이 테스트 3개 통과.
- `npm test`: UI 테스트 파일 3개와 UI 테스트 5개 통과.
- `npm run build`: TypeScript 및 Vite 프로덕션 빌드 통과.

### 다음 작업

- 다음 Phase를 복원과 더 깊은 시각화 중에서 선택한다.

### 문서 업데이트

- 향후 블록 압축 설계 문서를 `docs/specs/0005-block-compression.md`에 추가했다.
- 압축 전 원본 바이트 기준으로 SHA-256을 계산해야 하며, 압축은 실제 블록 데이터 저장 방식에만 영향을 줘야 한다는 규칙을 기록했다.
- 향후 기본 후보로 `zstd` level 3과 원본 저장 대안 방향을 기록했다.

### 계획 업데이트

- 홈/적응형 빠른 접근을 위한 `docs/archive/specs/0006-home-adaptive-navigation.md`를 추가했다.
- 홈/적응형 탐색 계획을 작업 대기열에 올렸고, 이후 `docs/archive/plans/phase-next-home-adaptive-navigation.md`로 보관했다.
- 파일 시스템/원본 계층 구조는 안정적인 경로 보기로 유지하고, splay tree는 최근/반복 작업을 위한 적응형 접근 인덱스에만 사용한다는 제약을 기록했다.

### 복원 구현 업데이트

- 소스 관리가 오염되지 않도록 `test/` 아래 수동 테스트용 로컬 저장소를 ignore했다.
- `feature/restore-engine`에서 Phase 4 복원 작업을 시작했다.
- `docs/archive/specs/0007-snapshot-restore.md`, 보관된 Phase 4 복원 계획, `docs/implemented/snapshot-restore.md`를 추가했다.
- 저장된 블록 파일을 읽어 비어 있거나 새 대상 디렉터리로 스냅샷을 복원하도록 구현했다.
- 복원 대상 경로 포함 관계 검사와 메타데이터 상대 경로 안전 변환을 추가했다.
- 복원 파일도 `.tmp-{operationId}` 작성 후 이름 변경 방식으로 쓰도록 구현했다.
- `restore_snapshot` Tauri 명령, TypeScript API, 최소 스냅샷 상세 복원 UI를 추가했다.

### 복원 검증

- `cargo test --test phase4_restore`: 복원 통합 테스트 4개 통과.
- `npm test -- SnapshotPanel.test.tsx`: SnapshotPanel UI 테스트 2개 통과.
- `cargo test`: Phase 1-4 Rust 통합 테스트 24개와 lib/main/doc 테스트 대상 통과.
- `npm test`: UI 테스트 파일 3개와 UI 테스트 6개 통과.
- `npm run build`: TypeScript 및 Vite 프로덕션 빌드 통과.

### 기여 정책 업데이트

- 가벼운 Chrona Contributor License Agreement인 `CLA.md`를 추가했다.
- 기여 제출 자체를 CLA 동의로 취급하도록 `CONTRIBUTING.md`를 수정했다.
- 기여 권리의 관리자/저작권 보유자를 `mingyu1715`로 설정했다.
- 별도 CLA 댓글이나 체크박스 요구를 기본값에서 제거했다.

## 2026-06-25

### 문서 대기열 정리

- 완료된 Phase 4 스냅샷 복원 계획을 `docs/archive/plans/phase-4-snapshot-restore.md`로 보관했다.
- 홈/적응형 탐색 작업 대기열 이름을 `phase-next-home-adaptive-navigation.md`로 바꿔 기존 안정화 Phase 번호와 충돌하지 않게 했다. 해당 계획도 `docs/archive/plans/`로 보관했다.
- 진행 중인 계획과 보관된 계획 위치가 현재 저장소 상태와 맞도록 `docs/plans/README.md`와 `docs/project-plan.md`를 갱신했다.

## 2026-06-26

### 계획 업데이트

- 자동 변경 감지는 현재 홈/적응형 탐색 MVP가 아니라 향후 원본 감시 확장으로 기록했다.
- 향후 자동 스냅샷은 원본별 선택 활성화, 디바운스, 기존 스냅샷 생성 경로 재사용 방식으로 설계해야 한다고 문서화했다.
- 파일 감시 작업이 현재 빠른 접근 범위와 섞이지 않도록 진행 중인 홈 계획, 홈/적응형 탐색 설계 문서, 프로젝트 향후 작업 목록을 수정했다.
- 향후 압축 방향을 단순 모드로 정리했다. `standard`는 `zstd` level 3, `fast`는 `lz4`, `off`는 원본 블록이다.

### 홈/적응형 탐색 구현

- `AccessIndex`, `AccessStore`, `HomeService`, Home Tauri 명령으로 저장소 내부 적응형 접근 이력을 구현했다.
- `indexes/access-index.json` 저장을 `.tmp` 작성 후 이름 변경 방식으로 추가했다.
- TypeScript 접근/Home 타입과 `chronaApi` 래퍼를 추가했다.
- Continue Working, 고정 항목, 최근 저장소/원본/스냅샷/비교 쌍, 고정/고정 해제, 새로고침, 이력 지우기 동작을 포함한 Home 작업 화면 UI를 추가했다.
- 저장소 열기/생성, 원본 저장, 스냅샷 생성/열기, 스냅샷 비교에서 접근 이벤트를 기록하도록 했다.
- `docs/implemented/home-adaptive-navigation.md`를 추가하고 완료된 홈/적응형 탐색 계획을 보관했다.

### 홈 검증

- `cargo test`: Phase 1-4 Rust 통합 테스트와 홈/접근 테스트 6개를 포함해 총 30개 통과.
- `npm test`: UI 테스트 파일 3개와 UI 테스트 7개 통과.
- `npm run build`: TypeScript 및 Vite 프로덕션 빌드 통과.

### Phase 5 무결성 검증 시작

- `feature/integrity-verification`에서 Phase 5 안정화 작업을 시작했다.
- `docs/archive/specs/0008-integrity-verification.md`와 현재 계획 `docs/plans/phase-5-integrity-verification.md`를 추가했다.
- 첫 Phase 5 구현 범위를 읽기 전용 저장소 무결성 검증으로 제한했다. 검증 대상은 스냅샷 블록 참조, 누락 블록, 블록 크기 불일치, 원본 SHA-256 불일치다.

### Phase 5 무결성 검증 구현

- `IntegrityService` 기반 읽기 전용 저장소 무결성 검증을 추가했다.
- 상태, 확인한 항목 수, 누락/손상 블록 수, 문제 항목을 담는 무결성 보고서 모델을 추가했다.
- 참조된 블록 파일 누락, 블록 크기 불일치, 기대 블록 크기 충돌, 잘못된 블록 해시, 블록 읽기 실패, 원본 SHA-256 불일치 감지를 추가했다.
- `verify_repository` Tauri 명령, TypeScript API 래퍼, 공용 프론트엔드 타입을 추가했다.
- Verify Repository 동작과 보고서 표시를 포함한 Integrity 작업 구역을 추가했다.
- `docs/implemented/integrity-verification.md`를 추가하고 완료된 무결성 검증 계획을 보관했다.

### Phase 5 무결성 검증 결과

- `cargo test --test phase5_integrity`: 무결성 통합 테스트 3개 통과.
- `cargo test`: Phase 1-5/Home Rust 통합 테스트 33개와 lib/main/doc 테스트 대상 통과.
- `npm test`: UI 테스트 파일 3개와 UI 테스트 8개 통과.
- `npm run build`: TypeScript 및 Vite 프로덕션 빌드 통과.

### 저장소 인벤토리 탐색 계획

- 메타데이터만 읽는 저장소 내용 보기를 위한 `docs/specs/0009-repository-inventory-explorer.md`를 추가했다.
- 현재 계획 `docs/archive/plans/phase-5-repository-inventory-explorer.md`를 추가했다.
- 기능 범위를 기록된 파일, 파일 종류, 스냅샷 기준 존재/삭제 상태, 현재 원본 파일 존재 여부로 제한했다.
- 블록 압축은 `docs/specs/0005-block-compression.md` 아래 향후 작업으로 유지하고, 이번 작업 범위에서 제외한다고 정리했다.

### Phase 및 문서 상태 정리

- 구현 완료, 계획됨, 향후 작업, 세부 계획 없음 상태를 구분하는 기준 문서 `docs/phase-status.md`를 추가했다.
- 완료된 Phase, 진행 중인 Phase 5b 저장소 인벤토리 탐색, 향후 작업이 분리되도록 `docs/project-plan.md`를 재정리했다.
- `docs/plans/README.md`에 현재 계획, 보관된 완료 계획, 설계 문서는 있지만 구현 계획이 없는 항목, 상세 설계/계획이 없는 항목을 나눠 적었다.
- 구현 완료된 설계 문서가 향후 작업으로 오해되지 않도록 설계 문서 상태 머리말을 수정했다.
- 블록 압축은 현재 구현 계획이 없는 향후 설계로 유지했다.

## 2026-06-27

### 문서 언어 정리

- 사용자가 직접 확인하는 `docs/development-log.md`와 `docs/phase-status.md`의 상태/로그 설명을 한국어 중심으로 정리했다.
- `docs/plans/`와 `docs/specs/`는 구현용 설계 문서라 파일명과 기술 용어를 유지한다.
- 문서 변경 후 `git diff --check`로 마크다운 공백 오류가 없음을 확인했다.

### 설계 문서 보관 구조 정리

- 구현 완료된 설계 문서 `0001`, `0002`, `0003`, `0004`, `0006`, `0007`, `0008`을 `docs/archive/specs/`로 이동했다.
- 현재 `docs/specs/`에는 미구현 또는 다음 구현 대상인 `0005-block-compression.md`, `0009-repository-inventory-explorer.md`만 남겼다.
- 블록 압축은 설계만 있고 구현 계획이 없는 향후 작업으로 `docs/phase-status.md`, `docs/plans/README.md`, `docs/project-plan.md`에 명시했다.

## 2026-06-28

### 저장소 인벤토리 탐색 구현

- `feature/repository-inventory` 브랜치에서 저장소 인벤토리 기능을 구현했다.
- 모든 스냅샷 JSON을 relative path 기준으로 집계하는 `InventoryService`와 보고서 모델을 추가했다.
- 확장자 기반 파일 종류 분류와 최신 스냅샷 기준 존재/삭제 상태 계산을 추가했다.
- 폴더 source와 단일 파일 source 모두 현재 원본 존재 여부를 확인하도록 구현했다.
- 삭제된 파일의 최신 크기와 수정 시각은 남기지 않고 `null`로 반환하도록 했다.
- 경로 결합 전에 기존 metadata relative path 안전 검사 함수를 재사용하도록 했다.
- `get_repository_inventory` Tauri 명령과 TypeScript API를 추가했다.
- Explorer 화면에 요약, 파일 종류별 통계, 경로 검색, 종류/스냅샷/원본 상태 필터, 스크롤 가능한 파일 표를 추가했다.
- 블록 payload는 읽거나 수정하지 않으며 압축은 이번 구현 범위에 포함하지 않았다.

### 문서 정리

- `docs/implemented/repository-inventory-explorer.md`를 추가했다.
- 완료된 `0009` spec과 Phase 5b 계획을 각각 `docs/archive/specs/`, `docs/archive/plans/`로 이동했다.
- 현재 `docs/specs/`에는 구현 계획이 없는 블록 압축 설계만 남겼다.
- 활성 구현 계획은 없음으로 바꾸고 다음 작업은 별도 선택 후 상세화하도록 정리했다.

### 저장소 인벤토리 검증

- `cargo test --test phase5_inventory`: 인벤토리 통합 테스트 7개 통과.
- `cargo test`: 기존 기능과 인벤토리를 포함한 Rust 통합 테스트 40개 통과.
- `npm test`: UI 테스트 파일 3개, 테스트 10개 통과.
- `npm run build`: TypeScript 및 Vite 프로덕션 빌드 통과.
- `cargo fmt --all -- --check`, `git diff --check HEAD`: 포맷과 공백 검사 통과.

### Phase 6 블록 압축 시작

- 기능 구현을 우선하고 전체 UI 구조 개선은 핵심 기능 완료 뒤로 미루기로 했다.
- `feature/block-compression` 브랜치를 만들었다.
- `docs/specs/0005-block-compression.md`를 기준으로 `docs/plans/phase-6-block-compression.md`를 작성했다.
- 현재 범위는 raw/off, Zstd level 3 표준, LZ4 frame 빠른 모드, 3% raw fallback, legacy raw block 호환, 복원/무결성 decode 연결이다.
- 기존 raw block을 자동 재작성하거나 파일 형식별 codec을 자동 선택하는 기능은 제외했다.

## 2026-06-29

### Phase 6 블록 압축 구현

- 신규 저장소를 schema 2, block encoding version 2, `standard` 모드로 생성하도록 변경했다.
- 저장소별 압축 모드는 `off` raw, `standard` Zstd level 3, `fast` LZ4 frame으로 구현했다.
- 원본 블록의 SHA-256을 identity로 유지하고 중복 조회 뒤 신규 블록에만 압축을 적용했다.
- 압축 envelope 전체가 raw보다 최소 3% 작을 때만 압축본을 저장하고, 나머지는 raw로 저장하도록 했다.
- compressed envelope에 magic/version, codec, raw/payload 크기, raw SHA-256을 기록하고 최대 1 MiB로 제한해 decode하도록 구현했다.
- block 저장의 `.tmp` 작성, `sync_all`, rename 흐름을 압축 payload에도 그대로 적용했다.

### 호환성과 기능 연결

- schema 1 저장소와 기존 raw block을 migration 없이 읽고, compression mode를 바꿀 때 manifest만 schema 2로 갱신하도록 했다.
- `BlockStore`가 raw/Zstd/LZ4를 투명하게 decode해 복원과 무결성 검증이 같은 raw block 경로를 사용하도록 했다.
- `CHRBLK01`로 시작하는 정상 raw block은 전체 raw SHA-256을 먼저 확인해 envelope로 오인하지 않도록 회귀 테스트를 추가했다.
- ingest/snapshot summary에 logical new bytes, physical stored bytes, compression saved bytes, raw/Zstd/LZ4 신규 block 수를 추가했다.
- Repository 화면에 현재 압축 모드, 모드 변경 control, 압축 저장 결과 통계를 최소 범위로 연결했다.

### 문서 정리

- `docs/implemented/block-compression.md`에 구현 결과와 제한 사항을 기록했다.
- 완료된 `0005` spec과 Phase 6 계획을 각각 `docs/archive/specs/`, `docs/archive/plans/`로 이동했다.
- README, 단계 상태표, 프로젝트 계획, 계획 색인에서 압축을 구현 완료로 변경했다.
- 다음 기능 구현 대상을 File Inspector / Block Map 상세화로 정리했다.

### Phase 6 검증

- `cargo test`: 기존 기능과 압축 통합 테스트 17개를 포함해 Rust 테스트 57개 통과.
- `npm test -- --run`: UI 테스트 파일 3개, 테스트 11개 통과.
- `npm run build`: TypeScript 및 Vite 프로덕션 빌드 통과.
- `cargo fmt --all -- --check`, `git diff --check HEAD`: 포맷과 공백 검사 통과.

## 2026-06-30

### Phase 7 파일 검사기 / 블록 지도 설계

- `feature/file-inspector-block-map` 브랜치에서 다음 기능 작업을 시작했다.
- Explorer에서 파일을 선택하면 같은 화면에서 ordered block sequence와 snapshot별 변경 이력을 확인하는 흐름으로 정했다.
- 별도 chapter와 하단 drawer 대신 Explorer master-detail 구성을 사용한다.
- raw/Zstd/LZ4 encoding, logical/physical block 크기, history 내 block 재사용 횟수를 표시 범위에 포함했다.
- block payload 미리보기, 파일/스냅샷 수정·삭제, 고급 graph library, 전체 UI 재설계는 제외했다.
- 승인된 설계를 `docs/specs/0011-file-inspector-block-map.md`에 기록했다.
- physical block 검사, content-based history service, Tauri API, Inspector panel, Explorer 연동, 문서/검증 순서의 구현 계획을 `docs/plans/phase-7-file-inspector-block-map.md`에 작성했다.
- 각 기능은 실패 테스트 확인 후 최소 구현과 회귀 검증을 진행하도록 Task를 분리했다.

### Phase 7 파일 검사기 / 블록 지도 구현

- raw/Zstd/LZ4 block의 physical encoding과 저장 크기를 payload 전체 압축 해제 없이 확인하는 header 검사 경로를 추가했다.
- envelope magic으로 시작하는 기존 raw block은 streaming SHA-256으로 먼저 판별해 compressed block으로 오인하지 않도록 했다.
- 누락, 읽기 실패, 잘못된 header는 전체 파일 검사를 중단하지 않고 해당 block의 부분 상태로 반환하도록 했다.
- 같은 normalized relative path를 snapshot 순서대로 추적하고 ordered `(hash, size)` sequence를 비교해 `added`, `modified`, `unchanged`, `deleted` 이력을 계산했다.
- 삭제 뒤 다시 나타나는 파일은 `added`로 판정하며, 수정 시각만 바뀐 경우에는 내용 변경으로 판정하지 않는다.
- `inspect_repository_file` Tauri command와 TypeScript API를 추가했다.
- Explorer 파일 경로를 선택하면 같은 화면의 Inspector에서 snapshot 버전별 ordered block map과 변경 이력을 확인하도록 연결했다.
- 연속 선택 시 늦게 도착한 이전 요청이 최신 선택을 덮어쓰지 않도록 request id 보호를 추가했다.
- 검사 실패 시 인벤토리 목록은 유지하고 Inspector에만 오류를 표시한다.

### Phase 7 제한 사항과 문서 정리

- 파일 identity는 repository 전체의 normalized relative path 기준이므로 서로 다른 source root의 같은 relative path가 하나의 이력으로 집계될 수 있다.
- block payload 미리보기, 파일·snapshot 수정/삭제, 고급 graph 시각화와 전체 UI 재설계는 이번 범위에서 제외했다.
- `docs/implemented/file-inspector-block-map.md`에 구현 구조와 제한 사항을 기록했다.
- 완료된 `0011` spec과 Phase 7 계획을 각각 `docs/archive/specs/`, `docs/archive/plans/`로 이동했다.
- 다음 기능 후보를 Repository Statistics Dashboard로 정리했다.

## 2026-07-06

### Phase 7 최종 검증 및 마무리

- `cargo fmt --all -- --check`: Rust 포맷 검사 통과.
- `cargo test`: Phase 7 파일 검사기 테스트 8개를 포함해 Rust 테스트 65개 통과.
- `npm test -- --run`: UI 테스트 파일 4개, 테스트 17개 통과.
- `npm run build`: TypeScript 검사와 Vite 프로덕션 빌드 통과.
- 완료된 설계와 계획을 archive하고 README, 단계 상태표, 프로젝트 계획, 구현 기록을 현재 코드 상태에 맞게 갱신했다.

### Phase 8 저장소 통계 대시보드 설계

- `feature/repository-statistics-dashboard` 브랜치를 Phase 7 완료 커밋에서 분기했다.
- Home에는 최신 Snapshot 기준 파일 수, 데이터 크기, 고유 block 수, 파일 종류만 간략히 표시하기로 했다.
- 별도 Statistics 화면은 전체 snapshot과 physical block을 진입 시 실시간 scan하는 혼합형으로 정했다.
- 상세 화면에서 전체 physical 저장량과 snapshot 참조/미참조 block 용량을 함께 표시하기로 했다.
- 중복 제거 절감량과 압축 절감량은 서로 다른 단계의 지표로 분리한다.
- 통계 index/cache, garbage collection, 자동 scan, chart library와 전체 UI 재설계는 이번 범위에서 제외했다.
- 승인된 설계를 `docs/specs/0010-repository-statistics-dashboard.md`에 기록했다.
- overview, 상세 집계, Tauri API, Home 요약, Statistics 화면, 문서/검증 순서의 구현 계획을 `docs/plans/phase-8-repository-statistics-dashboard.md`에 작성했다.

### Phase 8 저장소 통계 대시보드 구현

- 최신 Snapshot 하나만 읽는 Home repository overview를 추가해 파일 수, 논리 용량, 고유 block 수, 파일 종류를 표시했다.
- 전체 Snapshot의 논리 보관량, block reference, unique raw block을 집계하는 `StatisticsService`를 구현했다.
- `blocks/` 아래 최종 `.blk`를 scan해 전체, 참조, 미참조, 누락 physical block count와 byte를 분리했다.
- dedup 절감량과 compression 절감량을 서로 다른 공식으로 계산하고 UI에서도 분리 표시했다.
- referenced raw/Zstd/LZ4 block 분포와 oldest-first Snapshot 변화 추이를 추가했다.
- 상세 분석을 blocking task에서 실행하고 `repository-statistics-progress` event를 전달하도록 했다.
- 누락, 읽기 실패, invalid header/filename, raw size 충돌은 전체 분석을 폐기하지 않고 issue로 반환한다.
- repository를 변경할 때 이전 overview, report, progress, error를 초기화해 다른 저장소 수치가 남지 않도록 했다.
- 미참조 block은 조회만 하며 삭제하지 않는다.

### Phase 8 문서 정리

- `docs/implemented/repository-statistics-dashboard.md`에 계산 공식, 데이터 흐름, 제한 사항을 기록했다.
- 완료된 `0010` spec과 Phase 8 계획을 각각 `docs/archive/specs/`, `docs/archive/plans/`로 이동했다.
- 다음 기능 후보를 전체 UI 사용성 개선 Phase로 정리했다.

### Phase 8 최종 검증

- `cargo fmt --all -- --check`: Rust 포맷 검사 통과.
- `cargo test`: Phase 8 Statistics 테스트 7개를 포함해 Rust 테스트 72개 통과.
- `npm test -- --run`: UI 테스트 파일 6개, 테스트 27개 통과.
- `npm run build`: TypeScript 검사와 Vite 프로덕션 빌드 통과.

## 2026-07-07

### 전체 UI 사용성 감사

- `feature/ui-usability-improvement` 브랜치를 `main`에서 분리했다.
- 실제 Chrona 컴포넌트와 현실적인 감사용 데이터를 사용해 저장소, 소스, 홈, 스냅샷, 탐색기, 파일 상세, 통계, 무결성 흐름을 캡처했다.
- 라이트/다크 데스크톱 화면과 390×844 모바일 화면을 함께 확인했다.
- 화면 11장과 단계별 UX·접근성 기록을 `docs/audits/ui-usability-2026-07/`에 저장했다.
- 데스크톱에서 반복되는 상태·경로 영역이 실제 작업 공간을 줄이고, 모바일에서는 사이드바 때문에 본문이 약 653px 아래에서 시작하는 문제를 확인했다.
- 감사용 진입점, mock 코드, 임시 스크립트와 로컬 서버는 검수 후 모두 제거했다.

### 현재 결정 대기

- 기능과 데이터 흐름은 유지한다.
- 공통 앱 셸과 모바일 탐색을 먼저 정리한 뒤 장별 화면을 옮기는 단계적 개선을 우선안으로 둔다.
- 구현 전 개선 방식과 범위를 승인받은 뒤 별도 spec과 Phase 9 구현 계획을 작성한다.

### Phase 9 UI 구조 설계 확정

- `Waiting`, `Available`, `Ready`, `Loaded` 탐색 배지를 제거하기로 했다.
- 라이트/다크 팔레트는 현재 방향을 유지한다.
- 하단 진행 표시는 실제 작업 중에만 나타나도록 변경한다.
- 새 저장소의 기본 위치는 macOS와 Windows의 플랫폼 앱 로컬 데이터 디렉터리로 정했다.
- 기본 위치 생성, 사용자 위치 생성, 기존 저장소 등록을 모두 지원하는 저장소 라이브러리 구조로 정했다.
- 마지막 활성 저장소는 다음 실행에서 자동으로 열고, 외장 저장소 연결이 끊겨도 등록은 유지한다.
- 상단 저장소 전환 바, 단순 사이드바, 독립 스크롤 본문, 조건부 작업 표시로 앱 셸을 재구성한다.
- `Sources`와 `Review` 장은 `새 백업` 흐름으로 통합하고, 무결성과 압축 설정은 설정 화면으로 이동한다.
- 확정된 화면 연결과 컴포넌트 구조를 `docs/specs/0012-ui-usability-improvement.md`에 기록했다.

### Phase 9 대상 플랫폼 정정

- Phase 9의 대상은 macOS와 Windows 데스크톱 앱으로 확정했다.
- 모바일·태블릿 전용 drawer와 화면 전환 구조는 구현 범위에서 제외했다.
- 반응형은 제거하지 않고 `960×640` 최소 창부터 1440px 이상 넓은 창까지 데스크톱 작업 영역이 깨지지 않는 방식으로 유지한다.
- 파일과 스냅샷 master-detail은 compact 창에서도 유지하고 비율과 여백만 조정한다.

### Phase 9 구현 계획 작성

- 승인된 `0012` 설계를 11개 독립 작업으로 나눈 `docs/plans/phase-9-ui-usability-improvement.md`를 작성했다.
- 저장소 registry/store, library service와 Tauri API, TypeScript 계약, 앱 셸, 저장소 시작 화면, 새 백업, Files, Snapshots, Statistics/Settings, legacy UI 제거, 최종 검증 순서로 정했다.
- 각 작업에 실패 테스트, 최소 구현 인터페이스, 검증 명령, 권장 커밋 단위를 기록했다.
- 모바일 UI는 계획에서 제외하고 macOS/Windows의 `960×640`, `1100×800`, `1440×900` 창 검증을 포함했다.
- Windows native 검증 환경을 사용할 수 없는 경우 검증 공백을 문서화하고 통과했다고 주장하지 않도록 했다.

### Phase 9 Task 1 저장소 Registry 완료

- `feature/phase-9-ui-implementation` 브랜치에서 앱 수준 저장소 등록 모델과 atomic JSON store를 구현했다.
- registry는 manifest의 `repository_id`를 단일 등록 키로 사용한다.
- 등록 목록은 앱 로컬 데이터 디렉터리의 `repository-registry.json`에 저장하고 `.tmp-{uuid}` 작성, `sync_all`, rename 순서를 사용한다.
- 중복 repository ID, 중복 canonical path, 존재하지 않는 활성 ID와 손상된 registry 상태를 거부한다.
- 등록, 활성 저장소 변경, 등록 해제, 경로 relink를 구현했다.
- 리뷰에서 발견된 load 무결성 검증과 stable ID 우선 오류 순서를 회귀 테스트와 함께 수정했다.
- Task 1 리뷰 승인을 완료하고 Task 2 저장소 library service 구현으로 진행한다.

### Phase 9 Task 1 검증

- `cargo test --test phase9_repository_registry`: 11개 통과.
- `cargo test`: 기존 기능과 Phase 9 Task 1을 포함한 Rust 통합 테스트 83개 통과.

### Phase 9 Task 2 저장소 Library 완료

- 플랫폼 앱 로컬 데이터 디렉터리 아래 `Repositories/`에 기본 저장소를 만드는 library service를 구현했다.
- 사용자 지정 부모 폴더에 새 저장소를 만들고 기존 저장소를 이동 없이 등록하도록 구현했다.
- 저장소 활성화, 연결 끊김 판정, 경로 relink, 실제 파일을 삭제하지 않는 등록 해제를 추가했다.
- Tauri command 7개와 `1180×800`, 최소 `960×640` native window 설정을 추가했다.
- 목록 조회가 저장소 레이아웃을 생성하는 리뷰 지적을 수정해 read-only `RepositoryManager::probe` 경로로 분리했다.
- Task 2 리뷰 승인을 완료하고 Task 3 TypeScript 계약으로 진행한다.

### Phase 9 Task 2 검증

- `cargo test --test phase9_repository_library`: 10개 통과.
- `cargo test`: Task 1~2와 기존 기능을 포함한 Rust 전체 테스트 통과.

### 프로젝트 보고서 자료 정리

- 실제 Rust 구현에서 보고서에 사용하기 좋은 핵심 코드를 `docs/report-key-code.md`에 정리했다.
- 스트리밍 블록 분할, SHA-256 중복 제거, atomic 저장, Zstd/LZ4 압축, 스냅샷, 멀티셋 비교, 복원, 무결성, 경로 안전성을 포함했다.
- 각 코드에 동작 설명, 알고리즘 효과, 복잡도, 보고서용 설명 문장과 추천 조합을 추가했다.

### Phase 9 Task 3~8 UI 구현

- 저장소 라이브러리 TypeScript API와 공용 테스트 mock을 추가했다.
- 5개 작업 공간 사이드바, 상단 저장소 전환 영역, 다크 모드, 실행 중에만 표시되는 하단 작업 표시줄을 구현했다.
- 기본 앱 데이터 위치 생성, 사용자 지정 위치 생성, 기존 저장소 등록, 전환, relink, 등록 해제 UI를 연결했다.
- Home 화면을 파일 수, 논리 용량, 고유 블록 수, 최근 백업과 최근 작업 중심으로 단순화했다.
- 새 백업 대화상자는 `createSnapshot`을 한 번만 호출하며 파일 처리 진행 상황을 앱 하단에 표시한다.
- Files 화면에 저장소 파일 목록, 검색·상태 필터, 독립 스크롤 목록·상세 패널을 구현했다.
- Snapshots 화면에 항상 유지되는 목록, 상세·비교 전환, 별도 복원 대화상자를 구현했다.
- 별도 장으로 표시하던 `Waiting`, `Available`, `Ready`, `Loaded` 상태 배지는 새 앱 셸에서 제거했다.

### Phase 9 Task 3~8 검증

- `npm test -- --run`: UI 테스트 47개 통과.
- `npm run build`: TypeScript 검사와 Vite 프로덕션 빌드 통과.
- `git diff --check`: 공백 오류 없음.
- Task 9 Statistics·Settings, Task 10 legacy UI 제거, Task 11 native 화면 검증은 다음 작업으로 남아 있다.

### Phase 9 Task 9~11 완료

- Statistics와 Settings를 독립 작업 공간으로 옮겼다.
- 레거시 chapter 기반 `RepositoryPage`와 테스트를 제거하고 공용 컴포넌트 스타일만 유지했다.
- 완료된 Phase 9 spec과 plan을 archive로 이동하고 구현 문서를 작성했다.
- `cargo test`: Rust 테스트 93개 통과.
- `npm test -- --run`: UI 테스트 34개 통과.
- `npm run build`, `git diff --check`: 통과.
- native macOS/Windows smoke test와 시각·키보드·zoom 검증은 이번 정적 검증에서 수행하지 않았다.

## 2026-07-08

### Phase 10 사용자 경험·다국어 기획

- 배포 준비 전에 사용자 경험과 세부 기능을 보완하는 Phase 10을 분리했다.
- 저장소 유무와 관계없이 Home, Files, Snapshots, Statistics, Settings를 유지하고 화면 내부에서 필요한 저장소 동작을 안내하기로 했다.
- 한국어/영어, 시스템 언어, Tauri Store 설정 저장과 Pretendard 로컬 WOFF2 번들을 범위에 포함했다.
- 상단 저장소 메뉴는 빠른 전환, Settings의 Repositories는 검색·정렬·이름 변경·재연결·등록 해제를 담당하도록 구분했다.
- Tauri Opener를 사용한 Finder/File Explorer 표시, 경로 복사, 복원 폴더 열기를 계획했다.
- 상단 `새 백업`은 빈 source로 시작하고 Home은 `첫 백업 만들기` 또는 최근 source 기반 `다시 백업`으로 구분한다.
- Rust 오류 전체 번역, 실제 저장소 삭제, 자동 백업, 배포·서명은 이번 Phase에서 제외했다.
- 설계는 `docs/specs/0013-user-experience-localization.md`, 구현 계획은 `docs/plans/phase-10-user-experience-localization.md`에 기록했다.

### Phase 10 Task 1 설정 저장·오프라인 폰트 완료

- Tauri Store의 앱 데이터 `settings.json`에 language와 theme preferences를 저장하는 provider를 추가했다.
- 없는 설정과 유효하지 않은 설정 값은 `system` 기본값으로 복구한다.
- Pretendard Variable WOFF2와 OFL 1.1 라이선스를 저장소에 포함하고 CSS에서 로컬 asset만 참조한다.
- production build에서 약 2.06MB WOFF2가 별도 asset으로 출력되는 것을 확인했다.
- preferences/offline asset 테스트 4개, UI 전체 테스트 38개, TypeScript/Vite build, Rust check와 format 검증이 통과했다.

### Phase 10 Task 2 한국어·영어 기반 완료

- `system`, `ko`, `en` 설정을 `ko-KR`, `en-US` runtime locale로 해석하는 provider를 추가했다.
- 영어 message key를 기준 타입으로 사용해 한국어 번역 누락이 TypeScript 오류가 되도록 구성했다.
- interpolation과 날짜·숫자·byte 공통 formatter를 추가했다.
- i18n 테스트 3개, UI 전체 테스트 41개와 production build가 통과했다.

### Phase 10 Task 3 저장소 상태별 탐색 완료

- 저장소가 없거나 연결이 끊겨도 Home, Files, Snapshots, Statistics, Settings 탐색 항목을 항상 유지한다.
- 저장소가 필요한 화면에는 생성, 기존 저장소 추가, 연결 위치 찾기 동작을 제공하는 공통 안내 화면을 추가했다.
- 상단 기본 동작을 상태에 따라 `Set up repository`, `Locate repository`, `New Backup`으로 구분했다.
- 저장소 API 없이 앱 셸만 사용하는 기존 화면에서는 `New Backup` 동작을 그대로 유지한다.
- AppShell·RepositoryLibrary 집중 테스트 12개, UI 전체 테스트 43개와 production build가 통과했다.

### Phase 10 Task 4 저장소 독립 설정 완료

- 활성 저장소가 없어도 General, Repositories, Storage, Repository health 설정 탐색을 유지한다.
- General에서 시스템·한국어·영어와 시스템·라이트·다크 테마를 선택하고 Tauri Store preferences에 저장한다.
- 앱 셸의 실제 테마를 저장된 preference와 운영체제 다크 모드 설정에 연결했다.
- Storage와 Repository health는 활성 저장소가 없으면 저장소 생성·추가·선택 동작을 표시한다.
- 활성 저장소가 있으면 기존 압축 모드 변경과 무결성 검사 기능을 그대로 제공한다.
- Settings·AppShell 집중 테스트 10개, UI 전체 테스트 46개와 production build가 통과했다.

### Phase 10 Task 5 전체 저장소 관리 완료

- registry display name을 trim해 저장하고 빈 이름과 없는 repository ID를 거부하는 Rust 경로를 추가했다.
- 이름 변경은 registry만 수정하며 실제 저장소 폴더명과 `manifest.json`은 변경하지 않는다.
- Settings의 Repositories에 이름·경로 검색과 최근 사용·이름·연결 상태 정렬을 추가했다.
- 저장소 활성화, 이름 변경, 연결 위치 찾기, 등록 해제를 한 화면에서 처리한다.
- 상단 저장소 메뉴에서는 등록 해제를 제거하고 빠른 전환·추가·관리 화면 진입만 유지한다.
- Rust 전체 테스트 97개, UI 전체 테스트 50개, TypeScript/Vite production build와 rustfmt 검증이 통과했다.

### Phase 10 Task 6 데스크톱 경로 동작 완료

- macOS Finder와 Windows File Explorer를 공통으로 호출하는 `DesktopActions` adapter를 추가했다.
- 저장소와 선택한 source 경로에 파일 탐색기 표시·경로 복사 동작을 추가했다.
- 복원이 완료된 뒤에만 결과 폴더 열기와 경로 복사 동작을 표시한다.
- Tauri Opener는 path open과 reveal, Clipboard Manager는 text write 권한만 허용했다.
- adapter 테스트에서는 plugin 함수 경계만 mock하고 UI에서는 경로가 있는 상태에만 동작을 노출한다.
- UI 전체 테스트 54개, Rust 전체 테스트 97개, cargo check, rustfmt와 production build가 통과했다.

### Phase 10 Task 7 백업 진입점 구분 완료

- 상단 `New Backup`은 이전 source를 가져오지 않고 항상 빈 source로 시작한다.
- snapshot이 없는 Home은 `Create first backup`, 최근 source가 있는 Home은 `Back up again`으로 표시한다.
- 반복 백업은 최근 source path를 미리 채우고 대화상자를 열 때마다 새 기본 백업 이름을 만든다.
- 최근 source path가 없으면 반복 진입이어도 빈 source 선택 상태로 시작한다.
- 모든 진입점은 기존 단일 `createSnapshot` 호출 경로를 공유한다.
- UI 전체 테스트 58개와 TypeScript/Vite production build가 통과했다.

### Phase 10 Task 8 원본 파일 위치 연결 완료

- file inspector 응답에만 `currentSourcePath`를 추가하고 snapshot metadata에는 저장하지 않도록 경계를 유지했다.
- 현재 source root와 metadata relative path를 조합해 원본 파일이 실제 존재할 때만 절대 경로를 반환한다.
- source 파일이 삭제되었거나 source root가 사라진 경우에는 inspector에서 비동작 상태로 표시한다.
- Files 상세 패널에 `Reveal original` 동작을 추가해 macOS Finder와 Windows File Explorer로 원본 위치를 열 수 있게 했다.
- 복원 완료 후 `Open restore folder` 동작은 기존 Task 6 구현을 유지하고 Snapshot 테스트로 회귀 검증했다.
- Rust 전체 테스트 101개, UI 전체 테스트 61개, 관련 Explorer/Snapshot 테스트 11개, rustfmt와 TypeScript/Vite production build가 통과했다.

## 2026-07-09

### Phase 10 Task 9 활성 UI 다국어화와 상호작용 상태 정리 완료

- 활성 화면의 직접 렌더링 영어 문구를 typed i18n message key로 옮기고 한국어·영어 번역 사전을 확장했다.
- 경로, snapshot 이름, repository 이름처럼 사용자가 만든 값이나 metadata 값은 번역하지 않고 그대로 표시한다.
- active TSX 파일에서 관리되지 않는 JSX text, `aria-label`, `title`, `placeholder` 문자열을 감지하는 스캔 테스트를 추가했다.
- 저장소 등록 해제와 snapshot 복원에 확인 대화상자를 추가해 실수로 실행되는 파괴적·고비용 동작을 줄였다.
- 확인 대화상자는 Escape 닫기, opener focus 복귀, async confirm 중 중복 제출 방지를 테스트로 검증했다.
- 저장소가 아예 없는 empty state와 검색 결과가 0개인 상태를 서로 다른 메시지와 동작으로 구분했다.
- `npm test -- --run` 결과 UI 테스트 21개 파일, 64개 테스트가 통과했다.
- `npm run build` 결과 TypeScript 검사와 Vite production build가 통과했다.

## 2026-07-10

### Phase 10 Task 10 완료 검증과 문서 정리

- 완료된 Phase 10 설계 문서와 구현 계획을 `docs/archive/`로 보관했다.
- `docs/implemented/user-experience-localization.md`를 추가해 사용자 경험·다국어·로컬 연동 구현 범위와 검증 결과를 기록했다.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`가 통과했다.
- `cargo test --manifest-path src-tauri/Cargo.toml` 결과 Rust 테스트 101개가 통과했다.
- `npm test -- --run` 결과 UI 테스트 21개 파일, 64개 테스트가 통과했다.
- `npm run build` 결과 TypeScript 검사와 Vite production build가 통과했다.
- `git diff --check`가 통과했다.
- 런타임 소스와 production output에서 원격 font, 원격 CSS, 원격 fetch/link/import 패턴이 없음을 확인했다.
- production output의 `https://react.dev/errors/...` 문자열은 React minified error 안내 문자열로 확인했다.
- Browser smoke로 960×640, 1100×800, 1440×900에서 한국어·영어 설정 화면의 horizontal overflow와 control clipping 후보가 없음을 확인했다.
- macOS native dev launch에서 `target/debug/chrona` 실행과 `chrona` 프로세스를 확인했다.
- macOS 실행 중 `TSM AdjustCapsLockLED...`, `IMKCFRunLoopWakeUpReliable` 입력기 로그가 관찰됐으나 Chrona panic이나 테스트 실패로 이어지지는 않았다.
- Windows native 실행과 100%/125% 배율 검증은 현재 macOS 환경에서 수행하지 못했으며, 릴리스 패키징 전 별도 Windows 환경에서 확인해야 한다.

### Phase 11 백그라운드 작업 / 비차단 UX 시작

- 저장소 불러오기처럼 현재 상태를 확인해야 하는 작업은 기존 loading을 허용하되, 사용자가 시작한 저장/백업 생성/복원 같은 긴 작업은 앱 전체를 막지 않는 방향으로 분리했다.
- `docs/specs/0014-background-operations.md`와 `docs/plans/phase-11-background-operations.md`를 추가했다.
- 백업 생성 dialog는 작업 시작 후 즉시 닫히고, `createSnapshot`은 백그라운드에서 계속 실행되도록 수정했다.
- block ingest progress listener를 dialog가 아니라 `AppShell`에 두어 dialog가 닫혀도 하단 진행 바가 유지되도록 수정했다.
- 스냅샷 복원은 확인 후 즉시 dialog를 닫고 하단 진행 상태로 전환하도록 수정했다.
- 백업/복원 중에도 화면 이동과 설정 확인은 가능하게 유지하고, 같은 저장소 쓰기 작업을 새로 시작하는 동작만 제한했다.
- 라이트/다크 테마의 primary button 글자색을 `--app-on-primary`로 분리해 다크 모드 밝은 primary 배경에서 글자 대비가 떨어지지 않도록 수정했다.
- 관련 frontend 테스트는 RED를 확인했고, 구현 후 `npm test -- --run src/features/backup/NewBackupDialog.test.tsx src/app/AppShell.test.tsx src/features/snapshots/RestoreSnapshotDialog.test.tsx` 결과 3개 파일, 14개 테스트가 통과했다.
- `npm run build` 결과 TypeScript 검사와 Vite production build가 통과했다.
- `git diff --check` 결과 공백 오류가 없었다.
- 완료된 Phase 11 설계 문서와 구현 계획을 `docs/archive/`로 보관하고 `docs/implemented/background-operations.md`를 추가했다.

### Phase 11 추가 안정화

- 통계 분석 결과와 진행 상태를 `StatisticsPage` 내부가 아니라 `AppShell`에서 유지하도록 변경했다.
- Statistics 화면을 벗어났다가 돌아와도 사용자가 새 분석을 실행하기 전까지 마지막 분석 결과가 남도록 수정했다.
- 통계 progress listener도 `AppShell`로 이동해 다른 화면에 있어도 하단 진행 바가 갱신되도록 수정했다.
- 하단 `OperationBar`가 byte 기반 진행률뿐 아니라 통계처럼 count 기반 진행률도 표시할 수 있도록 확장했다.
- `create_snapshot`, `ingest_blocks`, `restore_snapshot`, `verify_repository` Tauri command를 blocking thread로 이동해 대용량 파일 처리 중 UI runtime을 오래 붙잡지 않도록 수정했다.
- `npm test -- --run src/app/AppShell.test.tsx src/features/statistics/StatisticsPage.test.tsx src/features/statistics/StatisticsDashboard.test.tsx` 결과 3개 파일, 13개 테스트가 통과했다.

### Phase 11 다크모드 색상 안정화

- 앱 셸의 `--app-*` 라이트/다크 토큰을 공용 workspace 토큰(`--surface`, `--text`, `--border`, 상태 색상 등)에 연결했다.
- 홈, 파일, 스냅샷, 통계, 설정 화면이 서로 다른 색상 토큰을 써서 다크모드에서 흰 배경이나 어두운 글자가 남는 문제를 줄였다.
- 컴포넌트 CSS에서 직접적인 `background: white/#fff`, `color: black/#000` 하드코딩이 남아 있지 않음을 확인했다.
- `npm test -- --run src/app/AppShell.test.tsx` 결과 1개 파일, 10개 테스트가 통과했다.
- `npm run build` 결과 TypeScript 검사와 Vite production build가 통과했다.

### Phase 12 백업 대상 관리 / 소스별 묶음 구현

- 저장소는 백업 데이터를 저장하는 위치, 백업 대상은 실제 원본 폴더/파일이라는 개념으로 UI와 내부 모델을 정리했다.
- 저장소 내부 `indexes/source-index.json`을 추가하고, canonical path 기준으로 같은 백업 대상을 자동 재사용하도록 `SourceStore`를 구현했다.
- 새 스냅샷과 snapshot index 항목에 `sourceId`를 기록해 같은 폴더를 반복 백업할 때 하나의 백업 대상으로 묶이도록 했다.
- inventory 집계를 `(sourceId, relativePath)` 기준으로 바꿔 서로 다른 백업 대상에 같은 상대경로 파일이 있어도 섞이지 않게 했다.
- file inspector에 optional `sourceId` 필터를 추가해 Files 화면에서 선택한 대상의 파일 이력만 조회할 수 있게 했다.
- Home에는 백업 대상 목록과 대상별 다시 백업 버튼을 추가했다.
- Files에는 백업 대상 필터를 추가하고, Snapshots에는 백업 대상별 그룹과 필터를 추가했다.
- 한국어/영어 UI 문구를 추가하고, “Source”보다 “백업 대상” 표현을 우선 사용하도록 정리했다.
- `cargo test --manifest-path src-tauri/Cargo.toml` 결과 Rust 테스트 104개가 통과했다.
- `npm test -- --run` 결과 UI 테스트 21개 파일, 69개 테스트가 통과했다.
- `npm run build` 결과 TypeScript 검사와 Vite production build가 통과했다.

### Phase 13 원본 위치 시점 복원 구현

- `restore_snapshot_to_source(repository_path, source_id, snapshot_id)` 경로를 추가했다.
- 원본 위치 복원은 대상 스냅샷의 `sourceId`가 요청 source와 다르면 중단한다.
- 복원 전 현재 원본 위치를 안전 스냅샷으로 자동 저장한다.
- 선택한 스냅샷에 있는 파일은 `.tmp` 파일로 먼저 복원한 뒤 최종 파일로 교체한다.
- 선택한 스냅샷에는 없지만 현재 원본에 있는 파일은 삭제하지 않고 `.chrona-quarantine/{operationId}/` 아래로 이동한다.
- Snapshots 상세 화면에 `원본 위치로 복원` 버튼과 확인 대화상자를 추가했다.
- 원본 위치 복원도 기존 하단 작업 표시줄을 사용해 앱 전체를 막지 않도록 연결했다.
- `cargo test --manifest-path src-tauri/Cargo.toml --test phase13_original_location_restore --test phase4_restore` 결과 2개 테스트 파일, 6개 테스트가 통과했다.
- `npm test -- --run src/features/snapshots/SnapshotsPage.test.tsx` 결과 1개 파일, 3개 테스트가 통과했다.
- `cargo test --manifest-path src-tauri/Cargo.toml` 결과 Rust 테스트 106개가 통과했다.
- `npm test -- --run` 결과 UI 테스트 21개 파일, 70개 테스트가 통과했다.
- `npm run build` 결과 TypeScript 검사와 Vite production build가 통과했다.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`와 `git diff --check`가 통과했다.

### Phase 14 크로스 플랫폼 패키징 준비 계획

- 앱 패키징 빌드를 바로 실행하지 않고, macOS/Windows 빌드 전제 조건과 경로 정책을 먼저 정리하기로 했다.
- 현재 Chrona의 기본 저장소 위치가 Tauri `app_local_data_dir()/Repositories`이고, 저장소 등록 목록은 같은 앱 로컬 데이터 폴더의 `repository-registry.json`이라는 점을 확인했다.
- macOS와 Windows의 빌드 전제 조건, 예상 산출물 위치, Finder/File Explorer 연동 검증 항목, 한글/공백/Windows drive letter 경로 검증 항목을 `docs/plans/phase-14-cross-platform-packaging-readiness.md`에 기록했다.
- `tauri.conf.json`에 바로 변경을 넣기 전에 보강할 bundle metadata 후보를 문서로 먼저 정리했다.

## 2026-07-12

### Phase 14 크로스 플랫폼 패키징 실행 시작

- 패키징 작업을 `release/phase-14-cross-platform-packaging` 브랜치로 분리했다.
- Phase 14 범위를 macOS Apple Silicon `.app`과 Windows x86-64 NSIS `setup.exe`로 고정했다.
- `src-tauri/tauri.conf.json`에 publisher, copyright, license file, category, short/long description 번들 메타데이터를 추가했다.
- `src-tauri/tauri.macos.conf.json`을 추가해 macOS bundle target을 `.app`으로 제한했다.
- `src-tauri/tauri.windows.conf.json`을 추가해 Windows bundle target을 `nsis`로 제한하고 WebView2 설치 방식을 `downloadBootstrapper`로 고정했다.
- `npm run tauri:build:macos`와 `npm run tauri:build:windows` 스크립트를 추가했다.
- icon 파일이 PNG RGBA, ICNS, ICO 형식으로 존재함을 확인했다.
- `docs/specs/0015-cross-platform-packaging.md`, `docs/packaging/`, README, Phase 14 계획 문서를 현재 패키징 범위에 맞게 갱신했다.
- 첫 macOS 빌드는 release binary까지만 생성되고 `.app`이 나오지 않아 확인한 결과, Tauri `bundle.active` 기본값이 `false`인 것이 원인이었다.
- `src-tauri/tauri.macos.conf.json`과 `src-tauri/tauri.windows.conf.json`에 `bundle.active: true`를 추가했다.
- `npm test` 결과 UI 테스트 21개 파일, 73개 테스트가 통과했다.
- `npm run build` 결과 TypeScript 검사와 Vite production build가 통과했다.
- `cargo test --manifest-path src-tauri/Cargo.toml` 결과 Rust 테스트가 통과했다.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`가 통과했다.
- `npm run tauri:build:macos` 결과 `src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Chrona.app`가 생성됐다.
- 생성된 `.app`는 약 14M이고, 내부 실행 파일은 arm64 Mach-O로 확인했다.
- `open`으로 `.app` 실행 후 `Contents/MacOS/chrona` 프로세스가 떠 있는 것을 확인하고 정상 종료했다.
- Tauri가 `com.chrona.app` identifier가 `.app`으로 끝난다는 경고를 출력했지만, 현재 Phase 14 지정값을 유지했다.

### Phase 14 macOS 설치 프로그램 생성

- 사용 요청에 맞춰 macOS 설치 프로그램 산출물 생성을 Phase 14 범위에 포함했다.
- `src-tauri/tauri.macos.installer.conf.json`을 추가하고 bundle target을 `dmg`로 설정했다.
- `npm run tauri:build:macos:installer` 스크립트를 추가했다.
- `npm run tauri:build:macos:installer` 결과 `src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/Chrona_0.1.0_aarch64.dmg`가 생성됐다.
- 생성된 DMG는 약 7.4M이다.
- `hdiutil verify` 결과 DMG checksum이 valid로 확인됐다.
- `hdiutil imageinfo` 결과 UDZO 압축 이미지이며 Software License Agreement가 포함된 것으로 확인됐다.

### Phase 14 Windows 빌드 준비 스크립트 추가

- 새 Windows x86-64 환경에서 GitHub source를 받은 뒤 명령만 실행해 NSIS installer를 만들 수 있도록 `scripts/windows/`를 추가했다.
- `scripts/windows/prepare.ps1`은 Git, Node.js LTS, Rustup, Microsoft C++ Build Tools, Rust MSVC target, npm dependencies를 확인하고 `-InstallMissing` 옵션으로 winget 설치를 보조한다.
- `scripts/windows/build-installer.ps1`은 npm test, production build, cargo test, rustfmt check를 실행한 뒤 `npm run tauri:build:windows`로 NSIS installer를 빌드하고 SHA-256을 출력한다.
- `docs/packaging/windows.md`, README, README.ko에 fresh Windows quick start 명령을 추가했다.
- Windows installer 실제 생성과 실행 검증은 여전히 실제 Windows x86-64 환경에서 수행해야 한다.

### Phase 14 GitHub Actions Windows installer 빌드 추가

- 로컬 Windows 환경에 Visual Studio Build Tools를 설치하지 않아도 `.exe`를 뽑을 수 있도록 `.github/workflows/build-windows-installer.yml`을 추가했다.
- Workflow는 `windows-latest`에서 Node.js, Rust stable MSVC target을 설정하고 npm/Rust 검증 후 `npm run tauri:build:windows`를 실행한다.
- 생성된 NSIS `.exe`는 GitHub Actions artifact로 업로드하고 SHA-256을 job summary에 기록한다.
- 수동 실행 시 `release_tag`를 입력하면 기존 GitHub Release에 `.exe` asset도 업로드한다.
