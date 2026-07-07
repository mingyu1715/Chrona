import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { ExplorerPage } from './ExplorerPage';
import { createChronaApiMock } from '../../test/chronaApiMock';

afterEach(() => cleanup());

test('loads inventory and inspects a file in the same workspace', async () => {
  const { api } = createChronaApiMock();
  const user = userEvent.setup();
  render(<ExplorerPage api={api} repositoryPath="/tmp/chrona-repo" />);

  await user.click(await screen.findByRole('button', { name: /refresh files/i }));
  await user.click(await screen.findByRole('button', { name: /inspect notes\.md/i }));

  expect(await screen.findByRole('heading', { name: 'notes.md' })).toBeInTheDocument();
  expect(screen.getByTestId('file-list-pane')).toHaveClass('workspace-pane-scroll');
  expect(screen.getByTestId('file-detail-pane')).toHaveClass('workspace-pane-scroll');
});

test('filters recorded paths without another inventory request', async () => {
  const { api } = createChronaApiMock();
  const user = userEvent.setup();
  render(<ExplorerPage api={api} repositoryPath="/tmp/chrona-repo" />);

  expect(await screen.findByRole('button', { name: /inspect notes\.md/i })).toBeInTheDocument();
  await user.type(screen.getByRole('searchbox', { name: /file search/i }), 'old');

  expect(screen.queryByRole('button', { name: /inspect notes\.md/i })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /inspect old\.txt/i })).toBeInTheDocument();
  expect(api.getRepositoryInventory).toHaveBeenCalledOnce();
});

test('keeps the file list usable when inspection fails', async () => {
  const { api } = createChronaApiMock();
  const user = userEvent.setup();
  vi.mocked(api.inspectRepositoryFile).mockRejectedValue(new Error('inspection failed'));
  render(<ExplorerPage api={api} repositoryPath="/tmp/chrona-repo" />);

  await user.click(await screen.findByRole('button', { name: /inspect notes\.md/i }));

  expect(await screen.findByText('inspection failed')).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /inspect old\.txt/i })).toBeEnabled();
  });
});
