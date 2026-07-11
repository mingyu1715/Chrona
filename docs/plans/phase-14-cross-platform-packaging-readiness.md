# Phase 14 크로스 플랫폼 패키징 실행 계획

## 목표

Chrona의 현재 MVP 기능을 유지한 상태에서 macOS Apple Silicon용 `.app`/`.dmg`와 Windows x86-64용 NSIS `setup.exe` 패키징 경로를 고정한다.

이번 Phase는 배포 자동화가 아니라 로컬 패키징과 수동 검증 기준을 만드는 단계다. macOS는 이 브랜치에서 `.app`과 DMG 설치 이미지를 만든다. Windows `setup.exe`는 설정과 명령을 준비한 뒤 실제 Windows x86-64 환경에서 빌드하고 검증한다.

## 범위

이번 Phase에서 한다.

- Tauri 번들 메타데이터 보강
- macOS Apple Silicon `.app` 전용 config 추가
- macOS Apple Silicon DMG 설치 이미지 config 추가
- Windows x86-64 NSIS `setup.exe` 전용 config 추가
- WebView2 설치 방식은 `downloadBootstrapper`로 고정
- npm 패키징 스크립트 추가
- icon 파일 존재와 형식 확인
- 앱 로컬 데이터 경로와 기본 저장소 경로 정책 문서화
- macOS `.app` 빌드와 최소 실행 확인
- Windows 빌드 명령과 실제 검증 체크리스트 문서화

이번 Phase에서 하지 않는다.

- macOS Intel 빌드
- macOS universal binary
- Apple Developer ID signing과 notarization
- Windows code signing
- `.msi` 생성
- 자동 업데이트
- GitHub Releases 자동화
- Linux 또는 모바일 패키징
- 백업, 스냅샷, 복원, 무결성 기능 재설계

## 현재 기준

기준 커밋:

```text
bca0a3c feat: complete source backup MVP workflows
```

현재 패키징 브랜치:

```text
release/phase-14-cross-platform-packaging
```

기본 메타데이터:

- Product name: `Chrona`
- Version: `0.1.0`
- Identifier: `com.chrona.app`
- Publisher: `Mingyu`
- License file: `../LICENSE`
- Category: `Utility`
- Short description: `Local block-based snapshot backup manager`
- Long description: `Chrona stores local files as reusable blocks and manages point-in-time snapshots for backup, comparison, restore, rollback, and repository inspection.`

## 설정 파일

공통 설정:

```text
src-tauri/tauri.conf.json
```

macOS 전용 설정:

```text
src-tauri/tauri.macos.conf.json
```

정책:

- `bundle.active`: `true`
- `bundle.targets`: `["app"]`
- target triple: `aarch64-apple-darwin`
- 서명과 notarization은 하지 않음

macOS 설치 이미지 전용 설정:

```text
src-tauri/tauri.macos.installer.conf.json
```

정책:

- `bundle.active`: `true`
- `bundle.targets`: `["dmg"]`
- target triple: `aarch64-apple-darwin`
- 서명과 notarization은 하지 않음

Windows 전용 설정:

```text
src-tauri/tauri.windows.conf.json
```

정책:

- `bundle.active`: `true`
- `bundle.targets`: `["nsis"]`
- target triple: `x86_64-pc-windows-msvc`
- WebView2 install mode: `downloadBootstrapper`
- code signing은 하지 않음

## 명령

공통 사전 검증:

```bash
node -v
npm -v
rustc --version
cargo --version
rustup show
xcode-select -p
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

macOS Apple Silicon `.app` 빌드:

```bash
npm run tauri:build:macos
```

macOS Apple Silicon DMG 설치 이미지 빌드:

```bash
npm run tauri:build:macos:installer
```

예상 산출물:

```text
src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Chrona.app
```

현재 macOS 산출물:

```text
src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Chrona.app
src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/Chrona_0.1.0_aarch64.dmg
```

Windows x86-64 NSIS 빌드:

```powershell
npm run tauri:build:windows
```

예상 산출물:

```text
src-tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis\Chrona_0.1.0_x64-setup.exe
```

실제 파일명과 위치는 빌드 후 기록한다.

## 앱 데이터와 저장소 경로 정책

Chrona는 OS별 앱 로컬 데이터 폴더를 사용한다.

```text
app_local_data_dir()/repository-registry.json
app_local_data_dir()/Repositories/
```

정책:

- 저장소 등록 목록은 `repository-registry.json`에 유지한다.
- 기본 새 저장소는 `Repositories/` 아래에 만든다.
- 사용자가 custom location을 선택하면 해당 위치에 저장소를 만든다.
- 기존 저장소 등록은 폴더를 이동하지 않고 registry에만 추가한다.
- 내부 metadata relative path는 OS와 무관하게 `/` separator만 사용한다.
- OS 파일 경로는 Rust `PathBuf`로 처리한다.

## 권한 확인

현재 capability는 유지한다.

```text
core:default
dialog:allow-open
opener:allow-open-path
opener:allow-reveal-item-in-dir
clipboard-manager:allow-write-text
store:default
```

추가 권한은 이번 Phase에서 열지 않는다.

## 수동 검증

공통:

- 빈 앱 데이터 상태에서 첫 실행
- 기존 registry가 있는 상태에서 재실행
- 저장소 생성
- 기존 저장소 등록
- 저장소 전환
- 백업 대상 등록
- 새 백업 생성
- 같은 백업 대상 반복 백업
- 스냅샷 비교
- 스냅샷 삭제
- 새 대상 폴더로 복원
- 원본 위치로 복원
- 무결성 검증
- 앱 재시작 후 registry와 최근 작업 유지
- 큰 파일 백업 중 화면 이동 가능 여부
- 한글 경로, 공백 경로, nested path, 빈 파일, 대용량 파일 처리

macOS:

- `.app` 직접 실행
- Dock과 Finder에서 앱 이름과 아이콘 확인
- Finder reveal/open 동작 확인
- 앱 종료 후 재실행 시 데이터 유지 확인
- unsigned app 실행 경고 여부 기록

Windows:

- NSIS installer 실행
- WebView2 bootstrapper 동작 확인
- 설치 후 앱 실행
- File Explorer reveal/open 동작 확인
- `%LOCALAPPDATA%` 아래 app local data dir 확인
- drive letter path 백업 확인
- 100%, 125%, 150% display scaling 확인
- uninstall 동작 확인
- unsigned installer / SmartScreen 경고 여부 기록

## 완료 기준

macOS 쪽 완료 기준:

- Tauri 설정이 schema에 맞게 통과한다.
- `npm test`, `npm run build`, `cargo test`, `cargo fmt --check`가 통과한다.
- Apple Silicon target으로 `.app`이 생성된다.
- Apple Silicon target으로 DMG 설치 이미지가 생성된다.
- `.app`이 실행된다.
- 실제 산출물 경로와 검증 결과가 개발 로그에 남는다.

Windows 쪽 완료 기준:

- Windows NSIS 설정과 npm script가 준비되어 있다.
- 실제 Windows x86-64 환경에서 `setup.exe`가 생성된다.
- 설치, 실행, WebView2, 앱 데이터 유지, 삭제가 검증된다.
- 결과가 개발 로그에 남는다.

## 현재 남은 작업

- macOS 사전 검증 실행
- macOS `.app` 빌드
- macOS `.app` 최소 실행 확인
- Windows 실제 환경에서 NSIS 빌드 및 수동 검증
