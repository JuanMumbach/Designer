const API_BASE_URL = 'http://localhost:5111';

export interface ObjectModel {
  id: string;
  name: string;
  createdAt: string;
  lastUpdate: string;
  lastVersion: number;
  creatorId: string;
  creator: unknown | null;
  categoryId: string | null;
  category: ObjectCategory | null;
}

export interface ObjectCategory {
  id: string;
  categoryName: string;
  parentCategoryId: string | null;
  parentCategory: unknown | null;
}
export interface ObjectProperties {
  movingBehaviour?: 'counter' | 'cupboard' | 'free';
  height?: number;
}

export interface ObjectVersion {
  objectId: string;
  object: unknown | null;
  version: number;
  fileURL: string;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  creatorId: string;
  creator: unknown | null;
  objectProperties?: ObjectProperties;
}

export async function fetchAllObjectModels(): Promise<ObjectModel[]> {
  const response = await fetch(`${API_BASE_URL}/api/Objects`);
  if (!response.ok) {
    throw new Error(`Failed to fetch object models: ${response.status}`);
  }
  return response.json();
}

export async function fetchObjectVersion(objectId: string): Promise<ObjectVersion> {
  const response = await fetch(`${API_BASE_URL}/api/Objects/${objectId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch object version for ${objectId}: ${response.status}`);
  }
  return response.json();
}

export async function fetchAllCategories(): Promise<ObjectCategory[]> {
  const response = await fetch(`${API_BASE_URL}/api/ObjectCategory`);
  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.status}`);
  }
  return response.json();
}