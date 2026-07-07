import { type ReactNode, useState } from 'react';

import type { ChronaApi } from '../shared/api/chronaApi';
import { RepositoryLibraryMenu } from '../features/repository-library/RepositoryLibraryMenu';
import { RepositorySetupDialog } from '../features/repository-library/RepositorySetupDialog';
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
        if (hasRepository) onNewBackup?.();
        else setSetupOpen(true);
      }
    : onNewBackup;

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
        ) : content}
      </main>
      <OperationBar operation={activeOperation} />
      {api && setupOpen && !showInitialSetup && (
        <RepositorySetupDialog
          api={api}
          controller={repositoryLibrary}
          canDismiss
          onDismiss={() => setSetupOpen(false)}
        />
      )}
    </div>
  );
}

export type { ActiveOperation, AppView };
