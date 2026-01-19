/**
 * User Controller - Enterprise Level
 * Complete user management endpoints for SoulSeer platform
 */

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { logger } = require('../utils/logger');

class UserController {
  /**
   * Get current user profile
   * GET /api/users/me
   */
  static async getCurrentUser(req, res) {
    try {
      const userId = req.auth.userId;

      const user = await User.findById(userId);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      // Get additional stats
      const stats = await User.getStatistics(userId);

      return successResponse(res, {
        user: {
          ...user,
          statistics: stats
        }
      });

    } catch (error) {
      logger.error('Error getting current user', { error: error.message });
      return errorResponse(res, 'Failed to get user profile', 500);
    }
  }

  /**
   * Get user by ID (public profile)
   * GET /api/users/:userId
   */
  static async getUserById(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      // Return limited public info
      const publicProfile = {
        id: user.id,
        displayName: user.displayName,
        profileImageUrl: user.profileImageUrl,
        bio: user.bio,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      };

      return successResponse(res, { user: publicProfile });

    } catch (error) {
      logger.error('Error getting user by ID', { error: error.message });
      return errorResponse(res, 'Failed to get user profile', 500);
    }
  }

  /**
   * Update current user profile
   * PUT /api/users/me
   */
  static async updateProfile(req, res) {
    try {
      const userId = req.auth.userId;
      const updates = req.body;

      // Validate allowed fields
      const allowedFields = [
        'display_name', 'bio', 'profile_image_url', 'cover_image_url',
        'phone', 'date_of_birth', 'timezone', 'language', 'preferences'
      ];

      const filteredUpdates = {};
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = value;
        }
      }

      if (Object.keys(filteredUpdates).length === 0) {
        return errorResponse(res, 'No valid fields to update', 400);
      }

      const updatedUser = await User.update(userId, filteredUpdates);

      return successResponse(res, {
        message: 'Profile updated successfully',
        user: updatedUser
      });

    } catch (error) {
      logger.error('Error updating profile', { error: error.message });
      return errorResponse(res, error.message || 'Failed to update profile', 500);
    }
  }

  /**
   * Update user preferences
   * PUT /api/users/me/preferences
   */
  static async updatePreferences(req, res) {
    try {
      const userId = req.auth.userId;
      const { preferences } = req.body;

      if (!preferences || typeof preferences !== 'object') {
        return errorResponse(res, 'Invalid preferences format', 400);
      }

      const updatedUser = await User.update(userId, { preferences });

      return successResponse(res, {
        message: 'Preferences updated successfully',
        preferences: updatedUser.preferences
      });

    } catch (error) {
      logger.error('Error updating preferences', { error: error.message });
      return errorResponse(res, 'Failed to update preferences', 500);
    }
  }

  /**
   * Get user's balance
   * GET /api/users/me/balance
   */
  static async getBalance(req, res) {
    try {
      const userId = req.auth.userId;

      const user = await User.findById(userId);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      // Get recent transactions
      const recentTransactions = await Transaction.getUserTransactions(userId, {
        limit: 5
      });

      return successResponse(res, {
        balance: user.balance,
        currency: 'USD',
        recentTransactions: recentTransactions.transactions
      });

    } catch (error) {
      logger.error('Error getting balance', { error: error.message });
      return errorResponse(res, 'Failed to get balance', 500);
    }
  }

  /**
   * Add funds to balance
   * POST /api/users/me/balance/add
   */
  static async addBalance(req, res) {
    try {
      const userId = req.auth.userId;
      const { amount, payment_method_id } = req.body;

      // Validate amount
      const validAmounts = [10, 20, 30, 50, 100];
      if (!validAmounts.includes(amount)) {
        return errorResponse(res, 'Invalid amount. Choose from $10, $20, $30, $50, or $100', 400);
      }

      if (!payment_method_id) {
        return errorResponse(res, 'Payment method is required', 400);
      }

      // Process payment via Stripe
      const stripeService = require('../services/stripe.service');
      const paymentResult = await stripeService.chargeCard(
        userId,
        amount,
        payment_method_id,
        'Balance top-up'
      );

      if (!paymentResult.success) {
        return errorResponse(res, paymentResult.error || 'Payment failed', 400);
      }

      // Add to user balance
      const updatedUser = await User.addBalance(userId, amount);

      // Create transaction record
      await Transaction.create({
        user_id: userId,
        type: Transaction.TYPES.BALANCE_ADD,
        amount: amount,
        payment_method: 'stripe_card',
        stripe_payment_intent_id: paymentResult.paymentIntentId,
        status: Transaction.STATUSES.COMPLETED,
        description: `Added $${amount} to balance`
      });

      // Send notification
      await Notification.create({
        user_id: userId,
        type: Notification.TYPES.PAYMENT_RECEIVED,
        title: 'Funds Added',
        content: `$${amount.toFixed(2)} has been added to your balance`,
        priority: Notification.PRIORITIES.NORMAL
      });

      return successResponse(res, {
        message: 'Funds added successfully',
        newBalance: updatedUser.balance,
        transaction: {
          amount,
          paymentIntentId: paymentResult.paymentIntentId
        }
      });

    } catch (error) {
      logger.error('Error adding balance', { error: error.message });
      return errorResponse(res, error.message || 'Failed to add funds', 500);
    }
  }

  /**
   * Get user's transaction history
   * GET /api/users/me/transactions
   */
  static async getTransactions(req, res) {
    try {
      const userId = req.auth.userId;
      const {
        page = 1,
        limit = 20,
        type,
        status,
        start_date,
        end_date
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        type: type || null,
        status: status || null,
        startDate: start_date ? new Date(start_date) : null,
        endDate: end_date ? new Date(end_date) : null
      };

      const result = await Transaction.getUserTransactions(userId, options);

      return paginatedResponse(res, result.transactions, result.pagination);

    } catch (error) {
      logger.error('Error getting transactions', { error: error.message });
      return errorResponse(res, 'Failed to get transactions', 500);
    }
  }

  /**
   * Get user's favorite readers
   * GET /api/users/me/favorites
   */
  static async getFavorites(req, res) {
    try {
      const userId = req.auth.userId;
      const { page = 1, limit = 20 } = req.query;

      const result = await User.getFavoriteReaders(userId, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return paginatedResponse(res, result.readers, result.pagination);

    } catch (error) {
      logger.error('Error getting favorites', { error: error.message });
      return errorResponse(res, 'Failed to get favorite readers', 500);
    }
  }

  /**
   * Add reader to favorites
   * POST /api/users/me/favorites/:readerId
   */
  static async addFavorite(req, res) {
    try {
      const userId = req.auth.userId;
      const { readerId } = req.params;

      await User.addFavoriteReader(userId, readerId);

      return successResponse(res, {
        message: 'Reader added to favorites'
      });

    } catch (error) {
      logger.error('Error adding favorite', { error: error.message });
      return errorResponse(res, error.message || 'Failed to add favorite', 500);
    }
  }

  /**
   * Remove reader from favorites
   * DELETE /api/users/me/favorites/:readerId
   */
  static async removeFavorite(req, res) {
    try {
      const userId = req.auth.userId;
      const { readerId } = req.params;

      await User.removeFavoriteReader(userId, readerId);

      return successResponse(res, {
        message: 'Reader removed from favorites'
      });

    } catch (error) {
      logger.error('Error removing favorite', { error: error.message });
      return errorResponse(res, error.message || 'Failed to remove favorite', 500);
    }
  }

  /**
   * Get user's session history
   * GET /api/users/me/sessions
   */
  static async getSessionHistory(req, res) {
    try {
      const userId = req.auth.userId;
      const { page = 1, limit = 20, status } = req.query;

      const Session = require('../models/Session');
      const result = await Session.getClientSessions(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        status: status || null
      });

      return paginatedResponse(res, result.sessions, result.pagination);

    } catch (error) {
      logger.error('Error getting session history', { error: error.message });
      return errorResponse(res, 'Failed to get session history', 500);
    }
  }

  /**
   * Get user's notifications
   * GET /api/users/me/notifications
   */
  static async getNotifications(req, res) {
    try {
      const userId = req.auth.userId;
      const { page = 1, limit = 20, category, is_read } = req.query;

      const result = await Notification.getUserNotifications(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        category: category || null,
        isRead: is_read !== undefined ? is_read === 'true' : null
      });

      // Get unread count
      const unreadCount = await Notification.getUnreadCount(userId);

      return successResponse(res, {
        notifications: result.notifications,
        pagination: result.pagination,
        unreadCount
      });

    } catch (error) {
      logger.error('Error getting notifications', { error: error.message });
      return errorResponse(res, 'Failed to get notifications', 500);
    }
  }

  /**
   * Mark notification as read
   * PUT /api/users/me/notifications/:notificationId/read
   */
  static async markNotificationRead(req, res) {
    try {
      const userId = req.auth.userId;
      const { notificationId } = req.params;

      await Notification.markAsRead(notificationId, userId);

      return successResponse(res, {
        message: 'Notification marked as read'
      });

    } catch (error) {
      logger.error('Error marking notification read', { error: error.message });
      return errorResponse(res, 'Failed to mark notification as read', 500);
    }
  }

  /**
   * Mark all notifications as read
   * PUT /api/users/me/notifications/read-all
   */
  static async markAllNotificationsRead(req, res) {
    try {
      const userId = req.auth.userId;
      const { category } = req.body;

      const count = await Notification.markAllAsRead(userId, category);

      return successResponse(res, {
        message: `${count} notifications marked as read`
      });

    } catch (error) {
      logger.error('Error marking all notifications read', { error: error.message });
      return errorResponse(res, 'Failed to mark notifications as read', 500);
    }
  }

  /**
   * Get notification preferences
   * GET /api/users/me/notification-preferences
   */
  static async getNotificationPreferences(req, res) {
    try {
      const userId = req.auth.userId;

      const preferences = await Notification.getUserPreferences(userId);

      return successResponse(res, { preferences });

    } catch (error) {
      logger.error('Error getting notification preferences', { error: error.message });
      return errorResponse(res, 'Failed to get notification preferences', 500);
    }
  }

  /**
   * Update notification preferences
   * PUT /api/users/me/notification-preferences
   */
  static async updateNotificationPreferences(req, res) {
    try {
      const userId = req.auth.userId;
      const { preferences } = req.body;

      const updatedPreferences = await Notification.updateUserPreferences(userId, preferences);

      return successResponse(res, {
        message: 'Notification preferences updated',
        preferences: updatedPreferences
      });

    } catch (error) {
      logger.error('Error updating notification preferences', { error: error.message });
      return errorResponse(res, 'Failed to update notification preferences', 500);
    }
  }

  /**
   * Register push notification token
   * POST /api/users/me/push-tokens
   */
  static async registerPushToken(req, res) {
    try {
      const userId = req.auth.userId;
      const { token, platform, device_id, device_name } = req.body;

      if (!token || !platform) {
        return errorResponse(res, 'Token and platform are required', 400);
      }

      await Notification.registerPushToken(userId, {
        token,
        platform,
        device_id,
        device_name
      });

      return successResponse(res, {
        message: 'Push token registered successfully'
      });

    } catch (error) {
      logger.error('Error registering push token', { error: error.message });
      return errorResponse(res, 'Failed to register push token', 500);
    }
  }

  /**
   * Unregister push notification token
   * DELETE /api/users/me/push-tokens
   */
  static async unregisterPushToken(req, res) {
    try {
      const userId = req.auth.userId;
      const { token } = req.body;

      if (!token) {
        return errorResponse(res, 'Token is required', 400);
      }

      await Notification.unregisterPushToken(userId, token);

      return successResponse(res, {
        message: 'Push token unregistered successfully'
      });

    } catch (error) {
      logger.error('Error unregistering push token', { error: error.message });
      return errorResponse(res, 'Failed to unregister push token', 500);
    }
  }

  /**
   * Get user's reviews
   * GET /api/users/me/reviews
   */
  static async getMyReviews(req, res) {
    try {
      const userId = req.auth.userId;
      const { page = 1, limit = 20, type } = req.query;

      const Review = require('../models/Review');
      const result = await Review.getUserReviews(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        type: type || null
      });

      return paginatedResponse(res, result.reviews, result.pagination);

    } catch (error) {
      logger.error('Error getting user reviews', { error: error.message });
      return errorResponse(res, 'Failed to get reviews', 500);
    }
  }

  /**
   * Get user's orders
   * GET /api/users/me/orders
   */
  static async getMyOrders(req, res) {
    try {
      const userId = req.auth.userId;
      const { page = 1, limit = 20, status } = req.query;

      const Product = require('../models/Product');
      const result = await Product.getUserOrders(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        status: status || null
      });

      return paginatedResponse(res, result.orders, result.pagination);

    } catch (error) {
      logger.error('Error getting user orders', { error: error.message });
      return errorResponse(res, 'Failed to get orders', 500);
    }
  }

  /**
   * Get user's gift history
   * GET /api/users/me/gifts
   */
  static async getMyGifts(req, res) {
    try {
      const userId = req.auth.userId;
      const { page = 1, limit = 20, type = 'received' } = req.query;

      const Gift = require('../models/Gift');
      
      let result;
      if (type === 'sent') {
        result = await Gift.getSentGifts(userId, {
          page: parseInt(page),
          limit: parseInt(limit)
        });
      } else {
        result = await Gift.getReceivedGifts(userId, {
          page: parseInt(page),
          limit: parseInt(limit)
        });
      }

      return paginatedResponse(res, result.gifts, result.pagination);

    } catch (error) {
      logger.error('Error getting user gifts', { error: error.message });
      return errorResponse(res, 'Failed to get gifts', 500);
    }
  }

  /**
   * Delete user account
   * DELETE /api/users/me
   */
  static async deleteAccount(req, res) {
    try {
      const userId = req.auth.userId;
      const { password, reason } = req.body;

      // Verify password or confirmation
      if (!password) {
        return errorResponse(res, 'Password confirmation required', 400);
      }

      // Check for pending sessions or orders
      const Session = require('../models/Session');
      const pendingSessions = await Session.getClientSessions(userId, {
        status: ['pending', 'in_progress']
      });

      if (pendingSessions.sessions.length > 0) {
        return errorResponse(res, 'Cannot delete account with pending sessions', 400);
      }

      // Soft delete the account
      await User.update(userId, {
        is_active: false,
        deleted_at: new Date(),
        deletion_reason: reason
      });

      // Log the deletion
      logger.info('User account deleted', { userId, reason });

      return successResponse(res, {
        message: 'Account deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting account', { error: error.message });
      return errorResponse(res, 'Failed to delete account', 500);
    }
  }

  /**
   * Get user statistics/dashboard data
   * GET /api/users/me/dashboard
   */
  static async getDashboard(req, res) {
    try {
      const userId = req.auth.userId;

      const user = await User.findById(userId);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      // Get various stats
      const [
        stats,
        recentTransactions,
        unreadNotifications,
        upcomingSessions
      ] = await Promise.all([
        User.getStatistics(userId),
        Transaction.getUserTransactions(userId, { limit: 5 }),
        Notification.getUnreadCount(userId),
        this.getUpcomingSessions(userId)
      ]);

      return successResponse(res, {
        user: {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          profileImageUrl: user.profileImageUrl,
          balance: user.balance,
          isReader: user.isReader
        },
        statistics: stats,
        recentTransactions: recentTransactions.transactions,
        unreadNotifications,
        upcomingSessions
      });

    } catch (error) {
      logger.error('Error getting dashboard', { error: error.message });
      return errorResponse(res, 'Failed to get dashboard data', 500);
    }
  }

  /**
   * Helper: Get upcoming sessions
   */
  static async getUpcomingSessions(userId) {
    try {
      const Session = require('../models/Session');
      const result = await Session.getClientSessions(userId, {
        status: ['scheduled', 'pending'],
        limit: 5
      });
      return result.sessions;
    } catch (error) {
      return [];
    }
  }

  /**
   * Search users (admin only)
   * GET /api/users/search
   */
  static async searchUsers(req, res) {
    try {
      const { q, page = 1, limit = 20, role } = req.query;

      if (!q || q.length < 2) {
        return errorResponse(res, 'Search query must be at least 2 characters', 400);
      }

      const result = await User.search(q, {
        page: parseInt(page),
        limit: parseInt(limit),
        role: role || null
      });

      return paginatedResponse(res, result.users, result.pagination);

    } catch (error) {
      logger.error('Error searching users', { error: error.message });
      return errorResponse(res, 'Failed to search users', 500);
    }
  }

  /**
   * Become a reader (apply)
   * POST /api/users/me/become-reader
   */
  static async becomeReader(req, res) {
    try {
      const userId = req.auth.userId;
      const applicationData = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      if (user.isReader) {
        return errorResponse(res, 'You are already a reader', 400);
      }

      // Create reader application
      const Reader = require('../models/Reader');
      const application = await Reader.createApplication(userId, applicationData);

      // Send notification to admins
      await Notification.broadcast({
        type: Notification.TYPES.SYSTEM_ANNOUNCEMENT,
        title: 'New Reader Application',
        content: `${user.displayName} has applied to become a reader`,
        priority: Notification.PRIORITIES.HIGH
      }, { role: 'admin' });

      return successResponse(res, {
        message: 'Application submitted successfully',
        application
      }, 201);

    } catch (error) {
      logger.error('Error submitting reader application', { error: error.message });
      return errorResponse(res, error.message || 'Failed to submit application', 500);
    }
  }

  /**
   * Get reader application status
   * GET /api/users/me/reader-application
   */
  static async getReaderApplication(req, res) {
    try {
      const userId = req.auth.userId;

      const Reader = require('../models/Reader');
      const application = await Reader.getApplicationByUserId(userId);

      if (!application) {
        return errorResponse(res, 'No application found', 404);
      }

      return successResponse(res, { application });

    } catch (error) {
      logger.error('Error getting reader application', { error: error.message });
      return errorResponse(res, 'Failed to get application status', 500);
    }
  }
}

module.exports = UserController;