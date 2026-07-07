# Phase 9 UI Usability Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** macOS와 Windows에서 저장소를 라이브러리처럼 관리하고, 기존 Chrona 기능을 Home, Files, Snapshots, Statistics, Settings 중심의 실제 사용 가능한 데스크톱 앱 셸로 재구성한다.

**Architecture:** 운영체제 앱 로컬 데이터 디렉터리에 저장소 등록 목록을 별도 atomic JSON으로 관리하고 Tauri command를 통해 프론트엔드에 제공한다. 프론트엔드는 `AppShell`이 활성 저장소, 현재 화면, 진행 작업을 소유하며 기존 기능 컴포넌트를 사용자 작업 단위 페이지로 옮긴다. 기존 저장소 포맷과 block/snapshot 서비스는 변경하지 않는다.

**Tech Stack:** Tauri 2, Rust 2021, React 19, TypeScript 5.9, Vitest, Testing Library, Lucide React, 기존 CSS 변수와 라이트/다크 테마

## Global Constraints

- 대상 플랫폼은 macOS와 Windows 데스크톱 앱이다.
- Tauri 최소 창 크기는 `960×640`이며 모바일·태블릿 전용 UI는 구현하지 않는다.
- 새 저장소 기본 위치는 Tauri `app_local_data_dir()/Repositories/`다.
- 기존 저장소를 불러올 때 파일을 복사하거나 이동하지 않는다.
- 앱 등록 해제는 실제 저장소 파일을 삭제하지 않는다.
- 저장소 포맷, block hash, compression envelope, snapshot metadata 계약을 변경하지 않는다.
- `Waiting`, `Available`, `Ready`, `Loaded` 탐색 배지를 제거한다.
- 하단 진행 표시는 실행 중이거나 방금 완료된 작업이 있을 때만 렌더링한다.
- 현재 녹색 팔레트, 라이트/다크 모드, Lucide 아이콘을 유지한다.
- 새 라우팅, 차트, 상태 관리, CSS framework 의존성을 추가하지 않는다.
- 각 Task는 실패 테스트 확인, 최소 구현, 전체 관련 테스트, 독립 커밋 순서로 수행한다.

---

## Planned File Structure

```text
src-tauri/src/
  commands/repository_library_commands.rs
  core/repository_library_service.rs
  core/repository_registry_store.rs
  models/repository_registry.rs
src-tauri/tests/
  phase9_repository_registry.rs
  phase9_repository_library.rs

src/
  app/
    AppShell.tsx
    AppShell.test.tsx
    AppTopBar.tsx
    AppSidebar.tsx
    OperationBar.tsx
    app-shell.css
    useRepositoryLibrary.ts
  features/
    backup/NewBackupDialog.tsx
    backup/NewBackupDialog.test.tsx
    explorer/ExplorerPage.tsx
    explorer/ExplorerPage.test.tsx
    home/HomePage.tsx
    home/HomePage.test.tsx
    repository-library/RepositoryLibraryMenu.tsx
    repository-library/RepositorySetupDialog.tsx
    repository-library/RepositoryLibrary.test.tsx
    settings/SettingsPage.tsx
    settings/SettingsPage.test.tsx
    snapshots/SnapshotsPage.tsx
    snapshots/RestoreSnapshotDialog.tsx
    snapshots/SnapshotsPage.test.tsx
    statistics/StatisticsPage.tsx
    statistics/StatisticsPage.test.tsx
```

`RepositoryPage.tsx`는 Task 4~9 동안 호환 controller로 유지하고, Task 10에서 남은 역할을 `AppShell`로 옮긴 뒤 삭제한다. 기존 `FileInspectorPanel`, `SnapshotComparePanel`, `RepositoryOverview`, `StatisticsDashboard`는 재사용한다.

---

### Task 1: Repository Registry Model And Atomic Store

**Files:**
- Create: `src-tauri/src/models/repository_registry.rs`
- Create: `src-tauri/src/core/repository_registry_store.rs`
- Create: `src-tauri/tests/phase9_repository_registry.rs`
- Modify: `src-tauri/src/models/mod.rs`
- Modify: `src-tauri/src/core/mod.rs`

**Interfaces:**
- Produces: `RegisteredRepository`, `RepositoryRegistry`, `RepositoryRegistryStore`
- Produces: `RepositoryRegistryStore::{load, save, register, set_active, remove, relink}`
- Persists: `{appLocalDataDir}/repository-registry.json`

- [x] **Step 1: Write failing registry store tests**

```rust
fn registered_repository(repository_id: &str, path: impl AsRef<Path>) -> RegisteredRepository {
    RegisteredRepository {
        repository_id: repository_id.to_string(),
        display_name: repository_id.to_string(),
        path: path.as_ref().to_path_buf(),
        added_at: "2026-07-07T00:00:00Z".to_string(),
        last_opened_at: "2026-07-07T00:00:00Z".to_string(),
    }
}

#[test]
fn registry_round_trip_preserves_active_repository() {
    let temp = tempfile::tempdir().unwrap();
    let store = RepositoryRegistryStore::new(temp.path().to_path_buf());
    let item = registered_repository("repo-a", "/tmp/repo-a");

    store.register(item.clone()).unwrap();
    store.set_active(Some(&item.repository_id)).unwrap();

    let loaded = store.load().unwrap();
    assert_eq!(loaded.active_repository_id.as_deref(), Some("repo-a"));
    assert_eq!(loaded.repositories, vec![item]);
}

#[test]
fn registry_rejects_duplicate_canonical_path() {
    let temp = tempfile::tempdir().unwrap();
    let repository = temp.path().join("repo");
    std::fs::create_dir_all(&repository).unwrap();
    let store = RepositoryRegistryStore::new(temp.path().join("app-data"));

    store.register(registered_repository("repo-a", &repository)).unwrap();
    let error = store
        .register(registered_repository("repo-b", &repository))
        .unwrap_err();

    assert!(error.to_string().contains("already registered"));
}

```

