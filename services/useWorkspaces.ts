import { useCallback, useEffect, useState } from 'react';
import { fetchAllWorkspaces, Workspace } from './api';
import { useAuth } from './AuthContext';

export function useWorkspaces() {
  const { backendUserId } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchAllWorkspaces();
      setWorkspaces(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const myWorkspaces = backendUserId
    ? workspaces.filter(
        (ws) =>
          ws.creatorId === backendUserId ||
          ws.members?.some((m) => m.userId === backendUserId)
      )
    : workspaces;

  return {
    workspaces,
    myWorkspaces,
    isLoading,
    error,
    refresh: load,
  };
}
