/**
 * Notification Model - Enterprise Level
 * Complete notification system for SoulSeer platform
 * Handles push notifications, in-app notifications, and email preferences
 */

const { pool } = require('../config/database');
const { logger } = require('../utils/logger');

class Notification {
  // ============================================
  // NOTIFICATION TYPES & CATEGORIES
  // ============================================
  
  static TYPES = {
    // Session notifications
    SESSION_REQUEST: 'session_request',
    SESSION_ACCEPTED: 'session_accepted',
    SESSION_DECLINED: 'session_declined',
    SESSION_STARTED: 'session_started',
    SESSION_ENDED: 'session_ended',
    SESSION_CANCELLED: 'session_cancelled',
    SESSION_REMINDER: 'session_reminder',
    
    // Payment notifications
    PAYMENT_RECEIVED: 'payment_received',
    PAYMENT_SENT: 'payment_sent',
    PAYOUT_PROCESSED: 'payout_processed',
    LOW_BALANCE: 'low_balance',
    REFUND_PROCESSED: 'refund_processed',
    
    // Gift notifications
    GIFT_RECEIVED: 'gift_received',
    GIFT_SENT: 'gift_sent',
    
    // Review notifications
    NEW_REVIEW: 'new_review',
    REVIEW_RESPONSE: 'review_response',
    REVIEW_REJECTED: 'review_rejected',
    
    // Message notifications
    NEW_MESSAGE: 'new_message',
    MESSAGE_REQUEST: 'message_request',
    
    // Stream notifications
    STREAM_STARTED: 'stream_started',
    STREAM_SCHEDULED: 'stream_scheduled',
    STREAM_REMINDER: 'stream_reminder',
    
    // Forum notifications
    POST_REPLY: 'post_reply',
    COMMENT_REPLY: 'comment_reply',
    POST_MENTION: 'post_mention',
    POST_REACTION: 'post_reaction',
    
    // Reader notifications
    READER_ONLINE: 'reader_online',
    READER_AVAILABLE: 'reader_available',
    FAVORITE_READER_STREAMING: 'favorite_reader_streaming',
    
    // System notifications
    SYSTEM_ANNOUNCEMENT: 'system_announcement',
    ACCOUNT_UPDATE: 'account_update',
    SECURITY_ALERT: 'security_alert',
    PROMOTION: 'promotion',
    
    // Order notifications
    ORDER_CONFIRMED: 'order_confirmed',
    ORDER_SHIPPED: 'order_shipped',
    ORDER_DELIVERED: 'order_delivered'
  };

  static CATEGORIES = {
    SESSIONS: 'sessions',
    PAYMENTS: 'payments',
    MESSAGES: 'messages',
    SOCIAL: 'social',
    STREAMS: 'streams',
    ORDERS: 'orders',
    SYSTEM: 'system',
    MARKETING: 'marketing'
  };

  static PRIORITIES = {
    LOW: 'low',
    NORMAL: 'normal',
    HIGH: 'high',
    URGENT: 'urgent'
  };

  static CHANNELS = {
    IN_APP: 'in_app',
    EMAIL: 'email',
    PUSH: 'push',
    SMS: 'sms'
  };

  // ============================================
  // CORE CRUD OPERATIONS
  // ============================================

  /**
   * Create a notification
   * @param {Object} notificationData - Notification details
   * @returns {Object} Created notification
   */
  static async create(notificationData) {
    try {
      const {
        user_id,
        type,
        category = this.getCategory(type),
        title,
        content,
        short_content = null,
        image_url = null,
        target_type = null,
        target_id = null,
        actor_id = null,
        action_url = null,
        priority = this.PRIORITIES.NORMAL,
        metadata = {},
        channels = [this.CHANNELS.IN_APP],
        expires_at = null
      } = notificationData;

      // Check user's notification preferences
      const preferences = await this.getUserPreferences(user_id);
      
      // Filter channels based on preferences
      const allowedChannels = channels.filter(channel => {
        const categoryPref = preferences.categories?.[category];
        if (!categoryPref) return channel === this.CHANNELS.IN_APP;
        return categoryPref[channel] !== false;
      });

      if (allowedChannels.length === 0) {
        logger.info('Notification blocked by user preferences', { user_id, type });
        return null;
      }

      const query = `
        INSERT INTO notifications (
          user_id, type, category, title, content, short_content,
          image_url, target_type, target_id, actor_id, action_url,
          priority, metadata, channels, expires_at,
          is_read, is_seen, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15,
          false, false, NOW()
        )
        RETURNING *
      `;

      const values = [
        user_id, type, category, title, content, short_content,
        image_url, target_type, target_id, actor_id, action_url,
        priority, JSON.stringify(metadata), allowedChannels, expires_at
      ];

      const result = await pool.query(query, values);
      const notification = result.rows[0];

      // Send to other channels asynchronously
      this.sendToChannels(notification, allowedChannels).catch(err => {
        logger.error('Error sending notification to channels', { error: err.message });
      });

      logger.info('Notification created', { 
        notificationId: notification.id, 
        userId: user_id,
        type 
      });

      return this.formatNotification(notification);

    } catch (error) {
      logger.error('Error creating notification', { error: error.message, notificationData });
      throw error;
    }
  }

