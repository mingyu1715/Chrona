import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { HomePage } from './HomePage';
import { accessNode, createChronaApiMock, statisticsOverview } from '../../test/chronaApiMock';

afterEach(() => cleanup());

test('shows one primary backup action and a compact repository overview', async () => {
  const { api } = createChronaApiMock();
  vi.mocked(api.getRepositoryStatisticsOverview).mockResolvedValue(statisticsOverview({
    hasSnapshot: true,
    latestSnapshotId: 'latest',
    latestSnapshotName: 'Final submission',
    latestSnapshotCreatedAt: '2026-07-07T12:00:00Z',
    latestFileCount: 148,
    latestLogicalBytes: 8 * 1024 * 1024,
    latestUniqueBlockCount: 96,
  }));
  vi.mocked(api.getHomeSummary).mockResolvedValue({
    continueWorking: accessNode(),
    pinned: [accessNode({ pinned: true })],
    recentRepositories: [],
    recentSources: [accessNode({ label: 'School project' })],
    recentFiles: [],
    recentSnapshots: [accessNode({
      key: 'snapshot:latest',
      kind: 'snapshot',
      label: 'Final submission',
      snapshotId: 'latest',
    })],
    recentComparePairs: [],
  });

  render(
    <HomePage
      api={api}
      repositoryPath="/tmp/chrona-repo"
      onNewBackup={vi.fn()}
      onOpenStatistics={vi.fn()}
    />,
  );

  expect(await screen.findByText('148')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /new backup/i })).toHaveLength(1);
  expect(screen.getByText('School project')).toBeInTheDocument();
  expect(screen.getByText('Final submission')).toBeInTheDocument();
  expect(screen.queryByText(/continue working/i)).not.toBeInTheDocument();
});
