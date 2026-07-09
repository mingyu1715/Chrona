# 사용자 경험·다국어·로컬 연동 구현

Phase 10에서 Chrona를 배포 준비 전 실제 데스크톱 앱 사용 흐름에 맞게 정리했다.

## 구현 범위

- Tauri Store 기반 `settings.json` preferences 저장
- 한국어·영어 typed i18n과 시스템 언어 fallback
- Pretendard Variable WOFF2 로컬 번들, 원격 font/CSS 제거
- 저장소가 없어도 유지되는 Home, Files, Snapshots, Statistics, Settings 탐색
- 저장소 없음·연결 끊김·활성 저장소 상태별 공통 안내와 주 동작
- 기본 앱 데이터 위치 저장소 생성, 사용자 위치 생성, 기존 저장소 등록
- 저장소 검색, 정렬, 이름 변경, 활성화, relink, 등록 해제 관리 화면
- macOS Finder와 Windows File Explorer를 위한 reveal/open/copy 경로 동작
- 상단 `New Backup`, Home `Create first backup`, Home `Back up again` 진입점 분리
- Files 원본 파일 위치 표시와 원본 삭제/루트 누락 비동작 상태
- 저장소 등록 해제와 snapshot 복원 확인 대화상자
- Escape 닫기, focus 복귀, async confirm 중복 제출 방지
- active UI의 직접 문자열을 감지하는 user-facing literal 스캔 테스트

실제 저장소 폴더 삭제, Rust 오류 전체 번역, 자동 백업, 배포 패키징과 서명은 범위에 포함하지 않았다.

## 검증

- `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`: 통과
- `cargo test --manifest-path src-tauri/Cargo.toml`: Rust 테스트 101개 통과
- `npm test -- --run`: UI 테스트 21개 파일, 64개 테스트 통과
- `npm run build`: TypeScript 검사와 Vite production build 통과
- `git diff --check`: 통과
- 런타임 소스와 production output에서 원격 font/CSS/fetch/link/import 패턴 없음 확인
- production output의 React `https://react.dev/errors/...` 문자열은 minified error 안내 문자열로 기록
- macOS native dev launch: `target/debug/chrona` 실행과 프로세스 확인
- macOS 실행 중 `TSM AdjustCapsLockLED...`, `IMKCFRunLoopWakeUpReliable` 입력기 로그가 관찰됐으나 Chrona panic이나 테스트 실패는 확인되지 않았다.
- Browser smoke: 960×640, 1100×800, 1440×900에서 한국어·영어 설정 화면의 horizontal overflow와 control clipping 후보 없음

Windows native 실행과 100%/125% 배율 검증은 현재 macOS 환경에서 수행하지 못했다. Windows 검증은 릴리스 패키징 전 별도 환경에서 반복해야 한다.
