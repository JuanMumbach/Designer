import { useCallback, useEffect, useState } from 'react';
import {
  fetchAllObjectModels,
  fetchAllCategories,
  ObjectModel,
  ObjectCategory,
} from './api';

export function useObjects() {
  const [objects, setObjects] = useState<ObjectModel[]>([]);
  const [categories, setCategories] = useState<ObjectCategory[]>([]);
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

  useEffect(() => {
    load();
  }, [load]);

  return { objects, categories, isLoading, error, refresh: load };
}
