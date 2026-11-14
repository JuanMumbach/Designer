# DesignerAPI — Endpoint Reference

## Connection

- **Base URL (dev):** `http://localhost:5111`
- **Swagger UI:** `http://localhost:5111/swagger`
- **Auth:** Firebase ID token as `Authorization: Bearer <token>` (JWT validated against `https://securetoken.google.com/{Firebase:ProjectId}`). All endpoints require an authenticated user except `POST /api/User` (user creation on first login). The caller is resolved by matching the token `sub` claim to `User.firebaseUid`; unknown users get `401`, insufficient permissions get `403`.
- **CORS:** Fully open (any origin/header/method)

## Conventions

- All IDs are GUIDs
- All routes follow `api/[controller]`
- Dates in ISO 8601 format
- Optional URL fields (`thumbnailURL`, `logoURL`, `profilePictureURL`) are nullable and are only overwritten when a non-empty value is sent — they cannot be cleared to `null` via update endpoints
- Navigation properties are omitted from responses by the authorization sanitizer (except `MaterialMeta.type` when loaded, and `ObjectVersion.variants` on version endpoints); resolve related entities by their foreign-key IDs (`creatorId`, `workspaceId`, `categoryId`, `typeId`, `appRoleId`)
- Standard status codes: `200 OK`, `201 Created`, `204 No Content`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`
- **Soft delete:** every `DELETE` marks the row as deleted (`isDeleted = true`, `deletedAt = now`) instead of removing it. Soft-deleted rows are hidden from all queries by a global filter and return `404`.

---

## Access — `api/access`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/access?workspaceId=` | — | Get the current user's summary and effective permissions (optionally for a workspace) |

**Access Response:**
```json
{
  "user": { "id": "guid", "username": "string", "firebaseUid": "string", "emailAddress": "string", "name": "string", "lastname": "string", "profilePictureURL": "string | null", "appRoleId": "guid" },
  "canDesign": "bool",
  "canManageResources": "bool",
  "canManageWorkspace": "bool",
  "canManageApplication": "bool",
  "manageableWorkspaceIds": ["guid"]
}
```

Without `workspaceId`, permissions are evaluated as `ResourceManager` (personal scope).

---

## User — `api/User`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/User` | — | List all users |
| GET | `/api/User/{id}` | — | Get user by ID |
| POST | `/api/User` | `{ username, emailAddress, firebaseUid?, name?, lastname?, profilePictureURL? }` | Create user |
| PUT | `/api/User/{id}` | `{ name?, lastname?, profilePictureURL? }` | Update user |
| PUT | `/api/User/{id}/app-role` | `{ appRoleId }` | Change a user's app role (app admins only) |
| DELETE | `/api/User/{id}` | — | Delete user |

Users may read/update only themselves; app admins may access any user. Only app admins can delete.

**User Entity:**
```json
{
  "id": "guid",
  "username": "string",
  "firebaseUid": "string",
  "emailAddress": "string",
  "name": "string",
  "lastname": "string",
  "profilePictureURL": "string | null",
  "appRoleId": "guid"
}
```

---

## AppRole — `api/AppRole`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/AppRole` | — | List all roles |
| GET | `/api/AppRole/{id}` | — | Get role by ID |
| POST | `/api/AppRole` | `{ name, description?, canManageApplication? }` | Create role |
| PUT | `/api/AppRole/{id}` | `{ name, description?, canManageApplication? }` | Update role |
| DELETE | `/api/AppRole/{id}` | — | Delete role |

All AppRole endpoints are restricted to app admins. `name` is max 16 chars. You cannot remove your own `canManageApplication` permission.

