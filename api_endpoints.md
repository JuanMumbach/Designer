# DesignerAPI — Endpoint Reference

## Connection

- **Base URL (dev):** `http://localhost:5111`
- **Swagger UI:** `http://localhost:5111/swagger`
- **Auth:** None currently implemented (no JWT, no API key — all endpoints are open)
- **CORS:** Fully open (any origin/header/method)

## Conventions

- All IDs are GUIDs
- All routes follow `api/[controller]`
- Dates in ISO 8601 format
- Navigation properties (related entities) are included in responses
- Standard status codes: `200 OK`, `201 Created`, `204 No Content`, `400 Bad Request`, `404 Not Found`

---

## User — `api/User`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/User` | — | List all users |
| GET | `/api/User/{id}` | — | Get user by ID |
| POST | `/api/User` | `{ username, emailAddress, firebaseUid?, name?, lastname? }` | Create user |
| PUT | `/api/User/{id}` | `{ name?, lastname? }` | Update user |
| DELETE | `/api/User/{id}` | — | Delete user |

**User Entity:**
```json
{
  "id": "guid",
  "username": "string",
  "firebaseUid": "string",
  "emailAddress": "string",
  "appRoleId": "guid",
  "appRole": "AppRole | null",
  "name": "string",
  "lastname": "string",
  "createdAt": "datetime",
  "lastUpdate": "datetime",
  "lastLogin": "datetime"
}
```

---

## AppRole — `api/AppRole`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/AppRole` | — | List all roles |
| GET | `/api/AppRole/{id}` | — | Get role by ID |
| POST | `/api/AppRole` | `{ name, description? }` | Create role |
| PUT | `/api/AppRole/{id}` | `{ name, description? }` | Update role |
| DELETE | `/api/AppRole/{id}` | — | Delete role |

**AppRole Entity:**
```json
{
  "id": "guid",
  "name": "string",
  "description": "string"
}
```

---

## ObjectCategory — `api/ObjectCategory`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/ObjectCategory` | — | List all categories |
| GET | `/api/ObjectCategory/{id}` | — | Get category |
| POST | `/api/ObjectCategory` | `{ categoryName, parentCategoryId? }` | Create category |
| PUT | `/api/ObjectCategory/{id}` | `{ categoryName?, parentCategoryId? }` | Update category |
| DELETE | `/api/ObjectCategory/{id}` | — | Delete category |

**ObjectCategory Entity:**
```json
{
  "id": "guid",
  "categoryName": "string",
  "parentCategoryId": "guid | null",
  "parentCategory": "ObjectCategory | null"
}
```

---

## Objects — `api/Objects`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/Objects` | — | List all 3D models |
| GET | `/api/Objects/meta/{id}` | — | Get model metadata only |
| GET | `/api/Objects/{id}/{versionId?}` | — | Get model version (omit versionId for latest) |
| POST | `/api/Objects` | `{ name, creatorId, categoryId? }` | Create model |
| PUT | `/api/Objects/{id}` | `{ name?, categoryId? }` | Update model |
| PUT | `/api/Objects/rename` | `{ id, name }` | Rename model |
| PUT | `/api/Objects/version` | `{ id, version }` | Set specific version number |
| PUT | `/api/Objects/categorize` | `{ id, categoryId? }` | Re-categorize model |
| DELETE | `/api/Objects/{id}` | — | Delete model |

**ObjectModel Entity:**
```json
{
  "id": "guid",
  "name": "string",
  "createdAt": "datetime",
  "lastUpdate": "datetime",
  "lastVersion": "int",
  "creatorId": "guid",
  "creator": "User | null",
  "categoryId": "guid | null",
  "category": "ObjectCategory | null",
  "materialTypes": ["ObjectMaterialType"]
}
```

---

## ObjectVersion — `api/ObjectVersion`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/ObjectVersion` | — | List all object versions |
| GET | `/api/ObjectVersion/{modelId}` | — | List all versions of a model |
| GET | `/api/ObjectVersion/{modelId}-{version}` | — | Get specific version |
| POST | `/api/ObjectVersion/{modelId}` | `{ content, creatorId, description? }` | Create version (auto-increments version number) |
| PUT | `/api/ObjectVersion/{modelId}-{version}` | `{ content?, description? }` | Update version |
| DELETE | `/api/ObjectVersion/{modelId}-{version}` | — | Delete version |

