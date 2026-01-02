'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from './components/Header';

interface Reader {
  user_id: string;
  display_name: string;
  specialties: string[];
  chat_rate: number;
  video_rate: number;
  average_rating: number;
  profile_picture_url: string;
}

interface LiveStream {
  id: string;
  title: string;
  description: string;
  viewer_count: number;
  display_name: string;
}

export default function Home() {
  const [onlineReaders, setOnlineReaders] = useState<Reader[]>([]);
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Mock data for demo purposes (until database is connected)
      setOnlineReaders([
        {
          user_id: '1',
          display_name: 'Mystic Luna',
          specialties: ['Tarot', 'Love &amp; Relationships'],
          chat_rate: 2.99,
          video_rate: 4.99,
          average_rating: 4.8,
          profile_picture_url: 'https://i.pravatar.cc/150?img=1'
        },
        {
          user_id: '2',
          display_name: 'Oracle Sarah',
          specialties: ['Astrology', 'Career'],
          chat_rate: 3.99,
          video_rate: 5.99,
          average_rating: 4.9,
          profile_picture_url: 'https://i.pravatar.cc/150?img=2'
        }
      ]);

      setLiveStreams([
        {
          id: '1',
          title: 'Full Moon Reading Session',
          description: 'Join me for insights under the full moon',
          viewer_count: 234,
          display_name: 'Mystic Luna'
        }
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="font-alex-brush text-7xl md:text-9xl text-mystical-pink mb-8 animate-float">
          SoulSeer
        </h1>
        
        {/* Hero Image Placeholder */}
        <div className="relative w-full max-w-4xl mx-auto h-96 mb-8 rounded-2xl overflow-hidden mystical-glow">
          <div className="absolute inset-0 bg-gradient-to-br from-mystical-purple/30 via-mystical-pink/20 to-mystical-gold/30 backdrop-blur-sm flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">🔮</div>
              <p className="text-2xl text-white font-playfair">Mystical Guidance Awaits</p>
            </div>
          </div>
        </div>

        <h2 className="font-playfair text-4xl md:text-5xl text-white mb-12">
          A Community of Gifted Psychics
        </h2>

        <div className="flex gap-6 justify-center flex-wrap">
          <Link href="/readings">
            <button className="btn-mystical text-lg px-8 py-4">
              Start a Reading
            </button>
          </Link>
          <Link href="/readings">
            <button className="btn-gold text-lg px-8 py-4">
              Browse Readers
            </button>
          </Link>
        </div>
      </section>

      {/* Online Readers Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="flex justify-between items-center mb-12">
          <h2 className="font-playfair text-4xl gradient-text">
            Readers Online Now
          </h2>
          <Link href="/readings" className="text-mystical-pink hover:text-mystical-darkPink transition">
            View All →
          </Link>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner w-12 h-12"></div>
          </div>
        ) : onlineReaders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">No readers online at the moment</p>
            <Link href="/readings">
              <button className="btn-mystical">View All Readers</button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {onlineReaders.map((reader) => (
              <Link key={reader.user_id} href="/readings">
                <div className="mystical-card p-6 mystical-glow-hover cursor-pointer">
                  <div className="absolute top-4 right-4 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    ONLINE
                  </div>
                  
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-mystical-pink to-mystical-purple flex items-center justify-center text-4xl overflow-hidden">
                    {reader.profile_picture_url ? (
                      <img src={reader.profile_picture_url} alt={reader.display_name} className="w-full h-full object-cover" />
                    ) : (
                      '🌟'
                    )}
                  </div>
                  
                  <h3 className="font-playfair text-xl text-white text-center mb-2">
                    {reader.display_name}
                  </h3>
                  
                  <div className="flex justify-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} className={star <= reader.average_rating ? 'text-mystical-gold' : 'text-gray-600'}>
                        ⭐
                      </span>
                    ))}
                  </div>
                  
                  <div className="flex flex-wrap justify-center gap-2 mb-4">
                    {reader.specialties?.slice(0, 2).map((specialty, idx) => (
                      <span key={idx} className="text-xs bg-mystical-purple/30 text-mystical-pink px-2 py-1 rounded-full">
                        {specialty}
                      </span>
                    ))}
                  </div>
                  
                  <div className="flex justify-between text-sm text-gray-400 mb-4">
                    <span>Chat: ${reader.chat_rate}/min</span>
                    <span>Video: ${reader.video_rate}/min</span>
                  </div>
                  
                  <button className="btn-mystical w-full">
                    Connect Now
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Live Streams Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="flex justify-between items-center mb-12">
          <h2 className="font-playfair text-4xl gradient-text">
            Live Streams
          </h2>
          <Link href="/live" className="text-mystical-pink hover:text-mystical-darkPink transition">
            View All →
          </Link>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="spinner w-12 h-12"></div>
          </div>
        ) : liveStreams.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">No live streams at the moment</p>
            <Link href="/live">
              <button className="btn-mystical">View Scheduled Streams</button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {liveStreams.map((stream) => (
              <Link key={stream.id} href={`/live/${stream.id}`}>
                <div className="mystical-card overflow-hidden mystical-glow-hover cursor-pointer">
                  <div className="relative h-48 bg-gradient-to-br from-mystical-purple/50 to-mystical-pink/50 flex items-center justify-center">
                    <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                      LIVE
                    </div>
                    <div className="text-6xl">🎭</div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-playfair text-xl text-white mb-2">
                      {stream.title}
                    </h3>
                    <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                      {stream.description}
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="text-mystical-pink">👁️ {stream.viewer_count} watching</span>
                      <button className="btn-mystical text-sm px-4 py-2">
                        Join Stream
                      </button>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-6xl mb-4">💬</div>
            <h3 className="font-playfair text-2xl text-mystical-pink mb-3">
              Instant Readings
            </h3>
            <p className="text-gray-300">
              Connect with gifted psychics through chat, call, or video for immediate guidance
            </p>
          </div>
          <div className="text-center">
            <div className="text-6xl mb-4">🎁</div>
            <h3 className="font-playfair text-2xl text-mystical-pink mb-3">
              Virtual Gifting
            </h3>
            <p className="text-gray-300">
              Show appreciation to your favorite readers during live streams with virtual gifts
            </p>
          </div>
          <div className="text-center">
            <div className="text-6xl mb-4">🛍️</div>
            <h3 className="font-playfair text-2xl text-mystical-pink mb-3">
              Mystical Shop
            </h3>
            <p className="text-gray-300">
              Explore spiritual products, guides, and exclusive reader offerings
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-12 mt-20 border-t border-mystical-pink/30">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-alex-brush text-3xl text-mystical-pink mb-4">
              SoulSeer
            </h3>
            <p className="text-gray-400 text-sm">
              A Community of Gifted Psychics
            </p>
          </div>
          <div>
            <h4 className="font-playfair text-lg text-white mb-4">Services</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><Link href="/readings" className="hover:text-mystical-pink transition">Readings</Link></li>
              <li><Link href="/live" className="hover:text-mystical-pink transition">Live Streams</Link></li>
              <li><Link href="/shop" className="hover:text-mystical-pink transition">Shop</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-playfair text-lg text-white mb-4">Community</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><Link href="/community" className="hover:text-mystical-pink transition">Forum</Link></li>
              <li><Link href="/messages" className="hover:text-mystical-pink transition">Messages</Link></li>
              <li><Link href="/help" className="hover:text-mystical-pink transition">Help Center</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-playfair text-lg text-white mb-4">Account</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><Link href="/dashboard" className="hover:text-mystical-pink transition">Dashboard</Link></li>
              <li><Link href="/profile" className="hover:text-mystical-pink transition">Profile</Link></li>
              <li><Link href="/sign-in" className="hover:text-mystical-pink transition">Sign In</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-mystical-pink/20 text-center text-gray-500 text-sm">
          <p>&copy; 2024 SoulSeer. All rights reserved. Built by NinjaTech AI</p>
        </div>
      </footer>
    </div>
  );
}