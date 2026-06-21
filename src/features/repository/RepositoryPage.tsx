import { useEffect, useMemo, useState } from 'react';

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

  return (
    <main className="repository-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Chrona Phase 1</p>
          <h1>Block Engine</h1>
        </div>
        <span className={manifest ? 'status status-open' : 'status'}>
          {manifest ? 'Repository open' : 'Repository closed'}
        </span>
      </header>

      <section className="panel" aria-labelledby="repository-heading">
        <h2 id="repository-heading">Repository</h2>
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
            disabled={busy || repositoryPath.trim().length === 0}
            onClick={() => runAction(async () => {
              setManifest(await api.createRepository(repositoryPath));
            })}
          >
            Create Repository
          </button>
          <button
            type="button"
            disabled={busy || repositoryPath.trim().length === 0}
            onClick={() => runAction(async () => {
              setManifest(await api.openRepository(repositoryPath));
            })}
          >
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
              <dd>{manifest.blockStrategy.sizeBytes.toLocaleString()} bytes</dd>
            </div>
            <div>
              <dt>Hash</dt>
              <dd>{manifest.blockStrategy.hash}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="panel" aria-labelledby="ingest-heading">
        <h2 id="ingest-heading">Block ingest</h2>
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
            disabled={busy || !manifest || sourcePath.trim().length === 0}
            onClick={() => runAction(async () => {
              setSummary(null);
              setSummary(await api.ingestBlocks(repositoryPath, sourcePath));
            })}
          >
            Analyze &amp; Store Blocks
          </button>
        </div>
        {progress && (
          <div className="progress-box" aria-label="Ingest progress">
            <div className="progress-line">
              <span>{progress.phase}</span>
              <span>{progress.totalBytesProcessed.toLocaleString()} / {progress.totalBytes.toLocaleString()} bytes</span>
            </div>
            <progress value={progress.totalBytesProcessed} max={Math.max(progress.totalBytes, 1)} />
            {progress.currentFile && <p className="current-file">{progress.currentFile}</p>}
          </div>
        )}
      </section>

      {error && <p className="error" role="alert">{error}</p>}

      <SnapshotPanel
        api={api}
        repositoryPath={repositoryPath}
        sourcePath={sourcePath}
        repositoryOpen={Boolean(manifest)}
      />

      {summary && (
        <section className="panel" aria-labelledby="result-heading">
          <h2 id="result-heading">Result</h2>
          <dl className="result-grid">
            <div>
              <dt>Scanned files</dt>
              <dd>{summary.fileCount}</dd>
            </div>
            <div>
              <dt>Input bytes</dt>
              <dd>{summary.totalInputBytes.toLocaleString()}</dd>
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
              <dd>{summary.newlyStoredBytes.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Reuse ratio</dt>
              <dd>{reuseRatio}</dd>
            </div>
          </dl>
        </section>
      )}
    </main>
  );
}