**ObjectVersion Entity:**
```json
{
  "objectId": "guid",
  "object": "ObjectModel | null",
  "version": "int",
  "fileURL": "string",
  "objectProperties": "string",
  "sizeX": "float",
  "sizeY": "float",
  "sizeZ": "float",
  "creatorId": "guid",
  "creator": "User | null"
}
```

---

## Projects — `api/Projects`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/Projects` | — | List all projects |
| GET | `/api/Projects/{id}` | — | Get project |
| POST | `/api/Projects` | `{ name, workspaceId, creatorId }` | Create project |
| PUT | `/api/Projects/{id}` | `{ name? }` | Update project |
| PUT | `/api/Projects/name` | `{ id, name }` | Rename project |
| DELETE | `/api/Projects/{id}` | — | Delete project |

**Project Entity:**
```json
{
  "id": "guid",
  "name": "string",
  "workspaceId": "guid",
  "workspace": "Workspace | null",
  "creatorId": "guid",
  "creator": "User | null"
}
```

---

## ProjectVersion — `api/ProjectVersion`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/ProjectVersion/{projectId}` | — | List all versions of a project |
| GET | `/api/ProjectVersion/{projectId}-{version}` | — | Get specific project version |
| POST | `/api/ProjectVersion/{projectId}` | `{ content, creatorId, description? }` | Create version (auto-increments) |
| PUT | `/api/ProjectVersion/{projectId}-{version}` | `{ content?, description? }` | Update version |
| DELETE | `/api/ProjectVersion/{projectId}-{version}` | — | Delete version |

**ProjectVersion Entity:**
```json
{
  "projectId": "guid",
  "project": "Project | null",
  "version": "int",
  "fileURL": "string",
  "creatorId": "guid",
  "creator": "User | null"
}
```

---

## Workspace — `api/Workspace`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/Workspace` | — | List all workspaces |
| GET | `/api/Workspace/{id}` | — | Get workspace |
| POST | `/api/Workspace` | `{ name, creatorId }` | Create workspace |
| POST | `/api/Workspace/User` | `{ userId, workspaceId, roleId }` | Subscribe user to workspace |
| PUT | `/api/Workspace/{id}` | `{ name? }` | Update workspace |
| DELETE | `/api/Workspace/{id}` | — | Delete workspace |
| DELETE | `/api/Workspace/User` | `{ userId, workspaceId }` | Unsubscribe user from workspace |

**Workspace Entity:**
```json
{
  "id": "guid",
  "name": "string",
  "creatorId": "guid",
  "creator": "User | null",
  "createdAt": "datetime",
  "lastUpdate": "datetime",
  "projects": ["Project"],
  "members": ["WorkspaceMember"]
}
```

**WorkspaceMember Entity:**
```json
{
  "userId": "guid",
  "user": "User | null",
  "workspaceId": "guid",
  "workspace": "Workspace | null",
  "roleId": "guid",
  "role": "WorkspaceRole | null"
}
```

---

## WorkspaceRole — `api/WorkspaceRole`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/WorkspaceRole` | — | List all workspace roles |
| GET | `/api/WorkspaceRole/{id}` | — | Get role |
| POST | `/api/WorkspaceRole` | `{ name, description? }` | Create role |
| PUT | `/api/WorkspaceRole/{id}` | `{ name?, description? }` | Update role |
| DELETE | `/api/WorkspaceRole/{id}` | — | Delete role |

**WorkspaceRole Entity:**
```json
{
  "id": "guid",
  "name": "string",
  "description": "string"
}
```

---

---

## MaterialCategories — `api/MaterialCategories`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/MaterialCategories` | — | List all material categories |
| GET | `/api/MaterialCategories/{id}` | — | Get category |
| POST | `/api/MaterialCategories` | `{ categoryName, parentCategoryId? }` | Create category |
| PUT | `/api/MaterialCategories/{id}` | `{ categoryName?, parentCategoryId? }` | Update category |
| DELETE | `/api/MaterialCategories/{id}` | — | Delete category |

**MaterialCategory Entity:**
```json
{
  "id": "guid",
  "categoryName": "string",
  "parentCategoryId": "guid | null",
  "parentCategory": "MaterialCategory | null"
}
```

---

