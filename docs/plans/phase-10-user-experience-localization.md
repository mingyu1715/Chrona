# Phase 10 User Experience And Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chrona의 한국어·영어, 오프라인 asset, 안정적인 empty state, 다중 저장소 관리, OS 파일 탐색기 연결과 구분된 백업 진입점을 구현한다.

**Architecture:** 타입 기반 내부 번역 사전과 Tauri Store 기반 preferences를 앱 셸에 연결한다. 저장소가 필요한 화면은 숨기지 않고 공통 empty state를 렌더링하며, repository registry는 표시 이름 변경을 지원한다. 로컬 경로 동작은 Tauri Opener와 clipboard adapter 뒤로 격리한다.

**Tech Stack:** Tauri 2, Rust, React, TypeScript, Vitest, Testing Library, Tauri Store, Tauri Opener, local WOFF2.

## Global Constraints

- 대상 플랫폼은 macOS와 Windows desktop이다.
- Home, Files, Snapshots, Statistics, Settings는 저장소 유무와 관계없이 항상 표시한다.
- 저장소가 없을 때는 화면 내부에서 생성·추가·재연결 동작을 제공한다.
- 앱 실행 중 CDN, 원격 font, 원격 CSS를 사용하지 않는다.
- 언어는 `system | ko | en`, 영어는 fallback이다.
- 실제 저장소 폴더 삭제 기능은 추가하지 않는다.
- Rust 오류 전체 번역 계층은 추가하지 않는다.
- 모든 기능 변경은 실패 테스트를 먼저 작성한다.

---

### Task 1: Preferences Store And Offline Font

**Files:**
- Create: `src/shared/preferences/appPreferences.ts`
- Create: `src/shared/preferences/AppPreferencesProvider.tsx`
- Create: `src/shared/preferences/AppPreferencesProvider.test.tsx`
- Create: `src/assets/fonts/PretendardVariable.woff2`
- Create: `third-party-licenses/Pretendard-OFL.txt`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `package.json`
- Modify: `src/main.tsx`
- Modify: `src/styles.css`

**Interfaces:**

```ts
export type AppLanguage = 'system' | 'ko' | 'en';
export type ThemePreference = 'system' | 'light' | 'dark';
export interface AppPreferences { language: AppLanguage; theme: ThemePreference }
export interface AppPreferencesContextValue {
  preferences: AppPreferences;
  loaded: boolean;
  setLanguage(language: AppLanguage): Promise<void>;
  setTheme(theme: ThemePreference): Promise<void>;
}
```

- [x] Write tests that load defaults, persist language/theme, and recover from missing settings.
- [x] Run `npm test -- --run src/shared/preferences/AppPreferencesProvider.test.tsx` and confirm failure.
- [x] Add `@tauri-apps/plugin-store` and initialize `tauri_plugin_store` with `store:default` permission.
- [x] Implement `settings.json` persistence with `{ language: 'system', theme: 'system' }` defaults.
- [x] Bundle Pretendard Variable WOFF2 and OFL license; use only local `url(...)` in `@font-face`.
- [x] Add a source test rejecting remote font assets and verify remote CSS/font references with source scan.
- [x] Run focused test and `npm run build`.
- [x] Commit: `feat: add offline preferences foundation`.

### Task 2: Typed Korean And English I18n

**Files:**
- Create: `src/shared/i18n/messages.en.ts`
- Create: `src/shared/i18n/messages.ko.ts`
- Create: `src/shared/i18n/locale.ts`
- Create: `src/shared/i18n/format.ts`
- Create: `src/shared/i18n/I18nProvider.tsx`
- Create: `src/shared/i18n/I18nProvider.test.tsx`
- Modify: `src/main.tsx`

**Interfaces:**

```ts
export type MessageKey = keyof typeof englishMessages;
export interface I18nValue {
  language: AppLanguage;
  locale: 'ko-KR' | 'en-US';
  t(key: MessageKey, values?: Record<string, string | number>): string;
  formatBytes(bytes: number): string;
  formatDateTime(value: string): string;
  formatNumber(value: number): string;
}
```

- [x] Test system locale resolution, explicit override, English fallback, interpolation and locale formatting.
- [x] Confirm the focused test fails because the provider is missing.
- [x] Define English keys first and type Korean as `Record<MessageKey, string>`.
- [x] Implement provider using preferences and `navigator.language`.
- [x] Run `npm test -- --run src/shared/i18n/I18nProvider.test.tsx` and `npm run build`.
- [x] Commit: `feat: add typed korean english localization`.

### Task 3: Stable Navigation And Repository-Required States

