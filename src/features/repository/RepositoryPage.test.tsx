import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { RepositoryPage } from './RepositoryPage';
import type { ChronaApi } from '../../shared/api/chronaApi';
import {
  accessNode,
  createChronaApiMock,
  statisticsOverview,
  statisticsReport,
} from '../../test/chronaApiMock';
import type { RepositoryStatisticsReport } from '../../shared/types/chrona';

afterEach(() => cleanup());

describe('RepositoryPage', () => {
  test('opens the active registered repository', async () => {
    const { api, library, openedRepository } = createChronaApiMock();

    await expect(api.getRepositoryLibrary()).resolves.toEqual(library);
    await expect(api.activateRegisteredRepository('repo-id'))
      .resolves.toEqual(openedRepository);
  });

  test('creates a repository, ingests blocks, and displays progress and summary', async () => {
    const { api, emitProgress } = createChronaApiMock();
    const user = userEvent.setup();
    render(<RepositoryPage api={api} />);

    await user.type(screen.getByLabelText(/repository path/i), '/tmp/chrona-repo');
    await user.click(screen.getByRole('button', { name: /create repository/i }));

    await waitFor(() => expect(api.createRepository).toHaveBeenCalledWith('/tmp/chrona-repo'));
    expect(screen.getByText(/repository open/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/source path/i), '/tmp/source');
    emitProgress({
      operationId: 'op-1',
      phase: 'storing',
      currentFile: 'nested/b.txt',
      processedFiles: 1,
      totalFiles: 2,
      currentFileBytesProcessed: 9,
      currentFileSizeBytes: 9,
      totalBytesProcessed: 9,
      totalBytes: 18,
    });
    await user.click(screen.getByRole('button', { name: /analyze & store blocks/i }));

    await waitFor(() => expect(api.ingestBlocks).toHaveBeenCalledWith('/tmp/chrona-repo', '/tmp/source'));
    expect(screen.getByText('nested/b.txt')).toBeInTheDocument();
    expect(screen.getByText('Scanned files').nextElementSibling).toHaveTextContent('2');
    expect(screen.getByText('1 new / 1 reused')).toBeInTheDocument();
    expect(screen.getByText('50.00%')).toBeInTheDocument();
  });

  test('fills paths from native picker actions', async () => {
    const { api } = createChronaApiMock();
    const user = userEvent.setup();
    render(<RepositoryPage api={api} />);

    await user.click(screen.getByRole('button', { name: /choose repository folder/i }));
    expect(screen.getByLabelText(/repository path/i)).toHaveValue('/picked/chrona-repo');

    await user.click(screen.getByRole('button', { name: /create repository/i }));
    await waitFor(() => expect(api.createRepository).toHaveBeenCalledWith('/picked/chrona-repo'));

    await user.click(screen.getByRole('button', { name: /choose source folder/i }));
    expect(screen.getByLabelText(/source path/i)).toHaveValue('/picked/source-folder');

    await user.click(screen.getByRole('button', { name: /choose source file/i }));
    expect(screen.getByLabelText(/source path/i)).toHaveValue('/picked/source.txt');
  });


  test('renders unnumbered workspace sections and empty result state', async () => {
    const { api } = createChronaApiMock();
    const user = userEvent.setup();

    render(<RepositoryPage api={api} />);

    expect(screen.getByText(/chrona desktop/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /chrona workspace/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /workspace overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
    const sectionNav = screen.getByRole('navigation', { name: /workspace sections/i });
    expect(within(sectionNav).getByRole('button', { name: /repository/i })).toBeInTheDocument();
    expect(within(sectionNav).getByRole('button', { name: /sources/i })).toBeInTheDocument();
    expect(screen.queryByText(/step 1/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /switch to dark mode/i }));
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /review/i }));

    expect(screen.getByRole('heading', { name: /review/i })).toBeInTheDocument();
    expect(screen.getByText(/no block run yet/i)).toBeInTheDocument();
  });

  test('renders Home recent access after repository activity', async () => {
    const { api } = createChronaApiMock();
    const user = userEvent.setup();
    const recentSource = accessNode({ label: 'demo-source', pinned: true });
    vi.mocked(api.getHomeSummary).mockResolvedValue({
      continueWorking: recentSource,
      pinned: [recentSource],
      recentRepositories: [accessNode({
        key: 'repository:repo-id',
        kind: 'repository',
        label: 'chrona-repo',
        path: '/tmp/chrona-repo',
        accessCount: 1,
        lastAction: 'repository_created',
      })],
      recentSources: [recentSource],
      recentFiles: [],
      recentSnapshots: [],
      recentComparePairs: [],
    });

    render(<RepositoryPage api={api} />);

    await user.type(screen.getByLabelText(/repository path/i), '/tmp/chrona-repo');
    await user.click(screen.getByRole('button', { name: /create repository/i }));
    await waitFor(() => expect(api.recordAccessEvent).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: /home/i }));

    expect(screen.getAllByText(/continue working/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('demo-source').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/recent repositories/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('chrona-repo').length).toBeGreaterThan(0);
  });

  test('renders the latest repository overview on Home', async () => {
    const { api } = createChronaApiMock();
    const user = userEvent.setup();
    vi.mocked(api.getRepositoryStatisticsOverview).mockResolvedValue(statisticsOverview({
      hasSnapshot: true,
      latestSnapshotId: 'latest',
      latestSnapshotName: 'Latest',
      latestSnapshotCreatedAt: '2026-07-07T00:00:00Z',
      latestFileCount: 12,
      latestLogicalBytes: 2 * 1024 * 1024,
      latestUniqueBlockCount: 7,
      fileKindStats: [
        { kind: 'document', fileCount: 8, totalBytesLatest: 1024 },
      ],
    }));

    render(<RepositoryPage api={api} />);
    await user.type(screen.getByLabelText(/repository path/i), '/tmp/chrona-repo');
    await user.click(screen.getByRole('button', { name: /open repository/i }));
    await user.click(screen.getByRole('button', { name: /home/i }));

    await waitFor(() => {
      expect(api.getRepositoryStatisticsOverview).toHaveBeenCalledWith('/tmp/chrona-repo');
    });
    expect(screen.getByText('Repository overview')).toBeInTheDocument();
    expect(screen.getByText('2.0 MiB')).toBeInTheDocument();
    expect(screen.getByText('Document')).toBeInTheDocument();
  });

  test('keeps Home access content visible when overview loading fails', async () => {
    const { api } = createChronaApiMock();
    const user = userEvent.setup();
    const recentSource = accessNode({ label: 'still-visible' });
    vi.mocked(api.getHomeSummary).mockResolvedValue({
      continueWorking: recentSource,
      pinned: [],
      recentRepositories: [],
      recentSources: [recentSource],
      recentFiles: [],
      recentSnapshots: [],
      recentComparePairs: [],
    });
    vi.mocked(api.getRepositoryStatisticsOverview).mockRejectedValue(
      new Error('overview failed'),
    );

    render(<RepositoryPage api={api} />);
    await user.type(screen.getByLabelText(/repository path/i), '/tmp/chrona-repo');
    await user.click(screen.getByRole('button', { name: /open repository/i }));
    await user.click(screen.getByRole('button', { name: /home/i }));

    expect(await screen.findByText('overview failed')).toBeInTheDocument();
    expect(screen.getAllByText('still-visible').length).toBeGreaterThan(0);
  });

  test('runs detailed statistics and forwards progress events', async () => {
    const { api, emitStatisticsProgress } = createChronaApiMock();
    const user = userEvent.setup();
    let resolveAnalysis: ((report: RepositoryStatisticsReport) => void) | undefined;
    vi.mocked(api.analyzeRepositoryStatistics).mockImplementation(
      () => new Promise((resolve) => {
        resolveAnalysis = resolve;
      }),
    );

    render(<RepositoryPage api={api} />);
    await user.type(screen.getByLabelText(/repository path/i), '/tmp/chrona-repo');
    await user.click(screen.getByRole('button', { name: /open repository/i }));
    await user.click(screen.getByRole('button', { name: /statistics/i }));
    await user.click(screen.getByRole('button', { name: /analyze repository/i }));

    emitStatisticsProgress({
      phase: 'blocks',
      processedSnapshots: 2,
      totalSnapshots: 2,
      processedBlocks: 4,
      totalBlocks: 10,
    });
    expect(await screen.findByText(/blocks 4 \/ 10/i)).toBeInTheDocument();
    expect(api.analyzeRepositoryStatistics).toHaveBeenCalledWith('/tmp/chrona-repo');

    resolveAnalysis?.(statisticsReport());
    expect(await screen.findByText('Dedup saved')).toBeInTheDocument();
    expect(screen.getByText('Unreferenced blocks')).toBeInTheDocument();
  });

  test('clears a detailed statistics report when another repository opens', async () => {
    const { api } = createChronaApiMock();
    const user = userEvent.setup();

    render(<RepositoryPage api={api} />);
    const repositoryInput = screen.getByLabelText(/repository path/i);
    await user.type(repositoryInput, '/tmp/repo-a');
    await user.click(screen.getByRole('button', { name: /open repository/i }));
    await user.click(screen.getByRole('button', { name: /statistics/i }));
    await user.click(screen.getByRole('button', { name: /analyze repository/i }));
    expect(await screen.findByText('Dedup saved')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^repository/i }));
    const nextRepositoryInput = screen.getByLabelText(/repository path/i);
    await user.clear(nextRepositoryInput);
    await user.type(nextRepositoryInput, '/tmp/repo-b');
    await user.click(screen.getByRole('button', { name: /open repository/i }));
    await user.click(screen.getByRole('button', { name: /statistics/i }));

    expect(screen.queryByText('Dedup saved')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze repository/i })).toBeInTheDocument();
  });

  test('verifies repository integrity and renders the report', async () => {
    const { api } = createChronaApiMock();
    const user = userEvent.setup();
    render(<RepositoryPage api={api} />);

    await user.type(screen.getByLabelText(/repository path/i), '/tmp/chrona-repo');
    await user.click(screen.getByRole('button', { name: /open repository/i }));
    await waitFor(() => expect(api.openRepository).toHaveBeenCalledWith('/tmp/chrona-repo'));

    await user.click(screen.getByRole('button', { name: /integrity/i }));
    await user.click(screen.getByRole('button', { name: /verify repository/i }));

    await waitFor(() => expect(api.verifyRepository).toHaveBeenCalledWith('/tmp/chrona-repo'));
    expect(screen.getByText(/integrity healthy/i)).toBeInTheDocument();
    expect(screen.getByText('Snapshots checked').nextElementSibling).toHaveTextContent('1');
    expect(screen.getByText('Missing blocks').nextElementSibling).toHaveTextContent('0');
    expect(screen.getByText('No integrity issues found')).toBeInTheDocument();
  });

  test('opens repository explorer and renders inventory rows', async () => {
    const { api } = createChronaApiMock();
    const user = userEvent.setup();
    render(<RepositoryPage api={api} />);

    await user.type(screen.getByLabelText(/repository path/i), '/tmp/chrona-repo');
    await user.click(screen.getByRole('button', { name: /open repository/i }));
    await waitFor(() => expect(api.openRepository).toHaveBeenCalledWith('/tmp/chrona-repo'));

    await user.click(screen.getByRole('button', { name: /explorer/i }));
    await user.click(screen.getByRole('button', { name: /refresh inventory/i }));

    await waitFor(() =>
      expect(api.getRepositoryInventory).toHaveBeenCalledWith('/tmp/chrona-repo'),
    );
    const inventorySummary = screen.getByText('Known files').closest('dl');
    expect(inventorySummary).not.toBeNull();
    expect(within(inventorySummary!).getByText('Known files').nextElementSibling)
      .toHaveTextContent('3');
    expect(within(inventorySummary!).getByText('Deleted in latest').nextElementSibling)
      .toHaveTextContent('1');
    expect(screen.getByText('notes.md')).toBeInTheDocument();
    expect(screen.getByText('old.txt')).toBeInTheDocument();
    expect(screen.getByText('deletedInLatest')).toBeInTheDocument();
    expect(screen.getByText('missing')).toBeInTheDocument();
  });

  test('filters inventory rows by path and snapshot state', async () => {
    const { api } = createChronaApiMock();
    const user = userEvent.setup();
    render(<RepositoryPage api={api} />);

    await user.type(screen.getByLabelText(/repository path/i), '/tmp/chrona-repo');
    await user.click(screen.getByRole('button', { name: /open repository/i }));
    await user.click(screen.getByRole('button', { name: /explorer/i }));
    await user.click(screen.getByRole('button', { name: /refresh inventory/i }));
    await screen.findByText('notes.md');

    await user.type(screen.getByLabelText(/file search/i), 'notes');
    expect(screen.getByText('notes.md')).toBeInTheDocument();
    expect(screen.queryByText('old.txt')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText(/file search/i));
    await user.selectOptions(
      screen.getByLabelText(/snapshot state/i),
      'deletedInLatest',
    );
    expect(screen.getByText('old.txt')).toBeInTheDocument();
    expect(screen.queryByText('notes.md')).not.toBeInTheDocument();
  });

  test('inspects a selected inventory file', async () => {
    const { api } = createChronaApiMock();
    const user = userEvent.setup();
    render(<RepositoryPage api={api} />);

    await user.type(screen.getByLabelText(/repository path/i), '/tmp/chrona-repo');
    await user.click(screen.getByRole('button', { name: /open repository/i }));
    await user.click(screen.getByRole('button', { name: /explorer/i }));
    await user.click(screen.getByRole('button', { name: /refresh inventory/i }));
    const inspectButton = await screen.findByRole('button', { name: /inspect notes.md/i });

    await user.click(inspectButton);

    await waitFor(() => {
      expect(api.inspectRepositoryFile).toHaveBeenCalledWith(
        '/tmp/chrona-repo',
        'notes.md',
      );
    });
    expect(await screen.findByRole('heading', { name: 'notes.md' })).toBeInTheDocument();
    expect(inspectButton).toHaveAttribute('aria-current', 'true');
  });

  test('keeps inventory visible when file inspection fails', async () => {
    const { api } = createChronaApiMock();
    vi.mocked(api.inspectRepositoryFile).mockRejectedValueOnce(new Error('inspect failed'));
    const user = userEvent.setup();
    render(<RepositoryPage api={api} />);

    await user.type(screen.getByLabelText(/repository path/i), '/tmp/chrona-repo');
    await user.click(screen.getByRole('button', { name: /open repository/i }));
    await user.click(screen.getByRole('button', { name: /explorer/i }));
    await user.click(screen.getByRole('button', { name: /refresh inventory/i }));
    await user.click(await screen.findByRole('button', { name: /inspect notes.md/i }));

    expect(await screen.findByText('inspect failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /inspect old.txt/i })).toBeInTheDocument();
  });

  test('updates the repository compression mode', async () => {
    const { api } = createChronaApiMock();
    const user = userEvent.setup();
    render(<RepositoryPage api={api} />);

    await user.type(screen.getByLabelText(/repository path/i), '/tmp/chrona-repo');
    await user.click(screen.getByRole('button', { name: /open repository/i }));
    await user.click(screen.getByRole('button', { name: /repository/i }));

    await user.selectOptions(screen.getByLabelText(/compression mode/i), 'fast');
    await user.click(screen.getByRole('button', { name: /apply compression mode/i }));

    await waitFor(() =>
      expect(api.setRepositoryCompressionMode)
        .toHaveBeenCalledWith('/tmp/chrona-repo', 'fast'),
    );
  });

});
