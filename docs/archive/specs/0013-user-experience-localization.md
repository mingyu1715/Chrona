# 0013 사용자 경험·다국어·로컬 데스크톱 연동

## 1. 목적

Phase 10은 배포 패키징 전에 Chrona를 실제 사용 가능한 데스크톱 앱으로 다듬는다.

- 한국어와 영어를 완전하게 지원한다.
- 설치 후 네트워크 없이 실행한다.
- 저장소 유무와 관계없이 앱 구조와 설정을 탐색할 수 있다.
- 여러 저장소를 빠르게 전환하고 안전하게 관리한다.
- Finder와 Windows 파일 탐색기로 로컬 경로를 바로 연다.
- 상단 새 백업과 Home의 상황별 백업을 서로 다른 용도로 만든다.

배포, 서명, 자동 업데이트, 스냅샷 삭제, 자동 백업은 이번 Phase에 포함하지 않는다.

## 2. 참고한 제품 패턴

- Docker Desktop은 주요 탐색 항목을 유지하고 데이터가 없는 화면 안에서 생성 동작을 제공한다.
- Docker Desktop Volumes는 목록 검색·필터·상태·상세·행 작업을 한 작업 공간에 배치한다.
- GitHub Desktop은 상단 Current repository를 빠른 전환에 사용하고 별도 흐름에서 로컬 저장소를 추가한다.
- Tauri Opener는 macOS Finder와 Windows File Explorer에서 경로를 열거나 표시한다.
- Tauri Store는 앱 데이터 디렉터리에 앱 설정을 영구 저장한다.

참고 문서:

- https://docs.docker.com/desktop/use-desktop/
- https://docs.docker.com/desktop/use-desktop/volumes/
- https://docs.github.com/en/enterprise-server@3.17/desktop/overview/creating-your-first-repository-using-github-desktop
- https://docs.github.com/en/desktop/adding-and-cloning-repositories/adding-a-repository-from-your-local-computer-to-github-desktop
- https://v2.tauri.app/plugin/opener/
- https://v2.tauri.app/plugin/store/

## 3. 기본 원칙

### 3.1 큰 구조는 숨기지 않는다

Home, Files, Snapshots, Statistics, Settings는 저장소가 없어도 항상 표시한다. 사용자가 앱이 제공하는 기능을 미리 이해할 수 있어야 한다.

저장소가 필요한 화면을 열면 공통 `RepositoryRequiredState`를 표시한다.

- `새 저장소 만들기`
- `기존 저장소 추가`
- 연결이 끊긴 등록이 있으면 `위치 다시 지정`

### 3.2 상황에 없는 세부 명령만 숨긴다

- 파일 선택 전 원본 위치 열기
- 스냅샷 선택 전 복원
- 스냅샷 2개 미만일 때 비교 실행
- 연결된 저장소의 위치 다시 지정
- 작업이 없을 때 하단 진행 표시

목록, 페이지 제목, Settings 항목은 숨기지 않는다.

### 3.3 물리 삭제와 등록 해제를 구분한다

`Chrona에서 제거`는 registry 등록만 제거한다. 실제 저장소 폴더 삭제 기능은 이번 Phase에도 만들지 않는다.

## 4. 앱 상태별 노출

| 상태 | 상단 주 동작 | Home | Files/Snapshots/Statistics | Settings |
| --- | --- | --- | --- | --- |
| 등록 저장소 없음 | `저장소 설정` | 저장소 생성/추가 | RepositoryRequiredState | 전체 메뉴 표시 |
| 연결 끊긴 저장소만 있음 | `위치 다시 지정` | 재연결 안내 | RepositoryRequiredState | 등록 목록과 relink |
| 활성 저장소 있음 | `새 백업` | 요약과 상황별 백업 | 실제 작업 공간 | 저장소 설정 활성 |

Settings의 Storage와 Repository health는 항상 항목을 표시한다. 활성 저장소가 없을 때는 선택 안내와 저장소 메뉴 이동 동작을 보여준다.

