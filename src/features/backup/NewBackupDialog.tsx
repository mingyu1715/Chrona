import { Copy, File, FolderOpen, FolderSearch, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ActiveOperation } from '../../app/OperationBar';
import type { ChronaApi } from '../../shared/api/chronaApi';
import {
  desktopActions as defaultDesktopActions,
  type DesktopActions,
} from '../../shared/desktop/desktopActions';
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
  desktopActions = defaultDesktopActions,
}: NewBackupDialogProps) {
  const [sourcePath, setSourcePath] = useState(
    entryPoint === 'repeat' ? initialSourcePath ?? '' : '',
  );
  const [backupName, setBackupName] = useState(defaultBackupName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSourcePath(entryPoint === 'repeat' ? initialSourcePath ?? '' : '');
    setBackupName(defaultBackupName());
    setError(null);
  }, [entryPoint, initialSourcePath]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let active = true;
    api.onBlockIngestProgress((progress) => {
      if (!active) return;
      onOperationChange({
        kind: 'backup',
        label: 'Creating backup',
        currentFile: progress.currentFile,
        processedBytes: progress.totalBytesProcessed,
        totalBytes: progress.totalBytes,
        phase: progress.phase,
      });
    }).then((cleanup) => {
      unlisten = cleanup;
    }).catch(() => undefined);

    return () => {
      active = false;
      unlisten?.();
    };
  }, [api, onOperationChange]);

  async function chooseSource(select: () => Promise<string | null>) {
    const selected = await select();
    if (selected) setSourcePath(selected);
  }

  async function startBackup() {
    if (!sourcePath.trim() || !backupName.trim() || busy) return;
    setBusy(true);
    setError(null);
    onOperationChange({
      kind: 'backup',
      label: 'Creating backup',
      currentFile: null,
      processedBytes: 0,
      totalBytes: 0,
      phase: 'scanning',
    });

    try {
      const snapshot = await api.createSnapshot(
        repositoryPath,
        sourcePath.trim(),
        backupName.trim(),
      );
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
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      onOperationChange(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="backup-dialog-layer">
      <section className="backup-dialog" role="dialog" aria-modal="true" aria-labelledby="backup-dialog-title">
        <header>
          <h1 id="backup-dialog-title">
            {entryPoint === 'first-backup'
              ? 'Create first backup'
              : entryPoint === 'repeat' ? 'Back up again' : 'New Backup'}
          </h1>
          <button type="button" aria-label="Close new backup" title="Close" disabled={busy} onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="backup-dialog__body">
          <label>
            <span>Source path</span>
            <input
              value={sourcePath}
              placeholder="Select a file or folder"
              onChange={(event) => setSourcePath(event.target.value)}
            />
          </label>
          <div className="backup-dialog__source-actions">
            <button type="button" disabled={busy} onClick={() => void chooseSource(api.selectSourceFilePath)}>
              <File size={16} aria-hidden="true" />
              Choose File
            </button>
            <button type="button" disabled={busy} onClick={() => void chooseSource(api.selectSourceFolderPath)}>
              <FolderOpen size={16} aria-hidden="true" />
              Choose Folder
            </button>
            {sourcePath.trim() && (
              <>
                <button
                  type="button"
                  aria-label="Show source in file explorer"
                  title="Show in Finder or File Explorer"
                  disabled={busy}
                  onClick={() => void desktopActions.revealPath(sourcePath.trim())}
                >
                  <FolderSearch size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Copy source path"
                  title="Copy path"
                  disabled={busy}
                  onClick={() => void desktopActions.copyText(sourcePath.trim())}
                >
                  <Copy size={16} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          <label>
            <span>Backup name</span>
            <input
              value={backupName}
              onChange={(event) => setBackupName(event.target.value)}
            />
          </label>
          {error && <p className="backup-dialog__error" role="alert">{error}</p>}
        </div>

        <footer>
          <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
          <button
            className="backup-dialog__start"
            type="button"
            disabled={busy || !sourcePath.trim() || !backupName.trim()}
            onClick={() => void startBackup()}
          >
            Start Backup
          </button>
        </footer>
      </section>
    </div>
  );
}

function defaultBackupName() {
  const now = new Date();
  const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part) => String(part).padStart(2, '0'))
    .join('-');
  const time = [now.getHours(), now.getMinutes()]
    .map((part) => String(part).padStart(2, '0'))
    .join('-');
  return `Backup ${date} ${time}`;
}
