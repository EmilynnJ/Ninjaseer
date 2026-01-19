'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@clerk/nextjs';

// Types
interface SessionData {
  id: string;
  status: 'pending' | 'accepted' | 'active' | 'paused' | 'completed' | 'cancelled';
  type: 'chat' | 'voice' | 'video';
  reader: {
    id: string;
    displayName: string;
    profileImageUrl: string;
    specialties: string[];
  };
  client: {
    id: string;
    displayName: string;
    profileImageUrl: string;
  };
  ratePerMinute: number;
  startedAt?: string;
  duration: number;
  totalCost: number;
  clientBalance: number;
  agoraToken?: string;
  agoraChannel?: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  type: 'text' | 'system' | 'gift';
}

// Mock session data
const mockSession: SessionData = {
  id: 'session-123',
  status: 'active',
  type: 'video',
  reader: {
    id: 'reader-1',
    displayName: 'Mystic Aurora',
    profileImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    specialties: ['Tarot', 'Love & Relationships']
  },
  client: {
    id: 'client-1',
    displayName: 'John Doe',
    profileImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400'
  },
  ratePerMinute: 5.99,
  startedAt: new Date(Date.now() - 5 * 60000).toISOString(),
  duration: 5,
  totalCost: 29.95,
  clientBalance: 50.00
};

