import { useCallback, useEffect, useState } from 'react';
import { fetchModelMaterialTypes, ObjectMaterialType } from './api';

export function useModelMaterialTypes(objectModelId: string | null, version: number | null) {
  const [materialTypes, setMaterialTypes] = useState<ObjectMaterialType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!objectModelId || version == null) {
      setMaterialTypes([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchModelMaterialTypes(objectModelId, version);
      setMaterialTypes(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [objectModelId, version]);

  useEffect(() => {
    load();
  }, [load]);

  return { materialTypes, isLoading, error, refresh: load };
}
