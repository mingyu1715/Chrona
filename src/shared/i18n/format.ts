import type { ResolvedLocale } from './locale';

export function formatNumber(locale: ResolvedLocale, value: number): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatBytes(locale: ResolvedLocale, bytes: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const maximumFractionDigits = unit === 0 ? 0 : 1;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value)} ${units[unit]}`;
}

export function formatDateTime(locale: ResolvedLocale, value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
