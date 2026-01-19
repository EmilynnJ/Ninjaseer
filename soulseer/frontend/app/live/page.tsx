'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '../components/Header';

// Types
interface LiveStream {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  viewerCount: number;
  status: 'live' | 'scheduled' | 'ended';
  category: string;
  tags: string[];
  reader: {
    id: string;
    displayName: string;
    profileImageUrl: string;
    rating: number;
    isVerified: boolean;
  };
  startedAt?: string;
  scheduledAt?: string;
  duration?: number;
  totalGifts: number;
  isFollowing: boolean;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  streamCount: number;
}

// Mock data
const mockLiveStreams: LiveStream[] = [
  {
    id: '1',
    title: '🌕 Full Moon Tarot Readings - Ask Your Questions!',
    description: 'Join me for a special full moon tarot session. I\'ll be doing live readings and answering your spiritual questions.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
    viewerCount: 342,
    status: 'live',
    category: 'Tarot',
    tags: ['tarot', 'full moon', 'live readings', 'q&a'],
    reader: {
      id: '1',
      displayName: 'Mystic Aurora',
      profileImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
      rating: 4.9,
      isVerified: true
    },
    startedAt: new Date(Date.now() - 45 * 60000).toISOString(),
    totalGifts: 156,
    isFollowing: true
  },
  {
    id: '2',
    title: 'Connecting with Spirit Guides - Mediumship Session',
    description: 'Let me help you connect with your spirit guides and receive messages from the other side.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800',
    viewerCount: 189,
    status: 'live',
    category: 'Mediumship',
    tags: ['mediumship', 'spirit guides', 'messages', 'healing'],
    reader: {
      id: '2',
      displayName: 'Celestial Rose',
      profileImageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200',
      rating: 4.8,
      isVerified: true
    },
    startedAt: new Date(Date.now() - 30 * 60000).toISOString(),
    totalGifts: 89,
    isFollowing: false
  },
  {
    id: '3',
    title: '✨ Weekly Astrology Forecast - What the Stars Say',
    description: 'Your weekly astrological forecast covering all zodiac signs. Learn what the planets have in store for you!',
    thumbnailUrl: 'https://images.unsplash.com/photo-1532968961962-8a0cb3a2d4f5?w=800',
    viewerCount: 567,
    status: 'live',
    category: 'Astrology',
    tags: ['astrology', 'weekly forecast', 'zodiac', 'horoscope'],
    reader: {
      id: '3',
      displayName: 'Luna Starweaver',
      profileImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      rating: 4.9,
      isVerified: true
    },
    startedAt: new Date(Date.now() - 15 * 60000).toISOString(),
    totalGifts: 234,
    isFollowing: true
  },
  {
    id: '4',
    title: 'Chakra Healing & Energy Cleansing Meditation',
    description: 'Join this guided meditation to cleanse your chakras and restore your energy balance.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800',
    viewerCount: 124,
    status: 'live',
    category: 'Energy Healing',
    tags: ['chakra', 'meditation', 'healing', 'energy'],
    reader: {
      id: '4',
      displayName: 'Phoenix Heart',
      profileImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
      rating: 4.7,
      isVerified: true
    },
    startedAt: new Date(Date.now() - 60 * 60000).toISOString(),
    totalGifts: 67,
    isFollowing: false
  }
];

const mockScheduledStreams: LiveStream[] = [
  {
    id: '5',
    title: 'New Moon Manifestation Ritual 🌑',
    description: 'A powerful manifestation ritual to set your intentions for the new lunar cycle.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1532968961962-8a0cb3a2d4f5?w=800',
    viewerCount: 0,
    status: 'scheduled',
    category: 'Spiritual Guidance',
    tags: ['new moon', 'manifestation', 'ritual', 'intentions'],
    reader: {
      id: '1',
      displayName: 'Mystic Aurora',
      profileImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
      rating: 4.9,
      isVerified: true
    },
    scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60000).toISOString(),
    totalGifts: 0,
    isFollowing: true
  },
  {
    id: '6',
    title: 'Past Life Regression Workshop',
    description: 'Explore your past lives and understand how they influence your current journey.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800',
    viewerCount: 0,
    status: 'scheduled',
    category: 'Past Lives',
    tags: ['past lives', 'regression', 'workshop', 'soul journey'],
    reader: {
      id: '2',
      displayName: 'Celestial Rose',
      profileImageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200',
      rating: 4.8,
      isVerified: true
    },
    scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60000).toISOString(),
    totalGifts: 0,
    isFollowing: false
  },
  {
    id: '7',
    title: 'Mercury Retrograde Survival Guide',
    description: 'Everything you need to know to navigate Mercury retrograde successfully.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800',
    viewerCount: 0,
    status: 'scheduled',
    category: 'Astrology',
    tags: ['mercury retrograde', 'astrology', 'guide', 'survival'],
    reader: {
      id: '3',
      displayName: 'Luna Starweaver',
      profileImageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      rating: 4.9,
      isVerified: true
    },
    scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60000).toISOString(),
    totalGifts: 0,
    isFollowing: true
  }
];

