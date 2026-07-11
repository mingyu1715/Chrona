import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import {
  AppPreferencesProvider,
  useAppPreferences,
} from './AppPreferencesProvider';
import type { PreferencesStore } from './appPreferences';

afterEach(() => cleanup());

function createStore(value: unknown = null): PreferencesStore {
  return {
    get: vi.fn(async () => value) as unknown as PreferencesStore['get'],
    set: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
  };
}

function PreferencesProbe() {
  const { preferences, loaded, setLanguage, setTheme } = useAppPreferences();
  return (
    <div>
      <span>{loaded ? 'loaded' : 'loading'}</span>
      <span>{preferences.language}</span>
      <span>{preferences.theme}</span>
      <button type="button" onClick={() => void setLanguage('ko')}>Korean</button>
      <button type="button" onClick={() => void setTheme('dark')}>Dark</button>
    </div>
  );
}

test('loads system defaults when no preferences exist', async () => {
  render(
    <AppPreferencesProvider store={createStore()}>
      <PreferencesProbe />
    </AppPreferencesProvider>,
  );

  expect(await screen.findByText('loaded')).toBeInTheDocument();
  expect(screen.getAllByText('system', { selector: 'span' })).toHaveLength(2);
});

test('loads valid persisted preferences and rejects invalid values', async () => {
  const { rerender } = render(
    <AppPreferencesProvider store={createStore({ language: 'ko', theme: 'dark' })}>
      <PreferencesProbe />
    </AppPreferencesProvider>,
  );
  expect(await screen.findByText('ko')).toBeInTheDocument();
  expect(screen.getByText('dark', { selector: 'span' })).toBeInTheDocument();

  rerender(
    <AppPreferencesProvider store={createStore({ language: 'xx', theme: 'neon' })}>
      <PreferencesProbe />
    </AppPreferencesProvider>,
  );
  await waitFor(() => {
    expect(screen.getAllByText('system', { selector: 'span' })).toHaveLength(2);
  });
});

test('persists language and theme changes', async () => {
  const store = createStore();
  const user = userEvent.setup();
  render(
    <AppPreferencesProvider store={store}>
      <PreferencesProbe />
    </AppPreferencesProvider>,
  );
  await screen.findByText('loaded');

  await user.click(screen.getByRole('button', { name: 'Korean' }));
  await user.click(screen.getByRole('button', { name: 'Dark' }));

  expect(store.set).toHaveBeenNthCalledWith(1, 'preferences', {
    language: 'ko',
    theme: 'system',
  });
  expect(store.set).toHaveBeenNthCalledWith(2, 'preferences', {
    language: 'ko',
    theme: 'dark',
  });
  expect(store.save).toHaveBeenCalledTimes(2);
});
