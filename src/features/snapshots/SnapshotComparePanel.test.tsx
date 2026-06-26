import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import type { ChronaApi } from '../../shared/api/chronaApi';
import type { SnapshotComparison, SnapshotIndexItem } from '../../shared/types/chrona';
import { SnapshotComparePanel } from './SnapshotComparePanel';

function comparison(): SnapshotComparison {
  return {
    schemaVersion: 1,
    baseSnapshotId: 'base',
    targetSnapshotId: 'target',
    summary: {
      addedFileCount: 1,
      deletedFileCount: 1,
      modifiedFileCount: 1,
      unchangedFileCount: 2,
      totalBeforeBytes: 12,
      totalAfterBytes: 14,
      addedBytes: 4,
      deletedBytes: 2,
      modifiedBeforeBytes: 6,
      modifiedAfterBytes: 8,
      addedBlockReferences: 2,
      removedBlockReferences: 1,
      sharedBlockReferences: 3,
    },
    files: [
      {
        relativePath: 'added.txt',
        changeType: 'added',
        before: null,
        after: {
          sizeBytes: 4,
          modifiedAt: '2026-06-23T00:00:00Z',
          blockHashes: ['a'],
        },
        blocks: {
          beforeBlockReferences: 0,
          afterBlockReferences: 1,
          addedBlockReferences: 1,
          removedBlockReferences: 0,
          sharedBlockReferences: 0,
        },
      },
      {
        relativePath: 'modified.txt',
        changeType: 'modified',
        before: {
          sizeBytes: 6,
          modifiedAt: '2026-06-23T00:00:00Z',
          blockHashes: ['old'],
        },
        after: {
          sizeBytes: 8,
          modifiedAt: '2026-06-23T00:00:00Z',
          blockHashes: ['new'],
        },
        blocks: {
          beforeBlockReferences: 1,
          afterBlockReferences: 1,
          addedBlockReferences: 1,
          removedBlockReferences: 1,
          sharedBlockReferences: 0,
        },
      },
    ],
  };
}

function apiMock(result: SnapshotComparison): ChronaApi {
  return {
    createRepository: vi.fn(),
    openRepository: vi.fn(),
    ingestBlocks: vi.fn(),
    createSnapshot: vi.fn(),
    listSnapshots: vi.fn(),
    getSnapshot: vi.fn(),
    restoreSnapshot: vi.fn(),
    compareSnapshots: vi.fn(async () => result),
    selectRepositoryPath: vi.fn(async () => null),
    selectSourceFilePath: vi.fn(async () => null),
    selectSourceFolderPath: vi.fn(async () => null),
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
    onBlockIngestProgress: vi.fn(async () => () => undefined),
  };
}

const snapshots: SnapshotIndexItem[] = [
  {
    id: 'base',
    name: 'Base snapshot',
    createdAt: '2026-06-23T00:00:00Z',
    sourceRoot: '/tmp/source',
    fileCount: 3,
    totalOriginalBytes: 12,
    newStoredBytes: 12,
  },
  {
    id: 'target',
    name: 'Target snapshot',
    createdAt: '2026-06-23T00:01:00Z',
    sourceRoot: '/tmp/source',
    fileCount: 4,
    totalOriginalBytes: 14,
    newStoredBytes: 4,
  },
];

describe('SnapshotComparePanel', () => {
  test('compares two snapshots and renders summary and file rows', async () => {
    const api = apiMock(comparison());
    const user = userEvent.setup();

    render(
      <SnapshotComparePanel
        api={api}
        repositoryPath="/tmp/repo"
        snapshots={snapshots}
      />,
    );

    await user.click(screen.getByRole('button', { name: /compare snapshots/i }));

    await waitFor(() =>
      expect(api.compareSnapshots).toHaveBeenCalledWith('/tmp/repo', 'base', 'target'),
    );
    expect(api.recordAccessEvent).toHaveBeenCalledWith(
      '/tmp/repo',
      expect.objectContaining({
        kind: 'comparePair',
        baseSnapshotId: 'base',
        targetSnapshotId: 'target',
        action: 'compare_pair_opened',
      }),
    );
    expect(screen.getByText('1 added')).toBeInTheDocument();
    expect(screen.getByText('1 modified')).toBeInTheDocument();
    expect(screen.getByText('2 unchanged')).toBeInTheDocument();
    expect(screen.getByText('added.txt')).toBeInTheDocument();
    expect(screen.getByText('modified.txt')).toBeInTheDocument();
    expect(screen.getByText(/3 shared refs/i)).toBeInTheDocument();
  });
});
