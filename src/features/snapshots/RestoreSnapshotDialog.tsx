import { Copy, FolderOpen, X } from 'lucide-react';
import { useState } from 'react';

import type { ChronaApi } from '../../shared/api/chronaApi';
import {
  desktopActions as defaultDesktopActions,
  type DesktopActions,
} from '../../shared/desktop/desktopActions';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog';
import type { RestoreReport, Snapshot } from '../../shared/types/chrona';

interface RestoreSnapshotDialogProps {
  api: ChronaApi;
  repositoryPath: string;
  snapshot: Snapshot;
  onClose: () => void;
  desktopActions?: DesktopActions;
}

export function RestoreSnapshotDialog({
  api,
  repositoryPath,
  snapshot,
  onClose,
  desktopActions = defaultDesktopActions,
}: RestoreSnapshotDialogProps) {
  const { t, formatBytes, formatNumber } = useI18n();
  const [targetPath, setTargetPath] = useState('');
  const [report, setReport] = useState<RestoreReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function chooseTarget() {
    const selected = await api.selectRestoreTargetPath();
    if (selected) {
      setTargetPath(selected);
      setReport(null);
    }
  }

  async function restore() {
    if (!targetPath.trim() || busy) return;
    setConfirmOpen(true);
  }

  async function confirmRestore() {
    if (!targetPath.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      setReport(await api.restoreSnapshot(repositoryPath, snapshot.id, targetPath.trim()));
      setConfirmOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="snapshot-dialog-layer">
      <section className="snapshot-restore-dialog" role="dialog" aria-modal="true" aria-label={t('restore.title', { name: snapshot.name })}>
        <header>
          <h1>{t('restore.title', { name: snapshot.name })}</h1>
          <button type="button" aria-label={t('restore.close')} title={t('common.close')} disabled={busy} onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="snapshot-restore-dialog__body">
          <label>
            <span>{t('restore.target')}</span>
            <input value={targetPath} placeholder={t('restore.targetPlaceholder')} onChange={(event) => setTargetPath(event.target.value)} />
          </label>
          <button type="button" disabled={busy} onClick={() => void chooseTarget()}>
            <FolderOpen size={16} aria-hidden="true" />
            {t('restore.chooseTarget')}
          </button>
          {error && <p role="alert">{error}</p>}
          {report && (
            <div className="snapshot-restore-dialog__result">
              <dl>
                <div><dt>{t('common.files')}</dt><dd>{formatNumber(report.restoredFileCount)}</dd></div>
                <div><dt>{t('common.bytes')}</dt><dd>{formatBytes(report.restoredBytes)}</dd></div>
                <div><dt>{t('common.blocks')}</dt><dd>{formatNumber(report.restoredBlockCount)}</dd></div>
              </dl>
              <div>
                <button
                  type="button"
                  aria-label={t('restore.openFolder')}
                  onClick={() => void desktopActions.openPath(report.targetPath)}
                >
                  <FolderOpen size={16} aria-hidden="true" />
                  {t('restore.openFolder')}
                </button>
                <button
                  type="button"
                  aria-label={t('restore.copyFolderPath')}
                  title={t('common.copyPath')}
                  onClick={() => void desktopActions.copyText(report.targetPath)}
                >
                  <Copy size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
          <button className="snapshot-restore-dialog__confirm" type="button" disabled={busy || !targetPath.trim()} onClick={() => void restore()}>
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
