# User permissions

Workspace permissions apply to the selected workspace. The API evaluates current database roles on every request; client navigation uses `/api/access` and refreshes on workspace changes, app focus, and once per minute.

| Workspace role | Design projects | Edit modules and materials | Manage workspace and member roles |
| --- | --- | --- | --- |
| Designer | Yes | No | No |
| Resource Manager | Yes | Yes | No |
| Workspace Admin | Yes | Yes | Yes |
| Workspace creator | Yes | Yes | Yes |

Designers can create and edit designs and read the catalog needed for those designs. Resource management screens are restricted. Personal resources belong to their creator and remain editable by that creator. A workspace role does not grant access to other workspaces.

App roles are independent of workspace roles. The built-in Admin role and custom app roles with `canManageApplication` can manage global users, app roles, shared workspace role definitions, categories, and material types. App administrators can also administer all workspaces. Standard app users receive workspace permissions through membership or ownership.

Workspace administrators assign existing workspace roles to members. Only app administrators create, edit, or delete shared role definitions because those definitions affect every workspace using them. Custom workspace roles explicitly select one of the three permission levels; changing a display name does not change permissions.

Built-in roles cannot be changed or deleted. Assigned roles cannot be deleted. A user cannot remove their own app administration access, and workspace creators retain administration access independently of membership.

## API setup

The API verifies Firebase bearer tokens against `Firebase:ProjectId`, configured for the existing `designer-models` Firebase project. Override it with `Firebase__ProjectId` in other environments. Signature, issuer, audience, and token lifetime are validated. User synchronization uses the verified Firebase UID and email and does not accept another user's identity.

In Development, the API accepts the configured HTTP origin directly so that bearer tokens survive requests from Expo. Redirecting from port 5111 to HTTPS port 7111 changes the origin and causes browsers to remove the Authorization header. HTTPS redirection remains enabled outside Development. Run the API through its Visual Studio launch profile; after changing API code, rebuild and restart that debug session.

Apply the API migration before running the updated app:

```powershell
dotnet ef database update --project DesignerAPI.csproj
```

The migration adds explicit permission fields and the three built-in workspace roles. Existing Admin/Administrator workspace roles retain administration access; recognized manager/editor roles retain resource access. Other existing roles default to Designer and can be updated by an app administrator. Configure the existing `AdminDefaultSettings` values to bootstrap an app administrator when needed.

Permission regression checks:

```powershell
dotnet test Tests/DesignerAPI.Tests.csproj
```
