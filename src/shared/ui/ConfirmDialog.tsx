import { useEffect, useRef, useState } from 'react';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  intent?: 'default' | 'danger';
  returnFocusSelector?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  intent = 'default',
  returnFocusSelector,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || busyRef.current) return;
      event.preventDefault();
      onCancel();
      returnFocus();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  async function confirm() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await onConfirm();
      returnFocus();
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }

  function cancel() {
    if (busyRef.current) return;
    onCancel();
    returnFocus();
  }

  function returnFocus() {
    if (!returnFocusSelector) return;
    queueMicrotask(() => {
      const target = document.querySelector<HTMLElement>(returnFocusSelector);
      target?.focus();
    });
  }

  return (
    <div className="confirm-dialog-layer">
      <section
        className={`confirm-dialog confirm-dialog-${intent}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-description">{description}</p>
        <footer>
          <button type="button" disabled={busy} onClick={cancel}>
            {cancelLabel}
          </button>
          <button
            className="confirm-dialog__confirm"
            type="button"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}
