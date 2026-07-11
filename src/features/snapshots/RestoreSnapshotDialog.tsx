import { FolderOpen, X } from 'lucide-react';
import { useState } from 'react';

import type { ActiveOperation } from '../../app/OperationBar';
import type { ChronaApi } from '../../shared/api/chronaApi';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog';
import type { RestoreReport, Snapshot } from '../../shared/types/chrona';

interface RestoreSnapshotDialogProps {
  api: ChronaApi;
  repositoryPath: string;
  snapshot: Snapshot;
  onClose: () => void;
  onOperationChange?: (operation: ActiveOperation | null) => void;
  onCompleted?: (report: RestoreReport) => void;
  onFailed?: (message: string) => void;
}

export function RestoreSnapshotDialog({
  api,
  repositoryPath,
  snapshot,
  onClose,
  onOperationChange,
  onCompleted,
  onFailed,
}: RestoreSnapshotDialogProps) {
  const { t } = useI18n();
  const [targetPath, setTargetPath] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function chooseTarget() {
    const selected = await api.selectRestoreTargetPath();
    if (selected) {
      setTargetPath(selected);
      setError(null);
    }
  }

  async function restore() {
    if (!targetPath.trim()) return;
    setConfirmOpen(true);
  }

  function confirmRestore() {
    const nextTargetPath = targetPath.trim();
    if (!nextTargetPath) return;
    setError(null);
    setConfirmOpen(false);
    onOperationChange?.({
      kind: 'restore',
      label: t('restore.restoring'),
      currentFile: snapshot.name,
      processedBytes: 0,
      totalBytes: 0,
      phase: nextTargetPath,
    });
    onClose();
    void api.restoreSnapshot(repositoryPath, snapshot.id, nextTargetPath)
      .then((report) => {
        onOperationChange?.(null);
        onCompleted?.(report);
      })
      .catch((caught) => {
        const message = caught instanceof Error ? caught.message : String(caught);
        onOperationChange?.(null);
        onFailed?.(message);
      });
  }

  return (
    <div className="snapshot-dialog-layer">
      <section className="snapshot-restore-dialog" role="dialog" aria-modal="true" aria-label={t('restore.title', { name: snapshot.name })}>
        <header>
          <h1>{t('restore.title', { name: snapshot.name })}</h1>
          <button type="button" aria-label={t('restore.close')} title={t('common.close')} onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="snapshot-restore-dialog__body">
          <label>
            <span>{t('restore.target')}</span>
            <input value={targetPath} placeholder={t('restore.targetPlaceholder')} onChange={(event) => setTargetPath(event.target.value)} />
          </label>
          <button type="button" onClick={() => void chooseTarget()}>
            <FolderOpen size={16} aria-hidden="true" />
            {t('restore.chooseTarget')}
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
        <footer>
          <button type="button" onClick={onClose}>{t('common.cancel')}</button>
          <button className="snapshot-restore-dialog__confirm" type="button" disabled={!targetPath.trim()} onClick={() => void restore()}>
            {t('common.restore')}
          </button>
        </footer>
      </section>
      {confirmOpen && (
        <ConfirmDialog
          title={t('restore.confirmTitle', { name: snapshot.name })}
          description={t('restore.confirmDescription')}
          confirmLabel={t('common.restore')}
          cancelLabel={t('common.cancel')}
          returnFocusSelector=".snapshot-restore-dialog__confirm"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={confirmRestore}
        />
      )}
    </div>
  );
}