**Files:**
- Create: `src/app/RepositoryRequiredState.tsx`
- Create: `src/app/RepositoryRequiredState.test.tsx`
- Modify: `src/app/AppShell.tsx`
- Modify: `src/app/AppSidebar.tsx`
- Modify: `src/app/AppTopBar.tsx`
- Modify: `src/app/AppShell.test.tsx`
- Modify: `src/app/app-shell.css`

**Behavior test:**

```tsx
test('keeps all destinations visible without a repository', async () => {
  render(<AppShell api={emptyLibraryApi()} />);
  for (const name of ['Home', 'Files', 'Snapshots', 'Statistics', 'Settings']) {
    expect(screen.getByRole('button', { name })).toBeInTheDocument();
  }
  await userEvent.click(screen.getByRole('button', { name: 'Files' }));
  expect(screen.getByRole('button', { name: /create repository/i })).toBeEnabled();
});
```

- [x] Write tests for no registration, disconnected registration and active repository states.
- [x] Confirm tests fail against the current setup-only override.
- [x] Keep all five sidebar destinations stable.
- [x] Replace page content with `RepositoryRequiredState` only when the selected page requires a repository.
- [x] Change top action by state: `Set up repository`, `Locate repository`, `New Backup`.
- [x] Run AppShell and repository library tests.
- [x] Commit: `feat: add repository-aware empty states`.

### Task 4: Settings Without An Active Repository

**Files:**
- Rewrite: `src/features/settings/SettingsPage.tsx`
- Modify: `src/features/settings/SettingsPage.test.tsx`
- Modify: `src/features/settings/settings-page.css`
- Modify: `src/app/AppShell.tsx`

**Interfaces:**

```ts
interface SettingsPageProps {
  repository: OpenedRepository | null;
  library: RepositoryLibrary;
  onCreateRepository(): void;
  onAddExistingRepository(): void;
  onSelectRepository(repositoryId: string): void;
}
```

- [x] Test that General, Repositories, Storage and Repository health remain visible with no repository.
- [x] Test General language/theme controls without a repository.
- [x] Test Storage and Health render select/setup actions instead of controls when no repository is active.
- [x] Split current one-line component into focused section components.
- [x] Connect language/theme to AppPreferences rather than AppShell-only state.
- [x] Run settings and shell tests.
- [x] Commit: `feat: keep settings available without repository`.

### Task 5: Repository Registry Rename And Full Management

**Files:**
- Modify: `src-tauri/src/core/repository_registry_store.rs`
- Modify: `src-tauri/src/core/repository_library_service.rs`
- Modify: `src-tauri/src/commands/repository_library_commands.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/tests/phase9_repository_registry.rs`
- Modify: `src-tauri/tests/phase9_repository_library.rs`
- Modify: `src/shared/api/chronaApi.ts`
- Modify: `src/app/useRepositoryLibrary.ts`
- Create: `src/features/repository-library/RepositoryManagementPage.tsx`
- Create: `src/features/repository-library/RepositoryManagementPage.test.tsx`
- Modify: `src/features/repository-library/RepositoryLibraryMenu.tsx`

**Rust interface:**

```rust
pub fn rename_repository_registration(
    &self,
    repository_id: &str,
    display_name: &str,
) -> Result<RepositoryLibrary, ChronaError>;
```

- [ ] Test trimmed non-empty names, missing IDs, persistence and unchanged manifest.
- [ ] Implement store, service and command in that order.
- [ ] Add TypeScript API and controller action `rename(repositoryId, displayName)`.
- [ ] Test repository search, recent/name/status sort, activate, rename, relink and registration-only remove.
- [ ] Keep the top menu limited to quick switching and entry commands.
- [ ] Run Rust Phase 9 tests and repository library UI tests.
- [ ] Commit: `feat: add full repository management`.

### Task 6: Cross-Platform Reveal And Copy Actions

**Files:**
- Create: `src/shared/desktop/desktopActions.ts`
- Create: `src/shared/desktop/desktopActions.test.ts`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `package.json`
- Modify: `src/features/repository-library/RepositoryLibraryMenu.tsx`
- Modify: `src/features/repository-library/RepositoryManagementPage.tsx`
- Modify: `src/features/backup/NewBackupDialog.tsx`
- Modify: `src/features/snapshots/RestoreSnapshotDialog.tsx`

**Interfaces:**

```ts
export interface DesktopActions {
  revealPath(path: string): Promise<void>;
  openPath(path: string): Promise<void>;
  copyText(value: string): Promise<void>;
}
```

