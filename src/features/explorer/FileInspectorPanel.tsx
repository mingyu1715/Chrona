import { AlertTriangle, Blocks, FileSearch, History, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type {
  FileInspectionReport,
  FileInspectionVersion,
} from '../../shared/types/chrona';

interface FileInspectorPanelProps {
  selectedPath: string | null;
  report: FileInspectionReport | null;
  loading: boolean;
  error: string | null;
}

export function FileInspectorPanel({
  selectedPath,
  report,
  loading,
  error,
}: FileInspectorPanelProps) {
  const defaultVersionId = useMemo(() => newestAvailableVersionId(report), [report]);
  const [selectedVersionId, setSelectedVersionId] = useState(defaultVersionId);

  useEffect(() => {
    setSelectedVersionId(defaultVersionId);
  }, [defaultVersionId, report?.relativePath]);

  if (!selectedPath) {
    return (
      <section className="file-inspector file-inspector-placeholder" aria-label="File inspector">
        <FileSearch size={24} aria-hidden="true" />
        <div>
          <strong>Select a file to inspect</strong>
          <p>Choose a recorded path to view its blocks and snapshot history.</p>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="file-inspector file-inspector-placeholder" aria-label="File inspector">
        <LoaderCircle size={24} aria-hidden="true" />
        <div>
          <strong>Loading file history</strong>
          <p title={selectedPath}>{selectedPath}</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="file-inspector file-inspector-placeholder file-inspector-error" aria-label="File inspector">
        <AlertTriangle size={24} aria-hidden="true" />
        <div>
          <strong>File inspection failed</strong>
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

  return (
    <section className="file-inspector" aria-label="File inspector">
      <header className="file-inspector-header">
        <div>
          <span className="section-kicker">File Inspector</span>
          <h3>{report.fileName}</h3>
          <p title={report.relativePath}>{report.relativePath}</p>
        </div>
        <span className={`file-history-state file-history-state-${report.latestState}`}>
          {report.latestState}
        </span>
      </header>

      <dl className="file-inspector-summary">
        <div><dt>Versions</dt><dd>{report.versionCount.toLocaleString()}</dd></div>
        <div><dt>First seen</dt><dd>{formatDate(report.firstSeenAt)}</dd></div>
        <div><dt>Last seen</dt><dd>{formatDate(report.lastSeenAt)}</dd></div>
      </dl>

      <label className="file-inspector-version">
        <span>Snapshot version</span>
        <select
          value={selectedVersion?.snapshotId ?? ''}
          onChange={(event) => setSelectedVersionId(event.target.value)}
        >
          {report.versions.map((version) => (
            <option key={version.snapshotId} value={version.snapshotId}>
              {version.snapshotName} · {version.state} · {formatDate(version.snapshotCreatedAt)}
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
          <strong>Snapshot history</strong>
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
  return (
    <div className="file-block-section">
      <div className="file-inspector-section-heading">
        <Blocks size={16} aria-hidden="true" />
        <strong>Block sequence</strong>
        <span>
          {version.totalBlockReferences.toLocaleString()} references ·{' '}
          {version.uniqueBlockCount.toLocaleString()} unique
        </span>
      </div>

      {version.blocks.length === 0 ? (
        <p className="file-block-empty">No blocks in this snapshot.</p>
      ) : (
        <ol className="file-block-map">
          {version.blocks.map((block) => (
            <li
              key={`${version.snapshotId}-${block.index}-${block.hash}`}
              className={`file-block-item file-block-item-${block.encoding}`}
            >
              <div className="file-block-title">
                <strong>Block {block.index}</strong>
                <span>{block.encoding}</span>
              </div>
              <code title={block.hash}>{block.hash.slice(0, 12)}</code>
              <dl>
                <div><dt>Logical</dt><dd>{formatBytes(block.sizeBytes)}</dd></div>
                <div><dt>Stored</dt><dd>{formatOptionalBytes(block.storedSizeBytes)}</dd></div>
              </dl>
              <small>{block.storageState} · seen in {block.seenInVersionCount} versions</small>
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

function formatOptionalBytes(value: number | null): string {
  return value === null ? 'Unavailable' : formatBytes(value);
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value.toLocaleString()} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
