# 구현 계획 목록

이 디렉터리는 현재 진행 중이거나 다음에 구현할 작업 계획만 둔다.

완료된 계획은 구현 기록을 `docs/implemented/`에 남긴 뒤 `docs/archive/plans/`로 이동한다.
완료된 설계 문서는 `docs/archive/specs/`로 이동한다.
현재 `docs/specs/`에는 아직 구현하지 않았거나 다음에 구현할 설계만 남긴다.

전체 구현/계획/향후 작업 상태는 `docs/phase-status.md`를 기준으로 본다.

## 현재 구현 계획

- 없음

## 현재 `docs/specs/`에 남아 있는 설계

- 블록 압축: `docs/specs/0005-block-compression.md`
  - 상태: 설계만 있음
  - 구현 계획: 없음
  - 현재 작업 범위: 제외

## 보관된 완료 계획

- Phase 1 블록 엔진: `docs/archive/plans/phase-1-block-engine.md`
- Phase 2 스냅샷 엔진: `docs/archive/plans/phase-2-snapshot-engine.md`
- Phase 3 스냅샷 비교: `docs/archive/plans/phase-3-snapshot-comparison.md`
- Phase 4 스냅샷 복원: `docs/archive/plans/phase-4-snapshot-restore.md`
- 홈/적응형 탐색: `docs/archive/plans/phase-next-home-adaptive-navigation.md`
- Phase 5a 무결성 검증: `docs/archive/plans/phase-5-integrity-verification.md`
- Phase 5b 저장소 인벤토리 탐색: `docs/archive/plans/phase-5-repository-inventory-explorer.md`

## 보관된 완료 설계

- 저장소 포맷: `docs/archive/specs/0001-repository-format.md`
- 블록 엔진: `docs/archive/specs/0002-block-engine.md`
- 스냅샷 포맷: `docs/archive/specs/0003-snapshot-format.md`
- 스냅샷 비교: `docs/archive/specs/0004-snapshot-comparison.md`
- 홈/적응형 탐색: `docs/archive/specs/0006-home-adaptive-navigation.md`
- 스냅샷 복원: `docs/archive/specs/0007-snapshot-restore.md`
- 무결성 검증: `docs/archive/specs/0008-integrity-verification.md`
- 저장소 인벤토리 탐색: `docs/archive/specs/0009-repository-inventory-explorer.md`

## 설계와 상세 계획이 모두 없는 후보

- 저장소 통계 대시보드
- 파일 검사기 / 파일 블록 지도
- 패키징된 `.app` 릴리스 / 서명
- 스냅샷 삭제와 블록 정리
- 파일 감시 / 자동 스냅샷
- SQLite 메타데이터 백엔드
- 암호화
- 내용 기반 블록 분할
- 클라우드 블록 저장 어댑터
- 저장소 마이그레이션 도구
