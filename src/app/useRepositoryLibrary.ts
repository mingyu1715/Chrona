import { useCallback, useEffect, useState } from 'react';

import type { ChronaApi } from '../shared/api/chronaApi';
import type {
  OpenedRepository,
  RepositoryLibrary,
  RepositoryLibraryItem,
} from '../shared/types/chrona';

export interface RepositoryLibraryController {
  library: RepositoryLibrary | null;
  activeRepository: OpenedRepository | null;
  loading: boolean;
  error: string | null;
  createManaged(displayName: string): Promise<void>;
  createAt(displayName: string, parentPath: string): Promise<void>;
  registerExisting(path: string): Promise<void>;
  activate(repositoryId: string): Promise<void>;
  remove(repositoryId: string): Promise<void>;
  relink(repositoryId: string, path: string): Promise<void>;
  refresh(): Promise<void>;
}

function mergeRegistration(
  current: RepositoryLibrary | null,
  registration: RepositoryLibraryItem,
): RepositoryLibrary {
  const repositories = current?.repositories ?? [];
  const index = repositories.findIndex(
    (item) => item.repositoryId === registration.repositoryId,
  );
  const nextRepositories = [...repositories];

  if (index >= 0) nextRepositories[index] = registration;
  else nextRepositories.push(registration);

  return {
    activeRepositoryId: registration.repositoryId,
    repositories: nextRepositories,
  };
}

export function useRepositoryLibrary(api?: ChronaApi): RepositoryLibraryController {
  const [library, setLibrary] = useState<RepositoryLibrary | null>(null);
  const [activeRepository, setActiveRepository] = useState<OpenedRepository | null>(null);
  const [loading, setLoading] = useState(Boolean(api));
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      return await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      throw caught;
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!api) {
      setLoading(false);
      return;
    }

    await run(async () => {
      const nextLibrary = await api.getRepositoryLibrary();
      setLibrary(nextLibrary);
      const activeItem = nextLibrary.repositories.find(
        (item) => item.repositoryId === nextLibrary.activeRepositoryId,
      );

      if (!activeItem || activeItem.connectionState !== 'connected') {
        setActiveRepository(null);
        return;
      }

      const opened = await api.activateRegisteredRepository(activeItem.repositoryId);
      setActiveRepository(opened);
      setLibrary((current) => mergeRegistration(current, opened.registration));
    });
  }, [api, run]);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  const applyOpened = useCallback((opened: OpenedRepository) => {
    setActiveRepository(opened);
    setLibrary((current) => mergeRegistration(current, opened.registration));
  }, []);

  const createManaged = useCallback(async (displayName: string) => {
    if (!api) return;
    await run(async () => applyOpened(await api.createManagedRepository(displayName)));
  }, [api, applyOpened, run]);

  const createAt = useCallback(async (displayName: string, parentPath: string) => {
    if (!api) return;
    await run(async () => applyOpened(await api.createRepositoryAt(displayName, parentPath)));
  }, [api, applyOpened, run]);

  const registerExisting = useCallback(async (path: string) => {
    if (!api) return;
    await run(async () => applyOpened(await api.registerExistingRepository(path)));
  }, [api, applyOpened, run]);

  const activate = useCallback(async (repositoryId: string) => {
    if (!api) return;
    await run(async () => applyOpened(await api.activateRegisteredRepository(repositoryId)));
  }, [api, applyOpened, run]);

  const remove = useCallback(async (repositoryId: string) => {
    if (!api) return;
    await run(async () => {
      const nextLibrary = await api.removeRepositoryRegistration(repositoryId);
      setLibrary(nextLibrary);
      setActiveRepository((current) =>
        current?.registration.repositoryId === repositoryId ? null : current,
      );
    });
  }, [api, run]);

  const relink = useCallback(async (repositoryId: string, path: string) => {
    if (!api) return;
    await run(async () => applyOpened(
      await api.relinkRegisteredRepository(repositoryId, path),
    ));
  }, [api, applyOpened, run]);

  return {
    library,
    activeRepository,
    loading,
    error,
    createManaged,
    createAt,
    registerExisting,
    activate,
    remove,
    relink,
    refresh,
  };
}
