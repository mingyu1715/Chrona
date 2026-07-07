import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { AppShell } from '../../app/AppShell';
import { createChronaApiMock } from '../../test/chronaApiMock';
import type { OpenedRepository, RepositoryLibrary } from '../../shared/types/chrona';

afterEach(() => cleanup());

describe('repository library workspace', () => {
  test('opens the last active repository during bootstrap', async () => {
    const { api } = createChronaApiMock();
    render(<AppShell api={api}>Workspace</AppShell>);

    await waitFor(() => {
      expect(api.activateRegisteredRepository).toHaveBeenCalledWith('repo-id');
    });
    expect(screen.getByRole('button', { name: /Chrona Repository repository menu/i }))
      .toBeInTheDocument();
  });

  test('shows repository setup when the library is empty', async () => {
    const { api } = createChronaApiMock();
    vi.mocked(api.getRepositoryLibrary).mockResolvedValue({
      activeRepositoryId: null,
      repositories: [],
    });

    render(<AppShell api={api}>Workspace</AppShell>);

    expect(await screen.findByRole('heading', { name: /set up chrona/i }))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create in default location/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /add existing repository/i })).toBeEnabled();
  });

  test('creates a named repository in the default app location', async () => {
    const { api } = createChronaApiMock();
    const user = userEvent.setup();
    vi.mocked(api.getRepositoryLibrary).mockResolvedValue({
      activeRepositoryId: null,
      repositories: [],
    });

    render(<AppShell api={api}>Workspace</AppShell>);
    await user.type(await screen.findByLabelText(/repository name/i), 'Project Archive');
    await user.click(screen.getByRole('button', { name: /create in default location/i }));

    await waitFor(() => {
      expect(api.createManagedRepository).toHaveBeenCalledWith('Project Archive');
    });
    expect(screen.getByText('Workspace')).toBeInTheDocument();
  });

  test('opens native pickers only after choosing custom or existing storage', async () => {
    const { api } = createChronaApiMock();
    const user = userEvent.setup();
    vi.mocked(api.getRepositoryLibrary).mockResolvedValue({
      activeRepositoryId: null,
      repositories: [],
    });

    render(<AppShell api={api}>Workspace</AppShell>);
    const name = await screen.findByLabelText(/repository name/i);
    expect(api.selectRepositoryParentPath).not.toHaveBeenCalled();
    expect(api.selectExistingRepositoryPath).not.toHaveBeenCalled();

    await user.type(name, 'External Archive');
    await user.click(screen.getByRole('button', { name: /choose location/i }));
    expect(api.selectRepositoryParentPath).toHaveBeenCalledOnce();
    expect(api.createRepositoryAt).toHaveBeenCalledWith(
      'External Archive',
      '/picked/chrona-parent',
    );

    vi.mocked(api.getRepositoryLibrary).mockResolvedValue({
      activeRepositoryId: null,
      repositories: [],
    });
    render(<AppShell api={api}>Second workspace</AppShell>);
    const existingButtons = await screen.findAllByRole('button', {
      name: /add existing repository/i,
    });
    await user.click(existingButtons.at(-1)!);
    expect(api.selectExistingRepositoryPath).toHaveBeenCalledOnce();
    expect(api.registerExistingRepository).toHaveBeenCalledWith('/picked/chrona-existing');
  });

  test('switches connected repositories and relinks disconnected repositories', async () => {
    const { api, manifest, openedRepository, registration } = createChronaApiMock();
    const user = userEvent.setup();
    const library: RepositoryLibrary = {
      activeRepositoryId: 'repo-id',
      repositories: [
        registration,
        {
          ...registration,
          repositoryId: 'second-id',
          displayName: 'External Archive',
          path: '/missing/archive',
          connectionState: 'disconnected',
        },
      ],
    };
    const secondOpened: OpenedRepository = {
      registration: {
        ...library.repositories[1],
        path: '/picked/chrona-existing',
        connectionState: 'connected',
      },
      manifest: { ...manifest, repositoryId: 'second-id' },
    };
    vi.mocked(api.getRepositoryLibrary).mockResolvedValue(library);
    vi.mocked(api.relinkRegisteredRepository).mockResolvedValue(secondOpened);

    render(<AppShell api={api}>Workspace</AppShell>);
    await user.click(await screen.findByRole('button', {
      name: /Chrona Repository repository menu/i,
    }));
    await user.click(screen.getByRole('menuitem', { name: /locate External Archive folder/i }));

    expect(api.relinkRegisteredRepository).toHaveBeenCalledWith(
      'second-id',
      '/picked/chrona-existing',
    );
    expect(openedRepository.registration.repositoryId).toBe('repo-id');
  });

  test('removing registration never exposes a delete files action', async () => {
    const { api } = createChronaApiMock();
    const user = userEvent.setup();
    render(<AppShell api={api}>Workspace</AppShell>);

    await user.click(await screen.findByRole('button', {
      name: /Chrona Repository repository menu/i,
    }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /remove from chrona/i }))
      .toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: /delete files/i }))
      .not.toBeInTheDocument();
  });
});
