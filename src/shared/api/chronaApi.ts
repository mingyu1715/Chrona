import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';

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
  OriginalLocationRestoreReport,
  RepositoryInventoryReport,
  RepositoryManifest,
  RepositoryLibrary,
  RepositoryStatisticsOverview,
  RepositoryStatisticsProgress,
  RepositoryStatisticsReport,
  RestoreReport,
  Snapshot,
  SnapshotComparison,
  SnapshotIndexItem,
  BackupSource,
  SourceIndex,
} from '../types/chrona';

export interface ChronaApi {
  createRepository(repositoryPath: string): Promise<RepositoryManifest>;
  openRepository(repositoryPath: string): Promise<RepositoryManifest>;
  getRepositoryLibrary(): Promise<RepositoryLibrary>;
  createManagedRepository(displayName: string): Promise<OpenedRepository>;
  createRepositoryAt(displayName: string, parentPath: string): Promise<OpenedRepository>;
  registerExistingRepository(repositoryPath: string): Promise<OpenedRepository>;
  activateRegisteredRepository(repositoryId: string): Promise<OpenedRepository>;
  removeRepositoryRegistration(repositoryId: string): Promise<RepositoryLibrary>;
  renameRepositoryRegistration(
    repositoryId: string,
    displayName: string,
  ): Promise<RepositoryLibrary>;
  relinkRegisteredRepository(
    repositoryId: string,
    repositoryPath: string,
  ): Promise<OpenedRepository>;
  setRepositoryCompressionMode(
    repositoryPath: string,
    compressionMode: CompressionMode,
  ): Promise<RepositoryManifest>;
  ingestBlocks(repositoryPath: string, sourcePath: string): Promise<BlockIngestSummary>;
  createSnapshot(repositoryPath: string, sourcePath: string, name: string): Promise<Snapshot>;
  listSnapshots(repositoryPath: string): Promise<SnapshotIndexItem[]>;
  deleteSnapshot(repositoryPath: string, snapshotId: string): Promise<SnapshotIndexItem[]>;
  getSnapshot(repositoryPath: string, snapshotId: string): Promise<Snapshot>;
  compareSnapshots(repositoryPath: string, baseSnapshotId: string, targetSnapshotId: string): Promise<SnapshotComparison>;
  listSources(repositoryPath: string): Promise<SourceIndex>;
  registerSource(repositoryPath: string, sourcePath: string): Promise<BackupSource>;
  renameSource(
    repositoryPath: string,
    sourceId: string,
    displayName: string,
  ): Promise<SourceIndex>;
  removeSource(repositoryPath: string, sourceId: string): Promise<SourceIndex>;
  restoreSnapshot(repositoryPath: string, snapshotId: string, targetPath: string): Promise<RestoreReport>;
  restoreSnapshotToSource(
    repositoryPath: string,
    sourceId: string,
    snapshotId: string,
  ): Promise<OriginalLocationRestoreReport>;
  verifyRepository(repositoryPath: string): Promise<IntegrityReport>;
  getRepositoryInventory(repositoryPath: string): Promise<RepositoryInventoryReport>;
  inspectRepositoryFile(
    repositoryPath: string,
    relativePath: string,
    sourceId?: string | null,
  ): Promise<FileInspectionReport>;
  getRepositoryStatisticsOverview(
    repositoryPath: string,
  ): Promise<RepositoryStatisticsOverview>;
  analyzeRepositoryStatistics(
    repositoryPath: string,
  ): Promise<RepositoryStatisticsReport>;
  recordAccessEvent(repositoryPath: string, event: AccessEvent): Promise<AccessNode>;
  getHomeSummary(repositoryPath: string): Promise<HomeSummary>;
  pinAccessItem(repositoryPath: string, key: string): Promise<AccessNode>;
  unpinAccessItem(repositoryPath: string, key: string): Promise<AccessNode>;
  clearAccessHistory(repositoryPath: string): Promise<AccessHistorySummary>;
  selectRepositoryPath(): Promise<string | null>;
  selectRepositoryParentPath(): Promise<string | null>;
  selectExistingRepositoryPath(): Promise<string | null>;
  selectSourceFilePath(): Promise<string | null>;
  selectSourceFolderPath(): Promise<string | null>;
  selectRestoreTargetPath(): Promise<string | null>;
  onBlockIngestProgress(
    handler: (event: BlockIngestProgress) => void,
  ): Promise<() => void>;
  onRepositoryStatisticsProgress(
    handler: (event: RepositoryStatisticsProgress) => void,
  ): Promise<() => void>;
}

