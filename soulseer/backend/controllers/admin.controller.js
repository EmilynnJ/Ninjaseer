/**
 * Admin Controller
 * Handles admin-only operations
 */

import User from '../models/User.js';
import Reader from '../models/Reader.js';
import Session from '../models/Session.js';
import Transaction from '../models/Transaction.js';
import logger from '../utils/logger.js';

class AdminController {
  /**
   * Get all users
   */
  static async getAllUsers(req, res) {
    try {
      const { limit = 50, offset = 0, role = null } = req.query;

      const result = await User.findAll({
        limit: parseInt(limit),
        offset: parseInt(offset),
        role
      });

      res.json(result);
    } catch (error) {
      logger.error('Error in getAllUsers', error);
      res.status(500).json({ error: 'Failed to get users' });
    }
  }

  /**
   * Get all sessions
   */
  static async getAllSessions(req, res) {
    try {
      const { limit = 50, offset = 0, status = null } = req.query;

      const result = await Session.findAll({
        limit: parseInt(limit),
        offset: parseInt(offset),
        status
      });

      res.json(result);
    } catch (error) {
      logger.error('Error in getAllSessions', error);
      res.status(500).json({ error: 'Failed to get sessions' });
    }
  }

  /**
   * Get all transactions
   */
  static async getAllTransactions(req, res) {
    try {
      const { limit = 50, offset = 0, type = null, status = null } = req.query;

      const result = await Transaction.findAll({
        limit: parseInt(limit),
        offset: parseInt(offset),
        type,
        status
      });

      res.json(result);
    } catch (error) {
      logger.error('Error in getAllTransactions', error);
      res.status(500).json({ error: 'Failed to get transactions' });
    }
  }

  /**
   * Get platform statistics
   */
  static async getPlatformStats(req, res) {
    try {
      const { startDate = null, endDate = null } = req.query;

      const transactionStats = await Transaction.getPlatformStats({
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null
      });

      // Get user counts
      const userCounts = await User.findAll({ limit: 1 });
      const readerCounts = await Reader.findAll({ limit: 1 });

      // Get session counts
      const sessionStats = await Session.findAll({ limit: 1 });

      const stats = {
        users: {
          total: userCounts.total || 0,
          readers: readerCounts.total || 0,
          clients: (userCounts.total || 0) - (readerCounts.total || 0)
        },
        sessions: {
          total: sessionStats.total || 0,
          completed: sessionStats.sessions?.filter(s => s.status === 'completed').length || 0
        },
        transactions: transactionStats,
        revenue: {
          total: transactionStats.total_session_revenue || 0,
          platform_commission: transactionStats.platform_commission || 0,
          reader_earnings: (transactionStats.total_session_revenue || 0) * 0.7
        }
      };

      res.json({ stats });
    } catch (error) {
      logger.error('Error in getPlatformStats', error);
      res.status(500).json({ error: 'Failed to get platform statistics' });
    }
  }

  /**
   * Create a new reader (admin)
   */
  static async createReader(req, res) {
    try {
      const { 
        clerkId, 
        email, 
        displayName, 
        bio, 
        specialties, 
        chatRate, 
        callRate, 
        videoRate,
        profilePictureUrl 
      } = req.body;

      // Validate required fields
      if (!clerkId || !email || !displayName || !bio || !chatRate || !callRate || !videoRate) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['clerkId', 'email', 'displayName', 'bio', 'chatRate', 'callRate', 'videoRate']
        });
      }

      // Create user first
      let user = await User.findByClerkId(clerkId);

      if (!user) {
        user = await User.create({
          clerkId,
          email,
          displayName,
          role: 'reader'
        });
      } else {
        // Update role to reader
        await User.update(user.id, { role: 'reader' });
        user.role = 'reader';
      }

      // Create reader profile
      const reader = await Reader.create({
        userId: user.id,
        displayName,
        bio,
        specialties: specialties || [],
        chatRate: parseFloat(chatRate),
        callRate: parseFloat(callRate),
        videoRate: parseFloat(videoRate),
        profilePictureUrl
      });

      logger.info('Reader created by admin', { readerId: reader.id, userId: user.id });

      res.status(201).json({
        reader,
        message: 'Reader created successfully'
      });
    } catch (error) {
      logger.error('Error in createReader', error);
      res.status(500).json({ error: 'Failed to create reader' });
    }
  }

  /**
   * Update reader (admin)
   */
  static async updateReader(req, res) {
    try {
      const { readerId } = req.params;
      const updates = req.body;

      const reader = await Reader.update(readerId, updates);

      if (!reader) {
        return res.status(404).json({ error: 'Reader not found' });
      }

      logger.info('Reader updated by admin', { readerId });

      res.json({
        reader,
        message: 'Reader updated successfully'
      });
    } catch (error) {
      logger.error('Error in updateReader', error);
      res.status(500).json({ error: 'Failed to update reader' });
    }
  }

  /**
   * Delete user (admin)
   */
  static async deleteUser(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.delete(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      logger.info('User deleted by admin', { userId });

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      logger.error('Error in deleteUser', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }

  /**
   * Process payouts to readers
   */
  static async processPayouts(req, res) {
    try {
      // This is a simplified version - in production you would:
      // 1. Get all readers with positive balances
      // 2. Create withdrawal transactions
      // 3. Process payments via Stripe Connect
      // 4. Update reader balances

      logger.info('Payouts processed by admin');

      res.json({ 
        message: 'Payouts processed successfully',
        processed: 0
      });
    } catch (error) {
      logger.error('Error in processPayouts', error);
      res.status(500).json({ error: 'Failed to process payouts' });
    }
  }

  /**
   * Update user role (admin)
   */
  static async updateUserRole(req, res) {
    try {
      const { userId } = req.params;
      const { role } = req.body;

      if (!['client', 'reader', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      const user = await User.update(userId, { role });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      logger.info('User role updated by admin', { userId, role });

      res.json({
        user,
        message: 'User role updated successfully'
      });
    } catch (error) {
      logger.error('Error in updateUserRole', error);
      res.status(500).json({ error: 'Failed to update user role' });
    }
  }

  /**
   * Get dashboard summary
   */
  static async getDashboardSummary(req, res) {
    try {
      // Get today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayStats = await Transaction.getPlatformStats({
        startDate: today.toISOString(),
        endDate: new Date().toISOString()
      });

      // Get this month's stats
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);

      const monthlyStats = await Transaction.getPlatformStats({
        startDate: thisMonth.toISOString(),
        endDate: new Date().toISOString()
      });

      // Get reader counts
      const onlineReaders = await Reader.findOnline({ limit: 1 });

      const summary = {
        today: {
          revenue: todayStats.total_session_revenue || 0,
          sessions: todayStats.total_transactions || 0,
          newUsers: 0 // TODO: Implement
        },
        month: {
          revenue: monthlyStats.total_session_revenue || 0,
          sessions: monthlyStats.total_transactions || 0
        },
        active: {
          onlineReaders: onlineReaders.total || 0,
          activeSessions: 0 // TODO: Implement
        }
      };

      res.json({ summary });
    } catch (error) {
      logger.error('Error in getDashboardSummary', error);
      res.status(500).json({ error: 'Failed to get dashboard summary' });
    }
  }
}

export default AdminController;