import { expect, test, vi } from 'vitest';

import { createDesktopActions } from './desktopActions';

test('delegates reveal, open, and copy operations to desktop plugins', async () => {
  const dependencies = {
    revealItemInDir: vi.fn(async () => undefined),
    openPath: vi.fn(async () => undefined),
    writeText: vi.fn(async () => undefined),
  };
  const actions = createDesktopActions(dependencies);

  await actions.revealPath('C:\\Backups\\Chrona');
  await actions.openPath('/Users/mingyu/Backups');
  await actions.copyText('/Volumes/Archive/Chrona');

  expect(dependencies.revealItemInDir).toHaveBeenCalledWith('C:\\Backups\\Chrona');
  expect(dependencies.openPath).toHaveBeenCalledWith('/Users/mingyu/Backups');
  expect(dependencies.writeText).toHaveBeenCalledWith('/Volumes/Archive/Chrona');
});
