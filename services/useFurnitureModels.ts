import { useEffect, useState } from 'react';
import { ObjectTemplate } from '../components/DesignScreen/3dView/DesignObjects';
import { fetchAllCategories, fetchAllObjectModels, fetchObjectVersion, ObjectModel, ObjectCategory, ObjectProperties } from './api';

function parseObjectProperties(raw: unknown): ObjectProperties | undefined {
  if (!raw) return undefined;

  if (typeof raw !== 'string') {
    const obj = raw as Record<string, unknown>;
    const behaviour = (
      obj.movingBehaviour ??
      obj['moving-behavior']
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

export function useObjectTemplates() {
  const [objectTemplates, setObjectTemplates] = useState<ObjectTemplate[]>([]);
  const [categories, setCategories] = useState<ObjectCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadModels = async () => {
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

        if (isMounted) {
          setCategories(categoriesData);
        }

        const templatesArray: ObjectTemplate[] = [];

        for (const model of objectModels) {
          try {
            const version = await fetchObjectVersion(model.id);

            if (isMounted) {
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
            }
          } catch (versionError) {
            console.warn(`Failed to fetch version for model ${model.id}:`, versionError);
          }
        }

        if (isMounted) {
          setObjectTemplates(templatesArray);
        }
      } catch (err) {
        if (isMounted) {
          setError(err as Error);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadModels();

    return () => {
      isMounted = false;
    };
  }, []);

  return { objectTemplates, categories, isLoading, error };
}
