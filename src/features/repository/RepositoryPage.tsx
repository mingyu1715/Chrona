import { type ComponentType, type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Database,
  File,
  FolderOpen,
  HardDrive,
  Layers3,
  Moon,
  Play,
  Sun,
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

type ChapterId = 'repository' | 'source' | 'snapshots' | 'review';
type PanelKey = 'repository' | 'source' | 'store' | 'snapshots' | 'review';
type Tone = 'ready' | 'waiting' | 'done';
type ThemeMode = 'light' | 'dark';

const chapters: Array<{
  id: ChapterId;
  label: string;
  shortLabel: string;
  description: string;
  icon: ComponentType<{ size?: number }>;
}> = [
  {
    id: 'repository',
    label: 'Repository',
    shortLabel: 'Repository',
    description: 'Create or open the Chrona storage location.',
    icon: HardDrive,
  },
  {
    id: 'source',
    label: 'Sources',
    shortLabel: 'Sources',
    description: 'Pick data and store reusable blocks.',
    icon: Activity,
  },
  {
    id: 'snapshots',
    label: 'Snapshots',
    shortLabel: 'Snapshots',
    description: 'Capture metadata for the current source.',
    icon: Clock3,
  },
  {
    id: 'review',
    label: 'Review',
    shortLabel: 'Review',
    description: 'Inspect block reuse and stored bytes.',
    icon: Archive,
  },
];

export function RepositoryPage({ api = chronaApi }: RepositoryPageProps) {
  const [repositoryPath, setRepositoryPath] = useState('');
  const [sourcePath, setSourcePath] = useState('');
  const [manifest, setManifest] = useState<RepositoryManifest | null>(null);
  const [progress, setProgress] = useState<BlockIngestProgress | null>(null);
  const [summary, setSummary] = useState<BlockIngestSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [activeChapter, setActiveChapter] = useState<ChapterId>('repository');
  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    repository: true,
    source: true,
    store: true,
    snapshots: true,
    review: true,
  });

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

  function togglePanel(panel: PanelKey) {
    setOpenPanels((current) => ({ ...current, [panel]: !current[panel] }));
  }

  function openChapter(chapter: ChapterId) {
    setActiveChapter(chapter);
  }

  function toggleTheme() {
    setTheme((current) => current === 'light' ? 'dark' : 'light');
  }

  function chapterTone(chapter: ChapterId): Tone {
    if (chapter === 'repository') {
      return manifest ? 'done' : 'ready';
    }
    if (chapter === 'source') {
      return summary ? 'done' : manifest ? 'ready' : 'waiting';
    }
    if (chapter === 'snapshots') {
      return manifest && sourcePath.trim().length > 0 ? 'ready' : 'waiting';
    }
    return summary ? 'done' : 'waiting';
  }

  function toneLabel(tone: Tone): string {
    if (tone === 'done') {
      return 'Ready';
    }
    if (tone === 'ready') {
      return 'Available';
    }
    return 'Waiting';
  }

  const activeChapterMeta = chapters.find((chapter) => chapter.id === activeChapter) ?? chapters[0];
  const statusLabel = manifest ? 'Repository open' : 'Repository closed';
  const sourceLabel = sourcePath.trim().length > 0 ? sourcePath : 'No source selected';
  const repositoryLabel = repositoryPath.trim().length > 0 ? repositoryPath : 'No repository selected';
  const repositoryState = manifest ? 'Open' : 'Closed';
  const sourceState = sourcePath.trim().length > 0 ? 'Selected' : 'Not selected';
  const blockReferenceState = summary ? summary.totalBlockReferences.toLocaleString() : '0';
  const storedByteState = summary ? formatBytes(summary.newlyStoredBytes) : '0 bytes';
  const sidebarStatus = manifest ? 'Repository ready' : 'Repository closed';
  const progressPercent = progress && progress.totalBytes > 0
    ? Math.min(100, Math.round((progress.totalBytesProcessed / progress.totalBytes) * 100))
    : 0;

  return (
    <main className="repository-page chapter-shell" data-theme={theme}>
      <header className="app-toolbar">
        <div className="app-title-group">
          <div>
            <p className="eyebrow">Chrona Phase 2</p>
            <h1>Chrona Workspace</h1>
          </div>
        </div>
        <div className="toolbar-state" aria-label="Workspace status">
          <button
            type="button"
            className="icon-button theme-toggle"
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            onClick={toggleTheme}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <span className={manifest ? 'status status-open' : 'status'}>
            {manifest ? <CheckCircle2 size={16} /> : <Database size={16} />}
            {statusLabel}
          </span>
          <span className="compact-stat">{summary ? `${summary.totalBlockReferences} block refs` : 'No run yet'}</span>
        </div>
      </header>

      <div className="chapter-layout">
        <aside className="chapter-sidebar">
          <div className="sidebar-product">
            <span className="brand-mark sidebar-brand-mark" aria-hidden="true">
              <Database size={18} />
            </span>
            <div>
              <strong>Chrona Desktop</strong>
              <span>Local storage engine</span>
            </div>
          </div>

          <div className="sidebar-label">Storage</div>
          <nav className="chapter-nav" aria-label="Workspace sections">
            {chapters.map((chapter) => {
              const Icon = chapter.icon;
              const tone = chapterTone(chapter.id);
              return (
                <button
                  key={chapter.id}
                  type="button"
                  className={`chapter-tab ${activeChapter === chapter.id ? 'chapter-tab-active' : ''}`}
                  onClick={() => openChapter(chapter.id)}
                >
                  <span className="chapter-tab-icon" aria-hidden="true"><Icon size={17} /></span>
                  <span className="chapter-tab-copy">
                    <strong>{chapter.label}</strong>
                  </span>
                  <span className={`nav-status nav-status-${tone}`}>{toneLabel(tone)}</span>
                </button>
              );
            })}
          </nav>

          <div className="sidebar-footer" aria-label="Storage engine status">
            <span className={manifest ? 'engine-dot engine-dot-active' : 'engine-dot'} aria-hidden="true" />
            <div>
              <strong>{sidebarStatus}</strong>
              <span>{progress ? progress.phase : 'Idle'}</span>
            </div>
          </div>
        </aside>

        <section className="chapter-stage" aria-labelledby="active-chapter-heading">
          <div className="chapter-stage-header">
            <div>
              <p className="eyebrow">Workspace section</p>
              <h2 id="active-chapter-heading">{activeChapterMeta.shortLabel}</h2>
              <p>{activeChapterMeta.description}</p>
            </div>
            <span className={`chapter-state chapter-state-${chapterTone(activeChapter)}`}>
              {toneLabel(chapterTone(activeChapter))}
            </span>
          </div>

          <section className="resource-overview" aria-label="Workspace overview">
            <div>
              <span>Repository</span>
              <strong>{repositoryState}</strong>
            </div>
            <div>
              <span>Source</span>
              <strong>{sourceState}</strong>
            </div>
            <div>
              <span>Block refs</span>
              <strong>{blockReferenceState}</strong>
            </div>
            <div>
              <span>Stored</span>
              <strong>{storedByteState}</strong>
            </div>
          </section>

          <section className="path-dock" aria-label="Current paths">
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

          <div className="panel-stack">
            {activeChapter === 'repository' && (
              <DropPanel
                title="Repository path and manifest"
                kicker="Repository"
                status={manifest ? 'Open' : 'Required'}
                icon={HardDrive}
                open={openPanels.repository}
                onToggle={() => togglePanel('repository')}
              >
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
                      setActiveChapter('source');
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
                      setActiveChapter('source');
                    })}
                  >
                    <HardDrive size={16} />
                    Open Repository
                  </button>
                </div>
                {manifest && (
                  <>
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
                    <div className="panel-footer-actions">
                      <button type="button" onClick={() => setActiveChapter('source')}>
                        Open Sources
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </>
                )}
              </DropPanel>
            )}

            {activeChapter === 'source' && (
              <>
                <DropPanel
                  title="Select a source"
                  kicker="Source"
                  status={sourcePath ? 'Selected' : 'Required'}
                  icon={FolderOpen}
                  open={openPanels.source}
                  onToggle={() => togglePanel('source')}
                >
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
                  </div>
                </DropPanel>

                <DropPanel
                  title="Analyze and store blocks"
                  kicker="Storage"
                  status={summary ? 'Stored' : manifest ? 'Ready' : 'Waiting'}
                  icon={Activity}
                  open={openPanels.store}
                  onToggle={() => togglePanel('store')}
                >
                  <div className="run-card">
                    <div>
                      <strong>Block ingest</strong>
                      <p>Streams the source into 1 MiB chunks and stores only new SHA-256 blocks.</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy || !manifest || sourcePath.trim().length === 0}
                      onClick={() => runAction(async () => {
                        setSummary(null);
                        setSummary(await api.ingestBlocks(repositoryPath, sourcePath));
                        setActiveChapter('review');
                      })}
                    >
                      <Play size={16} />
                      Analyze &amp; Store Blocks
                    </button>
                  </div>
                  {progress && <ProgressBox progress={progress} />}
                </DropPanel>
              </>
            )}

            {activeChapter === 'snapshots' && (
              <DropPanel
                title="Snapshot capture"
                kicker="Snapshots"
                status={manifest && sourcePath ? 'Ready' : 'Waiting'}
                icon={Clock3}
                open={openPanels.snapshots}
                onToggle={() => togglePanel('snapshots')}
              >
                <SnapshotPanel
                  api={api}
                  repositoryPath={repositoryPath}
                  sourcePath={sourcePath}
                  repositoryOpen={Boolean(manifest)}
                  embedded
                />
              </DropPanel>
            )}

            {activeChapter === 'review' && (
              <DropPanel
                title="Block ingest result"
                kicker="Review"
                status={summary ? 'Complete' : 'Empty'}
                icon={Layers3}
                open={openPanels.review}
                onToggle={() => togglePanel('review')}
              >
                <ResultContent summary={summary} reuseRatio={reuseRatio} />
              </DropPanel>
            )}
          </div>
        </section>
      </div>

      <footer className="command-footer" aria-label="Session progress">
        <div>
          <span className="status-dot" aria-hidden="true" />
          <strong>{progress ? progress.phase : 'idle'}</strong>
        </div>
        <div className="footer-progress">
          <span>{progress ? `${formatBytes(progress.totalBytesProcessed)} / ${formatBytes(progress.totalBytes)}` : 'No active ingest'}</span>
          <progress value={progressPercent} max={100} />
        </div>
        <span className="footer-file" title={progress?.currentFile ?? 'No file processing'}>
          {progress?.currentFile ?? 'No file processing'}
        </span>
      </footer>
    </main>
  );
}