const categories: Category[] = [
  { id: 'all', name: 'All Streams', icon: '🌟', streamCount: 12 },
  { id: 'tarot', name: 'Tarot', icon: '🃏', streamCount: 4 },
  { id: 'astrology', name: 'Astrology', icon: '⭐', streamCount: 3 },
  { id: 'mediumship', name: 'Mediumship', icon: '👻', streamCount: 2 },
  { id: 'energy-healing', name: 'Energy Healing', icon: '✨', streamCount: 2 },
  { id: 'spiritual-guidance', name: 'Spiritual', icon: '🙏', streamCount: 1 }
];

// Components
const LiveBadge = () => (
  <span className="flex items-center gap-1 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">
    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
    LIVE
  </span>
);

const ViewerCount = ({ count }: { count: number }) => (
  <span className="flex items-center gap-1 px-2 py-1 bg-black/60 text-white text-xs rounded">
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
    </svg>
    {count.toLocaleString()}
  </span>
);

const StreamDuration = ({ startedAt }: { startedAt: string }) => {
  const [duration, setDuration] = useState('');

  useEffect(() => {
    const updateDuration = () => {
      const start = new Date(startedAt).getTime();
      const now = Date.now();
      const diff = Math.floor((now - start) / 1000);
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      
      if (hours > 0) {
        setDuration(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setDuration(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <span className="px-2 py-1 bg-black/60 text-white text-xs rounded">
      {duration}
    </span>
  );
};

const LiveStreamCard = ({ stream }: { stream: LiveStream }) => {
  return (
    <Link href={`/live/${stream.id}`} className="group block">
      <div className="relative aspect-video rounded-xl overflow-hidden mb-3">
        <Image
          src={stream.thumbnailUrl}
          alt={stream.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        
        {/* Top badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <LiveBadge />
          <ViewerCount count={stream.viewerCount} />
        </div>
        
        {/* Duration */}
        {stream.startedAt && (
          <div className="absolute top-3 right-3">
            <StreamDuration startedAt={stream.startedAt} />
          </div>
        )}
        
        {/* Bottom info */}
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-pink-500/80 text-white text-xs rounded">
              {stream.category}
            </span>
            {stream.totalGifts > 0 && (
              <span className="px-2 py-1 bg-yellow-500/80 text-white text-xs rounded flex items-center gap-1">
                🎁 {stream.totalGifts}
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Stream info */}
      <div className="flex gap-3">
        <div className="relative flex-shrink-0">
          <Image
            src={stream.reader.profileImageUrl}
            alt={stream.reader.displayName}
            width={40}
            height={40}
            className="rounded-full"
          />
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-gray-900 flex items-center justify-center">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium line-clamp-2 group-hover:text-pink-400 transition-colors">
            {stream.title}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-400 text-sm">{stream.reader.displayName}</span>
            {stream.reader.isVerified && (
              <svg className="w-4 h-4 text-pink-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-yellow-400 text-sm">★ {stream.reader.rating}</span>
            <span className="text-gray-500 text-sm">•</span>
            <span className="text-gray-500 text-sm">{stream.viewerCount.toLocaleString()} watching</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

const ScheduledStreamCard = ({ stream }: { stream: LiveStream }) => {
  const scheduledDate = new Date(stream.scheduledAt!);
  const isToday = scheduledDate.toDateString() === new Date().toDateString();
  const isTomorrow = scheduledDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
  
  const getDateLabel = () => {
    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';
    return scheduledDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-gray-800/50 rounded-xl overflow-hidden border border-gray-700 hover:border-pink-500/50 transition-colors group">
      <div className="relative aspect-video">
        <Image
          src={stream.thumbnailUrl}
          alt={stream.title}
          fill
          className="object-cover opacity-70 group-hover:opacity-100 transition-opacity"
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
        
        {/* Scheduled badge */}
        <div className="absolute top-3 left-3">
          <span className="px-3 py-1 bg-purple-500 text-white text-xs font-bold rounded">
            SCHEDULED
          </span>
        </div>
        
        {/* Date/time */}
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-bold">{getDateLabel()}</p>
              <p className="text-gray-300 text-sm">
                {scheduledDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
            <button className="px-4 py-2 bg-pink-500 text-white text-sm font-medium rounded-full hover:bg-pink-600 transition-colors">
              Set Reminder
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Image
            src={stream.reader.profileImageUrl}
            alt={stream.reader.displayName}
            width={40}
            height={40}
            className="rounded-full"
          />
          
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium line-clamp-2 group-hover:text-pink-400 transition-colors">
              {stream.title}
            </h3>
            <p className="text-gray-400 text-sm mt-1">{stream.reader.displayName}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                {stream.category}
              </span>
              {stream.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="px-2 py-1 bg-gray-700/50 text-gray-400 text-xs rounded">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FeaturedStream = ({ stream }: { stream: LiveStream }) => {
  return (
    <Link href={`/live/${stream.id}`} className="block group">
      <div className="relative aspect-[21/9] rounded-2xl overflow-hidden">
        <Image
          src={stream.thumbnailUrl}
          alt={stream.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
        
        {/* Content */}
        <div className="absolute inset-0 p-8 flex flex-col justify-end">
          <div className="max-w-2xl">
            {/* Badges */}
            <div className="flex items-center gap-3 mb-4">
              <LiveBadge />
              <ViewerCount count={stream.viewerCount} />
              <span className="px-3 py-1 bg-pink-500/80 text-white text-sm rounded-full">
                {stream.category}
              </span>
            </div>
            
            {/* Title */}
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 group-hover:text-pink-400 transition-colors">
              {stream.title}
            </h2>
            
            {/* Description */}
            <p className="text-gray-300 text-lg mb-4 line-clamp-2">
              {stream.description}
            </p>
            
            {/* Reader info */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Image
                  src={stream.reader.profileImageUrl}
                  alt={stream.reader.displayName}
                  width={48}
                  height={48}
                  className="rounded-full border-2 border-pink-500"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{stream.reader.displayName}</span>
                    {stream.reader.isVerified && (
                      <svg className="w-5 h-5 text-pink-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="text-yellow-400 text-sm">★ {stream.reader.rating}</span>
                </div>
              </div>
              
              <button className="ml-auto px-6 py-3 bg-pink-500 text-white font-semibold rounded-full hover:bg-pink-600 transition-colors">
                Watch Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

const CategoryFilter = ({ 
  categories, 
  selected, 
  onSelect 
}: { 
  categories: Category[]; 
  selected: string; 
  onSelect: (id: string) => void;
}) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onSelect(category.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
            selected === category.id
              ? 'bg-pink-500 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <span>{category.icon}</span>
          <span>{category.name}</span>
          <span className={`text-xs ${selected === category.id ? 'text-pink-200' : 'text-gray-500'}`}>
            ({category.streamCount})
          </span>
        </button>
      ))}
    </div>
  );
};

// Main Page Component
export default function LiveStreamsPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'viewers' | 'recent' | 'gifts'>('viewers');
  const [showScheduled, setShowScheduled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [scheduledStreams, setScheduledStreams] = useState<LiveStream[]>([]);

  useEffect(() => {
    // Simulate API call
    const fetchStreams = async () => {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      setLiveStreams(mockLiveStreams);
      setScheduledStreams(mockScheduledStreams);
      setIsLoading(false);
    };

    fetchStreams();
  }, []);

  // Filter and sort streams
  const filteredLiveStreams = useMemo(() => {
    let filtered = [...liveStreams];
    
    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(s => 
        s.category.toLowerCase().replace(/\s+/g, '-') === selectedCategory
      );
    }
    
    // Sort
    switch (sortBy) {
      case 'viewers':
        filtered.sort((a, b) => b.viewerCount - a.viewerCount);
        break;
      case 'recent':
        filtered.sort((a, b) => 
          new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime()
        );
        break;
      case 'gifts':
        filtered.sort((a, b) => b.totalGifts - a.totalGifts);
        break;
    }
    
    return filtered;
  }, [liveStreams, selectedCategory, sortBy]);

  const filteredScheduledStreams = useMemo(() => {
    if (selectedCategory === 'all') return scheduledStreams;
    return scheduledStreams.filter(s => 
      s.category.toLowerCase().replace(/\s+/g, '-') === selectedCategory
    );
  }, [scheduledStreams, selectedCategory]);

  // Get featured stream (highest viewers)
  const featuredStream = liveStreams.length > 0 
    ? liveStreams.reduce((prev, current) => 
        prev.viewerCount > current.viewerCount ? prev : current
      )
    : null;

  const totalViewers = liveStreams.reduce((sum, s) => sum + s.viewerCount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                Live Streams
              </h1>
              <p className="text-gray-400">
                Watch live spiritual readings and connect with our gifted readers
              </p>
            </div>
            
            {/* Live stats */}
            <div className="hidden md:flex items-center gap-6">
              <div className="text-center">
                <div className="flex items-center gap-2 text-red-400">
                  <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-2xl font-bold">{liveStreams.length}</span>
                </div>
                <p className="text-gray-500 text-sm">Live Now</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">
                  {totalViewers.toLocaleString()}
                </div>
                <p className="text-gray-500 text-sm">Watching</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">
                  {scheduledStreams.length}
                </div>
                <p className="text-gray-500 text-sm">Upcoming</p>
              </div>
            </div>
          </div>
          
          {/* Category filter */}
          <CategoryFilter
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Loading streams...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Featured Stream */}
            {featuredStream && selectedCategory === 'all' && (
              <section className="mb-12">
                <FeaturedStream stream={featuredStream} />
              </section>
            )}

            {/* Live Streams */}
            <section className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <h2 className="text-2xl font-bold text-white">Live Now</h2>
                  <span className="text-gray-500">({filteredLiveStreams.length})</span>
                </div>
                
                {/* Sort options */}
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-pink-500 focus:outline-none"
                  >
                    <option value="viewers">Most Viewers</option>
                    <option value="recent">Recently Started</option>
                    <option value="gifts">Most Gifts</option>
                  </select>
                </div>
              </div>
              
              {filteredLiveStreams.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredLiveStreams
                    .filter(s => s.id !== featuredStream?.id || selectedCategory !== 'all')
                    .map((stream) => (
                      <LiveStreamCard key={stream.id} stream={stream} />
                    ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-800/30 rounded-2xl border border-gray-700">
                  <div className="text-6xl mb-4">📺</div>
                  <h3 className="text-xl font-semibold text-white mb-2">No Live Streams</h3>
                  <p className="text-gray-400 mb-4">
                    No one is streaming in this category right now.
                  </p>
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className="px-6 py-2 bg-pink-500 text-white rounded-full hover:bg-pink-600 transition-colors"
                  >
                    View All Streams
                  </button>
                </div>
              )}
            </section>

            {/* Scheduled Streams */}
            {showScheduled && filteredScheduledStreams.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📅</span>
                    <h2 className="text-2xl font-bold text-white">Upcoming Streams</h2>
                    <span className="text-gray-500">({filteredScheduledStreams.length})</span>
                  </div>
                  
                  <button
                    onClick={() => setShowScheduled(false)}
                    className="text-gray-500 hover:text-gray-300 text-sm"
                  >
                    Hide
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredScheduledStreams.map((stream) => (
                    <ScheduledStreamCard key={stream.id} stream={stream} />
                  ))}
                </div>
              </section>
            )}

            {/* Become a Streamer CTA */}
            <section className="mt-16">
              <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-2xl p-8 md:p-12 border border-purple-500/30">
                <div className="max-w-3xl mx-auto text-center">
                  <h2 className="text-3xl font-bold text-white mb-4">
                    Share Your Gift with the World
                  </h2>
                  <p className="text-gray-300 text-lg mb-6">
                    Are you a psychic reader? Start streaming on SoulSeer and connect with thousands of seekers. 
                    Earn money through tips, gifts, and grow your spiritual practice.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link
                      href="/become-reader"
                      className="px-8 py-3 bg-pink-500 text-white font-semibold rounded-full hover:bg-pink-600 transition-colors"
                    >
                      Become a Reader
                    </Link>
                    <Link
                      href="/streaming-guide"
                      className="px-8 py-3 bg-gray-800 text-white font-semibold rounded-full hover:bg-gray-700 transition-colors"
                    >
                      Learn More
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-gray-500 text-sm">
              © 2024 SoulSeer. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link href="/terms" className="text-gray-500 hover:text-gray-300 text-sm">
                Terms
              </Link>
              <Link href="/privacy" className="text-gray-500 hover:text-gray-300 text-sm">
                Privacy
              </Link>
              <Link href="/help" className="text-gray-500 hover:text-gray-300 text-sm">
                Help
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}