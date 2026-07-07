import { BarChart3, ChevronRight, Database } from 'lucide-react';

import type { RepositoryStatisticsOverview } from '../../shared/types/chrona';

interface RepositoryOverviewProps {
  overview: RepositoryStatisticsOverview | null;
  loading: boolean;
  error: string | null;
  onOpenDetails: () => void;
}

export function RepositoryOverview({
  overview,
  loading,
  error,
  onOpenDetails,
}: RepositoryOverviewProps) {
  if (loading && !overview) {
    return <p className="statistics-overview-state">Loading repository overview...</p>;
  }

  if (error && !overview) {
    return <p className="error statistics-overview-state" role="alert">{error}</p>;
  }

  if (!overview?.hasSnapshot) {
    return (
      <div className="statistics-overview-empty">
        <Database size={20} aria-hidden="true" />
        <div>
          <strong>No snapshots yet</strong>
          <p>Create a snapshot to populate the repository overview.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="statistics-overview" aria-labelledby="repository-overview-heading">
      <div className="statistics-overview-header">
        <div>
          <span>Latest snapshot</span>
          <h3 id="repository-overview-heading">Repository overview</h3>
        </div>
        <button type="button" className="button-secondary" onClick={onOpenDetails}>
          <BarChart3 size={16} aria-hidden="true" />
          Detailed analysis
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>

      <dl className="statistics-overview-metrics">
        <div>
          <dt>Files</dt>
          <dd>{overview.latestFileCount.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Data size</dt>
          <dd>{formatBytes(overview.latestLogicalBytes)}</dd>
        </div>
        <div>
          <dt>Unique blocks</dt>
          <dd>{overview.latestUniqueBlockCount.toLocaleString()}</dd>
        </div>
      </dl>

      <div className="statistics-kind-summary">
        <div className="statistics-kind-heading">
          <strong>File composition</strong>
          <span>{overview.latestSnapshotName}</span>
        </div>
        <ul aria-label="Latest snapshot file composition">
          {overview.fileKindStats.map((stat) => (
            <li key={stat.kind}>
              <span>{formatKind(stat.kind)}</span>
              <strong>{stat.fileCount.toLocaleString()}</strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function formatKind(kind: string): string {
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
}

function formatBytes(bytes: number): string {
  const units = ['bytes', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  if (unit === 0) {
    return `${value.toLocaleString()} bytes`;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}
