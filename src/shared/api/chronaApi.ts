import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';

import type {
  BlockIngestProgress,
  BlockIngestSummary,
  RepositoryManifest,
  Snapshot,
  SnapshotComparison,
  SnapshotIndexItem,
} from '../types/chrona';

export interface ChronaApi {
  createRepository(repositoryPath: string): Promise<RepositoryManifest>;
  openRepository(repositoryPath: string): Promise<RepositoryManifest>;
  ingestBlocks(repositoryPath: string, sourcePath: string): Promise<BlockIngestSummary>;
  createSnapshot(repositoryPath: string, sourcePath: string, name: string): Promise<Snapshot>;
  listSnapshots(repositoryPath: string): Promise<SnapshotIndexItem[]>;
  getSnapshot(repositoryPath: string, snapshotId: string): Promise<Snapshot>;
  compareSnapshots(repositoryPath: string, baseSnapshotId: string, targetSnapshotId: string): Promise<SnapshotComparison>;
  selectRepositoryPath(): Promise<string | null>;
  selectSourceFilePath(): Promise<string | null>;
  selectSourceFolderPath(): Promise<string | null>;
  onBlockIngestProgress(
    handler: (event: BlockIngestProgress) => void,
  ): Promise<() => void>;
}

export const chronaApi: ChronaApi = {
  createRepository(repositoryPath) {
    return invoke<RepositoryManifest>('create_repository', { repositoryPath });
  },
  openRepository(repositoryPath) {
    return invoke<RepositoryManifest>('open_repository', { repositoryPath });
  },
  ingestBlocks(repositoryPath, sourcePath) {
    return invoke<BlockIngestSummary>('ingest_blocks', { repositoryPath, sourcePath });
  },
  createSnapshot(repositoryPath, sourcePath, name) {
    return invoke<Snapshot>('create_snapshot', { repositoryPath, sourcePath, name });
  },
  listSnapshots(repositoryPath) {
    return invoke<SnapshotIndexItem[]>('list_snapshots', { repositoryPath });
  },
  getSnapshot(repositoryPath, snapshotId) {
    return invoke<Snapshot>('get_snapshot', { repositoryPath, snapshotId });
  },
  compareSnapshots(repositoryPath, baseSnapshotId, targetSnapshotId) {
    return invoke<SnapshotComparison>('compare_snapshots', {
      repositoryPath,
      baseSnapshotId,
      targetSnapshotId,
    });
  },
  selectRepositoryPath() {
    return openSinglePath({
      directory: true,
      multiple: false,
      title: 'Choose Chrona Repository Folder',
    });
  },
  selectSourceFilePath() {
    return openSinglePath({
      multiple: false,
      title: 'Choose Source File',
    });
  },
  selectSourceFolderPath() {
    return openSinglePath({
      directory: true,
      multiple: false,
      title: 'Choose Source Folder',
    });
  },
  onBlockIngestProgress(handler) {
    return listen<BlockIngestProgress>('block-ingest-progress', (event) => {
      handler(event.payload);
    });
  },
};

async function openSinglePath(options: Parameters<typeof open>[0]): Promise<string | null> {
  const selected = await open(options);
  if (Array.isArray(selected)) {
    return selected[0] ?? null;
  }
  return selected;
}