export const chronaApi: ChronaApi = {
  createRepository(repositoryPath) {
    return invoke<RepositoryManifest>('create_repository', { repositoryPath });
  },
  openRepository(repositoryPath) {
    return invoke<RepositoryManifest>('open_repository', { repositoryPath });
  },
  getRepositoryLibrary() {
    return invoke<RepositoryLibrary>('get_repository_library');
  },
  createManagedRepository(displayName) {
    return invoke<OpenedRepository>('create_managed_repository', { displayName });
  },
  createRepositoryAt(displayName, parentPath) {
    return invoke<OpenedRepository>('create_repository_at', { displayName, parentPath });
  },
  registerExistingRepository(repositoryPath) {
    return invoke<OpenedRepository>('register_existing_repository', {
      path: repositoryPath,
    });
  },
  activateRegisteredRepository(repositoryId) {
    return invoke<OpenedRepository>('activate_registered_repository', { repositoryId });
  },
  removeRepositoryRegistration(repositoryId) {
    return invoke<RepositoryLibrary>('remove_repository_registration', { repositoryId });
  },
  renameRepositoryRegistration(repositoryId, displayName) {
    return invoke<RepositoryLibrary>('rename_repository_registration', {
      repositoryId,
      displayName,
    });
  },
  relinkRegisteredRepository(repositoryId, repositoryPath) {
    return invoke<OpenedRepository>('relink_registered_repository', {
      repositoryId,
      path: repositoryPath,
    });
  },
  setRepositoryCompressionMode(repositoryPath, compressionMode) {
    return invoke<RepositoryManifest>('set_repository_compression_mode', {
      repositoryPath,
      compressionMode,
    });
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
  deleteSnapshot(repositoryPath, snapshotId) {
    return invoke<SnapshotIndexItem[]>('delete_snapshot', { repositoryPath, snapshotId });
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
  listSources(repositoryPath) {
    return invoke<SourceIndex>('list_sources', { repositoryPath });
  },
  registerSource(repositoryPath, sourcePath) {
    return invoke<BackupSource>('register_source', { repositoryPath, sourcePath });
  },
  renameSource(repositoryPath, sourceId, displayName) {
    return invoke<SourceIndex>('rename_source', {
      repositoryPath,
      sourceId,
      displayName,
    });
  },
  removeSource(repositoryPath, sourceId) {
    return invoke<SourceIndex>('remove_source', { repositoryPath, sourceId });
  },
  restoreSnapshot(repositoryPath, snapshotId, targetPath) {
    return invoke<RestoreReport>('restore_snapshot', {
      repositoryPath,
      snapshotId,
      targetPath,
    });
  },
  restoreSnapshotToSource(repositoryPath, sourceId, snapshotId) {
    return invoke<OriginalLocationRestoreReport>('restore_snapshot_to_source', {
      repositoryPath,
      sourceId,
      snapshotId,
    });
  },
  verifyRepository(repositoryPath) {
    return invoke<IntegrityReport>('verify_repository', { repositoryPath });
  },
  getRepositoryInventory(repositoryPath) {
    return invoke<RepositoryInventoryReport>('get_repository_inventory', { repositoryPath });
  },
  inspectRepositoryFile(repositoryPath, relativePath, sourceId = null) {
    return invoke<FileInspectionReport>('inspect_repository_file', {
      repositoryPath,
      relativePath,
      sourceId,
    });
  },
  getRepositoryStatisticsOverview(repositoryPath) {
    return invoke<RepositoryStatisticsOverview>('get_repository_statistics_overview', {
      repositoryPath,
    });
  },
  analyzeRepositoryStatistics(repositoryPath) {
    return invoke<RepositoryStatisticsReport>('analyze_repository_statistics', {
      repositoryPath,
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
  selectRepositoryParentPath() {
    return openSinglePath({
      directory: true,
      multiple: false,
      title: 'Choose Repository Parent Folder',
    });
  },
  selectExistingRepositoryPath() {
    return openSinglePath({
      directory: true,
      multiple: false,
      title: 'Choose Existing Repository Folder',
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
  onRepositoryStatisticsProgress(handler) {
    return listen<RepositoryStatisticsProgress>('repository-statistics-progress', (event) => {
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
