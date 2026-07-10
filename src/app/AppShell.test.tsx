import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { AppShell } from './AppShell';
import { OperationBar, type ActiveOperation } from './OperationBar';
import { I18nProvider } from '../shared/i18n/I18nProvider';
import { AppPreferencesProvider } from '../shared/preferences/AppPreferencesProvider';
import type { PreferencesStore } from '../shared/preferences/appPreferences';
import { createChronaApiMock } from '../test/chronaApiMock';

afterEach(() => cleanup());

const activeOperation: ActiveOperation = {
  kind: 'backup',
  label: 'Creating backup',
  currentFile: 'final-report.docx',
  processedBytes: 512,
  totalBytes: 1024,
  phase: 'storing',
};

const appShellCss = readFileSync(join(process.cwd(), 'src/app/app-shell.css'), 'utf8');

function renderShell(element: ReactElement) {
  const store: PreferencesStore = {
    get: vi.fn(async () => null) as unknown as PreferencesStore['get'],
    set: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
  };
  return render(
    <AppPreferencesProvider store={store}>
      <I18nProvider>{element}</I18nProvider>
    </AppPreferencesProvider>,
  );
}

describe('AppShell', () => {
  test('maps shared workspace color tokens to the active shell theme', () => {
    expect(appShellCss).toContain('--page: var(--app-page);');
    expect(appShellCss).toContain('--surface: var(--app-surface);');
    expect(appShellCss).toContain('--text: var(--app-text);');
    expect(appShellCss).toContain('--text-muted: var(--app-muted);');
    expect(appShellCss).toContain('--border: var(--app-border);');
  });

  test('shows five navigation destinations without workflow badges', () => {
    renderShell(<AppShell>Compatibility content</AppShell>);
    const navigation = screen.getByRole('navigation', { name: /primary/i });

    for (const name of ['Home', 'Files', 'Snapshots', 'Statistics', 'Settings']) {
      expect(within(navigation).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.queryByText(/waiting|available|ready|loaded/i)).not.toBeInTheDocument();
  });

  test('changes the selected workspace and exposes it to compatibility content', async () => {
    const user = userEvent.setup();
    renderShell(
      <AppShell>
        {(activeView) => <p>Current workspace: {activeView}</p>}
      </AppShell>,
    );

    await user.click(screen.getByRole('button', { name: 'Files' }));

    expect(screen.getByText('Current workspace: files')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Files' })).toHaveAttribute('aria-current', 'page');
  });

  test('supports top-bar theme, settings, and backup actions', async () => {
    const user = userEvent.setup();
    const onNewBackup = vi.fn();
    renderShell(<AppShell onNewBackup={onNewBackup}>Content</AppShell>);

    await user.click(screen.getByRole('button', { name: /switch to dark mode/i }));
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-theme', 'dark');

    await user.click(screen.getByRole('button', { name: /open settings/i }));
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: /new backup/i }));
    expect(onNewBackup).toHaveBeenCalledOnce();
  });

  test('keeps all destinations visible and shows repository actions before setup', async () => {
    const { api } = createChronaApiMock();
    vi.mocked(api.getRepositoryLibrary).mockResolvedValue({
      activeRepositoryId: null,
      repositories: [],
    });
    const user = userEvent.setup();
    renderShell(<AppShell api={api} />);

    expect(await screen.findByRole('heading', { name: /set up chrona/i })).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: /primary/i });
    for (const name of ['Home', 'Files', 'Snapshots', 'Statistics', 'Settings']) {
      expect(within(navigation).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /set up repository/i })).toBeInTheDocument();

    await user.click(within(navigation).getByRole('button', { name: 'Files' }));
    expect(screen.getByRole('heading', { name: /files requires a repository/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create repository/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /add existing repository/i })).toBeEnabled();

    await user.click(within(navigation).getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'General' })).toBeEnabled();
  });

  test('offers repository relocation when every registration is disconnected', async () => {
    const { api, registration } = createChronaApiMock();
    vi.mocked(api.getRepositoryLibrary).mockResolvedValue({
      activeRepositoryId: registration.repositoryId,
      repositories: [{ ...registration, connectionState: 'disconnected' }],
    });
    renderShell(<AppShell api={api} />);

    expect(await screen.findByRole('button', { name: /locate repository/i })).toBeInTheDocument();
    expect(api.activateRegisteredRepository).not.toHaveBeenCalled();
  });

  test('keeps backup progress in the bottom bar after the backup dialog closes', async () => {
    const { api, emitProgress } = createChronaApiMock();
    renderShell(<AppShell api={api} />);

    await waitFor(() => expect(api.onBlockIngestProgress).toHaveBeenCalledOnce());
    emitProgress({
      operationId: 'op-1',
      phase: 'storing',
      currentFile: 'reports/final.docx',
      processedFiles: 1,
      totalFiles: 2,
      currentFileBytesProcessed: 256,
      currentFileSizeBytes: 512,
      totalBytesProcessed: 768,
      totalBytes: 1024,
    });

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('reports/final.docx'));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '75');
  });

  test('keeps statistics analysis results after navigating away and back', async () => {
    const { api } = createChronaApiMock();
    const user = userEvent.setup();
    renderShell(<AppShell api={api} />);

    await user.click(screen.getByRole('button', { name: 'Statistics' }));
    await user.click(await screen.findByRole('button', { name: /analyze repository/i }));
    expect(await screen.findByText('Dedup saved')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Files' }));
    await user.click(screen.getByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Dedup saved')).toBeInTheDocument();
    expect(api.analyzeRepositoryStatistics).toHaveBeenCalledOnce();
  });

  test('maps repository statistics progress to the bottom progress bar', async () => {
    const { api, emitStatisticsProgress } = createChronaApiMock();
    const user = userEvent.setup();
    renderShell(<AppShell api={api} />);

    await waitFor(() => expect(api.onRepositoryStatisticsProgress).toHaveBeenCalledOnce());
    await user.click(screen.getByRole('button', { name: 'Files' }));
    emitStatisticsProgress({
      phase: 'blocks',
      processedSnapshots: 2,
      totalSnapshots: 2,
      processedBlocks: 4,
      totalBlocks: 10,
    });

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Blocks 4 / 10'));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
  });
});

describe('OperationBar', () => {
  test('renders only while an operation exists', () => {
    const { rerender } = render(<OperationBar operation={null} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    rerender(<OperationBar operation={activeOperation} />);
    expect(screen.getByRole('status')).toHaveTextContent('final-report.docx');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });
});
