import { FolderOpen, HardDrive, Plus, X } from 'lucide-react';
import { useState } from 'react';

import type { ChronaApi } from '../../shared/api/chronaApi';
import type { RepositoryLibraryController } from '../../app/useRepositoryLibrary';

interface RepositorySetupDialogProps {
  api: ChronaApi;
  controller: RepositoryLibraryController;
  canDismiss?: boolean;
  onDismiss?: () => void;
}

export function RepositorySetupDialog({
  api,
  controller,
  canDismiss = false,
  onDismiss,
}: RepositorySetupDialogProps) {
  const [displayName, setDisplayName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  function validName() {
    const name = displayName.trim();
    if (!name) {
      setValidationError('Enter a repository name.');
      return null;
    }
    setValidationError(null);
    return name;
  }

  async function createManaged() {
    const name = validName();
    if (!name) return;
    await controller.createManaged(name);
    onDismiss?.();
  }

  async function createAt() {
    const name = validName();
    if (!name) return;
    const parentPath = await api.selectRepositoryParentPath();
    if (!parentPath) return;
    await controller.createAt(name, parentPath);
    onDismiss?.();
  }

  async function addExisting() {
    const path = await api.selectExistingRepositoryPath();
    if (!path) return;
    await controller.registerExisting(path);
    onDismiss?.();
  }

  return (
    <div className="repository-setup-layer">
      <section
        className="repository-setup-dialog"
        role="dialog"
        aria-modal={canDismiss}
        aria-labelledby="repository-setup-title"
      >
        <header className="repository-setup-dialog__header">
          <div>
            <span className="repository-setup-dialog__icon" aria-hidden="true">
              <HardDrive size={20} />
            </span>
            <h1 id="repository-setup-title">Set up Chrona</h1>
          </div>
          {canDismiss && (
            <button
              className="repository-setup-dialog__close"
              type="button"
              aria-label="Close repository setup"
              title="Close"
              onClick={onDismiss}
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </header>

        <label className="repository-setup-dialog__field">
          <span>Repository name</span>
          <input
            value={displayName}
            required
            autoFocus
            placeholder="My backups"
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>

        {(validationError || controller.error) && (
          <p className="repository-setup-dialog__error" role="alert">
            {validationError ?? controller.error}
          </p>
        )}

        <div className="repository-setup-dialog__actions">
          <button
            className="repository-setup-dialog__primary"
            type="button"
            disabled={controller.loading}
            onClick={() => void createManaged()}
          >
            <Plus size={17} aria-hidden="true" />
            Create in default location
          </button>
          <button
            type="button"
            disabled={controller.loading}
            onClick={() => void createAt()}
          >
            <FolderOpen size={17} aria-hidden="true" />
            Choose location
          </button>
          <button
            type="button"
            disabled={controller.loading}
            onClick={() => void addExisting()}
          >
            <HardDrive size={17} aria-hidden="true" />
            Add existing repository
          </button>
        </div>
      </section>
    </div>
  );
}
