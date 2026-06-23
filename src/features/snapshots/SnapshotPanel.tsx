import { useEffect, useState } from 'react';
import { Clock3, Download, Files, FolderOpen, RefreshCcw, Save, ScrollText } from 'lucide-react';

import { chronaApi, type ChronaApi } from '../../shared/api/chronaApi';
import { SnapshotComparePanel } from './SnapshotComparePanel';
import type { RestoreReport, Snapshot, SnapshotIndexItem } from '../../shared/types/chrona';

interface SnapshotPanelProps {
  api?: ChronaApi;
  repositoryPath: string;
  sourcePath: string;
  repositoryOpen: boolean;
  embedded?: boolean;
}

export function SnapshotPanel({
  api = chronaApi,
  repositoryPath,
  sourcePath,
  repositoryOpen,
  embedded = false,
}: SnapshotPanelProps) {
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshots, setSnapshots] = useState<SnapshotIndexItem[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [restoreTargetPath, setRestoreTargetPath] = useState('');
  const [restoreReport, setRestoreReport] = useState<RestoreReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repositoryOpen || repositoryPath.trim().length === 0) {
      setSnapshots([]);
      setSelectedSnapshot(null);
      return;
    }

    let mounted = true;
    api
      .listSnapshots(repositoryPath)
      .then((items) => {
        if (mounted) {
          setSnapshots(items);
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, [api, repositoryOpen, repositoryPath]);

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function refreshSnapshots(selectedId?: string) {
    const items = await api.listSnapshots(repositoryPath);
    setSnapshots(items);
    if (selectedId) {
      setSelectedSnapshot(await api.getSnapshot(repositoryPath, selectedId));
      setRestoreReport(null);
    }
  }

  const canCreate =
    repositoryOpen &&
    repositoryPath.trim().length > 0 &&
    sourcePath.trim().length > 0 &&
    !busy;
  const canRestore =
    repositoryOpen &&
    selectedSnapshot !== null &&
    repositoryPath.trim().length > 0 &&
    restoreTargetPath.trim().length > 0 &&
    !busy;

  return (
    <section
      className={embedded ? 'snapshot-panel snapshot-panel-embedded' : 'panel snapshot-panel'}
      aria-labelledby="snapshot-heading"
    >
      {embedded ? (
        <h2 id="snapshot-heading" className="sr-only">Snapshots</h2>
      ) : (
        <div className="section-heading">
          <span className="section-icon section-icon-blue"><Clock3 size={18} /></span>
          <div>
            <h2 id="snapshot-heading">Snapshots</h2>
            <p>Capture point-in-time metadata for the selected source.</p>
          </div>
        </div>
      )}

      <label className="field">
        <span>Snapshot name</span>
        <input
          value={snapshotName}
          onChange={(event) => setSnapshotName(event.target.value)}
          placeholder="Initial import"
        />
      </label>
      <div className="actions">
        <button
          type="button"
          disabled={!canCreate}
          onClick={() =>
            runAction(async () => {
              const created = await api.createSnapshot(
                repositoryPath,
                sourcePath,
                snapshotName,
              );
              setSnapshotName('');
              await refreshSnapshots(created.id);
            })
          }
        >
          <Save size={16} />
          Create Snapshot
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={!repositoryOpen || repositoryPath.trim().length === 0 || busy}
          onClick={() => runAction(async () => refreshSnapshots())}
        >
          <RefreshCcw size={16} />
          Refresh Snapshots
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {snapshots.length > 0 ? (
        <>
          <div className="snapshot-layout">
          <div className="snapshot-list" aria-label="Snapshot list">
            {snapshots.map((snapshot) => (
              <button
                key={snapshot.id}
                type="button"
                className="snapshot-list-item"
                onClick={() =>
                  runAction(async () => {
                    setSelectedSnapshot(await api.getSnapshot(repositoryPath, snapshot.id));
                    setRestoreReport(null);
                  })
                }
              >
                <span>{snapshot.name}</span>
                <small>{snapshot.fileCount} files · {formatBytes(snapshot.totalOriginalBytes)}</small>
              </button>
            ))}
          </div>

          {selectedSnapshot && (
            <div className="snapshot-detail">
              <div className="snapshot-detail-header">
                <ScrollText size={18} />
                <h3>{selectedSnapshot.name}</h3>
              </div>
              <dl className="result-grid compact-grid">
                <div>
                  <dt>Files</dt>
                  <dd>{selectedSnapshot.summary.fileCount}</dd>
                </div>
                <div>
                  <dt>Original bytes</dt>
                  <dd>{formatBytes(selectedSnapshot.summary.totalOriginalBytes)}</dd>
                </div>
                <div>
                  <dt>New stored bytes</dt>
                  <dd>{formatBytes(selectedSnapshot.summary.newStoredBytes)}</dd>
                </div>
              </dl>
              <div className="snapshot-restore">
                <div className="field">
                  <label htmlFor="restore-target-path">Restore target</label>
                  <div className="inline-path-row">
                    <input
                      id="restore-target-path"
                      value={restoreTargetPath}
                      onChange={(event) => {
                        setRestoreTargetPath(event.target.value);
                        setRestoreReport(null);
                      }}
                      placeholder="/tmp/chrona-restore"
                    />
                    <button
                      type="button"
                      className="button-secondary"
                      disabled={!repositoryOpen || busy}
                      onClick={() =>
                        runAction(async () => {
                          const selected = await api.selectRestoreTargetPath();
                          if (selected) {
                            setRestoreTargetPath(selected);
                            setRestoreReport(null);
                          }
                        })
                      }
                    >
                      <FolderOpen size={16} />
                      Choose Restore Target
                    </button>
                  </div>
                </div>
                <div className="actions">
                  <button
                    type="button"
                    disabled={!canRestore}
                    onClick={() =>
                      runAction(async () => {
                        const report = await api.restoreSnapshot(
                          repositoryPath,
                          selectedSnapshot.id,
                          restoreTargetPath,
                        );
                        setRestoreReport(report);
                      })
                    }
                  >
                    <Download size={16} />
                    Restore Snapshot
                  </button>
                </div>
                {restoreReport && (
                  <dl className="result-grid compact-grid restore-report-grid">
                    <div>
                      <dt>Restored files</dt>
                      <dd>{restoreReport.restoredFileCount}</dd>
                    </div>
                    <div>
                      <dt>Restored bytes</dt>
                      <dd>{formatBytes(restoreReport.restoredBytes)}</dd>
                    </div>
                    <div>
                      <dt>Block refs</dt>
                      <dd>{restoreReport.restoredBlockCount}</dd>
                    </div>
                  </dl>
                )}
              </div>
              <ul className="snapshot-file-list">
                {selectedSnapshot.files.map((file) => (
                  <li key={file.relativePath}>
                    <span>{file.relativePath}</span>
                    <small>{formatBytes(file.sizeBytes)}</small>
                  </li>
                ))}
              </ul>
            </div>
          )}
          </div>

          <SnapshotComparePanel
          api={api}
          repositoryPath={repositoryPath}
          snapshots={snapshots}
          disabled={!repositoryOpen || busy}
          />
        </>
      ) : (
        <div className="empty-state empty-state-compact">
          <span><Files size={20} /></span>
          <div>
            <strong>No snapshots yet</strong>
            <p>Create one after opening a repository and selecting a source.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes.toLocaleString()} bytes`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
