import { type ReactNode, useEffect, useState } from 'react';

import type { ChronaApi } from '../shared/api/chronaApi';
import { useI18n } from '../shared/i18n/I18nProvider';
import { useAppPreferences } from '../shared/preferences/AppPreferencesProvider';
import type { Snapshot } from '../shared/types/chrona';
import {
  type BackupEntryRequest,
  NewBackupDialog,
} from '../features/backup/NewBackupDialog';
import { ExplorerPage } from '../features/explorer/ExplorerPage';
import { HomePage } from '../features/home/HomePage';
import { RepositoryLibraryMenu } from '../features/repository-library/RepositoryLibraryMenu';
import { RepositorySetupDialog } from '../features/repository-library/RepositorySetupDialog';
import { SnapshotsPage } from '../features/snapshots/SnapshotsPage';
import { StatisticsPage } from '../features/statistics/StatisticsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { AppSidebar, type AppView } from './AppSidebar';
import { AppTopBar, type ThemeMode } from './AppTopBar';
import { OperationBar, type ActiveOperation } from './OperationBar';
import { RepositoryRequiredState } from './RepositoryRequiredState';
import { useRepositoryLibrary } from './useRepositoryLibrary';
import '../styles/component-workspaces.css';
import './app-shell.css';

interface AppShellProps {
  children?: ReactNode | ((activeView: AppView) => ReactNode);
  api?: ChronaApi;
  initialView?: AppView;
  repositorySwitcher?: ReactNode;
  activeOperation?: ActiveOperation | null;
  onNewBackup?: () => void;
}

