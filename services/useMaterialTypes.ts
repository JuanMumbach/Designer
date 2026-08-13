import { useCallback, useEffect, useState } from 'react';
import {
  fetchAllObjectMaterialTypes,
  fetchAllMaterialTypes,
  MaterialType,
  ObjectMaterialType,
} from './api';

export interface MaterialTypeUsage {
  slotCount: number;
}

export function useMaterialTypes() {
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([]);
  const [slots, setSlots] = useState<ObjectMaterialType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const usageByType = (typeId: string): MaterialTypeUsage => {
    return {
      slotCount: slots.filter((s) => s.materialTypeId === typeId).length,
    };
  };

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [typesData, slotsData] = await Promise.all([
        fetchAllMaterialTypes(),
        fetchAllObjectMaterialTypes(),
      ]);
      setMaterialTypes(typesData);
      setSlots(slotsData);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { materialTypes, slots, usageByType, isLoading, error, refresh: load };
}