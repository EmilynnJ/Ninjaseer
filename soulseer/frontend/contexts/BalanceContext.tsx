/**
 * Balance Context
 * Manages user balance state across the application
 */

'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { PaymentIntent } from '@/types';

interface BalanceContextType {
  balance: number;
  isLoading: boolean;
  refreshBalance: () => Promise<void>;
  addBalance: (amount: number) => Promise<PaymentIntent>;
}

const BalanceContext = createContext<BalanceContextType | undefined>(undefined);

export function BalanceProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const refreshBalance = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      
      if (!token) {
        setBalance(0);
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/payments/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance || 0);
      }
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addBalance = async (amount: number): Promise<PaymentIntent> => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/payments/add-balance`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        throw new Error('Failed to add balance');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to add balance:', error);
      throw error;
    }
  };

  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      refreshBalance();
    }
  }, []);

  const value: BalanceContextType = {
    balance,
    isLoading,
    refreshBalance,
    addBalance,
  };

  return <BalanceContext.Provider value={value}>{children}</BalanceContext.Provider>;
}

export function useBalance() {
  const context = useContext(BalanceContext);
  if (context === undefined) {
    throw new Error('useBalance must be used within a BalanceProvider');
  }
  return context;
}