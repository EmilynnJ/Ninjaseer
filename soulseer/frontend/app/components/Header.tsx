'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

// Dynamically import Clerk components to avoid SSR issues
const UserButton = dynamic(
  () => import('@clerk/nextjs').then((mod) => mod.UserButton),
  { ssr: false, loading: () => <div className="w-9 h-9 bg-gray-700 rounded-full animate-pulse" /> }
);

const SignedIn = dynamic(
  () => import('@clerk/nextjs').then((mod) => mod.SignedIn),
  { ssr: false }
);

const SignedOut = dynamic(
  () => import('@clerk/nextjs').then((mod) => mod.SignedOut),
  { ssr: false }
);

// Import BalanceDisplay dynamically too
const BalanceDisplay = dynamic(
  () => import('./BalanceDisplay'),
  { ssr: false, loading: () => <div className="w-20 h-8 bg-gray-700 rounded animate-pulse" /> }
);

interface Notification {
  id: string;
  type: 'session' | 'message' | 'payment' | 'system';
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'session',
    title: 'Reading Complete',
    content: 'Your reading with Mystic Aurora has ended.',
    isRead: false,
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    actionUrl: '/dashboard'
  },
  {
    id: '2',
    type: 'message',
    title: 'New Message',
    content: 'Luna Starweaver sent you a message.',
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    actionUrl: '/messages'
  }
];

const NotificationDropdown = ({ 
  notifications, 
  isOpen, 
  onClose 
}: { 
  notifications: Notification[]; 
  isOpen: boolean; 
  onClose: () => void;
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'session': return '🔮';
      case 'message': return '💬';
      case 'payment': return '💳';
      case 'system': return '🔔';
      default: return '📢';
    }
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div 
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden"
    >
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-white">Notifications</h3>
        <button className="text-pink-400 text-sm hover:text-pink-300">
          Mark all read
        </button>
      </div>
      
      <div className="max-h-96 overflow-y-auto">
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <Link
              key={notification.id}
              href={notification.actionUrl || '#'}
              onClick={onClose}
              className={`block p-3 hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-0 ${
                !notification.isRead ? 'bg-pink-500/5' : ''
              }`}
            >
              <div className="flex gap-3">
                <span className="text-xl">{getTypeIcon(notification.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`font-medium text-sm ${!notification.isRead ? 'text-white' : 'text-gray-300'}`}>
                      {notification.title}
                    </p>
                    {!notification.isRead && (
                      <span className="w-2 h-2 bg-pink-500 rounded-full" />
                    )}
                  </div>
                  <p className="text-gray-400 text-sm truncate">{notification.content}</p>
                  <p className="text-gray-500 text-xs mt-1">{timeAgo(notification.createdAt)}</p>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="p-6 text-center">
            <p className="text-gray-400">No notifications</p>
          </div>
        )}
      </div>
      
      <div className="p-2 border-t border-gray-700">
        <Link
          href="/notifications"
          onClick={onClose}
          className="block w-full py-2 text-center text-pink-400 text-sm hover:bg-gray-800 rounded-lg transition-colors"
        >
          View All Notifications
        </Link>
      </div>
    </div>
  );
};

const MobileMenu = ({ 
  isOpen, 
  onClose
}: { 
  isOpen: boolean; 
  onClose: () => void;
}) => {
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/readings', label: 'Get a Reading', icon: '🔮' },
    { href: '/live', label: 'Live Streams', icon: '📺' },
    { href: '/shop', label: 'Shop', icon: '🛍️' },
    { href: '/community', label: 'Community', icon: '👥' },
  ];

  const userLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/messages', label: 'Messages', icon: '💬' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 left-0 w-72 bg-gray-900 border-r border-gray-800 z-50 lg:hidden overflow-y-auto">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <Link href="/" onClick={onClose} className="flex items-center gap-2">
            <span className="text-2xl">🔮</span>
            <span className="text-xl font-bold text-white">SoulSeer</span>
          </Link>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <nav className="p-4">
          <div className="space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  pathname === link.href
                    ? 'bg-pink-500/20 text-pink-400'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            ))}
          </div>
          
          <SignedIn>
            <div className="my-4 border-t border-gray-800" />
            <div className="space-y-1">
              {userLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                    pathname === link.href
                      ? 'bg-pink-500/20 text-pink-400'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <span>{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              ))}
            </div>
          </SignedIn>
        </nav>
        
        <SignedOut>
          <div className="p-4 border-t border-gray-800">
            <Link
              href="/sign-in"
              onClick={onClose}
              className="block w-full py-3 text-center bg-pink-500 text-white font-medium rounded-full hover:bg-pink-600 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              onClick={onClose}
              className="block w-full py-3 mt-2 text-center text-gray-300 hover:text-white transition-colors"
            >
              Create Account
            </Link>
          </div>
        </SignedOut>
      </div>
    </>
  );
};

export default function Header() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications] = useState<Notification[]>(mockNotifications);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const navLinks = [
    { href: '/readings', label: 'Get a Reading' },
    { href: '/live', label: 'Live Streams' },
    { href: '/shop', label: 'Shop' },
    { href: '/community', label: 'Community' },
  ];

  return (
    <>
      <header 
        className={`sticky top-0 z-40 transition-all duration-300 ${
          isScrolled 
            ? 'bg-gray-900/95 backdrop-blur-md border-b border-gray-800 shadow-lg' 
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl lg:text-3xl">🔮</span>
              <span className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                SoulSeer
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    pathname === link.href || pathname.startsWith(link.href + '/')
                      ? 'bg-pink-500/20 text-pink-400'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2 lg:gap-4">
              <SignedIn>
                {/* Balance */}
                <div className="hidden sm:block">
                  <BalanceDisplay />
                </div>

                {/* Messages */}
                <Link
                  href="/messages"
                  className="relative p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </Link>

                {/* Notifications */}
                <div className="relative">
                  <button
                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    className="relative p-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-pink-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  
                  <NotificationDropdown
                    notifications={notifications}
                    isOpen={isNotificationsOpen}
                    onClose={() => setIsNotificationsOpen(false)}
                  />
                </div>

                {/* User menu */}
                <UserButton afterSignOutUrl="/" />
              </SignedIn>

              <SignedOut>
                <Link
                  href="/sign-in"
                  className="hidden sm:block px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="px-4 py-2 bg-pink-500 text-white font-medium rounded-full hover:bg-pink-600 transition-colors"
                >
                  Get Started
                </Link>
              </SignedOut>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
    </>
  );
}