import { User } from 'firebase/auth';
import { auth } from './firebaseConfig';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:5111';

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

export interface AccessPermissions {
  user: BackendUser;
  canDesign: boolean;
  canManageResources: boolean;
  canManageWorkspace: boolean;
  canManageApplication: boolean;
  manageableWorkspaceIds: string[];
}

export async function fetchAccess(workspaceId: string | null): Promise<AccessPermissions> {
  const response = await apiFetch(`/api/access${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''}`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('La API no tiene disponible el servicio de permisos. Reinicia la API con la versión actualizada.');
    }
    if (response.status === 401) {
      throw new Error('La sesión no pudo validarse. Vuelve a iniciar sesión.');
    }
    throw new Error(`No se pudieron cargar los permisos (HTTP ${response.status}).`);
  }
  return response.json();
}

export interface AppRole {
  id: string;
  name: string;
  description: string | null;
  canManageApplication: boolean;
}

export async function fetchObjectCatalog(workspaceId: string | undefined, creatorId: string): Promise<ObjectModel[]> {
  const response = await apiFetch(workspaceId
    ? `/api/Objects/catalog?workspaceId=${encodeURIComponent(workspaceId)}`
    : `/api/Objects/personal?creatorId=${encodeURIComponent(creatorId)}`);
  if (!response.ok) throw new Error('No se pudo cargar el catálogo de módulos.');
  return response.json();
}

export async function fetchMaterialCatalog(workspaceId: string | undefined, creatorId: string): Promise<MaterialMeta[]> {
  const response = await apiFetch(workspaceId
    ? `/api/Materials/catalog?workspaceId=${encodeURIComponent(workspaceId)}`
    : `/api/Materials/personal?creatorId=${encodeURIComponent(creatorId)}`);
  if (!response.ok) throw new Error('No se pudo cargar el catálogo de materiales.');
  return response.json();
}

export async function fetchAppRoles(): Promise<AppRole[]> {
  const response = await apiFetch('/api/AppRole');
  if (!response.ok) throw new Error('No se pudieron cargar los roles.');
  return response.json();
}

export async function saveRole(
  scope: 'AppRole' | 'WorkspaceRole',
  role: { id?: string; name: string; description?: string | null; canManageApplication?: boolean; accessLevel?: WorkspaceAccessLevel }
): Promise<void> {
  const response = await apiFetch(`/api/${scope}${role.id ? `/${role.id}` : ''}`, {
    method: role.id ? 'PUT' : 'POST',
    body: JSON.stringify(role),
  });
  if (!response.ok) throw new Error('No se pudo guardar el rol.');
}

export async function removeRole(scope: 'AppRole' | 'WorkspaceRole', id: string): Promise<void> {
  const response = await apiFetch(`/api/${scope}/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('No se pudo eliminar el rol. Puede estar en uso.');
}

export async function changeUserAppRole(id: string, appRoleId: string): Promise<void> {
  const response = await apiFetch(`/api/User/${id}/app-role`, {
    method: 'PUT', body: JSON.stringify({ appRoleId }),
  });
  if (!response.ok) throw new Error('No se pudo asignar el rol.');
}

export interface BackendUser {
  id: string;
  username: string;
  firebaseUid: string;
  appRoleId: string;
  emailAddress: string;
  name?: string | null;
  lastname?: string | null;
  profilePictureURL?: string | null;
}

export async function fetchAllUsers(): Promise<BackendUser[]> {
  const response = await apiFetch('/api/User');
  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.status}`);
  }
  return response.json();
}

export async function fetchUser(id: string): Promise<BackendUser> {
  const response = await apiFetch(`/api/User/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch user ${id}: ${response.status}`);
  }
  return response.json();
}

export async function updateUser(
  id: string,
  body: { name?: string; lastname?: string; profilePictureURL?: string }
): Promise<void> {
  const response = await apiFetch(`/api/User/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to update user ${id}: ${response.status}`);
  }
}

