import { ArchiveRestore, GitCompare, Plus, RefreshCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { ChronaApi } from '../../shared/api/chronaApi';
import { useI18n } from '../../shared/i18n/I18nProvider';
import type { Snapshot, SnapshotIndexItem } from '../../shared/types/chrona';
import { RestoreSnapshotDialog } from './RestoreSnapshotDialog';
import { SnapshotComparePanel } from './SnapshotComparePanel';
import './snapshots-page.css';

interface SnapshotsPageProps {
  api: ChronaApi;
  repositoryPath: string;
  onNewBackup: () => void;
}

export function SnapshotsPage({ api, repositoryPath, onNewBackup }: SnapshotsPageProps) {
  const { t, formatBytes, formatDateTime, formatNumber } = useI18n();
  const [snapshots, setSnapshots] = useState<SnapshotIndexItem[]>([]);
  const [selected, setSelected] = useState<Snapshot | null>(null);
  const [mode, setMode] = useState<'detail' | 'compare'>('detail');
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedId = useRef<string | null>(null);

  async function openSnapshot(id: string) {
    selectedId.current = id;
    setLoading(true);
    setError(null);
    try {
      const detail = await api.getSnapshot(repositoryPath, id);
      if (selectedId.current === id) setSelected(detail);
      void api.recordAccessEvent(repositoryPath, {
        key: `snapshot:${detail.id}`,
        kind: 'snapshot',
        label: detail.name,
        path: null,
        repositoryId: null,
        snapshotId: detail.id,
        baseSnapshotId: null,
        targetSnapshotId: null,
        action: 'snapshot_opened',
        accessedAt: new Date().toISOString(),
      }).catch(() => undefined);
    } catch (caught) {
      if (selectedId.current === id) setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (selectedId.current === id) setLoading(false);
    }
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const items = await api.listSnapshots(repositoryPath);
      setSnapshots(items);
      const nextId = items.some((item) => item.id === selectedId.current)
        ? selectedId.current
        : items[0]?.id ?? null;
      if (nextId) await openSnapshot(nextId);
      else {
        selectedId.current = null;
        setSelected(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setLoading(false);
    }
  }

  useEffect(() => {
    selectedId.current = null;
    setSnapshots([]);
    setSelected(null);
    setMode('detail');
    setRestoreOpen(false);
    void refresh();
  }, [api, repositoryPath]);

  return (
    <div className="snapshots-page">
      <header className="workspace-header snapshots-page__header">
        <div>
          <h1>{t('snapshots.title')}</h1>
          <p>{t('snapshots.description')}</p>
        </div>
        <div className="snapshots-page__header-actions">
          <button type="button" disabled={loading} onClick={() => void refresh()}>
            <RefreshCcw size={16} aria-hidden="true" />
            {t('common.refresh')}
          </button>
          <button className="workspace-primary-action" type="button" onClick={onNewBackup}>
            <Plus size={16} aria-hidden="true" />
            {t('backup.new')}
          </button>
        </div>
      </header>

      {error && <p className="workspace-error" role="alert">{error}</p>}

      <div className="snapshots-workspace">
        <aside className="snapshots-list workspace-pane-scroll">
          <div className="snapshots-list__heading">
            <strong>{t('snapshots.history')}</strong>
            <span>{formatNumber(snapshots.length)}</span>
          </div>
          <ul aria-label={t('snapshots.list')}>
            {snapshots.map((snapshot) => (
              <li key={snapshot.id}>
                <button
                  type="button"
                  aria-label={t('snapshots.open', { name: snapshot.name })}
                  aria-current={selected?.id === snapshot.id ? 'true' : undefined}
                  onClick={() => {
                    setMode('detail');
                    void openSnapshot(snapshot.id);
                  }}
                >
                  <strong>{snapshot.name}</strong>
                  <span>{formatDateTime(snapshot.createdAt)}</span>
                  <small>{t('files.fileCount', { count: formatNumber(snapshot.fileCount) })} · {formatBytes(snapshot.totalOriginalBytes)}</small>
                </button>
              </li>
            ))}
          </ul>
          {!loading && snapshots.length === 0 && <p>{t('snapshots.noSnapshots')}</p>}
        </aside>

        <main className="snapshots-detail workspace-pane-scroll">
          {mode === 'compare' ? (
            <SnapshotComparePanel api={api} repositoryPath={repositoryPath} snapshots={snapshots} />
          ) : selected ? (
            <SnapshotDetail
              snapshot={selected}
              onCompare={() => setMode('compare')}
              onRestore={() => setRestoreOpen(true)}
            />
          ) : (
            <div className="snapshots-detail__empty">{loading ? t('snapshots.loadingHistory') : t('snapshots.selectSnapshot')}</div>
          )}
        </main>
      </div>

      {restoreOpen && selected && (
        <RestoreSnapshotDialog
          api={api}
          repositoryPath={repositoryPath}
          snapshot={selected}
          onClose={() => setRestoreOpen(false)}
        />
      )}
    </div>
  );
}

function SnapshotDetail({
  snapshot,
  onCompare,
  onRestore,
}: {
  snapshot: Snapshot;
  onCompare: () => void;
  onRestore: () => void;
}) {
  const { t, formatBytes, formatDateTime, formatNumber } = useI18n();

  return (
    <article className="snapshot-detail-view">
      <header>
        <div>
          <span>{formatDateTime(snapshot.createdAt)}</span>
          <h2>{snapshot.name}</h2>
          <p>{snapshot.sourceRoot}</p>
        </div>
        <div>
          <button type="button" onClick={onCompare}><GitCompare size={16} aria-hidden="true" />{t('snapshots.compare')}</button>
          <button type="button" onClick={onRestore}><ArchiveRestore size={16} aria-hidden="true" />{t('snapshots.restoreSnapshot')}</button>
        </div>
      </header>
      <dl>
        <div><dt>{t('common.files')}</dt><dd>{formatNumber(snapshot.summary.fileCount)}</dd></div>
        <div><dt>{t('common.logicalSize')}</dt><dd>{formatBytes(snapshot.summary.totalOriginalBytes)}</dd></div>
        <div><dt>{t('snapshots.newStorage')}</dt><dd>{formatBytes(snapshot.summary.newStoredBytes)}</dd></div>
        <div><dt>{t('snapshots.reusedBlocks')}</dt><dd>{formatNumber(snapshot.summary.reusedBlockCount)}</dd></div>
      </dl>
      <section>
        <h3>{t('common.files')}</h3>
        {snapshot.files.length > 0 ? (
          <ul>{snapshot.files.map((file) => <li key={file.relativePath}><span>{file.relativePath}</span><small>{formatBytes(file.sizeBytes)}</small></li>)}</ul>
        ) : <p>{t('snapshots.noFiles')}</p>}
      </section>
    </article>
  );
}
