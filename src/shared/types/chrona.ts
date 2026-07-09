export type CompressionMode = 'off' | 'standard' | 'fast';

export interface BlockStrategy {
  type: 'fixed';
  sizeBytes: number;
  hash: 'sha256';
  encodingVersion: number;
  compressionMode: CompressionMode;
}

export interface RepositoryManifest {
  schemaVersion: number;
  appVersion: string;
  repositoryId: string;
  createdAt: string;
  blockStrategy: BlockStrategy;
}

export type RepositoryConnectionState = 'connected' | 'disconnected';

export interface RepositoryLibraryItem {
  repositoryId: string;
  displayName: string;
  path: string;
  addedAt: string;
  lastOpenedAt: string;
  connectionState: RepositoryConnectionState;
}

export interface RepositoryLibrary {
  activeRepositoryId: string | null;
  repositories: RepositoryLibraryItem[];
}

export interface OpenedRepository {
  registration: RepositoryLibraryItem;
  manifest: RepositoryManifest;
}

export interface BlockReference {
  index: number;
  offset: number;
  sizeBytes: number;
  hash: string;
  wasNew: boolean;
}

export interface FileIngestResult {
  relativePath: string;
  sizeBytes: number;
  modifiedAt: string;
  blocks: BlockReference[];
}

export interface BlockIngestSummary {
  fileCount: number;
  totalInputBytes: number;
  totalBlockReferences: number;
  newBlockCount: number;
  reusedBlockCount: number;
  newlyStoredBytes: number;
  newLogicalBytes: number;
  compressionSavedBytes: number;
  newRawBlockCount: number;
  newZstdBlockCount: number;
  newLz4BlockCount: number;
  files: FileIngestResult[];
}

export interface BlockIngestProgress {
  operationId: string;
  phase: string;
  currentFile: string | null;
  processedFiles: number;
  totalFiles: number;
  currentFileBytesProcessed: number;
  currentFileSizeBytes: number;
  totalBytesProcessed: number;
  totalBytes: number;
}


export interface SnapshotSummary {
  fileCount: number;
  totalOriginalBytes: number;
  totalBlockReferences: number;
  newBlockCount: number;
  reusedBlockCount: number;
  newStoredBytes: number;
  newLogicalBytes: number;
  compressionSavedBytes: number;
  newRawBlockCount: number;
  newZstdBlockCount: number;
  newLz4BlockCount: number;
}

export interface SnapshotFile {
  relativePath: string;
  sizeBytes: number;
  modifiedAt: string;
  blocks: BlockReference[];
}

export interface Snapshot {
  schemaVersion: number;
  id: string;
  name: string;
  createdAt: string;
  sourceRoot: string;
  summary: SnapshotSummary;
  files: SnapshotFile[];
}

export interface SnapshotIndexItem {
  id: string;
  name: string;
  createdAt: string;
  sourceRoot: string;
  fileCount: number;
  totalOriginalBytes: number;
  newStoredBytes: number;
}

export type SnapshotChangeType = 'added' | 'deleted' | 'modified' | 'unchanged';

export interface SnapshotFileDigest {
  sizeBytes: number;
  modifiedAt: string;
  blockHashes: string[];
}

export interface SnapshotBlockDiffSummary {
  beforeBlockReferences: number;
  afterBlockReferences: number;
  addedBlockReferences: number;
  removedBlockReferences: number;
  sharedBlockReferences: number;
}

export interface SnapshotFileDiff {
  relativePath: string;
  changeType: SnapshotChangeType;
  before: SnapshotFileDigest | null;
  after: SnapshotFileDigest | null;
  blocks: SnapshotBlockDiffSummary;
}

export interface SnapshotComparisonSummary {
  addedFileCount: number;
  deletedFileCount: number;
  modifiedFileCount: number;
  unchangedFileCount: number;
  totalBeforeBytes: number;
  totalAfterBytes: number;
  addedBytes: number;
  deletedBytes: number;
  modifiedBeforeBytes: number;
  modifiedAfterBytes: number;
  addedBlockReferences: number;
  removedBlockReferences: number;
  sharedBlockReferences: number;
}