export async function syncUserWithBackend(user: User): Promise<string | null> {
  const token = await user.getIdToken();
  const firstName = user.displayName?.split(' ')[0];
  const lastName = user.displayName?.split(' ').slice(1).join(' ');
  const body: Record<string, string> = {
    username: (user.displayName ?? user.email?.split('@')[0] ?? 'user').slice(0, 16),
    emailAddress: user.email ?? '',
    firebaseUid: user.uid,
  };

  if (firstName) body.name = firstName;
  if (lastName) body.lastname = lastName;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/User`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`No se pudo conectar con la API en ${API_BASE_URL}. Comprueba que esté ejecutándose y que la conexión sea válida.`);
  }
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('La API no pudo validar tu sesión (HTTP 401). Comprueba la configuración de Firebase y vuelve a iniciar sesión.');
    }
    if (response.status === 403) {
      throw new Error('La identidad de la cuenta no coincide con la sesión de Firebase (HTTP 403).');
    }
    throw new Error(`No se pudo sincronizar la cuenta con la API (HTTP ${response.status}).`);
  }
  const data: { id?: string } = await response.json();
  if (!data.id) throw new Error('La API no devolvió un identificador de usuario válido.');
  return data.id;
}

export interface ObjectModel {
  workspaceId?: string | null;
  id: string;
  name: string;
  createdAt: string;
  lastUpdate: string;
  lastVersion: number;
  creatorId: string;
  creator: unknown | null;
  categoryId: string | null;
  category: ObjectCategory | null;
  isPublic: boolean;
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
  materialParts?: import('./materialParts').MaterialPart[];
  budgetEntries?: import('./budget').ModelBudgetEntry[];
  objectId: string;
  object: unknown | null;
  version: number;
  fileURL: string;
  thumbnailURL?: string | null;
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

export async function fetchPublicObjectModels(workspaceId: string): Promise<ObjectModel[]> {
  const response = await apiFetch(`/api/Objects/public?workspaceId=${encodeURIComponent(workspaceId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch public object models: ${response.status}`);
  }
  return response.json();
}

export async function cloneObject(
  workspaceId: string,
  body: { sourceId: string; versionId: number; creatorId: string }
): Promise<ObjectModel> {
  const response = await apiFetch(`/api/Objects/clone?workspaceId=${encodeURIComponent(workspaceId)}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to clone object: ${response.status}`);
  }
  return response.json();
}

export async function addObjectShortcut(body: {
  workspaceId: string;
  objectId: string;
}): Promise<void> {
  const response = await apiFetch('/api/Objects/add-shortcut', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to add object shortcut: ${response.status}`);
  }
}

