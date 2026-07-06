import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { RepositoryStatisticsReport } from '../../shared/types/chrona';
import { StatisticsDashboard } from './StatisticsDashboard';

afterEach(() => cleanup());

function reportFixture(): RepositoryStatisticsReport {
  return {
    schemaVersion: 1,
    repositoryPath: '/tmp/repo',
    generatedAt: '2026-07-07T00:00:00Z',
    overview: {
      schemaVersion: 1,
      repositoryPath: '/tmp/repo',
      generatedAt: '2026-07-07T00:00:00Z',
      hasSnapshot: true,
      latestSnapshotId: 'snapshot-2',
      latestSnapshotName: 'Latest',
      latestSnapshotCreatedAt: '2026-07-07T00:00:00Z',
      latestFileCount: 12,
      latestLogicalBytes: 24 * 1024 * 1024,
      latestUniqueBlockCount: 9,
      fileKindStats: [],
    },
    storage: {
      snapshotCount: 2,
      retainedLogicalBytes: 100 * 1024 * 1024,
      totalBlockReferences: 100,
      referencedUniqueBlockCount: 40,
      referencedUniqueRawBytes: 40 * 1024 * 1024,
      dedupSavedBytes: 60 * 1024 * 1024,
      referencedPhysicalBlockCount: 39,
      referencedPhysicalBytes: 24 * 1024 * 1024,
      allPhysicalBlockCount: 41,
      allPhysicalBytes: 26 * 1024 * 1024,
      unreferencedBlockCount: 2,
      unreferencedBytes: 2 * 1024 * 1024,
      missingReferencedBlockCount: 1,
      invalidReferencedBlockCount: 0,
      compressionComparedRawBytes: 40 * 1024 * 1024,
      compressionComparedPhysicalBytes: 24 * 1024 * 1024,
      compressionSavedBytes: 16 * 1024 * 1024,
      storageEfficiencyPercent: null,
    },
    encodings: {
      rawBlockCount: 10,
      rawPhysicalBytes: 10 * 1024 * 1024,
      zstdBlockCount: 24,
      zstdPhysicalBytes: 10 * 1024 * 1024,
      lz4BlockCount: 5,
      lz4PhysicalBytes: 4 * 1024 * 1024,
      unknownBlockCount: 0,
      unknownPhysicalBytes: 0,
    },
    snapshotTrend: [
      {
        snapshotId: 'snapshot-1',
        snapshotName: 'Initial',
        createdAt: '2026-07-01T00:00:00Z',
        fileCount: 8,
        logicalBytes: 20 * 1024 * 1024,
        totalBlockReferences: 30,
        uniqueBlockCount: 20,
        newBlockCount: 20,
        reusedBlockCount: 10,
        newLogicalBytes: 20 * 1024 * 1024,
        newStoredBytes: 12 * 1024 * 1024,
        compressionSavedBytes: 8 * 1024 * 1024,
      },
      {
        snapshotId: 'snapshot-2',
        snapshotName: 'Latest',
        createdAt: '2026-07-07T00:00:00Z',
        fileCount: 12,
        logicalBytes: 24 * 1024 * 1024,
        totalBlockReferences: 40,
        uniqueBlockCount: 25,
        newBlockCount: 5,
        reusedBlockCount: 35,
        newLogicalBytes: 5 * 1024 * 1024,
        newStoredBytes: 3 * 1024 * 1024,
        compressionSavedBytes: 2 * 1024 * 1024,
      },
    ],
    issues: [
      {
        kind: 'missingBlock',
        hash: 'a'.repeat(64),
        path: '/tmp/repo/blocks/aa/aa/a.blk',
        message: 'missing block file',
      },
    ],
  };
}

describe('StatisticsDashboard', () => {
  test('offers analysis before a report exists', async () => {
    const onAnalyze = vi.fn();
    const user = userEvent.setup();
    render(
      <StatisticsDashboard
        repositoryOpen
        report={null}
        progress={null}
        loading={false}
        error={null}
        onAnalyze={onAnalyze}
      />,
    );

    await user.click(screen.getByRole('button', { name: /analyze repository/i }));
    expect(onAnalyze).toHaveBeenCalledOnce();
  });

  test('renders detailed storage, trend, encoding, and issues', () => {
    render(
      <StatisticsDashboard
        repositoryOpen
        report={reportFixture()}
        progress={null}
        loading={false}
        error={null}
        onAnalyze={vi.fn()}
      />,
    );

    expect(screen.getByText('Dedup saved')).toBeInTheDocument();
    expect(screen.getByText('Compression saved')).toBeInTheDocument();
    expect(screen.getByText('Unreferenced blocks')).toBeInTheDocument();
    expect(screen.getByText('Missing referenced')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /snapshot trend/i })).toBeInTheDocument();
    expect(screen.getByText('Initial')).toBeInTheDocument();
    expect(screen.getByText('Latest')).toBeInTheDocument();
    expect(screen.getByText('Raw')).toBeInTheDocument();
    expect(screen.getByText('Zstd')).toBeInTheDocument();
    expect(screen.getByText('LZ4')).toBeInTheDocument();
    expect(screen.getByText('missing block file')).toBeInTheDocument();
  });

  test('renders progress and error states', () => {
    const { rerender } = render(
      <StatisticsDashboard
        repositoryOpen
        report={null}
        progress={{
          phase: 'blocks',
          processedSnapshots: 2,
          totalSnapshots: 2,
          processedBlocks: 4,
          totalBlocks: 10,
        }}
        loading
        error={null}
        onAnalyze={vi.fn()}
      />,
    );
    expect(screen.getByText(/blocks 4 \/ 10/i)).toBeInTheDocument();

    rerender(
      <StatisticsDashboard
        repositoryOpen
        report={null}
        progress={null}
        loading={false}
        error="analysis failed"
        onAnalyze={vi.fn()}
      />,
    );
    expect(screen.getByText('analysis failed')).toBeInTheDocument();
  });
});
