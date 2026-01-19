'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@clerk/nextjs';
import Header from '../components/Header';

// Types
interface ForumPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  type: 'discussion' | 'question' | 'article' | 'experience' | 'poll';
  category: string;
  tags: string[];
  author: {
    id: string;
    displayName: string;
    profileImageUrl: string;
    isVerified: boolean;
    role: 'user' | 'reader' | 'moderator' | 'admin';
  };
  viewCount: number;
  commentCount: number;
  reactionCount: number;
  isPinned: boolean;
  isFeatured: boolean;
  isAnswered?: boolean;
  createdAt: string;
  lastActivityAt: string;
  userReaction?: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  postCount: number;
  color: string;
}

interface TrendingTopic {
  tag: string;
  postCount: number;
  trend: 'up' | 'down' | 'stable';
}

// Mock data
const mockPosts: ForumPost[] = [
  {
    id: '1',
    title: 'My First Tarot Reading Experience - It Changed My Life!',
    slug: 'my-first-tarot-reading-experience',
    content: 'I wanted to share my incredible experience with my first professional tarot reading...',
    excerpt: 'I wanted to share my incredible experience with my first professional tarot reading. I was skeptical at first, but what Mystic Aurora told me was so accurate...',
    type: 'experience',
    category: 'Tarot',
    tags: ['tarot', 'first reading', 'life changing', 'mystic aurora'],
    author: {
      id: '1',
      displayName: 'SpiritualSeeker22',
      profileImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
      isVerified: false,
      role: 'user'
    },
    viewCount: 1247,
    commentCount: 45,
    reactionCount: 89,
    isPinned: false,
    isFeatured: true,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastActivityAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  },
  {
    id: '2',
    title: 'How do I know if I have psychic abilities?',
    slug: 'how-do-i-know-if-i-have-psychic-abilities',
    content: 'I\'ve been having strange experiences lately and I\'m wondering if they could be signs of psychic abilities...',
    excerpt: 'I\'ve been having strange experiences lately - vivid dreams that come true, knowing who\'s calling before I look at my phone, sensing things about people...',
    type: 'question',
    category: 'Psychic Development',
    tags: ['psychic abilities', 'intuition', 'development', 'signs'],
    author: {
      id: '2',
      displayName: 'CuriousMind',
      profileImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
      isVerified: false,
      role: 'user'
    },
    viewCount: 892,
    commentCount: 67,
    reactionCount: 34,
    isPinned: false,
    isFeatured: false,
    isAnswered: true,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '3',
    title: '🌟 Welcome to SoulSeer Community - Read This First!',
    slug: 'welcome-to-soulseer-community',
    content: 'Welcome to our spiritual community! Here are the guidelines and tips for getting started...',
    excerpt: 'Welcome to our spiritual community! This is a safe space for seekers, readers, and anyone interested in spiritual growth. Please read our community guidelines...',
    type: 'article',
    category: 'Announcements',
    tags: ['welcome', 'guidelines', 'community', 'rules'],
    author: {
      id: 'admin',
      displayName: 'SoulSeer Team',
      profileImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      isVerified: true,
      role: 'admin'
    },
    viewCount: 5678,
    commentCount: 23,
    reactionCount: 156,
    isPinned: true,
    isFeatured: false,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastActivityAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '4',
    title: 'Understanding the Major Arcana: A Complete Guide',
    slug: 'understanding-major-arcana-complete-guide',
    content: 'The Major Arcana consists of 22 cards that represent significant life events and spiritual lessons...',
    excerpt: 'The Major Arcana consists of 22 cards that represent significant life events and spiritual lessons. In this comprehensive guide, I\'ll break down each card...',
    type: 'article',
    category: 'Tarot',
    tags: ['tarot', 'major arcana', 'guide', 'learning'],
    author: {
      id: '3',
      displayName: 'Luna Starweaver',
      profileImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      isVerified: true,
      role: 'reader'
    },
    viewCount: 3456,
    commentCount: 89,
    reactionCount: 234,
    isPinned: false,
    isFeatured: true,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastActivityAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '5',
    title: 'What crystal should I get for anxiety?',
    slug: 'what-crystal-for-anxiety',
    content: 'I\'ve been dealing with a lot of anxiety lately and heard that crystals can help...',
    excerpt: 'I\'ve been dealing with a lot of anxiety lately and heard that crystals can help. What would you recommend for a beginner? I\'m open to any suggestions!',
    type: 'question',
    category: 'Crystals',
    tags: ['crystals', 'anxiety', 'healing', 'beginner'],
    author: {
      id: '4',
      displayName: 'AnxiousButHopeful',
      profileImageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100',
      isVerified: false,
      role: 'user'
    },
    viewCount: 567,
    commentCount: 34,
    reactionCount: 28,
    isPinned: false,
    isFeatured: false,
    isAnswered: true,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    lastActivityAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '6',
    title: 'Poll: What\'s your favorite divination method?',
    slug: 'poll-favorite-divination-method',
    content: 'I\'m curious to know what divination methods our community prefers...',
    excerpt: 'I\'m curious to know what divination methods our community prefers. Vote and share why you chose your answer!',
    type: 'poll',
    category: 'General',
    tags: ['poll', 'divination', 'tarot', 'astrology', 'community'],
    author: {
      id: '5',
      displayName: 'MysticExplorer',
      profileImageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
      isVerified: false,
      role: 'user'
    },
    viewCount: 789,
    commentCount: 56,
    reactionCount: 123,
    isPinned: false,
    isFeatured: false,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    lastActivityAt: new Date(Date.now() - 45 * 60 * 1000).toISOString()
  },
  {
    id: '7',
    title: 'My journey from skeptic to believer',
    slug: 'journey-from-skeptic-to-believer',
    content: 'I used to think all of this was nonsense. Then something happened that changed everything...',
    excerpt: 'I used to think all of this was nonsense. I was the biggest skeptic you could find. Then something happened that changed everything...',
    type: 'experience',
    category: 'Spiritual Growth',
    tags: ['skeptic', 'journey', 'spiritual awakening', 'personal story'],
    author: {
      id: '6',
      displayName: 'FormerSkeptic',
      profileImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
      isVerified: false,
      role: 'user'
    },
    viewCount: 2345,
    commentCount: 78,
    reactionCount: 167,
    isPinned: false,
    isFeatured: true,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    lastActivityAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '8',
    title: 'Mercury Retrograde Survival Tips',
    slug: 'mercury-retrograde-survival-tips',
    content: 'Mercury retrograde is coming up and I wanted to share some tips that have helped me...',
    excerpt: 'Mercury retrograde is coming up! Here are my tried and tested survival tips to help you navigate this challenging period...',
    type: 'discussion',
    category: 'Astrology',
    tags: ['mercury retrograde', 'astrology', 'tips', 'survival guide'],
    author: {
      id: '3',
      displayName: 'Luna Starweaver',
      profileImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      isVerified: true,
      role: 'reader'
    },
    viewCount: 1567,
    commentCount: 45,
    reactionCount: 89,
    isPinned: false,
    isFeatured: false,
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    lastActivityAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  }
];