export interface SnapshotComparison {
  schemaVersion: number;
  baseSnapshotId: string;
  targetSnapshotId: string;
  summary: SnapshotComparisonSummary;
  files: SnapshotFileDiff[];
}


export interface RestoreFileResult {
  relativePath: string;
  sizeBytes: number;
  blockCount: number;
}

export interface RestoreReport {
  schemaVersion: number;
  snapshotId: string;
  targetPath: string;
  restoredFileCount: number;
  restoredBytes: number;
  restoredBlockCount: number;
  files: RestoreFileResult[];
}

export type IntegrityStatus = 'healthy' | 'warning' | 'failed';

export type IntegrityIssueSeverity = 'warning' | 'error';

export interface IntegrityIssue {
  severity: IntegrityIssueSeverity;
  code: string;
  message: string;
  snapshotId: string | null;
  relativePath: string | null;
  blockHash: string | null;
}

export interface IntegrityReport {
  schemaVersion: number;
  repositoryPath: string;
  checkedAt: string;
  status: IntegrityStatus;
  snapshotCount: number;
  fileCount: number;
  blockReferenceCount: number;
  uniqueBlockCount: number;
  missingBlockCount: number;
  corruptBlockCount: number;
  issues: IntegrityIssue[];
}

export type FileKind =
  | 'document'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'code'
  | 'text'
  | 'data'
  | 'binary'
  | 'folderless'
  | 'unknown';

export type SnapshotPresenceState = 'presentInLatest' | 'deletedInLatest';
export type SourceExistenceState = 'exists' | 'missing' | 'sourceRootMissing' | 'unchecked';

export interface FileKindStat {
  kind: FileKind;
  fileCount: number;
  totalBytesLatest: number;
}

export interface InventoryFileEntry {
  relativePath: string;
  fileName: string;
  extension: string | null;
  kind: FileKind;
  snapshotState: SnapshotPresenceState;
  sourceState: SourceExistenceState;
  latestSizeBytes: number | null;
  latestModifiedAt: string | null;
  firstSeenSnapshotId: string;
  firstSeenAt: string;
  lastSeenSnapshotId: string;
  lastSeenAt: string;
  seenInSnapshotCount: number;
  blockReferenceCountLatest: number;
}

export interface RepositoryInventoryReport {
  schemaVersion: number;
  repositoryPath: string;
  generatedAt: string;
  snapshotCount: number;
  knownFileCount: number;
  latestFileCount: number;
  deletedInLatestCount: number;
  sourceExistsCount: number;
  sourceMissingCount: number;
  sourceRootMissingCount: number;
  totalOriginalBytesLatest: number;
  totalBlockReferencesLatest: number;
  uniqueBlockCountLatest: number;
  kindStats: FileKindStat[];
  files: InventoryFileEntry[];
}

export interface RepositoryStatisticsOverview {
  schemaVersion: number;
  repositoryPath: string;
  generatedAt: string;
  hasSnapshot: boolean;
  latestSnapshotId: string | null;
  latestSnapshotName: string | null;
  latestSnapshotCreatedAt: string | null;
  latestFileCount: number;
  latestLogicalBytes: number;
  latestUniqueBlockCount: number;
  fileKindStats: FileKindStat[];
}

export interface RepositoryStatisticsReport {
  schemaVersion: number;
  repositoryPath: string;
  generatedAt: string;
  overview: RepositoryStatisticsOverview;
  storage: RepositoryStorageSummary;
  encodings: EncodingStatistics;
  snapshotTrend: SnapshotStatisticsPoint[];
  issues: StatisticsIssue[];
}

export interface RepositoryStorageSummary {
  snapshotCount: number;
  retainedLogicalBytes: number;
  totalBlockReferences: number;
  referencedUniqueBlockCount: number;
  referencedUniqueRawBytes: number;
  dedupSavedBytes: number;
  referencedPhysicalBlockCount: number;
  referencedPhysicalBytes: number;
  allPhysicalBlockCount: number;
  allPhysicalBytes: number;
  unreferencedBlockCount: number;
  unreferencedBytes: number;
  missingReferencedBlockCount: number;
  invalidReferencedBlockCount: number;
  compressionComparedRawBytes: number;
  compressionComparedPhysicalBytes: number;
  compressionSavedBytes: number;
  storageEfficiencyPercent: number | null;
}

