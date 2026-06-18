import { auth } from './firebaseConfig';
import { User } from 'firebase/auth';

const API_BASE_URL = 'http://localhost:5111';

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await auth.currentUser?.getIdToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}

export async function syncUserWithBackend(user: User): Promise<string | null> {
  const token = await user.getIdToken();
  const response = await fetch(`${API_BASE_URL}/api/User`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      username: user.displayName ?? user.email?.split('@')[0] ?? 'user',
      emailAddress: user.email ?? '',
      firebaseUid: user.uid,
      name: user.displayName?.split(' ')[0] ?? null,
      lastname: user.displayName?.split(' ').slice(1).join(' ') || null,
    }),
  });
  if (!response.ok && response.status !== 409) {
    throw new Error(`User sync failed: ${response.status}`);
  }
  try {
    const data = await response.json();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

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
  const response = await apiFetch('/api/Objects');
  if (!response.ok) {
    throw new Error(`Failed to fetch object models: ${response.status}`);
  }
  return response.json();
}

export async function fetchObjectVersion(objectId: string): Promise<ObjectVersion> {
  const response = await apiFetch(`/api/Objects/${objectId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch object version for ${objectId}: ${response.status}`);
  }
  return response.json();
}

export async function fetchAllCategories(): Promise<ObjectCategory[]> {
  const response = await apiFetch('/api/ObjectCategory');
  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.status}`);
  }
  return response.json();
}

export async function createObjectCategory(body: {
  categoryName: string;
  parentCategoryId?: string;
}): Promise<ObjectCategory> {
  const response = await apiFetch('/api/ObjectCategory', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to create object category: ${response.status}`);
  }
  return response.json();
}

export async function updateObjectCategory(
  id: string,
  body: { categoryName?: string; parentCategoryId?: string | null }
): Promise<void> {
  const response = await apiFetch(`/api/ObjectCategory/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to update object category ${id}: ${response.status}`);
  }
}

export async function deleteObjectCategory(id: string): Promise<void> {
  const response = await apiFetch(`/api/ObjectCategory/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to delete object category ${id}: ${response.status}`);
  }
}

export async function createObject(body: {
  name: string;
  creatorId: string;
  categoryId?: string;
}): Promise<ObjectModel> {
  const response = await apiFetch('/api/Objects', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to create object: ${response.status}`);
  }
  return response.json();
}

export async function renameObject(body: { id: string; name: string }): Promise<void> {
  const response = await apiFetch('/api/Objects/rename', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to rename object: ${response.status}`);
  }
}

export async function categorizeObject(body: {
  id: string;
  categoryId?: string | null;
}): Promise<void> {
  const response = await apiFetch('/api/Objects/categorize', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to categorize object: ${response.status}`);
  }
}

export async function deleteObject(id: string): Promise<void> {
  const response = await apiFetch(`/api/Objects/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to delete object ${id}: ${response.status}`);
  }
}

export async function createObjectVersion(
  objectId: string,
  body: {
    fileUrl: string;
    sizeX: number;
    sizeY: number;
    sizeZ: number;
    objectProperties?: string;
    creatorId: string;
  }
): Promise<ObjectVersion> {
  const response = await apiFetch(`/api/ObjectVersion/${objectId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    console.log('createObjectVersion 400 body:', JSON.stringify(body), 'response:', text);
    throw new Error(`Failed to create object version for ${objectId}: ${response.status}`);
  }
  return response.json();
}

export async function updateObjectVersion(
  objectId: string,
  version: number,
  body: {
    fileUrl?: string;
    sizeX?: number;
    sizeY?: number;
    sizeZ?: number;
    objectProperties?: string;
  }
): Promise<void> {
  const response = await apiFetch(`/api/ObjectVersion/${objectId}-${version}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to update version ${version} of object ${objectId}: ${response.status}`);
  }
}

export async function deleteObjectVersion(
  objectId: string,
  version: number
): Promise<void> {
  const response = await apiFetch(`/api/ObjectVersion/${objectId}-${version}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to delete version ${version} of object ${objectId}: ${response.status}`);
  }
}

// ── Material Types ──

export interface MaterialCategory {
  id: string;
  categoryName: string;
  parentCategoryId: string | null;
  parentCategory: MaterialCategory | null;
}

export interface MaterialMeta {
  id: string;
  name: string;
  createdAt: string;
  lastUpdate: string;
  lastVersion: number;
  creatorId: string;
  creator: unknown | null;
  categoryId: string | null;
  category: MaterialCategory | null;
}

