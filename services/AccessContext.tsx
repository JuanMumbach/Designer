import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { AccessPermissions, fetchAccess } from './api';
import { useAuth } from './AuthContext';

const denied = {
  canDesign: false,
  canManageResources: false,
  canManageWorkspace: false,
  canManageApplication: false,
  manageableWorkspaceIds: [] as string[],
};

const AccessContext = createContext({
  ...denied, isLoading: true, error: null as string | null, refresh: () => {},
});

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const { user, backendUserId, selectedWorkspaceId, isWorkspaceReady, selectWorkspace } = useAuth();
  const scope = `${user?.uid}:${backendUserId}:${selectedWorkspaceId}`;
  const [result, setResult] = useState<{ scope: string; permissions: AccessPermissions | null; error: string | null } | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    if (!user || !backendUserId || !isWorkspaceReady) return;
    fetchAccess(selectedWorkspaceId).then((permissions) => {
      if (active && selectedWorkspaceId && !permissions.canDesign) {
        selectWorkspace(null);
        return;
      }
      if (active) setResult({ scope, permissions, error: null });
    }).catch((error: Error) => {
      if (active) setResult({ scope, permissions: null, error: error.message });
    });
    return () => { active = false; };
  }, [user, backendUserId, selectedWorkspaceId, isWorkspaceReady, scope, revision, selectWorkspace]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const timer = setInterval(refresh, 60000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [refresh]);

  const current = result?.scope === scope ? result : null;
  return (
    <AccessContext.Provider value={{
      ...(current?.permissions ?? denied),
      isLoading: !!user && (!backendUserId || !current),
      error: current?.error ?? null,
      refresh,
    }}>
      {children}
    </AccessContext.Provider>
  );
}

export function useAccess() {
  return useContext(AccessContext);
}