export async function removeObjectShortcut(body: {
  workspaceId: string;
  objectId: string;
}): Promise<void> {
  const response = await apiFetch('/api/Objects/shortcut', {
    method: 'DELETE',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to remove object shortcut: ${response.status}`);
  }
}

export async function fetchObjectVersion(objectId: string, version?: number): Promise<ObjectVersion> {
  const response = await apiFetch(version === undefined ? `/api/Objects/${objectId}` : `/api/ObjectVersion/${objectId}-${version}`);
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
  workspaceId?: string | null;
  isPublic?: boolean;
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

export async function updateObject(
  id: string,
  body: { name?: string; isPublic?: boolean; categoryId?: string | null }
): Promise<void> {
  const response = await apiFetch(`/api/Objects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to update object ${id}: ${response.status}`);
  }
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
    fileURL: string;
    sizeX: number;
    sizeY: number;
    sizeZ: number;
    objectProperties?: string;
    creatorId: string;
    budgetEntries?: import('./budget').ModelBudgetEntry[];
    materialParts?: import('./materialParts').MaterialPart[];
    thumbnailURL?: string;
  }
): Promise<ObjectVersion> {
  const response = await apiFetch(`/api/ObjectVersion/${objectId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to create object version for ${objectId}: ${response.status}`);
  }
  return response.json();
}

export async function updateObjectVersion(
  objectId: string,
  version: number,
  body: {
    fileUrl?: string;
    thumbnailURL?: string;
    sizeX?: number;
    sizeY?: number;
    sizeZ?: number;
    objectProperties?: string;
    budgetEntries?: import('./budget').ModelBudgetEntry[];
    materialParts?: import('./materialParts').MaterialPart[];
  }
): Promise<void> {
  const response = await apiFetch(`/api/ObjectVersion/${objectId}-${version}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to update object version ${objectId}-${version}: ${response.status}`
    );
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
  pricePerSquareMeter?: number | null;
  boardWidthMm?: number;
  boardHeightMm?: number;
  cutSpacingMm?: number;
  costMultiplier?: number;
  workspaceId?: string | null;
  id: string;
  name: string;
  createdAt: string;
  lastUpdate: string;
  lastVersion: number;
  creatorId: string;
  creator: unknown | null;
  categoryId: string | null;
  category: MaterialCategory | null;
  typeId: string | null;
  type: MaterialType | null;
  isPublic: boolean;
}

export interface MaterialData {
  materialId: string;
  material: MaterialMeta | null;
  version: number;
  fileURL: string;
  thumbnailURL?: string | null;
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

export async function fetchPublicMaterials(workspaceId: string): Promise<MaterialMeta[]> {
  const response = await apiFetch(`/api/Materials/public?workspaceId=${encodeURIComponent(workspaceId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch public materials: ${response.status}`);
  }
  return response.json();
}

export async function cloneMaterial(
  workspaceId: string,
  body: { sourceId: string; versionId: number; creatorId: string }
): Promise<MaterialMeta> {
  const response = await apiFetch(`/api/Materials/clone?workspaceId=${encodeURIComponent(workspaceId)}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to clone material: ${response.status}`);
  }
  return response.json();
}

export async function addMaterialShortcut(body: {
  workspaceId: string;
  materialId: string;
}): Promise<void> {
  const response = await apiFetch('/api/Materials/add-shortcut', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to add material shortcut: ${response.status}`);
  }
}

export async function removeMaterialShortcut(body: {
  workspaceId: string;
  materialId: string;
}): Promise<void> {
  const response = await apiFetch('/api/Materials/shortcut', {
    method: 'DELETE',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to remove material shortcut: ${response.status}`);
  }
}

export async function createMaterial(body: {
  pricePerSquareMeter?: number | null;
  boardWidthMm?: number;
  boardHeightMm?: number;
  cutSpacingMm?: number;
  costMultiplier?: number;
  workspaceId?: string | null;
  isPublic?: boolean;
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

export async function updateMaterialPricing(id: string, pricing: number | { costMultiplier?: number; pricePerSquareMeter?: number | null; boardWidthMm?: number; boardHeightMm?: number; cutSpacingMm?: number }): Promise<void> {
  const response = await apiFetch(`/api/Materials/${id}/pricing`, {
    method: 'PUT',
    body: JSON.stringify(typeof pricing === 'number' ? { costMultiplier: pricing } : pricing),
  });
  if (!response.ok) throw new Error(`Failed to update material pricing: ${response.status}`);
}

export async function updateMaterial(
  id: string,
  body: {
    name?: string;
    isPublic?: boolean;
    categoryId?: string | null;
    typeId?: string | null;
  }
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

export async function categorizeMaterialType(body: {
  id: string;
  typeId?: string | null;
}): Promise<void> {
  const response = await apiFetch('/api/Materials/categorize-type', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to categorize material type: ${response.status}`);
  }
}

export async function deleteMaterial(id: string): Promise<void> {
  const response = await apiFetch(`/api/Materials/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to delete material ${id}: ${response.status}`);
  }
}

// ── MaterialData API ──

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
    thumbnailURL?: string;
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

// ── Material Types API ──

export interface MaterialType {
  id: string;
  name: string;
  description: string | null;
}

export async function fetchAllMaterialTypes(): Promise<MaterialType[]> {
  const response = await apiFetch('/api/MaterialTypes');
  if (!response.ok) {
    throw new Error(`Failed to fetch material types: ${response.status}`);
  }
  return response.json();
}

export async function createMaterialType(body: {
  name: string;
  description?: string;
}): Promise<MaterialType> {
  const response = await apiFetch('/api/MaterialTypes', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to create material type: ${response.status}`);
  }
  return response.json();
}

export async function updateMaterialType(
  id: string,
  body: { name?: string; description?: string | null }
): Promise<void> {
  const response = await apiFetch(`/api/MaterialTypes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to update material type ${id}: ${response.status}`);
  }
}

export async function deleteMaterialType(id: string): Promise<void> {
  const response = await apiFetch(`/api/MaterialTypes/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const error = new Error(`Failed to delete material type ${id}: ${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
}

// ── ObjectMaterialTypes API ──

export interface ObjectMaterialType {
  objectModelId: string;
  objectModelName: string | null;
  version: number;
  slot: number;
  materialTypeId: string;
  materialTypeName: string | null;
  displayName: string;
}

export async function fetchAllObjectMaterialTypes(): Promise<ObjectMaterialType[]> {
  const response = await apiFetch('/api/ObjectMaterialTypes');
  if (!response.ok) {
    throw new Error(`Failed to fetch object material types: ${response.status}`);
  }
  return response.json();
}

export async function fetchModelMaterialTypes(
  objectModelId: string,
  version: number
): Promise<ObjectMaterialType[]> {
  const response = await apiFetch(`/api/ObjectMaterialTypes/${objectModelId}/${version}`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch material types for model ${objectModelId} version ${version}: ${response.status}`
    );
  }
  return response.json();
}

export async function createObjectMaterialType(body: {
  objectModelId: string;
  version: number;
  slot: number;
  materialTypeId: string;
  displayName: string;
}): Promise<ObjectMaterialType> {
  const response = await apiFetch('/api/ObjectMaterialTypes', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to create object material type: ${response.status}`);
  }
  return response.json();
}

export async function updateObjectMaterialType(
  objectModelId: string,
  version: number,
  slot: number,
  body: { materialTypeId?: string; displayName?: string }
): Promise<void> {
  const response = await apiFetch(
    `/api/ObjectMaterialTypes/${objectModelId}/${version}/${slot}`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to update object material type: ${response.status}`);
  }
}

export async function deleteObjectMaterialType(
  objectModelId: string,
  version: number,
  slot: number
): Promise<void> {
  const response = await apiFetch(
    `/api/ObjectMaterialTypes/${objectModelId}/${version}/${slot}`,
    { method: 'DELETE' }
  );
  if (!response.ok) {
    throw new Error(`Failed to delete object material type: ${response.status}`);
  }
}

// ── Workspaces API ──

export interface Workspace {
  id: string;
  name: string;
  logoURL?: string | null;
  creatorId: string;
  creator: unknown | null;
  createdAt: string;
  lastUpdate: string;
  projects?: Project[] | null;
  members?: WorkspaceMember[] | null;
}

export async function fetchAllWorkspaces(): Promise<Workspace[]> {
  const response = await apiFetch('/api/Workspace');
  if (!response.ok) {
    throw new Error(`Failed to fetch workspaces: ${response.status}`);
  }
  return response.json();
}

export async function createWorkspace(body: {
  name: string;
  creatorId: string;
  logoURL?: string;
}): Promise<Workspace> {
  const response = await apiFetch('/api/Workspace', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to create workspace: ${response.status}`);
  }
  return response.json();
}

export async function updateWorkspace(
  id: string,
  body: { name?: string; logoURL?: string }
): Promise<void> {
  const response = await apiFetch(`/api/Workspace/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to update workspace ${id}: ${response.status}`);
  }
}

// ── Workspace Members API ──

export interface WorkspaceMember {
  userId: string;
  username: string | null;
  workspaceId: string;
  roleId: string;
  roleName: string | null;
}

export async function fetchWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const response = await apiFetch(
    `/api/WorkspaceMember?workspaceId=${encodeURIComponent(workspaceId)}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch workspace members: ${response.status}`);
  }
  return response.json();
}

export async function fetchWorkspaceMember(
  userId: string,
  workspaceId: string
): Promise<WorkspaceMember> {
  const response = await apiFetch(`/api/WorkspaceMember/${userId}-${workspaceId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch workspace member: ${response.status}`);
  }
  return response.json();
}

export async function addWorkspaceMember(body: {
  userId: string;
  workspaceId: string;
  roleId: string;
}): Promise<WorkspaceMember> {
  const response = await apiFetch('/api/WorkspaceMember', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to add workspace member: ${response.status}`);
  }
  return response.json();
}

export async function updateWorkspaceMember(
  userId: string,
  workspaceId: string,
  body: { roleId: string }
): Promise<void> {
  const response = await apiFetch(`/api/WorkspaceMember/${userId}-${workspaceId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to update workspace member: ${response.status}`);
  }
}

