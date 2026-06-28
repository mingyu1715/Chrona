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
  Files,
  FolderOpen,
  HardDrive,
  Home,
  Layers3,
  Moon,
  Pin,
  PinOff,
  Play,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Trash2,
} from 'lucide-react';

import { chronaApi, type ChronaApi } from '../../shared/api/chronaApi';
import { SnapshotPanel } from '../snapshots/SnapshotPanel';
import type {
  AccessNode,
  BlockIngestProgress,
  BlockIngestSummary,
  FileKind,
  HomeSummary,
  IntegrityReport,
  RepositoryInventoryReport,
  RepositoryManifest,
  SnapshotPresenceState,
  SourceExistenceState,
} from '../../shared/types/chrona';
import './RepositoryPage.css';

interface RepositoryPageProps {
  api?: ChronaApi;
}

type ChapterId =
  | 'home'
  | 'repository'
  | 'source'
  | 'snapshots'
  | 'explorer'
  | 'integrity'
  | 'review';
type PanelKey =
  | 'home'
  | 'repository'
  | 'source'
  | 'store'
  | 'snapshots'
  | 'explorer'
  | 'integrity'
  | 'review';
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
    id: 'home',
    label: 'Home',
    shortLabel: 'Home',
    description: 'Resume recent repositories, sources, snapshots, and compare pairs.',
    icon: Home,
  },
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
    id: 'explorer',
    label: 'Explorer',
    shortLabel: 'Explorer',
    description: 'Browse recorded files and their current availability.',
    icon: Files,
  },
  {
    id: 'integrity',
    label: 'Integrity',
    shortLabel: 'Integrity',
    description: 'Verify snapshot block references against stored block files.',
    icon: ShieldCheck,
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
  const [homeSummary, setHomeSummary] = useState<HomeSummary | null>(null);
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);
  const [inventoryReport, setInventoryReport] = useState<RepositoryInventoryReport | null>(null);
  const [inventoryQuery, setInventoryQuery] = useState('');
  const [inventoryKindFilter, setInventoryKindFilter] = useState<FileKind | 'all'>('all');
  const [inventorySnapshotFilter, setInventorySnapshotFilter] =
    useState<SnapshotPresenceState | 'all'>('all');
  const [inventorySourceFilter, setInventorySourceFilter] =
    useState<SourceExistenceState | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [activeChapter, setActiveChapter] = useState<ChapterId>('repository');
  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    home: true,
    repository: true,
    source: true,
    store: true,
    snapshots: true,
    explorer: true,
    integrity: true,
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

  async function refreshHomeSummary(path = repositoryPath) {
    if (path.trim().length === 0) {
      setHomeSummary(null);
      return;
    }
    setHomeSummary(await api.getHomeSummary(path));
  }

  async function recordRepositoryAccess(nextManifest: RepositoryManifest, path: string, action: string) {
    await api.recordAccessEvent(path, {
      key: `repository:${nextManifest.repositoryId}`,
      kind: 'repository',
      label: labelFromPath(path),
      path,
      repositoryId: nextManifest.repositoryId,
      snapshotId: null,
      baseSnapshotId: null,
      targetSnapshotId: null,
      action,
      accessedAt: new Date().toISOString(),
    });
    await refreshHomeSummary(path);
  }

  async function recordSourceAccess(action: string) {
    if (!manifest || repositoryPath.trim().length === 0 || sourcePath.trim().length === 0) {
      return;
    }
    await api.recordAccessEvent(repositoryPath, {
      key: `source:${sourcePath}`,
      kind: 'source',
      label: labelFromPath(sourcePath),
      path: sourcePath,
      repositoryId: manifest.repositoryId,
      snapshotId: null,
      baseSnapshotId: null,
      targetSnapshotId: null,
      action,
      accessedAt: new Date().toISOString(),
    });
    await refreshHomeSummary();
  }

  async function pinHomeItem(key: string) {
    await runAction(async () => {
      await api.pinAccessItem(repositoryPath, key);
      await refreshHomeSummary();
    });
  }

  async function unpinHomeItem(key: string) {
    await runAction(async () => {
      await api.unpinAccessItem(repositoryPath, key);
      await refreshHomeSummary();
    });
  }

  async function clearHomeHistory() {
    await runAction(async () => {
      await api.clearAccessHistory(repositoryPath);
      await refreshHomeSummary();
    });
  }

  async function verifyRepositoryIntegrity() {
    await runAction(async () => {
      setIntegrityReport(await api.verifyRepository(repositoryPath));
    });
  }

  async function refreshInventory() {
    await runAction(async () => {
      setInventoryReport(await api.getRepositoryInventory(repositoryPath));
    });
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
    if (chapter === 'home') {
      return manifest ? 'ready' : 'waiting';
    }
    if (chapter === 'repository') {
      return manifest ? 'done' : 'ready';
    }
    if (chapter === 'source') {
      return summary ? 'done' : manifest ? 'ready' : 'waiting';
    }
    if (chapter === 'snapshots') {
      return manifest && sourcePath.trim().length > 0 ? 'ready' : 'waiting';
    }
    if (chapter === 'explorer') {
      return inventoryReport ? 'done' : manifest ? 'ready' : 'waiting';
    }
    if (chapter === 'integrity') {
      return integrityReport ? 'done' : manifest ? 'ready' : 'waiting';
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
            {activeChapter === 'home' && (
              <DropPanel
                title="Continue working"
                kicker="Home"
                status={homeSummary?.continueWorking ? 'Ready' : manifest ? 'Empty' : 'Waiting'}
                icon={Home}
                open={openPanels.home}
                onToggle={() => togglePanel('home')}
              >
                <HomeContent
                  summary={homeSummary}
                  repositoryOpen={Boolean(manifest)}
                  repositoryPath={repositoryPath}
                  onOpenRepository={() => setActiveChapter('repository')}
                  onRefresh={() => runAction(async () => refreshHomeSummary())}
                  onClear={clearHomeHistory}
                  onPin={pinHomeItem}
                  onUnpin={unpinHomeItem}
                  busy={busy}
                />
              </DropPanel>
            )}

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
                      const nextManifest = await api.createRepository(repositoryPath);
                      setManifest(nextManifest);
                      setIntegrityReport(null);
                      setInventoryReport(null);
                      setInventoryQuery('');
                      setInventoryKindFilter('all');
                      setInventorySnapshotFilter('all');
                      setInventorySourceFilter('all');
                      await recordRepositoryAccess(nextManifest, repositoryPath, 'repository_created');
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
                      const nextManifest = await api.openRepository(repositoryPath);
                      setManifest(nextManifest);
                      setIntegrityReport(null);
                      setInventoryReport(null);
                      setInventoryQuery('');
                      setInventoryKindFilter('all');
                      setInventorySnapshotFilter('all');
                      setInventorySourceFilter('all');
                      await recordRepositoryAccess(nextManifest, repositoryPath, 'repository_opened');
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
                        await recordSourceAccess('ingest_completed');
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

            {activeChapter === 'explorer' && (
              <DropPanel
                title="Repository inventory"
                kicker="Explorer"
                status={inventoryReport ? 'Loaded' : manifest ? 'Ready' : 'Waiting'}
                icon={Files}
                open={openPanels.explorer}
                onToggle={() => togglePanel('explorer')}
              >
                <div className="run-card">
                  <div>
                    <strong>Repository inventory</strong>
                    <p>
                      {inventoryReport
                        ? `${inventoryReport.knownFileCount.toLocaleString()} known files · ${inventoryReport.snapshotCount.toLocaleString()} snapshots`
                        : 'No inventory report loaded'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy || !manifest}
                    onClick={refreshInventory}
                  >
                    <RotateCw size={16} />
                    Refresh Inventory
                  </button>
                </div>
                <InventoryContent
                  report={inventoryReport}
                  repositoryOpen={Boolean(manifest)}
                  query={inventoryQuery}
                  kindFilter={inventoryKindFilter}
                  snapshotFilter={inventorySnapshotFilter}
                  sourceFilter={inventorySourceFilter}
                  onQueryChange={setInventoryQuery}
                  onKindFilterChange={setInventoryKindFilter}
                  onSnapshotFilterChange={setInventorySnapshotFilter}
                  onSourceFilterChange={setInventorySourceFilter}
                />
              </DropPanel>
            )}

            {activeChapter === 'integrity' && (
              <DropPanel
                title="Repository integrity"
                kicker="Integrity"
                status={integrityReport ? integrityStatusLabel(integrityReport.status) : manifest ? 'Ready' : 'Waiting'}
                icon={ShieldCheck}
                open={openPanels.integrity}
                onToggle={() => togglePanel('integrity')}
              >
                <div className="run-card">
                  <div>
                    <strong>Integrity verification</strong>
                    <p>Checks snapshot block references, missing blocks, block sizes, and raw SHA-256 identity.</p>
                  </div>
                  <button
                    type="button"
                    disabled={busy || !manifest}
                    onClick={verifyRepositoryIntegrity}
                  >
                    <ShieldCheck size={16} />
                    Verify Repository
                  </button>
                </div>
                <IntegrityReportContent report={integrityReport} repositoryOpen={Boolean(manifest)} />
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

function HomeContent({
  summary,
  repositoryOpen,
  repositoryPath,
  onOpenRepository,
  onRefresh,
  onClear,
  onPin,
  onUnpin,
  busy,
}: {
  summary: HomeSummary | null;
  repositoryOpen: boolean;
  repositoryPath: string;
  onOpenRepository: () => void;
  onRefresh: () => void;
  onClear: () => void;
  onPin: (key: string) => void;
  onUnpin: (key: string) => void;
  busy: boolean;
}) {
  if (!repositoryOpen) {
    return (
      <div className="empty-state">
        <span><Home size={20} /></span>
        <div>
          <strong>No repository open</strong>
          <p>Open a repository to show recent work and pinned paths.</p>
          <button type="button" onClick={onOpenRepository}>Open Repository</button>
        </div>
      </div>
    );
  }

  const hasHistory = Boolean(
    summary?.continueWorking
    || summary?.pinned.length
    || summary?.recentRepositories.length
    || summary?.recentSources.length
    || summary?.recentSnapshots.length
    || summary?.recentComparePairs.length,
  );

  return (
    <div className="home-content">
      <div className="home-toolbar">
        <div>
          <strong title={repositoryPath}>{labelFromPath(repositoryPath)}</strong>
          <span>Adaptive access history</span>
        </div>
        <div className="home-toolbar-actions">
          <button type="button" className="button-secondary" disabled={busy} onClick={onRefresh}>
            <RotateCw size={16} />
            Refresh
          </button>
          <button type="button" className="button-secondary" disabled={busy || !hasHistory} onClick={onClear}>
            <Trash2 size={16} />
            Clear History
          </button>
        </div>
      </div>

      {summary?.continueWorking ? (
        <div className="continue-card">
          <span><Clock3 size={20} /></span>
          <div>
            <small>Continue Working</small>
            <strong>{summary.continueWorking.label}</strong>
            <p>{summary.continueWorking.lastAction} · {summary.continueWorking.lastAccessedAt}</p>
          </div>
        </div>
      ) : (
        <div className="empty-state compact-empty">
          <span><Clock3 size={18} /></span>
          <div>
            <strong>No access history yet</strong>
            <p>Create/open a repository or store blocks to populate Home.</p>
          </div>
        </div>
      )}

      <div className="home-grid">
        <AccessList title="Pinned" items={summary?.pinned ?? []} onPin={onPin} onUnpin={onUnpin} />
        <AccessList title="Recent repositories" items={summary?.recentRepositories ?? []} onPin={onPin} onUnpin={onUnpin} />
        <AccessList title="Recent sources" items={summary?.recentSources ?? []} onPin={onPin} onUnpin={onUnpin} />
        <AccessList title="Recent snapshots" items={summary?.recentSnapshots ?? []} onPin={onPin} onUnpin={onUnpin} />
        <AccessList title="Recent compare pairs" items={summary?.recentComparePairs ?? []} onPin={onPin} onUnpin={onUnpin} />
      </div>
    </div>
  );
}

function AccessList({
  title,
  items,
  onPin,
  onUnpin,
}: {
  title: string;
  items: AccessNode[];
  onPin: (key: string) => void;
  onUnpin: (key: string) => void;
}) {
  return (
    <section className="access-list">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="muted-line">No items</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.key}>
              <div>
                <strong>{item.label}</strong>
                <span>{item.lastAction} · {item.accessCount}x</span>
              </div>
              <button
                type="button"
                className="icon-button access-pin"
                aria-label={item.pinned ? `Unpin ${item.label}` : `Pin ${item.label}`}
                onClick={() => item.pinned ? onUnpin(item.key) : onPin(item.key)}
              >
                {item.pinned ? <PinOff size={15} /> : <Pin size={15} />}
              </button>
            </li>
          ))}
        </ul>
      )}
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

