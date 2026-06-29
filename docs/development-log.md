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
