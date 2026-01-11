/**
 * API Services
 * Organized API endpoint calls
 */

import { apiClient } from './client';
import {
  User,
  UserProfile,
  Reader,
  ReaderFilters,
  ReadingSession,
  SessionWithDetails,
  SessionStats,
  Transaction,
  TransactionStats,
  PaymentIntent,
  LiveStream,
  Product,
  ForumPost,
  ForumComment,
  Message,
  Conversation,
  ApiResponse,
  PaginatedResponse,
} from '@/types';

// ============================================================================
// USER SERVICE
// ============================================================================

export const userService = {
  getCurrentUser: () => 
    apiClient.get<ApiResponse<UserProfile>>('/users/me'),

  updateProfile: (updates: Partial<User>) =>
    apiClient.put<ApiResponse<User>>('/users/me', updates),

  getBalance: () =>
    apiClient.get<ApiResponse<{ balance: number }>>('/users/me/balance'),

  deleteAccount: () =>
    apiClient.delete<ApiResponse<void>>('/users/me'),
};

// ============================================================================
// READER SERVICE
// ============================================================================

export const readerService = {
  getAllReaders: (filters?: ReaderFilters & { limit?: number; offset?: number }) =>
    apiClient.get<PaginatedResponse<Reader>>('/readers', filters),

  getOnlineReaders: (params?: { limit?: number; offset?: number }) =>
    apiClient.get<PaginatedResponse<Reader>>('/readers/online', params),

  getReaderById: (readerId: number) =>
    apiClient.get<ApiResponse<Reader>>(`/readers/${readerId}`),

  createReaderProfile: (data: {
    displayName: string;
    bio: string;
    specialties: string[];
    chatRate: number;
    callRate: number;
    videoRate: number;
    profilePictureUrl?: string;
  }) =>
    apiClient.post<ApiResponse<Reader>>('/readers', data),

  updateReaderProfile: (updates: Partial<Reader>) =>
    apiClient.put<ApiResponse<Reader>>('/readers/me', updates),

  updateOnlineStatus: (isOnline: boolean, status?: string) =>
    apiClient.patch<ApiResponse<Reader>>('/readers/me/status', { isOnline, status }),

  getReaderEarnings: (params?: { startDate?: string; endDate?: string }) =>
    apiClient.get<ApiResponse<any>>('/readers/me/earnings', params),

  searchReaders: (query: string, params?: { limit?: number; offset?: number }) =>
    apiClient.get<PaginatedResponse<Reader>>('/readers/search', { q: query, ...params }),

  getTopRated: (limit?: number) =>
    apiClient.get<ApiResponse<Reader[]>>('/readers/top-rated', { limit }),
};

// ============================================================================
// SESSION SERVICE
// ============================================================================

export const sessionService = {
  startSession: (readerId: number, sessionType: 'chat' | 'call' | 'video') =>
    apiClient.post<ApiResponse<SessionWithDetails & { agora: any }>>('/sessions/start', {
      readerId,
      sessionType,
    }),

  endSession: (sessionId: number, durationMinutes: number) =>
    apiClient.post<ApiResponse<ReadingSession>>(`/sessions/${sessionId}/end`, {
      durationMinutes,
    }),

  getSessionById: (sessionId: number) =>
    apiClient.get<ApiResponse<SessionWithDetails>>(`/sessions/${sessionId}`),

  getActiveSession: () =>
    apiClient.get<ApiResponse<SessionWithDetails & { agora: any }>>('/sessions/active'),

  getSessionHistory: (params?: { limit?: number; offset?: number }) =>
    apiClient.get<PaginatedResponse<SessionWithDetails>>('/sessions/history', params),

  getSessionStats: () =>
    apiClient.get<ApiResponse<SessionStats>>('/sessions/stats'),

  cancelSession: (sessionId: number, reason?: string) =>
    apiClient.post<ApiResponse<ReadingSession>>(`/sessions/${sessionId}/cancel`, { reason }),

  addReview: (sessionId: number, rating: number, reviewText: string) =>
    apiClient.post<ApiResponse<void>>(`/sessions/${sessionId}/review`, {
      rating,
      reviewText,
    }),
};

// ============================================================================
// PAYMENT SERVICE
// ============================================================================

export const paymentService = {
  addBalance: (amount: number) =>
    apiClient.post<PaymentIntent>('/payments/add-balance', { amount }),

  getBalance: () =>
    apiClient.get<ApiResponse<{ balance: number }>>('/payments/balance'),

  getTransactionHistory: (params?: {
    limit?: number;
    offset?: number;
    type?: string;
    status?: string;
  }) =>
    apiClient.get<PaginatedResponse<Transaction>>('/payments/transactions', params),

  getTransactionById: (transactionId: number) =>
    apiClient.get<ApiResponse<Transaction>>(`/payments/transactions/${transactionId}`),

  getTransactionStats: (params?: { startDate?: string; endDate?: string }) =>
    apiClient.get<ApiResponse<TransactionStats>>('/payments/stats', params),

  requestRefund: (transactionId: number, reason: string) =>
    apiClient.post<ApiResponse<Transaction>>(`/payments/transactions/${transactionId}/refund`, {
      reason,
    }),
};

// ============================================================================
// STREAM SERVICE
// ============================================================================

