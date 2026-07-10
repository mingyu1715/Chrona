import { BarChart3, Clock3, Folder, Pin, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { ChronaApi } from '../../shared/api/chronaApi';
import { useI18n } from '../../shared/i18n/I18nProvider';
import type { BackupEntryRequest } from '../backup/NewBackupDialog';
import type {
  AccessNode,
  BackupSource,
  HomeSummary,
  RepositoryStatisticsOverview,
} from '../../shared/types/chrona';
import './home-page.css';

interface HomePageProps {
  api: ChronaApi;
  repositoryPath: string;
  refreshKey?: number;
  onNewBackup: (request: BackupEntryRequest) => void;
  onOpenStatistics: () => void;
  onSelectSource?: (sourceId: string, target: 'files' | 'snapshots') => void;
}

export function HomePage({
  api,
  repositoryPath,
  refreshKey = 0,
  onNewBackup,
  onOpenStatistics,
  onSelectSource,
}: HomePageProps) {
  const { t, formatBytes, formatDateTime, formatNumber } = useI18n();
  const [home, setHome] = useState<HomeSummary | null>(null);
  const [overview, setOverview] = useState<RepositoryStatisticsOverview | null>(null);
  const [sources, setSources] = useState<BackupSource[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);

    Promise.all([
      api.getHomeSummary(repositoryPath),
      api.getRepositoryStatisticsOverview(repositoryPath),
      api.listSources(repositoryPath),
    ]).then(([nextHome, nextOverview, sourceIndex]) => {
      if (!active) return;
      setHome(nextHome);
      setOverview(nextOverview);
      setSources(sourceIndex.sources);
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : String(caught));
    });

    return () => {
      active = false;
    };
  }, [api, repositoryPath, refreshKey]);

  const recentItems = useMemo(() => {
    if (!home) return [];
    const items = new Map<string, AccessNode>();
    for (const item of [...home.recentSources, ...home.recentSnapshots]) {
      items.set(item.key, item);
    }
    for (const pinned of home.pinned) {
      const recent = items.get(pinned.key);
      items.set(pinned.key, recent ? { ...recent, pinned: true } : pinned);
    }
    return [...items.values()].slice(0, 8);
  }, [home]);
  const recentSourcePath = home?.recentSources.find((item) => item.path)?.path ?? undefined;
  const backupLabel = !overview
    ? t('backup.new')
    : !overview.hasSnapshot
      ? t('backup.first')
      : recentSourcePath ? t('backup.repeat') : t('backup.new');

  function openBackup() {
    if (!overview?.hasSnapshot) {
      onNewBackup({ entryPoint: 'first-backup' });
      return;
    }
    onNewBackup({
      entryPoint: 'repeat',
      ...(recentSourcePath ? { initialSourcePath: recentSourcePath } : {}),
    });
  }

  return (
    <div className="home-page">
      <header className="workspace-header">
        <div>
          <h1>{t('nav.home')}</h1>
          <p>{repositoryPath}</p>
        </div>
        <button className="workspace-primary-action" type="button" onClick={openBackup}>
          <Plus size={17} aria-hidden="true" />
          {backupLabel}
        </button>
      </header>

      {error && <p className="workspace-error" role="alert">{error}</p>}

      <section className="home-overview" aria-labelledby="home-overview-title">
        <div className="home-overview__heading">
          <div>
            <span>{t('home.currentRepository')}</span>
            <h2 id="home-overview-title">{t('home.storageOverview')}</h2>
          </div>
          <button type="button" onClick={onOpenStatistics}>
            <BarChart3 size={16} aria-hidden="true" />
            {t('home.viewStatistics')}
          </button>
        </div>

        <dl className="home-overview__metrics">
          <div>
            <dt>{t('common.files')}</dt>
            <dd>{overview ? formatNumber(overview.latestFileCount) : '-'}</dd>
          </div>
          <div>
            <dt>{t('common.logicalSize')}</dt>
            <dd>{overview ? formatBytes(overview.latestLogicalBytes) : '-'}</dd>
          </div>
          <div>
            <dt>{t('common.uniqueBlocks')}</dt>
            <dd>{overview ? formatNumber(overview.latestUniqueBlockCount) : '-'}</dd>
          </div>
          <div>
            <dt>{t('home.lastBackup')}</dt>
            <dd>{overview?.latestSnapshotCreatedAt ? formatDateTime(overview.latestSnapshotCreatedAt) : t('common.noBackups')}</dd>
          </div>
        </dl>
      </section>

      <section className="home-sources" aria-labelledby="home-sources-title">
        <div className="home-recent__heading">
          <h2 id="home-sources-title">{t('sources.title')}</h2>
          <span>{t('sources.count', { count: sources.length })}</span>
        </div>
        {sources.length > 0 ? (
          <ul>
            {sources.map((source) => (
              <SourceItem
                key={source.id}
                source={source}
                onOpen={() => onSelectSource?.(source.id, 'snapshots')}
                onBackup={() => onNewBackup({
                  entryPoint: 'repeat',
                  initialSourcePath: source.path,
                })}
              />
            ))}
          </ul>
        ) : (
          <div className="home-recent__empty">
            <Folder size={19} aria-hidden="true" />
            <span>{t('sources.noSources')}</span>
          </div>
        )}
      </section>

      <section className="home-recent" aria-labelledby="home-recent-title">
        <div className="home-recent__heading">
          <h2 id="home-recent-title">{t('home.recentWork')}</h2>
          <span>{t('home.itemCount', { count: recentItems.length })}</span>
        </div>
        {recentItems.length > 0 ? (
          <ul>
            {recentItems.map((item) => <RecentItem key={item.key} item={item} />)}
          </ul>
        ) : (
          <div className="home-recent__empty">
            <Clock3 size={19} aria-hidden="true" />
            <span>{t('home.noRecent')}</span>
          </div>
        )}
      </section>
    </div>
  );
}