export function AppShell({
  children,
  api,
  initialView = 'home',
  repositorySwitcher: repositorySwitcherSlot,
  activeOperation = null,
  onNewBackup,
}: AppShellProps) {
  const [activeView, setActiveView] = useState<AppView>(initialView);
  const { preferences, setTheme } = useAppPreferences();
  const [systemTheme, setSystemTheme] = useState<ThemeMode>(getSystemTheme);
  const [repositoryMenuOpen, setRepositoryMenuOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [backupRequest, setBackupRequest] = useState<BackupEntryRequest | null>(null);
  const [internalOperation, setInternalOperation] = useState<ActiveOperation | null>(null);
  const [completedSnapshot, setCompletedSnapshot] = useState<Snapshot | null>(null);
  const [homeRefreshKey, setHomeRefreshKey] = useState(0);
  const repositoryLibrary = useRepositoryLibrary(api);
  const { t } = useI18n();
  const theme = preferences.theme === 'system' ? systemTheme : preferences.theme;
  const toggleTheme = () => void setTheme(theme === 'light' ? 'dark' : 'light');
  const content = typeof children === 'function' ? children(activeView) : children;

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemTheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const repositorySwitcher = api ? (
    <RepositoryLibraryMenu
      api={api}
      controller={repositoryLibrary}
      open={repositoryMenuOpen}
      onOpenChange={setRepositoryMenuOpen}
      onNewRepository={() => {
        setRepositoryMenuOpen(false);
        setSetupOpen(true);
      }}
      onManageRepositories={() => {
        setRepositoryMenuOpen(false);
        setActiveView('settings');
      }}
    />
  ) : repositorySwitcherSlot;

  const hasRepository = Boolean(repositoryLibrary.activeRepository);
  const repositoryUnavailable = Boolean(
    api && !repositoryLibrary.loading && repositoryLibrary.library && !hasRepository,
  );
  const disconnected = Boolean(
    repositoryUnavailable
    && repositoryLibrary.library?.repositories.length
    && repositoryLibrary.library.repositories.every(
      (repository) => repository.connectionState === 'disconnected',
    ),
  );
  const showInitialSetup = repositoryUnavailable && activeView === 'home';
  const newBackupAction = api
    ? () => {
        if (hasRepository) {
          setBackupRequest({ entryPoint: 'global' });
          onNewBackup?.();
        }
        else if (disconnected) setRepositoryMenuOpen(true);
        else {
          setActiveView('home');
          setSetupOpen(true);
        }
      }
    : onNewBackup;
  const primaryActionLabel = !api || hasRepository
    ? t('backup.new')
    : disconnected ? t('repository.locate') : t('repository.setup');

  async function addExistingRepository() {
    if (!api) return;
    const path = await api.selectExistingRepositoryPath();
    if (path) await repositoryLibrary.registerExisting(path);
  }

  async function relinkRepository(repositoryId: string) {
    if (!api) return;
    const path = await api.selectExistingRepositoryPath();
    if (path) await repositoryLibrary.relink(repositoryId, path);
  }

  let mainContent = content;
  if (api && activeView === 'settings') {
    mainContent = (
      <SettingsPage
        api={api}
        repository={repositoryLibrary.activeRepository}
        library={repositoryLibrary.library ?? { activeRepositoryId: null, repositories: [] }}
        onCreateRepository={() => setSetupOpen(true)}
        onAddExistingRepository={() => void addExistingRepository()}
        onSelectRepository={(repositoryId) => void repositoryLibrary.activate(repositoryId)}
        onRenameRepository={(repositoryId, displayName) =>
          void repositoryLibrary.rename(repositoryId, displayName)}
        onRelinkRepository={(repositoryId) => void relinkRepository(repositoryId)}
        onRemoveRepository={(repositoryId) => void repositoryLibrary.remove(repositoryId)}
      />
    );
  } else if (api && repositoryLibrary.activeRepository && activeView === 'home') {
    mainContent = (
      <HomePage
        api={api}
        repositoryPath={repositoryLibrary.activeRepository.registration.path}
        refreshKey={homeRefreshKey}
        onNewBackup={setBackupRequest}
        onOpenStatistics={() => setActiveView('statistics')}
      />
    );
  } else if (api && repositoryLibrary.activeRepository && activeView === 'files') {
    mainContent = (
      <ExplorerPage
        api={api}
        repositoryPath={repositoryLibrary.activeRepository.registration.path}
      />
    );
  } else if (api && repositoryLibrary.activeRepository && activeView === 'snapshots') {
    mainContent = (
      <SnapshotsPage
        api={api}
        repositoryPath={repositoryLibrary.activeRepository.registration.path}
        onNewBackup={() => setBackupRequest({ entryPoint: 'global' })}
      />
    );
  } else if (api && repositoryLibrary.activeRepository && activeView === 'statistics') {
    mainContent = <StatisticsPage api={api} repositoryPath={repositoryLibrary.activeRepository.registration.path} onOperationChange={setInternalOperation} />;
  }
  if (api && repositoryUnavailable && activeView !== 'home' && activeView !== 'settings') {
    mainContent = (
      <RepositoryRequiredState
        workspace={activeView === 'files'
          ? t('nav.files')
          : activeView === 'snapshots'
            ? t('nav.snapshots')
            : activeView === 'statistics'
              ? t('nav.statistics')
              : t('nav.settings')}
        disconnected={disconnected}
        onCreateRepository={() => setSetupOpen(true)}
        onAddExistingRepository={() => void addExistingRepository()}
        onLocateRepository={() => setRepositoryMenuOpen(true)}
      />
    );
  }

  return (
    <div className="app-shell" data-theme={theme} data-testid="app-shell">
      <AppTopBar
        theme={theme}
        repositorySwitcher={repositorySwitcher}
        onNewBackup={newBackupAction}
        primaryActionLabel={primaryActionLabel}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setActiveView('settings')}
      />
      <AppSidebar activeView={activeView} onViewChange={setActiveView} />
      <main className="app-shell__content" data-active-view={activeView}>
        {api && repositoryLibrary.loading && !repositoryLibrary.library ? (
          <div className="app-shell__bootstrap" role="status">{t('app.loadingRepository')}</div>
        ) : api && showInitialSetup ? (
          <RepositorySetupDialog api={api} controller={repositoryLibrary} />
        ) : mainContent}
      </main>
      <OperationBar operation={activeOperation ?? internalOperation} />
      {api && setupOpen && !showInitialSetup && (
        <RepositorySetupDialog
          api={api}
          controller={repositoryLibrary}
          canDismiss
          onDismiss={() => setSetupOpen(false)}
        />
      )}
      {api && backupRequest && repositoryLibrary.activeRepository && (
        <NewBackupDialog
          api={api}
          repositoryPath={repositoryLibrary.activeRepository.registration.path}
          entryPoint={backupRequest.entryPoint}
          initialSourcePath={backupRequest.initialSourcePath}
          onClose={() => setBackupRequest(null)}
          onOperationChange={setInternalOperation}
          onCompleted={(snapshot) => {
            setCompletedSnapshot(snapshot);
            setHomeRefreshKey((current) => current + 1);
          }}
        />
      )}
      {completedSnapshot && (
        <div className="app-shell__notice" role="status">
          <span>{t('app.backupComplete')} <strong>{completedSnapshot.name}</strong></span>
          <button
            type="button"
            onClick={() => {
              setActiveView('snapshots');
              setCompletedSnapshot(null);
            }}
          >
            {t('app.viewSnapshot')}
          </button>
          <button
            className="app-shell__notice-close"
            type="button"
            aria-label={t('app.dismissBackupResult')}
            onClick={() => setCompletedSnapshot(null)}
          >
            {t('common.close')}
          </button>
        </div>
      )}
    </div>
  );
}

export type { ActiveOperation, AppView };

function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
