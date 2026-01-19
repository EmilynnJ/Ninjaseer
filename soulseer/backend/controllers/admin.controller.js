/**
 * Admin Controller - Enterprise Level
 * Complete administrative management endpoints for SoulSeer platform
 */

const User = require('../models/User');
const Reader = require('../models/Reader');
const Session = require('../models/Session');
const Transaction = require('../models/Transaction');
const Stream = require('../models/Stream');
const Product = require('../models/Product');
const Forum = require('../models/Forum');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { logger } = require('../utils/logger');

class AdminController {
  // ============================================
  // DASHBOARD & ANALYTICS
  // ============================================

  /**
   * Get admin dashboard overview
   * GET /api/admin/dashboard
   */
  static async getDashboard(req, res) {
    try {
      const { period = '30d' } = req.query;

      // Get various statistics
      const [
        userStats,
        readerStats,
        sessionStats,
        revenueStats,
        streamStats,
        shopStats
      ] = await Promise.all([
        AdminController.getUserStats(period),
        AdminController.getReaderStats(period),
        AdminController.getSessionStats(period),
        AdminController.getRevenueStats(period),
        AdminController.getStreamStats(period),
        AdminController.getShopStats(period)
      ]);

      return successResponse(res, {
        dashboard: {
          users: userStats,
          readers: readerStats,
          sessions: sessionStats,
          revenue: revenueStats,
          streams: streamStats,
          shop: shopStats,
          period
        }
      });

    } catch (error) {
      logger.error('Error getting admin dashboard', { error: error.message });
      return errorResponse(res, 'Failed to get dashboard', 500);
    }
  }

  /**
   * Get detailed analytics
   * GET /api/admin/analytics
   */
  static async getAnalytics(req, res) {
    try {
      const {
        type = 'overview',
        period = '30d',
        start_date,
        end_date,
        granularity = 'day'
      } = req.query;

      let analytics;

      switch (type) {
        case 'users':
          analytics = await AdminController.getUserAnalytics(period, start_date, end_date, granularity);
          break;
        case 'revenue':
          analytics = await AdminController.getRevenueAnalytics(period, start_date, end_date, granularity);
          break;
        case 'sessions':
          analytics = await AdminController.getSessionAnalytics(period, start_date, end_date, granularity);
          break;
        case 'readers':
          analytics = await AdminController.getReaderAnalytics(period, start_date, end_date, granularity);
          break;
        default:
          analytics = await AdminController.getOverviewAnalytics(period, start_date, end_date, granularity);
      }

      return successResponse(res, { analytics, type, period });

    } catch (error) {
      logger.error('Error getting analytics', { error: error.message });
      return errorResponse(res, 'Failed to get analytics', 500);
    }
  }

