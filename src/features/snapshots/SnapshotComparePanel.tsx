import { useEffect, useMemo, useState } from 'react';
import { GitCompare, ListTree } from 'lucide-react';

import { chronaApi, type ChronaApi } from '../../shared/api/chronaApi';
import { useI18n } from '../../shared/i18n/I18nProvider';
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
  const { t, formatBytes, formatNumber } = useI18n();
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
    const base = snapshots.find((snapshot) => snapshot.id === baseSnapshotId)?.name ?? t('compare.base');
    const target = snapshots.find((snapshot) => snapshot.id === targetSnapshotId)?.name ?? t('compare.target');
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
        <h3 id="snapshot-compare-heading">{t('compare.title')}</h3>
      </div>

      <div className="compare-controls">
        <label className="field">
          <span>{t('compare.base')}</span>
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
          <span>{t('compare.target')}</span>
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
            {t('compare.action')}
          </button>
          <small>{snapshots.length >= 2 ? selectedPairLabel : t('compare.needTwo')}</small>
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
              <dt>{t('compare.added')}</dt>
              <dd>{t('compare.addedCount', { count: formatNumber(comparison.summary.addedFileCount) })}</dd>
            </div>
            <div>
              <dt>{t('compare.deleted')}</dt>
              <dd>{t('compare.deletedCount', { count: formatNumber(comparison.summary.deletedFileCount) })}</dd>
            </div>
            <div>
              <dt>{t('compare.modified')}</dt>
              <dd>{t('compare.modifiedCount', { count: formatNumber(comparison.summary.modifiedFileCount) })}</dd>
            </div>
            <div>
              <dt>{t('compare.unchanged')}</dt>
              <dd>{t('compare.unchangedCount', { count: formatNumber(comparison.summary.unchangedFileCount) })}</dd>
            </div>
            <div>
              <dt>{t('compare.beforeAfter')}</dt>
              <dd>{formatBytes(comparison.summary.totalBeforeBytes)} → {formatBytes(comparison.summary.totalAfterBytes)}</dd>
            </div>
            <div>
              <dt>{t('compare.blockRefs')}</dt>
              <dd>{t('compare.sharedRefs', { count: formatNumber(comparison.summary.sharedBlockReferences) })}</dd>
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
                  {t('compare.refsAddedRemoved', {
                    added: formatNumber(file.blocks.addedBlockReferences),
                    removed: formatNumber(file.blocks.removedBlockReferences),
                  })}
                </small>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="empty-state empty-state-compact compare-empty">
          <span><ListTree size={20} /></span>
          <div>
            <strong>{t('compare.noComparison')}</strong>
            <p>{t('compare.emptyDescription')}</p>
          </div>
        </div>
      )}
    </section>
  );
}
