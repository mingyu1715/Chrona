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
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<RepositorySort>('recent');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

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
            <h2 id="settings-repositories-title">Repositories</h2>
            <p>Find, switch, rename, or reconnect registered locations.</p>
          </div>
        </div>
        <div className="settings-setup-actions">
          <button type="button" onClick={onCreateRepository}>
            <Plus size={16} aria-hidden="true" />
            Create repository
          </button>
          <button type="button" onClick={onAddExistingRepository}>
            <FolderPlus size={16} aria-hidden="true" />
            Add existing repository
          </button>
        </div>
      </div>

      <div className="repository-management__toolbar">
        <label className="repository-management__search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search repositories</span>
          <input
            type="search"
            aria-label="Search repositories"
            value={query}
            placeholder="Search name or path"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Sort repositories</span>
          <select
            aria-label="Sort repositories"
            value={sort}
            onChange={(event) => setSort(event.target.value as RepositorySort)}
          >
            <option value="recent">Recently used</option>
            <option value="name">Name</option>
            <option value="status">Connection status</option>
          </select>
        </label>
      </div>

      {repositories.length === 0 ? (
        <p className="settings-empty">No repositories are registered yet.</p>
      ) : visibleRepositories.length === 0 ? (
        <p className="settings-empty">No repositories match this search.</p>
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
                      <span>Repository name</span>
                      <input
                        aria-label="Repository name"
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
                        Save name
                      </button>
                      <button
                        className="settings-icon-button"
                        type="button"
                        aria-label="Cancel rename"
                        title="Cancel"
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
                            aria-label={`Show ${repository.displayName} in file explorer`}
                            title="Show in Finder or File Explorer"
                            onClick={() => void desktopActions.revealPath(repository.path)}
                          >
                            <FolderOpen size={16} aria-hidden="true" />
                          </button>
                          <button
                            className="settings-icon-button"
                            type="button"
                            aria-label={`Copy ${repository.displayName} path`}
                            title="Copy path"
                            onClick={() => void desktopActions.copyText(repository.path)}
                          >
                            <Copy size={16} aria-hidden="true" />
                          </button>
                        </>
                      )}
                      {active ? (
                        <span className="settings-current">
                          <CheckCircle2 size={15} aria-hidden="true" />
                          Active
                        </span>
                      ) : repository.connectionState === 'connected' ? (
                        <button
                          type="button"
                          aria-label={`Use ${repository.displayName}`}
                          onClick={() => onActivate(repository.repositoryId)}
                        >
                          Use
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Locate ${repository.displayName} folder`}
                          onClick={() => onRelink(repository.repositoryId)}
                        >
                          <FolderSearch size={16} aria-hidden="true" />
                          Locate
                        </button>
                      )}
                      <button
                        className="settings-icon-button"
                        type="button"
                        aria-label={`Rename ${repository.displayName}`}
                        title="Rename"
                        onClick={() => beginRename(repository)}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        className="settings-icon-button"
                        type="button"
                        aria-label={`Remove ${repository.displayName} from Chrona`}
                        title="Remove from Chrona"
                        onClick={() => onRemove(repository.repositoryId)}
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
    </section>
  );
}
