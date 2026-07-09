import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { I18nProvider } from '../../shared/i18n/I18nProvider';
import { AppPreferencesProvider } from '../../shared/preferences/AppPreferencesProvider';
import type { PreferencesStore } from '../../shared/preferences/appPreferences';
import { createChronaApiMock } from '../../test/chronaApiMock';
import { SettingsPage } from './SettingsPage';

afterEach(() => cleanup());

function createStore(): PreferencesStore {
  return {
    get: vi.fn(async () => null) as unknown as PreferencesStore['get'],
    set: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
  };
}

function renderSettings({ withRepository = false } = {}) {
  const mock = createChronaApiMock();
  const store = createStore();
  const library = withRepository
    ? mock.library
    : { activeRepositoryId: null, repositories: [] };

  render(
    <AppPreferencesProvider store={store}>
      <I18nProvider>
        <SettingsPage
          api={mock.api}
          repository={withRepository ? mock.openedRepository : null}
          library={library}
          onCreateRepository={vi.fn()}
          onAddExistingRepository={vi.fn()}
          onSelectRepository={vi.fn()}
          onRenameRepository={vi.fn()}
          onRelinkRepository={vi.fn()}
          onRemoveRepository={vi.fn()}
        />
      </I18nProvider>
    </AppPreferencesProvider>,
  );

  return { ...mock, store };
}

test('keeps every settings section available without a repository', () => {
  renderSettings();

  for (const name of ['General', 'Repositories', 'Storage', 'Repository health']) {
    expect(screen.getByRole('button', { name })).toBeInTheDocument();
  }
  expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument();
});

test('persists language and theme preferences without a repository', async () => {
  const user = userEvent.setup();
  const { store } = renderSettings();

  await screen.findByRole('heading', { name: 'General' });
  await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'ko');
  await user.click(screen.getByRole('button', { name: '다크' }));

  await waitFor(() => {
    expect(store.set).toHaveBeenNthCalledWith(1, 'preferences', {
      language: 'ko',
      theme: 'system',
    });
    expect(store.set).toHaveBeenNthCalledWith(2, 'preferences', {
      language: 'ko',
      theme: 'dark',
    });
  });
});

test('replaces repository-specific settings with setup actions', async () => {
  const user = userEvent.setup();
  renderSettings();

  await user.click(screen.getByRole('button', { name: 'Storage' }));
  expect(screen.getByText('Select or set up a repository to manage storage.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Create repository' })).toBeEnabled();
  expect(screen.queryByRole('combobox', { name: 'Compression mode' })).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Repository health' }));
  expect(screen.getByText('Select or set up a repository to check repository health.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Verify repository' })).not.toBeInTheDocument();
});

test('keeps storage and health controls for an active repository', async () => {
  const user = userEvent.setup();
  renderSettings({ withRepository: true });

  await user.click(screen.getByRole('button', { name: 'Storage' }));
  expect(screen.getByRole('combobox', { name: 'Compression mode' })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Repository health' }));
  expect(screen.getByRole('button', { name: 'Verify repository' })).toBeEnabled();
});

test('opens full repository management from settings', async () => {
  const user = userEvent.setup();
  renderSettings({ withRepository: true });

  await user.click(screen.getByRole('button', { name: 'Repositories' }));

  expect(screen.getByRole('searchbox', { name: 'Search repositories' })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Sort repositories' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Rename Chrona Repository' })).toBeEnabled();
});
