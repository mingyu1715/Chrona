import {
  CheckCircle2,
  Copy,
  Database,
  FolderOpen,
  FolderPlus,
  FolderSearch,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import type { RepositoryLibraryItem } from '../../shared/types/chrona';
import {
  desktopActions as defaultDesktopActions,
  type DesktopActions,
} from '../../shared/desktop/desktopActions';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog';

type RepositorySort = 'recent' | 'name' | 'status';

export interface RepositoryManagementPageProps {
  repositories: RepositoryLibraryItem[];
  activeRepositoryId: string | null;
  onCreateRepository: () => void;
  onAddExistingRepository: () => void;
  onActivate: (repositoryId: string) => void;
  onRename: (repositoryId: string, displayName: string) => void;
  onRelink: (repositoryId: string) => void;
  onRemove: (repositoryId: string) => void;
  desktopActions?: DesktopActions;
}

export function RepositoryManagementPage({
  repositories,
  activeRepositoryId,
  onCreateRepository,
  onAddExistingRepository,
  onActivate,
  onRename,
  onRelink,
  onRemove,
  desktopActions = defaultDesktopActions,
}: RepositoryManagementPageProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<RepositorySort>('recent');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [pendingRemoval, setPendingRemoval] = useState<RepositoryLibraryItem | null>(null);

  const visibleRepositories = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const filtered = repositories.filter((repository) =>
      !normalizedQuery
      || repository.displayName.toLocaleLowerCase().includes(normalizedQuery)
      || repository.path.toLocaleLowerCase().includes(normalizedQuery));

    return [...filtered].sort((left, right) => {
      if (sort === 'name') return left.displayName.localeCompare(right.displayName);
      if (sort === 'status') {
        const statusOrder = left.connectionState.localeCompare(right.connectionState);
        return statusOrder || left.displayName.localeCompare(right.displayName);
      }
      return right.lastOpenedAt.localeCompare(left.lastOpenedAt);
    });
  }, [query, repositories, sort]);

  function beginRename(repository: RepositoryLibraryItem) {
    setRenamingId(repository.repositoryId);
    setDraftName(repository.displayName);
  }

  function saveName(repositoryId: string) {
    const displayName = draftName.trim();
    if (!displayName) return;
    onRename(repositoryId, displayName);
    setRenamingId(null);
  }

  return (
    <section className="settings-section" aria-labelledby="settings-repositories-title">
      <div className="settings-section__heading settings-section__heading--actions">
        <div className="settings-section__title">
          <Database size={20} aria-hidden="true" />
          <div>
            <h2 id="settings-repositories-title">{t('repository.managementTitle')}</h2>
            <p>{t('repository.managementDescription')}</p>
          </div>
        </div>
        <div className="settings-setup-actions">
          <button type="button" onClick={onCreateRepository}>
            <Plus size={16} aria-hidden="true" />
            {t('repository.create')}
          </button>
          <button type="button" onClick={onAddExistingRepository}>
            <FolderPlus size={16} aria-hidden="true" />
            {t('repository.addExisting')}
          </button>
        </div>
      </div>

      <div className="repository-management__toolbar">
        <label className="repository-management__search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">{t('repository.searchLabel')}</span>
          <input
            type="search"
            aria-label={t('repository.searchLabel')}
            value={query}
            placeholder={t('repository.searchPlaceholder')}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">{t('repository.sortLabel')}</span>
          <select
            aria-label={t('repository.sortLabel')}
            value={sort}
            onChange={(event) => setSort(event.target.value as RepositorySort)}
          >
            <option value="recent">{t('repository.sortRecent')}</option>
            <option value="name">{t('common.name')}</option>
            <option value="status">{t('repository.sortStatus')}</option>
          </select>
        </label>
      </div>

      {repositories.length === 0 ? (
        <p className="settings-empty">{t('repository.empty')}</p>
      ) : visibleRepositories.length === 0 ? (
        <p className="settings-empty">{t('repository.noMatches')}</p>
      ) : (
        <ul className="settings-repository-list">
          {visibleRepositories.map((repository) => {
            const active = repository.repositoryId === activeRepositoryId;
            const renaming = repository.repositoryId === renamingId;

            return (
              <li className="settings-row" key={repository.repositoryId}>
                <div className="settings-row__identity">
                  {renaming ? (
                    <label className="repository-management__rename">
                      <span>{t('repository.name')}</span>
                      <input
                        aria-label={t('repository.name')}
                        value={draftName}
                        autoFocus
                        onChange={(event) => setDraftName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') saveName(repository.repositoryId);
                          if (event.key === 'Escape') setRenamingId(null);
                        }}
                      />
                    </label>
                  ) : (
                    <>
                      <strong>{repository.displayName}</strong>
                      <small>{repository.path}</small>
                    </>
                  )}
                </div>

                <div className="settings-row__actions">
                  {renaming ? (
                    <>
                      <button
                        type="button"
                        disabled={!draftName.trim()}
                        onClick={() => saveName(repository.repositoryId)}
                      >
                        {t('repository.saveName')}
                      </button>
                      <button
                        className="settings-icon-button"
                        type="button"
                        aria-label={t('repository.cancelRename')}
                        title={t('common.cancel')}
                        onClick={() => setRenamingId(null)}
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <>
                      {repository.path && (
                        <>
                          <button
                            className="settings-icon-button"
                            type="button"
                            aria-label={t('repository.showNamedInExplorer', { name: repository.displayName })}
                            title={t('backup.showInExplorerTitle')}
                            onClick={() => void desktopActions.revealPath(repository.path)}
                          >
                            <FolderOpen size={16} aria-hidden="true" />
                          </button>
                          <button
                            className="settings-icon-button"
                            type="button"
                            aria-label={t('repository.copyNamedPath', { name: repository.displayName })}
                            title={t('common.copyPath')}
                            onClick={() => void desktopActions.copyText(repository.path)}
                          >
                            <Copy size={16} aria-hidden="true" />
                          </button>
                        </>
                      )}
                      {active ? (
                        <span className="settings-current">
                          <CheckCircle2 size={15} aria-hidden="true" />
                          {t('common.active')}
                        </span>
                      ) : repository.connectionState === 'connected' ? (
                        <button
                          type="button"
                          aria-label={t('repository.useNamed', { name: repository.displayName })}
                          onClick={() => onActivate(repository.repositoryId)}
                        >
                          {t('common.use')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label={t('repository.locateFolder', { name: repository.displayName })}
                          onClick={() => onRelink(repository.repositoryId)}
                        >
                          <FolderSearch size={16} aria-hidden="true" />
                          {t('common.locate')}
                        </button>
                      )}
                      <button
                        className="settings-icon-button"
                        type="button"
                        aria-label={t('repository.renameNamed', { name: repository.displayName })}
                        title={t('common.rename')}
                        onClick={() => beginRename(repository)}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        className="settings-icon-button"
                        type="button"
                        aria-label={t('repository.removeNamed', { name: repository.displayName })}
                        title={t('repository.removeNamed', { name: repository.displayName })}
                        onClick={() => setPendingRemoval(repository)}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {pendingRemoval && (
        <ConfirmDialog
          title={t('repository.removeTitle', { name: pendingRemoval.displayName })}
          description={t('repository.removeDescription')}
          confirmLabel={t('common.remove')}
          cancelLabel={t('common.cancel')}
          intent="danger"
          returnFocusSelector={`[aria-label="Remove ${pendingRemoval.displayName} from Chrona"]`}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={() => {
            onRemove(pendingRemoval.repositoryId);
            setPendingRemoval(null);
          }}
        />
      )}
    </section>
  );
}
