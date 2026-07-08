import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';

export interface DesktopActions {
  revealPath(path: string): Promise<void>;
  openPath(path: string): Promise<void>;
  copyText(value: string): Promise<void>;
}

interface DesktopActionDependencies {
  revealItemInDir(path: string): Promise<void>;
  openPath(path: string): Promise<void>;
  writeText(value: string): Promise<void>;
}

export function createDesktopActions(
  dependencies: DesktopActionDependencies = {
    revealItemInDir,
    openPath: (path) => openPath(path),
    writeText,
  },
): DesktopActions {
  return {
    revealPath: (path) => dependencies.revealItemInDir(path),
    openPath: (path) => dependencies.openPath(path),
    copyText: (value) => dependencies.writeText(value),
  };
}

export const desktopActions = createDesktopActions();
