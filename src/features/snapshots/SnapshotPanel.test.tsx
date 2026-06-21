import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

import type { ChronaApi } from '../../shared/api/chronaApi';
import { SnapshotPanel } from './SnapshotPanel';

function apiMock(): ChronaApi {
  return {
    createRepository: vi.fn(),
    openRepository: vi.fn(),
    ingestBlocks: vi.fn(),
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
    expect(screen.getAllByText('Initial import').length).toBeGreaterThan(0);
    expect(screen.getByText('a.txt')).toBeInTheDocument();
  });
});
