/**
 * Authentication Context
 * Manages user authentication state across the application
 */

'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { userService } from '@/lib/api/services';
import { User, UserProfile } from '@/types';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isReader: boolean;
  isAdmin: boolean;
  refreshUser: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile when Clerk user is loaded
  useEffect(() => {
    async function loadUserProfile() {
      if (!clerkLoaded) {
        setIsLoading(true);
        return;
      }

      if (isSignedIn && clerkUser) {
        try {
          // Sync user with backend
          await userService.getCurrentUser();
          
          // Fetch user profile
          const response = await userService.getCurrentUser();
          setUser(response.data);
        } catch (error) {
          console.error('Failed to load user profile:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }

      setIsLoading(false);
    }

    loadUserProfile();
  }, [clerkLoaded, isSignedIn, clerkUser]);

  const refreshUser = async () => {
    try {
      const response = await userService.getCurrentUser();
      setUser(response.data);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    try {
      const response = await userService.updateProfile(updates);
      setUser(response.data);
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: isSignedIn && !!user,
    isReader: user?.role === 'reader',
    isAdmin: user?.role === 'admin',
    refreshUser,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}