import { useI18n } from '../../shared/i18n/I18nProvider';
import type { RepositoryStatisticsProgress, RepositoryStatisticsReport } from '../../shared/types/chrona';
import { StatisticsDashboard } from './StatisticsDashboard';

export function StatisticsPage({
  report,
  progress,
  loading,
  error,
  onAnalyze,
}: {
  report: RepositoryStatisticsReport | null;
  progress: RepositoryStatisticsProgress | null;
  loading: boolean;
  error: string | null;
  onAnalyze: () => void;
}) {
  const { t } = useI18n();
  return <div className="statistics-page"><header className="workspace-header"><div><h1>{t('statistics.title')}</h1><p>{t('statistics.description')}</p></div></header><StatisticsDashboard repositoryOpen report={report} progress={progress} loading={loading} error={error} onAnalyze={onAnalyze} /></div>;
}