**AppRole Entity:**
```json
{
  "id": "guid",
  "name": "string",
  "description": "string",
  "canManageApplication": "bool"
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
| GET | `/api/Objects` | — | List all 3D models (all workspaces + personal) |
| GET | `/api/Objects/personal?creatorId=` | — | List personal (workspace-less) models owned by the creator |
| GET | `/api/Objects/meta/{id}` | — | Get model metadata only |
| GET | `/api/Objects/{id}/{versionId?}` | — | Get model version (omit versionId for latest) |
| GET | `/api/Objects/public?workspaceId=` | — | List community (public) models from other workspaces (incl. personal public models) |
| GET | `/api/Objects/catalog?workspaceId=` | — | List workspace catalog = natively-owned + externally-shortcut models |
| POST | `/api/Objects` | `{ name, creatorId, workspaceId?, isPublic?, categoryId? }` | Create model (omit workspaceId for a personal model) |
| POST | `/api/Objects/clone?workspaceId=` | `{ sourceId, versionId, creatorId }` | Clone an external model (copies specified version only) into the current workspace |
| POST | `/api/Objects/add-shortcut` | `{ workspaceId, objectId }` | Link an external model as a shortcut in a workspace (idempotent) |
| DELETE | `/api/Objects/shortcut` | `{ workspaceId, objectId }` | Remove an external model shortcut |
| PUT | `/api/Objects/{id}` | `{ name?, isPublic?, categoryId? }` | Update model |
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
  "workspaceId": "guid | null",
  "isPublic": "bool",
  "categoryId": "guid | null"
}
```

---

## ObjectVersion — `api/ObjectVersion`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/ObjectVersion` | — | List all object versions |
| GET | `/api/ObjectVersion/{modelId}` | — | List all versions of a model |
| GET | `/api/ObjectVersion/{modelId}-{version}` | — | Get specific version |
| POST | `/api/ObjectVersion/{modelId}` | `{ fileUrl, creatorId, sizeX?, sizeY?, sizeZ?, objectProperties?, thumbnailURL?, budgetEntries?, materialParts? }` | Create version (auto-increments version number) |
| PUT | `/api/ObjectVersion/{modelId}-{version}` | `{ fileUrl?, sizeX?, sizeY?, sizeZ?, objectProperties?, thumbnailURL?, budgetEntries?, materialParts? }` | Update version |
| DELETE | `/api/ObjectVersion/{modelId}-{version}` | — | Delete version |

**ObjectVersion Entity:**
```json
{
  "objectId": "guid",
  "version": "int",
  "fileURL": "string",
  "thumbnailURL": "string | null",
  "objectProperties": "string",
  "sizeX": "float",
  "sizeY": "float",
  "sizeZ": "float",
  "budgetEntries": ["ModelBudgetEntry"],
  "materialParts": ["ModelMaterialPart"],
  "variants": ["ObjectVariant"],
  "creatorId": "guid"
}
```

`variants` is included by the version GET endpoints and by `GET /api/Objects/{id}/{versionId?}`.

**ModelBudgetEntry** (max 100 per version, unique `id`):
```json
{ "id": "string (≤100)", "name": "string (≤200)", "basePrice": "decimal (0–1e9)", "materialSlot": "int (0–1000) | null" }
```

**ModelMaterialPart** (max 200 per version, unique `id`):
```json
{ "id": "string (≤100)", "name": "string (≤200)", "materialSlot": "int (0–1000)", "widthMm": "decimal (0–100000]", "heightMm": "decimal (0–100000]", "quantity": "int (1–1000, default 1)", "allowRotation": "bool (default true)" }
```

---

## ObjectVariants — `api/ObjectVariants`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/ObjectVariants/{objectId}/{version}` | — | List variants of an object version |
| GET | `/api/ObjectVariants/object/{objectId}` | — | List all variants of an object (all versions) |
| GET | `/api/ObjectVariants/{id}` | — | Get variant by ID |
| POST | `/api/ObjectVariants/{objectId}/{version}` | `{ name, mode, fileUrl, creatorId, variantProperties, thumbnailURL?, materialPartsDelta?, budgetEntriesDelta? }` | Create variant for an object version |
| PUT | `/api/ObjectVariants/{id}` | `{ name?, mode?, fileUrl?, thumbnailURL?, variantProperties?, materialPartsDelta?, budgetEntriesDelta? }` | Update variant |
| DELETE | `/api/ObjectVariants/{id}` | — | Delete variant |