## 5. 다국어

### 5.1 언어 모델

```ts
export type AppLanguage = 'system' | 'ko' | 'en';
export type ResolvedLocale = 'ko-KR' | 'en-US';
```

- 최초 기본값은 `system`이다.
- 시스템 언어가 `ko`로 시작하면 `ko-KR`, 그 외에는 `en-US`를 사용한다.
- 영어 사전을 fallback으로 사용한다.
- 설정 변경은 즉시 전체 앱에 반영한다.

### 5.2 번역 구조

```text
src/shared/i18n/
  I18nProvider.tsx
  locale.ts
  format.ts
  messages.en.ts
  messages.ko.ts
```

영어 사전의 key 구조를 기준 타입으로 사용해 한국어 누락을 TypeScript에서 실패시킨다. 화면 안에 사용자 표시 문자열을 직접 작성하지 않는다.

날짜, 시간, 숫자, byte 표시는 `Intl.DateTimeFormat`, `Intl.NumberFormat`과 공통 formatter를 사용한다. 저장소 내부 metadata 문자열은 번역하지 않는다.

## 6. 설정 저장

Tauri Store의 `settings.json`을 앱 데이터 디렉터리에 둔다.

```ts
export interface AppPreferences {
  language: AppLanguage;
  theme: 'system' | 'light' | 'dark';
}
```

- 설정 로딩 전에는 시스템 언어와 시스템 테마를 사용해 화면 깜빡임을 줄인다.
- 손상되거나 없는 설정은 기본값으로 복구한다.
- 저장 실패는 현재 세션 설정을 유지하고 재시도할 수 있게 한다.
- repository registry와 app preferences는 별도 파일로 유지한다.

## 7. 오프라인 실행과 폰트

- Pretendard Variable WOFF2를 저장소에 포함한다.
- `src/assets/fonts/`에서 Vite bundle에 포함한다.
- OFL 1.1 전문을 `third-party-licenses/Pretendard-OFL.txt`에 둔다.
- CSS `@font-face`는 로컬 상대 경로만 사용한다.
- CDN, Google Fonts, 원격 CSS, 런타임 font fetch를 사용하지 않는다.
- 시스템 font stack은 폰트 로딩 실패 시 fallback으로만 사용한다.
- 설치에 필요한 dependency 다운로드를 제외하면 앱 기능은 네트워크를 요구하지 않는다.

## 8. 저장소 전환과 관리

### 8.1 상단 저장소 메뉴

빠른 전환 전용이다.

- 현재 저장소 이름과 연결 상태
- 최근 사용 순 저장소 목록
- 연결된 저장소 전환
- 연결 끊긴 저장소 위치 다시 지정
- `새 저장소`, `기존 저장소 추가`, `저장소 관리`

### 8.2 Settings > Repositories

전체 관리 전용이다.

- 이름·경로 검색
- 최근 사용, 이름, 연결 상태 정렬
- 활성·연결 끊김 상태 표시
- 표시 이름 변경
- 활성 저장소로 전환
- Finder/파일 탐색기에서 보기
- 경로 복사
- 연결 끊긴 위치 다시 지정
- Chrona 등록에서 제거
- 새 저장소 생성과 기존 저장소 추가

표시 이름 변경은 repository manifest를 바꾸지 않고 registry의 `display_name`만 변경한다.

Rust command:

```rust
rename_repository_registration(repository_id, display_name) -> RepositoryLibrary
```

## 9. Finder·파일 탐색기와 클립보드

Tauri Opener의 reveal/open 기능을 사용한다. 사용자 문구는 플랫폼 이름 대신 기본적으로 `폴더에서 보기` / `Show in folder`를 사용한다.

적용 위치:

- 저장소 전환 메뉴와 Settings 저장소 행
- 백업 대화상자의 선택된 소스
- 원본 파일이 존재하는 Files 상세
- 복원 완료 결과의 대상 폴더

