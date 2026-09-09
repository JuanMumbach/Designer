import { useCallback, useEffect, useState } from 'react';
import {
  addMaterialShortcut,
  cloneMaterial,
  fetchAllMaterialCategories,
  fetchAllMaterials,
  fetchPublicMaterials,
  removeMaterialShortcut,
  MaterialCategory,
  MaterialMeta,
} from './api';

export function useMaterials(workspaceId?: string) {
  const [materials, setMaterials] = useState<MaterialMeta[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [publicMaterials, setPublicMaterials] = useState<MaterialMeta[]>([]);
  const [publicMaterialsLoading, setPublicMaterialsLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [materialsData, categoriesData] = await Promise.all([
        fetchAllMaterials(),
        fetchAllMaterialCategories(),
      ]);

      const seen = new Set<string>();
      setMaterials(materialsData.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
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
      setPublicMaterialsLoading(true);
      setPublicMaterials([]);
      const data = await fetchPublicMaterials(workspaceId);
      const seen = new Set<string>();
      setPublicMaterials(data.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      }));
    } catch (err) {
      setError(err as Error);
    } finally {
      setPublicMaterialsLoading(false);
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
        throw new Error('Workspace ID is required to clone a material');
      }
      const cloned = await cloneMaterial(workspaceId, body);
      await load();
      await loadPublic();
      return cloned;
    },
    [workspaceId, load, loadPublic]
  );

  const addShortcut = useCallback(
    async (materialId: string) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required to add a material shortcut');
      }
      await addMaterialShortcut({ workspaceId, materialId });
      await load();
      await loadPublic();
    },
    [workspaceId, load, loadPublic]
  );

  const removeShortcut = useCallback(
    async (materialId: string) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required to remove a material shortcut');
      }
      await removeMaterialShortcut({ workspaceId, materialId });
      await load();
      await loadPublic();
    },
    [workspaceId, load, loadPublic]
  );

  return {
    materials,
    categories,
    publicMaterials,
    publicMaterialsLoading,
    isLoading,
    error,
    refresh: load,
    refreshPublic: loadPublic,
    cloneMaterial: clone,
    addShortcut,
    removeShortcut,
  };
}