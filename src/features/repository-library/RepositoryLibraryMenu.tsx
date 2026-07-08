import {
  Check,
  ChevronDown,
  FolderSearch,
  HardDrive,
  Plus,
  Settings,
} from 'lucide-react';

import type { ChronaApi } from '../../shared/api/chronaApi';
import type { RepositoryLibraryController } from '../../app/useRepositoryLibrary';

interface RepositoryLibraryMenuProps {
  api: ChronaApi;
  controller: RepositoryLibraryController;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewRepository: () => void;
  onManageRepositories: () => void;
}

export function RepositoryLibraryMenu({
  api,
  controller,
  open,
  onOpenChange,
  onNewRepository,
  onManageRepositories,
}: RepositoryLibraryMenuProps) {
  const active = controller.activeRepository?.registration;
  const repositories = controller.library?.repositories ?? [];

  async function addExisting() {
    const path = await api.selectExistingRepositoryPath();
    if (!path) return;
    await controller.registerExisting(path);
    onOpenChange(false);
  }

  async function relink(repositoryId: string) {
    const path = await api.selectExistingRepositoryPath();
    if (!path) return;
    await controller.relink(repositoryId, path);
    onOpenChange(false);
  }

  return (
    <div className="repository-library-menu">
      <button
        className="repository-library-menu__trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${active?.displayName ?? 'Choose repository'} repository menu`}
        onClick={() => onOpenChange(!open)}
      >
        <HardDrive size={16} aria-hidden="true" />
        <span>{active?.displayName ?? 'Choose repository'}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>

      {open && (
        <div className="repository-library-menu__popover" role="menu">
          <div className="repository-library-menu__list">
            {repositories.map((repository) => {
              const isActive = repository.repositoryId === active?.repositoryId;
              if (repository.connectionState === 'disconnected') {
                return (
                  <button
                    key={repository.repositoryId}
                    type="button"
                    role="menuitem"
                    onClick={() => void relink(repository.repositoryId)}
                    aria-label={`Locate ${repository.displayName} folder`}
                  >
                    <FolderSearch size={16} aria-hidden="true" />
                    <span>
                      <strong>{repository.displayName}</strong>
                      <small>Folder unavailable</small>
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={repository.repositoryId}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    void controller.activate(repository.repositoryId);
                    onOpenChange(false);
                  }}
                >
                  <HardDrive size={16} aria-hidden="true" />
                  <span>
                    <strong>{repository.displayName}</strong>
                    <small>{repository.path}</small>
                  </span>
                  {isActive && <Check size={16} aria-label="Active repository" />}
                </button>
              );
            })}
          </div>

          <div className="repository-library-menu__commands">
            <button type="button" role="menuitem" onClick={onNewRepository}>
              <Plus size={16} aria-hidden="true" />
              New repository
            </button>
            <button type="button" role="menuitem" onClick={() => void addExisting()}>
              <HardDrive size={16} aria-hidden="true" />
              Add existing repository
            </button>
            <button type="button" role="menuitem" onClick={onManageRepositories}>
              <Settings size={16} aria-hidden="true" />
              Manage repositories
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
