/**
 * useTransactions Hook
 * Custom hook for fetching and managing transaction data
 */

'use client';

import { useState, useEffect } from 'react';
import { paymentService } from '@/lib/api/services';
import { Transaction, TransactionStats } from '@/types';

export function useTransactions(filters?: {
  limit?: number;
  offset?: number;
  type?: string;
  status?: string;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [total, setTotal] = useState(0);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await paymentService.getTransactionHistory(filters);
      
      setTransactions(response.data);
      setTotal(response.pagination.total);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch transactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [JSON.stringify(filters)]);

  return {
    transactions,
    isLoading,
    error,
    total,
    refetch: fetchTransactions,
  };
}

export function useTransactionStats(startDate?: string, endDate?: string) {
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        setIsLoading(true);
        const response = await paymentService.getTransactionStats({ startDate, endDate });
        setStats(response.data);
      } catch (error) {
        console.error('Failed to fetch transaction stats:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, [startDate, endDate]);

  return { stats, isLoading };
}