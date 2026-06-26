import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';

import type {
  AccessEvent,
  AccessHistorySummary,
  AccessNode,
  BlockIngestProgress,
  BlockIngestSummary,
  HomeSummary,
  RepositoryManifest,
  RestoreReport,
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
  restoreSnapshot(repositoryPath: string, snapshotId: string, targetPath: string): Promise<RestoreReport>;
  recordAccessEvent(repositoryPath: string, event: AccessEvent): Promise<AccessNode>;
  getHomeSummary(repositoryPath: string): Promise<HomeSummary>;
  pinAccessItem(repositoryPath: string, key: string): Promise<AccessNode>;
  unpinAccessItem(repositoryPath: string, key: string): Promise<AccessNode>;
  clearAccessHistory(repositoryPath: string): Promise<AccessHistorySummary>;
  selectRepositoryPath(): Promise<string | null>;
  selectSourceFilePath(): Promise<string | null>;
  selectSourceFolderPath(): Promise<string | null>;
  selectRestoreTargetPath(): Promise<string | null>;
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
  restoreSnapshot(repositoryPath, snapshotId, targetPath) {
    return invoke<RestoreReport>('restore_snapshot', {
      repositoryPath,
      snapshotId,
      targetPath,
    });
  },
  recordAccessEvent(repositoryPath, event) {
    return invoke<AccessNode>('record_access_event', { repositoryPath, event });
  },
  getHomeSummary(repositoryPath) {
    return invoke<HomeSummary>('get_home_summary', { repositoryPath });
  },
  pinAccessItem(repositoryPath, key) {
    return invoke<AccessNode>('pin_access_item', { repositoryPath, key });
  },
  unpinAccessItem(repositoryPath, key) {
    return invoke<AccessNode>('unpin_access_item', { repositoryPath, key });
  },
  clearAccessHistory(repositoryPath) {
    return invoke<AccessHistorySummary>('clear_access_history', { repositoryPath });
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
  selectRestoreTargetPath() {
    return openSinglePath({
      directory: true,
      multiple: false,
      title: 'Choose Empty Restore Target Folder',
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
