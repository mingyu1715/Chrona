import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import type {
  BlockIngestProgress,
  BlockIngestSummary,
  RepositoryManifest,
  Snapshot,
  SnapshotIndexItem,
} from '../types/chrona';

export interface ChronaApi {
  createRepository(repositoryPath: string): Promise<RepositoryManifest>;
  openRepository(repositoryPath: string): Promise<RepositoryManifest>;
  ingestBlocks(repositoryPath: string, sourcePath: string): Promise<BlockIngestSummary>;
  createSnapshot(repositoryPath: string, sourcePath: string, name: string): Promise<Snapshot>;
  listSnapshots(repositoryPath: string): Promise<SnapshotIndexItem[]>;
  getSnapshot(repositoryPath: string, snapshotId: string): Promise<Snapshot>;
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
  onBlockIngestProgress(handler) {
    return listen<BlockIngestProgress>('block-ingest-progress', (event) => {
      handler(event.payload);
    });
  },
};
