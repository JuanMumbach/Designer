import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { auth } from './firebaseConfig';
import { syncUserWithBackend } from './api';

interface AuthContextValue {
  user: User | null;
  backendUserId: string | null;
  isLoading: boolean;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
  selectedWorkspaceId: string | null;
  hasChosenWorkspace: boolean;
  selectWorkspace: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  backendUserId: null,
  isLoading: true,
  getToken: async () => null,
  signOut: async () => {},
  selectedWorkspaceId: null,
  hasChosenWorkspace: false,
  selectWorkspace: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [backendUserId, setBackendUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const syncedUidsRef = useRef<Set<string>>(new Set());
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null
  );
  const [hasChosenWorkspace, setHasChosenWorkspace] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setIsLoading(false);

      if (!firebaseUser) {
        setBackendUserId(null);
        setSelectedWorkspaceId(null);
        setHasChosenWorkspace(false);
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
    });

    return unsubscribe;
  }, []);

  const getToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  const selectWorkspace = (id: string | null) => {
    setSelectedWorkspaceId(id);
    setHasChosenWorkspace(true);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        backendUserId,
        isLoading,
        getToken,
        signOut,
        selectedWorkspaceId,
        hasChosenWorkspace,
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
