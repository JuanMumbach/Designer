import { useCallback, useEffect, useState } from 'react';
import {
  fetchAllMaterialCategories,
  fetchAllMaterials,
  MaterialCategory,
  MaterialMeta,
} from './api';

export function useMaterials() {
  const [materials, setMaterials] = useState<MaterialMeta[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
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

  useEffect(() => {
    load();
  }, [load]);

  return { materials, categories, isLoading, error, refresh: load };
}