export interface SnapshotStatisticsPoint {
  snapshotId: string;
  snapshotName: string;
  createdAt: string;
  fileCount: number;
  logicalBytes: number;
  totalBlockReferences: number;
  uniqueBlockCount: number;
  newBlockCount: number;
  reusedBlockCount: number;
  newLogicalBytes: number;
  newStoredBytes: number;
  compressionSavedBytes: number;
}

export interface EncodingStatistics {
  rawBlockCount: number;
  rawPhysicalBytes: number;
  zstdBlockCount: number;
  zstdPhysicalBytes: number;
  lz4BlockCount: number;
  lz4PhysicalBytes: number;
  unknownBlockCount: number;
  unknownPhysicalBytes: number;
}

export type StatisticsIssueKind =
  | 'missingBlock'
  | 'unreadableBlock'
  | 'invalidHeader'
  | 'invalidBlockFileName'
  | 'conflictingRawSize';

export interface StatisticsIssue {
  kind: StatisticsIssueKind;
  hash: string | null;
  path: string | null;
  message: string;
}

export interface RepositoryStatisticsProgress {
  phase: 'snapshots' | 'blocks' | 'completed';
  processedSnapshots: number;
  totalSnapshots: number;
  processedBlocks: number;
  totalBlocks: number;
}

export type FileVersionState = 'added' | 'modified' | 'unchanged' | 'deleted';
export type BlockStorageEncoding = 'raw' | 'zstd' | 'lz4' | 'unknown';
export type BlockStorageState = 'available' | 'missing' | 'unreadable' | 'invalidHeader';

export interface FileInspectionReport {
  schemaVersion: number;
  repositoryPath: string;
  relativePath: string;
  fileName: string;
  versionCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  latestState: FileVersionState;
  currentSourcePath: string | null;
  versions: FileInspectionVersion[];
}

export interface FileInspectionVersion {
  snapshotId: string;
  snapshotName: string;
  snapshotCreatedAt: string;
  state: FileVersionState;
  sizeBytes: number | null;
  modifiedAt: string | null;
  totalBlockReferences: number;
  uniqueBlockCount: number;
  blocks: FileBlockInspection[];
}

export interface FileBlockInspection {
  index: number;
  offset: number;
  sizeBytes: number;
  hash: string;
  wasNew: boolean;
  encoding: BlockStorageEncoding;
  storageState: BlockStorageState;
  storedSizeBytes: number | null;
  compressionSavedBytes: number | null;
  seenInVersionCount: number;
  issue: string | null;
}

export type AccessNodeKind = 'repository' | 'source' | 'folder' | 'file' | 'snapshot' | 'comparePair';

export interface AccessEvent {
  key: string;
  kind: AccessNodeKind;
  label: string;
  path: string | null;
  repositoryId: string | null;
  snapshotId: string | null;
  baseSnapshotId: string | null;
  targetSnapshotId: string | null;
  action: string;
  accessedAt: string;
}

export interface AccessNode {
  key: string;
  kind: AccessNodeKind;
  label: string;
  path: string | null;
  repositoryId: string | null;
  snapshotId: string | null;
  baseSnapshotId: string | null;
  targetSnapshotId: string | null;
  accessCount: number;
  lastAccessedAt: string;
  lastAction: string;
  pinned: boolean;
}

export interface HomeSummary {
  continueWorking: AccessNode | null;
  pinned: AccessNode[];
  recentRepositories: AccessNode[];
  recentSources: AccessNode[];
  recentFiles: AccessNode[];
  recentSnapshots: AccessNode[];
  recentComparePairs: AccessNode[];
}

export interface AccessHistorySummary {
  schemaVersion: number;
  removedCount: number;
  remainingCount: number;
}
