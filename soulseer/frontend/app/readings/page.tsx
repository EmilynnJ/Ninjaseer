'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';

interface Reader {
  user_id: string;
  display_name: string;
  bio: string;
  profile_picture_url: string;
  specialties: string[];
  chat_rate: number;
  call_rate: number;
  video_rate: number;
  is_online: boolean;
  status: string;
  average_rating: number;
  total_reviews: number;
  total_sessions: number;
}

export default function ReadingsPage() {
  const router = useRouter();
  const [readers, setReaders] = useState<Reader[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('online');
  const [selectedReader, setSelectedReader] = useState<Reader | null>(null);
  const [sessionType, setSessionType] = useState<'chat' | 'call' | 'video'>('chat');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchReaders();
  }, [filter]);

  const fetchReaders = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/readers?status=${filter === 'all' ? '' : filter}&limit=50`
      );

      if (response.ok) {
        const data = await response.json();
        setReaders(data.readers);
      }
    } catch (error) {
      console.error('Error fetching readers:', error);
    } finally {
      setLoading(false);
    }
  };

  const startReading = async () => {
    if (!selectedReader) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/sessions/start`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            readerId: selectedReader.user_id,
            sessionType,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to start session');
        return;
      }

      const data = await response.json();
      router.push(`/reading/${data.session.id}`);
    } catch (error) {
      console.error('Error starting session:', error);
      alert('Failed to start session. Please try again.');
    }
  };

  const getRateForType = (reader: Reader, type: string) => {
    switch (type) {
      case 'chat': return reader.chat_rate;
      case 'call': return reader.call_rate;
      case 'video': return reader.video_rate;
      default: return reader.chat_rate;
    }
  };

  return (
    <div className="min-h-screen">
      <Header />

      {/* Page Header */}
      <section className="container mx-auto px-4 py-12 text-center">
        <h1 className="font-playfair text-5xl text-white mb-4">
          Connect with Gifted Readers
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Choose from chat, voice, or video readings with our talented psychics
        </p>

        {/* Filters */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => setFilter('online')}
            className={`px-6 py-3 rounded-full transition ${
              filter === 'online'
                ? 'bg-mystical-pink text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            🟢 Online Now
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-6 py-3 rounded-full transition ${
              filter === 'all'
                ? 'bg-mystical-pink text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            All Readers
          </button>
        </div>
      </section>

      {/* Readers Grid */}
      <section className="container mx-auto px-4 pb-20">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="spinner w-16 h-16"></div>
          </div>
        ) : readers.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-2xl text-gray-400">No readers available at the moment</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {readers.map((reader) => (
              <div
                key={reader.user_id}
                className="mystical-card p-6 mystical-glow-hover cursor-pointer"
                onClick={() => {
                  setSelectedReader(reader);
                  setShowModal(true);
                }}
              >
                {/* Status Badge */}
                {reader.is_online && (
                  <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    ONLINE
                  </div>
                )}

                {/* Profile Picture */}
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-mystical-pink to-mystical-purple flex items-center justify-center text-4xl overflow-hidden">
                  {reader.profile_picture_url ? (
                    <img src={reader.profile_picture_url} alt={reader.display_name} className="w-full h-full object-cover" />
                  ) : (
                    '🔮'
                  )}
                </div>

                {/* Name */}
                <h3 className="font-playfair text-xl text-white text-center mb-2">
                  {reader.display_name}
                </h3>

                {/* Rating */}
                <div className="flex justify-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={star <= reader.average_rating ? 'text-mystical-gold' : 'text-gray-600'}
                    >
                      ⭐
                    </span>
                  ))}
                  <span className="text-gray-400 text-sm ml-2">
                    ({reader.total_reviews})
                  </span>
                </div>

                {/* Specialties */}
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                  {reader.specialties?.slice(0, 3).map((specialty, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-mystical-purple/30 text-mystical-pink px-2 py-1 rounded-full"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>

                {/* Bio */}
                <p className="text-gray-300 text-center text-sm mb-4 line-clamp-2">
                  {reader.bio || 'Experienced spiritual guide ready to help you find clarity.'}
                </p>

                {/* Rates */}
                <div className="space-y-2 text-sm text-gray-400 mb-4">
                  <div className="flex justify-between">
                    <span>💬 Chat:</span>
                    <span className="text-mystical-gold font-bold">${reader.chat_rate}/min</span>
                  </div>
                  <div className="flex justify-between">
                    <span>📞 Call:</span>
                    <span className="text-mystical-gold font-bold">${reader.call_rate}/min</span>
                  </div>
                  <div className="flex justify-between">
                    <span>📹 Video:</span>
                    <span className="text-mystical-gold font-bold">${reader.video_rate}/min</span>
                  </div>
                </div>

                {/* Connect Button */}
                <button
                  className={`w-full ${reader.is_online ? 'btn-mystical' : 'bg-gray-600 text-gray-400 cursor-not-allowed px-6 py-3 rounded-full'}`}
                  disabled={!reader.is_online}
                >
                  {reader.is_online ? 'Connect Now' : 'Offline'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Session Type Modal */}
      {showModal && selectedReader && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="mystical-card max-w-lg w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-playfair text-3xl text-mystical-pink">
                Start Reading
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white transition text-2xl"
              >
                ×
              </button>
            </div>

            {/* Reader Info */}
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-mystical-pink/30">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-mystical-pink to-mystical-purple flex items-center justify-center text-2xl">
                {selectedReader.profile_picture_url ? (
                  <img src={selectedReader.profile_picture_url} alt={selectedReader.display_name} className="w-full h-full object-cover rounded-full" />
                ) : (
                  '🔮'
                )}
              </div>
              <div>
                <h3 className="font-playfair text-xl text-white">
                  {selectedReader.display_name}
                </h3>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={star <= selectedReader.average_rating ? 'text-mystical-gold text-sm' : 'text-gray-600 text-sm'}
                    >
                      ⭐
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Session Type Selection */}
            <div className="space-y-4 mb-6">
              <p className="text-gray-300 mb-4">Choose your reading type:</p>

              <button
                onClick={() => setSessionType('chat')}
                className={`w-full p-4 rounded-xl border-2 transition text-left ${
                  sessionType === 'chat'
                    ? 'border-mystical-pink bg-mystical-pink/10'
                    : 'border-mystical-pink/30 hover:border-mystical-pink/60'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xl mb-1">💬 Chat Reading</div>
                    <div className="text-sm text-gray-400">Text-based conversation</div>
                  </div>
                  <div className="text-2xl font-bold text-mystical-gold">
                    ${selectedReader.chat_rate}/min
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSessionType('call')}
                className={`w-full p-4 rounded-xl border-2 transition text-left ${
                  sessionType === 'call'
                    ? 'border-mystical-pink bg-mystical-pink/10'
                    : 'border-mystical-pink/30 hover:border-mystical-pink/60'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xl mb-1">📞 Voice Call</div>
                    <div className="text-sm text-gray-400">Audio-only conversation</div>
                  </div>
                  <div className="text-2xl font-bold text-mystical-gold">
                    ${selectedReader.call_rate}/min
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSessionType('video')}
                className={`w-full p-4 rounded-xl border-2 transition text-left ${
                  sessionType === 'video'
                    ? 'border-mystical-pink bg-mystical-pink/10'
                    : 'border-mystical-pink/30 hover:border-mystical-pink/60'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xl mb-1">📹 Video Call</div>
                    <div className="text-sm text-gray-400">Face-to-face reading</div>
                  </div>
                  <div className="text-2xl font-bold text-mystical-gold">
                    ${selectedReader.video_rate}/min
                  </div>
                </div>
              </button>
            </div>

            {/* Estimated Cost */}
            <div className="bg-black/40 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Estimated 10 min session:</span>
                <span className="text-2xl font-bold text-mystical-pink">
                  ${(getRateForType(selectedReader, sessionType) * 10).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-6 py-3 rounded-full border-2 border-mystical-pink/50 text-white hover:border-mystical-pink transition"
              >
                Cancel
              </button>
              <button
                onClick={startReading}
                className="flex-1 btn-mystical"
              >
                Start Reading
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-4">
              You'll be charged per minute. Minimum 5 minutes of balance required.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}