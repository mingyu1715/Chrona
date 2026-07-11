/// <reference types="vite/client" />

import { expect, test } from 'vitest';

const activeSources = import.meta.glob(
  [
    '/src/app/*.tsx',
    '/src/features/backup/*.tsx',
    '/src/features/explorer/*.tsx',
    '/src/features/home/*.tsx',
    '/src/features/repository-library/*.tsx',
    '/src/features/settings/*.tsx',
    '/src/features/snapshots/*.tsx',
    '/src/features/statistics/*.tsx',
    '!/src/**/*.test.tsx',
    '!/src/features/snapshots/SnapshotPanel.tsx',
  ],
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>;

const allowedLiteralText = new Set([
  'C',
  'Chrona',
]);

const allowedAttributeText = new Set([
  'true',
  'false',
  'page',
  'menu',
]);

test('active UI does not render unmanaged user-facing literals', () => {
  const violations: string[] = [];

  for (const [file, source] of Object.entries(activeSources)) {
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const text of jsxTextLiterals(line)) {
        if (!allowedLiteralText.has(text)) {
          violations.push(`${file}:${index + 1} JSX text "${text}"`);
        }
      }
      for (const text of userFacingAttributeLiterals(line)) {
        if (!allowedAttributeText.has(text) && !allowedLiteralText.has(text)) {
          violations.push(`${file}:${index + 1} attribute "${text}"`);
        }
      }
    });
  }

  expect(violations).toEqual([]);
});

function jsxTextLiterals(line: string): string[] {
  if (line.includes('Promise<')) return [];
  if (!/<\/?[A-Za-z][\w.-]*/.test(line)) return [];
  const matches = line.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g);
  return [...matches]
    .map((match) => normalizeLiteral(match[1]))
    .filter(Boolean);
}

function userFacingAttributeLiterals(line: string): string[] {
  const matches = line.matchAll(/(?:^|\s)(?:aria-label|title|placeholder)="([^"]*[A-Za-z][^"]*)"/g);
  return [...matches]
    .map((match) => normalizeLiteral(match[1]))
    .filter(Boolean);
}

function normalizeLiteral(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