export interface MaterialData {
  materialId: string;
  material: MaterialMeta | null;
  version: number;
  fileURL: string;
  scaleU: number;
  scaleV: number;
  materialProperties: string;
  creatorId: string;
  creator: unknown | null;
}

// ── Material Categories API ──

export async function fetchAllMaterialCategories(): Promise<MaterialCategory[]> {
  const response = await apiFetch('/api/MaterialCategories');
  if (!response.ok) {
    throw new Error(`Failed to fetch material categories: ${response.status}`);
  }
  return response.json();
}

export async function fetchMaterialCategory(id: string): Promise<MaterialCategory> {
  const response = await apiFetch(`/api/MaterialCategories/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch material category ${id}: ${response.status}`);
  }
  return response.json();
}

export async function createMaterialCategory(body: {
  categoryName: string;
  parentCategoryId?: string;
}): Promise<MaterialCategory> {
  const response = await apiFetch('/api/MaterialCategories', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to create material category: ${response.status}`);
  }
  return response.json();
}

export async function updateMaterialCategory(
  id: string,
  body: { categoryName?: string; parentCategoryId?: string | null }
): Promise<void> {
  const response = await apiFetch(`/api/MaterialCategories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to update material category ${id}: ${response.status}`);
  }
}

export async function deleteMaterialCategory(id: string): Promise<void> {
  const response = await apiFetch(`/api/MaterialCategories/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to delete material category ${id}: ${response.status}`);
  }
}

// ── Materials (Meta) API ──

export async function fetchAllMaterials(): Promise<MaterialMeta[]> {
  const response = await apiFetch('/api/Materials');
  if (!response.ok) {
    throw new Error(`Failed to fetch materials: ${response.status}`);
  }
  return response.json();
}

export async function fetchMaterial(id: string): Promise<MaterialMeta> {
  const response = await apiFetch(`/api/Materials/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch material ${id}: ${response.status}`);
  }
  return response.json();
}

export async function createMaterial(body: {
  name: string;
  creatorId: string;
  categoryId?: string;
}): Promise<MaterialMeta> {
  const response = await apiFetch('/api/Materials', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to create material: ${response.status}`);
  }
  return response.json();
}

export async function updateMaterial(
  id: string,
  body: { name?: string; categoryId?: string | null }
): Promise<void> {
  const response = await apiFetch(`/api/Materials/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to update material ${id}: ${response.status}`);
  }
}

export async function renameMaterial(body: { id: string; name: string }): Promise<void> {
  const response = await apiFetch('/api/Materials/rename', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to rename material: ${response.status}`);
  }
}

export async function categorizeMaterial(body: {
  id: string;
  categoryId?: string | null;
}): Promise<void> {
  const response = await apiFetch('/api/Materials/categorize', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to categorize material: ${response.status}`);
  }
}

export async function deleteMaterial(id: string): Promise<void> {
  const response = await apiFetch(`/api/Materials/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to delete material ${id}: ${response.status}`);
  }
}

// ── MaterialData API ──

export async function fetchMaterialVersions(
  materialId: string
): Promise<MaterialData[]> {
  const response = await apiFetch(`/api/MaterialData/${materialId}`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch versions for material ${materialId}: ${response.status}`
    );
  }
  return response.json();
}

export async function fetchMaterialVersion(
  materialId: string,
  version: number
): Promise<MaterialData> {
  const response = await apiFetch(`/api/MaterialData/${materialId}-${version}`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch version ${version} of material ${materialId}: ${response.status}`
    );
  }
  return response.json();
}

export async function createMaterialVersion(
  materialId: string,
  body: {
    fileURL: string;
    scaleU: number;
    scaleV: number;
    materialProperties?: string;
    creatorId: string;
  }
): Promise<MaterialData> {
  const response = await apiFetch(`/api/MaterialData/${materialId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to create material version for ${materialId}: ${response.status}`
    );
  }
  return response.json();
}

export async function updateMaterialVersion(
  materialId: string,
  version: number,
  body: {
    fileURL?: string;
    scaleU?: number;
    scaleV?: number;
    materialProperties?: string;
  }
): Promise<void> {
  const response = await apiFetch(`/api/MaterialData/${materialId}-${version}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to update version ${version} of material ${materialId}: ${response.status}`
    );
  }
}

export async function deleteMaterialVersion(
  materialId: string,
  version: number
): Promise<void> {
  const response = await apiFetch(`/api/MaterialData/${materialId}-${version}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(
      `Failed to delete version ${version} of material ${materialId}: ${response.status}`
    );
  }
}