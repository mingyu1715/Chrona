import { FolderOpen, HardDrive, Plus } from 'lucide-react';
import { useI18n } from '../shared/i18n/I18nProvider';

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
  const { t } = useI18n();

  return (
    <section className="repository-required" aria-labelledby="repository-required-title">
      <span className="repository-required__icon" aria-hidden="true">
        <HardDrive size={22} />
      </span>
      <div>
        <h1 id="repository-required-title">{t('repository.requiredTitle', { workspace })}</h1>
        <p>
          {disconnected
            ? t('repository.requiredDisconnected')
            : t('repository.requiredSetup')}
        </p>
      </div>
      <div className="repository-required__actions">
        {disconnected && onLocateRepository && (
          <button type="button" onClick={onLocateRepository}>
            <FolderOpen size={16} aria-hidden="true" />
            {t('repository.locate')}
          </button>
        )}
        <button type="button" onClick={onCreateRepository}>
          <Plus size={16} aria-hidden="true" />
          {t('repository.create')}
        </button>
        <button type="button" onClick={onAddExistingRepository}>
          <FolderOpen size={16} aria-hidden="true" />
          {t('repository.addExisting')}
        </button>
      </div>
    </section>
  );
}
