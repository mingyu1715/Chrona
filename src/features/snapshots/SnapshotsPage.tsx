import { ArchiveRestore, GitCompare, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { ActiveOperation } from '../../app/OperationBar';
import type { ChronaApi } from '../../shared/api/chronaApi';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog';
import type { BackupEntryRequest } from '../backup/NewBackupDialog';
import type {
  BackupSource,
  OriginalLocationRestoreReport,
  RestoreReport,
  Snapshot,
  SnapshotIndexItem,
} from '../../shared/types/chrona';
import { RestoreSnapshotDialog } from './RestoreSnapshotDialog';
import { SnapshotComparePanel } from './SnapshotComparePanel';
import './snapshots-page.css';

interface SnapshotsPageProps {
  api: ChronaApi;
  repositoryPath: string;
  onNewBackup: (request?: BackupEntryRequest) => void;
  onOperationChange?: (operation: ActiveOperation | null) => void;
  onRestoreCompleted?: (report: RestoreReport | OriginalLocationRestoreReport) => void;
  onRestoreFailed?: (message: string) => void;
  selectedSourceId?: string | null;
  onSelectSourceId?: (sourceId: string | null) => void;
}

export function SnapshotsPage({
  api,
  repositoryPath,
  onNewBackup,
  onOperationChange,
  onRestoreCompleted,
  onRestoreFailed,
  selectedSourceId = null,
  onSelectSourceId,
}: SnapshotsPageProps) {
  const { t, formatBytes, formatDateTime, formatNumber } = useI18n();
  const [snapshots, setSnapshots] = useState<SnapshotIndexItem[]>([]);
  const [sources, setSources] = useState<BackupSource[]>([]);
  const [selected, setSelected] = useState<Snapshot | null>(null);
  const [mode, setMode] = useState<'detail' | 'compare'>('detail');
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [sourceRestoreCandidate, setSourceRestoreCandidate] = useState<Snapshot | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Snapshot | null>(null);
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
      const [items, sourceIndex] = await Promise.all([
        api.listSnapshots(repositoryPath),
        api.listSources(repositoryPath),
      ]);
      setSnapshots(items);
      setSources(sourceIndex.sources);
      const visibleItems = filterSnapshotsBySource(items, selectedSourceId);
      const nextId = visibleItems.some((item) => item.id === selectedId.current)
        ? selectedId.current
        : visibleItems[0]?.id ?? null;
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
    setSourceRestoreCandidate(null);
    setDeleteCandidate(null);
    void refresh();
  }, [api, repositoryPath, selectedSourceId]);

  const visibleSnapshots = useMemo(
    () => filterSnapshotsBySource(snapshots, selectedSourceId),
    [snapshots, selectedSourceId],
  );
  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const selectedSource = selectedSourceId ? sourceById.get(selectedSourceId) ?? null : null;
  const snapshotGroups = useMemo(
    () => groupSnapshotsBySource(visibleSnapshots, sourceById, selectedSourceId, t('sources.unassigned')),
    [visibleSnapshots, sourceById, selectedSourceId, t],
  );

  function startBackupFromCurrentContext() {
    if (selectedSource && selectedSource.status === 'available') {
      onNewBackup({
        entryPoint: 'repeat',
        initialSourcePath: selectedSource.path,
      });
      return;
    }
    onNewBackup({ entryPoint: 'global' });
  }

  async function deleteSnapshot(snapshot: Snapshot) {
    setLoading(true);
    setError(null);
    try {
      const remaining = await api.deleteSnapshot(repositoryPath, snapshot.id);
      const sourceIndex = await api.listSources(repositoryPath);
      setSnapshots(remaining);
      setSources(sourceIndex.sources);
      setDeleteCandidate(null);

      const nextVisible = filterSnapshotsBySource(remaining, selectedSourceId);
      const nextId = nextVisible[0]?.id ?? null;
      if (nextId) await openSnapshot(nextId);
      else {
        selectedId.current = null;
        setSelected(null);
        setLoading(false);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setLoading(false);
    }
  }

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
          <button className="workspace-primary-action" type="button" onClick={startBackupFromCurrentContext}>
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
            <span>{formatNumber(visibleSnapshots.length)}</span>
          </div>
          <label className="snapshots-source-filter">
            <span>{t('sources.filterLabel')}</span>
            <select value={selectedSourceId ?? 'all'} onChange={(event) => onSelectSourceId?.(event.target.value === 'all' ? null : event.target.value)}>
              <option value="all">{t('sources.allSources')}</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>{source.displayName}</option>
              ))}
            </select>
          </label>
          <ul aria-label={t('snapshots.list')}>
            {snapshotGroups.flatMap((group) => [
              <li className="snapshots-list__group" key={`${group.id}:group`}>
                <strong>{group.title}</strong>
                <span>{t('sources.snapshotCount', { count: formatNumber(group.snapshots.length) })}</span>
              </li>,
              ...group.snapshots.map((snapshot) => (
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
              )),
            ])}
          </ul>
          {!loading && visibleSnapshots.length === 0 && <p>{t('snapshots.noSnapshots')}</p>}
        </aside>

        <main className="snapshots-detail workspace-pane-scroll">
          {mode === 'compare' ? (
            <SnapshotComparePanel api={api} repositoryPath={repositoryPath} snapshots={visibleSnapshots} />
          ) : selected ? (
            <SnapshotDetail
              snapshot={selected}
              onCompare={() => setMode('compare')}
              onRestore={() => setRestoreOpen(true)}
              onRestoreToSource={selected.sourceId ? () => setSourceRestoreCandidate(selected) : undefined}
              onDelete={() => setDeleteCandidate(selected)}
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
          onOperationChange={onOperationChange}
          onCompleted={onRestoreCompleted}
          onFailed={onRestoreFailed}
        />
      )}
      {sourceRestoreCandidate && (
        <ConfirmDialog
          title={t('restore.sourceConfirmTitle', { name: sourceRestoreCandidate.name })}
          description={t('restore.sourceConfirmDescription')}
          confirmLabel={t('common.restore')}
          cancelLabel={t('common.cancel')}
          returnFocusSelector=".snapshot-detail-view__restore-source"
          onCancel={() => setSourceRestoreCandidate(null)}
          onConfirm={() => {
            const snapshot = sourceRestoreCandidate;
            const sourceId = snapshot.sourceId;
            setSourceRestoreCandidate(null);
            if (!sourceId) return;
            onOperationChange?.({
              kind: 'restore',
              label: t('restore.restoringToSource'),
              currentFile: snapshot.name,
              processedBytes: 0,
              totalBytes: 0,
              phase: snapshot.sourceRoot,
            });
            void api.restoreSnapshotToSource(repositoryPath, sourceId, snapshot.id)
              .then((report) => {
                onOperationChange?.(null);
                onRestoreCompleted?.(report);
                void refresh();
              })
              .catch((caught) => {
                const message = caught instanceof Error ? caught.message : String(caught);
                onOperationChange?.(null);
                onRestoreFailed?.(message);
              });
          }}
        />
      )}
      {deleteCandidate && (
        <ConfirmDialog
          title={t('snapshots.deleteConfirmTitle')}
          description={t('snapshots.deleteConfirmDescription', { name: deleteCandidate.name })}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          intent="danger"
          returnFocusSelector=".snapshot-detail-view__delete"
          onCancel={() => setDeleteCandidate(null)}
          onConfirm={() => deleteSnapshot(deleteCandidate)}
        />
      )}
    </div>
  );
}

