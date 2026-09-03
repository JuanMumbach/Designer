import { useCallback, useEffect, useState } from 'react';
import { ObjectTemplate } from '../components/DesignScreen/3dView/DesignObjects';
import {
  addObjectShortcut,
  cloneObject,
  fetchAllCategories,
  fetchAllObjectModels,
  fetchObjectVersion,
  fetchPublicObjectModels,
  removeObjectShortcut,
  ObjectCategory,
  ObjectModel,
  ObjectProperties,
} from './api';

function parseObjectProperties(raw: unknown): ObjectProperties | undefined {
  if (!raw) return undefined;

  if (typeof raw !== 'string') {
    const obj = raw as Record<string, unknown>;
    const behaviour = (
      obj.movingBehaviour ??
      obj['moving-behaviour']
    ) as string | undefined;
    const h = obj.height as number | undefined;

    if (behaviour || h !== undefined) {
      const result: ObjectProperties = {};
      if (behaviour) {
        result.movingBehaviour = behaviour.toLowerCase() as 'counter' | 'cupboard' | 'free';
      }
      if (h !== undefined) {
        result.height = h;
      }
      return result;
    }
    return undefined;
  }

  const result: ObjectProperties = {};
  const segments = raw.split(';');
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;
    const key = trimmed.slice(0, colonIndex).trim().toLowerCase();
    const value = trimmed.slice(colonIndex + 1).trim();
    if (key === 'moving-behavior') {
      result.movingBehaviour = value.toLowerCase() as 'counter' | 'cupboard' | 'free';
    } else if (key === 'height') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) result.height = parsed;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function useObjectTemplates(workspaceId?: string) {
  const [objectTemplates, setObjectTemplates] = useState<ObjectTemplate[]>([]);
  const [categories, setCategories] = useState<ObjectCategory[]>([]);
  const [publicObjects, setPublicObjects] = useState<ObjectModel[]>([]);
  const [publicObjectsLoading, setPublicObjectsLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const objectModels: ObjectModel[] = await fetchAllObjectModels();

      let categoriesData: ObjectCategory[] = [];
      try {
        categoriesData = await fetchAllCategories();
      } catch (catErr) {
        console.warn('Failed to fetch categories:', catErr);
      }

      setCategories(categoriesData);

      const templatesArray: ObjectTemplate[] = [];

      for (const model of objectModels) {
        try {
          const version = await fetchObjectVersion(model.id);

          templatesArray.push({
            id: model.id,
            version: version.version,
            name: model.name,
            modelUrl: version.fileURL,
            width: version.sizeX,
            height: version.sizeY,
            depth: version.sizeZ,
            categoryId: model.categoryId || undefined,
            objectProperties: parseObjectProperties(version.objectProperties),
          });
        } catch (versionError) {
          console.warn(`Failed to fetch version for model ${model.id}:`, versionError);
        }
      }

      setObjectTemplates(templatesArray);
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
    objectTemplates,
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