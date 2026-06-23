export interface BlockStrategy {
  type: 'fixed';
  sizeBytes: number;
  hash: 'sha256';
}

export interface RepositoryManifest {
  schemaVersion: number;
  appVersion: string;
  repositoryId: string;
  createdAt: string;
  blockStrategy: BlockStrategy;
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
