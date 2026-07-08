import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { createChronaApiMock } from '../../test/chronaApiMock';
import { RepositoryManagementPage } from './RepositoryManagementPage';

afterEach(() => cleanup());

function renderManagement() {
  const { registration } = createChronaApiMock();
  const repositories = [
    registration,
    {
      ...registration,
      repositoryId: 'external-id',
      displayName: 'External Archive',
      path: '/missing/external',
      lastOpenedAt: '2026-07-08T00:00:00Z',
      connectionState: 'disconnected' as const,
    },
    {
      ...registration,
      repositoryId: 'projects-id',
      displayName: 'Project Files',
      path: '/tmp/projects',
      lastOpenedAt: '2026-07-07T00:00:00Z',
    },
  ];
  const actions = {
    onCreateRepository: vi.fn(),
    onAddExistingRepository: vi.fn(),
    onActivate: vi.fn(),
    onRename: vi.fn(),
    onRelink: vi.fn(),
    onRemove: vi.fn(),
  };

  render(
    <RepositoryManagementPage
      repositories={repositories}
      activeRepositoryId={registration.repositoryId}
      {...actions}
    />,
  );
  return actions;
}

test('searches and sorts registered repositories', async () => {
  const user = userEvent.setup();
  renderManagement();

  await user.selectOptions(screen.getByRole('combobox', { name: 'Sort repositories' }), 'name');
  const rows = screen.getAllByRole('listitem');
  expect(within(rows[0]).getByText('Chrona Repository')).toBeInTheDocument();
  expect(within(rows[1]).getByText('External Archive')).toBeInTheDocument();

  await user.type(screen.getByRole('searchbox', { name: 'Search repositories' }), 'project');
  expect(screen.getByText('Project Files')).toBeInTheDocument();
  expect(screen.queryByText('Chrona Repository')).not.toBeInTheDocument();
});

test('activates connected repositories and locates disconnected ones', async () => {
  const user = userEvent.setup();
  const actions = renderManagement();

  await user.click(screen.getByRole('button', { name: 'Use Project Files' }));
  expect(actions.onActivate).toHaveBeenCalledWith('projects-id');

  await user.click(screen.getByRole('button', { name: 'Locate External Archive folder' }));
  expect(actions.onRelink).toHaveBeenCalledWith('external-id');
});

test('renames and removes only the selected registration', async () => {
  const user = userEvent.setup();
  const actions = renderManagement();

  await user.click(screen.getByRole('button', { name: 'Rename Chrona Repository' }));
  const input = screen.getByRole('textbox', { name: 'Repository name' });
  await user.clear(input);
  await user.type(input, 'School Archive');
  await user.click(screen.getByRole('button', { name: 'Save name' }));
  expect(actions.onRename).toHaveBeenCalledWith('repo-id', 'School Archive');

  await user.click(screen.getByRole('button', { name: 'Remove Project Files from Chrona' }));
  expect(actions.onRemove).toHaveBeenCalledWith('projects-id');
  expect(screen.queryByText(/delete files/i)).not.toBeInTheDocument();
});
