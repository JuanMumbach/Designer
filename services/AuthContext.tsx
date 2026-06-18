import React, { createContext, useContext, useEffect, useState } from 'react';
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
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  backendUserId: null,
  isLoading: true,
  getToken: async () => null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [backendUserId, setBackendUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [syncedUids, setSyncedUids] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setIsLoading(false);

      if (firebaseUser && !syncedUids.has(firebaseUser.uid)) {
        setSyncedUids((prev) => new Set(prev).add(firebaseUser.uid));
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

  return (
      <AuthContext.Provider value={{ user, backendUserId, isLoading, getToken, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
