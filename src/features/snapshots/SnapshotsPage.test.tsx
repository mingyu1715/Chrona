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
    createdAt: '2026-07-07T12:00:00Z',
    sourceRoot: '/tmp/source',
    fileCount: 12,
    totalOriginalBytes: 4096,
    newStoredBytes: 1024,
  },
  {
    id: 'draft',
    name: 'Draft',
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
