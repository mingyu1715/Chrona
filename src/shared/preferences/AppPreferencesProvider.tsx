import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  type AppLanguage,
  type AppPreferences,
  createTauriPreferencesStore,
  DEFAULT_APP_PREFERENCES,
  normalizeAppPreferences,
  type PreferencesStore,
  type ThemePreference,
} from './appPreferences';

export interface AppPreferencesContextValue {
  preferences: AppPreferences;
  loaded: boolean;
  setLanguage(language: AppLanguage): Promise<void>;
  setTheme(theme: ThemePreference): Promise<void>;
}

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

export function AppPreferencesProvider({
  children,
  store: suppliedStore,
}: {
  children: ReactNode;
  store?: PreferencesStore;
}) {
  const store = useMemo(
    () => suppliedStore ?? createTauriPreferencesStore(),
    [suppliedStore],
  );
  const [preferences, setPreferences] = useState(DEFAULT_APP_PREFERENCES);
  const [loaded, setLoaded] = useState(false);
  const preferencesRef = useRef(preferences);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    store.get<unknown>('preferences').then((value) => {
      if (!active) return;
      const next = normalizeAppPreferences(value);
      preferencesRef.current = next;
      setPreferences(next);
      setLoaded(true);
    }).catch(() => {
      if (!active) return;
      preferencesRef.current = DEFAULT_APP_PREFERENCES;
      setPreferences(DEFAULT_APP_PREFERENCES);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [store]);

  async function persist(next: AppPreferences) {
    preferencesRef.current = next;
    setPreferences(next);
    await store.set('preferences', next);
    await store.save();
  }

  const value: AppPreferencesContextValue = {
    preferences,
    loaded,
    setLanguage: (language) => persist({ ...preferencesRef.current, language }),
    setTheme: (theme) => persist({ ...preferencesRef.current, theme }),
  };

  return (
    <AppPreferencesContext.Provider value={value}>
      {children}
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences() {
  const value = useContext(AppPreferencesContext);
  if (!value) throw new Error('useAppPreferences must be used inside AppPreferencesProvider');
  return value;
}
