import { Copy, File, FolderOpen, FolderSearch, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { ActiveOperation } from '../../app/OperationBar';
import type { ChronaApi } from '../../shared/api/chronaApi';
import {
  desktopActions as defaultDesktopActions,
  type DesktopActions,
} from '../../shared/desktop/desktopActions';
import { useI18n } from '../../shared/i18n/I18nProvider';
import type { Snapshot } from '../../shared/types/chrona';
import './new-backup-dialog.css';

interface NewBackupDialogProps {
  api: ChronaApi;
  repositoryPath: string;
  initialSourcePath?: string;
  entryPoint: BackupEntryPoint;
  onClose: () => void;
  onOperationChange: (operation: ActiveOperation | null) => void;
  onCompleted: (snapshot: Snapshot) => void;
  onFailed?: (message: string) => void;
  desktopActions?: DesktopActions;
}

export type BackupEntryPoint = 'global' | 'first-backup' | 'repeat';

export interface BackupEntryRequest {
  entryPoint: BackupEntryPoint;
  initialSourcePath?: string;
}

export function NewBackupDialog({
  api,
  repositoryPath,
  initialSourcePath,
  entryPoint,
  onClose,
  onOperationChange,
  onCompleted,
  onFailed,
  desktopActions = defaultDesktopActions,
}: NewBackupDialogProps) {
  const { t } = useI18n();
  const [sourcePath, setSourcePath] = useState(
    entryPoint === 'repeat' ? initialSourcePath ?? '' : '',
  );
  const [backupName, setBackupName] = useState(() => defaultBackupName(t));
  const [error, setError] = useState<string | null>(null);
  const launchedRef = useRef(false);

  useEffect(() => {
    setSourcePath(entryPoint === 'repeat' ? initialSourcePath ?? '' : '');
    setBackupName(defaultBackupName(t));
    setError(null);
    launchedRef.current = false;
  }, [entryPoint, initialSourcePath, t]);

  async function chooseSource(select: () => Promise<string | null>) {
    const selected = await select();
    if (selected) setSourcePath(selected);
  }

  function startBackup() {
    const nextSourcePath = sourcePath.trim();
    const nextBackupName = backupName.trim();
    if (!nextSourcePath || !nextBackupName || launchedRef.current) return;
    launchedRef.current = true;
    setError(null);
    onOperationChange({
      kind: 'backup',
      label: t('backup.creating'),
      currentFile: null,
      processedBytes: 0,
      totalBytes: 0,
      phase: 'scanning',
    });

    let request: Promise<Snapshot>;
    try {
      request = api.createSnapshot(
        repositoryPath,
        nextSourcePath,
        nextBackupName,
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      launchedRef.current = false;
      setError(message);
      onOperationChange(null);
      return;
    }

    onClose();
    void request.then((snapshot) => {
      void api.recordAccessEvent(repositoryPath, {
        key: `snapshot:${snapshot.id}`,
        kind: 'snapshot',
        label: snapshot.name,
        path: null,
        repositoryId: null,
        snapshotId: snapshot.id,
        baseSnapshotId: null,
        targetSnapshotId: null,
        action: 'snapshot_created',
        accessedAt: new Date().toISOString(),
      }).catch(() => undefined);
      onOperationChange(null);
      onCompleted(snapshot);
    }).catch((caught) => {
      const message = caught instanceof Error ? caught.message : String(caught);
      onOperationChange(null);
      onFailed?.(message);
    });
  }

  return (
    <div className="backup-dialog-layer">
      <section className="backup-dialog" role="dialog" aria-modal="true" aria-labelledby="backup-dialog-title">
        <header>
          <h1 id="backup-dialog-title">
            {entryPoint === 'first-backup'
              ? t('backup.first')
              : entryPoint === 'repeat' ? t('backup.repeat') : t('backup.new')}
          </h1>
          <button type="button" aria-label={t('backup.closeNew')} title={t('common.close')} onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="backup-dialog__body">
          <label>
            <span>{t('backup.sourcePath')}</span>
            <input
              value={sourcePath}
              placeholder={t('backup.selectSourcePlaceholder')}
              onChange={(event) => setSourcePath(event.target.value)}
            />
          </label>
          <div className="backup-dialog__source-actions">
            <button type="button" onClick={() => void chooseSource(api.selectSourceFilePath)}>
              <File size={16} aria-hidden="true" />
              {t('backup.chooseFile')}
            </button>
            <button type="button" onClick={() => void chooseSource(api.selectSourceFolderPath)}>
              <FolderOpen size={16} aria-hidden="true" />
              {t('backup.chooseFolder')}
            </button>
            {sourcePath.trim() && (
              <>
                <button
                  type="button"
                  aria-label={t('backup.showSourceInExplorer')}
                  title={t('backup.showInExplorerTitle')}
                  onClick={() => void desktopActions.revealPath(sourcePath.trim())}
                >
                  <FolderSearch size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={t('backup.copySourcePath')}
                  title={t('common.copyPath')}
                  onClick={() => void desktopActions.copyText(sourcePath.trim())}
                >
                  <Copy size={16} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          <label>
            <span>{t('backup.name')}</span>
            <input
              value={backupName}
              onChange={(event) => setBackupName(event.target.value)}
            />
          </label>
          {error && <p className="backup-dialog__error" role="alert">{error}</p>}
        </div>

        <footer>
          <button type="button" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="backup-dialog__start"
            type="button"
            disabled={!sourcePath.trim() || !backupName.trim()}
            onClick={() => void startBackup()}
          >
            {t('backup.start')}
          </button>
        </footer>
      </section>
    </div>
  );
}

function defaultBackupName(t: (key: 'backup.defaultName', values: { date: string; time: string }) => string) {
  const now = new Date();
  const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part) => String(part).padStart(2, '0'))
    .join('-');
  const time = [now.getHours(), now.getMinutes()]
    .map((part) => String(part).padStart(2, '0'))
    .join('-');
  return t('backup.defaultName', { date, time });
}
