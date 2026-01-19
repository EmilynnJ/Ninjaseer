/**
 * Authentication Context
 * Manages user authentication state across the application
 */

'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '@/types';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isReader: boolean;
  isAdmin: boolean;
  refreshUser: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile on mount
  useEffect(() => {
    async function loadUserProfile() {
      try {
        // Check if we have a token
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        
        if (!token) {
          setUser(null);
          setIsLoading(false);
          return;
        }

        // Fetch user profile from API
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/users/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user || data);
        } else {
          setUser(null);
          // Clear invalid token
          localStorage.removeItem('token');
        }
      } catch (error) {
        console.error('Failed to load user profile:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadUserProfile();
  }, []);

  const refreshUser = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      
      if (!token) {
        setUser(null);
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user || data);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/users/me`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user || data);
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
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