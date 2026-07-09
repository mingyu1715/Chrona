import { AlertTriangle, BarChart3, Database, RefreshCw } from 'lucide-react';

import { useI18n } from '../../shared/i18n/I18nProvider';
import type {
  RepositoryStatisticsProgress,
  RepositoryStatisticsReport,
} from '../../shared/types/chrona';

interface StatisticsDashboardProps {
  repositoryOpen: boolean;
  report: RepositoryStatisticsReport | null;
  progress: RepositoryStatisticsProgress | null;
  loading: boolean;
  error: string | null;
  onAnalyze: () => void;
}

export function StatisticsDashboard({
  repositoryOpen,
  report,
  progress,
  loading,
  error,
  onAnalyze,
}: StatisticsDashboardProps) {
  const { t } = useI18n();

  return (
    <div className="statistics-dashboard">
      <div className="statistics-runbar">
        <div>
          <strong>{t('statistics.runbarTitle')}</strong>
          <p>{t('statistics.runbarDescription')}</p>
        </div>
        <button type="button" disabled={!repositoryOpen || loading} onClick={onAnalyze}>
          {loading ? <RefreshCw className="spin" size={16} /> : <BarChart3 size={16} />}
          {report ? t('statistics.refreshAnalysis') : t('statistics.analyzeRepository')}
        </button>
      </div>

      {loading && progress && <StatisticsProgress progress={progress} />}
      {error && <p className="error" role="alert">{error}</p>}

      {!report ? (
        <div className="statistics-empty">
          <Database size={22} aria-hidden="true" />
          <div>
            <strong>{repositoryOpen ? t('statistics.noAnalysis') : t('statistics.noRepositoryOpen')}</strong>
            <p>
              {repositoryOpen
                ? t('statistics.runAnalysisDescription')
                : t('statistics.openRepositoryDescription')}
            </p>
          </div>
        </div>
      ) : (
        <StatisticsReportView report={report} />
      )}
    </div>
  );
}

function StatisticsProgress({ progress }: { progress: RepositoryStatisticsProgress }) {
  const { formatNumber } = useI18n();
  const isBlocks = progress.phase === 'blocks';
  const current = isBlocks ? progress.processedBlocks : progress.processedSnapshots;
  const total = isBlocks ? progress.totalBlocks : progress.totalSnapshots;
  const ratio = total > 0 ? Math.min(100, (current / total) * 100) : 0;

  return (
    <div className="statistics-progress" aria-live="polite">
      <div>
        <strong>{formatLabel(progress.phase)}</strong>
        <span>{formatLabel(progress.phase)} {formatNumber(current)} / {formatNumber(total)}</span>
      </div>
      <progress max={100} value={ratio}>{ratio.toFixed(0)}%</progress>
    </div>
  );
}