interface DropPanelProps {
  title: string;
  kicker: string;
  status: string;
  icon: ComponentType<{ size?: number }>;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function DropPanel({ title, kicker, status, icon: Icon, open, onToggle, children }: DropPanelProps) {
  return (
    <section className={`drop-panel ${open ? 'drop-panel-open' : ''}`}>
      <button
        type="button"
        className="drop-panel-trigger"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="section-icon"><Icon size={18} /></span>
        <span className="drop-panel-title">
          <small>{kicker}</small>
          <strong>{title}</strong>
        </span>
        <span className="drop-panel-status">{status}</span>
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </button>
      {open && <div className="drop-panel-body">{children}</div>}
    </section>
  );
}

function ProgressBox({ progress }: { progress: BlockIngestProgress }) {
  return (
    <div className="progress-box" aria-label="Ingest progress">
      <div className="progress-line">
        <span>{progress.phase}</span>
        <span>{formatBytes(progress.totalBytesProcessed)} / {formatBytes(progress.totalBytes)}</span>
      </div>
      <progress value={progress.totalBytesProcessed} max={Math.max(progress.totalBytes, 1)} />
      {progress.currentFile && <p className="current-file">{progress.currentFile}</p>}
    </div>
  );
}

function ResultContent({ summary, reuseRatio }: { summary: BlockIngestSummary | null; reuseRatio: string }) {
  if (!summary) {
    return (
      <div className="empty-state">
        <span><Layers3 size={20} /></span>
        <div>
          <strong>No block run yet</strong>
          <p>Open a repository and analyze a source to see block reuse statistics here.</p>
        </div>
      </div>
    );
  }

  return (
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
