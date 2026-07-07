import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { AppShell } from './AppShell';
import { OperationBar, type ActiveOperation } from './OperationBar';

afterEach(() => cleanup());

const activeOperation: ActiveOperation = {
  kind: 'backup',
  label: 'Creating backup',
  currentFile: 'final-report.docx',
  processedBytes: 512,
  totalBytes: 1024,
  phase: 'storing',
};

describe('AppShell', () => {
  test('shows five navigation destinations without workflow badges', () => {
    render(<AppShell>Compatibility content</AppShell>);
    const navigation = screen.getByRole('navigation', { name: /primary/i });

    for (const name of ['Home', 'Files', 'Snapshots', 'Statistics', 'Settings']) {
      expect(within(navigation).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.queryByText(/waiting|available|ready|loaded/i)).not.toBeInTheDocument();
  });

  test('changes the selected workspace and exposes it to compatibility content', async () => {
    const user = userEvent.setup();
    render(
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
    render(<AppShell onNewBackup={onNewBackup}>Content</AppShell>);

    await user.click(screen.getByRole('button', { name: /switch to dark mode/i }));
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-theme', 'dark');

    await user.click(screen.getByRole('button', { name: /open settings/i }));
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('button', { name: /new backup/i }));
    expect(onNewBackup).toHaveBeenCalledOnce();
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