## Materials — `api/Materials`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/Materials` | — | List all materials |
| GET | `/api/Materials/{id}` | — | Get material |
| POST | `/api/Materials` | `{ name, creatorId, categoryId? }` | Create material |
| PUT | `/api/Materials/{id}` | `{ name?, categoryId? }` | Update material |
| PUT | `/api/Materials/rename` | `{ id, name }` | Rename material |
| PUT | `/api/Materials/categorize` | `{ id, categoryId? }` | Re-categorize material |
| PUT | `/api/Materials/categorize-type` | `{ id, typeId? }` | Link material to a material type |
| DELETE | `/api/Materials/{id}` | — | Delete material |

**MaterialMeta Entity:**
```json
{
  "id": "guid",
  "name": "string",
  "createdAt": "datetime",
  "lastUpdate": "datetime",
  "lastVersion": "int",
  "creatorId": "guid",
  "creator": "User | null",
  "categoryId": "guid | null",
  "category": "MaterialCategory | null",
  "typeId": "guid | null",
  "type": "MaterialType | null"
}
```

---

## MaterialData — `api/MaterialData`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/MaterialData` | — | List all material data versions |
| GET | `/api/MaterialData/{materialId}` | — | List all versions of a material |
| GET | `/api/MaterialData/{materialId}-{version}` | — | Get specific version |
| POST | `/api/MaterialData/{materialId}` | `{ fileURL, scaleU, scaleV, materialProperties?, creatorId }` | Create version (auto-increments) |
| PUT | `/api/MaterialData/{materialId}-{version}` | `{ fileURL?, scaleU?, scaleV?, materialProperties? }` | Update version |
| DELETE | `/api/MaterialData/{materialId}-{version}` | — | Delete version |

**MaterialData Entity:**
```json
{
  "materialId": "guid",
  "material": "MaterialMeta | null",
  "version": "int",
  "fileURL": "string",
  "scaleU": "float",
  "scaleV": "float",
  "materialProperties": "string",
  "creatorId": "guid",
  "creator": "User | null"
}
```

---

## MaterialTypes — `api/MaterialTypes`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/MaterialTypes` | — | List all material types |
| GET | `/api/MaterialTypes/{id}` | — | Get material type |
| POST | `/api/MaterialTypes` | `{ name, description? }` | Create material type |
| PUT | `/api/MaterialTypes/{id}` | `{ name?, description? }` | Update material type |
| DELETE | `/api/MaterialTypes/{id}` | — | Delete material type |

**MaterialType Entity (DTO):**
```json
{
  "id": "guid",
  "name": "string",
  "description": "string | null"
}
```

---

## ObjectMaterialTypes — `api/ObjectMaterialTypes`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/ObjectMaterialTypes` | — | List all material types |
| GET | `/api/ObjectMaterialTypes/{objectModelId}/{version}` | — | List all material types for an object version |
| GET | `/api/ObjectMaterialTypes/{objectModelId}/{version}/{slot}` | — | Get material type |
| POST | `/api/ObjectMaterialTypes` | `{ objectModelId, version, slot, materialTypeId, displayName }` | Create material type |
| PUT | `/api/ObjectMaterialTypes/{objectModelId}/{version}/{slot}` | `{ materialTypeId?, displayName? }` | Update material type |
| DELETE | `/api/ObjectMaterialTypes/{objectModelId}/{version}/{slot}` | — | Delete material type |

**ObjectMaterialType Entity (read DTO):**
```json
{
  "objectModelId": "guid",
  "objectModelName": "string | null",
  "version": "int",
  "slot": "int",
  "materialTypeId": "guid",
  "materialTypeName": "string | null",
  "displayName": "string"
}
```

---

## Summary

| Metric | Count |
|--------|-------|
| **Total controllers** | 14 |
| **Total endpoints** | 83 |
| **GET endpoints** | 32 |
| **POST endpoints** | 15 |
| **PUT endpoints** | 21 |
| **DELETE endpoints** | 15 |

---

## Notes

- **No authentication/authorization** is currently enforced at any endpoint.
- **Repository pattern** fully implemented — controllers never access `DbContext` directly.
- **Base route prefix** is `api/` followed by the controller name.
- **Composite keys**: `ObjectVersion` uses `(ObjectId, Version)`, `ProjectVersion` uses `(ProjectId, Version)`, and `MaterialData` uses `(MaterialId, Version)`.
- **Swagger** available at `/swagger` (Development only).
- **CORS** is fully permissive (`AllowAnyOrigin/Header/Method`).
- **Database**: SQL Server via Entity Framework Core 8.x