Use a real filesystem failure for the atomic write test. Do not add production fields or methods used only by tests:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[test]
    fn failed_registry_write_keeps_previous_json_readable() {
        use std::os::unix::fs::PermissionsExt;

        let temp = tempfile::tempdir().unwrap();
        let store = RepositoryRegistryStore::new(temp.path().to_path_buf());
        store.register(registered_repository("repo-a", "/tmp/a")).unwrap();

        let registry_path = temp.path().join("repository-registry.json");
        let before = std::fs::read(&registry_path).unwrap();
        let original_permissions = std::fs::metadata(temp.path()).unwrap().permissions();
        std::fs::set_permissions(temp.path(), std::fs::Permissions::from_mode(0o555)).unwrap();
        assert!(store.register(registered_repository("repo-b", "/tmp/b")).is_err());
        std::fs::set_permissions(temp.path(), original_permissions).unwrap();
        assert_eq!(std::fs::read(registry_path).unwrap(), before);
    }
}
```

- [x] **Step 2: Run the registry tests and confirm failure**

Run: `cargo test --test phase9_repository_registry`

Expected: compilation fails because `repository_registry` and `RepositoryRegistryStore` do not exist.

- [x] **Step 3: Add registry models**

```rust
pub const REPOSITORY_REGISTRY_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RegisteredRepository {
    pub repository_id: String,
    pub display_name: String,
    pub path: PathBuf,
    pub added_at: String,
    pub last_opened_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryRegistry {
    pub schema_version: u32,
    pub active_repository_id: Option<String>,
    pub repositories: Vec<RegisteredRepository>,
}

impl Default for RepositoryRegistry {
    fn default() -> Self {
        Self {
            schema_version: REPOSITORY_REGISTRY_SCHEMA_VERSION,
            active_repository_id: None,
            repositories: Vec::new(),
        }
    }
}
```

- [x] **Step 4: Implement atomic registry storage**

`save` must create the app data directory, serialize pretty JSON, write `repository-registry.json.tmp-{uuid}`, call `sync_all`, and rename it to `repository-registry.json`. Every mutation must load, validate, mutate, then save.

```rust
pub struct RepositoryRegistryStore {
    app_data_dir: PathBuf,
}

impl RepositoryRegistryStore {
    pub fn new(app_data_dir: PathBuf) -> Self;
    pub fn load(&self) -> ChronaResult<RepositoryRegistry>;
    pub fn save(&self, registry: &RepositoryRegistry) -> ChronaResult<()>;
    pub fn register(&self, item: RegisteredRepository) -> ChronaResult<RepositoryRegistry>;
    pub fn set_active(&self, repository_id: Option<&str>) -> ChronaResult<RepositoryRegistry>;
    pub fn remove(&self, repository_id: &str) -> ChronaResult<RepositoryRegistry>;
    pub fn relink(&self, repository_id: &str, path: PathBuf) -> ChronaResult<RepositoryRegistry>;
}
```

Add `ChronaError::RepositoryAlreadyRegistered(String)` and `ChronaError::RepositoryRegistrationNotFound(String)` so tests can assert stable error kinds.

`register` must reject both an existing manifest `repository_id` and an existing canonical path. The store never validates `manifest.json`; that responsibility belongs to Task 2's service.

- [x] **Step 5: Run registry tests**

Run: `cargo test --test phase9_repository_registry`

Expected: all registry round-trip, duplicate, active removal, relink, and write-failure tests pass.

- [x] **Step 6: Commit Task 1**

```bash
git add src-tauri/src/models/repository_registry.rs src-tauri/src/models/mod.rs src-tauri/src/core/repository_registry_store.rs src-tauri/src/core/mod.rs src-tauri/src/core/errors.rs src-tauri/tests/phase9_repository_registry.rs
git commit -m "feat: add repository registry store"
```

---

### Task 2: Repository Library Service And Tauri Commands

**Files:**
- Create: `src-tauri/src/core/repository_library_service.rs`
- Create: `src-tauri/src/commands/repository_library_commands.rs`
- Create: `src-tauri/tests/phase9_repository_library.rs`
- Modify: `src-tauri/src/models/repository_registry.rs`
- Modify: `src-tauri/src/core/mod.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/tauri.conf.json`

**Interfaces:**
- Consumes: `RepositoryRegistryStore`, `RepositoryManager`
- Produces: `RepositoryLibrary`, `RepositoryLibraryItem`, `OpenedRepository`
- Produces commands: `get_repository_library`, `create_managed_repository`, `create_repository_at`, `register_existing_repository`, `activate_registered_repository`, `remove_repository_registration`, `relink_registered_repository`

- [x] **Step 1: Write failing service integration tests**

```rust
#[test]
fn creates_repository_under_managed_root_and_activates_it() {
    let temp = tempfile::tempdir().unwrap();
    let service = RepositoryLibraryService::new(temp.path().join("app-data"));

    let opened = service.create_managed("School Backup").unwrap();

    assert!(opened.registration.path.starts_with(service.managed_repositories_root()));
    assert_eq!(opened.registration.display_name, "School Backup");
    assert_eq!(opened.manifest.repository_id, opened.registration.repository_id);
    assert_eq!(service.list().unwrap().active_repository_id, Some(opened.registration.repository_id));
}

#[test]
fn registering_existing_repository_does_not_move_it() {
    let temp = tempfile::tempdir().unwrap();
    let existing = temp.path().join("external-repository");
    RepositoryManager::create(&existing).unwrap();
    let service = RepositoryLibraryService::new(temp.path().join("app-data"));

    let opened = service.register_existing(&existing, None).unwrap();

    assert_eq!(opened.registration.path, existing.canonicalize().unwrap());
    assert!(existing.join("manifest.json").is_file());
}

#[test]
fn missing_external_repository_remains_registered_as_disconnected() {
    let temp = tempfile::tempdir().unwrap();
    let external = temp.path().join("external");
    RepositoryManager::create(&external).unwrap();
    let service = RepositoryLibraryService::new(temp.path().join("app-data"));
    let opened = service.register_existing(&external, None).unwrap();
    std::fs::rename(&external, temp.path().join("detached")).unwrap();

    let library = service.list().unwrap();
    let item = library.repositories.iter()
        .find(|item| item.repository_id == opened.registration.repository_id)
        .unwrap();
    assert_eq!(item.connection_state, RepositoryConnectionState::Disconnected);
}
```

- [x] **Step 2: Run service tests and confirm failure**

Run: `cargo test --test phase9_repository_library`

Expected: compilation fails because `RepositoryLibraryService` is missing.

- [x] **Step 3: Add service response models**

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RepositoryConnectionState {
    Connected,
    Disconnected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryLibraryItem {
    pub repository_id: String,
    pub display_name: String,
    pub path: PathBuf,
    pub added_at: String,
    pub last_opened_at: String,
    pub connection_state: RepositoryConnectionState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryLibrary {
    pub active_repository_id: Option<String>,
    pub repositories: Vec<RepositoryLibraryItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedRepository {
    pub registration: RepositoryLibraryItem,
    pub manifest: RepositoryManifest,
}
```

- [x] **Step 4: Implement library service**

```rust
impl RepositoryLibraryService {
    pub fn new(app_local_data_dir: PathBuf) -> Self;
    pub fn managed_repositories_root(&self) -> PathBuf;
    pub fn list(&self) -> ChronaResult<RepositoryLibrary>;
    pub fn create_managed(&self, display_name: &str) -> ChronaResult<OpenedRepository>;
    pub fn create_at(&self, display_name: &str, parent: &Path) -> ChronaResult<OpenedRepository>;
    pub fn register_existing(&self, path: &Path, display_name: Option<&str>) -> ChronaResult<OpenedRepository>;
    pub fn activate(&self, repository_id: &str) -> ChronaResult<OpenedRepository>;
    pub fn remove_registration(&self, repository_id: &str) -> ChronaResult<RepositoryLibrary>;
    pub fn relink(&self, repository_id: &str, path: &Path) -> ChronaResult<OpenedRepository>;
}
```

Directory naming rule: normalize ASCII letters and digits to lowercase, replace runs of other characters with `-`, fall back to `repository`, and append the first eight UUID characters. `School Backup` becomes `school-backup-a1b2c3d4`.

`create_at` treats the selected path as a parent and creates one new repository directory below it. `register_existing` calls `RepositoryManager::open` before registration. `remove_registration` never calls `remove_dir_all`.

- [x] **Step 5: Add Tauri commands and native window minimum**

Each command resolves the platform directory through `app.path().app_local_data_dir()` and constructs `RepositoryLibraryService`. Add wrappers to `main.rs` and register all seven commands in `generate_handler!`.

```rust
fn app_local_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    app.path().app_local_data_dir().map_err(|error| error.to_string())
}
```

Set the Tauri window values:

```json
{
  "width": 1180,
  "height": 800,
  "minWidth": 960,
  "minHeight": 640
}
```

- [x] **Step 6: Run focused and full Rust tests**

Run: `cargo test --test phase9_repository_library`

Expected: managed create, custom create, register, activate, disconnect, relink, duplicate, and remove-registration tests pass.

Run: `cargo test`

Expected: all existing Phase 1~8 and new Phase 9 Rust tests pass.

- [x] **Step 7: Commit Task 2**

```bash
git add src-tauri/src/core/repository_library_service.rs src-tauri/src/core/mod.rs src-tauri/src/commands/repository_library_commands.rs src-tauri/src/commands/mod.rs src-tauri/src/models/repository_registry.rs src-tauri/src/main.rs src-tauri/tauri.conf.json src-tauri/tests/phase9_repository_library.rs
git commit -m "feat: add repository library commands"
```

---

### Task 3: TypeScript Repository Library Contract

**Files:**
- Modify: `src/shared/types/chrona.ts`
- Modify: `src/shared/api/chronaApi.ts`
- Modify: `src/features/repository/RepositoryPage.test.tsx`
- Create: `src/test/chronaApiMock.ts`

**Interfaces:**
- Consumes Tauri commands from Task 2
- Produces TypeScript types matching Rust `camelCase` serialization
- Produces one reusable `createChronaApiMock()` for all new UI tests

- [ ] **Step 1: Add a failing API contract test through the reusable mock**

```ts
test('opens the active registered repository', async () => {
  const { api, library, openedRepository } = createChronaApiMock();

  await expect(api.getRepositoryLibrary()).resolves.toEqual(library);
  await expect(api.activateRegisteredRepository('repo-id'))
    .resolves.toEqual(openedRepository);
});
```

- [ ] **Step 2: Run the frontend test and confirm failure**

Run: `npm test -- --run src/features/repository/RepositoryPage.test.tsx`

Expected: TypeScript/Vitest fails because repository library methods are not part of `ChronaApi`.

- [ ] **Step 3: Add shared TypeScript types**

```ts
export type RepositoryConnectionState = 'connected' | 'disconnected';

export interface RepositoryLibraryItem {
  repositoryId: string;
  displayName: string;
  path: string;
  addedAt: string;
  lastOpenedAt: string;
  connectionState: RepositoryConnectionState;
}

export interface RepositoryLibrary {
  activeRepositoryId: string | null;
  repositories: RepositoryLibraryItem[];
}

export interface OpenedRepository {
  registration: RepositoryLibraryItem;
  manifest: RepositoryManifest;
}
```

- [ ] **Step 4: Add API methods and dialog helpers**

```ts
getRepositoryLibrary(): Promise<RepositoryLibrary>;
createManagedRepository(displayName: string): Promise<OpenedRepository>;
createRepositoryAt(displayName: string, parentPath: string): Promise<OpenedRepository>;
registerExistingRepository(repositoryPath: string): Promise<OpenedRepository>;
activateRegisteredRepository(repositoryId: string): Promise<OpenedRepository>;
removeRepositoryRegistration(repositoryId: string): Promise<RepositoryLibrary>;
relinkRegisteredRepository(repositoryId: string, repositoryPath: string): Promise<OpenedRepository>;
selectRepositoryParentPath(): Promise<string | null>;
selectExistingRepositoryPath(): Promise<string | null>;
```

Invoke argument names must match Rust command parameters exactly. Native path selectors both use directory-only Tauri dialogs but have different titles.

- [ ] **Step 5: Extract the existing large inline mock**

Move the complete mock from `RepositoryPage.test.tsx` into `src/test/chronaApiMock.ts`, preserve all Phase 1~8 methods, and add deterministic repository library responses. Do not weaken `ChronaApi` with optional methods.

- [ ] **Step 6: Run frontend tests**

Run: `npm test -- --run`

Expected: all existing UI tests pass with the shared mock.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/shared/types/chrona.ts src/shared/api/chronaApi.ts src/test/chronaApiMock.ts src/features/repository/RepositoryPage.test.tsx
git commit -m "feat: expose repository library api"
```

---

### Task 4: App Shell, Navigation, And Conditional Operation Bar

**Files:**
- Create: `src/app/AppShell.tsx`
- Create: `src/app/AppShell.test.tsx`
- Create: `src/app/AppTopBar.tsx`
- Create: `src/app/AppSidebar.tsx`
- Create: `src/app/OperationBar.tsx`
- Create: `src/app/app-shell.css`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `AppView = 'home' | 'files' | 'snapshots' | 'statistics' | 'settings'`
- Produces: `ActiveOperation` and `OperationBar`
- Temporarily renders existing `RepositoryPage` content through a compatibility child until Tasks 6~9 replace each view

- [ ] **Step 1: Write failing shell behavior tests**

```tsx
test('shows five navigation destinations without workflow badges', () => {
  render(<AppShellHarness />);
  const navigation = screen.getByRole('navigation', { name: /primary/i });

  for (const name of ['Home', 'Files', 'Snapshots', 'Statistics', 'Settings']) {
    expect(within(navigation).getByRole('button', { name })).toBeInTheDocument();
  }
  expect(screen.queryByText(/waiting|available|ready|loaded/i)).not.toBeInTheDocument();
});

test('renders the operation bar only while an operation exists', () => {
  const { rerender } = render(<OperationBar operation={null} />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();

  rerender(<OperationBar operation={activeOperationFixture()} />);
  expect(screen.getByRole('status')).toHaveTextContent('final-report.docx');
});
```

- [ ] **Step 2: Run shell tests and confirm failure**

Run: `npm test -- --run src/app/AppShell.test.tsx`

Expected: fails because app shell components do not exist.

- [ ] **Step 3: Implement the shell component contracts**

```ts
export type AppView = 'home' | 'files' | 'snapshots' | 'statistics' | 'settings';

export interface ActiveOperation {
  kind: 'backup' | 'restore' | 'statistics' | 'integrity';
  label: string;
  currentFile: string | null;
  processedBytes: number;
  totalBytes: number;
  phase: string;
}
```

`AppShell` owns `activeView`, theme, repository menu open state, settings navigation, and active operation. `AppSidebar` renders only the five destinations and current selection. `AppTopBar` renders brand, repository switcher slot, New Backup, theme, settings.

- [ ] **Step 4: Implement desktop shell CSS**

Use CSS grid with rows `56px minmax(0, 1fr) auto` and columns `var(--sidebar-width) minmax(0, 1fr)`. Apply `overflow: hidden` to the shell and `overflow: auto` only to the main content. Do not copy the existing four-card resource overview, path dock, drop-panel trigger, or idle footer styles.

- [ ] **Step 5: Run focused and full UI tests**

Run: `npm test -- --run src/app/AppShell.test.tsx`

Expected: navigation and conditional operation tests pass.

Run: `npm test -- --run`

Expected: existing tests continue to pass while compatibility content remains available.

- [ ] **Step 6: Commit Task 4**

```bash
git add src/app src/App.tsx src/styles.css
git commit -m "feat: add desktop application shell"
```

---

### Task 5: Repository Bootstrap, Switcher, And Setup Dialog

**Files:**
- Create: `src/app/useRepositoryLibrary.ts`
- Create: `src/features/repository-library/RepositoryLibraryMenu.tsx`
- Create: `src/features/repository-library/RepositorySetupDialog.tsx`
- Create: `src/features/repository-library/RepositoryLibrary.test.tsx`
- Modify: `src/app/AppShell.tsx`
- Modify: `src/app/AppTopBar.tsx`
- Modify: `src/app/app-shell.css`

**Interfaces:**
- Consumes: Task 3 `ChronaApi` repository library methods
- Produces hook state: `library`, `activeRepository`, `loading`, `error`
- Produces actions: `createManaged`, `createAt`, `registerExisting`, `activate`, `remove`, `relink`, `refresh`

- [ ] **Step 1: Write failing bootstrap and setup tests**

```tsx
test('opens the last active repository during bootstrap', async () => {
  const { api } = createChronaApiMock();
  render(<AppShell api={api} />);

  await waitFor(() => {
    expect(api.activateRegisteredRepository).toHaveBeenCalledWith('repo-id');
  });
  expect(screen.getByRole('button', { name: /Chrona Demo repository/i }))
    .toBeInTheDocument();
});

test('shows repository setup when the library is empty', async () => {
  const { api } = createChronaApiMock({ repositories: [] });
  render(<AppShell api={api} />);

  expect(await screen.findByRole('heading', { name: /set up chrona/i }))
    .toBeInTheDocument();
  expect(screen.getByRole('button', { name: /create repository/i })).toBeEnabled();
  expect(screen.getByRole('button', { name: /add existing repository/i })).toBeEnabled();
});

test('removing registration never exposes a delete files action', async () => {
  render(<RepositoryLibraryMenuHarness />);
  await userEvent.click(screen.getByRole('button', { name: /repository menu/i }));
  expect(screen.getByRole('button', { name: /remove from chrona/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /delete files/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- --run src/features/repository-library/RepositoryLibrary.test.tsx`

Expected: fails because the hook, switcher, and setup dialog are missing.

- [ ] **Step 3: Implement `useRepositoryLibrary`**

The hook loads the library once, activates `activeRepositoryId` only when its item is connected, and shows setup instead of repeatedly retrying a disconnected path. Every successful create/register/activate action updates both library and active repository from returned data.

```ts
export interface RepositoryLibraryController {
  library: RepositoryLibrary | null;
  activeRepository: OpenedRepository | null;
  loading: boolean;
  error: string | null;
  createManaged(displayName: string): Promise<void>;
  createAt(displayName: string, parentPath: string): Promise<void>;
  registerExisting(path: string): Promise<void>;
  activate(repositoryId: string): Promise<void>;
  remove(repositoryId: string): Promise<void>;
  relink(repositoryId: string, path: string): Promise<void>;
  refresh(): Promise<void>;
}
```

- [ ] **Step 4: Implement repository menu and setup dialog**

The top-bar menu lists connected and disconnected repositories, highlights the active item, and exposes `New repository`, `Add existing repository`, and `Manage repositories`. Disconnected items expose `Locate folder` rather than activation.

The setup dialog has one required repository name input, primary `Create in default location`, secondary `Choose location`, and `Add existing repository`. Native folder selection occurs only after the user selects a custom/existing action.

- [ ] **Step 5: Connect bootstrap to AppShell**

When no active repository exists, main content renders setup. When an active repository exists, default view is Home. New Backup in the top bar opens setup when no repository exists and opens `NewBackupDialog` otherwise.

- [ ] **Step 6: Run UI tests**

Run: `npm test -- --run src/features/repository-library/RepositoryLibrary.test.tsx src/app/AppShell.test.tsx`

Expected: bootstrap, create default, create custom, register existing, switch, disconnected, relink, remove-registration tests pass.

- [ ] **Step 7: Commit Task 5**

```bash
git add src/app/useRepositoryLibrary.ts src/app/AppShell.tsx src/app/AppTopBar.tsx src/app/app-shell.css src/features/repository-library
git commit -m "feat: add repository library workspace"
```

---

### Task 6: Home And New Backup Workflow

**Files:**
- Create: `src/features/home/HomePage.tsx`
- Create: `src/features/home/HomePage.test.tsx`
- Create: `src/features/backup/NewBackupDialog.tsx`
- Create: `src/features/backup/NewBackupDialog.test.tsx`
- Modify: `src/app/AppShell.tsx`
- Modify: `src/app/OperationBar.tsx`
- Modify: `src/app/app-shell.css`

**Interfaces:**
- Consumes: active `OpenedRepository`, `getHomeSummary`, `getRepositoryStatisticsOverview`, `createSnapshot`, path selectors, block progress event
- Produces: completed `Snapshot` and navigation action to Snapshots
- Must call `createSnapshot` once; it already performs streaming ingest and snapshot metadata creation

- [ ] **Step 1: Write failing Home and backup tests**

```tsx
test('home shows one primary backup action and compact repository overview', async () => {
  render(<HomePageHarness />);
  expect(await screen.findByRole('button', { name: /new backup/i })).toBeInTheDocument();
  expect(screen.getByText('148')).toBeInTheDocument();
  expect(screen.queryByText(/continue working/i)).not.toBeInTheDocument();
});

test('creates one snapshot from the selected source', async () => {
  const { api } = createChronaApiMock();
  render(<NewBackupDialogHarness api={api} />);

  await userEvent.click(screen.getByRole('button', { name: /choose folder/i }));
  await userEvent.type(screen.getByLabelText(/backup name/i), 'Final submission');
  await userEvent.click(screen.getByRole('button', { name: /^start backup$/i }));

  await waitFor(() => {
    expect(api.createSnapshot).toHaveBeenCalledWith(
      expect.any(String),
      '/picked/source-folder',
      'Final submission',
    );
  });
  expect(api.ingestBlocks).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- --run src/features/home/HomePage.test.tsx src/features/backup/NewBackupDialog.test.tsx`

Expected: fails because new Home and backup components do not exist.

- [ ] **Step 3: Implement compact Home**

Render latest file count, logical size, unique block count, last snapshot time, recent source rows, recent snapshot rows, and one New Backup action. Preserve pin information inside the recent work list but remove separate large Continue Working, Pinned, and Recent Repository panels. Detailed file-kind composition links to Statistics.

- [ ] **Step 4: Implement New Backup dialog**

Dialog fields: source path, Choose File, Choose Folder, backup name. Default name is generated once when the dialog opens using `Backup YYYY-MM-DD HH-mm`. Start calls only `api.createSnapshot`.

Progress events map to:

```ts
{
  kind: 'backup',
  label: 'Creating backup',
  currentFile: progress.currentFile,
  processedBytes: progress.totalBytesProcessed,
  totalBytes: progress.totalBytes,
  phase: progress.phase,
}
```

On success, clear the active operation after a brief completed state, close the dialog, refresh Home, and expose `View snapshot` through a result toast or inline notice.

- [ ] **Step 5: Connect Home and backup to AppShell**

Both the top-bar New Backup button and Home action open the same dialog. Successful backup navigates to Snapshots only when the user chooses View Snapshot; it does not force navigation while progress is running.

- [ ] **Step 6: Run tests**

Run: `npm test -- --run src/features/home/HomePage.test.tsx src/features/backup/NewBackupDialog.test.tsx src/app/AppShell.test.tsx`

Expected: Home hierarchy, single createSnapshot call, conditional operation bar, completion, and error retention tests pass.

- [ ] **Step 7: Commit Task 6**

```bash
git add src/features/home src/features/backup src/app/AppShell.tsx src/app/OperationBar.tsx src/app/app-shell.css
git commit -m "feat: add home backup workflow"
```

---

### Task 7: Files Workspace Migration

**Files:**
- Create: `src/features/explorer/ExplorerPage.tsx`
- Create: `src/features/explorer/ExplorerPage.test.tsx`
- Modify: `src/features/explorer/FileInspectorPanel.tsx`
- Modify: `src/features/repository/RepositoryPage.tsx`
- Modify: `src/features/repository/RepositoryPage.css`
- Modify: `src/app/AppShell.tsx`

**Interfaces:**
- Consumes: `getRepositoryInventory`, `inspectRepositoryFile`, active repository path
- Reuses: `FileInspectorPanel`
- Produces: independent-scroll inventory list and inspector panes

- [ ] **Step 1: Write failing Files workspace tests**

```tsx
test('loads inventory and inspects a file in the same workspace', async () => {
  const { api } = createChronaApiMock();
  render(<ExplorerPage api={api} repositoryPath="/repo" />);

  await userEvent.click(screen.getByRole('button', { name: /refresh files/i }));
  await userEvent.click(await screen.findByRole('button', { name: /inspect presentation\/final-deck\.pptx/i }));

  expect(await screen.findByRole('heading', { name: 'final-deck.pptx' })).toBeInTheDocument();
  expect(screen.getByTestId('file-list-pane')).toHaveClass('workspace-pane-scroll');
  expect(screen.getByTestId('file-detail-pane')).toHaveClass('workspace-pane-scroll');
});
```

- [ ] **Step 2: Run test and confirm failure**

Run: `npm test -- --run src/features/explorer/ExplorerPage.test.tsx`

Expected: fails because `ExplorerPage` does not exist.

- [ ] **Step 3: Extract inventory state and handlers**

Move inventory report, search, kind/snapshot/source filters, selected path, request-id race protection, inspection loading/error, and refresh logic from `RepositoryPage` to `ExplorerPage`. Keep the same API calls and partial inspection failure behavior.

- [ ] **Step 4: Build the Files workspace layout**

Use one compact summary row, one filter row, and a `minmax(0, 42fr) minmax(360px, 58fr)` pane grid. The table body and inspector body use independent `overflow: auto`. Remove the surrounding DropPanel and repeated repository/path overview.

- [ ] **Step 5: Run Files regression tests**

Run: `npm test -- --run src/features/explorer/ExplorerPage.test.tsx src/features/explorer/FileInspectorPanel.test.tsx`

Expected: loading, filtering, selection, request race, missing/deleted state, and inspection failure tests pass.

- [ ] **Step 6: Commit Task 7**

```bash
git add src/features/explorer src/features/repository/RepositoryPage.tsx src/features/repository/RepositoryPage.css src/app/AppShell.tsx
git commit -m "feat: migrate files workspace"
```

---

### Task 8: Snapshots Workspace And Restore Dialog

**Files:**
- Create: `src/features/snapshots/SnapshotsPage.tsx`
- Create: `src/features/snapshots/RestoreSnapshotDialog.tsx`
- Create: `src/features/snapshots/SnapshotsPage.test.tsx`
- Modify: `src/features/snapshots/SnapshotPanel.tsx`
- Modify: `src/features/snapshots/SnapshotComparePanel.tsx`
- Modify: `src/features/repository/RepositoryPage.tsx`
- Modify: `src/app/AppShell.tsx`

**Interfaces:**
- Consumes: snapshot list/detail/compare/restore APIs
- Reuses: `SnapshotComparePanel` comparison model and formatting
- Produces: list/detail default workspace, compare mode, restore dialog

- [ ] **Step 1: Write failing snapshot workspace tests**

```tsx
test('keeps snapshot list visible while switching detail and compare views', async () => {
  const { api } = createChronaApiMock();
  render(<SnapshotsPage api={api} repositoryPath="/repo" />);

  await userEvent.click(await screen.findByRole('button', { name: /presentation ready/i }));
  expect(screen.getByRole('heading', { name: /presentation ready/i })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /compare snapshots/i }));
  expect(screen.getByLabelText(/base snapshot/i)).toBeInTheDocument();
  expect(screen.getByRole('list', { name: /snapshot list/i })).toBeInTheDocument();
});

test('restore opens a separate confirmation dialog', async () => {
  render(<SnapshotsPageHarness />);
  await userEvent.click(await screen.findByRole('button', { name: /presentation ready/i }));
  await userEvent.click(screen.getByRole('button', { name: /restore snapshot/i }));
  expect(screen.getByRole('dialog', { name: /restore presentation ready/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- --run src/features/snapshots/SnapshotsPage.test.tsx`

Expected: fails because SnapshotsPage and RestoreSnapshotDialog are missing.

- [ ] **Step 3: Extract list/detail state into `SnapshotsPage`**

Load snapshots when repository path changes, select the newest snapshot only after the list arrives, keep explicit user selection stable across refresh, and clear detail/compare/restore state on repository change.

The page-header `New backup` action opens the same `NewBackupDialog` created in Task 6; do not reintroduce a separate source/snapshot creation form.

- [ ] **Step 4: Separate restore and compare modes**

Restore dialog owns target path, native selector, confirmation, busy/error, and report. Snapshot page owns `mode: 'detail' | 'compare'`; list remains visible in both modes. Existing compare API and access event recording remain unchanged.

- [ ] **Step 5: Run snapshot regression tests**

Run: `npm test -- --run src/features/snapshots/SnapshotsPage.test.tsx src/features/snapshots/SnapshotPanel.test.tsx src/features/snapshots/SnapshotComparePanel.test.tsx`

Expected: list, detail, create-via-backup refresh, comparison, restore, and repository-switch reset tests pass.

- [ ] **Step 6: Commit Task 8**

```bash
git add src/features/snapshots src/features/repository/RepositoryPage.tsx src/app/AppShell.tsx
git commit -m "feat: migrate snapshots workspace"
```

---

### Task 9: Statistics And Settings Workspaces

**Files:**
- Create: `src/features/statistics/StatisticsPage.tsx`
- Create: `src/features/statistics/StatisticsPage.test.tsx`
- Create: `src/features/settings/SettingsPage.tsx`
- Create: `src/features/settings/SettingsPage.test.tsx`
- Modify: `src/features/statistics/StatisticsDashboard.tsx`
- Modify: `src/features/repository/RepositoryPage.tsx`
- Modify: `src/app/AppShell.tsx`
- Modify: `src/app/OperationBar.tsx`

**Interfaces:**
- Statistics consumes detailed statistics API and progress event
- Settings consumes repository library actions, compression mode update, integrity verification, theme action
- Integrity and compression remain existing backend calls; only their UI location changes

- [ ] **Step 1: Write failing workspace tests**

```tsx
test('statistics keeps the existing storage metrics without chapter chrome', async () => {
  const { api } = createChronaApiMock();
  render(<StatisticsPage api={api} repositoryPath="/repo" />);
  await userEvent.click(screen.getByRole('button', { name: /analyze repository/i }));

  expect(await screen.findByText('Dedup saved')).toBeInTheDocument();
  expect(screen.queryByText(/workspace section/i)).not.toBeInTheDocument();
});

test('settings contains repository, storage, health, and appearance sections', () => {
  render(<SettingsPageHarness />);
  for (const name of ['Repositories', 'Storage', 'Repository health', 'Appearance']) {
    expect(screen.getByRole('button', { name })).toBeInTheDocument();
  }
  expect(screen.queryByRole('button', { name: /^integrity$/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- --run src/features/statistics/StatisticsPage.test.tsx src/features/settings/SettingsPage.test.tsx`

Expected: fails because page components are missing.

- [ ] **Step 3: Implement StatisticsPage**

Move report/progress/loading/error state from `RepositoryPage`. Keep `StatisticsDashboard` metric formulas and rendering. Put Analyze/Refresh in the page header. Map statistics progress to `ActiveOperation` with bytes set to zero and phase text showing processed snapshots/blocks; `OperationBar` renders count-based progress when `totalBytes === 0`.

- [ ] **Step 4: Implement SettingsPage**

Settings sections use a compact local navigation. Repositories embeds registered repository management from Task 5. Storage shows current compression mode and Apply. Repository health shows Verify and the existing integrity report. Appearance shows the existing light/dark toggle. General navigation badges are not reintroduced.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- --run src/features/statistics/StatisticsPage.test.tsx src/features/statistics/StatisticsDashboard.test.tsx src/features/settings/SettingsPage.test.tsx`

Expected: statistics progress/report and settings repository/compression/integrity/theme tests pass.

- [ ] **Step 6: Commit Task 9**

```bash
git add src/features/statistics src/features/settings src/features/repository/RepositoryPage.tsx src/app/AppShell.tsx src/app/OperationBar.tsx
git commit -m "feat: add statistics and settings workspaces"
```

---

### Task 10: Remove Legacy Chapter UI And Add Desktop Window Adaptation

**Files:**
- Delete: `src/features/repository/RepositoryPage.tsx`
- Delete: `src/features/repository/RepositoryPage.css`
- Replace: `src/features/repository/RepositoryPage.test.tsx` with focused page/shell tests already introduced
- Modify: `src/App.tsx`
- Modify: `src/app/app-shell.css`
- Modify: component CSS files created in Tasks 5~9

**Interfaces:**
- Consumes all page components from Tasks 5~9
- Produces final desktop-only app shell with three width ranges
- Removes ChapterId, DropPanel, chapter tones, resource overview, path dock, idle command footer, Sources chapter, Review chapter, standalone Integrity chapter

- [ ] **Step 1: Add failing desktop layout assertions**

```tsx
test('uses desktop workspace landmarks without legacy chapter chrome', async () => {
  render(<AppShellHarness />);
  expect(screen.getByRole('banner')).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: /primary/i })).toBeInTheDocument();
  expect(screen.getByRole('main')).toBeInTheDocument();
  expect(screen.queryByText(/workspace section/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/workspace overview/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/current paths/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/no active ingest|no file processing/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run full UI tests before deletion**

Run: `npm test -- --run`

Expected: new shell tests pass; any remaining test importing `RepositoryPage` identifies behavior that must be moved before deletion.

- [ ] **Step 3: Move remaining behavior and delete legacy files**

Before deletion, account for every API action previously owned by RepositoryPage:

```text
repository create/open/switch -> useRepositoryLibrary
home summary/access actions   -> HomePage
source selection/ingest       -> NewBackupDialog using createSnapshot
snapshot actions              -> SnapshotsPage
inventory/inspection          -> ExplorerPage
statistics                    -> StatisticsPage
integrity/compression          -> SettingsPage
theme/view/progress            -> AppShell
```

Delete chapter tone/status logic and all related badge CSS. Preserve only styles still imported by extracted components, moving them into feature CSS files before deleting RepositoryPage.css.

- [ ] **Step 4: Add desktop width CSS**

```css
.app-shell { --sidebar-width: 232px; }

@media (max-width: 1439px) {
  .app-shell { --sidebar-width: 212px; }
}

@media (max-width: 1099px) {
  .app-shell { --sidebar-width: 184px; }
  .app-main { padding: 16px; }
  .explorer-workspace { grid-template-columns: minmax(260px, 36fr) minmax(360px, 64fr); }
}
```

Do not add mobile drawer rules. Use `min-width: 0`, `min-height: 0`, stable grid tracks, text ellipsis, and independent pane scroll so 960×640 remains usable.

- [ ] **Step 5: Run full frontend verification**

Run: `npm test -- --run`

Expected: all migrated and existing component tests pass.

Run: `npm run build`

Expected: TypeScript and Vite production build pass with no imports of RepositoryPage.

- [ ] **Step 6: Commit Task 10**

```bash
git add -A src
git commit -m "refactor: replace legacy chapter workspace"
```

---

### Task 11: Native Smoke Test, Visual QA, Documentation, And Archive

**Files:**
- Create: `docs/implemented/ui-usability-improvement.md`
- Modify: `docs/development-log.md`
- Modify: `docs/phase-status.md`
- Modify: `docs/project-plan.md`
- Modify: `docs/plans/README.md`
- Modify: `README.md`
- Modify: `README.ko.md`
- Move after completion: `docs/specs/0012-ui-usability-improvement.md` to `docs/archive/specs/0012-ui-usability-improvement.md`
- Move after completion: `docs/plans/phase-9-ui-usability-improvement.md` to `docs/archive/plans/phase-9-ui-usability-improvement.md`

**Interfaces:**
- Verifies all Phase 9 completion criteria
- Produces final screenshots and implementation record

- [ ] **Step 1: Run format, Rust, frontend, and build verification**

```bash
cargo fmt --all -- --check
cargo test
npm test -- --run
npm run build
git diff --check
```

Expected: every command exits 0; Rust output includes Phase 9 registry/library tests; Vitest includes shell, library, backup, files, snapshots, statistics, and settings tests.

- [ ] **Step 2: Run native macOS development smoke test**

Run: `npm run tauri dev`

Verify in the native window:

1. Empty app creates a repository under the macOS app data location.
2. Custom location creates one child repository.
3. Existing repository registers without moving files.
4. Last active repository reopens after app restart.
5. New Backup creates one snapshot and shows progress only while active.
6. Files, Snapshots, Statistics, Settings retain existing functionality.
7. Remove from Chrona leaves repository files on disk.

- [ ] **Step 3: Capture desktop visual QA states**

Using the approved Playwright fallback and the actual production components with deterministic API fixtures, capture and inspect:

```text
960x640-light-home.png
960x640-dark-files.png
1100x800-light-snapshots.png
1100x800-dark-settings.png
1440x900-light-statistics.png
1440x900-dark-home.png
```

Reject any screenshot with overlap, blank panes, clipped commands, accidental horizontal page scroll, idle progress bar, or legacy status badges. Windows native smoke testing must repeat 960×640 and 1100×800 at 100% and 125% display scaling when a Windows environment is available; if unavailable, document that gap without claiming Windows native verification.

- [ ] **Step 4: Verify keyboard and zoom behavior**

Check Tab/Shift+Tab order through top bar, primary navigation, dialogs, Files list/detail, Snapshot list/detail, and Settings. Confirm visible focus, Escape closes dialogs/menus, focus returns to the opening control, and browser 200% zoom does not overlap core commands.

- [ ] **Step 5: Write implementation documentation**

`docs/implemented/ui-usability-improvement.md` must record:

- repository registry location and atomic write behavior
- platform default repository location
- create/register/switch/relink/remove semantics
- final AppShell and page ownership
- New Backup call path through `createSnapshot`
- desktop width ranges and minimum window size
- retained limitations, including no mobile UI and no physical repository deletion
- exact final test counts and native verification environments

- [ ] **Step 6: Update status documents and archive completed plan/spec**

Mark Phase 9 implemented in phase status and project plan, append final verification to development log, update README screenshots/feature description, move 0012 spec and this plan to archive, and update `docs/plans/README.md` so no completed file remains active.

- [ ] **Step 7: Commit documentation and archive**

```bash
git add README.md README.ko.md docs
git commit -m "docs: record phase 9 ui implementation"
```

- [ ] **Step 8: Final clean-tree verification**

Run: `git status --short --branch`

Expected: the feature branch tracks its remote with no uncommitted files. Push only after all prior verification output has been reviewed.

---

## Execution Checkpoints

- Checkpoint A after Task 3: registry core, commands, and TypeScript contract are complete; existing UI remains unchanged.
- Checkpoint B after Task 6: new shell, repository bootstrap, Home, and New Backup are usable end to end.
- Checkpoint C after Task 9: all existing feature surfaces are available in the new navigation.
- Checkpoint D after Task 10: legacy chapter UI is deleted and frontend regression is green.
- Checkpoint E after Task 11: native/visual verification and documentation are complete.
