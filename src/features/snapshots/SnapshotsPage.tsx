import { ArchiveRestore, GitCompare, Plus, RefreshCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { ChronaApi } from '../../shared/api/chronaApi';
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
          <h1>Snapshots</h1>
          <p>Point-in-time backups stored in this repository</p>
        </div>
        <div className="snapshots-page__header-actions">
          <button type="button" disabled={loading} onClick={() => void refresh()}>
            <RefreshCcw size={16} aria-hidden="true" />
            Refresh
          </button>
          <button className="workspace-primary-action" type="button" onClick={onNewBackup}>
            <Plus size={16} aria-hidden="true" />
            New backup
          </button>
        </div>
      </header>

      {error && <p className="workspace-error" role="alert">{error}</p>}

      <div className="snapshots-workspace">
        <aside className="snapshots-list workspace-pane-scroll">
          <div className="snapshots-list__heading">
            <strong>History</strong>
            <span>{snapshots.length}</span>
          </div>
          <ul aria-label="Snapshot list">
            {snapshots.map((snapshot) => (
              <li key={snapshot.id}>
                <button
                  type="button"
                  aria-label={`Open ${snapshot.name}`}
                  aria-current={selected?.id === snapshot.id ? 'true' : undefined}
                  onClick={() => {
                    setMode('detail');
                    void openSnapshot(snapshot.id);
                  }}
                >
                  <strong>{snapshot.name}</strong>
                  <span>{formatDate(snapshot.createdAt)}</span>
                  <small>{snapshot.fileCount.toLocaleString()} files · {formatBytes(snapshot.totalOriginalBytes)}</small>
                </button>
              </li>
            ))}
          </ul>
          {!loading && snapshots.length === 0 && <p>No snapshots</p>}
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
            <div className="snapshots-detail__empty">{loading ? 'Loading snapshot history' : 'Select a snapshot'}</div>
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
  return (
    <article className="snapshot-detail-view">
      <header>
        <div>
          <span>{formatDate(snapshot.createdAt)}</span>
          <h2>{snapshot.name}</h2>
          <p>{snapshot.sourceRoot}</p>
        </div>
        <div>
          <button type="button" onClick={onCompare}><GitCompare size={16} aria-hidden="true" />Compare snapshots</button>
          <button type="button" onClick={onRestore}><ArchiveRestore size={16} aria-hidden="true" />Restore snapshot</button>
        </div>
      </header>
      <dl>
        <div><dt>Files</dt><dd>{snapshot.summary.fileCount.toLocaleString()}</dd></div>
        <div><dt>Logical size</dt><dd>{formatBytes(snapshot.summary.totalOriginalBytes)}</dd></div>
        <div><dt>New storage</dt><dd>{formatBytes(snapshot.summary.newStoredBytes)}</dd></div>
        <div><dt>Reused blocks</dt><dd>{snapshot.summary.reusedBlockCount.toLocaleString()}</dd></div>
      </dl>
      <section>
        <h3>Files</h3>
        {snapshot.files.length > 0 ? (
          <ul>{snapshot.files.map((file) => <li key={file.relativePath}><span>{file.relativePath}</span><small>{formatBytes(file.sizeBytes)}</small></li>)}</ul>
        ) : <p>No files recorded</p>}
      </section>
    </article>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