긴 경로는 한 줄 말줄임 처리하고 tooltip과 경로 복사 버튼을 제공한다.

원본 파일 표시를 위해 파일 검사 응답에 현재 원본 경로를 추가한다.

```rust
pub struct FileInspectionReport {
    // existing fields
    pub current_source_path: Option<String>,
}
```

원본이 삭제됐거나 source root가 없으면 `currentSourcePath`는 `null`이다.

## 10. 백업 진입점 구분

### 10.1 상단 `새 백업`

- source를 미리 선택하지 않는다.
- 사용자가 파일 또는 폴더를 새로 선택한다.
- 항상 새 작업 시작 의미를 가진다.

### 10.2 Home 상황별 동작

- 스냅샷 없음: `첫 백업 만들기`
- 최근 source 있음: `다시 백업`
- `다시 백업`은 최근 source를 미리 채운다.
- backup name은 새 시각을 기준으로 다시 생성한다.
- source 경로가 더 이상 없으면 미리 채우지 않고 선택을 요구한다.

```ts
interface NewBackupDialogProps {
  initialSourcePath?: string;
  entryPoint: 'global' | 'first-backup' | 'repeat';
}
```

## 11. 화면별 세부 개선

### Home

- 저장소 없음, 첫 백업 전, 백업 이력 있음 상태를 분리한다.
- 최근 source와 snapshot 행에 바로 실행 가능한 동작을 둔다.
- 저장소 요약에서 폴더 열기와 경로 복사를 제공한다.

### Files

- 원본 존재 파일만 `원본 위치 열기`를 표시한다.
- snapshot에만 남은 파일은 `현재 원본 없음`을 표시한다.
- 검색 결과 0개와 저장소 데이터 0개를 다른 empty state로 표시한다.

### Snapshots

- 2개 미만이면 비교 영역은 유지하되 필요한 조건을 안내한다.
- 복원 완료 후 `복원 폴더 열기`를 제공한다.
- 목록 선택과 상세 스크롤 위치를 저장소 전환 전까지 유지한다.

### Statistics

- 분석 전, 분석 중, 결과 있음 상태를 구분한다.
- 저장소가 없으면 분석 버튼 대신 저장소 설정 동작을 표시한다.

### Settings

- General: Language, Theme
- Repositories: 다중 저장소 관리
- Storage: 압축 모드
- Repository health: 무결성 검사
- About은 배포 준비 Phase에서 추가한다.

## 12. 상호작용

- modal과 menu는 Escape로 닫힌다.
- 닫힌 뒤 focus는 열었던 버튼으로 돌아간다.
- 비동기 명령은 실행 중 중복 클릭을 막는다.
- 등록 해제와 복원은 확인 dialog를 사용한다.
- 완료 알림은 결과 화면 이동과 폴더 열기 동작을 제공한다.
- 오류 코드 전면 번역 계층은 만들지 않는다. 기존 오류 문자열은 alert 영역에 유지한다.

## 13. 제외 범위

- Rust 오류 전체를 사용자 문장으로 변환하는 계층
- 실제 저장소 폴더 삭제
- snapshot 삭제와 garbage collection
- 자동 백업과 파일 감시
- 클라우드 저장소
- 앱 패키징, 서명, 자동 업데이트

## 14. 완료 기준

- 저장소가 없어도 5개 화면과 Settings를 탐색할 수 있다.
- 한국어·영어가 활성 화면 전체에 적용되고 재시작 후 유지된다.
- 폰트와 UI asset이 네트워크 없이 렌더링된다.
- 상단 새 백업과 Home 상황별 백업의 입력 상태가 다르다.
- 여러 저장소를 검색·전환·이름 변경·재연결·등록 해제할 수 있다.
- 지원 가능한 경로를 Finder와 Windows File Explorer에서 열 수 있다.
- macOS와 Windows 계약 테스트가 통과한다.
- native macOS smoke test를 수행한다. Windows native 검증이 불가능하면 공백을 기록한다.
