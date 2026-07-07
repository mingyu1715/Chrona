# UI 사용성 개선 구현

Phase 9에서 Chrona를 macOS·Windows 데스크톱용 작업 공간 구조로 개편했다.

## 구현 범위

- 앱 로컬 데이터 디렉터리의 atomic JSON registry와 기본 `Repositories/` 저장 위치
- 기본 위치 생성, 사용자 위치 생성, 기존 저장소 등록, 전환, relink, 등록 해제
- Home, Files, Snapshots, Statistics, Settings 앱 셸
- `createSnapshot` 단일 호출 기반 새 백업과 실행 중에만 표시되는 하단 진행 상태
- 파일 inventory·상세 조회, 스냅샷 상세·비교·복원, 통계, 압축 설정, 무결성 검사
- 최소 창 크기 `960×640`, 표준 `1180×800`, 데스크톱 폭 대응

등록 해제는 실제 저장소 파일을 삭제하지 않는다. 모바일 전용 UI와 물리 저장소 삭제는 범위에 포함하지 않았다.

## 검증

- Rust 전체 테스트: 93개 통과
- UI 테스트: 34개 통과
- TypeScript 검사와 Vite 빌드 통과
- `git diff --check` 통과

이번 완료 검증은 정적·자동 테스트 기준이다. macOS native smoke test, Windows native 및 배율 검증, Playwright 화면 캡처와 키보드·200% zoom 검증은 수행하지 않았다.
