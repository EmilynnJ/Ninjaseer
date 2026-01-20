'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import Header from '../components/Header';
import AddBalanceModal from '../components/AddBalanceModal';

// Dynamically import Clerk components
const SignedIn = dynamic(() => import('@clerk/nextjs').then(mod => mod.SignedIn), { ssr: false });
const SignedOut = dynamic(() => import('@clerk/nextjs').then(mod => mod.SignedOut), { ssr: false });

// Types
interface UserStats {
  totalReadings: number;
  totalSpent: number;
  favoriteReaders: number;
  memberSince: string;
}

interface Transaction {
  id: string;
  type: 'balance_add' | 'reading_payment' | 'gift_purchase' | 'refund';
  amount: number;
  description: string;
  status: 'completed' | 'pending' | 'failed';
  createdAt: string;
  reader?: {
    id: string;
    displayName: string;
    profileImageUrl: string;
  };
}

interface ReadingSession {
  id: string;
  reader: {
    id: string;
    displayName: string;
    profileImageUrl: string;
    specialties: string[];
  };
  type: 'chat' | 'voice' | 'video';
  status: 'completed' | 'cancelled' | 'scheduled';
  duration: number;
  cost: number;
  rating?: number;
  createdAt: string;
  scheduledAt?: string;
}

interface FavoriteReader {
  id: string;
  displayName: string;
  profileImageUrl: string;
  specialties: string[];
  rating: number;
  status: 'online' | 'offline' | 'busy';
  ratePerMinute: number;
}

interface Notification {
  id: string;
  type: 'session' | 'payment' | 'promotion' | 'system';
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

// Mock data
const mockStats: UserStats = {
  totalReadings: 24,
  totalSpent: 487.50,
  favoriteReaders: 5,
  memberSince: '2023-06-15'
};

const mockTransactions: Transaction[] = [
  {
    id: '1',
    type: 'reading_payment',
    amount: -35.94,
    description: '6 min reading with Mystic Aurora',
    status: 'completed',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    reader: {
      id: '1',
      displayName: 'Mystic Aurora',
      profileImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100'
    }
  },
  {
    id: '2',
    type: 'balance_add',
    amount: 50.00,
    description: 'Added funds to balance',
    status: 'completed',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '3',
    type: 'reading_payment',
    amount: -47.92,
    description: '8 min reading with Luna Starweaver',
    status: 'completed',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    reader: {
      id: '3',
      displayName: 'Luna Starweaver',
      profileImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
    }
  },
  {
    id: '4',
    type: 'gift_purchase',
    amount: -9.99,
    description: 'Sent Crystal Heart gift',
    status: 'completed',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const mockSessions: ReadingSession[] = [
  {
    id: '1',
    reader: {
      id: '1',
      displayName: 'Mystic Aurora',
      profileImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
      specialties: ['Tarot', 'Love']
    },
    type: 'video',
    status: 'completed',
    duration: 6,
    cost: 35.94,
    rating: 5,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '2',
    reader: {
      id: '3',
      displayName: 'Luna Starweaver',
      profileImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      specialties: ['Astrology', 'Numerology']
    },
    type: 'voice',
    status: 'completed',
    duration: 8,
    cost: 47.92,
    rating: 5,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '3',
    reader: {
      id: '2',
      displayName: 'Celestial Rose',
      profileImageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100',
      specialties: ['Mediumship', 'Spirit Guides']
    },
    type: 'chat',
    status: 'scheduled',
    duration: 0,
    cost: 0,
    scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const mockFavorites: FavoriteReader[] = [
  {
    id: '1',
    displayName: 'Mystic Aurora',
    profileImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
    specialties: ['Tarot', 'Love'],
    rating: 4.9,
    status: 'online',
    ratePerMinute: 5.99
  },
  {
    id: '2',
    displayName: 'Celestial Rose',
    profileImageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100',
    specialties: ['Mediumship'],
    rating: 4.8,
    status: 'busy',
    ratePerMinute: 7.99
  },
  {
    id: '3',
    displayName: 'Luna Starweaver',
    profileImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
    specialties: ['Astrology'],
    rating: 4.9,
    status: 'offline',
    ratePerMinute: 6.99
  }
];

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'session',
    title: 'Reading Complete',
    content: 'Your reading with Mystic Aurora has ended. Don\'t forget to leave a review!',
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '2',
    type: 'promotion',
    title: '🎉 Special Offer!',
    content: 'Get 20% bonus on your next balance top-up. Limited time only!',
    isRead: false,
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '3',
    type: 'system',
    title: 'Favorite Reader Online',
    content: 'Mystic Aurora is now available for readings.',
    isRead: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  }
];

// Components
const BalanceCard = ({ 
  balance, 
  onAddFunds 
}: { 
  balance: number; 
  onAddFunds: () => void;
}) => {
  return (
    <div className="bg-gradient-to-br from-pink-600 to-purple-700 rounded-2xl p-6 text-white relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative z-10">
        <p className="text-pink-200 text-sm mb-1">Available Balance</p>
        <h2 className="text-4xl font-bold mb-4">${balance.toFixed(2)}</h2>
        
        <button
          onClick={onAddFunds}
          className="w-full py-3 bg-white text-purple-700 font-semibold rounded-full hover:bg-gray-100 transition-colors"
        >
          Add Funds
        </button>
      </div>
    </div>
  );
};

const StatsGrid = ({ stats }: { stats: UserStats }) => {
  const statItems = [
    { label: 'Total Readings', value: stats.totalReadings, icon: '🔮' },
    { label: 'Total Spent', value: `$${stats.totalSpent.toFixed(2)}`, icon: '💰' },
    { label: 'Favorite Readers', value: stats.favoriteReaders, icon: '❤️' },
    { label: 'Member Since', value: new Date(stats.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), icon: '📅' }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {statItems.map((item, index) => (
        <div key={index} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-2xl mb-2">{item.icon}</div>
          <div className="text-2xl font-bold text-white">{item.value}</div>
          <div className="text-gray-400 text-sm">{item.label}</div>
        </div>
      ))}
    </div>
  );
};

const RecentTransactions = ({ transactions }: { transactions: Transaction[] }) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'balance_add': return '💳';
      case 'reading_payment': return '🔮';
      case 'gift_purchase': return '🎁';
      case 'refund': return '↩️';
      default: return '💰';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'balance_add': return 'text-green-400';
      case 'refund': return 'text-green-400';
      default: return 'text-red-400';
    }
  };

