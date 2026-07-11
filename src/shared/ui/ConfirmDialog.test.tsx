import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, expect, test, vi } from 'vitest';

import { ConfirmDialog } from './ConfirmDialog';

afterEach(() => cleanup());

test('closes on Escape and returns focus to the opener', async () => {
  const user = userEvent.setup();
  const onCancel = vi.fn();

  render(<ConfirmDialogHarness onCancel={onCancel} />);

  const opener = screen.getByRole('button', { name: 'Open confirmation' });
  await user.click(opener);
  expect(screen.getByRole('dialog', { name: 'Remove repository?' })).toBeInTheDocument();

  await user.keyboard('{Escape}');

  expect(onCancel).toHaveBeenCalledOnce();
  expect(opener).toHaveFocus();
});

test('prevents double submit while confirm is running', async () => {
  const user = userEvent.setup();
  let resolveConfirm: (() => void) | undefined;
  const onConfirm = vi.fn(() => new Promise<void>((resolve) => {
    resolveConfirm = resolve;
  }));

  render(<ConfirmDialogHarness onConfirm={onConfirm} />);

  await user.click(screen.getByRole('button', { name: 'Open confirmation' }));
  const confirm = screen.getByRole('button', { name: 'Remove' });
  await user.dblClick(confirm);

  expect(onConfirm).toHaveBeenCalledOnce();
  expect(confirm).toBeDisabled();

  resolveConfirm?.();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

function ConfirmDialogHarness({
  onCancel = vi.fn(),
  onConfirm = vi.fn(),
}: {
  onCancel?: () => void;
  onConfirm?: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button type="button" data-testid="opener" onClick={() => setOpen(true)}>
        Open confirmation
      </button>
      {open && (
        <ConfirmDialog
          title="Remove repository?"
          description="This only removes the registration. Repository files stay in place."
          confirmLabel="Remove"
          cancelLabel="Cancel"
          intent="danger"
          returnFocusSelector="[data-testid='opener']"
          onCancel={() => {
            onCancel();
            setOpen(false);
          }}
          onConfirm={async () => {
            await onConfirm();
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
