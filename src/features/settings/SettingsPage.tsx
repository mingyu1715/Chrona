import {
  CheckCircle2,
  Database,
  FolderPlus,
  Languages,
  Monitor,
  Moon,
  Plus,
  Save,
  Sun,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ChronaApi } from '../../shared/api/chronaApi';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { useAppPreferences } from '../../shared/preferences/AppPreferencesProvider';
import type { ThemePreference } from '../../shared/preferences/appPreferences';
import type {
  CompressionMode,
  IntegrityReport,
  OpenedRepository,
  RepositoryLibrary,
} from '../../shared/types/chrona';
import { RepositoryManagementPage } from '../repository-library/RepositoryManagementPage';
import './settings-page.css';

type Section = 'General' | 'Repositories' | 'Storage' | 'Repository health';

const sections: Section[] = [
  'General',
  'Repositories',
  'Storage',
  'Repository health',
];

export interface SettingsPageProps {
  api: ChronaApi;
  repository: OpenedRepository | null;
  library: RepositoryLibrary;
  onCreateRepository: () => void;
  onAddExistingRepository: () => void;
  onSelectRepository: (repositoryId: string) => void;
  onRenameRepository: (repositoryId: string, displayName: string) => void;
  onRelinkRepository: (repositoryId: string) => void;
  onRemoveRepository: (repositoryId: string) => void;
}

