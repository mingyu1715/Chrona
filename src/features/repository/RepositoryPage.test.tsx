import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { RepositoryPage } from './RepositoryPage';
import type { ChronaApi } from '../../shared/api/chronaApi';
import type { BlockIngestProgress, RepositoryManifest } from '../../shared/types/chrona';

afterEach(() => cleanup());

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
    selectRepositoryPath: vi.fn(async () => '/picked/chrona-repo'),
    selectSourceFilePath: vi.fn(async () => '/picked/source.txt'),
    selectSourceFolderPath: vi.fn(async () => '/picked/source-folder'),
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

});
