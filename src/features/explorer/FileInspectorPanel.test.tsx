import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { FileInspectionReport } from '../../shared/types/chrona';
import { FileInspectorPanel } from './FileInspectorPanel';

afterEach(() => cleanup());

function inspectionReport(): FileInspectionReport {
  return {
    schemaVersion: 1,
    repositoryPath: '/tmp/repo',
    relativePath: 'notes.txt',
    fileName: 'notes.txt',
    versionCount: 2,
    firstSeenAt: '2026-06-27T00:00:00Z',
    lastSeenAt: '2026-06-30T00:00:00Z',
    latestState: 'modified',
    currentSourcePath: null,
    versions: [
      {
        snapshotId: 'snapshot-latest',
        snapshotName: 'Latest',
        snapshotCreatedAt: '2026-06-30T00:00:00Z',
        state: 'modified',
        sizeBytes: 9,
        modifiedAt: '2026-06-30T00:00:00Z',
        totalBlockReferences: 2,
        uniqueBlockCount: 2,
        blocks: [
          {
            index: 0,
            offset: 0,
            sizeBytes: 5,
            hash: 'a'.repeat(64),
            wasNew: false,
            encoding: 'zstd',
            storageState: 'available',
            storedSizeBytes: 3,
            compressionSavedBytes: 2,
            seenInVersionCount: 2,
            issue: null,
          },
          {
            index: 1,
            offset: 5,
            sizeBytes: 4,
            hash: 'b'.repeat(64),
            wasNew: true,
            encoding: 'raw',
            storageState: 'available',
            storedSizeBytes: 4,
            compressionSavedBytes: 0,
            seenInVersionCount: 1,
            issue: null,
          },
        ],
      },
      {
        snapshotId: 'snapshot-deleted',
        snapshotName: 'Deleted',
        snapshotCreatedAt: '2026-06-29T00:00:00Z',
        state: 'deleted',
        sizeBytes: null,
        modifiedAt: null,
        totalBlockReferences: 0,
        uniqueBlockCount: 0,
        blocks: [],
      },
      {
        snapshotId: 'snapshot-old',
        snapshotName: 'Initial',
        snapshotCreatedAt: '2026-06-27T00:00:00Z',
        state: 'added',
        sizeBytes: 5,
        modifiedAt: '2026-06-27T00:00:00Z',
        totalBlockReferences: 1,
        uniqueBlockCount: 1,
        blocks: [
          {
            index: 0,
            offset: 0,
            sizeBytes: 5,
            hash: 'a'.repeat(64),
            wasNew: true,
            encoding: 'zstd',
            storageState: 'available',
            storedSizeBytes: 3,
            compressionSavedBytes: 2,
            seenInVersionCount: 2,
            issue: null,
          },
        ],
      },
    ],
  };
}

function inspectionReportWithCurrentSourcePath(path: string | null): FileInspectionReport {
  return {
    ...inspectionReport(),
    currentSourcePath: path,
  } as FileInspectionReport;
}

describe('FileInspectorPanel', () => {
  test('prompts for a file before selection', () => {
    render(
      <FileInspectorPanel
        selectedPath={null}
        report={null}
        loading={false}
        error={null}
      />,
    );

    expect(screen.getByText(/select a file to inspect/i)).toBeInTheDocument();
  });

  test('renders file summary, ordered blocks, and history', () => {
    render(
      <FileInspectorPanel
        selectedPath="notes.txt"
        report={inspectionReport()}
        loading={false}
        error={null}
      />,
    );

    expect(screen.getByRole('heading', { name: 'notes.txt' })).toBeInTheDocument();
    expect(screen.getByText('zstd')).toBeInTheDocument();
    expect(screen.getByText(/seen in 2 versions/i)).toBeInTheDocument();
    expect(screen.getByText('deleted')).toBeInTheDocument();
    expect(screen.getByText(/block 1/i)).toBeInTheDocument();
  });

  test('reveals the original file when a current source path exists', async () => {
    const user = userEvent.setup();
    const desktopActions = {
      revealPath: vi.fn(async () => undefined),
      openPath: vi.fn(async () => undefined),
      copyText: vi.fn(async () => undefined),
    };
    render(
      <FileInspectorPanel
        selectedPath="notes.txt"
        report={inspectionReportWithCurrentSourcePath('/tmp/source/notes.txt')}
        loading={false}
        error={null}
        desktopActions={desktopActions}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Reveal original' }));

    expect(desktopActions.revealPath).toHaveBeenCalledWith('/tmp/source/notes.txt');
  });

  test('shows a non-actionable original missing state when no current source path exists', () => {
    render(
      <FileInspectorPanel
        selectedPath="notes.txt"
        report={inspectionReportWithCurrentSourcePath(null)}
        loading={false}
        error={null}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Reveal original' })).not.toBeInTheDocument();
    expect(screen.getByText(/original file unavailable/i)).toBeInTheDocument();
  });

  test('switches the block sequence without another backend request', async () => {
    const user = userEvent.setup();
    render(
      <FileInspectorPanel
        selectedPath="notes.txt"
        report={inspectionReport()}
        loading={false}
        error={null}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText(/snapshot version/i),
      'snapshot-old',
    );

    expect(screen.getByText(/block 0/i)).toBeInTheDocument();
    expect(screen.queryByText(/block 1/i)).not.toBeInTheDocument();
    expect(screen.getByText('added')).toBeInTheDocument();
  });

  test('renders loading and error states for the selected path', () => {
    const { rerender } = render(
      <FileInspectorPanel
        selectedPath="notes.txt"
        report={null}
        loading
        error={null}
      />,
    );
    expect(screen.getByText(/loading file history/i)).toBeInTheDocument();

    rerender(
      <FileInspectorPanel
        selectedPath="notes.txt"
        report={null}
        loading={false}
        error="RepositoryFileNotFound"
      />,
    );
    expect(screen.getByText('RepositoryFileNotFound')).toBeInTheDocument();
  });
});
