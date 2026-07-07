import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { ChronaApi } from '../../shared/api/chronaApi';
import { createChronaApiMock } from '../../test/chronaApiMock';
import { SnapshotPanel } from './SnapshotPanel';

afterEach(() => cleanup());

function apiMock(): ChronaApi {
  const { api } = createChronaApiMock();

  vi.mocked(api.createSnapshot).mockResolvedValue({
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
      newLogicalBytes: 5,
      compressionSavedBytes: 0,
      newRawBlockCount: 1,
      newZstdBlockCount: 0,
      newLz4BlockCount: 0,
    },
    files: [],
  });
  vi.mocked(api.listSnapshots).mockResolvedValue([
    {
      id: '20260619T103000Z_8f31c2',
      name: 'Initial import',
      createdAt: '2026-06-19T10:30:00Z',
      sourceRoot: '/tmp/source',
      fileCount: 1,
      totalOriginalBytes: 5,
      newStoredBytes: 5,
    },
  ]);
  vi.mocked(api.getSnapshot).mockResolvedValue({
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
      newLogicalBytes: 5,
      compressionSavedBytes: 0,
      newRawBlockCount: 1,
      newZstdBlockCount: 0,
      newLz4BlockCount: 0,
    },
    files: [
      {
        relativePath: 'a.txt',
        sizeBytes: 5,
        modifiedAt: '2026-06-19T10:00:00Z',
        blocks: [],
      },
    ],
  });

  return api;
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
    const api = apiMock();
    vi.mocked(api.selectRestoreTargetPath).mockResolvedValue('/tmp/restore-target');
    vi.mocked(api.restoreSnapshot).mockResolvedValue({
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
    });
    const user = userEvent.setup();
    render(
      <SnapshotPanel
        api={api}
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
