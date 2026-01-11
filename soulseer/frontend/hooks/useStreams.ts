/**
 * useStreams Hook
 * Custom hook for fetching and managing live stream data
 */

'use client';

import { useState, useEffect } from 'react';
import { streamService } from '@/lib/api/services';
import { LiveStream } from '@/types';

export function useStreams(filters?: {
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);

  const fetchStreams = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await streamService.getAllStreams(filters);
      
      setStreams(response.data);
      setTotal(response.pagination.total);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch streams:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStreams();
  }, [JSON.stringify(filters)]);

  return {
    streams,
    isLoading,
    error,
    total,
    refetch: fetchStreams,
  };
}

export function useLiveStreams(limit?: number) {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLiveStreams = async () => {
    try {
      setIsLoading(true);
      const response = await streamService.getLiveStreams({ limit });
      setStreams(response.data);
    } catch (error) {
      console.error('Failed to fetch live streams:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveStreams();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchLiveStreams, 30000);
    return () => clearInterval(interval);
  }, [limit]);

  return { streams, isLoading, refetch: fetchLiveStreams };
}

export function useStream(streamId: number) {
  const [stream, setStream] = useState<LiveStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchStream() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await streamService.getStreamById(streamId);
        setStream(response.data);
      } catch (err) {
        setError(err as Error);
        console.error('Failed to fetch stream:', err);
      } finally {
        setIsLoading(false);
      }
    }

    if (streamId) {
      fetchStream();
    }
  }, [streamId]);

  return { stream, isLoading, error };
}