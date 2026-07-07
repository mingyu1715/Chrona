import { type ReactNode, useState } from 'react';

import type { ChronaApi } from '../shared/api/chronaApi';
import type { Snapshot } from '../shared/types/chrona';
import { NewBackupDialog } from '../features/backup/NewBackupDialog';
import { ExplorerPage } from '../features/explorer/ExplorerPage';
import { HomePage } from '../features/home/HomePage';
import { RepositoryLibraryMenu } from '../features/repository-library/RepositoryLibraryMenu';
import { RepositorySetupDialog } from '../features/repository-library/RepositorySetupDialog';
import { SnapshotsPage } from '../features/snapshots/SnapshotsPage';
import { AppSidebar, type AppView } from './AppSidebar';
import { AppTopBar, type ThemeMode } from './AppTopBar';
import { OperationBar, type ActiveOperation } from './OperationBar';
import { useRepositoryLibrary } from './useRepositoryLibrary';
import './app-shell.css';

interface AppShellProps {
  children: ReactNode | ((activeView: AppView) => ReactNode);
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
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [repositoryMenuOpen, setRepositoryMenuOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [internalOperation, setInternalOperation] = useState<ActiveOperation | null>(null);
  const [completedSnapshot, setCompletedSnapshot] = useState<Snapshot | null>(null);
  const [homeRefreshKey, setHomeRefreshKey] = useState(0);
  const repositoryLibrary = useRepositoryLibrary(api);
  const content = typeof children === 'function' ? children(activeView) : children;
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
  const showInitialSetup = Boolean(
    api && !repositoryLibrary.loading && repositoryLibrary.library && !hasRepository,
  );
  const newBackupAction = api
    ? () => {
        if (hasRepository) {
          setBackupOpen(true);
          onNewBackup?.();
        }
        else setSetupOpen(true);
      }
    : onNewBackup;

  let mainContent = content;
  if (api && repositoryLibrary.activeRepository && activeView === 'home') {
    mainContent = (
      <HomePage
        api={api}
        repositoryPath={repositoryLibrary.activeRepository.registration.path}
        refreshKey={homeRefreshKey}
        onNewBackup={() => setBackupOpen(true)}
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
        onNewBackup={() => setBackupOpen(true)}
      />
    );
  }

  return (
    <div className="app-shell" data-theme={theme} data-testid="app-shell">
      <AppTopBar
        theme={theme}
        repositorySwitcher={repositorySwitcher}
        onNewBackup={newBackupAction}
        onToggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
        onOpenSettings={() => setActiveView('settings')}
      />
      <AppSidebar activeView={activeView} onViewChange={setActiveView} />
      <main className="app-shell__content" data-active-view={activeView}>
        {api && repositoryLibrary.loading && !repositoryLibrary.library ? (
          <div className="app-shell__bootstrap" role="status">Opening repository...</div>
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
      {api && backupOpen && repositoryLibrary.activeRepository && (
        <NewBackupDialog
          api={api}
          repositoryPath={repositoryLibrary.activeRepository.registration.path}
          onClose={() => setBackupOpen(false)}
          onOperationChange={setInternalOperation}
          onCompleted={(snapshot) => {
            setCompletedSnapshot(snapshot);
            setHomeRefreshKey((current) => current + 1);
          }}
        />
      )}
      {completedSnapshot && (
        <div className="app-shell__notice" role="status">
          <span>Backup complete: <strong>{completedSnapshot.name}</strong></span>
          <button
            type="button"
            onClick={() => {
              setActiveView('snapshots');
              setCompletedSnapshot(null);
            }}
          >
            View snapshot
          </button>
          <button
            className="app-shell__notice-close"
            type="button"
            aria-label="Dismiss backup result"
            onClick={() => setCompletedSnapshot(null)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

export type { ActiveOperation, AppView };
