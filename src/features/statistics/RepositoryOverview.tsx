import { BarChart3, ChevronRight, Database } from 'lucide-react';

import { useI18n } from '../../shared/i18n/I18nProvider';
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
  const { t, formatBytes, formatNumber } = useI18n();

  if (loading && !overview) {
    return <p className="statistics-overview-state">{t('statistics.loadingOverview')}</p>;
  }

  if (error && !overview) {
    return <p className="error statistics-overview-state" role="alert">{error}</p>;
  }

  if (!overview?.hasSnapshot) {
    return (
      <div className="statistics-overview-empty">
          <Database size={20} aria-hidden="true" />
        <div>
          <strong>{t('statistics.noSnapshots')}</strong>
          <p>{t('statistics.noSnapshotsDescription')}</p>
        </div>
      </div>
    );
  }

  return (
    <section className="statistics-overview" aria-labelledby="repository-overview-heading">
      <div className="statistics-overview-header">
        <div>
          <span>{t('statistics.latestSnapshot')}</span>
          <h3 id="repository-overview-heading">{t('statistics.repositoryOverview')}</h3>
        </div>
        <button type="button" className="button-secondary" onClick={onOpenDetails}>
          <BarChart3 size={16} aria-hidden="true" />
          {t('statistics.detailedAnalysis')}
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>

      <dl className="statistics-overview-metrics">
        <div>
          <dt>{t('common.files')}</dt>
          <dd>{formatNumber(overview.latestFileCount)}</dd>
        </div>
        <div>
          <dt>{t('statistics.dataSize')}</dt>
          <dd>{formatBytes(overview.latestLogicalBytes)}</dd>
        </div>
        <div>
          <dt>{t('common.uniqueBlocks')}</dt>
          <dd>{formatNumber(overview.latestUniqueBlockCount)}</dd>
        </div>
      </dl>

      <div className="statistics-kind-summary">
        <div className="statistics-kind-heading">
          <strong>{t('statistics.fileComposition')}</strong>
          <span>{overview.latestSnapshotName}</span>
        </div>
        <ul aria-label={t('statistics.latestComposition')}>
          {overview.fileKindStats.map((stat) => (
            <li key={stat.kind}>
              <span>{formatKind(stat.kind)}</span>
              <strong>{formatNumber(stat.fileCount)}</strong>
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
