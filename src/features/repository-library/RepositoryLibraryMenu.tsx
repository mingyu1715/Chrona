import {
  Check,
  ChevronDown,
  Copy,
  FolderOpen,
  FolderSearch,
  HardDrive,
  Plus,
  Settings,
} from 'lucide-react';

import type { ChronaApi } from '../../shared/api/chronaApi';
import type { RepositoryLibraryController } from '../../app/useRepositoryLibrary';
import {
  desktopActions as defaultDesktopActions,
  type DesktopActions,
} from '../../shared/desktop/desktopActions';
import { useI18n } from '../../shared/i18n/I18nProvider';

interface RepositoryLibraryMenuProps {
  api: ChronaApi;
  controller: RepositoryLibraryController;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNewRepository: () => void;
  onManageRepositories: () => void;
  desktopActions?: DesktopActions;
}

export function RepositoryLibraryMenu({
  api,
  controller,
  open,
  onOpenChange,
  onNewRepository,
  onManageRepositories,
  desktopActions = defaultDesktopActions,
}: RepositoryLibraryMenuProps) {
  const { t } = useI18n();
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
        aria-label={t('repository.menuLabel', {
          name: active?.displayName ?? t('repository.chooseMenuLabel'),
        })}
        onClick={() => onOpenChange(!open)}
      >
        <HardDrive size={16} aria-hidden="true" />
        <span>{active?.displayName ?? t('repository.chooseMenuLabel')}</span>
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
                    aria-label={t('repository.locateFolder', { name: repository.displayName })}
                  >
                    <FolderSearch size={16} aria-hidden="true" />
                    <span>
                      <strong>{repository.displayName}</strong>
                      <small>{t('repository.folderUnavailable')}</small>
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
                  {isActive && <Check size={16} aria-label={t('repository.activeLabel')} />}
                </button>
              );
            })}
          </div>

          <div className="repository-library-menu__commands">
            {active?.path && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    void desktopActions.revealPath(active.path);
                    onOpenChange(false);
                  }}
                >
                  <FolderOpen size={16} aria-hidden="true" />
                  {t('repository.showInExplorer')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void desktopActions.copyText(active.path)}
                >
                  <Copy size={16} aria-hidden="true" />
                  {t('repository.copyPath')}
                </button>
              </>
            )}
            <button type="button" role="menuitem" onClick={onNewRepository}>
              <Plus size={16} aria-hidden="true" />
              {t('repository.new')}
            </button>
            <button type="button" role="menuitem" onClick={() => void addExisting()}>
              <HardDrive size={16} aria-hidden="true" />
              {t('repository.addExisting')}
            </button>
            <button type="button" role="menuitem" onClick={onManageRepositories}>
              <Settings size={16} aria-hidden="true" />
              {t('repository.manage')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