// Components
const VideoControls = ({
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onEndCall,
  onToggleChat,
  isChatOpen
}: {
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  onToggleChat: () => void;
  isChatOpen: boolean;
}) => {
  return (
    <div className="flex items-center justify-center gap-4 p-4 bg-black/50 rounded-full">
      {/* Mute button */}
      <button
        onClick={onToggleMute}
        className={`p-4 rounded-full transition-colors ${
          isMuted ? 'bg-red-500 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'
        }`}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>

      {/* Video toggle button */}
      <button
        onClick={onToggleVideo}
        className={`p-4 rounded-full transition-colors ${
          isVideoOff ? 'bg-red-500 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'
        }`}
        title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
      >
        {isVideoOff ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>

      {/* Chat toggle button */}
      <button
        onClick={onToggleChat}
        className={`p-4 rounded-full transition-colors ${
          isChatOpen ? 'bg-pink-500 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'
        }`}
        title="Toggle chat"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>

      {/* End call button */}
      <button
        onClick={onEndCall}
        className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
        title="End reading"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
        </svg>
      </button>
    </div>
  );
};

const SessionTimer = ({ 
  startedAt, 
  ratePerMinute,
  balance 
}: { 
  startedAt: string; 
  ratePerMinute: number;
  balance: number;
}) => {
  const [elapsed, setElapsed] = useState(0);
  const [cost, setCost] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);

  useEffect(() => {
    const startTime = new Date(startedAt).getTime();
    
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const elapsedMinutes = elapsedSeconds / 60;
      const currentCost = elapsedMinutes * ratePerMinute;
      const remaining = Math.max(0, (balance - currentCost) / ratePerMinute * 60);
      
      setElapsed(elapsedSeconds);
      setCost(currentCost);
      setRemainingTime(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, ratePerMinute, balance]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isLowBalance = remainingTime < 120; // Less than 2 minutes

  return (
    <div className="flex items-center gap-6 bg-black/50 backdrop-blur-sm rounded-full px-6 py-3">
      {/* Duration */}
      <div className="text-center">
        <div className="text-2xl font-mono text-white">{formatTime(elapsed)}</div>
        <div className="text-xs text-gray-400">Duration</div>
      </div>

      <div className="w-px h-8 bg-gray-600" />

      {/* Cost */}
      <div className="text-center">
        <div className="text-2xl font-mono text-pink-400">${cost.toFixed(2)}</div>
        <div className="text-xs text-gray-400">Cost</div>
      </div>

      <div className="w-px h-8 bg-gray-600" />

      {/* Remaining */}
      <div className="text-center">
        <div className={`text-2xl font-mono ${isLowBalance ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
          {formatTime(remainingTime)}
        </div>
        <div className="text-xs text-gray-400">Remaining</div>
      </div>

      {isLowBalance && (
        <button className="ml-2 px-4 py-2 bg-pink-500 text-white text-sm rounded-full hover:bg-pink-600 transition-colors">
          Add Funds
        </button>
      )}
    </div>
  );
};

const ChatPanel = ({
  messages,
  onSendMessage,
  isOpen,
  currentUserId
}: {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isOpen: boolean;
  currentUserId: string;
}) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 bg-gray-900/95 backdrop-blur-sm border-l border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-white font-semibold">Chat</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}
          >
            {message.type === 'system' ? (
              <div className="text-center text-gray-500 text-sm italic w-full">
                {message.content}
              </div>
            ) : (
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  message.senderId === currentUserId
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-800 text-white'
                }`}
              >
                {message.senderId !== currentUserId && (
                  <div className="text-xs text-gray-400 mb-1">{message.senderName}</div>
                )}
                <p>{message.content}</p>
                <div className={`text-xs mt-1 ${
                  message.senderId === currentUserId ? 'text-pink-200' : 'text-gray-500'
                }`}>
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-full px-4 py-2 focus:ring-pink-500 focus:border-pink-500"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            className="p-2 bg-pink-500 text-white rounded-full hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

const ConnectionStatus = ({ status }: { status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' }) => {
  const statusConfig = {
    connecting: { color: 'text-yellow-400', bg: 'bg-yellow-400', text: 'Connecting...' },
    connected: { color: 'text-green-400', bg: 'bg-green-400', text: 'Connected' },
    reconnecting: { color: 'text-orange-400', bg: 'bg-orange-400', text: 'Reconnecting...' },
    disconnected: { color: 'text-red-400', bg: 'bg-red-400', text: 'Disconnected' }
  };

  const config = statusConfig[status];

  return (
    <div className={`flex items-center gap-2 ${config.color} text-sm`}>
      <span className={`w-2 h-2 ${config.bg} rounded-full ${status === 'connecting' || status === 'reconnecting' ? 'animate-pulse' : ''}`} />
      {config.text}
    </div>
  );
};

const EndSessionModal = ({
  isOpen,
  onClose,
  onConfirm,
  session
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  session: SessionData;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-800">
        <h3 className="text-xl font-semibold text-white mb-4">End Reading Session?</h3>
        
        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-gray-400">Duration</span>
            <span className="text-white">{session.duration} minutes</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-gray-400">Rate</span>
            <span className="text-white">${session.ratePerMinute}/min</span>
          </div>
          <div className="border-t border-gray-700 my-2" />
          <div className="flex justify-between">
            <span className="text-gray-400">Total Cost</span>
            <span className="text-pink-400 font-semibold">${session.totalCost.toFixed(2)}</span>
          </div>
        </div>

        <p className="text-gray-400 text-sm mb-6">
          Are you sure you want to end this reading? You'll be prompted to leave a review.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors"
          >
            Continue Reading
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
          >
            End Session
          </button>
        </div>
      </div>
    </div>
  );
};

const ReviewModal = ({
  isOpen,
  onClose,
  onSubmit,
  readerName
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (review: { rating: number; content: string }) => void;
  readerName: string;
}) => {
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [hoveredRating, setHoveredRating] = useState(0);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onSubmit({ rating, content });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-800">
        <h3 className="text-xl font-semibold text-white mb-2">Rate Your Reading</h3>
        <p className="text-gray-400 mb-6">How was your experience with {readerName}?</p>

        {/* Star rating */}
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="text-4xl transition-transform hover:scale-110"
            >
              {star <= (hoveredRating || rating) ? '⭐' : '☆'}
            </button>
          ))}
        </div>

        {/* Review text */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your experience (optional)..."
          rows={4}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 focus:ring-pink-500 focus:border-pink-500 resize-none mb-6"
        />

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-3 bg-pink-500 text-white rounded-full hover:bg-pink-600 transition-colors"
          >
            Submit Review
          </button>
        </div>
      </div>
    </div>
  );
};

const WaitingRoom = ({ 
  session, 
  onCancel 
}: { 
  session: SessionData; 
  onCancel: () => void;
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#1a1a2e] to-[#0a0a0f] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="relative w-32 h-32 mx-auto mb-6">
          <Image
            src={session.reader.profileImageUrl}
            alt={session.reader.displayName}
            fill
            className="rounded-full object-cover border-4 border-pink-500"
          />
          <div className="absolute inset-0 rounded-full border-4 border-pink-500/30 animate-ping" />
        </div>

        <h2 className="text-2xl font-semibold text-white mb-2">
          Connecting with {session.reader.displayName}
        </h2>
        <p className="text-gray-400 mb-8">
          Please wait while we connect you to your reader...
        </p>

        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>

        <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Session Type</span>
            <span className="text-white capitalize">{session.type}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Rate</span>
            <span className="text-pink-400">${session.ratePerMinute}/min</span>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-white transition-colors"
        >
          Cancel Request
        </button>
      </div>
    </div>
  );
};

const SessionCompleted = ({
  session,
  onReview,
  onClose
}: {
  session: SessionData;
  onReview: () => void;
  onClose: () => void;
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#1a1a2e] to-[#0a0a0f] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">✨</div>
        
        <h2 className="text-2xl font-semibold text-white mb-2">
          Reading Complete
        </h2>
        <p className="text-gray-400 mb-8">
          Thank you for your session with {session.reader.displayName}
        </p>

        <div className="bg-gray-800/50 rounded-xl p-6 mb-8">
          <div className="flex justify-between mb-3">
            <span className="text-gray-400">Duration</span>
            <span className="text-white">{session.duration} minutes</span>
          </div>
          <div className="flex justify-between mb-3">
            <span className="text-gray-400">Rate</span>
            <span className="text-white">${session.ratePerMinute}/min</span>
          </div>
          <div className="border-t border-gray-700 my-3" />
          <div className="flex justify-between">
            <span className="text-gray-400">Total Charged</span>
            <span className="text-pink-400 font-semibold text-xl">${session.totalCost.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onReview}
            className="w-full py-3 bg-pink-500 text-white rounded-full hover:bg-pink-600 transition-colors"
          >
            Leave a Review
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Page Component
export default function ReadingSessionPage() {
  const params = useParams();
  const router = useRouter();
  const { userId } = useAuth();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<SessionData>(mockSession);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      senderId: 'system',
      senderName: 'System',
      content: 'Session started. Your reading has begun.',
      timestamp: new Date().toISOString(),
      type: 'system'
    }
  ]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Simulate connection
  useEffect(() => {
    const timer = setTimeout(() => {
      setConnectionStatus('connected');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Initialize Agora (placeholder)
  useEffect(() => {
    // In production, initialize Agora SDK here
    // const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    // await client.join(appId, channel, token, uid);
    // etc.
  }, [session.agoraToken, session.agoraChannel]);

  const handleSendMessage = (content: string) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: userId || 'client-1',
      senderName: session.client.displayName,
      content,
      timestamp: new Date().toISOString(),
      type: 'text'
    };
    setMessages(prev => [...prev, newMessage]);

    // In production, send via Agora RTM
  };

  const handleEndSession = () => {
    setShowEndModal(true);
  };

  const confirmEndSession = () => {
    setShowEndModal(false);
    setSession(prev => ({ ...prev, status: 'completed' }));
    // In production, call API to end session
  };

  const handleSubmitReview = (review: { rating: number; content: string }) => {
    console.log('Review submitted:', review);
    setShowReviewModal(false);
    router.push('/dashboard');
  };

  // Render based on session status
  if (session.status === 'pending' || session.status === 'accepted') {
    return (
      <WaitingRoom 
        session={session} 
        onCancel={() => router.push('/dashboard')} 
      />
    );
  }

  if (session.status === 'completed') {
    return (
      <>
        <SessionCompleted
          session={session}
          onReview={() => setShowReviewModal(true)}
          onClose={() => router.push('/dashboard')}
        />
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            router.push('/dashboard');
          }}
          onSubmit={handleSubmitReview}
          readerName={session.reader.displayName}
        />
      </>
    );
  }

  return (
    <div className="h-screen bg-black flex">
      {/* Main video area */}
      <div className="flex-1 relative">
        {/* Remote video (reader) */}
        <div className="absolute inset-0 bg-gray-900">
          {session.type === 'video' ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <Image
                  src={session.reader.profileImageUrl}
                  alt={session.reader.displayName}
                  width={200}
                  height={200}
                  className="rounded-full mx-auto mb-4 border-4 border-pink-500"
                />
                <h2 className="text-2xl text-white font-semibold">{session.reader.displayName}</h2>
                <p className="text-gray-400">{session.type === 'voice' ? 'Voice Call' : 'Chat Session'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Local video (self) */}
        {session.type === 'video' && (
          <div className="absolute bottom-24 right-4 w-48 h-36 bg-gray-800 rounded-xl overflow-hidden border-2 border-gray-700 shadow-lg">
            {isVideoOff ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <span className="text-gray-500 text-sm">Camera off</span>
                </div>
              </div>
            ) : (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}
          </div>
        )}

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-4">
            <Image
              src={session.reader.profileImageUrl}
              alt={session.reader.displayName}
              width={48}
              height={48}
              className="rounded-full border-2 border-pink-500"
            />
            <div>
              <h3 className="text-white font-semibold">{session.reader.displayName}</h3>
              <ConnectionStatus status={connectionStatus} />
            </div>
          </div>

          <SessionTimer
            startedAt={session.startedAt || new Date().toISOString()}
            ratePerMinute={session.ratePerMinute}
            balance={session.clientBalance}
          />
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-center bg-gradient-to-t from-black/80 to-transparent">
          <VideoControls
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            onToggleMute={() => setIsMuted(!isMuted)}
            onToggleVideo={() => setIsVideoOff(!isVideoOff)}
            onEndCall={handleEndSession}
            onToggleChat={() => setIsChatOpen(!isChatOpen)}
            isChatOpen={isChatOpen}
          />
        </div>
      </div>

      {/* Chat panel */}
      <ChatPanel
        messages={messages}
        onSendMessage={handleSendMessage}
        isOpen={isChatOpen}
        currentUserId={userId || 'client-1'}
      />

      {/* End session modal */}
      <EndSessionModal
        isOpen={showEndModal}
        onClose={() => setShowEndModal(false)}
        onConfirm={confirmEndSession}
        session={session}
      />

      {/* Review modal */}
      <ReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onSubmit={handleSubmitReview}
        readerName={session.reader.displayName}
      />
    </div>
  );
}