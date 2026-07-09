import {
  BarChart3,
  Files,
  Home,
  Settings,
  TimerReset,
  type LucideIcon,
} from 'lucide-react';
import { useI18n } from '../shared/i18n/I18nProvider';

export type AppView = 'home' | 'files' | 'snapshots' | 'statistics' | 'settings';

interface AppSidebarProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
}

const destinations: Array<{ view: AppView; labelKey: 'nav.home' | 'nav.files' | 'nav.snapshots' | 'nav.statistics' | 'nav.settings'; icon: LucideIcon }> = [
  { view: 'home', labelKey: 'nav.home', icon: Home },
  { view: 'files', labelKey: 'nav.files', icon: Files },
  { view: 'snapshots', labelKey: 'nav.snapshots', icon: TimerReset },
  { view: 'statistics', labelKey: 'nav.statistics', icon: BarChart3 },
  { view: 'settings', labelKey: 'nav.settings', icon: Settings },
];

export function AppSidebar({ activeView, onViewChange }: AppSidebarProps) {
  const { t } = useI18n();

  return (
    <aside className="app-sidebar">
      <nav className="app-sidebar__navigation" aria-label={t('app.primaryNavigation')}>
        {destinations.map(({ view, labelKey, icon: Icon }) => (
          <button
            className="app-sidebar__destination"
            type="button"
            key={view}
            aria-current={activeView === view ? 'page' : undefined}
            onClick={() => onViewChange(view)}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{t(labelKey)}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
