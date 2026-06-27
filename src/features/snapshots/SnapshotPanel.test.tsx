import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { ChronaApi } from '../../shared/api/chronaApi';
import { SnapshotPanel } from './SnapshotPanel';

afterEach(() => cleanup());

function apiMock(): ChronaApi {
  return {
    createRepository: vi.fn(),
    openRepository: vi.fn(),
    ingestBlocks: vi.fn(),
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
    createSnapshot: vi.fn(async () => ({
      schemaVersion: 1,
      id: '20260619T103000Z_8f31c2',
      name: 'Initial import',
      createdAt: '2026-06-19T10:30:00Z',
      sourceRoot: '/tmp/source',
      summary: {
        fileCount: 1,
        totalOriginalBytes: 5,
        totalBlockReferences: 1,
        newBlockCount: 1,
        reusedBlockCount: 0,
        newStoredBytes: 5,
      },
      files: [],
    })),
    listSnapshots: vi.fn(async () => [
      {
        id: '20260619T103000Z_8f31c2',
        name: 'Initial import',
        createdAt: '2026-06-19T10:30:00Z',
        sourceRoot: '/tmp/source',
        fileCount: 1,
        totalOriginalBytes: 5,
        newStoredBytes: 5,
      },
    ]),
    selectRepositoryPath: vi.fn(async () => null),
    selectSourceFilePath: vi.fn(async () => null),
    selectSourceFolderPath: vi.fn(async () => null),
    selectRestoreTargetPath: vi.fn(async () => null),
    restoreSnapshot: vi.fn(),
    verifyRepository: vi.fn(async () => ({
      schemaVersion: 1,
      repositoryPath: '/tmp/repo',
      checkedAt: '2026-06-26T00:00:00Z',
      status: 'healthy' as const,
      snapshotCount: 0,
      fileCount: 0,
      blockReferenceCount: 0,
      uniqueBlockCount: 0,
      missingBlockCount: 0,
      corruptBlockCount: 0,
      issues: [],
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
    getSnapshot: vi.fn(async () => ({
      schemaVersion: 1,
      id: '20260619T103000Z_8f31c2',
      name: 'Initial import',
      createdAt: '2026-06-19T10:30:00Z',
      sourceRoot: '/tmp/source',
      summary: {
        fileCount: 1,
        totalOriginalBytes: 5,
        totalBlockReferences: 1,
        newBlockCount: 1,
        reusedBlockCount: 0,
        newStoredBytes: 5,
      },
      files: [
        {
          relativePath: 'a.txt',
          sizeBytes: 5,
          modifiedAt: '2026-06-19T10:00:00Z',
          blocks: [],
        },
      ],
    })),
  };
}

describe('SnapshotPanel', () => {
  test('creates and displays a snapshot', async () => {
    const api = apiMock();
    const user = userEvent.setup();
    render(
      <SnapshotPanel
        api={api}
        repositoryPath="/tmp/repo"
        sourcePath="/tmp/source"
        repositoryOpen
      />,
    );

    await user.type(screen.getByLabelText(/snapshot name/i), 'Initial import');
    await user.click(screen.getByRole('button', { name: /create snapshot/i }));

    await waitFor(() =>
      expect(api.createSnapshot).toHaveBeenCalledWith(
        '/tmp/repo',
        '/tmp/source',
        'Initial import',
      ),
    );
    expect(api.recordAccessEvent).toHaveBeenCalledWith(
      '/tmp/repo',
      expect.objectContaining({
        kind: 'snapshot',
        snapshotId: '20260619T103000Z_8f31c2',
        action: 'snapshot_created',
      }),
    );
    expect(screen.getAllByText('Initial import').length).toBeGreaterThan(0);
    expect(screen.getByText('a.txt')).toBeInTheDocument();
  });

  test('restores the selected snapshot into a chosen target directory', async () => {
    const api = {
      ...apiMock(),
      selectRestoreTargetPath: vi.fn(async () => '/tmp/restore-target'),
      restoreSnapshot: vi.fn(async () => ({
        schemaVersion: 1,
        snapshotId: '20260619T103000Z_8f31c2',
        targetPath: '/tmp/restore-target',
        restoredFileCount: 1,
        restoredBytes: 5,
        restoredBlockCount: 1,
        files: [
          {
            relativePath: 'a.txt',
            sizeBytes: 5,
            blockCount: 1,
          },
        ],
      })),
    };
    const user = userEvent.setup();
    render(
      <SnapshotPanel
        api={api as unknown as ChronaApi}
        repositoryPath="/tmp/repo"
        sourcePath="/tmp/source"
        repositoryOpen
      />,
    );

    await user.click(await screen.findByRole('button', { name: /initial import/i }));
    await user.type(screen.getByLabelText(/restore target/i), '/tmp/restore-target');
    await waitFor(() =>
      expect(screen.getByLabelText(/restore target/i)).toHaveValue('/tmp/restore-target'),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /restore snapshot/i })).not.toBeDisabled(),
    );
    await user.click(screen.getByRole('button', { name: /restore snapshot/i }));

    await waitFor(() =>
      expect(api.restoreSnapshot).toHaveBeenCalledWith(
        '/tmp/repo',
        '20260619T103000Z_8f31c2',
        '/tmp/restore-target',
      ),
    );
    expect(screen.getByText('Restored files')).toBeInTheDocument();
    expect(screen.getByText('Restored bytes')).toBeInTheDocument();
  });

});
