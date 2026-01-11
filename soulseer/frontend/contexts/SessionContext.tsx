/**
 * Session Context
 * Manages reading session state across the application
 */

'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { sessionService } from '@/lib/api/services';
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

  const refreshActiveSession = async () => {
    try {
      setIsLoading(true);
      const response = await sessionService.getActiveSession();
      const session = response.data.session;

      if (session) {
        setActiveSession(session);
        setAgoraCredentials(response.data.agora);
      } else {
        setActiveSession(null);
        setAgoraCredentials(null);
      }
    } catch (error) {
      console.error('Failed to refresh active session:', error);
      setActiveSession(null);
      setAgoraCredentials(null);
    } finally {
      setIsLoading(false);
    }
  };

  const startSession = async (readerId: number, sessionType: SessionType) => {
    try {
      setIsLoading(true);
      const response = await sessionService.startSession(readerId, sessionType);
      
      setActiveSession(response.data.session);
      setAgoraCredentials(response.data.agora);
    } catch (error) {
      console.error('Failed to start session:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const endSession = async (durationMinutes: number) => {
    try {
      setIsLoading(true);
      await sessionService.endSession(activeSession!.id, durationMinutes);
      
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
      setIsLoading(true);
      await sessionService.cancelSession(activeSession!.id, reason);
      
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
    // Refresh active session periodically
    const interval = setInterval(() => {
      if (activeSession) {
        refreshActiveSession();
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [activeSession]);

  useEffect(() => {
    refreshActiveSession();
  }, []);

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