function StatisticsReportView({ report }: { report: RepositoryStatisticsReport }) {
  const { t, formatBytes, formatNumber } = useI18n();
  const storage = report.storage;
  const maxTrendBytes = Math.max(
    1,
    ...report.snapshotTrend.map((point) => point.logicalBytes),
  );

  return (
    <div className="statistics-report">
      <dl className="statistics-primary-metrics">
        <Metric label={t('statistics.historyLogical')} value={formatBytes(storage.retainedLogicalBytes)} />
        <Metric label={t('statistics.uniqueRawBlocks')} value={formatBytes(storage.referencedUniqueRawBytes)} />
        <Metric label={t('statistics.physicalStorage')} value={formatBytes(storage.allPhysicalBytes)} />
        <Metric
          label={t('statistics.storageReduction')}
          value={storage.storageEfficiencyPercent === null
            ? t('common.unavailable')
            : `${storage.storageEfficiencyPercent.toFixed(1)}%`}
        />
      </dl>

      <div className="statistics-detail-grid">
        <section className="statistics-section" aria-labelledby="statistics-savings-heading">
          <h3 id="statistics-savings-heading">{t('statistics.storageSavings')}</h3>
          <dl className="statistics-row-list">
            <Metric label={t('statistics.dedupSaved')} value={formatBytes(storage.dedupSavedBytes)} />
            <Metric label={t('statistics.compressionSaved')} value={formatBytes(storage.compressionSavedBytes)} />
            <Metric label={t('statistics.referencedUnique')} value={formatNumber(storage.referencedUniqueBlockCount)} />
            <Metric label={t('statistics.blockReferences')} value={formatNumber(storage.totalBlockReferences)} />
          </dl>
        </section>

        <section className="statistics-section" aria-labelledby="statistics-physical-heading">
          <h3 id="statistics-physical-heading">{t('statistics.physicalBlocks')}</h3>
          <dl className="statistics-row-list">
            <Metric label={t('statistics.allPhysicalBlocks')} value={formatNumber(storage.allPhysicalBlockCount)} />
            <Metric label={t('statistics.referencedBlocks')} value={formatNumber(storage.referencedPhysicalBlockCount)} />
            <Metric label={t('statistics.unreferencedBlocks')} value={`${formatNumber(storage.unreferencedBlockCount)} · ${formatBytes(storage.unreferencedBytes)}`} />
            <Metric label={t('statistics.missingReferenced')} value={formatNumber(storage.missingReferencedBlockCount)} />
          </dl>
        </section>
      </div>

      <div className="statistics-detail-grid statistics-visual-grid">
        <section className="statistics-section" aria-labelledby="statistics-trend-heading">
          <h3 id="statistics-trend-heading">{t('statistics.snapshotTrend')}</h3>
          <ol className="statistics-trend" aria-label={t('statistics.snapshotTrend')}>
            {report.snapshotTrend.map((point) => (
              <li key={point.snapshotId}>
                <div>
                  <strong>{point.snapshotName}</strong>
                  <span>{t('files.fileCount', { count: formatNumber(point.fileCount) })} · {formatBytes(point.logicalBytes)}</span>
                </div>
                <span className="statistics-trend-track" aria-hidden="true">
                  <span style={{ width: `${Math.max(4, (point.logicalBytes / maxTrendBytes) * 100)}%` }} />
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="statistics-section" aria-labelledby="statistics-encoding-heading">
          <h3 id="statistics-encoding-heading">{t('statistics.encodingDistribution')}</h3>
          <ul className="statistics-encodings">
            <EncodingRow label="Raw" count={report.encodings.rawBlockCount} bytes={report.encodings.rawPhysicalBytes} />
            <EncodingRow label="Zstd" count={report.encodings.zstdBlockCount} bytes={report.encodings.zstdPhysicalBytes} />
            <EncodingRow label="LZ4" count={report.encodings.lz4BlockCount} bytes={report.encodings.lz4PhysicalBytes} />
            {report.encodings.unknownBlockCount > 0 && (
              <EncodingRow label="Unknown" count={report.encodings.unknownBlockCount} bytes={report.encodings.unknownPhysicalBytes} />
            )}
          </ul>
        </section>
      </div>

      {report.issues.length > 0 && (
        <section className="statistics-issues" aria-labelledby="statistics-issues-heading">
          <h3 id="statistics-issues-heading"><AlertTriangle size={17} />{t('statistics.analysisIssues')}</h3>
          <ul>
            {report.issues.map((issue, index) => (
              <li key={`${issue.kind}-${issue.hash ?? issue.path ?? index}`}>
                <strong>{formatLabel(issue.kind)}</strong>
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function EncodingRow({
  label,
  count,
  bytes,
}: {
  label: string;
  count: number;
  bytes: number;
}) {
  const { formatBytes, formatNumber } = useI18n();

  return (
    <li>
      <span>{label}</span>
      <strong>{formatNumber(count)} · {formatBytes(bytes)}</strong>
    </li>
  );
}

function formatLabel(value: string): string {
  const spaced = value.replace(/([a-z])([A-Z])/g, '$1 $2');
  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
}
