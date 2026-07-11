import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import type { RestoreReport, Snapshot } from '../../shared/types/chrona';
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

test('starts restore in the background after confirmation', async () => {
  const { api } = createChronaApiMock();
  const user = userEvent.setup();
  const request = deferred<RestoreReport>();
  const onClose = vi.fn();
  const onOperationChange = vi.fn();
  const onCompleted = vi.fn();
  vi.mocked(api.selectRestoreTargetPath).mockResolvedValue('/tmp/restore');
  vi.mocked(api.restoreSnapshot).mockReturnValue(request.promise);
  const report: RestoreReport = {
    schemaVersion: 1,
    snapshotId: snapshot.id,
    targetPath: '/tmp/restore',
    restoredFileCount: 1,
    restoredBytes: 4,
    restoredBlockCount: 1,
    files: [],
  };

  render(
    <RestoreSnapshotDialog
      api={api}
      repositoryPath="/tmp/repository"
      snapshot={snapshot}
      onClose={onClose}
      onOperationChange={onOperationChange}
      onCompleted={onCompleted}
    />,
  );

  await user.click(screen.getByRole('button', { name: 'Choose target' }));
  await user.click(screen.getByRole('button', { name: 'Restore' }));
  expect(api.restoreSnapshot).not.toHaveBeenCalled();
  const confirmation = screen.getByRole('dialog', { name: 'Restore School files?' });
  expect(confirmation).toBeInTheDocument();

  await user.click(within(confirmation).getByRole('button', { name: 'Restore' }));
  expect(api.restoreSnapshot).toHaveBeenCalledWith('/tmp/repository', snapshot.id, '/tmp/restore');
  expect(onClose).toHaveBeenCalledOnce();
  expect(onOperationChange).toHaveBeenLastCalledWith({
    kind: 'restore',
    label: 'Restoring snapshot',
    currentFile: 'School files',
    processedBytes: 0,
    totalBytes: 0,
    phase: '/tmp/restore',
  });
  expect(onCompleted).not.toHaveBeenCalled();

  request.resolve(report);
  await waitFor(() => expect(onCompleted).toHaveBeenCalledWith(report));
  expect(onOperationChange).toHaveBeenLastCalledWith(null);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}
