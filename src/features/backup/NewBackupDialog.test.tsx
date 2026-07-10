import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { NewBackupDialog } from './NewBackupDialog';
import { createChronaApiMock } from '../../test/chronaApiMock';
import type { Snapshot } from '../../shared/types/chrona';

afterEach(() => cleanup());

const snapshot: Snapshot = {
  schemaVersion: 1,
  id: 'snapshot-1',
  name: 'Final submission',
  createdAt: '2026-07-07T12:00:00Z',
  sourceRoot: '/picked/source-folder',
  summary: {
    fileCount: 1,
    totalOriginalBytes: 12,
    totalBlockReferences: 1,
    newBlockCount: 1,
    reusedBlockCount: 0,
    newStoredBytes: 8,
    newLogicalBytes: 12,
    compressionSavedBytes: 4,
    newRawBlockCount: 0,
    newZstdBlockCount: 1,
    newLz4BlockCount: 0,
  },
  files: [],
};

test('creates one snapshot from the selected source', async () => {
  const { api } = createChronaApiMock();
  const user = userEvent.setup();
  const onCompleted = vi.fn();
  vi.mocked(api.createSnapshot).mockResolvedValue(snapshot);

  render(
    <NewBackupDialog
      api={api}
      repositoryPath="/tmp/chrona-repo"
      entryPoint="global"
      onClose={vi.fn()}
      onOperationChange={vi.fn()}
      onCompleted={onCompleted}
    />,
  );

  await user.click(screen.getByRole('button', { name: /choose folder/i }));
  await user.clear(screen.getByLabelText(/backup name/i));
  await user.type(screen.getByLabelText(/backup name/i), 'Final submission');
  await user.click(screen.getByRole('button', { name: /^start backup$/i }));

  await waitFor(() => {
    expect(api.createSnapshot).toHaveBeenCalledWith(
      '/tmp/chrona-repo',
      '/picked/source-folder',
      'Final submission',
    );
  });
  expect(api.createSnapshot).toHaveBeenCalledOnce();
  expect(api.ingestBlocks).not.toHaveBeenCalled();
  expect(onCompleted).toHaveBeenCalledWith(snapshot);
});

test('starts backup in the background without locking the dialog controls', async () => {
  const { api } = createChronaApiMock();
  const user = userEvent.setup();
  const request = deferred<Snapshot>();
  const onClose = vi.fn();
  const onCompleted = vi.fn();
  vi.mocked(api.createSnapshot).mockReturnValue(request.promise);

  render(
    <NewBackupDialog
      api={api}
      repositoryPath="/tmp/chrona-repo"
      entryPoint="global"
      onClose={onClose}
      onOperationChange={vi.fn()}
      onCompleted={onCompleted}
    />,
  );

  await user.click(screen.getByRole('button', { name: /choose folder/i }));
  await user.click(screen.getByRole('button', { name: /^start backup$/i }));

  expect(api.createSnapshot).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: /close new backup/i })).toBeEnabled();
  expect(screen.getByRole('button', { name: /^cancel$/i })).toBeEnabled();
  expect(onCompleted).not.toHaveBeenCalled();

  request.resolve(snapshot);
  await waitFor(() => expect(onCompleted).toHaveBeenCalledWith(snapshot));
});

test('reports a background backup failure after dismissing the dialog', async () => {
  const { api } = createChronaApiMock();
  const user = userEvent.setup();
  const onClose = vi.fn();
  const onFailed = vi.fn();
  vi.mocked(api.createSnapshot).mockRejectedValue(new Error('backup failed'));

  render(
    <NewBackupDialog
      api={api}
      repositoryPath="/tmp/chrona-repo"
      entryPoint="global"
      onClose={onClose}
      onOperationChange={vi.fn()}
      onCompleted={vi.fn()}
      onFailed={onFailed}
    />,
  );

  await user.click(screen.getByRole('button', { name: /choose folder/i }));
  await user.click(screen.getByRole('button', { name: /^start backup$/i }));

  expect(onClose).toHaveBeenCalledOnce();
  await waitFor(() => expect(onFailed).toHaveBeenCalledWith('backup failed'));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('offers desktop actions only after a source is selected', async () => {
  const { api } = createChronaApiMock();
  const user = userEvent.setup();
  const desktopActions = {
    revealPath: vi.fn(async () => undefined),
    openPath: vi.fn(async () => undefined),
    copyText: vi.fn(async () => undefined),
  };

  render(
    <NewBackupDialog
      api={api}
      repositoryPath="/tmp/chrona-repo"
      entryPoint="global"
      desktopActions={desktopActions}
      onClose={vi.fn()}
      onOperationChange={vi.fn()}
      onCompleted={vi.fn()}
    />,
  );

  expect(screen.queryByRole('button', { name: 'Show source in file explorer' }))
    .not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /choose folder/i }));
  await user.click(screen.getByRole('button', { name: 'Show source in file explorer' }));
  await user.click(screen.getByRole('button', { name: 'Copy source path' }));

  expect(desktopActions.revealPath).toHaveBeenCalledWith('/picked/source-folder');
  expect(desktopActions.copyText).toHaveBeenCalledWith('/picked/source-folder');
});

test('keeps the global entry empty and pre-fills only a repeat entry', () => {
  const { api } = createChronaApiMock();
  const common = {
    api,
    repositoryPath: '/tmp/chrona-repo',
    onClose: vi.fn(),
    onOperationChange: vi.fn(),
    onCompleted: vi.fn(),
  };
  const { rerender } = render(
    <NewBackupDialog {...common} entryPoint="global" initialSourcePath="/ignored" />,
  );
  expect(screen.getByRole('textbox', { name: 'Source path' })).toHaveValue('');

  rerender(
    <NewBackupDialog {...common} entryPoint="repeat" initialSourcePath="/recent/source" />,
  );
  expect(screen.getByRole('textbox', { name: 'Source path' })).toHaveValue('/recent/source');
  expect(screen.getByRole('textbox', { name: 'Backup name' })).not.toHaveValue('');
});

test('falls back to source selection when repeat entry has no recent path', () => {
  const { api } = createChronaApiMock();
  render(
    <NewBackupDialog
      api={api}
      repositoryPath="/tmp/chrona-repo"
      entryPoint="repeat"
      onClose={vi.fn()}
      onOperationChange={vi.fn()}
      onCompleted={vi.fn()}
    />,
  );

  expect(screen.getByRole('textbox', { name: 'Source path' })).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Choose Folder' })).toBeEnabled();
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
