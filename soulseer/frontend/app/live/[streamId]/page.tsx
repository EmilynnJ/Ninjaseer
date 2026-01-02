'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '../../components/Header';
import AgoraRTC, { IAgoraRTCClient, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';

interface VirtualGift {
  id: string;
  name: string;
  price: number;
  icon_url: string;
}

export default function LiveStreamViewer() {
  const params = useParams();
  const router = useRouter();
  const streamId = params.streamId as string;

  const [loading, setLoading] = useState(true);
  const [streamData, setStreamData] = useState<any>(null);
  const [gifts, setGifts] = useState<VirtualGift[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [showGifts, setShowGifts] = useState(false);

  const rtcClient = useRef<IAgoraRTCClient | null>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeStream();
    fetchGifts();
    
    return () => {
      cleanup();
    };
  }, [streamId]);

  const initializeStream = async () => {
    try {
      setLoading(true);

      // Join stream
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/streams/${streamId}/join`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to join stream');
      }

      const data = await response.json();
      setStreamData(data);

      // Initialize Agora RTC
      await initializeRTC(data.agoraConfig);
    } catch (error) {
      console.error('Error initializing stream:', error);
      alert('Failed to join stream');
      router.push('/live');
    } finally {
      setLoading(false);
    }
  };

  const initializeRTC = async (agoraConfig: any) => {
    rtcClient.current = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
    rtcClient.current.setClientRole('audience');

    // Handle remote user
    rtcClient.current.on('user-published', async (user, mediaType) => {
      await rtcClient.current!.subscribe(user, mediaType);

      if (mediaType === 'video') {
        const remoteVideoTrack = user.videoTrack;
        if (remoteVideoRef.current) {
          remoteVideoTrack?.play(remoteVideoRef.current);
        }
      }

      if (mediaType === 'audio') {
        const remoteAudioTrack = user.audioTrack;
        remoteAudioTrack?.play();
      }
    });

    // Join channel
    await rtcClient.current.join(
      agoraConfig.appId,
      agoraConfig.channelName,
      agoraConfig.token,
      agoraConfig.uid
    );
  };

  const fetchGifts = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/streams/gifts`
      );

      if (response.ok) {
        const data = await response.json();
        setGifts(data.gifts || []);
      }
    } catch (error) {
      console.error('Error fetching gifts:', error);
    }
  };

  const sendGift = async (giftId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/streams/${streamId}/gift`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ giftId }),
        }
      );

      if (response.ok) {
        setShowGifts(false);
        alert('Gift sent successfully!');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to send gift');
      }
    } catch (error) {
      console.error('Error sending gift:', error);
      alert('Failed to send gift');
    }
  };

  const sendMessage = () => {
    if (!messageInput.trim()) return;

    const msg = {
      text: messageInput,
      sender: 'You',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, msg]);
    setMessageInput('');
  };

  const cleanup = async () => {
    if (rtcClient.current) {
      await rtcClient.current.leave();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-16 h-16 mx-auto mb-4"></div>
          <p className="text-xl text-white">Joining stream...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Video Area */}
          <div className="lg:col-span-3">
            <div className="mystical-card p-4">
              {/* Video */}
              <div className="relative bg-black rounded-lg overflow-hidden mb-4" style={{ paddingBottom: '56.25%' }}>
                <div ref={remoteVideoRef} className="absolute inset-0"></div>
                
                {/* Live Badge */}
                <div className="absolute top-4 left-4 bg-red-600 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2">
                  <span className="w-3 h-3 bg-white rounded-full animate-pulse"></span>
                  LIVE
                </div>

                {/* Viewer Count */}
                <div className="absolute top-4 right-4 bg-black/70 text-white px-4 py-2 rounded-full">
                  👁️ {streamData?.stream?.viewer_count || 0} watching
                </div>
              </div>

              {/* Stream Info */}
              <div className="mb-4">
                <h1 className="font-playfair text-3xl text-white mb-2">
                  {streamData?.stream?.title}
                </h1>
                <p className="text-gray-300 mb-3">
                  {streamData?.stream?.description}
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-mystical-pink to-mystical-purple flex items-center justify-center">
                      🔮
                    </div>
                    <span className="text-white font-bold">
                      {streamData?.stream?.display_name}
                    </span>
                  </div>
                  <div className="text-mystical-gold">
                    🎁 ${streamData?.stream?.total_gifts_received?.toFixed(0) || 0} received
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={() => setShowGifts(true)}
                  className="btn-gold flex-1"
                >
                  🎁 Send Gift
                </button>
                <button className="btn-mystical flex-1">
                  ❤️ Follow
                </button>
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="mystical-card p-4 h-[600px] flex flex-col">
            <h3 className="font-playfair text-xl text-mystical-pink mb-4">Live Chat</h3>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-2">
              {messages.map((msg, idx) => (
                <div key={idx} className="bg-black/40 p-2 rounded">
                  <span className="text-mystical-pink font-bold">{msg.sender}: </span>
                  <span className="text-white">{msg.text}</span>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Say something..."
                className="flex-1 bg-black/40 border border-mystical-pink/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-mystical-pink"
              />
              <button
                onClick={sendMessage}
                className="btn-mystical px-4 text-sm"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Gifts Modal */}
      {showGifts && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="mystical-card max-w-2xl w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-playfair text-3xl text-mystical-pink">
                Send a Gift
              </h2>
              <button
                onClick={() => setShowGifts(false)}
                className="text-gray-400 hover:text-white transition text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
              {gifts.map((gift) => (
                <button
                  key={gift.id}
                  onClick={() => sendGift(gift.id)}
                  className="mystical-card p-4 text-center hover:bg-mystical-pink/10 transition"
                >
                  <div className="text-4xl mb-2">
                    {gift.icon_url ? (
                      <img src={gift.icon_url} alt={gift.name} className="w-12 h-12 mx-auto" />
                    ) : (
                      '🎁'
                    )}
                  </div>
                  <h4 className="text-white text-sm font-bold mb-1">{gift.name}</h4>
                  <p className="text-mystical-gold font-bold">${gift.price}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}