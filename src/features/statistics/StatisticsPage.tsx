import { useEffect, useState } from 'react';
import type { ActiveOperation } from '../../app/OperationBar';
import type { ChronaApi } from '../../shared/api/chronaApi';
import type { RepositoryStatisticsProgress, RepositoryStatisticsReport } from '../../shared/types/chrona';
import { StatisticsDashboard } from './StatisticsDashboard';

export function StatisticsPage({ api, repositoryPath, onOperationChange }: {
  api: ChronaApi; repositoryPath: string; onOperationChange: (operation: ActiveOperation | null) => void;
}) {
  const [report, setReport] = useState<RepositoryStatisticsReport | null>(null);
  const [progress, setProgress] = useState<RepositoryStatisticsProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    api.onRepositoryStatisticsProgress((next) => {
      setProgress(next);
      const blocks = next.phase === 'blocks';
      onOperationChange({ kind: 'statistics', label: 'Analyzing repository', currentFile: null, processedBytes: 0, totalBytes: 0, phase: blocks ? `Blocks ${next.processedBlocks} / ${next.totalBlocks}` : `Snapshots ${next.processedSnapshots} / ${next.totalSnapshots}` });
    }).then((value) => { cleanup = value; }).catch(() => undefined);
    return () => cleanup?.();
  }, [api, onOperationChange]);
  async function analyze() {
    setLoading(true); setError(null);
    onOperationChange({ kind: 'statistics', label: 'Analyzing repository', currentFile: null, processedBytes: 0, totalBytes: 0, phase: 'Starting' });
    try { setReport(await api.analyzeRepositoryStatistics(repositoryPath)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setLoading(false); onOperationChange(null); }
  }
  return <div className="statistics-page"><header className="workspace-header"><div><h1>Statistics</h1><p>Logical history and physical storage</p></div></header><StatisticsDashboard repositoryOpen report={report} progress={progress} loading={loading} error={error} onAnalyze={() => void analyze()} /></div>;
}