function SnapshotDetail({
  snapshot,
  onCompare,
  onRestore,
  onRestoreToSource,
  onDelete,
}: {
  snapshot: Snapshot;
  onCompare: () => void;
  onRestore: () => void;
  onRestoreToSource?: () => void;
  onDelete: () => void;
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
          {onRestoreToSource && (
            <button className="snapshot-detail-view__restore-source" type="button" onClick={onRestoreToSource}>
              <ArchiveRestore size={16} aria-hidden="true" />
              {t('snapshots.restoreToSource')}
            </button>
          )}
          <button className="snapshot-detail-view__delete" type="button" onClick={onDelete}>
            <Trash2 size={16} aria-hidden="true" />
            {t('snapshots.deleteSnapshot')}
          </button>
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

interface SnapshotGroup {
  id: string;
  title: string;
  snapshots: SnapshotIndexItem[];
}

function filterSnapshotsBySource(
  snapshots: SnapshotIndexItem[],
  selectedSourceId: string | null,
) {
  if (!selectedSourceId) return snapshots;
  return snapshots.filter((snapshot) => snapshot.sourceId === selectedSourceId);
}

function groupSnapshotsBySource(
  snapshots: SnapshotIndexItem[],
  sourceById: Map<string, BackupSource>,
  selectedSourceId: string | null,
  unassignedLabel: string,
): SnapshotGroup[] {
  const groups = new Map<string, SnapshotGroup>();
  for (const snapshot of snapshots) {
    const id = snapshot.sourceId ?? 'legacy';
    const title = snapshot.sourceId
      ? sourceById.get(snapshot.sourceId)?.displayName ?? snapshot.sourceRoot
      : unassignedLabel;
    if (!groups.has(id)) groups.set(id, { id, title, snapshots: [] });
    groups.get(id)?.snapshots.push(snapshot);
  }
  if (selectedSourceId && !groups.size) {
    const source = sourceById.get(selectedSourceId);
    if (source) return [{ id: selectedSourceId, title: source.displayName, snapshots: [] }];
  }
  return [...groups.values()];
}
