'use client';

import { useEffect, useState } from 'react';
import Header from '../components/Header';
import { useUser } from '@clerk/nextjs';

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender_email: string;
  receiver_email: string;
  content: string;
  is_paid: boolean;
  is_read: boolean;
  created_at: string;
}

interface Conversation {
  userId: string;
  userEmail: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export default function MessagesPage() {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMessages();
    }
  }, [user]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/community/messages`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        organizeConversations(data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const organizeConversations = (msgs: Message[]) => {
    const convMap = new Map<string, Conversation>();

    msgs.forEach((msg) => {
      const otherUserId = msg.sender_id === user?.id ? msg.receiver_id : msg.sender_id;
      const otherUserEmail = msg.sender_id === user?.id ? msg.receiver_email : msg.sender_email;

      if (!convMap.has(otherUserId)) {
        convMap.set(otherUserId, {
          userId: otherUserId,
          userEmail: otherUserEmail,
          lastMessage: msg.content,
          lastMessageTime: msg.created_at,
          unreadCount: 0,
        });
      }

      const conv = convMap.get(otherUserId)!;
      if (new Date(msg.created_at) > new Date(conv.lastMessageTime)) {
        conv.lastMessage = msg.content;
        conv.lastMessageTime = msg.created_at;
      }

      if (!msg.is_read && msg.receiver_id === user?.id) {
        conv.unreadCount++;
      }
    });

    setConversations(Array.from(convMap.values()));
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/community/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            receiverId: selectedConversation,
            content: messageInput,
            isPaid: false,
          }),
        }
      );

      if (response.ok) {
        setMessageInput('');
        fetchMessages();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const getConversationMessages = () => {
    if (!selectedConversation) return [];
    
    return messages.filter(
      (msg) =>
        (msg.sender_id === user?.id && msg.receiver_id === selectedConversation) ||
        (msg.receiver_id === user?.id && msg.sender_id === selectedConversation)
    ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <h1 className="font-playfair text-4xl text-white mb-8">Messages</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)]">
          {/* Conversations List */}
          <div className="mystical-card p-4 overflow-y-auto">
            <h2 className="font-playfair text-xl text-mystical-pink mb-4">
              Conversations
            </h2>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="spinner w-8 h-8"></div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400">No messages yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <div
                    key={conv.userId}
                    onClick={() => setSelectedConversation(conv.userId)}
                    className={`p-4 rounded-lg cursor-pointer transition ${
                      selectedConversation === conv.userId
                        ? 'bg-mystical-pink/20 border border-mystical-pink'
                        : 'bg-black/40 hover:bg-black/60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-mystical-pink to-mystical-purple flex items-center justify-center text-xl flex-shrink-0">
                        🔮
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="text-white font-bold truncate">
                            {conv.userEmail}
                          </h3>
                          {conv.unreadCount > 0 && (
                            <span className="bg-mystical-pink text-white text-xs px-2 py-1 rounded-full">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-sm truncate">
                          {conv.lastMessage}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Messages Area */}
          <div className="lg:col-span-2 mystical-card p-4 flex flex-col">
            {selectedConversation ? (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto mb-4 space-y-3">
                  {getConversationMessages().map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-lg ${
                          msg.sender_id === user?.id
                            ? 'bg-mystical-pink/20 ml-8'
                            : 'bg-gray-700/50 mr-8'
                        }`}
                      >
                        <p className="text-white">{msg.content}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
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
                    className="flex-1 bg-black/40 border border-mystical-pink/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-mystical-pink"
                  />
                  <button
                    onClick={sendMessage}
                    className="btn-mystical px-8"
                  >
                    Send
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">💬</div>
                  <p className="text-gray-400">Select a conversation to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}