const categories: Category[] = [
  { id: 'all', name: 'All Posts', icon: '📝', description: 'Browse all community posts', postCount: 1234, color: 'gray' },
  { id: 'tarot', name: 'Tarot', icon: '🃏', description: 'Tarot readings and interpretations', postCount: 345, color: 'purple' },
  { id: 'astrology', name: 'Astrology', icon: '⭐', description: 'Zodiac signs and horoscopes', postCount: 289, color: 'blue' },
  { id: 'crystals', name: 'Crystals', icon: '💎', description: 'Crystal healing and properties', postCount: 234, color: 'pink' },
  { id: 'psychic-development', name: 'Psychic Development', icon: '🔮', description: 'Developing your abilities', postCount: 178, color: 'indigo' },
  { id: 'spiritual-growth', name: 'Spiritual Growth', icon: '🌱', description: 'Personal spiritual journey', postCount: 156, color: 'green' },
  { id: 'mediumship', name: 'Mediumship', icon: '👻', description: 'Connecting with spirits', postCount: 123, color: 'violet' },
  { id: 'dreams', name: 'Dreams', icon: '💭', description: 'Dream interpretation', postCount: 98, color: 'cyan' },
  { id: 'general', name: 'General', icon: '💬', description: 'General discussions', postCount: 456, color: 'gray' },
  { id: 'announcements', name: 'Announcements', icon: '📢', description: 'Official announcements', postCount: 12, color: 'yellow' }
];

