/**
 * Balance Context
 * Manages user balance state across the application
 */

'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { paymentService } from '@/lib/api/services';
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
      const response = await paymentService.getBalance();
      setBalance(response.data.balance);
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addBalance = async (amount: number): Promise<PaymentIntent> => {
    try {
      const paymentIntent = await paymentService.addBalance(amount);
      return paymentIntent;
    } catch (error) {
      console.error('Failed to add balance:', error);
      throw error;
    }
  };

  useEffect(() => {
    refreshBalance();
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