- [ ] Add Tauri Opener and clipboard manager with minimum permissions.
- [ ] Unit-test adapters with plugin functions mocked only at the boundary.
- [ ] Add reveal/copy icon commands with tooltips to repository, source and restore result locations.
- [ ] Hide commands when the path does not exist in current state.
- [ ] Run focused UI tests and Tauri capability build.
- [ ] Commit: `feat: add desktop path actions`.

### Task 7: Distinct Global And Contextual Backup Entry Points

**Files:**
- Modify: `src/features/backup/NewBackupDialog.tsx`
- Modify: `src/features/backup/NewBackupDialog.test.tsx`
- Modify: `src/features/home/HomePage.tsx`
- Modify: `src/features/home/HomePage.test.tsx`
- Modify: `src/app/AppShell.tsx`

**Interfaces:**

```ts
interface NewBackupDialogProps {
  initialSourcePath?: string;
  entryPoint: 'global' | 'first-backup' | 'repeat';
}
```

- [ ] Test global entry starts with an empty source.
- [ ] Test first-backup label when no snapshots exist.
- [ ] Test repeat entry pre-fills the latest existing source and generates a fresh name.
- [ ] Test a missing recent source falls back to source selection.
- [ ] Keep the single `createSnapshot` call invariant.
- [ ] Run Home, backup and AppShell tests.
- [ ] Commit: `feat: distinguish backup entry points`.

### Task 8: Original File And Restore Folder Actions

**Files:**
- Modify: `src-tauri/src/models/file_inspector.rs`
- Modify: `src-tauri/src/core/file_inspector_service.rs`
- Modify: `src-tauri/tests/phase7_file_inspector.rs`
- Modify: `src/shared/types/chrona.ts`
- Modify: `src/features/explorer/ExplorerPage.tsx`
- Modify: `src/features/explorer/FileInspectorPanel.tsx`
- Modify: `src/features/explorer/ExplorerPage.test.tsx`
- Modify: `src/features/snapshots/RestoreSnapshotDialog.tsx`

**Contract:** `FileInspectionReport.currentSourcePath: string | null` is an absolute runtime path and is never persisted in snapshot metadata.

- [ ] Test existing source path, deleted source file and missing source root.
- [ ] Add `current_source_path` only to the command response.
- [ ] Show `Reveal original` only when non-null.
- [ ] Show a non-actionable current-original-missing state otherwise.
- [ ] Add `Open restored folder` after successful restore.
- [ ] Run Phase 7 Rust tests and Explorer/Snapshot tests.
- [ ] Commit: `feat: connect files to desktop locations`.

### Task 9: Localize Active UI And Refine Interaction States

**Files:**
- Modify: all active files under `src/app/`, `src/features/backup/`, `explorer/`, `home/`, `repository-library/`, `settings/`, `snapshots/`, `statistics/`
- Modify: corresponding test files
- Create: `src/shared/ui/ConfirmDialog.tsx`
- Create: `src/shared/ui/ConfirmDialog.test.tsx`

- [ ] Add a test that scans active TSX files for unmanaged user-facing literals using an explicit allowlist.
- [ ] Replace active English literals with message keys; do not translate metadata values or paths.
- [ ] Add confirmation dialogs for registration removal and restore.
- [ ] Add Escape close, opener focus return and busy double-submit protection tests.
- [ ] Ensure empty data and zero search results have different messages/actions.
- [ ] Run `npm test -- --run` and `npm run build`.
- [ ] Commit: `feat: localize and refine desktop workflows`.

### Task 10: Offline And Cross-Platform Verification

**Files:**
- Create: `docs/implemented/user-experience-localization.md` after completion
- Modify: `docs/development-log.md`
- Modify: `docs/phase-status.md`
- Modify: `docs/project-plan.md`
- Modify: `README.md`
- Modify: `README.ko.md`

- [ ] Run `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check`.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml`.
- [ ] Run `npm test -- --run`, `npm run build`, and `git diff --check`.
- [ ] Inspect production output and source for runtime `http://`, `https://`, remote font and remote CSS references; allow documentation links only.
- [ ] Run native macOS smoke: no repository, settings, language restart, repository switch, reveal path, global/repeat backup, restore folder.
- [ ] Verify 960×640, 1100×800 and 1440×900 in Korean and English with no clipped commands.
- [ ] If Windows native is unavailable, record the gap; otherwise repeat path reveal and 100%/125% scale checks.
- [ ] Archive `0013` spec and this plan only after all required checks pass.
- [ ] Commit: `docs: record phase 10 user experience implementation`.

## Completion Gate

Phase 10 is complete only when Tasks 1~10 are checked, all automatic tests pass, macOS native smoke succeeds, offline assets are verified, and any missing Windows native verification is explicitly documented. Packaging and signing begin only after this gate.
