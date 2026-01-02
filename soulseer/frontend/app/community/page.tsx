'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import { useUser } from '@clerk/nextjs';

interface ForumPost {
  id: string;
  title: string;
  content: string;
  category: string;
  user_id: string;
  user_email: string;
  view_count: number;
  comment_count: number;
  is_pinned: boolean;
  created_at: string;
}

export default function CommunityPage() {
  const { user } = useUser();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '', category: 'general' });

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/community/posts?limit=50`
      );

      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPost = async () => {
    if (!newPost.title || !newPost.content) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/community/posts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(newPost),
        }
      );

      if (response.ok) {
        setShowNewPost(false);
        setNewPost({ title: '', content: '', category: 'general' });
        fetchPosts();
      }
    } catch (error) {
      console.error('Error creating post:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      general: 'bg-gray-600',
      tarot: 'bg-purple-600',
      astrology: 'bg-blue-600',
      mediumship: 'bg-indigo-600',
      crystals: 'bg-pink-600',
      dreams: 'bg-cyan-600',
    };
    return colors[category] || 'bg-gray-600';
  };

  return (
    <div className="min-h-screen">
      <Header />

      {/* Page Header */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="font-playfair text-5xl text-white mb-4">
              Community Forum
            </h1>
            <p className="text-xl text-gray-300">
              Connect, share, and learn with fellow spiritual seekers
            </p>
          </div>
          {user && (
            <button
              onClick={() => setShowNewPost(true)}
              className="btn-mystical"
            >
              + New Post
            </button>
          )}
        </div>

        {/* Categories */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
          {['general', 'tarot', 'astrology', 'mediumship', 'crystals', 'dreams'].map((cat) => (
            <button
              key={cat}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${getCategoryColor(cat)} text-white hover:opacity-80 transition`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </section>

      {/* Posts List */}
      <section className="container mx-auto px-4 pb-20">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="spinner w-16 h-16"></div>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">💬</div>
            <p className="text-2xl text-gray-400 mb-4">No posts yet</p>
            <p className="text-gray-500 mb-6">Be the first to start a discussion!</p>
            {user && (
              <button
                onClick={() => setShowNewPost(true)}
                className="btn-mystical"
              >
                Create First Post
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="mystical-card p-6 hover:bg-black/60 transition cursor-pointer"
              >
                <div className="flex gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-mystical-pink to-mystical-purple flex items-center justify-center text-xl flex-shrink-0">
                    🔮
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          {post.is_pinned && (
                            <span className="text-mystical-gold">📌</span>
                          )}
                          <h3 className="font-playfair text-xl text-white">
                            {post.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                          <span>{post.user_email}</span>
                          <span>•</span>
                          <span>{formatDate(post.created_at)}</span>
                          <span className={`px-2 py-1 rounded-full text-xs ${getCategoryColor(post.category)}`}>
                            {post.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-gray-300 mb-3 line-clamp-2">
                      {post.content}
                    </p>

                    <div className="flex gap-6 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        👁️ {post.view_count} views
                      </span>
                      <span className="flex items-center gap-1">
                        💬 {post.comment_count || 0} comments
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* New Post Modal */}
      {showNewPost && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="mystical-card max-w-2xl w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-playfair text-3xl text-mystical-pink">
                Create New Post
              </h2>
              <button
                onClick={() => setShowNewPost(false)}
                className="text-gray-400 hover:text-white transition text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2">Category</label>
                <select
                  value={newPost.category}
                  onChange={(e) => setNewPost({ ...newPost, category: e.target.value })}
                  className="w-full bg-black/40 border border-mystical-pink/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-mystical-pink"
                >
                  <option value="general">General Discussion</option>
                  <option value="tarot">Tarot</option>
                  <option value="astrology">Astrology</option>
                  <option value="mediumship">Mediumship</option>
                  <option value="crystals">Crystals</option>
                  <option value="dreams">Dreams</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Title</label>
                <input
                  type="text"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                  placeholder="What's on your mind?"
                  className="w-full bg-black/40 border border-mystical-pink/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-mystical-pink"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Content</label>
                <textarea
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  placeholder="Share your thoughts, questions, or experiences..."
                  rows={8}
                  className="w-full bg-black/40 border border-mystical-pink/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-mystical-pink resize-none"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setShowNewPost(false)}
                className="flex-1 px-6 py-3 rounded-full border-2 border-mystical-pink/50 text-white hover:border-mystical-pink transition"
              >
                Cancel
              </button>
              <button
                onClick={createPost}
                className="flex-1 btn-mystical"
              >
                Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}