import { ChevronDown, Moon, Plus, Settings, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '../shared/i18n/I18nProvider';

export type ThemeMode = 'light' | 'dark';

interface AppTopBarProps {
  theme: ThemeMode;
  repositorySwitcher?: ReactNode;
  onNewBackup?: () => void;
  primaryActionLabel?: string;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
}

export function AppTopBar({
  theme,
  repositorySwitcher,
  onNewBackup,
  primaryActionLabel,
  onToggleTheme,
  onOpenSettings,
}: AppTopBarProps) {
  const { t } = useI18n();
  const nextTheme = theme === 'light' ? 'dark' : 'light';
  const switchThemeLabel = t('app.switchTheme', { theme: nextTheme });

  return (
    <header className="app-topbar">
      <div className="app-topbar__brand" aria-label={t('app.name')}>
        <span className="app-topbar__brand-mark" aria-hidden="true">C</span>
        <span>{t('app.name')}</span>
      </div>

      <div className="app-topbar__repository">
        {repositorySwitcher ?? (
          <button className="app-topbar__repository-button" type="button" disabled>
            <span>{t('app.noRepositorySelected')}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="app-topbar__actions">
        <button
          className="app-topbar__primary-action"
          type="button"
          disabled={!onNewBackup}
          onClick={onNewBackup}
        >
          <Plus size={17} aria-hidden="true" />
          <span>{primaryActionLabel ?? t('backup.new')}</span>
        </button>
        <button
          className="app-topbar__icon-button"
          type="button"
          aria-label={switchThemeLabel}
          title={switchThemeLabel}
          onClick={onToggleTheme}
        >
          {theme === 'light'
            ? <Moon size={18} aria-hidden="true" />
            : <Sun size={18} aria-hidden="true" />}
        </button>
        <button
          className="app-topbar__icon-button"
          type="button"
          aria-label={t('app.openSettings')}
          title={t('app.openSettings')}
          onClick={onOpenSettings}
        >
          <Settings size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
