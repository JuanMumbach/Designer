import { useCallback, useEffect, useState } from 'react';
import { fetchAllWorkspaces, Workspace } from './api';


export function useWorkspaces() {
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

  const myWorkspaces = workspaces;

  return {
    workspaces,
    myWorkspaces,
    isLoading,
    error,
    refresh: load,
  };
}
