import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';
import { createChronaApiMock } from '../../test/chronaApiMock';

test('contains repository, storage, health, and appearance sections', () => {
  const mock = createChronaApiMock();
  render(
    <SettingsPage
      api={mock.api}
      repository={mock.openedRepository}
      repositories={mock.library.repositories}
      theme="light"
      onToggleTheme={vi.fn()}
      onRemoveRepository={vi.fn()}
    />,
  );
  for (const name of ['Repositories', 'Storage', 'Repository health', 'Appearance']) {
    expect(screen.getByRole('button', { name })).toBeInTheDocument();
  }
  expect(screen.queryByRole('button', { name: /^integrity$/i })).not.toBeInTheDocument();
});
