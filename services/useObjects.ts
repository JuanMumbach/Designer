import { useCallback, useEffect, useState } from 'react';
import {
  addObjectShortcut,
  cloneObject,
  fetchAllCategories,
  fetchAllObjectModels,
  fetchPublicObjectModels,
  removeObjectShortcut,
  ObjectModel,
  ObjectCategory,
} from './api';

export function useObjects(workspaceId?: string) {
  const [objects, setObjects] = useState<ObjectModel[]>([]);
  const [categories, setCategories] = useState<ObjectCategory[]>([]);
  const [publicObjects, setPublicObjects] = useState<ObjectModel[]>([]);
  const [publicObjectsLoading, setPublicObjectsLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [objectsData, categoriesData] = await Promise.all([
        fetchAllObjectModels(),
        fetchAllCategories(),
      ]);
      const seen = new Set<string>();
      setObjects(objectsData.filter((o) => {
        if (seen.has(o.id)) return false;
        seen.add(o.id);
        return true;
      }));
      setCategories(categoriesData);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadPublic = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setPublicObjectsLoading(true);
      setPublicObjects([]);
      const data = await fetchPublicObjectModels(workspaceId);
      const seen = new Set<string>();
      setPublicObjects(data.filter((o) => {
        if (seen.has(o.id)) return false;
        seen.add(o.id);
        return true;
      }));
    } catch (err) {
      setError(err as Error);
    } finally {
      setPublicObjectsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (workspaceId) {
      loadPublic();
    }
  }, [workspaceId, loadPublic]);

  const clone = useCallback(
    async (body: { sourceId: string; versionId: number; creatorId: string }) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required to clone an object');
      }
      const cloned = await cloneObject(workspaceId, body);
      await load();
      await loadPublic();
      return cloned;
    },
    [workspaceId, load, loadPublic]
  );

  const addShortcut = useCallback(
    async (objectId: string) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required to add an object shortcut');
      }
      await addObjectShortcut({ workspaceId, objectId });
      await load();
      await loadPublic();
    },
    [workspaceId, load, loadPublic]
  );

  const removeShortcut = useCallback(
    async (objectId: string) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required to remove an object shortcut');
      }
      await removeObjectShortcut({ workspaceId, objectId });
      await load();
      await loadPublic();
    },
    [workspaceId, load, loadPublic]
  );

  return {
    objects,
    categories,
    publicObjects,
    publicObjectsLoading,
    isLoading,
    error,
    refresh: load,
    refreshPublic: loadPublic,
    cloneObject: clone,
    addShortcut,
    removeShortcut,
  };
}