export async function removeWorkspaceMember(
  userId: string,
  workspaceId: string
): Promise<void> {
  const response = await apiFetch(`/api/WorkspaceMember/${userId}-${workspaceId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to remove workspace member: ${response.status}`);
  }
}

// ── Workspace Roles API ──

export enum WorkspaceAccessLevel {
  Designer,
  ResourceManager,
  Administrator,
}

export interface WorkspaceRole {
  accessLevel: WorkspaceAccessLevel;
  id: string;
  name: string;
  description: string;
}

export async function fetchAllWorkspaceRoles(): Promise<WorkspaceRole[]> {
  const response = await apiFetch('/api/WorkspaceRole');
  if (!response.ok) {
    throw new Error(`Failed to fetch workspace roles: ${response.status}`);
  }
  return response.json();
}

export async function createWorkspaceRole(body: {
  accessLevel?: WorkspaceAccessLevel;
  name: string;
  description?: string;
}): Promise<WorkspaceRole> {
  const response = await apiFetch('/api/WorkspaceRole', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to create workspace role: ${response.status}`);
  }
  return response.json();
}

export async function updateWorkspaceRole(
  id: string,
  body: { name?: string; description?: string | null }
): Promise<void> {
  const response = await apiFetch(`/api/WorkspaceRole/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to update workspace role ${id}: ${response.status}`);
  }
}

export async function deleteWorkspaceRole(id: string): Promise<void> {
  const response = await apiFetch(`/api/WorkspaceRole/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new Error(`Failed to delete workspace role ${id}: ${response.status}`);
  }
}