function SourceItem({
  source,
  onOpen,
  onBackup,
}: {
  source: BackupSource;
  onOpen: () => void;
  onBackup: () => void;
}) {
  const { t, formatDateTime, formatNumber } = useI18n();
  const statusLabel = source.status === 'missing'
    ? t('sources.status.missing')
    : t('sources.status.available');

  return (
    <li className="home-source">
      <button
        className="home-source__main"
        type="button"
        aria-label={t('sources.openSnapshots', { name: source.displayName })}
        onClick={onOpen}
      >
        <span className="home-recent__icon" aria-hidden="true">
          <Folder size={17} />
        </span>
        <span className="home-source__label">
          <strong>{source.displayName}</strong>
          <small>{source.path}</small>
        </span>
        <span className="home-source__meta">
          <span data-status={source.status}>{statusLabel}</span>
          <small>
            {source.latestSnapshotAt
              ? formatDateTime(source.latestSnapshotAt)
              : t('common.noBackups')}
          </small>
        </span>
        <span className="home-source__count">
          {t('sources.snapshotCount', { count: formatNumber(source.snapshotCount) })}
        </span>
      </button>
      <button className="home-source__backup" type="button" onClick={onBackup}>
        <Plus size={15} aria-hidden="true" />
        {t('sources.backupSource', { name: source.displayName })}
      </button>
    </li>
  );
}

function RecentItem({ item }: { item: AccessNode }) {
  const { t, formatDateTime } = useI18n();

  return (
    <li>
      <span className="home-recent__icon" aria-hidden="true">
        {item.kind === 'snapshot' ? <Clock3 size={17} /> : <Folder size={17} />}
      </span>
      <span className="home-recent__label">
        <strong>{item.label}</strong>
        <small>{item.path ?? item.lastAction}</small>
      </span>
      <time dateTime={item.lastAccessedAt}>{formatDateTime(item.lastAccessedAt)}</time>
      {item.pinned && <Pin size={15} aria-label={t('common.pinned')} />}
    </li>
  );
}
