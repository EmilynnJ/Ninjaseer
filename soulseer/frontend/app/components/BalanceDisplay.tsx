'use client';

import { useState, useEffect } from 'react';

interface BalanceDisplayProps {
  onAddBalance: () => void;
}

export default function BalanceDisplay({ onAddBalance }: BalanceDisplayProps) {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payments/balance`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBalance(data.balance);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBalanceColor = () => {
    if (balance >= 30) return 'text-green-400';
    if (balance >= 10) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getBalanceStatus = () => {
    if (balance >= 30) return 'Good';
    if (balance >= 10) return 'Low';
    return 'Add Funds';
  };

  return (
    <div className="mystical-card p-4 flex items-center justify-between">
      <div>
        <p className="text-gray-400 text-sm mb-1">Account Balance</p>
        {loading ? (
          <div className="spinner w-6 h-6"></div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${getBalanceColor()}`}>
              ${balance.toFixed(2)}
            </span>
            <span className="text-sm text-gray-500">
              {getBalanceStatus()}
            </span>
          </div>
        )}
      </div>
      <button
        onClick={onAddBalance}
        className="btn-gold text-sm px-6 py-2"
      >
        + Add Funds
      </button>
    </div>
  );
}