  return (
    <div className="bg-gray-800/30 rounded-2xl border border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
        <Link href="/dashboard/transactions" className="text-pink-400 hover:text-pink-300 text-sm">
          View All
        </Link>
      </div>
      
      <div className="divide-y divide-gray-700">
        {transactions.slice(0, 5).map((transaction) => (
          <div key={transaction.id} className="p-4 flex items-center gap-4 hover:bg-gray-800/50 transition-colors">
            <div className="text-2xl">{getTypeIcon(transaction.type)}</div>
            
            <div className="flex-1 min-w-0">
              <p className="text-white truncate">{transaction.description}</p>
              <p className="text-gray-500 text-sm">
                {new Date(transaction.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
            
            <div className={`font-semibold ${getTypeColor(transaction.type)}`}>
              {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const RecentSessions = ({ sessions }: { sessions: ReadingSession[] }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">Completed</span>;
      case 'scheduled':
        return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">Scheduled</span>;
      case 'cancelled':
        return <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">Cancelled</span>;
      default:
        return null;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return '📹';
      case 'voice': return '📞';
      case 'chat': return '💬';
      default: return '🔮';
    }
  };

  return (
    <div className="bg-gray-800/30 rounded-2xl border border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Reading History</h3>
        <Link href="/dashboard/sessions" className="text-pink-400 hover:text-pink-300 text-sm">
          View All
        </Link>
      </div>
      
      <div className="divide-y divide-gray-700">
        {sessions.map((session) => (
          <div key={session.id} className="p-4 flex items-center gap-4 hover:bg-gray-800/50 transition-colors">
            <Image
              src={session.reader.profileImageUrl}
              alt={session.reader.displayName}
              width={48}
              height={48}
              className="rounded-full"
            />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-white font-medium">{session.reader.displayName}</p>
                <span className="text-gray-500">{getTypeIcon(session.type)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">
                  {session.status === 'scheduled' 
                    ? `Scheduled: ${new Date(session.scheduledAt!).toLocaleDateString()}`
                    : `${session.duration} min • $${session.cost.toFixed(2)}`
                  }
                </span>
                {session.rating && (
                  <span className="text-yellow-400">{'★'.repeat(session.rating)}</span>
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              {getStatusBadge(session.status)}
              {session.status === 'completed' && !session.rating && (
                <Link 
                  href={`/dashboard/sessions/${session.id}/review`}
                  className="text-pink-400 hover:text-pink-300 text-xs"
                >
                  Leave Review
                </Link>
              )}
              {session.status === 'scheduled' && (
                <Link 
                  href={`/reading/${session.id}`}
                  className="text-pink-400 hover:text-pink-300 text-xs"
                >
                  Join Session
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const FavoriteReaders = ({ favorites }: { favorites: FavoriteReader[] }) => {
  const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-gray-500',
    busy: 'bg-yellow-500'
  };

  return (
    <div className="bg-gray-800/30 rounded-2xl border border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Favorite Readers</h3>
        <Link href="/dashboard/favorites" className="text-pink-400 hover:text-pink-300 text-sm">
          View All
        </Link>
      </div>
      
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {favorites.map((reader) => (
          <Link 
            key={reader.id} 
            href={`/readings/${reader.id}`}
            className="bg-gray-800/50 rounded-xl p-4 hover:bg-gray-800 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <Image
                  src={reader.profileImageUrl}
                  alt={reader.displayName}
                  width={48}
                  height={48}
                  className="rounded-full"
                />
                <div className={`absolute bottom-0 right-0 w-3 h-3 ${statusColors[reader.status]} rounded-full border-2 border-gray-800`} />
              </div>
              <div>
                <p className="text-white font-medium group-hover:text-pink-400 transition-colors">
                  {reader.displayName}
                </p>
                <p className="text-gray-500 text-sm">{reader.specialties[0]}</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-yellow-400">★ {reader.rating}</span>
              <span className="text-pink-400">${reader.ratePerMinute}/min</span>
            </div>
            
            {reader.status === 'online' && (
              <button className="w-full mt-3 py-2 bg-pink-500/20 text-pink-400 rounded-lg text-sm font-medium hover:bg-pink-500/30 transition-colors">
                Start Reading
              </button>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
};

const NotificationsPanel = ({ notifications }: { notifications: Notification[] }) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'session': return '🔮';
      case 'payment': return '💳';
      case 'promotion': return '🎉';
      case 'system': return '🔔';
      default: return '📢';
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="bg-gray-800/30 rounded-2xl border border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-pink-500 text-white text-xs rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <button className="text-pink-400 hover:text-pink-300 text-sm">
          Mark All Read
        </button>
      </div>
      
      <div className="divide-y divide-gray-700 max-h-80 overflow-y-auto">
        {notifications.map((notification) => (
          <div 
            key={notification.id} 
            className={`p-4 hover:bg-gray-800/50 transition-colors ${!notification.isRead ? 'bg-pink-500/5' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div className="text-xl">{getTypeIcon(notification.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-medium">{notification.title}</p>
                  {!notification.isRead && (
                    <span className="w-2 h-2 bg-pink-500 rounded-full" />
                  )}
                </div>
                <p className="text-gray-400 text-sm mt-1">{notification.content}</p>
                <p className="text-gray-500 text-xs mt-2">
                  {new Date(notification.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const QuickActions = () => {
  const actions = [
    { label: 'Find a Reader', href: '/readings', icon: '🔮', color: 'from-pink-500 to-purple-600' },
    { label: 'Watch Live', href: '/live', icon: '📺', color: 'from-red-500 to-pink-600' },
    { label: 'Browse Shop', href: '/shop', icon: '🛍️', color: 'from-purple-500 to-indigo-600' },
    { label: 'Community', href: '/community', icon: '👥', color: 'from-blue-500 to-cyan-600' }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {actions.map((action, index) => (
        <Link
          key={index}
          href={action.href}
          className={`bg-gradient-to-br ${action.color} rounded-xl p-4 text-white hover:opacity-90 transition-opacity`}
        >
          <div className="text-3xl mb-2">{action.icon}</div>
          <p className="font-semibold">{action.label}</p>
        </Link>
      ))}
    </div>
  );
};

// Main Page Component
// Sign in required component
const SignInRequired = () => (
  <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900">
    <Header />
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-white mb-2">Sign In Required</h2>
        <p className="text-gray-400 mb-4">Please sign in to access your dashboard</p>
        <Link
          href="/sign-in"
          className="inline-block px-6 py-3 bg-pink-500 text-white font-medium rounded-full hover:bg-pink-600 transition-colors"
        >
          Sign In
        </Link>
      </div>
    </div>
  </div>
);

// Dashboard content component
const DashboardContent = () => {
  const [balance, setBalance] = useState(127.50);
  const [stats, setStats] = useState<UserStats>(mockStats);
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [sessions, setSessions] = useState<ReadingSession[]>(mockSessions);
  const [favorites, setFavorites] = useState<FavoriteReader[]>(mockFavorites);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [showAddBalance, setShowAddBalance] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState('Seeker');

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleAddBalance = (amount: number) => {
    setBalance(prev => prev + amount);
    setShowAddBalance(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#1a1a2e] to-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#1a1a2e] to-[#0a0a0f] text-white">
      <Header />
      
      <main className="pt-24 pb-16 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Welcome section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome back, {userName}! ✨
            </h1>
            <p className="text-gray-400">
              Your spiritual journey continues. What guidance do you seek today?
            </p>
          </div>

          {/* Quick actions */}
          <div className="mb-8">
            <QuickActions />
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Stats */}
              <StatsGrid stats={stats} />
              
              {/* Recent sessions */}
              <RecentSessions sessions={sessions} />
              
              {/* Favorite readers */}
              <FavoriteReaders favorites={favorites} />
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Balance card */}
              <BalanceCard balance={balance} onAddFunds={() => setShowAddBalance(true)} />
              
              {/* Notifications */}
              <NotificationsPanel notifications={notifications} />
              
              {/* Recent transactions */}
              <RecentTransactions transactions={transactions} />
            </div>
          </div>
        </div>
      </main>

      {/* Add balance modal */}
      <AddBalanceModal
        isOpen={showAddBalance}
        onClose={() => setShowAddBalance(false)}
        currentBalance={balance}
        onSuccess={handleAddBalance}
      />
    </div>
  );
};

// Main Page Component
export default function DashboardPage() {
  return (
    <>
      <SignedIn>
        <DashboardContent />
      </SignedIn>
      <SignedOut>
        <SignInRequired />
      </SignedOut>
    </>
  );
}