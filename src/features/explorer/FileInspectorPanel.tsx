import { AlertTriangle, Blocks, FileSearch, FolderSearch, History, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  desktopActions as defaultDesktopActions,
  type DesktopActions,
} from '../../shared/desktop/desktopActions';
import { useI18n } from '../../shared/i18n/I18nProvider';
import type {
  FileInspectionReport,
  FileInspectionVersion,
} from '../../shared/types/chrona';

interface FileInspectorPanelProps {
  selectedPath: string | null;
  report: FileInspectionReport | null;
  loading: boolean;
  error: string | null;
  desktopActions?: DesktopActions;
}

export function FileInspectorPanel({
  selectedPath,
  report,
  loading,
  error,
  desktopActions = defaultDesktopActions,
}: FileInspectorPanelProps) {
  const { t, formatDateTime, formatNumber } = useI18n();
  const defaultVersionId = useMemo(() => newestAvailableVersionId(report), [report]);
  const [selectedVersionId, setSelectedVersionId] = useState(defaultVersionId);

  useEffect(() => {
    setSelectedVersionId(defaultVersionId);
  }, [defaultVersionId, report?.relativePath]);

  if (!selectedPath) {
    return (
      <section className="file-inspector file-inspector-placeholder" aria-label={t('inspector.label')}>
        <FileSearch size={24} aria-hidden="true" />
        <div>
          <strong>{t('inspector.selectFile')}</strong>
          <p>{t('inspector.selectDescription')}</p>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="file-inspector file-inspector-placeholder" aria-label={t('inspector.label')}>
        <LoaderCircle size={24} aria-hidden="true" />
        <div>
          <strong>{t('inspector.loadingHistory')}</strong>
          <p title={selectedPath}>{selectedPath}</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="file-inspector file-inspector-placeholder file-inspector-error" aria-label={t('inspector.label')}>
        <AlertTriangle size={24} aria-hidden="true" />
        <div>
          <strong>{t('inspector.failed')}</strong>
          <p>{error}</p>
        </div>
      </section>
    );
  }

  if (!report) {
    return null;
  }

  const selectedVersion = report.versions.find(
    (version) => version.snapshotId === selectedVersionId,
  ) ?? report.versions.find((version) => version.snapshotId === defaultVersionId)
    ?? report.versions[0];
  const currentSourcePath = report.currentSourcePath;

  return (
    <section className="file-inspector" aria-label={t('inspector.label')}>
      <header className="file-inspector-header">
        <div>
          <span className="section-kicker">{t('inspector.kicker')}</span>
          <h3>{report.fileName}</h3>
          <p title={report.relativePath}>{report.relativePath}</p>
        </div>
        <span className={`file-history-state file-history-state-${report.latestState}`}>
          {report.latestState}
        </span>
      </header>

      <dl className="file-inspector-summary">
        <div><dt>{t('inspector.versions')}</dt><dd>{formatNumber(report.versionCount)}</dd></div>
        <div><dt>{t('inspector.firstSeen')}</dt><dd>{formatDateTime(report.firstSeenAt)}</dd></div>
        <div><dt>{t('inspector.lastSeen')}</dt><dd>{formatDateTime(report.lastSeenAt)}</dd></div>
      </dl>

      <div className="file-source-location" data-available={currentSourcePath ? 'true' : 'false'}>
        <div>
          <strong>{t('inspector.originalFile')}</strong>
          {currentSourcePath ? (
            <p title={currentSourcePath}>{currentSourcePath}</p>
          ) : (
            <p>{t('inspector.originalUnavailable')}</p>
          )}
        </div>
        {currentSourcePath && (
          <button
            type="button"
            aria-label={t('inspector.revealOriginal')}
            title={t('inspector.revealOriginal')}
            onClick={() => void desktopActions.revealPath(currentSourcePath)}
          >
            <FolderSearch size={15} aria-hidden="true" />
            {t('inspector.revealOriginal')}
          </button>
        )}
      </div>

      <label className="file-inspector-version">
        <span>{t('inspector.snapshotVersion')}</span>
        <select
          value={selectedVersion?.snapshotId ?? ''}
          onChange={(event) => setSelectedVersionId(event.target.value)}
        >
          {report.versions.map((version) => (
            <option key={version.snapshotId} value={version.snapshotId}>
              {version.snapshotName} · {version.state} · {formatDateTime(version.snapshotCreatedAt)}
            </option>
          ))}
        </select>
      </label>

      {selectedVersion && (
        <VersionBlocks version={selectedVersion} />
      )}

      <div className="file-history-section">
        <div className="file-inspector-section-heading">
          <History size={16} aria-hidden="true" />
          <strong>{t('inspector.snapshotHistory')}</strong>
        </div>
        <ol className="file-history">
          {report.versions.map((version) => (
            <li key={version.snapshotId}>
              <div>
                <strong>{version.snapshotName}</strong>
                <small>{formatDateTime(version.snapshotCreatedAt)}</small>
              </div>
              <span className={`file-history-state file-history-state-${version.state}`}>
                {version.state}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function VersionBlocks({ version }: { version: FileInspectionVersion }) {
  const { t, formatBytes, formatNumber } = useI18n();

  return (
    <div className="file-block-section">
      <div className="file-inspector-section-heading">
        <Blocks size={16} aria-hidden="true" />
        <strong>{t('inspector.blockSequence')}</strong>
        <span>
          {t('inspector.blockReferences', {
            references: formatNumber(version.totalBlockReferences),
            unique: formatNumber(version.uniqueBlockCount),
          })}
        </span>
      </div>

      {version.blocks.length === 0 ? (
        <p className="file-block-empty">{t('inspector.noBlocks')}</p>
      ) : (
        <ol className="file-block-map">
          {version.blocks.map((block) => (
            <li
              key={`${version.snapshotId}-${block.index}-${block.hash}`}
              className={`file-block-item file-block-item-${block.encoding}`}
            >
              <div className="file-block-title">
                <strong>{t('inspector.block', { index: block.index })}</strong>
                <span>{block.encoding}</span>
              </div>
              <code title={block.hash}>{block.hash.slice(0, 12)}</code>
              <dl>
                <div><dt>{t('inspector.logical')}</dt><dd>{formatBytes(block.sizeBytes)}</dd></div>
                <div><dt>{t('inspector.stored')}</dt><dd>{formatOptionalBytes(block.storedSizeBytes, formatBytes, t)}</dd></div>
              </dl>
              <small>{t('inspector.seenVersions', {
                state: block.storageState,
                count: formatNumber(block.seenInVersionCount),
              })}</small>
              {block.issue && <p title={block.issue}>{block.issue}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function newestAvailableVersionId(report: FileInspectionReport | null): string {
  if (!report) return '';
  return report.versions.find((version) => version.blocks.length > 0)?.snapshotId
    ?? report.versions[0]?.snapshotId
    ?? '';
}

function formatOptionalBytes(
  value: number | null,
  formatBytes: (bytes: number) => string,
  t: (key: 'common.unavailable') => string,
): string {
  return value === null ? t('common.unavailable') : formatBytes(value);
}
