import { AlertTriangle, BarChart3, Database, RefreshCw } from 'lucide-react';

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
  return (
    <div className="statistics-dashboard">
      <div className="statistics-runbar">
        <div>
          <strong>Repository storage analysis</strong>
          <p>Scans snapshot metadata and final physical block files on demand.</p>
        </div>
        <button type="button" disabled={!repositoryOpen || loading} onClick={onAnalyze}>
          {loading ? <RefreshCw className="spin" size={16} /> : <BarChart3 size={16} />}
          {report ? 'Refresh analysis' : 'Analyze repository'}
        </button>
      </div>

      {loading && progress && <StatisticsProgress progress={progress} />}
      {error && <p className="error" role="alert">{error}</p>}

      {!report ? (
        <div className="statistics-empty">
          <Database size={22} aria-hidden="true" />
          <div>
            <strong>{repositoryOpen ? 'No analysis yet' : 'No repository open'}</strong>
            <p>
              {repositoryOpen
                ? 'Run analysis to compare logical history with physical storage.'
                : 'Open a repository before running storage analysis.'}
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
  const isBlocks = progress.phase === 'blocks';
  const current = isBlocks ? progress.processedBlocks : progress.processedSnapshots;
  const total = isBlocks ? progress.totalBlocks : progress.totalSnapshots;
  const ratio = total > 0 ? Math.min(100, (current / total) * 100) : 0;

  return (
    <div className="statistics-progress" aria-live="polite">
      <div>
        <strong>{formatLabel(progress.phase)}</strong>
        <span>{formatLabel(progress.phase)} {current.toLocaleString()} / {total.toLocaleString()}</span>
      </div>
      <progress max={100} value={ratio}>{ratio.toFixed(0)}%</progress>
    </div>
  );
}

function StatisticsReportView({ report }: { report: RepositoryStatisticsReport }) {
  const storage = report.storage;
  const maxTrendBytes = Math.max(
    1,
    ...report.snapshotTrend.map((point) => point.logicalBytes),
  );

  return (
    <div className="statistics-report">
      <dl className="statistics-primary-metrics">
        <Metric label="History logical" value={formatBytes(storage.retainedLogicalBytes)} />
        <Metric label="Unique raw blocks" value={formatBytes(storage.referencedUniqueRawBytes)} />
        <Metric label="Physical storage" value={formatBytes(storage.allPhysicalBytes)} />
        <Metric
          label="Storage reduction"
          value={storage.storageEfficiencyPercent === null
            ? 'Unavailable'
            : `${storage.storageEfficiencyPercent.toFixed(1)}%`}
        />
      </dl>

      <div className="statistics-detail-grid">
        <section className="statistics-section" aria-labelledby="statistics-savings-heading">
          <h3 id="statistics-savings-heading">Storage savings</h3>
          <dl className="statistics-row-list">
            <Metric label="Dedup saved" value={formatBytes(storage.dedupSavedBytes)} />
            <Metric label="Compression saved" value={formatBytes(storage.compressionSavedBytes)} />
            <Metric label="Referenced unique" value={storage.referencedUniqueBlockCount.toLocaleString()} />
            <Metric label="Block references" value={storage.totalBlockReferences.toLocaleString()} />
          </dl>
        </section>

        <section className="statistics-section" aria-labelledby="statistics-physical-heading">
          <h3 id="statistics-physical-heading">Physical blocks</h3>
          <dl className="statistics-row-list">
            <Metric label="All physical blocks" value={storage.allPhysicalBlockCount.toLocaleString()} />
            <Metric label="Referenced blocks" value={storage.referencedPhysicalBlockCount.toLocaleString()} />
            <Metric label="Unreferenced blocks" value={`${storage.unreferencedBlockCount.toLocaleString()} · ${formatBytes(storage.unreferencedBytes)}`} />
            <Metric label="Missing referenced" value={storage.missingReferencedBlockCount.toLocaleString()} />
          </dl>
        </section>
      </div>

      <div className="statistics-detail-grid statistics-visual-grid">
        <section className="statistics-section" aria-labelledby="statistics-trend-heading">
          <h3 id="statistics-trend-heading">Snapshot trend</h3>
          <ol className="statistics-trend" aria-label="Snapshot trend">
            {report.snapshotTrend.map((point) => (
              <li key={point.snapshotId}>
                <div>
                  <strong>{point.snapshotName}</strong>
                  <span>{point.fileCount.toLocaleString()} files · {formatBytes(point.logicalBytes)}</span>
                </div>
                <span className="statistics-trend-track" aria-hidden="true">
                  <span style={{ width: `${Math.max(4, (point.logicalBytes / maxTrendBytes) * 100)}%` }} />
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="statistics-section" aria-labelledby="statistics-encoding-heading">
          <h3 id="statistics-encoding-heading">Encoding distribution</h3>
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
          <h3 id="statistics-issues-heading"><AlertTriangle size={17} />Analysis issues</h3>
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
  return (
    <li>
      <span>{label}</span>
      <strong>{count.toLocaleString()} · {formatBytes(bytes)}</strong>
    </li>
  );
}

function formatLabel(value: string): string {
  const spaced = value.replace(/([a-z])([A-Z])/g, '$1 $2');
  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
}

function formatBytes(bytes: number): string {
  const units = ['bytes', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit === 0 ? `${value.toLocaleString()} bytes` : `${value.toFixed(1)} ${units[unit]}`;
}
