import { type ReactNode, useEffect, useState } from 'react';

import type { ChronaApi } from '../shared/api/chronaApi';
import { useI18n } from '../shared/i18n/I18nProvider';
import { useAppPreferences } from '../shared/preferences/AppPreferencesProvider';
import type {
  RepositoryStatisticsProgress,
  RepositoryStatisticsReport,
  OriginalLocationRestoreReport,
  RestoreReport,
  Snapshot,
} from '../shared/types/chrona';
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

interface StatisticsAnalysisState {
  repositoryPath: string | null;
  report: RepositoryStatisticsReport | null;
  progress: RepositoryStatisticsProgress | null;
  loading: boolean;
  error: string | null;
}

const emptyStatisticsAnalysis: StatisticsAnalysisState = {
  repositoryPath: null,
  report: null,
  progress: null,
  loading: false,
  error: null,
};

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
  const [completedRestore, setCompletedRestore] = useState<RestoreReport | OriginalLocationRestoreReport | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [statisticsAnalysis, setStatisticsAnalysis] = useState<StatisticsAnalysisState>(emptyStatisticsAnalysis);
  const [homeRefreshKey, setHomeRefreshKey] = useState(0);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!api) return;
    let unlisten: (() => void) | undefined;
    let active = true;
    api.onBlockIngestProgress((progress) => {
      if (!active) return;
      setInternalOperation({
        kind: 'backup',
        label: t('backup.creating'),
        currentFile: progress.currentFile,
        processedBytes: progress.totalBytesProcessed,
        totalBytes: progress.totalBytes,
        phase: progress.phase,
      });
    }).then((cleanup) => {
      unlisten = cleanup;
    }).catch(() => undefined);

    return () => {
      active = false;
      unlisten?.();
    };
  }, [api, t]);

  useEffect(() => {
    if (!api) return;
    let unlisten: (() => void) | undefined;
    let active = true;
    api.onRepositoryStatisticsProgress((progress) => {
      if (!active) return;
      setStatisticsAnalysis((current) => ({
        ...current,
        progress,
      }));
      setInternalOperation(statisticsOperationFromProgress(progress, t));
    }).then((cleanup) => {
      unlisten = cleanup;
    }).catch(() => undefined);

    return () => {
      active = false;
      unlisten?.();
    };
  }, [api, t]);

  const activeRepositoryPath = repositoryLibrary.activeRepository?.registration.path ?? null;

  useEffect(() => {
    setStatisticsAnalysis((current) => {
      if (current.repositoryPath === activeRepositoryPath) return current;
      return { ...emptyStatisticsAnalysis, repositoryPath: activeRepositoryPath };
    });
    setSelectedSourceId(null);
  }, [activeRepositoryPath]);
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
  const displayedOperation = activeOperation ?? internalOperation;
  const repositoryWriteActive = displayedOperation?.kind === 'backup'
    || displayedOperation?.kind === 'restore';
  const newBackupAction = api
    ? () => {
        if (repositoryWriteActive) return;
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

  async function analyzeStatistics() {
    if (!api || !activeRepositoryPath) return;
    const repositoryPath = activeRepositoryPath;
    setStatisticsAnalysis((current) => ({
      repositoryPath,
      report: current.repositoryPath === repositoryPath ? current.report : null,
      progress: null,
      loading: true,
      error: null,
    }));
    setInternalOperation({
      kind: 'statistics',
      label: t('statistics.analyzing'),
      currentFile: null,
      processedBytes: 0,
      totalBytes: 0,
      phase: t('statistics.starting'),
      progressPercent: 0,
      amountText: t('statistics.starting'),
    });
    try {
      const report = await api.analyzeRepositoryStatistics(repositoryPath);
      setStatisticsAnalysis({
        repositoryPath,
        report,
        progress: null,
        loading: false,
        error: null,
      });
    } catch (caught) {
      setStatisticsAnalysis((current) => ({
        repositoryPath,
        report: current.repositoryPath === repositoryPath ? current.report : null,
        progress: null,
        loading: false,
        error: caught instanceof Error ? caught.message : String(caught),
      }));
    } finally {
      setInternalOperation((current) => current?.kind === 'statistics' ? null : current);
    }
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
        onNewBackup={(request) => {
          if (!repositoryWriteActive) setBackupRequest(request);
        }}
        onOpenStatistics={() => setActiveView('statistics')}
        onSelectSource={(sourceId, target) => {
          setSelectedSourceId(sourceId);
          setActiveView(target);
        }}
      />
    );
  } else if (api && repositoryLibrary.activeRepository && activeView === 'files') {
    mainContent = (
      <ExplorerPage
        api={api}
        repositoryPath={repositoryLibrary.activeRepository.registration.path}
        selectedSourceId={selectedSourceId}
        onSelectSourceId={setSelectedSourceId}
      />
    );
  } else if (api && repositoryLibrary.activeRepository && activeView === 'snapshots') {
    mainContent = (
      <SnapshotsPage
        api={api}
        repositoryPath={repositoryLibrary.activeRepository.registration.path}
        selectedSourceId={selectedSourceId}
        onSelectSourceId={setSelectedSourceId}
        onNewBackup={(request = { entryPoint: 'global' }) => {
          if (!repositoryWriteActive) setBackupRequest(request);
        }}
        onOperationChange={setInternalOperation}
        onRestoreCompleted={setCompletedRestore}
        onRestoreFailed={setOperationError}
      />
    );
  } else if (api && repositoryLibrary.activeRepository && activeView === 'statistics') {
    mainContent = (
      <StatisticsPage
        report={statisticsAnalysis.report}
        progress={statisticsAnalysis.progress}
        loading={statisticsAnalysis.loading}
        error={statisticsAnalysis.error}
        onAnalyze={() => void analyzeStatistics()}
      />
    );
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
        onNewBackup={repositoryWriteActive ? undefined : newBackupAction}
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
      <OperationBar operation={displayedOperation} />
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
            setOperationError(null);
            setCompletedSnapshot(snapshot);
            setSelectedSourceId(snapshot.sourceId ?? null);
            setHomeRefreshKey((current) => current + 1);
          }}
          onFailed={setOperationError}
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
      {completedRestore && (
        <div className="app-shell__notice" role="status">
          <span>{t('app.restoreComplete')} <strong>{restoreResultPath(completedRestore)}</strong></span>
          <button
            className="app-shell__notice-close"
            type="button"
            aria-label={t('app.dismissOperationResult')}
            onClick={() => setCompletedRestore(null)}
          >
            {t('common.close')}
          </button>
        </div>
      )}
      {operationError && (
        <div className="app-shell__notice app-shell__notice--error" role="alert">
          <span>{t('app.operationFailed')} <strong>{operationError}</strong></span>
          <button
            className="app-shell__notice-close"
            type="button"
            aria-label={t('app.dismissOperationResult')}
            onClick={() => setOperationError(null)}
          >
            {t('common.close')}
          </button>
        </div>
      )}
    </div>
  );
}

function restoreResultPath(report: RestoreReport | OriginalLocationRestoreReport) {
  return 'targetPath' in report ? report.targetPath : report.sourcePath;
}

export type { ActiveOperation, AppView };

function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function statisticsOperationFromProgress(
  progress: RepositoryStatisticsProgress,
  t: ReturnType<typeof useI18n>['t'],
): ActiveOperation {
  const blocks = progress.phase === 'blocks';
  const current = blocks ? progress.processedBlocks : progress.processedSnapshots;
  const total = blocks ? progress.totalBlocks : progress.totalSnapshots;
  const phase = blocks
    ? t('statistics.blocksProgress', { current, total })
    : t('statistics.snapshotsProgress', { current, total });
  return {
    kind: 'statistics',
    label: t('statistics.analyzing'),
    currentFile: null,
    processedBytes: 0,
    totalBytes: 0,
    phase,
    progressPercent: total > 0 ? Math.min(100, Math.round((current / total) * 100)) : undefined,
    amountText: phase,
  };
}
