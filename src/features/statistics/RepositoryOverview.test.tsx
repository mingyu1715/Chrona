import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { RepositoryStatisticsOverview } from '../../shared/types/chrona';
import { RepositoryOverview } from './RepositoryOverview';

afterEach(() => cleanup());

function overviewFixture(): RepositoryStatisticsOverview {
  return {
    schemaVersion: 1,
    repositoryPath: '/tmp/repo',
    generatedAt: '2026-07-07T00:00:00Z',
    hasSnapshot: true,
    latestSnapshotId: 'latest',
    latestSnapshotName: 'Latest snapshot',
    latestSnapshotCreatedAt: '2026-07-07T00:00:00Z',
    latestFileCount: 1_284,
    latestLogicalBytes: 42.8 * 1024 * 1024 * 1024,
    latestUniqueBlockCount: 31_420,
    fileKindStats: [
      { kind: 'document', fileCount: 630, totalBytesLatest: 10_000 },
      { kind: 'image', fileCount: 420, totalBytesLatest: 20_000 },
    ],
  };
}

describe('RepositoryOverview', () => {
  test('renders latest files, bytes, unique blocks, and file kinds', () => {
    render(
      <RepositoryOverview
        overview={overviewFixture()}
        loading={false}
        error={null}
        onOpenDetails={vi.fn()}
      />,
    );

    expect(screen.getByText('1,284')).toBeInTheDocument();
    expect(screen.getByText('42.8 GiB')).toBeInTheDocument();
    expect(screen.getByText('31,420')).toBeInTheDocument();
    expect(screen.getByText('Document')).toBeInTheDocument();
    expect(screen.getByText('Image')).toBeInTheDocument();
  });

  test('opens detailed statistics', async () => {
    const onOpenDetails = vi.fn();
    const user = userEvent.setup();
    render(
      <RepositoryOverview
        overview={overviewFixture()}
        loading={false}
        error={null}
        onOpenDetails={onOpenDetails}
      />,
    );

    await user.click(screen.getByRole('button', { name: /detailed analysis/i }));

    expect(onOpenDetails).toHaveBeenCalledOnce();
  });

  test('renders loading, empty, and error states', () => {
    const { rerender } = render(
      <RepositoryOverview
        overview={null}
        loading
        error={null}
        onOpenDetails={vi.fn()}
      />,
    );
    expect(screen.getByText(/loading repository overview/i)).toBeInTheDocument();

    rerender(
      <RepositoryOverview
        overview={{ ...overviewFixture(), hasSnapshot: false }}
        loading={false}
        error={null}
        onOpenDetails={vi.fn()}
      />,
    );
    expect(screen.getByText(/no snapshots yet/i)).toBeInTheDocument();

    rerender(
      <RepositoryOverview
        overview={null}
        loading={false}
        error="overview failed"
        onOpenDetails={vi.fn()}
      />,
    );
    expect(screen.getByText('overview failed')).toBeInTheDocument();
  });
});