Permissions follow the parent object. `mode` is `additive` (default) or `replace`. `variantProperties` must contain a `group:<name>` segment (≤64 chars). `name` ≤200 chars, `fileUrl` ≤2000 chars, each delta list ≤100 items. The parent version's `objectProperties` may reference default variants via `default-variants:<group>=<variantId>,...`; these IDs are remapped when an object is cloned (variants are cloned with the version).

**ObjectVariant Entity:**
```json
{
  "id": "guid",
  "objectId": "guid",
  "version": "int",
  "name": "string",
  "mode": "additive | replace",
  "fileURL": "string",
  "thumbnailURL": "string | null",
  "variantProperties": "string",
  "materialPartsDelta": {
    "add": ["ModelMaterialPart"],
    "replace": [{ "targetPartId": "string", "name?": "string", "materialSlot?": "int", "widthMm?": "decimal", "heightMm?": "decimal", "widthDeltaMm?": "decimal", "heightDeltaMm?": "decimal", "quantity?": "int", "quantityDelta?": "int", "allowRotation?": "bool" }],
    "remove": ["partId"]
  },
  "budgetEntriesDelta": {
    "add": ["ModelBudgetEntry"],
    "replace": [{ "targetEntryId": "string", "name?": "string", "basePrice?": "decimal", "basePriceDelta?": "decimal", "materialSlot?": "int", "clearMaterialSlot": "bool" }],
    "remove": ["entryId"]
  },
  "creatorId": "guid",
  "createdAt": "datetime",
  "lastUpdate": "datetime"
}
```

---

## Projects — `api/Projects`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/Projects` | — | List all projects |
| GET | `/api/Projects/personal?creatorId=` | — | List personal (workspace-less) projects owned by the creator |
| GET | `/api/Projects/{id}` | — | Get project |
| POST | `/api/Projects` | `{ name, workspaceId?, creatorId }` | Create project (omit workspaceId for a personal project) |
| PUT | `/api/Projects/{id}` | `{ name? }` | Update project |
| PUT | `/api/Projects/name` | `{ id, name }` | Rename project |
| DELETE | `/api/Projects/{id}` | — | Delete project |

**Project Entity:**
```json
{
  "id": "guid",
  "name": "string",
  "createdAt": "datetime",
  "lastUpdate": "datetime",
  "lastVersion": "int",
  "workspaceId": "guid | null",
  "creatorId": "guid"
}
```

---

## ProjectVersion — `api/ProjectVersion`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/ProjectVersion/{projectId}` | — | List all versions of a project |
| GET | `/api/ProjectVersion/{projectId}-{version}` | — | Get specific project version |
| POST | `/api/ProjectVersion/{projectId}` | `{ content, creatorId, description?, thumbnailURL? }` | Create version (auto-increments) |
| PUT | `/api/ProjectVersion/{projectId}-{version}` | `{ content?, description?, thumbnailURL? }` | Update version |
| DELETE | `/api/ProjectVersion/{projectId}-{version}` | — | Delete version |

**ProjectVersion Entity:**
```json
{
  "projectId": "guid",
  "version": "int",
  "fileURL": "string",
  "thumbnailURL": "string | null",
  "creatorId": "guid"
}
```

---

## Workspace — `api/Workspace`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/Workspace` | — | List all workspaces |
| GET | `/api/Workspace/{id}` | — | Get workspace |
| POST | `/api/Workspace` | `{ name, creatorId, logoURL? }` | Create workspace |
| PUT | `/api/Workspace/{id}` | `{ name?, logoURL? }` | Update workspace |
| DELETE | `/api/Workspace/{id}` | — | Delete workspace |

