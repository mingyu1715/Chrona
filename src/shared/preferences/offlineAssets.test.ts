import { expect, test } from 'vitest';

import fontUrl from '../../assets/fonts/PretendardVariable.woff2?url';

test('loads the application font from a bundled local asset', () => {
  expect(fontUrl).toContain('PretendardVariable.woff2');
  expect(fontUrl).not.toMatch(/^https?:\/\//);
});
