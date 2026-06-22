import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Archive,
  CheckCircle2,
  Clock3,
  Database,
  File,
  FolderOpen,
  HardDrive,
  Layers3,
  Play,
} from 'lucide-react';

import { chronaApi, type ChronaApi } from '../../shared/api/chronaApi';
import { SnapshotPanel } from '../snapshots/SnapshotPanel';
import type {
  BlockIngestProgress,
  BlockIngestSummary,
  RepositoryManifest,
} from '../../shared/types/chrona';
import './RepositoryPage.css';

interface RepositoryPageProps {
  api?: ChronaApi;
}

export function RepositoryPage({ api = chronaApi }: RepositoryPageProps) {
  const [repositoryPath, setRepositoryPath] = useState('');
  const [sourcePath, setSourcePath] = useState('');
  const [manifest, setManifest] = useState<RepositoryManifest | null>(null);
  const [progress, setProgress] = useState<BlockIngestProgress | null>(null);
  const [summary, setSummary] = useState<BlockIngestSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;
    api.onBlockIngestProgress((event) => {
      if (mounted) {
        setProgress(event);
      }
    }).then((unlisten) => {
      cleanup = unlisten;
    }).catch(() => undefined);

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [api]);

  const reuseRatio = useMemo(() => {
    if (!summary || summary.totalBlockReferences === 0) {
      return '0.00%';
    }
    return `${((summary.reusedBlockCount / summary.totalBlockReferences) * 100).toFixed(2)}%`;
  }, [summary]);

  async function selectPath(select: () => Promise<string | null>, apply: (path: string) => void) {
    await runAction(async () => {
      const selected = await select();
      if (selected) {
        apply(selected);
      }
    });
  }

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = manifest ? 'Repository open' : 'Repository closed';
  const sourceLabel = sourcePath.trim().length > 0 ? sourcePath : 'No source selected';
  const repositoryLabel = repositoryPath.trim().length > 0 ? repositoryPath : 'No repository selected';
  const railStatusLabel = manifest ? 'Open' : 'Closed';

  return (
    <main className="repository-page workbench-shell">
      <aside className="workspace-rail">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <Database size={18} />
          </span>
          <div>
            <strong>Chrona</strong>
            <span>Phase 2</span>
          </div>
        </div>

        <nav className="workflow-nav" aria-label="Workflow">
          <a href="#repository-heading"><HardDrive size={16} />Repository</a>
          <a href="#ingest-heading"><Activity size={16} />Block ingest</a>
          <a href="#snapshot-heading"><Clock3 size={16} />Snapshots</a>
          <a href="#result-heading"><Archive size={16} />Result</a>
        </nav>

        <div className="rail-status">
          <span className={manifest ? 'status-dot status-dot-open' : 'status-dot'} />
          <div>
            <span>{railStatusLabel}</span>
            <strong>{summary ? `${summary.totalBlockReferences} block refs` : 'Ready for setup'}</strong>
          </div>
        </div>
      </aside>

      <div className="workbench-main">
        <header className="page-header">
          <div>
            <p className="eyebrow">Chrona Phase 2</p>
            <h1>Storage Workbench</h1>
            <p className="header-copy">Create a repository, store source data as reusable blocks, and capture snapshots without leaving the workspace.</p>
          </div>
          <span className={manifest ? 'status status-open' : 'status'}>
            {manifest ? <CheckCircle2 size={16} /> : <Database size={16} />}
            {statusLabel}
          </span>
        </header>

        <section className="path-strip" aria-label="Current paths">
          <div>
            <span><HardDrive size={15} />Repository</span>
            <strong title={repositoryLabel}>{repositoryLabel}</strong>
          </div>
          <div>
            <span><FolderOpen size={15} />Source</span>
            <strong title={sourceLabel}>{sourceLabel}</strong>
          </div>
        </section>

        {error && <p className="error" role="alert">{error}</p>}

        <div className="workbench-grid">
          <div className="setup-column">
            <section className="panel" aria-labelledby="repository-heading">
              <div className="section-heading">
                <span className="section-icon"><HardDrive size={18} /></span>
                <div>
                  <h2 id="repository-heading">Repository</h2>
                  <p>Choose where Chrona stores block data and snapshot metadata.</p>
                </div>
              </div>
              <label className="field">
                <span>Repository path</span>
                <input
                  value={repositoryPath}
                  onChange={(event) => setRepositoryPath(event.target.value)}
                  placeholder="/tmp/chrona-repo"
                />
              </label>
              <div className="actions">
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busy}
                  onClick={() => selectPath(api.selectRepositoryPath, setRepositoryPath)}
                >
                  <FolderOpen size={16} />
                  Choose Repository Folder
                </button>
                <button
                  type="button"
                  disabled={busy || repositoryPath.trim().length === 0}
                  onClick={() => runAction(async () => {
                    setManifest(await api.createRepository(repositoryPath));
                  })}
                >
                  <Database size={16} />
                  Create Repository
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busy || repositoryPath.trim().length === 0}
                  onClick={() => runAction(async () => {
                    setManifest(await api.openRepository(repositoryPath));
                  })}
                >
                  <HardDrive size={16} />
                  Open Repository
                </button>
              </div>
              {manifest && (
                <dl className="meta-grid">
                  <div>
                    <dt>Schema</dt>
                    <dd>{manifest.schemaVersion}</dd>
                  </div>
                  <div>
                    <dt>Block size</dt>
                    <dd>{formatBytes(manifest.blockStrategy.sizeBytes)}</dd>
                  </div>
                  <div>
                    <dt>Hash</dt>
                    <dd>{manifest.blockStrategy.hash}</dd>
                  </div>
                </dl>
              )}
            </section>

            <section className="panel" aria-labelledby="ingest-heading">
              <div className="section-heading">
                <span className="section-icon"><Activity size={18} /></span>
                <div>
                  <h2 id="ingest-heading">Block ingest</h2>
                  <p>Analyze a file or folder and write only new 1 MiB blocks.</p>
                </div>
              </div>
              <label className="field">
                <span>Source path</span>
                <input
                  value={sourcePath}
                  onChange={(event) => setSourcePath(event.target.value)}
                  placeholder="/tmp/source"
                />
              </label>
              <div className="actions">
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busy}
                  onClick={() => selectPath(api.selectSourceFilePath, setSourcePath)}
                >
                  <File size={16} />
                  Choose Source File
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busy}
                  onClick={() => selectPath(api.selectSourceFolderPath, setSourcePath)}
                >
                  <FolderOpen size={16} />
                  Choose Source Folder
                </button>
                <button
                  type="button"
                  disabled={busy || !manifest || sourcePath.trim().length === 0}
                  onClick={() => runAction(async () => {
                    setSummary(null);
                    setSummary(await api.ingestBlocks(repositoryPath, sourcePath));
                  })}
                >
                  <Play size={16} />
                  Analyze &amp; Store Blocks
                </button>
              </div>
              {progress && (
                <div className="progress-box" aria-label="Ingest progress">
                  <div className="progress-line">
                    <span>{progress.phase}</span>
                    <span>{formatBytes(progress.totalBytesProcessed)} / {formatBytes(progress.totalBytes)}</span>
                  </div>
                  <progress value={progress.totalBytesProcessed} max={Math.max(progress.totalBytes, 1)} />
                  {progress.currentFile && <p className="current-file">{progress.currentFile}</p>}
                </div>
              )}
            </section>
          </div>

          <div className="insight-column">
            <SnapshotPanel
              api={api}
              repositoryPath={repositoryPath}
              sourcePath={sourcePath}
              repositoryOpen={Boolean(manifest)}
            />

            <section className="panel result-panel" aria-labelledby="result-heading">
              <div className="section-heading">
                <span className="section-icon"><Layers3 size={18} /></span>
                <div>
                  <h2 id="result-heading">Result</h2>
                  <p>Review block references, reuse, and newly stored bytes.</p>
                </div>
              </div>

              {summary ? (
                <dl className="result-grid">
                  <div>
                    <dt>Scanned files</dt>
                    <dd>{summary.fileCount}</dd>
                  </div>
                  <div>
                    <dt>Input bytes</dt>
                    <dd>{formatBytes(summary.totalInputBytes)}</dd>
                  </div>
                  <div>
                    <dt>Block references</dt>
                    <dd>{summary.totalBlockReferences}</dd>
                  </div>
                  <div>
                    <dt>Blocks</dt>
                    <dd>{summary.newBlockCount} new / {summary.reusedBlockCount} reused</dd>
                  </div>
                  <div>
                    <dt>Newly stored bytes</dt>
                    <dd>{formatBytes(summary.newlyStoredBytes)}</dd>
                  </div>
                  <div>
                    <dt>Reuse ratio</dt>
                    <dd>{reuseRatio}</dd>
                  </div>
                </dl>
              ) : (
                <div className="empty-state">
                  <span><Layers3 size={20} /></span>
                  <div>
                    <strong>No block run yet</strong>
                    <p>Open a repository and analyze a source to see block reuse statistics here.</p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes.toLocaleString()} bytes`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
