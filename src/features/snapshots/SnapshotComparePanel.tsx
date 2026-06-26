import { useEffect, useMemo, useState } from 'react';
import { GitCompare, ListTree } from 'lucide-react';

import { chronaApi, type ChronaApi } from '../../shared/api/chronaApi';
import type { SnapshotComparison, SnapshotIndexItem } from '../../shared/types/chrona';

interface SnapshotComparePanelProps {
  api?: ChronaApi;
  repositoryPath: string;
  snapshots: SnapshotIndexItem[];
  disabled?: boolean;
}

export function SnapshotComparePanel({
  api = chronaApi,
  repositoryPath,
  snapshots,
  disabled = false,
}: SnapshotComparePanelProps) {
  const [baseSnapshotId, setBaseSnapshotId] = useState('');
  const [targetSnapshotId, setTargetSnapshotId] = useState('');
  const [comparison, setComparison] = useState<SnapshotComparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (snapshots.length === 0) {
      setBaseSnapshotId('');
      setTargetSnapshotId('');
      setComparison(null);
      return;
    }

    setBaseSnapshotId((current) =>
      snapshots.some((snapshot) => snapshot.id === current) ? current : snapshots[0].id,
    );
    setTargetSnapshotId((current) => {
      if (snapshots.some((snapshot) => snapshot.id === current)) {
        return current;
      }
      return snapshots[1]?.id ?? snapshots[0].id;
    });
  }, [snapshots]);

  const selectedPairLabel = useMemo(() => {
    const base = snapshots.find((snapshot) => snapshot.id === baseSnapshotId)?.name ?? 'Base';
    const target = snapshots.find((snapshot) => snapshot.id === targetSnapshotId)?.name ?? 'Target';
    return `${base} → ${target}`;
  }, [baseSnapshotId, snapshots, targetSnapshotId]);

  const canCompare =
    !disabled &&
    !busy &&
    snapshots.length >= 2 &&
    repositoryPath.trim().length > 0 &&
    baseSnapshotId.length > 0 &&
    targetSnapshotId.length > 0;

  async function compareSnapshots() {
    if (!canCompare) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await api.compareSnapshots(repositoryPath, baseSnapshotId, targetSnapshotId);
      setComparison(result);
      await api.recordAccessEvent(repositoryPath, {
        key: `compare:${baseSnapshotId}->${targetSnapshotId}`,
        kind: 'comparePair',
        label: selectedPairLabel,
        path: null,
        repositoryId: null,
        snapshotId: null,
        baseSnapshotId,
        targetSnapshotId,
        action: 'compare_pair_opened',
        accessedAt: new Date().toISOString(),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="snapshot-compare" aria-labelledby="snapshot-compare-heading">
      <div className="snapshot-detail-header">
        <GitCompare size={18} />
        <h3 id="snapshot-compare-heading">Compare snapshots</h3>
      </div>

      <div className="compare-controls">
        <label className="field">
          <span>Base snapshot</span>
          <select
            value={baseSnapshotId}
            onChange={(event) => setBaseSnapshotId(event.target.value)}
            disabled={disabled || snapshots.length === 0 || busy}
          >
            {snapshots.map((snapshot) => (
              <option key={snapshot.id} value={snapshot.id}>
                {snapshot.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Target snapshot</span>
          <select
            value={targetSnapshotId}
            onChange={(event) => setTargetSnapshotId(event.target.value)}
            disabled={disabled || snapshots.length === 0 || busy}
          >
            {snapshots.map((snapshot) => (
              <option key={snapshot.id} value={snapshot.id}>
                {snapshot.name}
              </option>
            ))}
          </select>
        </label>

        <div className="compare-action">
          <button type="button" disabled={!canCompare} onClick={compareSnapshots}>
            <GitCompare size={16} />
            Compare Snapshots
          </button>
          <small>{snapshots.length >= 2 ? selectedPairLabel : 'Need at least two snapshots'}</small>
        </div>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {comparison ? (
        <>
          <dl className="result-grid compact-grid compare-summary">
            <div>
              <dt>Added</dt>
              <dd>{comparison.summary.addedFileCount} added</dd>
            </div>
            <div>
              <dt>Deleted</dt>
              <dd>{comparison.summary.deletedFileCount} deleted</dd>
            </div>
            <div>
              <dt>Modified</dt>
              <dd>{comparison.summary.modifiedFileCount} modified</dd>
            </div>
            <div>
              <dt>Unchanged</dt>
              <dd>{comparison.summary.unchangedFileCount} unchanged</dd>
            </div>
            <div>
              <dt>Before / after</dt>
              <dd>{formatBytes(comparison.summary.totalBeforeBytes)} → {formatBytes(comparison.summary.totalAfterBytes)}</dd>
            </div>
            <div>
              <dt>Block refs</dt>
              <dd>{comparison.summary.sharedBlockReferences} shared refs</dd>
            </div>
          </dl>

          <ul className="snapshot-file-list compare-file-list">
            {comparison.files.map((file) => (
              <li key={file.relativePath}>
                <span>{file.relativePath}</span>
                <small>
                  <span className={`change-pill change-pill-${file.changeType}`}>
                    {file.changeType}
                  </span>
                  {file.blocks.addedBlockReferences} added / {file.blocks.removedBlockReferences} removed
                </small>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="empty-state empty-state-compact compare-empty">
          <span><ListTree size={20} /></span>
          <div>
            <strong>No comparison yet</strong>
            <p>Select two snapshots and compare their file/block references.</p>
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
