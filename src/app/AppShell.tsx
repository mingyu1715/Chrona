import { type ReactNode, useState } from 'react';

import { AppSidebar, type AppView } from './AppSidebar';
import { AppTopBar, type ThemeMode } from './AppTopBar';
import { OperationBar, type ActiveOperation } from './OperationBar';
import './app-shell.css';

interface AppShellProps {
  children: ReactNode | ((activeView: AppView) => ReactNode);
  initialView?: AppView;
  repositorySwitcher?: ReactNode;
  activeOperation?: ActiveOperation | null;
  onNewBackup?: () => void;
}

export function AppShell({
  children,
  initialView = 'home',
  repositorySwitcher,
  activeOperation = null,
  onNewBackup,
}: AppShellProps) {
  const [activeView, setActiveView] = useState<AppView>(initialView);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const content = typeof children === 'function' ? children(activeView) : children;

  return (
    <div className="app-shell" data-theme={theme} data-testid="app-shell">
      <AppTopBar
        theme={theme}
        repositorySwitcher={repositorySwitcher}
        onNewBackup={onNewBackup}
        onToggleTheme={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
        onOpenSettings={() => setActiveView('settings')}
      />
      <AppSidebar activeView={activeView} onViewChange={setActiveView} />
      <main className="app-shell__content" data-active-view={activeView}>
        {content}
      </main>
      <OperationBar operation={activeOperation} />
    </div>
  );
}

export type { ActiveOperation, AppView };