export const streamService = {
  getAllStreams: (params?: { status?: string; limit?: number; offset?: number }) =>
    apiClient.get<PaginatedResponse<LiveStream>>('/streams', params),

  getLiveStreams: (params?: { limit?: number; offset?: number }) =>
    apiClient.get<PaginatedResponse<LiveStream>>('/streams/live', params),

  getStreamById: (streamId: number) =>
    apiClient.get<ApiResponse<LiveStream & { agora: any }>>(`/streams/${streamId}`),

  createStream: (data: {
    title: string;
    description: string;
    scheduledStart?: string;
    thumbnailUrl?: string;
  }) =>
    apiClient.post<ApiResponse<LiveStream>>('/streams', data),

  startStream: (streamId: number) =>
    apiClient.post<ApiResponse<LiveStream>>(`/streams/${streamId}/start`),

  endStream: (streamId: number) =>
    apiClient.post<ApiResponse<LiveStream>>(`/streams/${streamId}/end`),

  sendGift: (streamId: number, giftId: number) =>
    apiClient.post<ApiResponse<void>>(`/streams/${streamId}/gifts`, { giftId }),
};

// ============================================================================
// SHOP SERVICE
// ============================================================================

export const shopService = {
  getAllProducts: (params?: { category?: string; limit?: number; offset?: number }) =>
    apiClient.get<PaginatedResponse<Product>>('/shop/products', params),

  getProductById: (productId: number) =>
    apiClient.get<ApiResponse<Product>>(`/shop/products/${productId}`),

  createOrder: (items: Array<{ productId: number; quantity: number }>, shippingAddress: string) =>
    apiClient.post<ApiResponse<any>>('/shop/orders', { items, shippingAddress }),

  getOrders: (params?: { limit?: number; offset?: number }) =>
    apiClient.get<PaginatedResponse<any>>('/shop/orders', params),

  getOrderById: (orderId: number) =>
    apiClient.get<ApiResponse<any>>(`/shop/orders/${orderId}`),
};

// ============================================================================
// COMMUNITY SERVICE
// ============================================================================

export const communityService = {
  getAllPosts: (params?: { category?: string; limit?: number; offset?: number }) =>
    apiClient.get<PaginatedResponse<ForumPost>>('/community/posts', params),

  getPostById: (postId: number) =>
    apiClient.get<ApiResponse<ForumPost>>(`/community/posts/${postId}`),

  createPost: (data: { title: string; content: string; category: string }) =>
    apiClient.post<ApiResponse<ForumPost>>('/community/posts', data),

  updatePost: (postId: number, data: { title?: string; content?: string }) =>
    apiClient.put<ApiResponse<ForumPost>>(`/community/posts/${postId}`, data),

  deletePost: (postId: number) =>
    apiClient.delete<ApiResponse<void>>(`/community/posts/${postId}`),

  likePost: (postId: number) =>
    apiClient.post<ApiResponse<void>>(`/community/posts/${postId}/like`),

  getComments: (postId: number, params?: { limit?: number; offset?: number }) =>
    apiClient.get<PaginatedResponse<ForumComment>>(`/community/posts/${postId}/comments`, params),

  addComment: (postId: number, content: string) =>
    apiClient.post<ApiResponse<ForumComment>>(`/community/posts/${postId}/comments`, { content }),

  deleteComment: (postId: number, commentId: number) =>
    apiClient.delete<ApiResponse<void>>(`/community/posts/${postId}/comments/${commentId}`),
};

// ============================================================================
// MESSAGE SERVICE
// ============================================================================

export const messageService = {
  getConversations: (params?: { limit?: number; offset?: number }) =>
    apiClient.get<PaginatedResponse<Conversation>>('/messages/conversations', params),

  getMessages: (userId: number, params?: { limit?: number; offset?: number }) =>
    apiClient.get<PaginatedResponse<Message>>(`/messages/${userId}`, params),

  sendMessage: (receiverId: number, content: string) =>
    apiClient.post<ApiResponse<Message>>('/messages', { receiverId, content }),

  markAsRead: (messageId: number) =>
    apiClient.patch<ApiResponse<void>>(`/messages/${messageId}/read`),

  deleteMessage: (messageId: number) =>
    apiClient.delete<ApiResponse<void>>(`/messages/${messageId}`),
};

// ============================================================================
// ADMIN SERVICE
// ============================================================================

export const adminService = {
  getAllUsers: (params?: { role?: string; limit?: number; offset?: number }) =>
    apiClient.get<PaginatedResponse<User>>('/admin/users', params),

  getAllSessions: (params?: { status?: string; limit?: number; offset?: number }) =>
    apiClient.get<PaginatedResponse<ReadingSession>>('/admin/sessions', params),

  getAllTransactions: (params?: { type?: string; status?: string; limit?: number; offset?: number }) =>
    apiClient.get<PaginatedResponse<Transaction>>('/admin/transactions', params),

  getPlatformStats: (params?: { startDate?: string; endDate?: string }) =>
    apiClient.get<ApiResponse<any>>('/admin/stats', params),

  createReader: (data: any) =>
    apiClient.post<ApiResponse<Reader>>('/admin/readers', data),

  updateReader: (readerId: number, data: any) =>
    apiClient.put<ApiResponse<Reader>>(`/admin/readers/${readerId}`, data),

  processPayouts: () =>
    apiClient.post<ApiResponse<void>>('/admin/payouts'),
};