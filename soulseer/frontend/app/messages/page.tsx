'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import Header from '../components/Header';

// Dynamically import Clerk components
const SignedIn = dynamic(() => import('@clerk/nextjs').then(mod => mod.SignedIn), { ssr: false });
const SignedOut = dynamic(() => import('@clerk/nextjs').then(mod => mod.SignedOut), { ssr: false });

// Types
interface User {
  id: string;
  displayName: string;
  profileImageUrl: string;
  isOnline: boolean;
  lastSeen?: string;
  isVerified: boolean;
  role: 'user' | 'reader';
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'system' | 'reading_request';
  status: 'sent' | 'delivered' | 'read';
  createdAt: string;
  readAt?: string;
}

interface Conversation {
  id: string;
  type: 'direct' | 'group';
  participant: User;
  lastMessage?: Message;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  createdAt: string;
  updatedAt: string;
}

// Mock data
const mockConversations: Conversation[] = [
  {
    id: '1',
    type: 'direct',
    participant: {
      id: '1',
      displayName: 'Mystic Aurora',
      profileImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
      isOnline: true,
      isVerified: true,
      role: 'reader'
    },
    lastMessage: {
      id: 'm1',
      conversationId: '1',
      senderId: '1',
      content: 'Thank you for the wonderful reading! The insights about my career were spot on.',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    },
    unreadCount: 0,
    isPinned: true,
    isMuted: false,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  },
  {
    id: '2',
    type: 'direct',
    participant: {
      id: '2',
      displayName: 'Luna Starweaver',
      profileImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      isOnline: false,
      lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      isVerified: true,
      role: 'reader'
    },
    lastMessage: {
      id: 'm2',
      conversationId: '2',
      senderId: 'me',
      content: 'Hi Luna, I wanted to ask about scheduling another reading...',
      type: 'text',
      status: 'delivered',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    },
    unreadCount: 2,
    isPinned: false,
    isMuted: false,
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '3',
    type: 'direct',
    participant: {
      id: '3',
      displayName: 'Celestial Rose',
      profileImageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100',
      isOnline: true,
      isVerified: true,
      role: 'reader'
    },
    lastMessage: {
      id: 'm3',
      conversationId: '3',
      senderId: '3',
      content: 'I sense a strong spiritual presence around you. Would you like to explore this further?',
      type: 'text',
      status: 'delivered',
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
    },
    unreadCount: 1,
    isPinned: false,
    isMuted: false,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '4',
    type: 'direct',
    participant: {
      id: '4',
      displayName: 'Phoenix Heart',
      profileImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
      isOnline: false,
      lastSeen: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      isVerified: false,
      role: 'reader'
    },
    lastMessage: {
      id: 'm4',
      conversationId: '4',
      senderId: 'me',
      content: 'The chakra healing session was amazing! I feel so much better.',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    },
    unreadCount: 0,
    isPinned: false,
    isMuted: true,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const mockMessages: Record<string, Message[]> = {
  '1': [
    {
      id: 'm1-1',
      conversationId: '1',
      senderId: 'me',
      content: 'Hi Aurora! I just finished my reading with you and wanted to say thank you!',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString()
    },
    {
      id: 'm1-2',
      conversationId: '1',
      senderId: '1',
      content: 'You\'re so welcome! It was a pleasure connecting with you. The cards had such beautiful messages for you today. 💫',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString()
    },
    {
      id: 'm1-3',
      conversationId: '1',
      senderId: 'me',
      content: 'The insights about my career were spot on. I\'ve been feeling stuck and you helped me see a new path forward.',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString()
    },
    {
      id: 'm1-4',
      conversationId: '1',
      senderId: '1',
      content: 'I\'m so glad! Remember what the Tower card showed us - sometimes things need to fall apart so better things can come together. Trust the process. 🌟',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 32 * 60 * 1000).toISOString()
    },
    {
      id: 'm1-5',
      conversationId: '1',
      senderId: '1',
      content: 'Thank you for the wonderful reading! The insights about my career were spot on.',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    }
  ],
  '2': [
    {
      id: 'm2-1',
      conversationId: '2',
      senderId: '2',
      content: 'Hello! Thank you for your interest in another reading. I\'d love to connect with you again.',
      type: 'text',
      status: 'read',
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'm2-2',
      conversationId: '2',
      senderId: 'me',
      content: 'Hi Luna, I wanted to ask about scheduling another reading...',
      type: 'text',
      status: 'delivered',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    }
  ]
};

// Components
const ConversationItem = ({ 
  conversation, 
  isSelected, 
  onClick 
}: { 
  conversation: Conversation; 
  isSelected: boolean; 
  onClick: () => void;
}) => {
  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <button
      onClick={onClick}
      className={`w-full p-3 flex items-center gap-3 rounded-xl transition-colors ${
        isSelected
          ? 'bg-pink-500/20 border border-pink-500/50'
          : 'hover:bg-gray-800/50'
      }`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <Image
          src={conversation.participant.profileImageUrl}
          alt={conversation.participant.displayName}
          width={48}
          height={48}
          className="rounded-full"
        />
        {conversation.participant.isOnline && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900" />
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <span className={`font-medium truncate ${isSelected ? 'text-pink-400' : 'text-white'}`}>
              {conversation.participant.displayName}
            </span>
            {conversation.participant.isVerified && (
              <svg className="w-4 h-4 text-pink-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            {conversation.isPinned && (
              <span className="text-yellow-400 text-xs">📌</span>
            )}
            {conversation.isMuted && (
              <span className="text-gray-500 text-xs">🔇</span>
            )}
          </div>
          <span className="text-gray-500 text-xs flex-shrink-0">
            {conversation.lastMessage && timeAgo(conversation.lastMessage.createdAt)}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <p className="text-gray-400 text-sm truncate">
            {conversation.lastMessage?.senderId === 'me' && (
              <span className="text-gray-500">You: </span>
            )}
            {conversation.lastMessage?.content || 'No messages yet'}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-pink-500 text-white text-xs font-bold rounded-full flex-shrink-0">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

const MessageBubble = ({ message, isOwn }: { message: Message; isOwn: boolean }) => {
  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-4">
        <span className="px-3 py-1 bg-gray-800 text-gray-400 text-sm rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}>
        <div
          className={`px-4 py-2 rounded-2xl ${
            isOwn
              ? 'bg-pink-500 text-white rounded-br-md'
              : 'bg-gray-800 text-white rounded-bl-md'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
          <span className="text-gray-500 text-xs">{formatTime(message.createdAt)}</span>
          {isOwn && (
            <span className="text-xs">
              {message.status === 'read' && <span className="text-pink-400">✓✓</span>}
              {message.status === 'delivered' && <span className="text-gray-400">✓✓</span>}
              {message.status === 'sent' && <span className="text-gray-500">✓</span>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const ChatHeader = ({ 
  participant, 
  onBack,
  onViewProfile,
  onStartReading
}: { 
  participant: User; 
  onBack: () => void;
  onViewProfile: () => void;
  onStartReading: () => void;
}) => {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-gray-800">
      <button
        onClick={onBack}
        className="lg:hidden p-2 text-gray-400 hover:text-white"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      <div className="relative">
        <Image
          src={participant.profileImageUrl}
          alt={participant.displayName}
          width={40}
          height={40}
          className="rounded-full"
        />
        {participant.isOnline && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-white font-medium truncate">{participant.displayName}</h2>
          {participant.isVerified && (
            <svg className="w-4 h-4 text-pink-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        <p className="text-sm text-gray-400">
          {participant.isOnline ? (
            <span className="text-green-400">Online</span>
          ) : participant.lastSeen ? (
            `Last seen ${new Date(participant.lastSeen).toLocaleString()}`
          ) : (
            'Offline'
          )}
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        {participant.role === 'reader' && participant.isOnline && (
          <button
            onClick={onStartReading}
            className="px-4 py-2 bg-pink-500 text-white text-sm font-medium rounded-full hover:bg-pink-600 transition-colors"
          >
            Start Reading
          </button>
        )}
        <button
          onClick={onViewProfile}
          className="p-2 text-gray-400 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <button className="p-2 text-gray-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

const MessageInput = ({ 
  onSend, 
  disabled 
}: { 
  onSend: (content: string) => void; 
  disabled?: boolean;
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="p-4 border-t border-gray-800">
      <div className="flex items-end gap-3">
        <button className="p-2 text-gray-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Type a message..."
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:border-pink-500 focus:outline-none resize-none"
          />
        </div>
        
        <button className="p-2 text-gray-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        
        <button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className={`p-3 rounded-full transition-colors ${
            message.trim() && !disabled
              ? 'bg-pink-500 text-white hover:bg-pink-600'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
};

const EmptyState = ({ type }: { type: 'no-conversations' | 'no-selection' }) => {
  if (type === 'no-conversations') {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">💬</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Messages Yet</h3>
          <p className="text-gray-400 mb-4">
            Start a conversation with a reader to get spiritual guidance
          </p>
          <Link
            href="/readings"
            className="inline-block px-6 py-3 bg-pink-500 text-white font-medium rounded-full hover:bg-pink-600 transition-colors"
          >
            Find a Reader
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center">
        <div className="text-6xl mb-4">✨</div>
        <h3 className="text-xl font-semibold text-white mb-2">Select a Conversation</h3>
        <p className="text-gray-400">
          Choose a conversation from the list to start messaging
        </p>
      </div>
    </div>
  );
};

// Sign in required component
const SignInRequired = () => (
  <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900">
    <Header />
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-white mb-2">Sign In Required</h2>
        <p className="text-gray-400 mb-4">Please sign in to access your messages</p>
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

// Messages content component
const MessagesContent = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchConversations = async () => {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      setConversations(mockConversations);
      setIsLoading(false);
    };

    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      const conversationMessages = mockMessages[selectedConversation.id] || [];
      setMessages(conversationMessages);
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setShowMobileChat(true);
    
    setConversations(prev =>
      prev.map(c =>
        c.id === conversation.id ? { ...c, unreadCount: 0 } : c
      )
    );
  };

  const handleSendMessage = (content: string) => {
    if (!selectedConversation) return;

    const newMessage: Message = {
      id: `m-${Date.now()}`,
      conversationId: selectedConversation.id,
      senderId: 'me',
      content,
      type: 'text',
      status: 'sent',
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, newMessage]);

    setConversations(prev =>
      prev.map(c =>
        c.id === selectedConversation.id
          ? { ...c, lastMessage: newMessage, updatedAt: newMessage.createdAt }
          : c
      )
    );

    setTimeout(() => {
      setMessages(prev =>
        prev.map(m =>
          m.id === newMessage.id ? { ...m, status: 'delivered' } : m
        )
      );
    }, 1000);
  };

  const filteredConversations = conversations.filter(c =>
    c.participant.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gray-800/30 rounded-2xl border border-gray-700 overflow-hidden h-[calc(100vh-12rem)]">
          <div className="flex h-full">
            {/* Conversations List */}
            <div className={`w-full lg:w-96 border-r border-gray-700 flex flex-col ${showMobileChat ? 'hidden lg:flex' : 'flex'}`}>
              {/* Header */}
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <h1 className="text-xl font-bold text-white">Messages</h1>
                  {totalUnread > 0 && (
                    <span className="px-2 py-1 bg-pink-500 text-white text-xs font-bold rounded-full">
                      {totalUnread}
                    </span>
                  )}
                </div>
                
                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 pl-10 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-pink-500 focus:outline-none text-sm"
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              
              {/* Conversations */}
              <div className="flex-1 overflow-y-auto p-2">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredConversations.length > 0 ? (
                  <div className="space-y-1">
                    {filteredConversations.map((conversation) => (
                      <ConversationItem
                        key={conversation.id}
                        conversation={conversation}
                        isSelected={selectedConversation?.id === conversation.id}
                        onClick={() => handleSelectConversation(conversation)}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState type="no-conversations" />
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col ${!showMobileChat ? 'hidden lg:flex' : 'flex'}`}>
              {selectedConversation ? (
                <>
                  <ChatHeader
                    participant={selectedConversation.participant}
                    onBack={() => setShowMobileChat(false)}
                    onViewProfile={() => {}}
                    onStartReading={() => {}}
                  />
                  
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {messages.length > 0 ? (
                      <>
                        {messages.map((message) => (
                          <MessageBubble
                            key={message.id}
                            message={message}
                            isOwn={message.senderId === 'me'}
                          />
                        ))}
                        <div ref={messagesEndRef} />
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="text-4xl mb-2">👋</div>
                          <p className="text-gray-400">
                            Start the conversation with {selectedConversation.participant.displayName}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <MessageInput onSend={handleSendMessage} />
                </>
              ) : (
                <EmptyState type="no-selection" />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// Main Page Component
export default function MessagesPage() {
  return (
    <>
      <SignedIn>
        <MessagesContent />
      </SignedIn>
      <SignedOut>
        <SignInRequired />
      </SignedOut>
    </>
  );
}