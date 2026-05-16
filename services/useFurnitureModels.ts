import { useEffect, useState } from 'react';
import { FurnitureProps, FurnitureType } from '../components/DesignScreen/3dView/DesignObjects';
import { fetchAllCategories, fetchAllObjectModels, fetchObjectVersion, ObjectModel, ObjectCategory } from './api';

function mapCategoryNameToFurnitureType(categoryName: string | undefined): FurnitureType {
  if (!categoryName) return FurnitureType.Counter;
  
  const normalized = categoryName.toLowerCase();
  if (normalized.includes('cupboard') || normalized.includes('alacena') || normalized.includes('upper')) {
    return FurnitureType.Cupboard;
  }
  return FurnitureType.Counter;
}

export function useFurnitureModels() {
  const [furnitureModels, setFurnitureModels] = useState<FurnitureProps[]>([]);
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

        const furniturePropsArray: FurnitureProps[] = [];

        for (const model of objectModels) {
          try {
            const version = await fetchObjectVersion(model.id);

            if (isMounted) {
              furniturePropsArray.push({
                id: model.id,
                name: model.name,
                type: mapCategoryNameToFurnitureType(model.category?.categoryName),
                modelUrl: version.fileURL,
                width: version.sizeX,
                height: version.sizeY,
                depth: version.sizeZ,
                categoryId: model.categoryId || undefined,
              });
            }
          } catch (versionError) {
            console.warn(`Failed to fetch version for model ${model.id}:`, versionError);
          }
        }

        if (isMounted) {
          setFurnitureModels(furniturePropsArray);
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

  return { furnitureModels, categories, isLoading, error };
}