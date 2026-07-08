import { createContext, type ReactNode, useContext, useMemo } from 'react';

import { useAppPreferences } from '../preferences/AppPreferencesProvider';
import {
  formatBytes as formatBytesValue,
  formatDateTime as formatDateTimeValue,
  formatNumber as formatNumberValue,
} from './format';
import { resolveLocale, type ResolvedLocale } from './locale';
import { englishMessages, type MessageKey } from './messages.en';
import { koreanMessages } from './messages.ko';

type MessageValues = Record<string, string | number>;

export interface I18nValue {
  locale: ResolvedLocale;
  t(key: MessageKey, values?: MessageValues): string;
  formatBytes(bytes: number): string;
  formatDateTime(value: string): string;
  formatNumber(value: number): string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { preferences } = useAppPreferences();
  const locale = resolveLocale(
    preferences.language,
    typeof navigator === 'undefined' ? 'en-US' : navigator.language,
  );

  const value = useMemo<I18nValue>(() => {
    const messages = locale === 'ko-KR' ? koreanMessages : englishMessages;
    return {
      locale,
      t(key, values = {}) {
        const template = messages[key] ?? englishMessages[key];
        return Object.entries(values).reduce(
          (message, [name, replacement]) =>
            message.replaceAll(`{${name}}`, String(replacement)),
          template,
        );
      },
      formatBytes: (bytes) => formatBytesValue(locale, bytes),
      formatDateTime: (date) => formatDateTimeValue(locale, date),
      formatNumber: (number) => formatNumberValue(locale, number),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
