import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { auth } from './firebaseConfig';
import { syncUserWithBackend } from './api';

const workspaceStorageKey = (uid: string) => `@design:lastWorkspaceId:${uid}`;

const readPersistedWorkspace = async (
  uid: string
): Promise<string | null | undefined> => {
  try {
    const raw = await AsyncStorage.getItem(workspaceStorageKey(uid));
    if (raw === null) return undefined;
    return JSON.parse(raw) as string | null;
  } catch {
    return undefined;
  }
};

const persistWorkspace = (uid: string, id: string | null) => {
  AsyncStorage.setItem(workspaceStorageKey(uid), JSON.stringify(id)).catch(
    () => {}
  );
};

interface AuthContextValue {
  user: User | null;
  backendUserId: string | null;
  isLoading: boolean;
  isWorkspaceReady: boolean;
  error: string | null;
  retry: () => void;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
  selectedWorkspaceId: string | null;
  selectWorkspace: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  backendUserId: null,
  isLoading: true,
  isWorkspaceReady: false,
  error: null,
  retry: () => {},
  getToken: async () => null,
  signOut: async () => {},
  selectedWorkspaceId: null,
  selectWorkspace: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [backendUserId, setBackendUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const authRevision = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null
  );
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const requestRevision = ++authRevision.current;
      setUser(firebaseUser);
      setBackendUserId(null);
      setIsWorkspaceReady(false);
      setError(null);
      setIsLoading(!!firebaseUser);
      if (!firebaseUser) {
        setSelectedWorkspaceId(null);
        return;
      }
      try {
        const id = await syncUserWithBackend(firebaseUser);
        const persisted = await readPersistedWorkspace(firebaseUser.uid);
        if (!active || requestRevision !== authRevision.current) return;
        if (!id) throw new Error('No se pudo sincronizar la cuenta.');
        setBackendUserId(id);
        setSelectedWorkspaceId(persisted ?? null);
        setIsWorkspaceReady(true);
      } catch (error) {
        if (active && requestRevision === authRevision.current) {
          setError(error instanceof Error ? error.message : 'No se pudo sincronizar la cuenta con el servidor.');
        }
      } finally {
        if (active && requestRevision === authRevision.current) setIsLoading(false);
      }
    });

    return () => { active = false; unsubscribe(); };
  }, [revision]);

  const getToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const selectWorkspace = useCallback((id: string | null) => {
    setSelectedWorkspaceId(id);
    const uid = auth.currentUser?.uid;
    if (uid) {
      persistWorkspace(uid, id);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        backendUserId,
        isLoading,
        isWorkspaceReady,
        error,
        retry: () => setRevision((value) => value + 1),
        getToken,
        signOut,
        selectedWorkspaceId,
        selectWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
