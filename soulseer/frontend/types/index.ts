/**
 * TypeScript Type Definitions
 * Centralized type definitions for the entire application
 */

// ============================================================================
// USER TYPES
// ============================================================================

export interface User {
  id: number;
  clerk_id: string;
  email: string;
  display_name: string | null;
  role: 'client' | 'reader' | 'admin';
  balance: number;
  profile_picture_url: string | null;
  phone_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile extends User {
  reader_display_name?: string;
  bio?: string;
  specialties?: string[];
  chat_rate?: number;
  call_rate?: number;
  video_rate?: number;
  is_online?: boolean;
  reader_status?: string;
  average_rating?: number;
  total_reviews?: number;
  total_sessions?: number;
}

// ============================================================================
// READER TYPES
// ============================================================================

export interface Reader {
  id: number;
  user_id: number;
  display_name: string;
  bio: string;
  profile_picture_url: string | null;
  specialties: string[];
  chat_rate: number;
  call_rate: number;
  video_rate: number;
  is_online: boolean;
  status: 'online' | 'offline' | 'busy' | 'away';
  average_rating: number;
  total_reviews: number;
  total_sessions: number;
  created_at: string;
  updated_at: string;
}

export interface ReaderWithUser extends Reader {
  email: string;
  clerk_id: string;
}

export interface ReaderEarnings {
  total_earnings: number;
  total_transactions: number;
  average_transaction: number;
}

export interface ReaderAvailability {
  is_online: boolean;
  status: string;
  active_sessions: number;
}

// ============================================================================
// SESSION TYPES
// ============================================================================

export type SessionType = 'chat' | 'call' | 'video';
export type SessionStatus = 'active' | 'completed' | 'cancelled';

export interface ReadingSession {
  id: number;
  client_id: number;
  reader_id: number;
  session_type: SessionType;
  rate_per_minute: number;
  status: SessionStatus;
  agora_channel_name: string;
  agora_token: string;
  agora_rtm_token: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  total_cost: number | null;
  cancelled_by: 'client' | 'reader' | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionWithDetails extends ReadingSession {
  client_email: string;
  client_name: string;
  reader_name: string;
  reader_picture: string | null;
}

export interface SessionStats {
  total_sessions: number;
  completed_sessions: number;
  cancelled_sessions: number;
  total_minutes: number;
  total_spent: number;
  avg_duration: number;
  avg_cost: number;
}

export interface AgoraCredentials {
  appId: string;
  channelName: string;
  token: string;
  rtmToken: string;
  uid: number;
}

// ============================================================================
// TRANSACTION TYPES
// ============================================================================

export type TransactionType = 
  | 'balance_add' 
  | 'session_payment' 
  | 'session_earning'
  | 'tip_payment' 
  | 'tip_earning' 
  | 'refund' 
  | 'withdrawal';

export type TransactionStatus = 
  | 'pending' 
  | 'completed' 
  | 'failed' 
  | 'refunded' 
  | 'cancelled';

export interface Transaction {
  id: number;
  user_id: number;
  reader_id: number | null;
  session_id: number | null;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  stripe_payment_intent_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TransactionWithDetails extends Transaction {
  user_email: string;
  user_name: string;
  reader_name: string | null;
}

export interface TransactionStats {
  total_transactions: number;
  completed_transactions: number;
  failed_transactions: number;
  refunded_transactions: number;
  total_amount: number;
  avg_amount: number;
}

// ============================================================================
// PAYMENT TYPES
// ============================================================================

export interface PaymentIntent {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
}

export interface BalanceAddRequest {
  amount: number;
}

// ============================================================================
// STREAM TYPES
// ============================================================================

export type StreamStatus = 'scheduled' | 'live' | 'ended';

export interface LiveStream {
  id: number;
  reader_id: number;
  title: string;
  description: string;
  thumbnail_url: string | null;
  agora_channel_name: string;
  agora_token: string;
  status: StreamStatus;
  scheduled_start: string | null;
  started_at: string | null;
  ended_at: string | null;
  viewer_count: number;
  total_gifts_received: number;
  created_at: string;
  updated_at: string;
}

export interface StreamWithReader extends LiveStream {
  reader_name: string;
  reader_picture: string | null;
}

// ============================================================================
// PRODUCT TYPES
// ============================================================================

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  category: string;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: number;
  user_id: number;
  total_amount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shipping_address: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  price_at_purchase: number;
}

// ============================================================================
// COMMUNITY TYPES
// ============================================================================

export interface ForumPost {
  id: number;
  user_id: number;
  title: string;
  content: string;
  category: string;
  view_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
}

export interface ForumPostWithUser extends ForumPost {
  user_name: string;
  user_picture: string | null;
  comment_count: number;
}

export interface ForumComment {
  id: number;
  post_id: number;
  user_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ForumCommentWithUser extends ForumComment {
  user_name: string;
  user_picture: string | null;
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageWithUser extends Message {
  sender_name: string;
  sender_picture: string | null;
  receiver_name: string;
  receiver_picture: string | null;
}

export interface Conversation {
  other_user_id: number;
  other_user_name: string;
  other_user_picture: string | null;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

// ============================================================================
// REVIEW TYPES
// ============================================================================

export interface SessionReview {
  id: number;
  session_id: number;
  client_id: number;
  reader_id: number;
  rating: number;
  review_text: string | null;
  created_at: string;
}

export interface ReviewWithDetails extends SessionReview {
  client_name: string;
  session_type: SessionType;
  session_date: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    pages: number;
    currentPage: number;
  };
  timestamp: string;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
  timestamp: string;
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface LoginFormData {
  email: string;
  password: string;
}

export interface SignupFormData {
  email: string;
  password: string;
  displayName: string;
}

export interface ReaderProfileFormData {
  displayName: string;
  bio: string;
  specialties: string[];
  chatRate: number;
  callRate: number;
  videoRate: number;
  profilePictureUrl?: string;
}

export interface SessionReviewFormData {
  rating: number;
  reviewText: string;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export interface ReaderFilters {
  status?: 'online' | 'offline' | 'all';
  specialty?: string;
  minRating?: number;
  maxRate?: number;
  sortBy?: 'created_at' | 'average_rating' | 'total_sessions' | 'chat_rate';
  sortOrder?: 'ASC' | 'DESC';
}

export interface SessionFilters {
  status?: SessionStatus;
  sessionType?: SessionType;
  startDate?: string;
  endDate?: string;
}

export interface TransactionFilters {
  type?: TransactionType;
  status?: TransactionStatus;
  startDate?: string;
  endDate?: string;
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: SignupFormData) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

export interface BalanceContextType {
  balance: number;
  isLoading: boolean;
  refreshBalance: () => Promise<void>;
  addBalance: (amount: number) => Promise<PaymentIntent>;
}

export interface SessionContextType {
  activeSession: SessionWithDetails | null;
  isInSession: boolean;
  startSession: (readerId: number, sessionType: SessionType) => Promise<void>;
  endSession: (durationMinutes: number) => Promise<void>;
  cancelSession: (reason?: string) => Promise<void>;
}