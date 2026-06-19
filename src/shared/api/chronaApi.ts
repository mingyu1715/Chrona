import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import type {
  BlockIngestProgress,
  BlockIngestSummary,
  RepositoryManifest,
} from '../types/chrona';

export interface ChronaApi {
  createRepository(repositoryPath: string): Promise<RepositoryManifest>;
  openRepository(repositoryPath: string): Promise<RepositoryManifest>;
  ingestBlocks(repositoryPath: string, sourcePath: string): Promise<BlockIngestSummary>;
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
  onBlockIngestProgress(handler) {
    return listen<BlockIngestProgress>('block-ingest-progress', (event) => {
      handler(event.payload);
    });
  },
};