const trendingTopics: TrendingTopic[] = [
  { tag: 'mercury retrograde', postCount: 89, trend: 'up' },
  { tag: 'full moon', postCount: 67, trend: 'up' },
  { tag: 'tarot spreads', postCount: 54, trend: 'stable' },
  { tag: 'crystal healing', postCount: 45, trend: 'up' },
  { tag: 'spirit guides', postCount: 38, trend: 'down' }
];

// Components
const PostTypeIcon = ({ type }: { type: string }) => {
  const icons: Record<string, { icon: string; color: string }> = {
    discussion: { icon: '💬', color: 'text-blue-400' },
    question: { icon: '❓', color: 'text-yellow-400' },
    article: { icon: '📄', color: 'text-green-400' },
    experience: { icon: '✨', color: 'text-purple-400' },
    poll: { icon: '📊', color: 'text-pink-400' }
  };

  const { icon, color } = icons[type] || icons.discussion;

  return <span className={`text-lg ${color}`}>{icon}</span>;
};

const RoleBadge = ({ role }: { role: string }) => {
  const badges: Record<string, { label: string; color: string }> = {
    reader: { label: 'Reader', color: 'bg-purple-500/20 text-purple-400' },
    moderator: { label: 'Mod', color: 'bg-blue-500/20 text-blue-400' },
    admin: { label: 'Admin', color: 'bg-red-500/20 text-red-400' }
  };

  if (!badges[role]) return null;

  const { label, color } = badges[role];

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${color}`}>
      {label}
    </span>
  );
};

const PostCard = ({ post }: { post: ForumPost }) => {
  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className={`bg-gray-800/30 rounded-xl border ${post.isPinned ? 'border-yellow-500/50' : 'border-gray-700'} hover:border-pink-500/50 transition-colors p-4`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <Link href={`/profile/${post.author.id}`}>
          <Image
            src={post.author.profileImageUrl}
            alt={post.author.displayName}
            width={40}
            height={40}
            className="rounded-full"
          />
        </Link>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/profile/${post.author.id}`} className="text-white font-medium hover:text-pink-400">
              {post.author.displayName}
            </Link>
            {post.author.isVerified && (
              <svg className="w-4 h-4 text-pink-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            <RoleBadge role={post.author.role} />
            <span className="text-gray-500 text-sm">• {timeAgo(post.createdAt)}</span>
          </div>
          
          <div className="flex items-center gap-2 mt-1">
            <span className="text-pink-400 text-sm">{post.category}</span>
            {post.isPinned && (
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">📌 Pinned</span>
            )}
            {post.isFeatured && (
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">⭐ Featured</span>
            )}
            {post.type === 'question' && post.isAnswered && (
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">✓ Answered</span>
            )}
          </div>
        </div>
        
        <PostTypeIcon type={post.type} />
      </div>
      
      {/* Content */}
      <Link href={`/community/${post.slug}`} className="block group">
        <h3 className="text-lg font-semibold text-white group-hover:text-pink-400 transition-colors mb-2">
          {post.title}
        </h3>
        <p className="text-gray-400 text-sm line-clamp-2 mb-3">
          {post.excerpt}
        </p>
      </Link>
      
      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-3">
        {post.tags.slice(0, 4).map((tag) => (
          <Link
            key={tag}
            href={`/community?tag=${tag}`}
            className="px-2 py-1 bg-gray-700/50 text-gray-400 text-xs rounded hover:bg-gray-700 hover:text-white transition-colors"
          >
            #{tag}
          </Link>
        ))}
        {post.tags.length > 4 && (
          <span className="px-2 py-1 text-gray-500 text-xs">+{post.tags.length - 4} more</span>
        )}
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-700">
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {post.viewCount.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {post.commentCount}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            {post.reactionCount}
          </span>
        </div>
        
        <span className="text-gray-500 text-sm">
          Last activity {timeAgo(post.lastActivityAt)}
        </span>
      </div>
    </div>
  );
};

const CategoryCard = ({ category, isSelected, onClick }: { category: Category; isSelected: boolean; onClick: () => void }) => {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl transition-colors ${
        isSelected
          ? 'bg-pink-500/20 border border-pink-500/50'
          : 'bg-gray-800/30 border border-gray-700 hover:border-gray-600'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{category.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`font-medium ${isSelected ? 'text-pink-400' : 'text-white'}`}>
            {category.name}
          </p>
          <p className="text-gray-500 text-sm truncate">{category.description}</p>
        </div>
        <span className="text-gray-500 text-sm">{category.postCount}</span>
      </div>
    </button>
  );
};

const TrendingTopics = ({ topics }: { topics: TrendingTopic[] }) => {
  return (
    <div className="bg-gray-800/30 rounded-xl border border-gray-700 p-4">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        🔥 Trending Topics
      </h3>
      <div className="space-y-3">
        {topics.map((topic, index) => (
          <Link
            key={topic.tag}
            href={`/community?tag=${topic.tag}`}
            className="flex items-center gap-3 group"
          >
            <span className="text-gray-500 text-sm w-4">{index + 1}</span>
            <div className="flex-1">
              <p className="text-white group-hover:text-pink-400 transition-colors">
                #{topic.tag}
              </p>
              <p className="text-gray-500 text-sm">{topic.postCount} posts</p>
            </div>
            {topic.trend === 'up' && <span className="text-green-400">↑</span>}
            {topic.trend === 'down' && <span className="text-red-400">↓</span>}
          </Link>
        ))}
      </div>
    </div>
  );
};

const CreatePostModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [type, setType] = useState('discussion');
  const [tags, setTags] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      
      <div className="relative bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Create Post</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Post Type */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Post Type</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'discussion', label: '💬 Discussion' },
                { value: 'question', label: '❓ Question' },
                { value: 'experience', label: '✨ Experience' },
                { value: 'article', label: '📄 Article' },
                { value: 'poll', label: '📊 Poll' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setType(option.value)}
                  className={`px-4 py-2 rounded-full text-sm transition-colors ${
                    type === option.value
                      ? 'bg-pink-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Category */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:border-pink-500 focus:outline-none"
            >
              {categories.filter(c => c.id !== 'all' && c.id !== 'announcements').map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Title */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a descriptive title..."
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-pink-500 focus:outline-none"
            />
          </div>
          
          {/* Content */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your thoughts, questions, or experiences..."
              rows={8}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-pink-500 focus:outline-none resize-none"
            />
          </div>
          
          {/* Tags */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Tags (comma separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tarot, love, guidance..."
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-pink-500 focus:outline-none"
            />
          </div>
        </div>
        
        <div className="sticky bottom-0 bg-gray-900 p-4 border-t border-gray-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-800 text-white font-medium rounded-full hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              // Handle post creation
              onClose();
            }}
            className="flex-1 py-3 bg-pink-500 text-white font-medium rounded-full hover:bg-pink-600 transition-colors"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Page Component
export default function CommunityPage() {
  const { isSignedIn } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'trending'>('recent');
  const [postType, setPostType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    // Simulate API call
    const fetchPosts = async () => {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      setPosts(mockPosts);
      setIsLoading(false);
    };

    fetchPosts();
  }, []);

  // Filter and sort posts
  const filteredPosts = useMemo(() => {
    let filtered = [...posts];
    
    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => 
        p.category.toLowerCase().replace(/\s+/g, '-') === selectedCategory
      );
    }
    
    // Filter by type
    if (postType !== 'all') {
      filtered = filtered.filter(p => p.type === postType);
    }
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(query) ||
        p.excerpt.toLowerCase().includes(query) ||
        p.tags.some(t => t.toLowerCase().includes(query))
      );
    }
    
    // Sort (pinned posts always first)
    const pinned = filtered.filter(p => p.isPinned);
    const unpinned = filtered.filter(p => !p.isPinned);
    
    switch (sortBy) {
      case 'popular':
        unpinned.sort((a, b) => b.viewCount - a.viewCount);
        break;
      case 'trending':
        unpinned.sort((a, b) => b.reactionCount - a.reactionCount);
        break;
      default: // recent
        unpinned.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
    
    return [...pinned, ...unpinned];
  }, [posts, selectedCategory, postType, searchQuery, sortBy]);

  const totalPosts = posts.length;
  const totalMembers = 12456; // Mock data

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              Community Forum
            </h1>
            <p className="text-gray-400">
              Connect, share, and learn with fellow spiritual seekers
            </p>
          </div>
          
          {/* Stats */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{totalPosts.toLocaleString()}</div>
              <p className="text-gray-500 text-sm">Posts</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{totalMembers.toLocaleString()}</div>
              <p className="text-gray-500 text-sm">Members</p>
            </div>
            {isSignedIn && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-pink-500 text-white font-semibold rounded-full hover:bg-pink-600 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Post
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="w-full lg:w-72 flex-shrink-0 space-y-6">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pl-12 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-pink-500 focus:outline-none"
              />
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            {/* Categories */}
            <div className="bg-gray-800/30 rounded-xl border border-gray-700 p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Categories</h3>
              <div className="space-y-2">
                {categories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    isSelected={selectedCategory === category.id}
                    onClick={() => setSelectedCategory(category.id)}
                  />
                ))}
              </div>
            </div>
            
            {/* Trending Topics */}
            <TrendingTopics topics={trendingTopics} />
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              {/* Post Type Filter */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'discussion', label: '💬 Discussions' },
                  { value: 'question', label: '❓ Questions' },
                  { value: 'experience', label: '✨ Experiences' },
                  { value: 'article', label: '📄 Articles' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setPostType(option.value)}
                    className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                      postType === option.value
                        ? 'bg-pink-500 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              
              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white focus:border-pink-500 focus:outline-none ml-auto"
              >
                <option value="recent">Most Recent</option>
                <option value="popular">Most Popular</option>
                <option value="trending">Trending</option>
              </select>
            </div>

            {/* Posts */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-400">Loading posts...</p>
                </div>
              </div>
            ) : filteredPosts.length > 0 ? (
              <div className="space-y-4">
                {filteredPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-800/30 rounded-2xl border border-gray-700">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-white mb-2">No Posts Found</h3>
                <p className="text-gray-400 mb-4">
                  Try adjusting your filters or search terms
                </p>
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setPostType('all');
                    setSearchQuery('');
                  }}
                  className="px-6 py-2 bg-pink-500 text-white rounded-full hover:bg-pink-600 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            )}

            {/* Load More */}
            {filteredPosts.length > 0 && (
              <div className="text-center mt-8">
                <button className="px-8 py-3 bg-gray-800 text-white font-medium rounded-full hover:bg-gray-700 transition-colors">
                  Load More Posts
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Post Modal */}
      <CreatePostModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              © 2024 SoulSeer. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link href="/community/guidelines" className="text-gray-500 hover:text-gray-300 text-sm">
                Community Guidelines
              </Link>
              <Link href="/terms" className="text-gray-500 hover:text-gray-300 text-sm">
                Terms
              </Link>
              <Link href="/privacy" className="text-gray-500 hover:text-gray-300 text-sm">
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}