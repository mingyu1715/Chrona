import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { RepositoryPage } from './RepositoryPage';
import type { ChronaApi } from '../../shared/api/chronaApi';
import type { AccessNode, BlockIngestProgress, RepositoryManifest } from '../../shared/types/chrona';

afterEach(() => cleanup());

function accessNode(overrides: Partial<AccessNode> = {}): AccessNode {
  return {
    key: 'source:/tmp/source',
    kind: 'source',
    label: 'source',
    path: '/tmp/source',
    repositoryId: 'repo-id',
    snapshotId: null,
    baseSnapshotId: null,
    targetSnapshotId: null,
    accessCount: 2,
    lastAccessedAt: '2026-06-26T00:00:00Z',
    lastAction: 'ingest_completed',
    pinned: false,
    ...overrides,
  };
}

function createApiMock() {
  const manifest: RepositoryManifest = {
    schemaVersion: 1,
    appVersion: '0.1.0',
    repositoryId: 'repo-id',
    createdAt: '2026-06-19T00:00:00Z',
    blockStrategy: { type: 'fixed', sizeBytes: 1048576, hash: 'sha256' },
  };
  let progressHandler: ((event: BlockIngestProgress) => void) | undefined;
  const api: ChronaApi = {
    createRepository: vi.fn(async () => manifest),
    openRepository: vi.fn(async () => manifest),
    ingestBlocks: vi.fn(async () => ({
      fileCount: 2,
      totalInputBytes: 18,
      totalBlockReferences: 2,
      newBlockCount: 1,
      reusedBlockCount: 1,
      newlyStoredBytes: 9,
      files: [],
    })),
    createSnapshot: vi.fn(),
    listSnapshots: vi.fn(async () => []),
    getSnapshot: vi.fn(),
    restoreSnapshot: vi.fn(),
    verifyRepository: vi.fn(async () => ({
      schemaVersion: 1,
      repositoryPath: '/tmp/chrona-repo',
      checkedAt: '2026-06-26T00:00:00Z',
      status: 'healthy' as const,
      snapshotCount: 1,
      fileCount: 2,
      blockReferenceCount: 2,
      uniqueBlockCount: 1,
      missingBlockCount: 0,
      corruptBlockCount: 0,
      issues: [],
    })),
    getRepositoryInventory: vi.fn(async () => ({
      schemaVersion: 1,
      repositoryPath: '/tmp/chrona-repo',
      generatedAt: '2026-06-27T00:00:00Z',
      snapshotCount: 2,
      knownFileCount: 3,
      latestFileCount: 2,
      deletedInLatestCount: 1,
      sourceExistsCount: 1,
      sourceMissingCount: 1,
      sourceRootMissingCount: 0,
      totalOriginalBytesLatest: 12,
      totalBlockReferencesLatest: 2,
      uniqueBlockCountLatest: 2,
      kindStats: [
        { kind: 'document' as const, fileCount: 1, totalBytesLatest: 5 },
        { kind: 'image' as const, fileCount: 1, totalBytesLatest: 7 },
      ],
      files: [
        {
          relativePath: 'notes.md',
          fileName: 'notes.md',
          extension: 'md',
          kind: 'document' as const,
          snapshotState: 'presentInLatest' as const,
          sourceState: 'exists' as const,
          latestSizeBytes: 5,
          latestModifiedAt: '2026-06-27T00:00:00Z',
          firstSeenSnapshotId: 'first',
          firstSeenAt: '2026-06-26T00:00:00Z',
          lastSeenSnapshotId: 'latest',
          lastSeenAt: '2026-06-27T00:00:00Z',
          seenInSnapshotCount: 2,
          blockReferenceCountLatest: 1,
        },
        {
          relativePath: 'old.txt',
          fileName: 'old.txt',
          extension: 'txt',
          kind: 'text' as const,
          snapshotState: 'deletedInLatest' as const,
          sourceState: 'missing' as const,
          latestSizeBytes: null,
          latestModifiedAt: null,
          firstSeenSnapshotId: 'first',
          firstSeenAt: '2026-06-26T00:00:00Z',
          lastSeenSnapshotId: 'first',
          lastSeenAt: '2026-06-26T00:00:00Z',
          seenInSnapshotCount: 1,
          blockReferenceCountLatest: 0,
        },
      ],
    })),
    compareSnapshots: vi.fn(async () => ({
      schemaVersion: 1,
      baseSnapshotId: 'base',
      targetSnapshotId: 'target',
      summary: {
        addedFileCount: 0,
        deletedFileCount: 0,
        modifiedFileCount: 0,
        unchangedFileCount: 0,
        totalBeforeBytes: 0,
        totalAfterBytes: 0,
        addedBytes: 0,
        deletedBytes: 0,
        modifiedBeforeBytes: 0,
        modifiedAfterBytes: 0,
        addedBlockReferences: 0,
        removedBlockReferences: 0,
        sharedBlockReferences: 0,
      },
      files: [],
    })),
    selectRepositoryPath: vi.fn(async () => '/picked/chrona-repo'),
    selectSourceFilePath: vi.fn(async () => '/picked/source.txt'),
    selectSourceFolderPath: vi.fn(async () => '/picked/source-folder'),
    selectRestoreTargetPath: vi.fn(async () => null),
    recordAccessEvent: vi.fn(),
    getHomeSummary: vi.fn(async () => ({
      continueWorking: null,
      pinned: [],
      recentRepositories: [],
      recentSources: [],
      recentFiles: [],
      recentSnapshots: [],
      recentComparePairs: [],
    })),
    pinAccessItem: vi.fn(),
    unpinAccessItem: vi.fn(),
    clearAccessHistory: vi.fn(async () => ({
      schemaVersion: 1,
      removedCount: 0,
      remainingCount: 0,
    })),
    onBlockIngestProgress: vi.fn(async (handler) => {
      progressHandler = handler;
      return () => undefined;
    }),
  };
  return { api, emitProgress: (event: BlockIngestProgress) => progressHandler?.(event) };
}

describe('RepositoryPage', () => {
  test('creates a repository, ingests blocks, and displays progress and summary', async () => {
    const { api, emitProgress } = createApiMock();
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
    const { api } = createApiMock();
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
    const { api } = createApiMock();
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
    const { api } = createApiMock();
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

  test('verifies repository integrity and renders the report', async () => {
    const { api } = createApiMock();
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
    const { api } = createApiMock();
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
    const { api } = createApiMock();
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

});
