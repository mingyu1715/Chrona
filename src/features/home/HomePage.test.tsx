import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { HomePage } from './HomePage';
import { accessNode, backupSource, createChronaApiMock, statisticsOverview } from '../../test/chronaApiMock';

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
  expect(screen.getAllByRole('button', { name: /back up again/i })).toHaveLength(1);
  expect(screen.getByText('School project')).toBeInTheDocument();
  expect(screen.getByText('Final submission')).toBeInTheDocument();
  expect(screen.queryByText(/continue working/i)).not.toBeInTheDocument();
});

test('labels and opens the first backup when no snapshot exists', async () => {
  const { api } = createChronaApiMock();
  const user = userEvent.setup();
  const onNewBackup = vi.fn();
  vi.mocked(api.getRepositoryStatisticsOverview).mockResolvedValue(statisticsOverview());

  render(
    <HomePage
      api={api}
      repositoryPath="/tmp/chrona-repo"
      onNewBackup={onNewBackup}
      onOpenStatistics={vi.fn()}
    />,
  );

  await user.click(await screen.findByRole('button', { name: 'Create first backup' }));
  expect(onNewBackup).toHaveBeenCalledWith({ entryPoint: 'first-backup' });
});

test('repeats from the most recent source and falls back when its path is missing', async () => {
  const { api } = createChronaApiMock();
  const user = userEvent.setup();
  const onNewBackup = vi.fn();
  vi.mocked(api.getRepositoryStatisticsOverview).mockResolvedValue(statisticsOverview({
    hasSnapshot: true,
  }));
  vi.mocked(api.getHomeSummary).mockResolvedValue({
    continueWorking: null,
    pinned: [],
    recentRepositories: [],
    recentSources: [accessNode({ path: '/recent/source' })],
    recentFiles: [],
    recentSnapshots: [],
    recentComparePairs: [],
  });

  const { rerender } = render(
    <HomePage
      api={api}
      repositoryPath="/tmp/chrona-repo"
      onNewBackup={onNewBackup}
      onOpenStatistics={vi.fn()}
    />,
  );
  await user.click(await screen.findByRole('button', { name: 'Back up again' }));
  expect(onNewBackup).toHaveBeenLastCalledWith({
    entryPoint: 'repeat',
    initialSourcePath: '/recent/source',
  });

  vi.mocked(api.getHomeSummary).mockResolvedValue({
    continueWorking: null,
    pinned: [],
    recentRepositories: [],
    recentSources: [accessNode({ path: null })],
    recentFiles: [],
    recentSnapshots: [],
    recentComparePairs: [],
  });
  rerender(
    <HomePage
      api={api}
      repositoryPath="/tmp/chrona-repo"
      refreshKey={1}
      onNewBackup={onNewBackup}
      onOpenStatistics={vi.fn()}
    />,
  );
  await user.click(await screen.findByRole('button', { name: 'New Backup' }));
  expect(onNewBackup).toHaveBeenLastCalledWith({ entryPoint: 'repeat' });
});

test('groups known backup sources and repeats backup from that source', async () => {
  const { api } = createChronaApiMock();
  const user = userEvent.setup();
  const onNewBackup = vi.fn();
  const onSelectSource = vi.fn();
  vi.mocked(api.listSources).mockResolvedValue({
    schemaVersion: 1,
    sources: [
      backupSource({
        id: 'source-project',
        displayName: 'School project',
        path: '/Users/mingyu/Documents/School project',
        snapshotCount: 3,
        latestSnapshotAt: '2026-07-07T12:00:00Z',
      }),
    ],
  });

  render(
    <HomePage
      api={api}
      repositoryPath="/tmp/chrona-repo"
      onNewBackup={onNewBackup}
      onOpenStatistics={vi.fn()}
      onSelectSource={onSelectSource}
    />,
  );

  await user.click(await screen.findByRole('button', { name: /open school project snapshots/i }));
  expect(onSelectSource).toHaveBeenCalledWith('source-project', 'snapshots');

  await user.click(screen.getByRole('button', { name: /back up school project/i }));
  expect(onNewBackup).toHaveBeenCalledWith({
    entryPoint: 'repeat',
    initialSourcePath: '/Users/mingyu/Documents/School project',
  });
});
