import type { AppLanguage } from '../preferences/appPreferences';

export type ResolvedLocale = 'ko-KR' | 'en-US';

export function resolveLocale(
  language: AppLanguage,
  systemLocale: string,
): ResolvedLocale {
  if (language === 'ko') return 'ko-KR';
  if (language === 'en') return 'en-US';
  return systemLocale.toLocaleLowerCase().startsWith('ko') ? 'ko-KR' : 'en-US';
}
