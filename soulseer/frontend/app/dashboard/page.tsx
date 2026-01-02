'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import BalanceDisplay from '../components/BalanceDisplay';
import AddBalanceModal from '../components/AddBalanceModal';

interface Session {
  id: string;
  session_type: string;
  duration_minutes: number;
  total_cost: number;
  other_party_name: string;
  created_at: string;
  status: string;
}

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string;
  created_at: string;
  status: string;
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddBalance, setShowAddBalance] = useState(false);
  const [activeTab, setActiveTab] = useState<'sessions' | 'transactions'>('sessions');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch sessions
      const sessionsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/sessions/history/me`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (sessionsResponse.ok) {
        const sessionsData = await sessionsResponse.json();
        setSessions(sessionsData.sessions);
      }

      // Fetch transactions
      const transactionsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/payments/transactions`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (transactionsResponse.ok) {
        const transactionsData = await transactionsResponse.json();
        setTransactions(transactionsData.transactions);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSessionIcon = (type: string) => {
    switch (type) {
      case 'chat': return '💬';
      case 'call': return '📞';
      case 'video': return '📹';
      default: return '🔮';
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit': return '💰';
      case 'reading_charge': return '📖';
      case 'refund': return '↩️';
      case 'gift': return '🎁';
      default: return '💳';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen">
      <Header />

      {/* Page Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="font-playfair text-4xl text-white mb-2">
            Welcome Back! ✨
          </h1>
          <p className="text-gray-400">
            Manage your readings, balance, and account
          </p>
        </div>

        {/* Balance Card */}
        <div className="mb-8">
          <BalanceDisplay onAddBalance={() => setShowAddBalance(true)} />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link href="/readings">
            <div className="mystical-card p-6 mystical-glow-hover cursor-pointer text-center">
              <div className="text-4xl mb-3">🔮</div>
              <h3 className="font-playfair text-xl text-white mb-2">
                Start a Reading
              </h3>
              <p className="text-gray-400 text-sm">
                Connect with a gifted psychic now
              </p>
            </div>
          </Link>

          <Link href="/live">
            <div className="mystical-card p-6 mystical-glow-hover cursor-pointer text-center">
              <div className="text-4xl mb-3">🎭</div>
              <h3 className="font-playfair text-xl text-white mb-2">
                Join Live Stream
              </h3>
              <p className="text-gray-400 text-sm">
                Watch live readings and events
              </p>
            </div>
          </Link>

          <Link href="/shop">
            <div className="mystical-card p-6 mystical-glow-hover cursor-pointer text-center">
              <div className="text-4xl mb-3">🛍️</div>
              <h3 className="font-playfair text-xl text-white mb-2">
                Browse Shop
              </h3>
              <p className="text-gray-400 text-sm">
                Explore spiritual products
              </p>
            </div>
          </Link>
        </div>

        {/* Tabs */}
        <div className="mystical-card p-6">
          <div className="flex gap-4 mb-6 border-b border-mystical-pink/30">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`pb-3 px-4 font-playfair text-lg transition ${
                activeTab === 'sessions'
                  ? 'text-mystical-pink border-b-2 border-mystical-pink'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Reading History
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`pb-3 px-4 font-playfair text-lg transition ${
                activeTab === 'transactions'
                  ? 'text-mystical-pink border-b-2 border-mystical-pink'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Transactions
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="spinner w-12 h-12"></div>
            </div>
          ) : (
            <>
              {/* Sessions Tab */}
              {activeTab === 'sessions' && (
                <div className="space-y-4">
                  {sessions.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-400 mb-4">No reading sessions yet</p>
                      <Link href="/readings">
                        <button className="btn-mystical">
                          Start Your First Reading
                        </button>
                      </Link>
                    </div>
                  ) : (
                    sessions.map((session) => (
                      <div
                        key={session.id}
                        className="bg-black/40 rounded-lg p-4 hover:bg-black/60 transition"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex gap-4">
                            <div className="text-3xl">
                              {getSessionIcon(session.session_type)}
                            </div>
                            <div>
                              <h4 className="font-playfair text-lg text-white mb-1">
                                {session.session_type.charAt(0).toUpperCase() + session.session_type.slice(1)} Reading
                              </h4>
                              <p className="text-gray-400 text-sm mb-2">
                                with {session.other_party_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatDate(session.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-mystical-gold mb-1">
                              ${session.total_cost.toFixed(2)}
                            </div>
                            <div className="text-sm text-gray-400">
                              {session.duration_minutes} minutes
                            </div>
                            <div className={`text-xs mt-2 px-2 py-1 rounded-full inline-block ${
                              session.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                              session.status === 'active' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {session.status}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Transactions Tab */}
              {activeTab === 'transactions' && (
                <div className="space-y-4">
                  {transactions.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-400 mb-4">No transactions yet</p>
                      <button
                        onClick={() => setShowAddBalance(true)}
                        className="btn-gold"
                      >
                        Add Balance
                      </button>
                    </div>
                  ) : (
                    transactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="bg-black/40 rounded-lg p-4 hover:bg-black/60 transition"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex gap-4">
                            <div className="text-3xl">
                              {getTransactionIcon(transaction.transaction_type)}
                            </div>
                            <div>
                              <h4 className="font-playfair text-lg text-white mb-1">
                                {transaction.transaction_type.split('_').map(word => 
                                  word.charAt(0).toUpperCase() + word.slice(1)
                                ).join(' ')}
                              </h4>
                              <p className="text-gray-400 text-sm mb-2">
                                {transaction.description}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatDate(transaction.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-xl font-bold mb-1 ${
                              transaction.transaction_type === 'deposit' || transaction.transaction_type === 'refund'
                                ? 'text-green-400'
                                : 'text-red-400'
                            }`}>
                              {transaction.transaction_type === 'deposit' || transaction.transaction_type === 'refund' ? '+' : '-'}
                              ${Math.abs(transaction.amount).toFixed(2)}
                            </div>
                            <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                              transaction.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                              transaction.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {transaction.status}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Balance Modal */}
      <AddBalanceModal
        isOpen={showAddBalance}
        onClose={() => setShowAddBalance(false)}
        onSuccess={() => {
          setShowAddBalance(false);
          fetchData();
        }}
      />
    </div>
  );
}