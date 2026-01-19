'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { BalanceProvider } from '@/contexts/BalanceContext';
import { SessionProvider } from '@/contexts/SessionContext';
import { ErrorBoundary } from '@/components/ui/Error';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BalanceProvider>
          <SessionProvider>
            {children}
          </SessionProvider>
        </BalanceProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}