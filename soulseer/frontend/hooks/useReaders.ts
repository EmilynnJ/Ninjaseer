/**
 * useReaders Hook
 * Custom hook for fetching and managing reader data
 */

'use client';

import { useState, useEffect } from 'react';
import { readerService } from '@/lib/api/services';
import { Reader, ReaderFilters } from '@/types';

export function useReaders(filters?: ReaderFilters & { limit?: number; offset?: number }) {
  const [readers, setReaders] = useState<Reader[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);

  const fetchReaders = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await readerService.getAllReaders(filters);
      
      setReaders(response.data);
      setTotal(response.pagination.total);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch readers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReaders();
  }, [JSON.stringify(filters)]);

  return {
    readers,
    isLoading,
    error,
    total,
    refetch: fetchReaders,
  };
}

export function useOnlineReaders(limit?: number) {
  const [readers, setReaders] = useState<Reader[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchOnlineReaders() {
      try {
        setIsLoading(true);
        const response = await readerService.getOnlineReaders({ limit });
        setReaders(response.data);
      } catch (error) {
        console.error('Failed to fetch online readers:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOnlineReaders();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchOnlineReaders, 30000);
    return () => clearInterval(interval);
  }, [limit]);

  return { readers, isLoading };
}

export function useReader(readerId: number) {
  const [reader, setReader] = useState<Reader | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchReader() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await readerService.getReaderById(readerId);
        setReader(response.data);
      } catch (err) {
        setError(err as Error);
        console.error('Failed to fetch reader:', err);
      } finally {
        setIsLoading(false);
      }
    }

    if (readerId) {
      fetchReader();
    }
  }, [readerId]);

  return { reader, isLoading, error };
}