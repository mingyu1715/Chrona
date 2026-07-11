import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { AppPreferencesProvider } from '../preferences/AppPreferencesProvider';
import type { PreferencesStore } from '../preferences/appPreferences';
import { I18nProvider, useI18n } from './I18nProvider';
import { resolveLocale } from './locale';

function storeWithLanguage(language: 'system' | 'ko' | 'en'): PreferencesStore {
  return {
    get: vi.fn(async () => ({ language, theme: 'system' })) as unknown as PreferencesStore['get'],
    set: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
  };
}

function Probe() {
  const { locale, t, formatBytes, formatDateTime } = useI18n();
  return (
    <div>
      <span>{locale}</span>
      <span>{t('common.cancel')}</span>
      <span>{t('backup.completed', { name: 'Final' })}</span>
      <span>{formatBytes(1536)}</span>
      <time aria-label="formatted date">{formatDateTime('2026-07-08T00:00:00Z')}</time>
    </div>
  );
}

test('resolves Korean system locales and falls back to English', () => {
  expect(resolveLocale('system', 'ko-KR')).toBe('ko-KR');
  expect(resolveLocale('system', 'en-GB')).toBe('en-US');
  expect(resolveLocale('system', 'fr-FR')).toBe('en-US');
  expect(resolveLocale('ko', 'en-US')).toBe('ko-KR');
  expect(resolveLocale('en', 'ko-KR')).toBe('en-US');
});

test('provides Korean messages, interpolation, and locale formatting', async () => {
  render(
    <AppPreferencesProvider store={storeWithLanguage('ko')}>
      <I18nProvider>
        <Probe />
      </I18nProvider>
    </AppPreferencesProvider>,
  );

  expect(await screen.findByText('ko-KR')).toBeInTheDocument();
  expect(screen.getByText('취소')).toBeInTheDocument();
  expect(screen.getByText('Final 백업 완료')).toBeInTheDocument();
  expect(screen.getByText('1.5 KiB')).toBeInTheDocument();
  expect(screen.getByLabelText('formatted date')).not.toHaveTextContent('Invalid');
});

test('provides English messages when explicitly selected', async () => {
  render(
    <AppPreferencesProvider store={storeWithLanguage('en')}>
      <I18nProvider><Probe /></I18nProvider>
    </AppPreferencesProvider>,
  );

  expect(await screen.findByText('en-US')).toBeInTheDocument();
  expect(screen.getByText('Cancel')).toBeInTheDocument();
  expect(screen.getByText('Backup complete: Final')).toBeInTheDocument();
});
