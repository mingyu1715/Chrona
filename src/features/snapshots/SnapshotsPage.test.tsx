import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { SnapshotsPage } from './SnapshotsPage';
import { createChronaApiMock } from '../../test/chronaApiMock';
import type { Snapshot, SnapshotIndexItem } from '../../shared/types/chrona';

afterEach(() => cleanup());

const items: SnapshotIndexItem[] = [
  {
    id: 'ready',
    name: 'Presentation ready',
    sourceId: 'source-1',
    createdAt: '2026-07-07T12:00:00Z',
    sourceRoot: '/tmp/source',
    fileCount: 12,
    totalOriginalBytes: 4096,
    newStoredBytes: 1024,
  },
  {
    id: 'draft',
    name: 'Draft',
    sourceId: 'source-1',
    createdAt: '2026-07-06T12:00:00Z',
    sourceRoot: '/tmp/source',
    fileCount: 10,
    totalOriginalBytes: 3072,
    newStoredBytes: 2048,
  },
];

const detail: Snapshot = {
  schemaVersion: 1,
  id: 'ready',
  name: 'Presentation ready',
  sourceId: 'source-1',
  createdAt: '2026-07-07T12:00:00Z',
  sourceRoot: '/tmp/source',
  summary: {
    fileCount: 12,
    totalOriginalBytes: 4096,
    totalBlockReferences: 12,
    newBlockCount: 2,
    reusedBlockCount: 10,
    newStoredBytes: 1024,
    newLogicalBytes: 2048,
    compressionSavedBytes: 1024,
    newRawBlockCount: 0,
    newZstdBlockCount: 2,
    newLz4BlockCount: 0,
  },
  files: [],
};

function setup() {
  const mock = createChronaApiMock();
  vi.mocked(mock.api.listSnapshots).mockResolvedValue(items);
  vi.mocked(mock.api.getSnapshot).mockImplementation(async (_path, id) => ({
    ...detail,
    id,
    name: items.find((item) => item.id === id)?.name ?? id,
  }));
  return mock;
}

test('keeps snapshot list visible while switching detail and compare views', async () => {
  const { api } = setup();
  const user = userEvent.setup();
  render(<SnapshotsPage api={api} repositoryPath="/tmp/chrona-repo" onNewBackup={vi.fn()} />);

  await user.click(await screen.findByRole('button', { name: /open presentation ready/i }));
  expect(await screen.findByRole('heading', { name: /presentation ready/i })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /^compare snapshots$/i }));
  expect(screen.getByLabelText(/base snapshot/i)).toBeInTheDocument();
  expect(screen.getByRole('list', { name: /snapshot list/i })).toBeInTheDocument();
});

test('restore opens a separate dialog and restores to the selected target', async () => {
  const { api } = setup();
  const user = userEvent.setup();
  vi.mocked(api.restoreSnapshot).mockResolvedValue({
    schemaVersion: 1,
    snapshotId: 'ready',
    targetPath: '/tmp/restore',
    restoredFileCount: 12,
    restoredBytes: 4096,
    restoredBlockCount: 12,
    files: [],
  });
  vi.mocked(api.selectRestoreTargetPath).mockResolvedValue('/tmp/restore');
  render(<SnapshotsPage api={api} repositoryPath="/tmp/chrona-repo" onNewBackup={vi.fn()} />);

  await user.click(await screen.findByRole('button', { name: /open presentation ready/i }));
  await user.click(await screen.findByRole('button', { name: /restore snapshot/i }));
  const dialog = screen.getByRole('dialog', { name: /restore presentation ready/i });
  expect(dialog).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /choose target/i }));
  await user.click(screen.getByRole('button', { name: /^restore$/i }));
  const confirmation = screen.getByRole('dialog', { name: /restore presentation ready\?/i });
  await user.click(within(confirmation).getByRole('button', { name: /^restore$/i }));
  await waitFor(() => {
    expect(api.restoreSnapshot).toHaveBeenCalledWith('/tmp/chrona-repo', 'ready', '/tmp/restore');
  });
});

test('restores the selected snapshot back to its original source after confirmation', async () => {
  const { api } = setup();
  const user = userEvent.setup();
  const onOperationChange = vi.fn();
  const onRestoreCompleted = vi.fn();
  vi.mocked(api.restoreSnapshotToSource).mockResolvedValue({
    schemaVersion: 1,
    snapshotId: 'ready',
    sourceId: 'source-1',
    sourcePath: '/tmp/source',
    safetySnapshotId: 'safety',
    operationId: 'operation-1',
    restoredFileCount: 12,
    restoredBytes: 4096,
    restoredBlockCount: 12,
    quarantinedFileCount: 1,
    files: [],
    quarantinedFiles: [],
  });
  render(
    <SnapshotsPage
      api={api}
      repositoryPath="/tmp/chrona-repo"
      onNewBackup={vi.fn()}
      onOperationChange={onOperationChange}
      onRestoreCompleted={onRestoreCompleted}
    />,
  );

  await user.click(await screen.findByRole('button', { name: /open presentation ready/i }));
  await user.click(await screen.findByRole('button', { name: /^restore original$/i }));
  const confirmation = screen.getByRole('dialog', { name: /restore original location\?/i });
  await user.click(within(confirmation).getByRole('button', { name: /^restore$/i }));

  await waitFor(() => {
    expect(api.restoreSnapshotToSource).toHaveBeenCalledWith('/tmp/chrona-repo', 'source-1', 'ready');
  });
  expect(onRestoreCompleted).toHaveBeenCalledWith(expect.objectContaining({
    sourcePath: '/tmp/source',
    safetySnapshotId: 'safety',
  }));
  expect(onOperationChange).toHaveBeenCalledWith(expect.objectContaining({
    kind: 'restore',
    currentFile: 'Presentation ready',
  }));
  expect(onOperationChange).toHaveBeenLastCalledWith(null);
});

test('starts a repeat backup for the selected source from the snapshots page', async () => {
  const { api } = setup();
  const user = userEvent.setup();
  const onNewBackup = vi.fn();
  render(
    <SnapshotsPage
      api={api}
      repositoryPath="/tmp/chrona-repo"
      selectedSourceId="source-1"
      onNewBackup={onNewBackup}
    />,
  );

  await user.click(screen.getByRole('button', { name: /new backup/i }));

  expect(onNewBackup).toHaveBeenCalledWith({
    entryPoint: 'repeat',
    initialSourcePath: '/tmp/source',
  });
});

test('deletes the selected snapshot after confirmation', async () => {
  const { api } = setup();
  const deleteSnapshot = vi.fn(async () => [items[1]]);
  (api as unknown as { deleteSnapshot: typeof deleteSnapshot }).deleteSnapshot = deleteSnapshot;
  const user = userEvent.setup();
  render(<SnapshotsPage api={api} repositoryPath="/tmp/chrona-repo" onNewBackup={vi.fn()} />);

  await user.click(await screen.findByRole('button', { name: /open presentation ready/i }));
  await user.click(await screen.findByRole('button', { name: /^delete snapshot$/i }));
  const confirmation = screen.getByRole('dialog', { name: /delete snapshot\?/i });
  await user.click(within(confirmation).getByRole('button', { name: /^delete$/i }));

  await waitFor(() => {
    expect(deleteSnapshot).toHaveBeenCalledWith('/tmp/chrona-repo', 'ready');
  });
  expect(screen.queryByRole('button', { name: /open presentation ready/i })).not.toBeInTheDocument();
});
