'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';

interface LiveStream {
  id: string;
  reader_id: string;
  title: string;
  description: string;
  stream_type: string;
  viewer_count: number;
  total_gifts_received: number;
  display_name: string;
  profile_picture_url: string;
  average_rating: number;
  created_at: string;
}

interface VirtualGift {
  id: string;
  name: string;
  description: string;
  price: number;
  icon_url: string;
}

export default function LivePage() {
  const router = useRouter();
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [scheduledStreams, setScheduledStreams] = useState<LiveStream[]>([]);
  const [gifts, setGifts] = useState<VirtualGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'live' | 'scheduled'>('live');

  useEffect(() => {
    fetchStreams();
    fetchGifts();
  }, []);

  const fetchStreams = async () => {
    try {
      setLoading(true);

      // Fetch live streams
      const liveResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/streams/live?limit=50`
      );

      if (liveResponse.ok) {
        const liveData = await liveResponse.json();
        setLiveStreams(liveData.streams);
      }

      // Fetch scheduled streams
      const scheduledResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/streams/scheduled?limit=50`
      );

      if (scheduledResponse.ok) {
        const scheduledData = await scheduledResponse.json();
        setScheduledStreams(scheduledData.streams);
      }
    } catch (error) {
      console.error('Error fetching streams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGifts = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/streams/gifts`
      );

      if (response.ok) {
        const data = await response.json();
        setGifts(data.gifts);
      }
    } catch (error) {
      console.error('Error fetching gifts:', error);
    }
  };

  const joinStream = async (streamId: string) => {
    router.push(`/live/${streamId}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen">
      <Header />

      {/* Page Header */}
      <section className="container mx-auto px-4 py-12 text-center">
        <h1 className="font-playfair text-5xl text-white mb-4">
          Live Spiritual Streams
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Join live readings, Q&A sessions, and spiritual guidance
        </p>

        {/* Tabs */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-8 py-3 rounded-full transition ${
              activeTab === 'live'
                ? 'bg-mystical-pink text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            🔴 Live Now ({liveStreams.length})
          </button>
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`px-8 py-3 rounded-full transition ${
              activeTab === 'scheduled'
                ? 'bg-mystical-pink text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            📅 Scheduled ({scheduledStreams.length})
          </button>
        </div>
      </section>

      {/* Streams Grid */}
      <section className="container mx-auto px-4 pb-20">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="spinner w-16 h-16"></div>
          </div>
        ) : (
          <>
            {/* Live Streams */}
            {activeTab === 'live' && (
              <>
                {liveStreams.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="text-6xl mb-4">🎭</div>
                    <p className="text-2xl text-gray-400 mb-4">No live streams at the moment</p>
                    <p className="text-gray-500">Check back soon or view scheduled streams</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {liveStreams.map((stream) => (
                      <div
                        key={stream.id}
                        className="mystical-card overflow-hidden mystical-glow-hover cursor-pointer"
                        onClick={() => joinStream(stream.id)}
                      >
                        {/* Thumbnail */}
                        <div className="relative h-48 bg-gradient-to-br from-mystical-purple/50 to-mystical-pink/50 flex items-center justify-center">
                          <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                            LIVE
                          </div>
                          <div className="text-6xl">
                            {stream.profile_picture_url ? (
                              <img 
                                src={stream.profile_picture_url} 
                                alt={stream.display_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              '🎭'
                            )}
                          </div>
                        </div>

                        {/* Stream Info */}
                        <div className="p-4">
                          {/* Reader Info */}
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-mystical-pink to-mystical-purple flex items-center justify-center text-xl">
                              {stream.profile_picture_url ? (
                                <img 
                                  src={stream.profile_picture_url} 
                                  alt={stream.display_name}
                                  className="w-full h-full object-cover rounded-full"
                                />
                              ) : (
                                '🔮'
                              )}
                            </div>
                            <div>
                              <h4 className="font-playfair text-white font-bold">
                                {stream.display_name}
                              </h4>
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <span
                                    key={star}
                                    className={star <= stream.average_rating ? 'text-mystical-gold text-xs' : 'text-gray-600 text-xs'}
                                  >
                                    ⭐
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Title */}
                          <h3 className="font-playfair text-xl text-white mb-2">
                            {stream.title}
                          </h3>

                          {/* Description */}
                          <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                            {stream.description}
                          </p>

                          {/* Stats */}
                          <div className="flex justify-between items-center">
                            <span className="text-mystical-pink flex items-center gap-1">
                              👁️ {stream.viewer_count} watching
                            </span>
                            <span className="text-mystical-gold flex items-center gap-1">
                              🎁 ${stream.total_gifts_received.toFixed(0)}
                            </span>
                          </div>

                          {/* Join Button */}
                          <button className="btn-mystical w-full mt-4">
                            Join Stream
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Scheduled Streams */}
            {activeTab === 'scheduled' && (
              <>
                {scheduledStreams.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="text-6xl mb-4">📅</div>
                    <p className="text-2xl text-gray-400 mb-4">No scheduled streams</p>
                    <p className="text-gray-500">Check back later for upcoming events</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {scheduledStreams.map((stream) => (
                      <div
                        key={stream.id}
                        className="mystical-card overflow-hidden"
                      >
                        {/* Thumbnail */}
                        <div className="relative h-48 bg-gradient-to-br from-mystical-purple/30 to-mystical-pink/30 flex items-center justify-center">
                          <div className="absolute top-4 right-4 bg-mystical-gold text-black px-3 py-1 rounded-full text-sm font-bold">
                            SCHEDULED
                          </div>
                          <div className="text-6xl">📅</div>
                        </div>

                        {/* Stream Info */}
                        <div className="p-4">
                          {/* Reader Info */}
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-mystical-pink to-mystical-purple flex items-center justify-center text-xl">
                              🔮
                            </div>
                            <div>
                              <h4 className="font-playfair text-white font-bold">
                                {stream.display_name}
                              </h4>
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <span
                                    key={star}
                                    className={star <= stream.average_rating ? 'text-mystical-gold text-xs' : 'text-gray-600 text-xs'}
                                  >
                                    ⭐
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Title */}
                          <h3 className="font-playfair text-xl text-white mb-2">
                            {stream.title}
                          </h3>

                          {/* Description */}
                          <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                            {stream.description}
                          </p>

                          {/* Schedule Time */}
                          <div className="bg-black/40 rounded-lg p-3 mb-3">
                            <p className="text-mystical-pink text-center">
                              🕐 {formatDate(stream.created_at)}
                            </p>
                          </div>

                          {/* Reminder Button */}
                          <button className="w-full px-6 py-3 rounded-full border-2 border-mystical-pink text-white hover:bg-mystical-pink/10 transition">
                            Set Reminder
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>

      {/* Virtual Gifts Section */}
      {gifts.length > 0 && (
        <section className="container mx-auto px-4 pb-20">
          <h2 className="font-playfair text-3xl text-center mb-8 gradient-text">
            Virtual Gifts
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {gifts.map((gift) => (
              <div
                key={gift.id}
                className="mystical-card p-4 text-center"
              >
                <div className="text-4xl mb-2">
                  {gift.icon_url ? (
                    <img src={gift.icon_url} alt={gift.name} className="w-12 h-12 mx-auto" />
                  ) : (
                    '🎁'
                  )}
                </div>
                <h4 className="text-white font-bold mb-1">{gift.name}</h4>
                <p className="text-mystical-gold font-bold">${gift.price}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}