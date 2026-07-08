import { BarChart3, Clock3, Folder, Pin, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { ChronaApi } from '../../shared/api/chronaApi';
import type { BackupEntryRequest } from '../backup/NewBackupDialog';
import type {
  AccessNode,
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
}

export function HomePage({
  api,
  repositoryPath,
  refreshKey = 0,
  onNewBackup,
  onOpenStatistics,
}: HomePageProps) {
  const [home, setHome] = useState<HomeSummary | null>(null);
  const [overview, setOverview] = useState<RepositoryStatisticsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);

    Promise.all([
      api.getHomeSummary(repositoryPath),
      api.getRepositoryStatisticsOverview(repositoryPath),
    ]).then(([nextHome, nextOverview]) => {
      if (!active) return;
      setHome(nextHome);
      setOverview(nextOverview);
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
    ? 'New Backup'
    : !overview.hasSnapshot
      ? 'Create first backup'
      : recentSourcePath ? 'Back up again' : 'New Backup';

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
          <h1>Home</h1>
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
            <span>Current repository</span>
            <h2 id="home-overview-title">Storage overview</h2>
          </div>
          <button type="button" onClick={onOpenStatistics}>
            <BarChart3 size={16} aria-hidden="true" />
            View statistics
          </button>
        </div>

        <dl className="home-overview__metrics">
          <div>
            <dt>Files</dt>
            <dd>{overview?.latestFileCount.toLocaleString() ?? '-'}</dd>
          </div>
          <div>
            <dt>Logical size</dt>
            <dd>{overview ? formatBytes(overview.latestLogicalBytes) : '-'}</dd>
          </div>
          <div>
            <dt>Unique blocks</dt>
            <dd>{overview?.latestUniqueBlockCount.toLocaleString() ?? '-'}</dd>
          </div>
          <div>
            <dt>Last backup</dt>
            <dd>{formatDate(overview?.latestSnapshotCreatedAt ?? null)}</dd>
          </div>
        </dl>
      </section>

      <section className="home-recent" aria-labelledby="home-recent-title">
        <div className="home-recent__heading">
          <h2 id="home-recent-title">Recent work</h2>
          <span>{recentItems.length} items</span>
        </div>
        {recentItems.length > 0 ? (
          <ul>
            {recentItems.map((item) => <RecentItem key={item.key} item={item} />)}
          </ul>
        ) : (
          <div className="home-recent__empty">
            <Clock3 size={19} aria-hidden="true" />
            <span>No recent sources or snapshots</span>
          </div>
        )}
      </section>
    </div>
  );
}

function RecentItem({ item }: { item: AccessNode }) {
  return (
    <li>
      <span className="home-recent__icon" aria-hidden="true">
        {item.kind === 'snapshot' ? <Clock3 size={17} /> : <Folder size={17} />}
      </span>
      <span className="home-recent__label">
        <strong>{item.label}</strong>
        <small>{item.path ?? item.lastAction}</small>
      </span>
      <time dateTime={item.lastAccessedAt}>{formatDate(item.lastAccessedAt)}</time>
      {item.pinned && <Pin size={15} aria-label="Pinned" />}
    </li>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
}

function formatDate(value: string | null) {
  if (!value) return 'No backups';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