export function SettingsPage({
  api,
  repository,
  library,
  onCreateRepository,
  onAddExistingRepository,
  onSelectRepository,
  onRenameRepository,
  onRelinkRepository,
  onRemoveRepository,
}: SettingsPageProps) {
  const [section, setSection] = useState<Section>('General');

  return (
    <div className="settings-page">
      <header className="workspace-header">
        <div>
          <h1>Settings</h1>
          <p>Application preferences and repository management</p>
        </div>
      </header>

      <div className="settings-layout">
        <nav aria-label="Settings sections">
          {sections.map((name) => (
            <button
              key={name}
              type="button"
              aria-current={section === name ? 'page' : undefined}
              onClick={() => setSection(name)}
            >
              {name}
            </button>
          ))}
        </nav>

        <main>
          {section === 'General' && <GeneralSettings />}
          {section === 'Repositories' && (
            <RepositoryManagementPage
              repositories={library.repositories}
              activeRepositoryId={repository?.registration.repositoryId ?? null}
              onCreateRepository={onCreateRepository}
              onAddExistingRepository={onAddExistingRepository}
              onActivate={onSelectRepository}
              onRename={onRenameRepository}
              onRelink={onRelinkRepository}
              onRemove={onRemoveRepository}
            />
          )}
          {section === 'Storage' && (
            <StorageSettings
              api={api}
              repository={repository}
              library={library}
              onCreateRepository={onCreateRepository}
              onAddExistingRepository={onAddExistingRepository}
              onSelectRepository={onSelectRepository}
            />
          )}
          {section === 'Repository health' && (
            <RepositoryHealthSettings
              api={api}
              repository={repository}
              library={library}
              onCreateRepository={onCreateRepository}
              onAddExistingRepository={onAddExistingRepository}
              onSelectRepository={onSelectRepository}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function GeneralSettings() {
  const { preferences, setLanguage, setTheme } = useAppPreferences();
  const { t } = useI18n();
  const themes: Array<{
    value: ThemePreference;
    label: string;
    icon: typeof Monitor;
  }> = [
    { value: 'system', label: t('common.system'), icon: Monitor },
    { value: 'light', label: t('theme.light'), icon: Sun },
    { value: 'dark', label: t('theme.dark'), icon: Moon },
  ];

  return (
    <section className="settings-section" aria-labelledby="settings-general-title">
      <div className="settings-section__heading">
        <Languages size={20} aria-hidden="true" />
        <div>
          <h2 id="settings-general-title">General</h2>
          <p>Language and appearance apply across Chrona.</p>
        </div>
      </div>

      <div className="settings-field">
        <label htmlFor="settings-language">Language</label>
        <select
          id="settings-language"
          value={preferences.language}
          onChange={(event) => void setLanguage(event.target.value as 'system' | 'ko' | 'en')}
        >
          <option value="system">{t('common.system')}</option>
          <option value="ko">{t('language.korean')}</option>
          <option value="en">{t('language.english')}</option>
        </select>
      </div>

      <fieldset className="settings-field">
        <legend>Theme</legend>
        <div className="settings-segmented">
          {themes.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={preferences.theme === value}
              onClick={() => void setTheme(value)}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </fieldset>
    </section>
  );
}

function StorageSettings({
  api,
  repository,
  library,
  onCreateRepository,
  onAddExistingRepository,
  onSelectRepository,
}: Pick<SettingsPageProps,
  | 'api'
  | 'repository'
  | 'library'
  | 'onCreateRepository'
  | 'onAddExistingRepository'
  | 'onSelectRepository'
>) {
  const [mode, setMode] = useState<CompressionMode>(
    repository?.manifest.blockStrategy.compressionMode ?? 'standard',
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode(repository?.manifest.blockStrategy.compressionMode ?? 'standard');
  }, [repository]);

  async function applyMode() {
    if (!repository) return;
    try {
      setError(null);
      await api.setRepositoryCompressionMode(repository.registration.path, mode);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <section className="settings-section" aria-labelledby="settings-storage-title">
      <div className="settings-section__heading">
        <Database size={20} aria-hidden="true" />
        <div>
          <h2 id="settings-storage-title">Storage</h2>
          <p>Control how new blocks are stored in the active repository.</p>
        </div>
      </div>
      {error && <p className="settings-error" role="alert">{error}</p>}
      {!repository ? (
        <RepositorySelectionRequired
          message="Select or set up a repository to manage storage."
          library={library}
          onCreateRepository={onCreateRepository}
          onAddExistingRepository={onAddExistingRepository}
          onSelectRepository={onSelectRepository}
        />
      ) : (
        <div className="settings-field">
          <label htmlFor="settings-compression">Compression mode</label>
          <select
            id="settings-compression"
            value={mode}
            onChange={(event) => setMode(event.target.value as CompressionMode)}
          >
            <option value="standard">Zstd standard</option>
            <option value="fast">LZ4 fast</option>
            <option value="off">Off</option>
          </select>
          <button className="settings-primary-button" type="button" onClick={() => void applyMode()}>
            <Save size={16} aria-hidden="true" />
            Apply
          </button>
        </div>
      )}
    </section>
  );
}

function RepositoryHealthSettings({
  api,
  repository,
  library,
  onCreateRepository,
  onAddExistingRepository,
  onSelectRepository,
}: Pick<SettingsPageProps,
  | 'api'
  | 'repository'
  | 'library'
  | 'onCreateRepository'
  | 'onAddExistingRepository'
  | 'onSelectRepository'
>) {
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    if (!repository) return;
    try {
      setError(null);
      setIntegrity(await api.verifyRepository(repository.registration.path));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <section className="settings-section" aria-labelledby="settings-health-title">
      <div className="settings-section__heading">
        <CheckCircle2 size={20} aria-hidden="true" />
        <div>
          <h2 id="settings-health-title">Repository health</h2>
          <p>Check snapshot metadata and referenced blocks.</p>
        </div>
      </div>
      {error && <p className="settings-error" role="alert">{error}</p>}
      {!repository ? (
        <RepositorySelectionRequired
          message="Select or set up a repository to verify its health."
          library={library}
          onCreateRepository={onCreateRepository}
          onAddExistingRepository={onAddExistingRepository}
          onSelectRepository={onSelectRepository}
        />
      ) : (
        <div className="settings-health-actions">
          <button className="settings-primary-button" type="button" onClick={() => void verify()}>
            <CheckCircle2 size={16} aria-hidden="true" />
            Verify repository
          </button>
          {integrity && (
            <p role="status">
              {integrity.status} · {integrity.missingBlockCount} missing · {integrity.corruptBlockCount} corrupt
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function RepositorySelectionRequired({
  message,
  library,
  onCreateRepository,
  onAddExistingRepository,
  onSelectRepository,
}: Pick<SettingsPageProps, 'library' | 'onCreateRepository' | 'onAddExistingRepository' | 'onSelectRepository'> & {
  message: string;
}) {
  return (
    <div className="settings-required">
      <p>{message}</p>
      {library.repositories.length > 0 && (
        <label>
          Repository
          <select
            aria-label="Select repository"
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) onSelectRepository(event.target.value);
            }}
          >
            <option value="" disabled>Choose a repository</option>
            {library.repositories.map((item) => (
              <option
                key={item.repositoryId}
                value={item.repositoryId}
                disabled={item.connectionState === 'disconnected'}
              >
                {item.displayName}
              </option>
            ))}
          </select>
        </label>
      )}
      <RepositorySetupActions
        onCreateRepository={onCreateRepository}
        onAddExistingRepository={onAddExistingRepository}
      />
    </div>
  );
}

function RepositorySetupActions({
  onCreateRepository,
  onAddExistingRepository,
}: Pick<SettingsPageProps, 'onCreateRepository' | 'onAddExistingRepository'>) {
  return (
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
  );
}
