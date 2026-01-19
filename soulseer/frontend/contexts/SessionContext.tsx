/**
 * Session Context
 * Manages reading session state across the application
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SessionWithDetails, SessionType, AgoraCredentials } from '@/types';

interface SessionContextType {
  activeSession: SessionWithDetails | null;
  isInSession: boolean;
  isLoading: boolean;
  agoraCredentials: AgoraCredentials | null;
  startSession: (readerId: number, sessionType: SessionType) => Promise<void>;
  endSession: (durationMinutes: number) => Promise<void>;
  cancelSession: (reason?: string) => Promise<void>;
  refreshActiveSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSession] = useState<SessionWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [agoraCredentials, setAgoraCredentials] = useState<AgoraCredentials | null>(null);

  const getToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  };

  const getApiUrl = () => {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  };

  const refreshActiveSession = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) {
        setActiveSession(null);
        setAgoraCredentials(null);
        return;
      }

      setIsLoading(true);
      const response = await fetch(`${getApiUrl()}/api/sessions/active`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.session) {
          setActiveSession(data.session);
          setAgoraCredentials(data.agora || null);
        } else {
          setActiveSession(null);
          setAgoraCredentials(null);
        }
      }
    } catch (error) {
      console.error('Failed to refresh active session:', error);
      setActiveSession(null);
      setAgoraCredentials(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startSession = async (readerId: number, sessionType: SessionType) => {
    try {
      const token = getToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      setIsLoading(true);
      const response = await fetch(`${getApiUrl()}/api/sessions/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ readerId, sessionType }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start session');
      }

      const data = await response.json();
      setActiveSession(data.session);
      setAgoraCredentials(data.agora || null);
    } catch (error) {
      console.error('Failed to start session:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const endSession = async (durationMinutes: number) => {
    try {
      const token = getToken();
      if (!token || !activeSession) {
        throw new Error('No active session');
      }

      setIsLoading(true);
      const response = await fetch(`${getApiUrl()}/api/sessions/${activeSession.id}/end`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ durationMinutes }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to end session');
      }

      setActiveSession(null);
      setAgoraCredentials(null);
    } catch (error) {
      console.error('Failed to end session:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const cancelSession = async (reason?: string) => {
    try {
      const token = getToken();
      if (!token || !activeSession) {
        throw new Error('No active session');
      }

      setIsLoading(true);
      const response = await fetch(`${getApiUrl()}/api/sessions/${activeSession.id}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to cancel session');
      }

      setActiveSession(null);
      setAgoraCredentials(null);
    } catch (error) {
      console.error('Failed to cancel session:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      refreshActiveSession();
    }
  }, [refreshActiveSession]);

  // Refresh active session periodically when in session
  useEffect(() => {
    if (!activeSession) return;

    const interval = setInterval(() => {
      refreshActiveSession();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [activeSession, refreshActiveSession]);

  const value: SessionContextType = {
    activeSession,
    isInSession: !!activeSession && activeSession.status === 'active',
    isLoading,
    agoraCredentials,
    startSession,
    endSession,
    cancelSession,
    refreshActiveSession,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}