// ── Projects API ──

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  lastUpdate: string;
  lastVersion: number;
  workspaceId: string | null;
  workspace: Workspace | null;
  creatorId: string;
  creator: unknown | null;
}

export interface ProjectVersion {
  projectId: string;
  project: Project | null;
  version: number;
  fileURL: string;
  thumbnailURL?: string | null;
  creatorId: string;
  creator: unknown | null;
  createdAt?: string;
}

export async function fetchAllProjects(): Promise<Project[]> {
  const response = await apiFetch('/api/Projects');
  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.status}`);
  }
  return response.json();
}

export async function fetchProject(id: string): Promise<Project> {
  const response = await apiFetch(`/api/Projects/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch project ${id}: ${response.status}`);
  }
  return response.json();
}

export async function renameProject(body: { id: string; name: string }): Promise<void> {
  const response = await apiFetch('/api/Projects/name', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to rename project: ${response.status}`);
  }
}

export async function createProject(body: {
  name: string;
  workspaceId?: string;
  creatorId: string;
}): Promise<Project> {
  const response = await apiFetch('/api/Projects', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to create project: ${response.status}`);
  }
  return response.json();
}

export async function fetchProjectVersions(projectId: string): Promise<ProjectVersion[]> {
  const response = await apiFetch(`/api/ProjectVersion/${projectId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch project versions for ${projectId}: ${response.status}`);
  }
  return response.json();
}

export async function fetchProjectVersion(
  projectId: string,
  version: number
): Promise<ProjectVersion> {
  const response = await apiFetch(`/api/ProjectVersion/${projectId}-${version}`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch version ${version} of project ${projectId}: ${response.status}`
    );
  }
  return response.json();
}

export async function createProjectVersion(
  projectId: string,
  body: {
    content: string;
    creatorId: string;
    description?: string;
    thumbnailURL?: string;
  }
): Promise<ProjectVersion> {
  const response = await apiFetch(`/api/ProjectVersion/${projectId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Failed to create project version for ${projectId}: ${response.status}`);
  }
  return response.json();
}
