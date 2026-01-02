'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AgoraRTC, { 
  IAgoraRTCClient, 
  IAgoraRTCRemoteUser, 
  ICameraVideoTrack, 
  IMicrophoneAudioTrack 
} from 'agora-rtc-sdk-ng';
import AgoraRTM from 'agora-rtm-sdk';

export default function ReadingSession() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [duration, setDuration] = useState(0);
  const [cost, setCost] = useState(0);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const rtcClient = useRef<IAgoraRTCClient | null>(null);
  const rtmClient = useRef<any>(null);
  const rtmChannel = useRef<any>(null);
  const localVideoTrack = useRef<ICameraVideoTrack | null>(null);
  const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeSession();
    return () => {
      cleanup();
    };
  }, [sessionId]);

  useEffect(() => {
    // Update duration and cost every second
    if (connected && sessionData) {
      const interval = setInterval(() => {
        setDuration(prev => prev + 1);
        const minutes = Math.ceil((duration + 1) / 60);
        setCost(minutes * sessionData.rate_per_minute);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [connected, duration, sessionData]);

  const initializeSession = async () => {
    try {
      setLoading(true);

      // Get session tokens from backend
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${sessionId}/tokens`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get session tokens');
      }

      const data = await response.json();
      setSessionData(data);

      // Initialize Agora RTC
      await initializeRTC(data.agora);

      // Initialize Agora RTM for chat
      await initializeRTM(data.agora);

      setConnected(true);
    } catch (error) {
      console.error('Error initializing session:', error);
      alert('Failed to join session. Please try again.');
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const initializeRTC = async (agoraConfig: any) => {
    // Create RTC client
    rtcClient.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

    // Handle remote user events
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

    rtcClient.current.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'video' && remoteVideoRef.current) {
        remoteVideoRef.current.innerHTML = '';
      }
    });

    // Join channel
    await rtcClient.current.join(
      agoraConfig.appId,
      agoraConfig.channelName,
      agoraConfig.rtcToken,
      agoraConfig.uid
    );

    // Create and publish local tracks
    if (sessionData?.session_type === 'video' || sessionData?.session_type === 'call') {
      localAudioTrack.current = await AgoraRTC.createMicrophoneAudioTrack();
      await rtcClient.current.publish([localAudioTrack.current]);
    }

    if (sessionData?.session_type === 'video') {
      localVideoTrack.current = await AgoraRTC.createCameraVideoTrack();
      await rtcClient.current.publish([localVideoTrack.current]);

      if (localVideoRef.current) {
        localVideoTrack.current.play(localVideoRef.current);
      }
    }
  };

  const initializeRTM = async (agoraConfig: any) => {
    // Create RTM client
    rtmClient.current = AgoraRTM.createInstance(agoraConfig.appId);

    // Login to RTM
    await rtmClient.current.login({
      uid: agoraConfig.userId,
      token: agoraConfig.rtmToken,
    });

    // Join channel
    rtmChannel.current = rtmClient.current.createChannel(agoraConfig.channelName);
    await rtmChannel.current.join();

    // Handle incoming messages
    rtmChannel.current.on('ChannelMessage', (message: any, memberId: string) => {
      const msg = {
        text: message.text,
        sender: memberId,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, msg]);
    });
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !rtmChannel.current) return;

    try {
      await rtmChannel.current.sendMessage({ text: messageInput });
      
      const msg = {
        text: messageInput,
        sender: 'me',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, msg]);
      setMessageInput('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const toggleVideo = async () => {
    if (localVideoTrack.current) {
      await localVideoTrack.current.setEnabled(!videoEnabled);
      setVideoEnabled(!videoEnabled);
    }
  };

  const toggleAudio = async () => {
    if (localAudioTrack.current) {
      await localAudioTrack.current.setEnabled(!audioEnabled);
      setAudioEnabled(!audioEnabled);
    }
  };

  const endSession = async () => {
    if (!confirm('Are you sure you want to end this session?')) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/sessions/end/${sessionId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (response.ok) {
        await cleanup();
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error ending session:', error);
    }
  };

  const cleanup = async () => {
    // Close RTC
    if (localVideoTrack.current) {
      localVideoTrack.current.stop();
      localVideoTrack.current.close();
    }
    if (localAudioTrack.current) {
      localAudioTrack.current.stop();
      localAudioTrack.current.close();
    }
    if (rtcClient.current) {
      await rtcClient.current.leave();
    }

    // Close RTM
    if (rtmChannel.current) {
      await rtmChannel.current.leave();
    }
    if (rtmClient.current) {
      await rtmClient.current.logout();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-16 h-16 mx-auto mb-4"></div>
          <p className="text-xl text-white">Connecting to session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      {/* Header */}
      <div className="container mx-auto mb-4">
        <div className="mystical-card p-4 flex justify-between items-center">
          <div>
            <h1 className="font-playfair text-2xl text-mystical-pink mb-1">
              Reading Session
            </h1>
            <p className="text-gray-400 text-sm">
              {sessionData?.session_type === 'video' ? '📹 Video' : 
               sessionData?.session_type === 'call' ? '📞 Voice' : '💬 Chat'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-mystical-gold mb-1">
              {formatDuration(duration)}
            </div>
            <div className="text-sm text-gray-400">
              ${cost.toFixed(2)} charged
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Video/Audio Area */}
        <div className="lg:col-span-2">
          <div className="mystical-card p-4 h-[600px]">
            {sessionData?.session_type !== 'chat' && (
              <div className="grid grid-cols-2 gap-4 h-full">
                {/* Remote Video */}
                <div className="bg-black rounded-lg overflow-hidden relative">
                  <div ref={remoteVideoRef} className="w-full h-full"></div>
                  <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1 rounded-full text-sm">
                    Reader
                  </div>
                </div>

                {/* Local Video */}
                {sessionData?.session_type === 'video' && (
                  <div className="bg-black rounded-lg overflow-hidden relative">
                    <div ref={localVideoRef} className="w-full h-full"></div>
                    <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1 rounded-full text-sm">
                      You
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Controls */}
            <div className="flex justify-center gap-4 mt-4">
              {sessionData?.session_type === 'video' && (
                <button
                  onClick={toggleVideo}
                  className={`p-4 rounded-full ${videoEnabled ? 'bg-mystical-pink' : 'bg-gray-600'}`}
                >
                  {videoEnabled ? '📹' : '🚫'}
                </button>
              )}
              {sessionData?.session_type !== 'chat' && (
                <button
                  onClick={toggleAudio}
                  className={`p-4 rounded-full ${audioEnabled ? 'bg-mystical-pink' : 'bg-gray-600'}`}
                >
                  {audioEnabled ? '🎤' : '🔇'}
                </button>
              )}
              <button
                onClick={endSession}
                className="px-8 py-4 rounded-full bg-red-600 hover:bg-red-700 transition font-bold"
              >
                End Session
              </button>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="mystical-card p-4 h-[600px] flex flex-col">
          <h3 className="font-playfair text-xl text-mystical-pink mb-4">Chat</h3>
          
          {/* Messages */}
          <div className="flex-1 overflow-y-auto mb-4 space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg ${
                  msg.sender === 'me'
                    ? 'bg-mystical-pink/20 ml-8'
                    : 'bg-gray-700/50 mr-8'
                }`}
              >
                <p className="text-white">{msg.text}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {msg.timestamp.toLocaleTimeString()}
                </p>
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
              placeholder="Type a message..."
              className="flex-1 bg-black/40 border border-mystical-pink/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-mystical-pink"
            />
            <button
              onClick={sendMessage}
              className="btn-mystical px-6"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}