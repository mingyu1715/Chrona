import { useEffect, useState } from 'react';

import { chronaApi, type ChronaApi } from '../../shared/api/chronaApi';
import type { Snapshot, SnapshotIndexItem } from '../../shared/types/chrona';

interface SnapshotPanelProps {
  api?: ChronaApi;
  repositoryPath: string;
  sourcePath: string;
  repositoryOpen: boolean;
}

export function SnapshotPanel({
  api = chronaApi,
  repositoryPath,
  sourcePath,
  repositoryOpen,
}: SnapshotPanelProps) {
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshots, setSnapshots] = useState<SnapshotIndexItem[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
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
    }
  }

  const canCreate =
    repositoryOpen &&
    repositoryPath.trim().length > 0 &&
    sourcePath.trim().length > 0 &&
    !busy;

  return (
    <section className="panel snapshot-panel" aria-labelledby="snapshot-heading">
      <h2 id="snapshot-heading">Snapshots</h2>
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
          Create Snapshot
        </button>
        <button
          type="button"
          disabled={!repositoryOpen || repositoryPath.trim().length === 0 || busy}
          onClick={() => runAction(async () => refreshSnapshots())}
        >
          Refresh Snapshots
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {snapshots.length > 0 && (
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
                  })
                }
              >
                <span>{snapshot.name}</span>
                <small>{snapshot.fileCount} files</small>
              </button>
            ))}
          </div>

          {selectedSnapshot && (
            <div className="snapshot-detail">
              <h3>{selectedSnapshot.name}</h3>
              <dl className="result-grid">
                <div>
                  <dt>Files</dt>
                  <dd>{selectedSnapshot.summary.fileCount}</dd>
                </div>
                <div>
                  <dt>Original bytes</dt>
                  <dd>{selectedSnapshot.summary.totalOriginalBytes.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>New stored bytes</dt>
                  <dd>{selectedSnapshot.summary.newStoredBytes.toLocaleString()}</dd>
                </div>
              </dl>
              <ul className="snapshot-file-list">
                {selectedSnapshot.files.map((file) => (
                  <li key={file.relativePath}>
                    <span>{file.relativePath}</span>
                    <small>{file.sizeBytes.toLocaleString()} bytes</small>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