function IntegrityReportContent({
  report,
  repositoryOpen,
}: {
  report: IntegrityReport | null;
  repositoryOpen: boolean;
}) {
  if (!repositoryOpen) {
    return (
      <div className="empty-state integrity-empty">
        <span><ShieldAlert size={20} /></span>
        <div>
          <strong>No repository open</strong>
          <p>Open a repository before running integrity verification.</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="empty-state integrity-empty">
        <span><ShieldCheck size={20} /></span>
        <div>
          <strong>No integrity report yet</strong>
          <p>Run verification to check stored blocks against snapshot references.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="integrity-report">
      <div className={`integrity-status integrity-status-${report.status}`}>
        {report.status === 'failed' ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
        <strong>Integrity {integrityStatusLabel(report.status)}</strong>
        <span>{report.checkedAt}</span>
      </div>

      <dl className="result-grid integrity-grid">
        <div>
          <dt>Snapshots checked</dt>
          <dd>{report.snapshotCount}</dd>
        </div>
        <div>
          <dt>Files checked</dt>
          <dd>{report.fileCount}</dd>
        </div>
        <div>
          <dt>Block references</dt>
          <dd>{report.blockReferenceCount}</dd>
        </div>
        <div>
          <dt>Unique blocks</dt>
          <dd>{report.uniqueBlockCount}</dd>
        </div>
        <div>
          <dt>Missing blocks</dt>
          <dd>{report.missingBlockCount}</dd>
        </div>
        <div>
          <dt>Corrupt blocks</dt>
          <dd>{report.corruptBlockCount}</dd>
        </div>
      </dl>

      {report.issues.length === 0 ? (
        <p className="integrity-clean">No integrity issues found</p>
      ) : (
        <ul className="issue-list" aria-label="Integrity issues">
          {report.issues.map((issue, index) => (
            <li key={`${issue.code}-${index}`} className={`issue-list-${issue.severity}`}>
              <div>
                <strong>{issue.code}</strong>
                <p>{issue.message}</p>
              </div>
              <small>
                {[issue.snapshotId, issue.relativePath, issue.blockHash].filter(Boolean).join(' · ')}
              </small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InventoryContent({
  report,
  repositoryOpen,
  query,
  kindFilter,
  snapshotFilter,
  sourceFilter,
  onQueryChange,
  onKindFilterChange,
  onSnapshotFilterChange,
  onSourceFilterChange,
}: {
  report: RepositoryInventoryReport | null;
  repositoryOpen: boolean;
  query: string;
  kindFilter: FileKind | 'all';
  snapshotFilter: SnapshotPresenceState | 'all';
  sourceFilter: SourceExistenceState | 'all';
  onQueryChange: (value: string) => void;
  onKindFilterChange: (value: FileKind | 'all') => void;
  onSnapshotFilterChange: (value: SnapshotPresenceState | 'all') => void;
  onSourceFilterChange: (value: SourceExistenceState | 'all') => void;
}) {
  if (!repositoryOpen) {
    return (
      <div className="empty-state inventory-empty">
        <span><Files size={20} /></span>
        <div>
          <strong>No repository open</strong>
          <p>Inventory is unavailable.</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="empty-state inventory-empty">
        <span><Files size={20} /></span>
        <div>
          <strong>No inventory loaded</strong>
          <p>Refresh to read the current snapshot metadata.</p>
        </div>
      </div>
    );
  }

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const availableKinds = Array.from(new Set(report.files.map((file) => file.kind))).sort();
  const filteredFiles = report.files.filter((file) => {
    const matchesQuery = normalizedQuery.length === 0
      || file.relativePath.toLocaleLowerCase().includes(normalizedQuery);
    const matchesKind = kindFilter === 'all' || file.kind === kindFilter;
    const matchesSnapshot = snapshotFilter === 'all' || file.snapshotState === snapshotFilter;
    const matchesSource = sourceFilter === 'all' || file.sourceState === sourceFilter;
    return matchesQuery && matchesKind && matchesSnapshot && matchesSource;
  });

  return (
    <div className="inventory-content">
      <dl className="result-grid inventory-summary">
        <div>
          <dt>Snapshots</dt>
          <dd>{report.snapshotCount.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Known files</dt>
          <dd>{report.knownFileCount.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Latest files</dt>
          <dd>{report.latestFileCount.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Deleted in latest</dt>
          <dd>{report.deletedInLatestCount.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Source missing</dt>
          <dd>{(report.sourceMissingCount + report.sourceRootMissingCount).toLocaleString()}</dd>
        </div>
      </dl>

      <div className="inventory-kind-strip" aria-label="File kind summary">
        {report.kindStats.length === 0 ? (
          <span>No file kinds recorded</span>
        ) : report.kindStats.map((stat) => (
          <span key={stat.kind}>
            <strong>{stat.kind}</strong>
            {stat.fileCount.toLocaleString()} · {formatBytes(stat.totalBytesLatest)}
          </span>
        ))}
      </div>

      <div className="inventory-filters" aria-label="Inventory filters">
        <label>
          <span>File search</span>
          <input
            type="search"
            value={query}
            placeholder="Search recorded paths"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <label>
          <span>File kind</span>
          <select
            value={kindFilter}
            onChange={(event) => onKindFilterChange(event.target.value as FileKind | 'all')}
          >
            <option value="all">All kinds</option>
            {availableKinds.map((kind) => (
              <option key={kind} value={kind}>{kind}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Snapshot state</span>
          <select
            value={snapshotFilter}
            onChange={(event) => onSnapshotFilterChange(
              event.target.value as SnapshotPresenceState | 'all',
            )}
          >
            <option value="all">All snapshot states</option>
            <option value="presentInLatest">Present in latest</option>
            <option value="deletedInLatest">Deleted in latest</option>
          </select>
        </label>
        <label>
          <span>Source state</span>
          <select
            value={sourceFilter}
            onChange={(event) => onSourceFilterChange(
              event.target.value as SourceExistenceState | 'all',
            )}
          >
            <option value="all">All source states</option>
            <option value="exists">Exists</option>
            <option value="missing">Missing</option>
            <option value="sourceRootMissing">Source root missing</option>
            <option value="unchecked">Unchecked</option>
          </select>
        </label>
      </div>

      <p className="inventory-result-count">
        {filteredFiles.length.toLocaleString()} of {report.files.length.toLocaleString()} files
      </p>

      <div className="inventory-table-wrap">
        <table className="inventory-table">
          <thead>
            <tr>
              <th scope="col">Path</th>
              <th scope="col">Kind</th>
              <th scope="col">Latest size</th>
              <th scope="col">Snapshot state</th>
              <th scope="col">Source state</th>
              <th scope="col">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {filteredFiles.map((file) => (
              <tr key={file.relativePath}>
                <td className="inventory-path" title={file.relativePath}>{file.relativePath}</td>
                <td><span className="inventory-kind">{file.kind}</span></td>
                <td>{file.latestSizeBytes === null ? '—' : formatBytes(file.latestSizeBytes)}</td>
                <td>
                  <span className={`inventory-state inventory-state-${file.snapshotState}`}>
                    {file.snapshotState}
                  </span>
                </td>
                <td>
                  <span className={`inventory-state inventory-state-${file.sourceState}`}>
                    {file.sourceState}
                  </span>
                </td>
                <td title={file.lastSeenAt}>{file.lastSeenSnapshotId}</td>
              </tr>
            ))}
            {filteredFiles.length === 0 && (
              <tr>
                <td className="inventory-no-results" colSpan={6}>No matching files</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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

function integrityStatusLabel(status: IntegrityReport['status']): string {
  if (status === 'healthy') {
    return 'Healthy';
  }
  if (status === 'warning') {
    return 'Warning';
  }
  return 'Failed';
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

function labelFromPath(path: string): string {
  const normalized = path.trim();
  if (!normalized) {
    return 'Untitled';
  }
  const parts = normalized.split(/[\\/]+/).filter(Boolean);
  return parts.at(-1) ?? normalized;
}
