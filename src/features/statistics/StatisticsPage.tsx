import { useEffect, useState } from 'react';
import type { ActiveOperation } from '../../app/OperationBar';
import type { ChronaApi } from '../../shared/api/chronaApi';
import { useI18n } from '../../shared/i18n/I18nProvider';
import type { RepositoryStatisticsProgress, RepositoryStatisticsReport } from '../../shared/types/chrona';
import { StatisticsDashboard } from './StatisticsDashboard';

export function StatisticsPage({ api, repositoryPath, onOperationChange }: {
  api: ChronaApi; repositoryPath: string; onOperationChange: (operation: ActiveOperation | null) => void;
}) {
  const { t } = useI18n();
  const [report, setReport] = useState<RepositoryStatisticsReport | null>(null);
  const [progress, setProgress] = useState<RepositoryStatisticsProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    api.onRepositoryStatisticsProgress((next) => {
      setProgress(next);
      const blocks = next.phase === 'blocks';
      onOperationChange({
        kind: 'statistics',
        label: t('statistics.analyzing'),
        currentFile: null,
        processedBytes: 0,
        totalBytes: 0,
        phase: blocks
          ? t('statistics.blocksProgress', { current: next.processedBlocks, total: next.totalBlocks })
          : t('statistics.snapshotsProgress', { current: next.processedSnapshots, total: next.totalSnapshots }),
      });
    }).then((value) => { cleanup = value; }).catch(() => undefined);
    return () => cleanup?.();
  }, [api, onOperationChange]);
  async function analyze() {
    setLoading(true); setError(null);
    onOperationChange({ kind: 'statistics', label: t('statistics.analyzing'), currentFile: null, processedBytes: 0, totalBytes: 0, phase: t('statistics.starting') });
    try { setReport(await api.analyzeRepositoryStatistics(repositoryPath)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setLoading(false); onOperationChange(null); }
  }
  return <div className="statistics-page"><header className="workspace-header"><div><h1>{t('statistics.title')}</h1><p>{t('statistics.description')}</p></div></header><StatisticsDashboard repositoryOpen report={report} progress={progress} loading={loading} error={error} onAnalyze={() => void analyze()} /></div>;
}
