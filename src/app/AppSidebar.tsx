import {
  BarChart3,
  Files,
  Home,
  Settings,
  TimerReset,
  type LucideIcon,
} from 'lucide-react';

export type AppView = 'home' | 'files' | 'snapshots' | 'statistics' | 'settings';

interface AppSidebarProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
}

const destinations: Array<{ view: AppView; label: string; icon: LucideIcon }> = [
  { view: 'home', label: 'Home', icon: Home },
  { view: 'files', label: 'Files', icon: Files },
  { view: 'snapshots', label: 'Snapshots', icon: TimerReset },
  { view: 'statistics', label: 'Statistics', icon: BarChart3 },
  { view: 'settings', label: 'Settings', icon: Settings },
];

export function AppSidebar({ activeView, onViewChange }: AppSidebarProps) {
  return (
    <aside className="app-sidebar">
      <nav className="app-sidebar__navigation" aria-label="Primary navigation">
        {destinations.map(({ view, label, icon: Icon }) => (
          <button
            className="app-sidebar__destination"
            type="button"
            key={view}
            aria-current={activeView === view ? 'page' : undefined}
            onClick={() => onViewChange(view)}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
