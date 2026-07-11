import { LazyStore } from '@tauri-apps/plugin-store';

export type AppLanguage = 'system' | 'ko' | 'en';
export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppPreferences {
  language: AppLanguage;
  theme: ThemePreference;
}

export interface PreferencesStore {
  get<T>(key: string): Promise<T | null | undefined>;
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  language: 'system',
  theme: 'system',
};

const languages: AppLanguage[] = ['system', 'ko', 'en'];
const themes: ThemePreference[] = ['system', 'light', 'dark'];

export function normalizeAppPreferences(value: unknown): AppPreferences {
  if (!value || typeof value !== 'object') return DEFAULT_APP_PREFERENCES;
  const candidate = value as Partial<AppPreferences>;
  return {
    language: languages.includes(candidate.language as AppLanguage)
      ? candidate.language as AppLanguage
      : 'system',
    theme: themes.includes(candidate.theme as ThemePreference)
      ? candidate.theme as ThemePreference
      : 'system',
  };
}

export function createTauriPreferencesStore(): PreferencesStore {
  const store = new LazyStore('settings.json');
  return {
    get: <T,>(key: string) => store.get<T>(key),
    set: (key, value) => store.set(key, value),
    save: () => store.save(),
  };
}
