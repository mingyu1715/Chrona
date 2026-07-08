import { Copy, FolderOpen, X } from 'lucide-react';
import { useState } from 'react';

import type { ChronaApi } from '../../shared/api/chronaApi';
import {
  desktopActions as defaultDesktopActions,
  type DesktopActions,
} from '../../shared/desktop/desktopActions';
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
  const [targetPath, setTargetPath] = useState('');
  const [report, setReport] = useState<RestoreReport | null>(null);
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    setError(null);
    try {
      setReport(await api.restoreSnapshot(repositoryPath, snapshot.id, targetPath.trim()));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="snapshot-dialog-layer">
      <section className="snapshot-restore-dialog" role="dialog" aria-modal="true" aria-label={`Restore ${snapshot.name}`}>
        <header>
          <h1>Restore {snapshot.name}</h1>
          <button type="button" aria-label="Close restore" title="Close" disabled={busy} onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="snapshot-restore-dialog__body">
          <label>
            <span>Restore target</span>
            <input value={targetPath} placeholder="Choose an empty folder" onChange={(event) => setTargetPath(event.target.value)} />
          </label>
          <button type="button" disabled={busy} onClick={() => void chooseTarget()}>
            <FolderOpen size={16} aria-hidden="true" />
            Choose target
          </button>
          {error && <p role="alert">{error}</p>}
          {report && (
            <div className="snapshot-restore-dialog__result">
              <dl>
                <div><dt>Files</dt><dd>{report.restoredFileCount.toLocaleString()}</dd></div>
                <div><dt>Bytes</dt><dd>{formatBytes(report.restoredBytes)}</dd></div>
                <div><dt>Blocks</dt><dd>{report.restoredBlockCount.toLocaleString()}</dd></div>
              </dl>
              <div>
                <button
                  type="button"
                  aria-label="Open restore folder"
                  onClick={() => void desktopActions.openPath(report.targetPath)}
                >
                  <FolderOpen size={16} aria-hidden="true" />
                  Open restore folder
                </button>
                <button
                  type="button"
                  aria-label="Copy restore folder path"
                  title="Copy path"
                  onClick={() => void desktopActions.copyText(report.targetPath)}
                >
                  <Copy size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="snapshot-restore-dialog__confirm" type="button" disabled={busy || !targetPath.trim()} onClick={() => void restore()}>
            Restore
          </button>
        </footer>
      </section>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}
