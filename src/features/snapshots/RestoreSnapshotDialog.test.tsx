import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import type { Snapshot } from '../../shared/types/chrona';
import { createChronaApiMock } from '../../test/chronaApiMock';
import { RestoreSnapshotDialog } from './RestoreSnapshotDialog';

afterEach(() => cleanup());

const snapshot: Snapshot = {
  schemaVersion: 1,
  id: 'snapshot-1',
  name: 'School files',
  createdAt: '2026-07-08T00:00:00Z',
  sourceRoot: '/tmp/source',
  summary: {
    fileCount: 1,
    totalOriginalBytes: 4,
    totalBlockReferences: 1,
    newBlockCount: 1,
    reusedBlockCount: 0,
    newStoredBytes: 4,
    newLogicalBytes: 4,
    compressionSavedBytes: 0,
    newRawBlockCount: 1,
    newZstdBlockCount: 0,
    newLz4BlockCount: 0,
  },
  files: [],
};

test('opens the restore folder only after restore completes', async () => {
  const { api } = createChronaApiMock();
  const user = userEvent.setup();
  const desktopActions = {
    revealPath: vi.fn(async () => undefined),
    openPath: vi.fn(async () => undefined),
    copyText: vi.fn(async () => undefined),
  };
  vi.mocked(api.selectRestoreTargetPath).mockResolvedValue('/tmp/restore');
  vi.mocked(api.restoreSnapshot).mockResolvedValue({
    schemaVersion: 1,
    snapshotId: snapshot.id,
    targetPath: '/tmp/restore',
    restoredFileCount: 1,
    restoredBytes: 4,
    restoredBlockCount: 1,
    files: [],
  });

  render(
    <RestoreSnapshotDialog
      api={api}
      repositoryPath="/tmp/repository"
      snapshot={snapshot}
      desktopActions={desktopActions}
      onClose={vi.fn()}
    />,
  );

  expect(screen.queryByRole('button', { name: 'Open restore folder' }))
    .not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Choose target' }));
  await user.click(screen.getByRole('button', { name: 'Restore' }));
  expect(api.restoreSnapshot).not.toHaveBeenCalled();
  const confirmation = screen.getByRole('dialog', { name: 'Restore School files?' });
  expect(confirmation).toBeInTheDocument();

  await user.click(within(confirmation).getByRole('button', { name: 'Restore' }));
  await waitFor(() => expect(api.restoreSnapshot).toHaveBeenCalledOnce());
  await user.click(screen.getByRole('button', { name: 'Open restore folder' }));

  expect(desktopActions.openPath).toHaveBeenCalledWith('/tmp/restore');
});
