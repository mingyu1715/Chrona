import { ChevronDown, Moon, Plus, Settings, Sun } from 'lucide-react';
import type { ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';

interface AppTopBarProps {
  theme: ThemeMode;
  repositorySwitcher?: ReactNode;
  onNewBackup?: () => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
}

export function AppTopBar({
  theme,
  repositorySwitcher,
  onNewBackup,
  onToggleTheme,
  onOpenSettings,
}: AppTopBarProps) {
  const nextTheme = theme === 'light' ? 'dark' : 'light';

  return (
    <header className="app-topbar">
      <div className="app-topbar__brand" aria-label="Chrona">
        <span className="app-topbar__brand-mark" aria-hidden="true">C</span>
        <span>Chrona</span>
      </div>

      <div className="app-topbar__repository">
        {repositorySwitcher ?? (
          <button className="app-topbar__repository-button" type="button" disabled>
            <span>No repository selected</span>
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
          <span>New Backup</span>
        </button>
        <button
          className="app-topbar__icon-button"
          type="button"
          aria-label={`Switch to ${nextTheme} mode`}
          title={`Switch to ${nextTheme} mode`}
          onClick={onToggleTheme}
        >
          {theme === 'light'
            ? <Moon size={18} aria-hidden="true" />
            : <Sun size={18} aria-hidden="true" />}
        </button>
        <button
          className="app-topbar__icon-button"
          type="button"
          aria-label="Open settings"
          title="Open settings"
          onClick={onOpenSettings}
        >
          <Settings size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
