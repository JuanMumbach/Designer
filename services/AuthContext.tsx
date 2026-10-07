import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  getToken: async () => null,
  signOut: async () => {},
  selectedWorkspaceId: null,
  selectWorkspace: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [backendUserId, setBackendUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const syncedUidsRef = useRef<Set<string>>(new Set());
  const restoredUidsRef = useRef<Set<string>>(new Set());
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null
  );
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setIsLoading(false);

      if (!firebaseUser) {
        setBackendUserId(null);
        setSelectedWorkspaceId(null);
        setIsWorkspaceReady(false);
        return;
      }

      if (!syncedUidsRef.current.has(firebaseUser.uid)) {
        syncedUidsRef.current.add(firebaseUser.uid);
        try {
          const id = await syncUserWithBackend(firebaseUser);
          if (id) {
            setBackendUserId(id);
          }
        } catch {
        }
      }

      if (!restoredUidsRef.current.has(firebaseUser.uid)) {
        restoredUidsRef.current.add(firebaseUser.uid);
        const persisted = await readPersistedWorkspace(firebaseUser.uid);
        if (persisted !== undefined) {
          setSelectedWorkspaceId(persisted);
        } else {
          setSelectedWorkspaceId(null);
          persistWorkspace(firebaseUser.uid, null);
        }
        setIsWorkspaceReady(true);
      } else {
        setIsWorkspaceReady(true);
      }
    });

    return unsubscribe;
  }, []);

  const getToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  };

  const signOut = async () => {
    const uid = auth.currentUser?.uid;
    await firebaseSignOut(auth);
    if (uid) {
      restoredUidsRef.current.delete(uid);
      syncedUidsRef.current.delete(uid);
    }
  };

  const selectWorkspace = (id: string | null) => {
    setSelectedWorkspaceId(id);
    const uid = auth.currentUser?.uid;
    if (uid) {
      persistWorkspace(uid, id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        backendUserId,
        isLoading,
        isWorkspaceReady,
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
