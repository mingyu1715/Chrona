import { FolderOpen, HardDrive, Plus } from 'lucide-react';

interface RepositoryRequiredStateProps {
  workspace: string;
  disconnected?: boolean;
  onCreateRepository: () => void;
  onAddExistingRepository: () => void;
  onLocateRepository?: () => void;
}

export function RepositoryRequiredState({
  workspace,
  disconnected = false,
  onCreateRepository,
  onAddExistingRepository,
  onLocateRepository,
}: RepositoryRequiredStateProps) {
  return (
    <section className="repository-required" aria-labelledby="repository-required-title">
      <span className="repository-required__icon" aria-hidden="true">
        <HardDrive size={22} />
      </span>
      <div>
        <h1 id="repository-required-title">{workspace} requires a repository</h1>
        <p>
          {disconnected
            ? 'The registered repository folder is unavailable.'
            : 'Create a repository or add one that already exists.'}
        </p>
      </div>
      <div className="repository-required__actions">
        {disconnected && onLocateRepository && (
          <button type="button" onClick={onLocateRepository}>
            <FolderOpen size={16} aria-hidden="true" />
            Locate repository
          </button>
        )}
        <button type="button" onClick={onCreateRepository}>
          <Plus size={16} aria-hidden="true" />
          Create repository
        </button>
        <button type="button" onClick={onAddExistingRepository}>
          <FolderOpen size={16} aria-hidden="true" />
          Add existing repository
        </button>
      </div>
    </section>
  );
}