**Workspace Entity:**
```json
{
  "id": "guid",
  "name": "string",
  "logoURL": "string | null",
  "creatorId": "guid",
  "createdAt": "datetime",
  "lastUpdate": "datetime"
}
```

---

## WorkspaceMember — `api/WorkspaceMember`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/WorkspaceMember?workspaceId=` | — | List members of a workspace |
| GET | `/api/WorkspaceMember/{userId}-{workspaceId}` | — | Get member by composite key (userId + workspaceId) |
| POST | `/api/WorkspaceMember` | `{ userId, workspaceId, roleId }` | Add member to workspace |
| PUT | `/api/WorkspaceMember/{userId}-{workspaceId}` | `{ roleId }` | Update member's role |
| DELETE | `/api/WorkspaceMember/{userId}-{workspaceId}` | — | Remove member from workspace |

**WorkspaceMember DTO (read):**
```json
{
  "userId": "guid",
  "username": "string | null",
  "workspaceId": "guid",
  "roleId": "guid",
  "roleName": "string | null"
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
| POST | `/api/WorkspaceRole` | `{ name, description?, accessLevel }` | Create role |
| PUT | `/api/WorkspaceRole/{id}` | `{ name?, description?, accessLevel? }` | Update role |
| DELETE | `/api/WorkspaceRole/{id}` | — | Delete role |

Any authenticated user can read; only app admins can write. `name` is max 16 chars. `accessLevel`: `0 = Designer`, `1 = ResourceManager`, `2 = Administrator`. System roles (Designer `b7710000-…-0001`, Resource Manager `…-0002`, Administrator `…-0003`) are seeded.

**WorkspaceRole Entity:**
```json
{
  "id": "guid",
  "name": "string",
  "description": "string",
  "accessLevel": "int (0–2)"
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
| GET | `/api/Materials` | — | List all materials (all workspaces + personal) |
| GET | `/api/Materials/personal?creatorId=` | — | List personal (workspace-less) materials owned by the creator |
| GET | `/api/Materials/{id}` | — | Get material |
| GET | `/api/Materials/public?workspaceId=` | — | List community (public) materials from other workspaces (incl. personal public materials) |
| GET | `/api/Materials/catalog?workspaceId=` | — | List workspace catalog = natively-owned + externally-shortcut materials |
| POST | `/api/Materials` | `{ name, creatorId, workspaceId?, isPublic?, categoryId?, typeId? }` | Create material (omit workspaceId for a personal material) |
| POST | `/api/Materials/clone?workspaceId=` | `{ sourceId, versionId, creatorId }` | Clone an external material (copies specified version only) into the current workspace |
| POST | `/api/Materials/add-shortcut` | `{ workspaceId, materialId }` | Link an external material as a shortcut in a workspace (idempotent) |
| DELETE | `/api/Materials/shortcut` | `{ workspaceId, materialId }` | Remove an external material shortcut |
| PUT | `/api/Materials/{id}` | `{ name?, isPublic?, categoryId?, typeId? }` | Update material |
| PUT | `/api/Materials/rename` | `{ id, name }` | Rename material |
| PUT | `/api/Materials/categorize` | `{ id, categoryId? }` | Re-categorize material |
| PUT | `/api/Materials/categorize-type` | `{ id, typeId? }` | Link material to a material type |
| PUT | `/api/Materials/{id}/pricing` | `{ costMultiplier?, pricePerSquareMeter?, boardWidthMm?, boardHeightMm?, cutSpacingMm? }` | Update pricing (send `pricePerSquareMeter: null` to clear it) |
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
  "workspaceId": "guid | null",
  "isPublic": "bool",
  "categoryId": "guid | null",
  "typeId": "guid | null",
  "type": "MaterialType | null",
  "costMultiplier": "decimal (default 1)",
  "pricePerSquareMeter": "decimal | null (0–1e9)",
  "boardWidthMm": "decimal (≤100000)",
  "boardHeightMm": "decimal (≤100000)",
  "cutSpacingMm": "decimal (≤1000)"
}
```

Pricing fields can also be sent on `POST /api/Materials`. `lastVersion` is kept in sync automatically when a `MaterialData` version is created (and reconciled on startup).

---

## MaterialData — `api/MaterialData`

| Method | Endpoint | Body | Purpose |
|--------|----------|------|---------|
| GET | `/api/MaterialData` | — | List all material data versions |
| GET | `/api/MaterialData/{materialId}` | — | List all versions of a material |
| GET | `/api/MaterialData/{materialId}-{version}` | — | Get specific version |
| POST | `/api/MaterialData/{materialId}` | `{ fileURL, scaleU, scaleV, materialProperties?, creatorId, thumbnailURL? }` | Create version (auto-increments) |
| PUT | `/api/MaterialData/{materialId}-{version}` | `{ fileURL?, scaleU?, scaleV?, materialProperties?, thumbnailURL? }` | Update version |
| DELETE | `/api/MaterialData/{materialId}-{version}` | — | Delete version |

**MaterialData Entity:**
```json
{
  "materialId": "guid",
  "version": "int",
  "fileURL": "string",
  "thumbnailURL": "string | null",
  "scaleU": "float",
  "scaleV": "float",
  "materialProperties": "string",
  "creatorId": "guid"
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
| **Total controllers** | 17 |
| **Total endpoints** | 105 |
| **GET endpoints** | 42 |
| **POST endpoints** | 20 |
| **PUT endpoints** | 25 |
| **DELETE endpoints** | 18 |

---

## Notes

- **Authorization** is enforced globally by `PermissionFilter`. App admins (admin role or `canManageApplication`) can do everything. Workspace creators are workspace `Administrator`s. Reading workspace resources requires membership (or `isPublic`); writing Objects/ObjectVersion/ObjectVariants/ObjectMaterialTypes/Materials/MaterialData requires `ResourceManager`+; workspace and member management requires `Administrator`. Personal resources are only accessible to their creator. A `creatorId` in a write body must match the caller.
- **Repository pattern** fully implemented — controllers never access `DbContext` directly.
- **Base route prefix** is `api/` followed by the controller name.
- **Composite keys**: `ObjectVersion` uses `(ObjectId, Version)`, `ProjectVersion` uses `(ProjectId, Version)`, `MaterialData` uses `(MaterialId, Version)`, and `WorkspaceMember` uses `(UserId, WorkspaceId)`. Composite-key resources use `{part1}-{part2}` route segments.
- **Workspace scoping**: `public`, `catalog`, and `clone` endpoints take the current `workspaceId` as a **query string** parameter. `public` returns resources where `isPublic == true && (workspaceId != current || workspaceId IS NULL)`. `catalog` returns a union of the workspace's natively-owned resources **plus** resources linked via the `WorkspaceExternalObject` / `WorkspaceExternalMaterial` shortcut tables. `clone` deep-copies the single specified version (`sourceId` + `versionId`) into a new record owned by `workspaceId` (with `lastVersion = 1`).
- **Personal resources**: `Projects`, `Objects`, and `Materials` may be created without a `workspaceId` (omit it or send `Guid.Empty`); such rows have `workspaceId == null` and are scoped by `creatorId`. Query them via the `/personal?creatorId=` endpoints; they are backed by filtered indexes `IX_*_CreatorId_Personal` (WHERE `WorkspaceId IS NULL`). Personal public resources also appear in other workspaces' `/public` feeds. Workspace-based join tables (`WorkspaceExternalObject`, `WorkspaceExternalMaterial`, `WorkspaceMember`) and the workspace-owned FKs remain non-nullable.
- **Swagger** available at `/swagger` (Development only).
- **CORS** is fully permissive (`AllowAnyOrigin/Header/Method`).
- **Database**: SQL Server via Entity Framework Core 8.x