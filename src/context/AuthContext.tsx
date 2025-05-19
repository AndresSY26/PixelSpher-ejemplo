
"use client";

import type { User, UserPreferences } from '@/types';
import { DEFAULT_USER_PREFERENCES } from '@/types';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { addActiveSession, removeActiveSession, getUserPreferences as fetchUserPreferencesServer } from '@/app/actions/settingsActions';
import { parseUserAgent } from '@/lib/utils';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userData: User) => void;
  logout: () => void;
  updateUserInContext: (updatedUserData: Partial<User>) => void;
  getCurrentSessionId: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const USER_STORAGE_KEY = 'pixelSphereUser';
const SESSION_ID_STORAGE_KEY = 'pixelSphereCurrentSessionId';
const LAST_VISITED_PATH_KEY = 'lastVisitedPath_pixelsphere';


export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedUserString = localStorage.getItem(USER_STORAGE_KEY);
      if (storedUserString) {
        let parsedUser: User = JSON.parse(storedUserString);

        const defaultPrefs = { ...DEFAULT_USER_PREFERENCES };
        let serverPrefs = defaultPrefs;
        try {
            serverPrefs = await fetchUserPreferencesServer(parsedUser.id);
        } catch (prefError) {
            console.warn("Could not fetch user preferences on auth check, using local/defaults.", prefError);
        }
        // Merge: default < server < local (parsedUser.preferences might be outdated from another session)
        parsedUser.preferences = { ...defaultPrefs, ...serverPrefs, ...(parsedUser.preferences || {}) };


        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(parsedUser));
        setUser(parsedUser);

        const storedSessionId = localStorage.getItem(SESSION_ID_STORAGE_KEY);
        if (!storedSessionId && parsedUser) {
          console.warn("User data found without session ID. Clearing for re-login.");
          // Consider if logout is needed here if session ID is critical and missing
        }
      } else {
        setUser(null);
        localStorage.removeItem(SESSION_ID_STORAGE_KEY);
      }
    } catch (error) {
      console.error("Error reading auth status from localStorage:", error);
      setUser(null);
      localStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(SESSION_ID_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading) {
      const isAuthPage = pathname === '/login' || pathname === '/';
      if (!user && !isAuthPage) {
        router.push('/login');
      } else if (user && (pathname === '/login' || pathname === '/')) {
        const userPreferences = user.preferences || DEFAULT_USER_PREFERENCES;
        if (userPreferences.rememberLastSection) {
          const lastPath = localStorage.getItem(LAST_VISITED_PATH_KEY);
          if (lastPath && lastPath !== '/login' && lastPath !== '/') {
            router.push(lastPath);
            return;
          }
        }
        router.push('/gallery');
      }
    }
  }, [user, isLoading, router, pathname]);


  const login = async (userData: User) => {
    let userWithPrefs = { ...userData };
    try {
        const prefs = await fetchUserPreferencesServer(userData.id);
        userWithPrefs.preferences = { ...DEFAULT_USER_PREFERENCES, ...prefs };
    } catch (prefError) {
        console.warn("Could not fetch user preferences on login, using defaults.", prefError);
        userWithPrefs.preferences = { ...DEFAULT_USER_PREFERENCES };
    }

    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userWithPrefs));
    setUser(userWithPrefs);

    try {
      const deviceInfo = parseUserAgent(navigator.userAgent);
      const sessionResult = await addActiveSession(userData.id, deviceInfo);
      if (sessionResult.sessionId) {
        localStorage.setItem(SESSION_ID_STORAGE_KEY, sessionResult.sessionId);
      } else {
        console.error("Failed to create active session or get session ID.");
      }
    } catch (error) {
      console.error("Error creating active session:", error);
    }

    const userPreferences = userWithPrefs.preferences || DEFAULT_USER_PREFERENCES;
    if (userPreferences.rememberLastSection) {
      const lastPath = localStorage.getItem(LAST_VISITED_PATH_KEY);
      if (lastPath && lastPath !== '/login' && lastPath !== '/') {
        router.push(lastPath);
        return;
      }
    }
    router.push('/gallery');
  };

  const logout = async () => {
    const currentSessionId = localStorage.getItem(SESSION_ID_STORAGE_KEY);
    if (currentSessionId) {
      try {
        await removeActiveSession(currentSessionId);
      } catch (error) {
        console.error("Error removing active session from server:", error);
      }
    }
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(SESSION_ID_STORAGE_KEY);
    setUser(null);
    router.push('/login');
  };

  const getCurrentSessionId = (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SESSION_ID_STORAGE_KEY);
    }
    return null;
  };

 const updateUserInContext = (updatedUserData: Partial<User>) => {
    setUser(prevUser => {
      if (prevUser) {
        const newPreferences = updatedUserData.preferences
          ? { ...(prevUser.preferences || DEFAULT_USER_PREFERENCES), ...updatedUserData.preferences }
          : (prevUser.preferences || { ...DEFAULT_USER_PREFERENCES });

        const newUser = {
            ...prevUser,
            ...updatedUserData,
            preferences: newPreferences
        };
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
        return newUser;
      }
      return null;
    });
  };


  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, updateUserInContext, getCurrentSessionId }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
