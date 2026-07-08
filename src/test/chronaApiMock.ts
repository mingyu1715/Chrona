import { vi } from 'vitest';

import type { ChronaApi } from '../shared/api/chronaApi';
import type {
  AccessEvent,
  AccessHistorySummary,
  AccessNode,
  BlockIngestProgress,
  BlockIngestSummary,
  CompressionMode,
  FileInspectionReport,
  HomeSummary,
  IntegrityReport,
  OpenedRepository,
  RepositoryConnectionState,
  RepositoryInventoryReport,
  RepositoryLibrary,
  RepositoryLibraryItem,
  RepositoryManifest,
  RepositoryStatisticsOverview,
  RepositoryStatisticsProgress,
  RepositoryStatisticsReport,
  RestoreReport,
  Snapshot,
  SnapshotComparison,
  SnapshotIndexItem,
} from '../shared/types/chrona';

export function accessNode(overrides: Partial<AccessNode> = {}): AccessNode {
  return {
    key: 'source:/tmp/source',
    kind: 'source',
    label: 'source',
    path: '/tmp/source',
    repositoryId: 'repo-id',
    snapshotId: null,
    baseSnapshotId: null,
    targetSnapshotId: null,
    accessCount: 2,
    lastAccessedAt: '2026-06-26T00:00:00Z',
    lastAction: 'ingest_completed',
    pinned: false,
    ...overrides,
  };
}

export function statisticsOverview(
  overrides: Partial<RepositoryStatisticsOverview> = {},
): RepositoryStatisticsOverview {
  return {
    schemaVersion: 1,
    repositoryPath: '/tmp/chrona-repo',
    generatedAt: '2026-07-07T00:00:00Z',
    hasSnapshot: false,
    latestSnapshotId: null,
    latestSnapshotName: null,
    latestSnapshotCreatedAt: null,
    latestFileCount: 0,
    latestLogicalBytes: 0,
    latestUniqueBlockCount: 0,
    fileKindStats: [],
    ...overrides,
  };
}

export function statisticsReport(): RepositoryStatisticsReport {
  return {
    schemaVersion: 1,
    repositoryPath: '/tmp/chrona-repo',
    generatedAt: '2026-07-07T00:00:00Z',
    overview: statisticsOverview({ hasSnapshot: true }),
    storage: {
      snapshotCount: 2,
      retainedLogicalBytes: 100,
      totalBlockReferences: 10,
      referencedUniqueBlockCount: 4,
      referencedUniqueRawBytes: 40,
      dedupSavedBytes: 60,
      referencedPhysicalBlockCount: 4,
      referencedPhysicalBytes: 24,
      allPhysicalBlockCount: 5,
      allPhysicalBytes: 26,
      unreferencedBlockCount: 1,
      unreferencedBytes: 2,
      missingReferencedBlockCount: 0,
      invalidReferencedBlockCount: 0,
      compressionComparedRawBytes: 40,
      compressionComparedPhysicalBytes: 24,
      compressionSavedBytes: 16,
      storageEfficiencyPercent: 74,
    },
    encodings: {
      rawBlockCount: 1,
      rawPhysicalBytes: 6,
      zstdBlockCount: 2,
      zstdPhysicalBytes: 12,
      lz4BlockCount: 1,
      lz4PhysicalBytes: 6,
      unknownBlockCount: 0,
      unknownPhysicalBytes: 0,
    },
    snapshotTrend: [],
    issues: [],
  };
}

function repositoryLibraryItem(
  overrides: Partial<RepositoryLibraryItem> = {},
): RepositoryLibraryItem {
  return {
    repositoryId: 'repo-id',
    displayName: 'Chrona Repository',
    path: '/tmp/chrona-repo',
    addedAt: '2026-06-19T00:00:00Z',
    lastOpenedAt: '2026-06-19T00:00:00Z',
    connectionState: 'connected',
    ...overrides,
  };
}

const manifest: RepositoryManifest = {
  schemaVersion: 1,
  appVersion: '0.1.0',
  repositoryId: 'repo-id',
  createdAt: '2026-06-19T00:00:00Z',
  blockStrategy: {
    type: 'fixed',
    sizeBytes: 1048576,
    hash: 'sha256',
    encodingVersion: 2,
    compressionMode: 'standard',
  },
};

