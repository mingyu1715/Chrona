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
  const { t } = useI18n();
  const [section, setSection] = useState<Section>('General');

  return (
    <div className="settings-page">
      <header className="workspace-header">
        <div>
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.description')}</p>
        </div>
      </header>

      <div className="settings-layout">
        <nav aria-label={t('settings.sections')}>
          {sections.map((name) => (
            <button
              key={name}
              type="button"
              aria-current={section === name ? 'page' : undefined}
              onClick={() => setSection(name)}
            >
              {sectionLabel(t, name)}
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
          <h2 id="settings-general-title">{t('settings.general')}</h2>
          <p>{t('settings.generalDescription')}</p>
        </div>
      </div>

      <div className="settings-field">
        <label htmlFor="settings-language">{t('settings.language')}</label>
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
        <legend>{t('settings.theme')}</legend>
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
  const { t } = useI18n();
  const [mode, setMode] = useState<CompressionMode>(
    repository?.manifest.blockStrategy.compressionMode ?? 'standard',
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMode(repository?.manifest.blockStrategy.compressionMode ?? 'standard');
    setSaved(false);
    setError(null);
  }, [repository]);

  useEffect(() => {
    if (!saved) return undefined;
    const timeout = window.setTimeout(() => setSaved(false), 2600);
    return () => window.clearTimeout(timeout);
  }, [saved]);

  async function applyMode() {
    if (!repository) return;
    try {
      setError(null);
      await api.setRepositoryCompressionMode(repository.registration.path, mode);
      setSaved(true);
    } catch (caught) {
      setSaved(false);
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <section className="settings-section" aria-labelledby="settings-storage-title">
      <div className="settings-section__heading">
        <Database size={20} aria-hidden="true" />
        <div>
          <h2 id="settings-storage-title">{t('settings.storage')}</h2>
          <p>{t('settings.storageDescription')}</p>
        </div>
      </div>
      {error && <p className="settings-error" role="alert">{error}</p>}
      {!repository ? (
        <RepositorySelectionRequired
          message={t('settings.storageRequired')}
          library={library}
          onCreateRepository={onCreateRepository}
          onAddExistingRepository={onAddExistingRepository}
          onSelectRepository={onSelectRepository}
        />
      ) : (
        <div className="settings-field">
          <label htmlFor="settings-compression">{t('settings.compressionMode')}</label>
          <select
            id="settings-compression"
            value={mode}
            onChange={(event) => {
              setMode(event.target.value as CompressionMode);
              setSaved(false);
            }}
          >
            <option value="standard">{t('settings.compressionStandard')}</option>
            <option value="fast">{t('settings.compressionFast')}</option>
            <option value="off">{t('common.off')}</option>
          </select>
          <button className="settings-primary-button" type="button" onClick={() => void applyMode()}>
            <Save size={16} aria-hidden="true" />
            {t('common.apply')}
          </button>
          {saved && (
            <p className="settings-toast" role="status" aria-label={t('settings.compressionSaved')}>
              <CheckCircle2 size={16} aria-hidden="true" />
              {t('settings.compressionSaved')}
            </p>
          )}
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
  const { t } = useI18n();
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
          <h2 id="settings-health-title">{t('settings.health')}</h2>
          <p>{t('settings.healthDescription')}</p>
        </div>
      </div>
      {error && <p className="settings-error" role="alert">{error}</p>}
      {!repository ? (
        <RepositorySelectionRequired
          message={t('settings.healthRequired')}
          library={library}
          onCreateRepository={onCreateRepository}
          onAddExistingRepository={onAddExistingRepository}
          onSelectRepository={onSelectRepository}
        />
      ) : (
        <div className="settings-health-actions">
          <button className="settings-primary-button" type="button" onClick={() => void verify()}>
            <CheckCircle2 size={16} aria-hidden="true" />
            {t('settings.verifyRepository')}
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
  const { t } = useI18n();

  return (
    <div className="settings-required">
      <p>{message}</p>
      {library.repositories.length > 0 && (
        <label>
          {t('common.repository')}
          <select
            aria-label={t('settings.selectRepository')}
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) onSelectRepository(event.target.value);
            }}
          >
            <option value="" disabled>{t('settings.chooseRepository')}</option>
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
  const { t } = useI18n();

  return (
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
  );
}

function sectionLabel(
  t: (key: 'settings.general' | 'repository.managementTitle' | 'settings.storage' | 'settings.health') => string,
  section: Section,
) {
  if (section === 'General') return t('settings.general');
  if (section === 'Repositories') return t('repository.managementTitle');
  if (section === 'Storage') return t('settings.storage');
  return t('settings.health');
}