  /**
   * Create multiple notifications (batch)
   * @param {Array} notifications - Array of notification data
   * @returns {Array} Created notifications
   */
  static async createBatch(notifications) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const created = [];
      for (const notificationData of notifications) {
        const notification = await this.create(notificationData);
        if (notification) {
          created.push(notification);
        }
      }

      await client.query('COMMIT');

      logger.info('Batch notifications created', { count: created.length });

      return created;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating batch notifications', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get notification by ID
   * @param {string} notificationId - Notification ID
   * @returns {Object|null} Notification or null
   */
  static async getById(notificationId) {
    try {
      const query = `
        SELECT n.*,
               u.display_name as actor_name,
               u.profile_image_url as actor_image
        FROM notifications n
        LEFT JOIN users u ON n.actor_id = u.id
        WHERE n.id = $1
      `;

      const result = await pool.query(query, [notificationId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatNotification(result.rows[0]);

    } catch (error) {
      logger.error('Error getting notification', { error: error.message, notificationId });
      throw error;
    }
  }

  /**
   * Delete notification
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for authorization)
   * @returns {boolean} Success
   */
  static async delete(notificationId, userId) {
    try {
      const result = await pool.query(`
        DELETE FROM notifications 
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `, [notificationId, userId]);

      if (result.rows.length === 0) {
        throw new Error('Notification not found or not authorized');
      }

      logger.info('Notification deleted', { notificationId, userId });
      return true;

    } catch (error) {
      logger.error('Error deleting notification', { error: error.message, notificationId });
      throw error;
    }
  }

  // ============================================
  // USER NOTIFICATION QUERIES
  // ============================================

  /**
   * Get user's notifications
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated notifications
   */
  static async getUserNotifications(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        category = null,
        isRead = null,
        priority = null,
        includeExpired = false
      } = options;

      const offset = (page - 1) * limit;
      const conditions = ['n.user_id = $1'];
      const values = [userId];
      let paramIndex = 2;

      if (!includeExpired) {
        conditions.push(`(n.expires_at IS NULL OR n.expires_at > NOW())`);
      }

      if (category) {
        conditions.push(`n.category = $${paramIndex}`);
        values.push(category);
        paramIndex++;
      }

      if (isRead !== null) {
        conditions.push(`n.is_read = $${paramIndex}`);
        values.push(isRead);
        paramIndex++;
      }

      if (priority) {
        conditions.push(`n.priority = $${paramIndex}`);
        values.push(priority);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM notifications n WHERE ${whereClause}`;
      const countResult = await pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // Get notifications
      const query = `
        SELECT n.*,
               u.display_name as actor_name,
               u.profile_image_url as actor_image
        FROM notifications n
        LEFT JOIN users u ON n.actor_id = u.id
        WHERE ${whereClause}
        ORDER BY 
          CASE n.priority 
            WHEN 'urgent' THEN 0 
            WHEN 'high' THEN 1 
            WHEN 'normal' THEN 2 
            ELSE 3 
          END,
          n.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await pool.query(query, values);

      return {
        notifications: result.rows.map(n => this.formatNotification(n)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };

    } catch (error) {
      logger.error('Error getting user notifications', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get unread notification count
   * @param {string} userId - User ID
   * @returns {Object} Unread counts
   */
  static async getUnreadCount(userId) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE category = 'sessions') as sessions,
          COUNT(*) FILTER (WHERE category = 'payments') as payments,
          COUNT(*) FILTER (WHERE category = 'messages') as messages,
          COUNT(*) FILTER (WHERE category = 'social') as social,
          COUNT(*) FILTER (WHERE category = 'streams') as streams,
          COUNT(*) FILTER (WHERE category = 'orders') as orders,
          COUNT(*) FILTER (WHERE category = 'system') as system,
          COUNT(*) FILTER (WHERE priority = 'urgent') as urgent
        FROM notifications
        WHERE user_id = $1 
          AND is_read = false
          AND (expires_at IS NULL OR expires_at > NOW())
      `;

      const result = await pool.query(query, [userId]);
      const counts = result.rows[0];

      return {
        total: parseInt(counts.total),
        byCategory: {
          sessions: parseInt(counts.sessions),
          payments: parseInt(counts.payments),
          messages: parseInt(counts.messages),
          social: parseInt(counts.social),
          streams: parseInt(counts.streams),
          orders: parseInt(counts.orders),
          system: parseInt(counts.system)
        },
        urgent: parseInt(counts.urgent)
      };

    } catch (error) {
      logger.error('Error getting unread count', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get unseen notification count (for badge)
   * @param {string} userId - User ID
   * @returns {number} Unseen count
   */
  static async getUnseenCount(userId) {
    try {
      const query = `
        SELECT COUNT(*) FROM notifications
        WHERE user_id = $1 
          AND is_seen = false
          AND (expires_at IS NULL OR expires_at > NOW())
      `;

      const result = await pool.query(query, [userId]);
      return parseInt(result.rows[0].count);

    } catch (error) {
      logger.error('Error getting unseen count', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // MARK AS READ/SEEN
  // ============================================

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID
   * @returns {Object} Updated notification
   */
  static async markAsRead(notificationId, userId) {
    try {
      const result = await pool.query(`
        UPDATE notifications 
        SET is_read = true, is_seen = true, read_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `, [notificationId, userId]);

      if (result.rows.length === 0) {
        throw new Error('Notification not found');
      }

      return this.formatNotification(result.rows[0]);

    } catch (error) {
      logger.error('Error marking notification as read', { error: error.message, notificationId });
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   * @param {string} userId - User ID
   * @param {string} category - Optional category filter
   * @returns {number} Number of notifications marked
   */
  static async markAllAsRead(userId, category = null) {
    try {
      let query = `
        UPDATE notifications 
        SET is_read = true, is_seen = true, read_at = NOW()
        WHERE user_id = $1 AND is_read = false
      `;
      const values = [userId];

      if (category) {
        query += ` AND category = $2`;
        values.push(category);
      }

      query += ` RETURNING id`;

      const result = await pool.query(query, values);

      logger.info('Notifications marked as read', { userId, count: result.rows.length });

      return result.rows.length;

    } catch (error) {
      logger.error('Error marking all as read', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Mark notifications as seen (for badge clearing)
   * @param {string} userId - User ID
   * @returns {number} Number of notifications marked
   */
  static async markAllAsSeen(userId) {
    try {
      const result = await pool.query(`
        UPDATE notifications 
        SET is_seen = true
        WHERE user_id = $1 AND is_seen = false
        RETURNING id
      `, [userId]);

      return result.rows.length;

    } catch (error) {
      logger.error('Error marking all as seen', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // NOTIFICATION PREFERENCES
  // ============================================

  /**
   * Get user's notification preferences
   * @param {string} userId - User ID
   * @returns {Object} Preferences
   */
  static async getUserPreferences(userId) {
    try {
      const query = `
        SELECT preferences FROM notification_preferences
        WHERE user_id = $1
      `;

      const result = await pool.query(query, [userId]);

      if (result.rows.length === 0) {
        // Return default preferences
        return this.getDefaultPreferences();
      }

      return typeof result.rows[0].preferences === 'string'
        ? JSON.parse(result.rows[0].preferences)
        : result.rows[0].preferences;

    } catch (error) {
      logger.error('Error getting user preferences', { error: error.message, userId });
      return this.getDefaultPreferences();
    }
  }

  /**
   * Update user's notification preferences
   * @param {string} userId - User ID
   * @param {Object} preferences - New preferences
   * @returns {Object} Updated preferences
   */
  static async updateUserPreferences(userId, preferences) {
    try {
      const query = `
        INSERT INTO notification_preferences (user_id, preferences, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET preferences = $2, updated_at = NOW()
        RETURNING *
      `;

      const result = await pool.query(query, [userId, JSON.stringify(preferences)]);

      logger.info('Notification preferences updated', { userId });

      return typeof result.rows[0].preferences === 'string'
        ? JSON.parse(result.rows[0].preferences)
        : result.rows[0].preferences;

    } catch (error) {
      logger.error('Error updating preferences', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get default notification preferences
   * @returns {Object} Default preferences
   */
  static getDefaultPreferences() {
    return {
      categories: {
        sessions: {
          in_app: true,
          email: true,
          push: true
        },
        payments: {
          in_app: true,
          email: true,
          push: true
        },
        messages: {
          in_app: true,
          email: false,
          push: true
        },
        social: {
          in_app: true,
          email: false,
          push: false
        },
        streams: {
          in_app: true,
          email: false,
          push: true
        },
        orders: {
          in_app: true,
          email: true,
          push: true
        },
        system: {
          in_app: true,
          email: true,
          push: false
        },
        marketing: {
          in_app: true,
          email: false,
          push: false
        }
      },
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
        timezone: 'UTC'
      },
      emailDigest: {
        enabled: true,
        frequency: 'daily' // 'immediate', 'daily', 'weekly'
      }
    };
  }

  // ============================================
  // PUSH NOTIFICATION TOKENS
  // ============================================

  /**
   * Register push notification token
   * @param {string} userId - User ID
   * @param {Object} tokenData - Token details
   * @returns {Object} Registered token
   */
  static async registerPushToken(userId, tokenData) {
    try {
      const { token, platform, device_id = null, device_name = null } = tokenData;

      const query = `
        INSERT INTO push_tokens (
          user_id, token, platform, device_id, device_name,
          is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
        ON CONFLICT (user_id, token) 
        DO UPDATE SET 
          is_active = true, 
          device_name = COALESCE($5, push_tokens.device_name),
          updated_at = NOW()
        RETURNING *
      `;

      const result = await pool.query(query, [userId, token, platform, device_id, device_name]);

      logger.info('Push token registered', { userId, platform });

      return result.rows[0];

    } catch (error) {
      logger.error('Error registering push token', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Unregister push notification token
   * @param {string} userId - User ID
   * @param {string} token - Push token
   * @returns {boolean} Success
   */
  static async unregisterPushToken(userId, token) {
    try {
      await pool.query(`
        UPDATE push_tokens 
        SET is_active = false, updated_at = NOW()
        WHERE user_id = $1 AND token = $2
      `, [userId, token]);

      logger.info('Push token unregistered', { userId });
      return true;

    } catch (error) {
      logger.error('Error unregistering push token', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get user's active push tokens
   * @param {string} userId - User ID
   * @returns {Array} Active tokens
   */
  static async getUserPushTokens(userId) {
    try {
      const query = `
        SELECT * FROM push_tokens
        WHERE user_id = $1 AND is_active = true
        ORDER BY updated_at DESC
      `;

      const result = await pool.query(query, [userId]);
      return result.rows;

    } catch (error) {
      logger.error('Error getting push tokens', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // BULK OPERATIONS
  // ============================================

  /**
   * Send notification to multiple users
   * @param {Array} userIds - Array of user IDs
   * @param {Object} notificationData - Notification template
   * @returns {Object} Send results
   */
  static async sendToUsers(userIds, notificationData) {
    const results = {
      sent: 0,
      failed: 0,
      blocked: 0
    };

    for (const userId of userIds) {
      try {
        const notification = await this.create({
          ...notificationData,
          user_id: userId
        });

        if (notification) {
          results.sent++;
        } else {
          results.blocked++;
        }
      } catch (error) {
        results.failed++;
        logger.error('Error sending notification to user', { error: error.message, userId });
      }
    }

    logger.info('Bulk notifications sent', results);

    return results;
  }

  /**
   * Send notification to all users (broadcast)
   * @param {Object} notificationData - Notification template
   * @param {Object} filters - User filters
   * @returns {Object} Send results
   */
  static async broadcast(notificationData, filters = {}) {
    try {
      const { role = null, isActive = true } = filters;

      let query = `SELECT id FROM users WHERE 1=1`;
      const values = [];
      let paramIndex = 1;

      if (isActive) {
        query += ` AND is_active = true`;
      }

      if (role) {
        query += ` AND role = $${paramIndex}`;
        values.push(role);
        paramIndex++;
      }

      const result = await pool.query(query, values);
      const userIds = result.rows.map(r => r.id);

      return this.sendToUsers(userIds, notificationData);

    } catch (error) {
      logger.error('Error broadcasting notification', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete old notifications
   * @param {number} daysOld - Delete notifications older than this many days
   * @returns {number} Number of deleted notifications
   */
  static async deleteOldNotifications(daysOld = 30) {
    try {
      const result = await pool.query(`
        DELETE FROM notifications
        WHERE created_at < NOW() - INTERVAL '${daysOld} days'
          AND is_read = true
        RETURNING id
      `);

      logger.info('Old notifications deleted', { count: result.rows.length, daysOld });

      return result.rows.length;

    } catch (error) {
      logger.error('Error deleting old notifications', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete expired notifications
   * @returns {number} Number of deleted notifications
   */
  static async deleteExpiredNotifications() {
    try {
      const result = await pool.query(`
        DELETE FROM notifications
        WHERE expires_at IS NOT NULL AND expires_at < NOW()
        RETURNING id
      `);

      logger.info('Expired notifications deleted', { count: result.rows.length });

      return result.rows.length;

    } catch (error) {
      logger.error('Error deleting expired notifications', { error: error.message });
      throw error;
    }
  }

  // ============================================
  // CHANNEL DELIVERY
  // ============================================

  /**
   * Send notification to specified channels
   * @param {Object} notification - Notification data
   * @param {Array} channels - Channels to send to
   */
  static async sendToChannels(notification, channels) {
    for (const channel of channels) {
      try {
        switch (channel) {
          case this.CHANNELS.EMAIL:
            await this.sendEmail(notification);
            break;
          case this.CHANNELS.PUSH:
            await this.sendPush(notification);
            break;
          case this.CHANNELS.SMS:
            await this.sendSMS(notification);
            break;
          // IN_APP is handled by the database insert
        }
      } catch (error) {
        logger.error(`Error sending to ${channel}`, { 
          error: error.message, 
          notificationId: notification.id 
        });
      }
    }
  }

  /**
   * Send email notification
   * @param {Object} notification - Notification data
   */
  static async sendEmail(notification) {
    // This would integrate with email service (SendGrid, SES, etc.)
    // For now, just log
    logger.info('Email notification queued', { 
      notificationId: notification.id,
      userId: notification.user_id 
    });
    
    // TODO: Implement actual email sending
    // const emailService = require('../services/email.service');
    // await emailService.sendNotificationEmail(notification);
  }

  /**
   * Send push notification
   * @param {Object} notification - Notification data
   */
  static async sendPush(notification) {
    try {
      const tokens = await this.getUserPushTokens(notification.user_id);
      
      if (tokens.length === 0) {
        return;
      }

      // This would integrate with push service (Firebase, APNs, etc.)
      logger.info('Push notification queued', { 
        notificationId: notification.id,
        userId: notification.user_id,
        tokenCount: tokens.length
      });

      // TODO: Implement actual push sending
      // const pushService = require('../services/push.service');
      // await pushService.send(tokens, notification);

    } catch (error) {
      logger.error('Error sending push notification', { error: error.message });
    }
  }

  /**
   * Send SMS notification
   * @param {Object} notification - Notification data
   */
  static async sendSMS(notification) {
    // This would integrate with SMS service (Twilio, etc.)
    logger.info('SMS notification queued', { 
      notificationId: notification.id,
      userId: notification.user_id 
    });

    // TODO: Implement actual SMS sending
    // const smsService = require('../services/sms.service');
    // await smsService.send(notification);
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get category for notification type
   * @param {string} type - Notification type
   * @returns {string} Category
   */
  static getCategory(type) {
    const categoryMap = {
      // Sessions
      [this.TYPES.SESSION_REQUEST]: this.CATEGORIES.SESSIONS,
      [this.TYPES.SESSION_ACCEPTED]: this.CATEGORIES.SESSIONS,
      [this.TYPES.SESSION_DECLINED]: this.CATEGORIES.SESSIONS,
      [this.TYPES.SESSION_STARTED]: this.CATEGORIES.SESSIONS,
      [this.TYPES.SESSION_ENDED]: this.CATEGORIES.SESSIONS,
      [this.TYPES.SESSION_CANCELLED]: this.CATEGORIES.SESSIONS,
      [this.TYPES.SESSION_REMINDER]: this.CATEGORIES.SESSIONS,
      
      // Payments
      [this.TYPES.PAYMENT_RECEIVED]: this.CATEGORIES.PAYMENTS,
      [this.TYPES.PAYMENT_SENT]: this.CATEGORIES.PAYMENTS,
      [this.TYPES.PAYOUT_PROCESSED]: this.CATEGORIES.PAYMENTS,
      [this.TYPES.LOW_BALANCE]: this.CATEGORIES.PAYMENTS,
      [this.TYPES.REFUND_PROCESSED]: this.CATEGORIES.PAYMENTS,
      [this.TYPES.GIFT_RECEIVED]: this.CATEGORIES.PAYMENTS,
      [this.TYPES.GIFT_SENT]: this.CATEGORIES.PAYMENTS,
      
      // Messages
      [this.TYPES.NEW_MESSAGE]: this.CATEGORIES.MESSAGES,
      [this.TYPES.MESSAGE_REQUEST]: this.CATEGORIES.MESSAGES,
      
      // Social
      [this.TYPES.NEW_REVIEW]: this.CATEGORIES.SOCIAL,
      [this.TYPES.REVIEW_RESPONSE]: this.CATEGORIES.SOCIAL,
      [this.TYPES.POST_REPLY]: this.CATEGORIES.SOCIAL,
      [this.TYPES.COMMENT_REPLY]: this.CATEGORIES.SOCIAL,
      [this.TYPES.POST_MENTION]: this.CATEGORIES.SOCIAL,
      [this.TYPES.POST_REACTION]: this.CATEGORIES.SOCIAL,
      
      // Streams
      [this.TYPES.STREAM_STARTED]: this.CATEGORIES.STREAMS,
      [this.TYPES.STREAM_SCHEDULED]: this.CATEGORIES.STREAMS,
      [this.TYPES.STREAM_REMINDER]: this.CATEGORIES.STREAMS,
      [this.TYPES.READER_ONLINE]: this.CATEGORIES.STREAMS,
      [this.TYPES.READER_AVAILABLE]: this.CATEGORIES.STREAMS,
      [this.TYPES.FAVORITE_READER_STREAMING]: this.CATEGORIES.STREAMS,
      
      // Orders
      [this.TYPES.ORDER_CONFIRMED]: this.CATEGORIES.ORDERS,
      [this.TYPES.ORDER_SHIPPED]: this.CATEGORIES.ORDERS,
      [this.TYPES.ORDER_DELIVERED]: this.CATEGORIES.ORDERS,
      
      // System
      [this.TYPES.SYSTEM_ANNOUNCEMENT]: this.CATEGORIES.SYSTEM,
      [this.TYPES.ACCOUNT_UPDATE]: this.CATEGORIES.SYSTEM,
      [this.TYPES.SECURITY_ALERT]: this.CATEGORIES.SYSTEM,
      
      // Marketing
      [this.TYPES.PROMOTION]: this.CATEGORIES.MARKETING
    };

    return categoryMap[type] || this.CATEGORIES.SYSTEM;
  }

  /**
   * Format notification for API response
   * @param {Object} notification - Raw notification data
   * @returns {Object} Formatted notification
   */
  static formatNotification(notification) {
    if (!notification) return null;

    return {
      id: notification.id,
      userId: notification.user_id,
      type: notification.type,
      category: notification.category,
      title: notification.title,
      content: notification.content,
      shortContent: notification.short_content,
      imageUrl: notification.image_url,
      targetType: notification.target_type,
      targetId: notification.target_id,
      actorId: notification.actor_id,
      actorName: notification.actor_name,
      actorImage: notification.actor_image,
      actionUrl: notification.action_url,
      priority: notification.priority,
      metadata: typeof notification.metadata === 'string'
        ? JSON.parse(notification.metadata)
        : notification.metadata,
      channels: notification.channels,
      isRead: notification.is_read,
      isSeen: notification.is_seen,
      readAt: notification.read_at,
      expiresAt: notification.expires_at,
      createdAt: notification.created_at
    };
  }
}

module.exports = Notification;