import React, { createContext, useContext, useEffect, useState } from 'react';
import * as api from '@/lib/api';

type User = {
  id: string;
  email: string;
  username: string;
} | null;

type AuthContextType = {
  user: User;
  isLoading: boolean;
  displayName: string;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  displayName: '',
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  updateDisplayName: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');

  // On app launch, check if we have a stored token and validate it
  useEffect(() => {
    async function restore() {
      try {
        const token = await api.getStoredToken();
        if (token) {
          // Try to validate the token by calling /api/auth/me
          const profile = await api.getMe();
          if (profile) {
            setUser(profile);
            // Load saved display name, fall back to username
            const saved = await api.getDisplayName();
            setDisplayName(saved || profile.username || '');
          } else {
            // Token is invalid/expired, clear it
            await api.removeToken();
          }
        }
      } catch {
        // Token expired or network error, clear it
        await api.removeToken();
      } finally {
        setIsLoading(false);
      }
    }
    restore();
  }, []);

  const login = async (email: string, password: string) => {
    const result = await api.login(email, password);
    setUser(result.user);
    // Load saved display name, fall back to username
    const saved = await api.getDisplayName();
    setDisplayName(saved || result.user?.username || '');
  };

  const signup = async (email: string, username: string, password: string) => {
    const result = await api.signup(email, username, password);
    setUser(result.user);
    const initialName = result.user?.username || username;
    await api.saveDisplayName(initialName); // persist so it survives logout/re-login
    setDisplayName(initialName);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setDisplayName('');
  };

  const updateDisplayName = async (name: string) => {
    const trimmed = name.trim();
    await api.saveDisplayName(trimmed);
    setDisplayName(trimmed);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, displayName, login, signup, logout, updateDisplayName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