  // Helper methods for stats
  static async getUserStats(period) {
    const { pool } = require('../config/database');
    const periodDays = parseInt(period) || 30;
    
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '${periodDays} days') as new_users,
        COUNT(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '7 days') as active_users,
        COUNT(*) FILTER (WHERE role = 'reader') as total_readers
      FROM users
    `);

    return result.rows[0];
  }

  static async getReaderStats(period) {
    const { pool } = require('../config/database');
    const periodDays = parseInt(period) || 30;

    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_readers,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_readers,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_readers,
        COUNT(*) FILTER (WHERE status = 'online') as online_readers,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '${periodDays} days') as new_readers
      FROM reader_profiles
    `);

    return result.rows[0];
  }

  static async getSessionStats(period) {
    const { pool } = require('../config/database');
    const periodDays = parseInt(period) || 30;

    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_sessions,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_sessions,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '${periodDays} days') as recent_sessions,
        COALESCE(SUM(duration_minutes), 0) as total_minutes,
        COALESCE(AVG(duration_minutes), 0) as avg_duration
      FROM reading_sessions
      WHERE created_at > NOW() - INTERVAL '${periodDays} days'
    `);

    return result.rows[0];
  }

  static async getRevenueStats(period) {
    const { pool } = require('../config/database');
    const periodDays = parseInt(period) || 30;

    const result = await pool.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_revenue,
        COALESCE(SUM(platform_fee), 0) as platform_revenue,
        COALESCE(SUM(CASE WHEN type = 'reading_payment' THEN amount ELSE 0 END), 0) as reading_revenue,
        COALESCE(SUM(CASE WHEN type = 'gift_purchase' THEN amount ELSE 0 END), 0) as gift_revenue,
        COALESCE(SUM(CASE WHEN type = 'product_purchase' THEN amount ELSE 0 END), 0) as shop_revenue,
        COUNT(*) as transaction_count
      FROM transactions
      WHERE status = 'completed'
        AND created_at > NOW() - INTERVAL '${periodDays} days'
    `);

    return result.rows[0];
  }

  static async getStreamStats(period) {
    const { pool } = require('../config/database');
    const periodDays = parseInt(period) || 30;

    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_streams,
        COUNT(*) FILTER (WHERE status = 'live') as live_streams,
        COALESCE(SUM(peak_viewers), 0) as total_peak_viewers,
        COALESCE(SUM(total_gifts_value), 0) as total_gifts_value,
        COALESCE(AVG(duration_minutes), 0) as avg_duration
      FROM streams
      WHERE created_at > NOW() - INTERVAL '${periodDays} days'
    `);

    return result.rows[0];
  }

  static async getShopStats(period) {
    const { pool } = require('../config/database');
    const periodDays = parseInt(period) || 30;

    const result = await pool.query(`
      SELECT 
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total), 0) as total_sales,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active') as active_products
      FROM orders o
      FULL OUTER JOIN products p ON true
      WHERE (o.created_at > NOW() - INTERVAL '${periodDays} days' OR o.id IS NULL)
    `);

    return result.rows[0];
  }

  static async getOverviewAnalytics(period, startDate, endDate, granularity) {
    // Implementation for overview analytics with time series data
    return {
      users: [],
      revenue: [],
      sessions: []
    };
  }

  static async getUserAnalytics(period, startDate, endDate, granularity) {
    return { signups: [], activeUsers: [], retention: [] };
  }

  static async getRevenueAnalytics(period, startDate, endDate, granularity) {
    return { daily: [], byType: [], growth: [] };
  }

  static async getSessionAnalytics(period, startDate, endDate, granularity) {
    return { daily: [], byType: [], avgDuration: [] };
  }

  static async getReaderAnalytics(period, startDate, endDate, granularity) {
    return { applications: [], approvals: [], earnings: [] };
  }

  // ============================================
  // USER MANAGEMENT
  // ============================================

  /**
   * Get all users
   * GET /api/admin/users
   */
  static async getUsers(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        role,
        status,
        search,
        sort_by = 'created_at',
        sort_order = 'DESC'
      } = req.query;

      const { pool } = require('../config/database');

      let whereClause = 'WHERE 1=1';
      const values = [];
      let paramIndex = 1;

      if (role) {
        whereClause += ` AND role = $${paramIndex++}`;
        values.push(role);
      }

      if (status) {
        whereClause += ` AND status = $${paramIndex++}`;
        values.push(status);
      }

      if (search) {
        whereClause += ` AND (
          display_name ILIKE $${paramIndex} OR 
          email ILIKE $${paramIndex}
        )`;
        values.push(`%${search}%`);
        paramIndex++;
      }

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM users ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].count);

      // Get users
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const usersResult = await pool.query(`
        SELECT 
          id, clerk_id, email, display_name, profile_image_url,
          role, status, balance, is_verified, is_online,
          created_at, last_login_at
        FROM users
        ${whereClause}
        ORDER BY ${sort_by} ${sort_order}
        LIMIT $${paramIndex++} OFFSET $${paramIndex}
      `, [...values, parseInt(limit), offset]);

      return paginatedResponse(res, usersResult.rows, {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      });

    } catch (error) {
      logger.error('Error getting users', { error: error.message });
      return errorResponse(res, 'Failed to get users', 500);
    }
  }

  /**
   * Get user by ID
   * GET /api/admin/users/:userId
   */
  static async getUser(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      // Get additional data
      const [transactions, sessions, stats] = await Promise.all([
        Transaction.getUserTransactions(userId, { limit: 10 }),
        Session.getUserSessions(userId, { limit: 10 }),
        User.getStatistics(userId)
      ]);

      return successResponse(res, {
        user,
        recentTransactions: transactions.transactions,
        recentSessions: sessions.sessions,
        statistics: stats
      });

    } catch (error) {
      logger.error('Error getting user', { error: error.message });
      return errorResponse(res, 'Failed to get user', 500);
    }
  }

  /**
   * Update user
   * PUT /api/admin/users/:userId
   */
  static async updateUser(req, res) {
    try {
      const adminId = req.auth.userId;
      const { userId } = req.params;
      const updates = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      // Admin can update more fields
      const allowedFields = [
        'display_name', 'email', 'role', 'status', 'balance',
        'is_verified', 'bio', 'profile_image_url'
      ];

      const filteredUpdates = {};
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = value;
        }
      }

      const updatedUser = await User.update(userId, filteredUpdates);

      // Log admin action
      logger.info('Admin updated user', {
        adminId,
        userId,
        updates: Object.keys(filteredUpdates)
      });

      return successResponse(res, {
        message: 'User updated successfully',
        user: updatedUser
      });

    } catch (error) {
      logger.error('Error updating user', { error: error.message });
      return errorResponse(res, error.message || 'Failed to update user', 500);
    }
  }

  /**
   * Suspend user
   * POST /api/admin/users/:userId/suspend
   */
  static async suspendUser(req, res) {
    try {
      const adminId = req.auth.userId;
      const { userId } = req.params;
      const { reason, duration } = req.body;

      if (userId === adminId) {
        return errorResponse(res, 'Cannot suspend yourself', 400);
      }

      const user = await User.findById(userId);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      await User.update(userId, {
        status: 'suspended',
        suspended_at: new Date(),
        suspended_reason: reason,
        suspended_until: duration ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null
      });

      // Notify user
      await Notification.create({
        user_id: userId,
        type: Notification.TYPES.ACCOUNT_UPDATE,
        title: 'Account Suspended',
        content: reason || 'Your account has been suspended',
        priority: Notification.PRIORITIES.URGENT
      });

      logger.info('Admin suspended user', { adminId, userId, reason });

      return successResponse(res, {
        message: 'User suspended successfully'
      });

    } catch (error) {
      logger.error('Error suspending user', { error: error.message });
      return errorResponse(res, 'Failed to suspend user', 500);
    }
  }

  /**
   * Unsuspend user
   * POST /api/admin/users/:userId/unsuspend
   */
  static async unsuspendUser(req, res) {
    try {
      const adminId = req.auth.userId;
      const { userId } = req.params;

      const user = await User.findById(userId);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      await User.update(userId, {
        status: 'active',
        suspended_at: null,
        suspended_reason: null,
        suspended_until: null
      });

      // Notify user
      await Notification.create({
        user_id: userId,
        type: Notification.TYPES.ACCOUNT_UPDATE,
        title: 'Account Restored',
        content: 'Your account has been restored',
        priority: Notification.PRIORITIES.HIGH
      });

      logger.info('Admin unsuspended user', { adminId, userId });

      return successResponse(res, {
        message: 'User unsuspended successfully'
      });

    } catch (error) {
      logger.error('Error unsuspending user', { error: error.message });
      return errorResponse(res, 'Failed to unsuspend user', 500);
    }
  }

  /**
   * Delete user
   * DELETE /api/admin/users/:userId
   */
  static async deleteUser(req, res) {
    try {
      const adminId = req.auth.userId;
      const { userId } = req.params;
      const { hard_delete = false } = req.query;

      if (userId === adminId) {
        return errorResponse(res, 'Cannot delete yourself', 400);
      }

      const user = await User.findById(userId);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      if (hard_delete === 'true') {
        // Permanent deletion - use with caution
        await User.hardDelete(userId);
        logger.warn('Admin hard deleted user', { adminId, userId });
      } else {
        // Soft delete
        await User.update(userId, { status: 'deleted', deleted_at: new Date() });
        logger.info('Admin soft deleted user', { adminId, userId });
      }

      return successResponse(res, {
        message: 'User deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting user', { error: error.message });
      return errorResponse(res, 'Failed to delete user', 500);
    }
  }

  /**
   * Adjust user balance
   * POST /api/admin/users/:userId/balance
   */
  static async adjustBalance(req, res) {
    try {
      const adminId = req.auth.userId;
      const { userId } = req.params;
      const { amount, type, reason } = req.body;

      if (!amount || typeof amount !== 'number') {
        return errorResponse(res, 'Valid amount is required', 400);
      }

      const user = await User.findById(userId);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      // Adjust balance
      if (amount > 0) {
        await User.addBalance(userId, amount);
      } else {
        await User.deductBalance(userId, Math.abs(amount));
      }

      // Create transaction record
      await Transaction.create({
        user_id: userId,
        type: type || Transaction.TYPES.ADJUSTMENT,
        amount: Math.abs(amount),
        status: Transaction.STATUSES.COMPLETED,
        description: reason || `Admin balance adjustment`,
        metadata: {
          admin_id: adminId,
          adjustment_type: amount > 0 ? 'credit' : 'debit'
        }
      });

      // Notify user
      await Notification.create({
        user_id: userId,
        type: Notification.TYPES.PAYMENT_RECEIVED,
        title: 'Balance Updated',
        content: `Your balance has been ${amount > 0 ? 'credited' : 'debited'} by $${Math.abs(amount).toFixed(2)}`,
        priority: Notification.PRIORITIES.NORMAL
      });

      logger.info('Admin adjusted user balance', { adminId, userId, amount, reason });

      const updatedUser = await User.findById(userId);

      return successResponse(res, {
        message: 'Balance adjusted successfully',
        newBalance: updatedUser.balance
      });

    } catch (error) {
      logger.error('Error adjusting balance', { error: error.message });
      return errorResponse(res, error.message || 'Failed to adjust balance', 500);
    }
  }

  // ============================================
  // READER MANAGEMENT
  // ============================================

  /**
   * Get all readers
   * GET /api/admin/readers
   */
  static async getReaders(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        search,
        sort_by = 'created_at',
        sort_order = 'DESC'
      } = req.query;

      const result = await Reader.getReaders({
        page: parseInt(page),
        limit: parseInt(limit),
        status: status || null,
        search: search || null,
        sortBy: sort_by,
        sortOrder: sort_order,
        includeAll: true // Include non-approved readers
      });

      return paginatedResponse(res, result.readers, result.pagination);

    } catch (error) {
      logger.error('Error getting readers', { error: error.message });
      return errorResponse(res, 'Failed to get readers', 500);
    }
  }

  /**
   * Get pending reader applications
   * GET /api/admin/readers/pending
   */
  static async getPendingReaders(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;

      const result = await Reader.getPendingApplications({
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return paginatedResponse(res, result.readers, result.pagination);

    } catch (error) {
      logger.error('Error getting pending readers', { error: error.message });
      return errorResponse(res, 'Failed to get pending readers', 500);
    }
  }

  /**
   * Approve reader application
   * POST /api/admin/readers/:readerId/approve
   */
  static async approveReader(req, res) {
    try {
      const adminId = req.auth.userId;
      const { readerId } = req.params;
      const { notes } = req.body;

      const reader = await Reader.findById(readerId);
      if (!reader) {
        return errorResponse(res, 'Reader not found', 404);
      }

      if (reader.status === 'approved') {
        return errorResponse(res, 'Reader is already approved', 400);
      }

      await Reader.approve(readerId, adminId, notes);

      // Update user role
      await User.update(reader.userId, { role: 'reader' });

      // Notify reader
      await Notification.create({
        user_id: reader.userId,
        type: Notification.TYPES.ACCOUNT_UPDATE,
        title: 'Application Approved!',
        content: 'Congratulations! Your reader application has been approved. You can now start accepting readings.',
        priority: Notification.PRIORITIES.HIGH
      });

      logger.info('Admin approved reader', { adminId, readerId });

      return successResponse(res, {
        message: 'Reader approved successfully'
      });

    } catch (error) {
      logger.error('Error approving reader', { error: error.message });
      return errorResponse(res, 'Failed to approve reader', 500);
    }
  }

  /**
   * Reject reader application
   * POST /api/admin/readers/:readerId/reject
   */
  static async rejectReader(req, res) {
    try {
      const adminId = req.auth.userId;
      const { readerId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return errorResponse(res, 'Rejection reason is required', 400);
      }

      const reader = await Reader.findById(readerId);
      if (!reader) {
        return errorResponse(res, 'Reader not found', 404);
      }

      await Reader.reject(readerId, adminId, reason);

      // Notify reader
      await Notification.create({
        user_id: reader.userId,
        type: Notification.TYPES.ACCOUNT_UPDATE,
        title: 'Application Update',
        content: `Your reader application was not approved. Reason: ${reason}`,
        priority: Notification.PRIORITIES.HIGH
      });

      logger.info('Admin rejected reader', { adminId, readerId, reason });

      return successResponse(res, {
        message: 'Reader application rejected'
      });

    } catch (error) {
      logger.error('Error rejecting reader', { error: error.message });
      return errorResponse(res, 'Failed to reject reader', 500);
    }
  }

  /**
   * Update reader
   * PUT /api/admin/readers/:readerId
   */
  static async updateReader(req, res) {
    try {
      const adminId = req.auth.userId;
      const { readerId } = req.params;
      const updates = req.body;

      const reader = await Reader.findById(readerId);
      if (!reader) {
        return errorResponse(res, 'Reader not found', 404);
      }

      const updatedReader = await Reader.update(readerId, updates);

      logger.info('Admin updated reader', { adminId, readerId, updates: Object.keys(updates) });

      return successResponse(res, {
        message: 'Reader updated successfully',
        reader: updatedReader
      });

    } catch (error) {
      logger.error('Error updating reader', { error: error.message });
      return errorResponse(res, error.message || 'Failed to update reader', 500);
    }
  }

  /**
   * Feature/unfeature reader
   * POST /api/admin/readers/:readerId/feature
   */
  static async featureReader(req, res) {
    try {
      const adminId = req.auth.userId;
      const { readerId } = req.params;
      const { featured = true } = req.body;

      const reader = await Reader.findById(readerId);
      if (!reader) {
        return errorResponse(res, 'Reader not found', 404);
      }

      await Reader.update(readerId, { is_featured: featured });

      logger.info('Admin featured reader', { adminId, readerId, featured });

      return successResponse(res, {
        message: featured ? 'Reader featured successfully' : 'Reader unfeatured'
      });

    } catch (error) {
      logger.error('Error featuring reader', { error: error.message });
      return errorResponse(res, 'Failed to feature reader', 500);
    }
  }

  // ============================================
  // TRANSACTION & PAYOUT MANAGEMENT
  // ============================================

  /**
   * Get all transactions
   * GET /api/admin/transactions
   */
  static async getTransactions(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        type,
        status,
        user_id,
        start_date,
        end_date,
        sort_by = 'created_at',
        sort_order = 'DESC'
      } = req.query;

      const result = await Transaction.getAll({
        page: parseInt(page),
        limit: parseInt(limit),
        type: type || null,
        status: status || null,
        userId: user_id || null,
        startDate: start_date ? new Date(start_date) : null,
        endDate: end_date ? new Date(end_date) : null,
        sortBy: sort_by,
        sortOrder: sort_order
      });

      return paginatedResponse(res, result.transactions, result.pagination);

    } catch (error) {
      logger.error('Error getting transactions', { error: error.message });
      return errorResponse(res, 'Failed to get transactions', 500);
    }
  }

  /**
   * Get pending payouts
   * GET /api/admin/payouts/pending
   */
  static async getPendingPayouts(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;

      const result = await Transaction.getPendingPayouts({
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return paginatedResponse(res, result.payouts, result.pagination);

    } catch (error) {
      logger.error('Error getting pending payouts', { error: error.message });
      return errorResponse(res, 'Failed to get pending payouts', 500);
    }
  }

  /**
   * Process payout
   * POST /api/admin/payouts/:payoutId/process
   */
  static async processPayout(req, res) {
    try {
      const adminId = req.auth.userId;
      const { payoutId } = req.params;

      const payout = await Transaction.findById(payoutId);
      if (!payout) {
        return errorResponse(res, 'Payout not found', 404);
      }

      if (payout.type !== Transaction.TYPES.PAYOUT_REQUEST) {
        return errorResponse(res, 'Invalid payout transaction', 400);
      }

      if (payout.status !== Transaction.STATUSES.PENDING) {
        return errorResponse(res, 'Payout already processed', 400);
      }

      // Process via Stripe
      const stripeService = require('../services/stripe.service');
      const reader = await Reader.findById(payout.readerId);
      
      const transfer = await stripeService.createTransfer(
        payout.amount,
        reader.stripeAccountId,
        `Payout for reader ${reader.displayName}`
      );

      // Update transaction
      await Transaction.update(payoutId, {
        status: Transaction.STATUSES.COMPLETED,
        stripe_transfer_id: transfer.id,
        processed_at: new Date(),
        processed_by: adminId
      });

      // Notify reader
      await Notification.create({
        user_id: reader.userId,
        type: Notification.TYPES.PAYOUT_PROCESSED,
        title: 'Payout Processed',
        content: `Your payout of $${payout.amount.toFixed(2)} has been processed`,
        priority: Notification.PRIORITIES.HIGH
      });

      logger.info('Admin processed payout', { adminId, payoutId, amount: payout.amount });

      return successResponse(res, {
        message: 'Payout processed successfully'
      });

    } catch (error) {
      logger.error('Error processing payout', { error: error.message });
      return errorResponse(res, error.message || 'Failed to process payout', 500);
    }
  }

  /**
   * Reject payout
   * POST /api/admin/payouts/:payoutId/reject
   */
  static async rejectPayout(req, res) {
    try {
      const adminId = req.auth.userId;
      const { payoutId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return errorResponse(res, 'Rejection reason is required', 400);
      }

      const payout = await Transaction.findById(payoutId);
      if (!payout) {
        return errorResponse(res, 'Payout not found', 404);
      }

      // Update transaction
      await Transaction.update(payoutId, {
        status: Transaction.STATUSES.FAILED,
        failure_reason: reason,
        processed_at: new Date(),
        processed_by: adminId
      });

      // Restore reader's pending balance
      await Reader.restorePendingBalance(payout.readerId, payout.amount);

      // Notify reader
      const reader = await Reader.findById(payout.readerId);
      await Notification.create({
        user_id: reader.userId,
        type: Notification.TYPES.PAYOUT_PROCESSED,
        title: 'Payout Rejected',
        content: `Your payout request was rejected. Reason: ${reason}`,
        priority: Notification.PRIORITIES.HIGH
      });

      logger.info('Admin rejected payout', { adminId, payoutId, reason });

      return successResponse(res, {
        message: 'Payout rejected'
      });

    } catch (error) {
      logger.error('Error rejecting payout', { error: error.message });
      return errorResponse(res, 'Failed to reject payout', 500);
    }
  }

  /**
   * Issue refund
   * POST /api/admin/transactions/:transactionId/refund
   */
  static async issueRefund(req, res) {
    try {
      const adminId = req.auth.userId;
      const { transactionId } = req.params;
      const { amount, reason } = req.body;

      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        return errorResponse(res, 'Transaction not found', 404);
      }

      if (transaction.status !== Transaction.STATUSES.COMPLETED) {
        return errorResponse(res, 'Can only refund completed transactions', 400);
      }

      const refundAmount = amount || transaction.amount;
      if (refundAmount > transaction.amount) {
        return errorResponse(res, 'Refund amount cannot exceed original amount', 400);
      }

      // Process refund
      const refund = await Transaction.processRefund(transactionId, refundAmount, {
        reason,
        admin_id: adminId
      });

      // Notify user
      await Notification.create({
        user_id: transaction.userId,
        type: Notification.TYPES.REFUND_PROCESSED,
        title: 'Refund Processed',
        content: `A refund of $${refundAmount.toFixed(2)} has been processed`,
        priority: Notification.PRIORITIES.HIGH
      });

      logger.info('Admin issued refund', { adminId, transactionId, refundAmount, reason });

      return successResponse(res, {
        message: 'Refund processed successfully',
        refund
      });

    } catch (error) {
      logger.error('Error issuing refund', { error: error.message });
      return errorResponse(res, error.message || 'Failed to issue refund', 500);
    }
  }

  // ============================================
  // CONTENT MODERATION
  // ============================================

  /**
   * Get reported content
   * GET /api/admin/reports
   */
  static async getReports(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        type,
        status = 'pending'
      } = req.query;

      const { pool } = require('../config/database');

      let whereClause = 'WHERE 1=1';
      const values = [];
      let paramIndex = 1;

      if (type) {
        whereClause += ` AND type = $${paramIndex++}`;
        values.push(type);
      }

      if (status) {
        whereClause += ` AND status = $${paramIndex++}`;
        values.push(status);
      }

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM reports ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].count);

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const reportsResult = await pool.query(`
        SELECT r.*, 
          u.display_name as reporter_name,
          u.email as reporter_email
        FROM reports r
        JOIN users u ON r.reporter_id = u.id
        ${whereClause}
        ORDER BY r.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex}
      `, [...values, parseInt(limit), offset]);

      return paginatedResponse(res, reportsResult.rows, {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      });

    } catch (error) {
      logger.error('Error getting reports', { error: error.message });
      return errorResponse(res, 'Failed to get reports', 500);
    }
  }

  /**
   * Resolve report
   * POST /api/admin/reports/:reportId/resolve
   */
  static async resolveReport(req, res) {
    try {
      const adminId = req.auth.userId;
      const { reportId } = req.params;
      const { action, notes } = req.body;

      const { pool } = require('../config/database');

      // Get report
      const reportResult = await pool.query(
        'SELECT * FROM reports WHERE id = $1',
        [reportId]
      );

      if (reportResult.rows.length === 0) {
        return errorResponse(res, 'Report not found', 404);
      }

      const report = reportResult.rows[0];

      // Take action based on report type
      if (action === 'remove') {
        switch (report.type) {
          case 'post':
            await Forum.deletePost(report.target_id);
            break;
          case 'comment':
            await Forum.deleteComment(report.target_id);
            break;
          case 'review':
            await Review.delete(report.target_id);
            break;
          case 'message':
            // Handle message removal
            break;
        }
      } else if (action === 'warn') {
        // Send warning to user
        await Notification.create({
          user_id: report.reported_user_id,
          type: Notification.TYPES.SECURITY_ALERT,
          title: 'Content Warning',
          content: 'Your content has been flagged for violating community guidelines',
          priority: Notification.PRIORITIES.HIGH
        });
      } else if (action === 'suspend') {
        // Suspend user
        await User.update(report.reported_user_id, {
          status: 'suspended',
          suspended_reason: 'Content violation'
        });
      }

      // Update report
      await pool.query(`
        UPDATE reports SET
          status = 'resolved',
          resolved_by = $1,
          resolved_at = NOW(),
          resolution_action = $2,
          resolution_notes = $3
        WHERE id = $4
      `, [adminId, action, notes, reportId]);

      logger.info('Admin resolved report', { adminId, reportId, action });

      return successResponse(res, {
        message: 'Report resolved successfully'
      });

    } catch (error) {
      logger.error('Error resolving report', { error: error.message });
      return errorResponse(res, 'Failed to resolve report', 500);
    }
  }

  /**
   * Get flagged reviews
   * GET /api/admin/reviews/flagged
   */
  static async getFlaggedReviews(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;

      const result = await Review.getFlagged({
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return paginatedResponse(res, result.reviews, result.pagination);

    } catch (error) {
      logger.error('Error getting flagged reviews', { error: error.message });
      return errorResponse(res, 'Failed to get flagged reviews', 500);
    }
  }

  /**
   * Moderate review
   * POST /api/admin/reviews/:reviewId/moderate
   */
  static async moderateReview(req, res) {
    try {
      const adminId = req.auth.userId;
      const { reviewId } = req.params;
      const { action, reason } = req.body;

      const review = await Review.findById(reviewId);
      if (!review) {
        return errorResponse(res, 'Review not found', 404);
      }

      if (action === 'approve') {
        await Review.approve(reviewId, adminId);
      } else if (action === 'reject') {
        await Review.reject(reviewId, adminId, reason);
        
        // Notify reviewer
        await Notification.create({
          user_id: review.reviewerId,
          type: Notification.TYPES.REVIEW_REJECTED,
          title: 'Review Rejected',
          content: reason || 'Your review was rejected for violating guidelines',
          priority: Notification.PRIORITIES.NORMAL
        });
      }

      logger.info('Admin moderated review', { adminId, reviewId, action });

      return successResponse(res, {
        message: `Review ${action}d successfully`
      });

    } catch (error) {
      logger.error('Error moderating review', { error: error.message });
      return errorResponse(res, 'Failed to moderate review', 500);
    }
  }

  // ============================================
  // SYSTEM SETTINGS
  // ============================================

  /**
   * Get system settings
   * GET /api/admin/settings
   */
  static async getSettings(req, res) {
    try {
      const { pool } = require('../config/database');

      const result = await pool.query('SELECT * FROM system_settings');

      const settings = {};
      for (const row of result.rows) {
        settings[row.key] = row.value;
      }

      return successResponse(res, { settings });

    } catch (error) {
      logger.error('Error getting settings', { error: error.message });
      return errorResponse(res, 'Failed to get settings', 500);
    }
  }

  /**
   * Update system settings
   * PUT /api/admin/settings
   */
  static async updateSettings(req, res) {
    try {
      const adminId = req.auth.userId;
      const { settings } = req.body;

      const { pool } = require('../config/database');

      for (const [key, value] of Object.entries(settings)) {
        await pool.query(`
          INSERT INTO system_settings (key, value, updated_at, updated_by)
          VALUES ($1, $2, NOW(), $3)
          ON CONFLICT (key) DO UPDATE SET
            value = $2,
            updated_at = NOW(),
            updated_by = $3
        `, [key, JSON.stringify(value), adminId]);
      }

      logger.info('Admin updated settings', { adminId, keys: Object.keys(settings) });

      return successResponse(res, {
        message: 'Settings updated successfully'
      });

    } catch (error) {
      logger.error('Error updating settings', { error: error.message });
      return errorResponse(res, 'Failed to update settings', 500);
    }
  }

  /**
   * Send system announcement
   * POST /api/admin/announcements
   */
  static async sendAnnouncement(req, res) {
    try {
      const adminId = req.auth.userId;
      const { title, content, target_audience = 'all', priority = 'normal' } = req.body;

      if (!title || !content) {
        return errorResponse(res, 'Title and content are required', 400);
      }

      // Get target users
      const { pool } = require('../config/database');
      let userQuery = 'SELECT id FROM users WHERE status = $1';
      const queryParams = ['active'];

      if (target_audience === 'readers') {
        userQuery += ' AND role = $2';
        queryParams.push('reader');
      } else if (target_audience === 'clients') {
        userQuery += ' AND role = $2';
        queryParams.push('user');
      }

      const usersResult = await pool.query(userQuery, queryParams);

      // Send notifications
      for (const user of usersResult.rows) {
        await Notification.create({
          user_id: user.id,
          type: Notification.TYPES.SYSTEM_ANNOUNCEMENT,
          title,
          content,
          priority: priority === 'high' ? Notification.PRIORITIES.HIGH : Notification.PRIORITIES.NORMAL,
          actor_id: adminId
        });
      }

      logger.info('Admin sent announcement', { 
        adminId, 
        title, 
        targetAudience: target_audience,
        recipientCount: usersResult.rows.length 
      });

      return successResponse(res, {
        message: 'Announcement sent successfully',
        recipientCount: usersResult.rows.length
      });

    } catch (error) {
      logger.error('Error sending announcement', { error: error.message });
      return errorResponse(res, 'Failed to send announcement', 500);
    }
  }

  // ============================================
  // GIFT MANAGEMENT
  // ============================================

  /**
   * Get all gifts
   * GET /api/admin/gifts
   */
  static async getGifts(req, res) {
    try {
      const { page = 1, limit = 50, category, is_active } = req.query;

      const Gift = require('../models/Gift');
      const result = await Gift.getAll({
        page: parseInt(page),
        limit: parseInt(limit),
        category: category || null,
        isActive: is_active === 'true' ? true : is_active === 'false' ? false : null
      });

      return paginatedResponse(res, result.gifts, result.pagination);

    } catch (error) {
      logger.error('Error getting gifts', { error: error.message });
      return errorResponse(res, 'Failed to get gifts', 500);
    }
  }

  /**
   * Create gift
   * POST /api/admin/gifts
   */
  static async createGift(req, res) {
    try {
      const adminId = req.auth.userId;
      const giftData = req.body;

      const Gift = require('../models/Gift');
      const gift = await Gift.create(giftData);

      logger.info('Admin created gift', { adminId, giftId: gift.id });

      return successResponse(res, {
        message: 'Gift created successfully',
        gift
      }, 201);

    } catch (error) {
      logger.error('Error creating gift', { error: error.message });
      return errorResponse(res, error.message || 'Failed to create gift', 500);
    }
  }

  /**
   * Update gift
   * PUT /api/admin/gifts/:giftId
   */
  static async updateGift(req, res) {
    try {
      const adminId = req.auth.userId;
      const { giftId } = req.params;
      const updates = req.body;

      const Gift = require('../models/Gift');
      const gift = await Gift.update(giftId, updates);

      logger.info('Admin updated gift', { adminId, giftId });

      return successResponse(res, {
        message: 'Gift updated successfully',
        gift
      });

    } catch (error) {
      logger.error('Error updating gift', { error: error.message });
      return errorResponse(res, error.message || 'Failed to update gift', 500);
    }
  }

  /**
   * Delete gift
   * DELETE /api/admin/gifts/:giftId
   */
  static async deleteGift(req, res) {
    try {
      const adminId = req.auth.userId;
      const { giftId } = req.params;

      const Gift = require('../models/Gift');
      await Gift.delete(giftId);

      logger.info('Admin deleted gift', { adminId, giftId });

      return successResponse(res, {
        message: 'Gift deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting gift', { error: error.message });
      return errorResponse(res, 'Failed to delete gift', 500);
    }
  }

  // ============================================
  // PRODUCT MANAGEMENT
  // ============================================

  /**
   * Get all products (admin view)
   * GET /api/admin/products
   */
  static async getProducts(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        category,
        seller_id
      } = req.query;

      const result = await Product.getProducts({
        page: parseInt(page),
        limit: parseInt(limit),
        status: status || null,
        category: category || null,
        sellerId: seller_id || null,
        includeAll: true
      });

      return paginatedResponse(res, result.products, result.pagination);

    } catch (error) {
      logger.error('Error getting products', { error: error.message });
      return errorResponse(res, 'Failed to get products', 500);
    }
  }

  /**
   * Update product status
   * PUT /api/admin/products/:productId/status
   */
  static async updateProductStatus(req, res) {
    try {
      const adminId = req.auth.userId;
      const { productId } = req.params;
      const { status, reason } = req.body;

      const product = await Product.findById(productId);
      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      await Product.update(productId, { status });

      // Notify seller if product is rejected/removed
      if (status === 'rejected' || status === 'removed') {
        const seller = await Reader.findById(product.sellerId);
        if (seller) {
          await Notification.create({
            user_id: seller.userId,
            type: Notification.TYPES.ACCOUNT_UPDATE,
            title: 'Product Status Update',
            content: `Your product "${product.name}" has been ${status}. ${reason || ''}`,
            priority: Notification.PRIORITIES.HIGH
          });
        }
      }

      logger.info('Admin updated product status', { adminId, productId, status });

      return successResponse(res, {
        message: 'Product status updated'
      });

    } catch (error) {
      logger.error('Error updating product status', { error: error.message });
      return errorResponse(res, 'Failed to update product status', 500);
    }
  }

  // ============================================
  // AUDIT LOGS
  // ============================================

  /**
   * Get audit logs
   * GET /api/admin/audit-logs
   */
  static async getAuditLogs(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        action,
        admin_id,
        start_date,
        end_date
      } = req.query;

      const { pool } = require('../config/database');

      let whereClause = 'WHERE 1=1';
      const values = [];
      let paramIndex = 1;

      if (action) {
        whereClause += ` AND action = $${paramIndex++}`;
        values.push(action);
      }

      if (admin_id) {
        whereClause += ` AND admin_id = $${paramIndex++}`;
        values.push(admin_id);
      }

      if (start_date) {
        whereClause += ` AND created_at >= $${paramIndex++}`;
        values.push(new Date(start_date));
      }

      if (end_date) {
        whereClause += ` AND created_at <= $${paramIndex++}`;
        values.push(new Date(end_date));
      }

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM audit_logs ${whereClause}`,
        values
      );
      const total = parseInt(countResult.rows[0].count);

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const logsResult = await pool.query(`
        SELECT al.*, u.display_name as admin_name
        FROM audit_logs al
        LEFT JOIN users u ON al.admin_id = u.id
        ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex}
      `, [...values, parseInt(limit), offset]);

      return paginatedResponse(res, logsResult.rows, {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      });

    } catch (error) {
      logger.error('Error getting audit logs', { error: error.message });
      return errorResponse(res, 'Failed to get audit logs', 500);
    }
  }
}

module.exports = AdminController;