const registration = repositoryLibraryItem();

const library: RepositoryLibrary = {
  activeRepositoryId: registration.repositoryId,
  repositories: [registration],
};

const openedRepository: OpenedRepository = {
  registration,
  manifest,
};

export function createChronaApiMock() {
  let progressHandler: ((event: BlockIngestProgress) => void) | undefined;
  let statisticsProgressHandler:
    ((event: RepositoryStatisticsProgress) => void) | undefined;

  const api: ChronaApi = {
    createRepository: vi.fn(async () => manifest),
    openRepository: vi.fn(async () => manifest),
    getRepositoryLibrary: vi.fn(async () => library),
    createManagedRepository: vi.fn(async () => openedRepository),
    createRepositoryAt: vi.fn(async () => openedRepository),
    registerExistingRepository: vi.fn(async () => openedRepository),
    activateRegisteredRepository: vi.fn(async () => openedRepository),
    removeRepositoryRegistration: vi.fn(async () => library),
    renameRepositoryRegistration: vi.fn(async (_repositoryId, displayName) => ({
      ...library,
      repositories: library.repositories.map((repository) => ({
        ...repository,
        displayName: repository.repositoryId === _repositoryId
          ? displayName.trim()
          : repository.displayName,
      })),
    })),
    relinkRegisteredRepository: vi.fn(async () => openedRepository),
    setRepositoryCompressionMode: vi.fn(async (_repositoryPath, compressionMode) => ({
      ...manifest,
      blockStrategy: {
        ...manifest.blockStrategy,
        compressionMode,
      },
    })),
    ingestBlocks: vi.fn(async () => ({
      fileCount: 2,
      totalInputBytes: 18,
      totalBlockReferences: 2,
      newBlockCount: 1,
      reusedBlockCount: 1,
      newlyStoredBytes: 9,
      newLogicalBytes: 9,
      compressionSavedBytes: 0,
      newRawBlockCount: 1,
      newZstdBlockCount: 0,
      newLz4BlockCount: 0,
      files: [],
    })),
    createSnapshot: vi.fn(),
    listSnapshots: vi.fn(async () => []),
    getSnapshot: vi.fn(),
    compareSnapshots: vi.fn(async () => ({
      schemaVersion: 1,
      baseSnapshotId: 'base',
      targetSnapshotId: 'target',
      summary: {
        addedFileCount: 0,
        deletedFileCount: 0,
        modifiedFileCount: 0,
        unchangedFileCount: 0,
        totalBeforeBytes: 0,
        totalAfterBytes: 0,
        addedBytes: 0,
        deletedBytes: 0,
        modifiedBeforeBytes: 0,
        modifiedAfterBytes: 0,
        addedBlockReferences: 0,
        removedBlockReferences: 0,
        sharedBlockReferences: 0,
      },
      files: [],
    })),
    restoreSnapshot: vi.fn(),
    verifyRepository: vi.fn(async () => ({
      schemaVersion: 1,
      repositoryPath: '/tmp/chrona-repo',
      checkedAt: '2026-06-26T00:00:00Z',
      status: 'healthy' as const,
      snapshotCount: 1,
      fileCount: 2,
      blockReferenceCount: 2,
      uniqueBlockCount: 1,
      missingBlockCount: 0,
      corruptBlockCount: 0,
      issues: [],
    })),
    getRepositoryInventory: vi.fn(async () => ({
      schemaVersion: 1,
      repositoryPath: '/tmp/chrona-repo',
      generatedAt: '2026-06-27T00:00:00Z',
      snapshotCount: 2,
      knownFileCount: 3,
      latestFileCount: 2,
      deletedInLatestCount: 1,
      sourceExistsCount: 1,
      sourceMissingCount: 1,
      sourceRootMissingCount: 0,
      totalOriginalBytesLatest: 12,
      totalBlockReferencesLatest: 2,
      uniqueBlockCountLatest: 2,
      kindStats: [
        { kind: 'document' as const, fileCount: 1, totalBytesLatest: 5 },
        { kind: 'image' as const, fileCount: 1, totalBytesLatest: 7 },
      ],
      files: [
        {
          relativePath: 'notes.md',
          fileName: 'notes.md',
          extension: 'md',
          kind: 'document' as const,
          snapshotState: 'presentInLatest' as const,
          sourceState: 'exists' as const,
          latestSizeBytes: 5,
          latestModifiedAt: '2026-06-27T00:00:00Z',
          firstSeenSnapshotId: 'first',
          firstSeenAt: '2026-06-26T00:00:00Z',
          lastSeenSnapshotId: 'latest',
          lastSeenAt: '2026-06-27T00:00:00Z',
          seenInSnapshotCount: 2,
          blockReferenceCountLatest: 1,
        },
        {
          relativePath: 'old.txt',
          fileName: 'old.txt',
          extension: 'txt',
          kind: 'text' as const,
          snapshotState: 'deletedInLatest' as const,
          sourceState: 'missing' as const,
          latestSizeBytes: null,
          latestModifiedAt: null,
          firstSeenSnapshotId: 'first',
          firstSeenAt: '2026-06-26T00:00:00Z',
          lastSeenSnapshotId: 'first',
          lastSeenAt: '2026-06-26T00:00:00Z',
          seenInSnapshotCount: 1,
          blockReferenceCountLatest: 0,
        },
      ],
    })),
    inspectRepositoryFile: vi.fn(async () => ({
      schemaVersion: 1,
      repositoryPath: '/tmp/chrona-repo',
      relativePath: 'notes.md',
      fileName: 'notes.md',
      versionCount: 1,
      firstSeenAt: '2026-06-27T00:00:00Z',
      lastSeenAt: '2026-06-27T00:00:00Z',
      latestState: 'added' as const,
      versions: [
        {
          snapshotId: 'latest',
          snapshotName: 'Latest',
          snapshotCreatedAt: '2026-06-27T00:00:00Z',
          state: 'added' as const,
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
              encoding: 'zstd' as const,
              storageState: 'available' as const,
              storedSizeBytes: 4,
              compressionSavedBytes: 1,
              seenInVersionCount: 1,
              issue: null,
            },
          ],
        },
      ],
    })),
    getRepositoryStatisticsOverview: vi.fn(async () => statisticsOverview()),
    analyzeRepositoryStatistics: vi.fn(async () => statisticsReport()),
    recordAccessEvent: vi.fn(async (_repositoryPath: string, _event: AccessEvent) =>
      accessNode(),
    ),
    getHomeSummary: vi.fn(async () => ({
      continueWorking: null,
      pinned: [],
      recentRepositories: [],
      recentSources: [],
      recentFiles: [],
      recentSnapshots: [],
      recentComparePairs: [],
    })),
    pinAccessItem: vi.fn(async () => accessNode()),
    unpinAccessItem: vi.fn(async () => accessNode()),
    clearAccessHistory: vi.fn(async () => ({
      schemaVersion: 1,
      removedCount: 0,
      remainingCount: 0,
    })),
    selectRepositoryPath: vi.fn(async () => '/picked/chrona-repo'),
    selectRepositoryParentPath: vi.fn(async () => '/picked/chrona-parent'),
    selectExistingRepositoryPath: vi.fn(async () => '/picked/chrona-existing'),
    selectSourceFilePath: vi.fn(async () => '/picked/source.txt'),
    selectSourceFolderPath: vi.fn(async () => '/picked/source-folder'),
    selectRestoreTargetPath: vi.fn(async () => null),
    onBlockIngestProgress: vi.fn(async (handler) => {
      progressHandler = handler;
      return () => undefined;
    }),
    onRepositoryStatisticsProgress: vi.fn(async (handler) => {
      statisticsProgressHandler = handler;
      return () => undefined;
    }),
  };

  return {
    api,
    manifest,
    registration,
    library,
    openedRepository,
    emitProgress: (event: BlockIngestProgress) => progressHandler?.(event),
    emitStatisticsProgress: (event: RepositoryStatisticsProgress) =>
      statisticsProgressHandler?.(event),
  };
}
