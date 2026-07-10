import { FileSearch, RefreshCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { ChronaApi } from '../../shared/api/chronaApi';
import type { DesktopActions } from '../../shared/desktop/desktopActions';
import { useI18n } from '../../shared/i18n/I18nProvider';
import type {
  BackupSource,
  FileInspectionReport,
  FileKind,
  RepositoryInventoryReport,
  SnapshotPresenceState,
  SourceExistenceState,
} from '../../shared/types/chrona';
import { FileInspectorPanel } from './FileInspectorPanel';
import './explorer-page.css';

interface ExplorerPageProps {
  api: ChronaApi;
  repositoryPath: string;
  desktopActions?: DesktopActions;
  selectedSourceId?: string | null;
  onSelectSourceId?: (sourceId: string | null) => void;
}

export function ExplorerPage({
  api,
  repositoryPath,
  desktopActions,
  selectedSourceId = null,
  onSelectSourceId,
}: ExplorerPageProps) {
  const { t, formatBytes, formatNumber } = useI18n();
  const [report, setReport] = useState<RepositoryInventoryReport | null>(null);
  const [sources, setSources] = useState<BackupSource[]>([]);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<FileKind | 'all'>('all');
  const [snapshotFilter, setSnapshotFilter] = useState<SnapshotPresenceState | 'all'>('all');
  const [sourceStateFilter, setSourceStateFilter] = useState<SourceExistenceState | 'all'>('all');
  const [selectedFile, setSelectedFile] = useState<{ relativePath: string; sourceId: string | null } | null>(null);
  const [inspection, setInspection] = useState<FileInspectionReport | null>(null);
  const [inspectionLoading, setInspectionLoading] = useState(false);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inspectionRequestId = useRef(0);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [nextReport, sourceIndex] = await Promise.all([
        api.getRepositoryInventory(repositoryPath),
        api.listSources(repositoryPath),
      ]);
      setReport(nextReport);
      setSources(sourceIndex.sources);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    inspectionRequestId.current += 1;
    setReport(null);
    setSelectedFile(null);
    setInspection(null);
    setInspectionError(null);
    void refresh();
  }, [api, repositoryPath]);

  useEffect(() => {
    inspectionRequestId.current += 1;
    setSelectedFile(null);
    setInspection(null);
    setInspectionError(null);
  }, [selectedSourceId]);

  async function inspect(relativePath: string, sourceId: string | null) {
    const requestId = ++inspectionRequestId.current;
    setSelectedFile({ relativePath, sourceId });
    setInspection(null);
    setInspectionError(null);
    setInspectionLoading(true);
    try {
      const nextInspection = await api.inspectRepositoryFile(repositoryPath, relativePath, sourceId);
      if (requestId === inspectionRequestId.current) setInspection(nextInspection);
    } catch (caught) {
      if (requestId === inspectionRequestId.current) {
        setInspectionError(caught instanceof Error ? caught.message : String(caught));
      }
    } finally {
      if (requestId === inspectionRequestId.current) setInspectionLoading(false);
    }
  }

  const availableKinds = useMemo(
    () => [...new Set(report?.files.map((file) => file.kind) ?? [])].sort(),
    [report],
  );
  const filteredFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return (report?.files ?? []).filter((file) => (
      (!normalizedQuery || file.relativePath.toLocaleLowerCase().includes(normalizedQuery))
      && (kindFilter === 'all' || file.kind === kindFilter)
      && (snapshotFilter === 'all' || file.snapshotState === snapshotFilter)
      && (sourceStateFilter === 'all' || file.sourceState === sourceStateFilter)
      && (!selectedSourceId || file.sourceId === selectedSourceId)
    ));
  }, [report, query, kindFilter, snapshotFilter, sourceStateFilter, selectedSourceId]);
  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);

  return (
    <div className="explorer-page">
      <header className="workspace-header explorer-page__header">
        <div>
          <h1>{t('files.title')}</h1>
          <p>{t('files.description')}</p>
        </div>
        <button className="explorer-page__refresh" type="button" disabled={loading} onClick={() => void refresh()}>
          <RefreshCcw size={16} aria-hidden="true" />
          {t('files.refresh')}
        </button>
      </header>

      {error && <p className="workspace-error" role="alert">{error}</p>}

      <dl className="explorer-summary">
        <div><dt>{t('nav.snapshots')}</dt><dd>{report ? formatNumber(report.snapshotCount) : '-'}</dd></div>
        <div><dt>{t('files.knownFiles')}</dt><dd>{report ? formatNumber(report.knownFileCount) : '-'}</dd></div>
        <div><dt>{t('files.latestFiles')}</dt><dd>{report ? formatNumber(report.latestFileCount) : '-'}</dd></div>
        <div><dt>{t('common.deleted')}</dt><dd>{report ? formatNumber(report.deletedInLatestCount) : '-'}</dd></div>
        <div><dt>{t('files.missingSource')}</dt><dd>{report ? formatNumber(report.sourceMissingCount + report.sourceRootMissingCount) : '-'}</dd></div>
      </dl>

      <div className="explorer-filters" aria-label={t('files.filters')}>
        <label>
          <span>{t('files.search')}</span>
          <input type="search" value={query} placeholder={t('files.searchPlaceholder')} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label>
          <span>{t('sources.filterLabel')}</span>
          <select value={selectedSourceId ?? 'all'} onChange={(event) => onSelectSourceId?.(event.target.value === 'all' ? null : event.target.value)}>
            <option value="all">{t('sources.allSources')}</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>{source.displayName}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('common.kind')}</span>
          <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as FileKind | 'all')}>
            <option value="all">{t('files.allKinds')}</option>
            {availableKinds.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
          </select>
        </label>
        <label>
          <span>{t('common.snapshot')}</span>
          <select value={snapshotFilter} onChange={(event) => setSnapshotFilter(event.target.value as SnapshotPresenceState | 'all')}>
            <option value="all">{t('files.allStates')}</option>
            <option value="presentInLatest">{t('files.present')}</option>
            <option value="deletedInLatest">{t('common.deleted')}</option>
          </select>
        </label>
        <label>
          <span>{t('common.source')}</span>
          <select value={sourceStateFilter} onChange={(event) => setSourceStateFilter(event.target.value as SourceExistenceState | 'all')}>
            <option value="all">{t('files.allStates')}</option>
            <option value="exists">{t('files.exists')}</option>
            <option value="missing">{t('files.missing')}</option>
            <option value="sourceRootMissing">{t('files.rootMissing')}</option>
            <option value="unchecked">{t('files.unchecked')}</option>
          </select>
        </label>
      </div>

      <div className="explorer-workspace">
        <section className="explorer-list workspace-pane-scroll" data-testid="file-list-pane" aria-label={t('files.repositoryFiles')}>
          <div className="explorer-list__count">
            <span>{t('files.fileCount', { count: formatNumber(filteredFiles.length) })}</span>
            {loading && <span>{t('files.refreshing')}</span>}
          </div>
          {report && filteredFiles.length > 0 ? (
            <table>
              <thead><tr><th>{t('common.path')}</th><th>{t('common.kind')}</th><th>{t('common.size')}</th><th>{t('common.snapshot')}</th><th>{t('common.source')}</th></tr></thead>
              <tbody>
                {filteredFiles.map((file) => (
                  <tr key={fileKey(file.sourceId, file.relativePath)} data-selected={selectedFile?.relativePath === file.relativePath && selectedFile.sourceId === (file.sourceId ?? null) || undefined}>
                    <td>
                      <button type="button" aria-label={t('files.inspect', { path: file.relativePath })} title={file.relativePath} onClick={() => void inspect(file.relativePath, file.sourceId ?? null)}>
                        {file.relativePath}
                      </button>
                    </td>
                    <td>{file.kind}</td>
                    <td>{file.latestSizeBytes === null ? '-' : formatBytes(file.latestSizeBytes)}</td>
                    <td>{formatState(file.snapshotState)}</td>
                    <td title={sourceById.get(file.sourceId ?? '')?.path ?? undefined}>
                      {sourceById.get(file.sourceId ?? '')?.displayName ?? t('sources.unassigned')} · {formatState(file.sourceState)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="explorer-list__empty">
              <FileSearch size={20} aria-hidden="true" />
              <span>{report ? t('files.noMatching') : t('files.loadingRepositoryFiles')}</span>
            </div>
          )}
        </section>

        <div className="explorer-detail workspace-pane-scroll" data-testid="file-detail-pane">
          <FileInspectorPanel
            key={selectedFile ? fileKey(selectedFile.sourceId, selectedFile.relativePath) : 'no-selection'}
            selectedPath={selectedFile?.relativePath ?? null}
            report={inspection}
            loading={inspectionLoading}
            error={inspectionError}
            desktopActions={desktopActions}
          />
        </div>
      </div>
    </div>
  );
}

function formatState(value: string) {
  return value.replace(/([A-Z])/g, ' $1').toLocaleLowerCase();
}

function fileKey(sourceId: string | null | undefined, relativePath: string) {
  return `${sourceId ?? 'legacy'}:${relativePath}`;
}
