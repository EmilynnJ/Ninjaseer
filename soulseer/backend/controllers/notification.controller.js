/**
 * Notification Controller - Enterprise Level
 * Complete notification management endpoints for SoulSeer platform
 */

const Notification = require('../models/Notification');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { logger } = require('../utils/logger');

class NotificationController {
  /**
   * Get user's notifications
   * GET /api/notifications
   */
  static async getNotifications(req, res) {
    try {
      const userId = req.auth.userId;
      const {
        page = 1,
        limit = 20,
        category,
        unread_only,
        priority
      } = req.query;

      const result = await Notification.getUserNotifications(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        category: category || null,
        unreadOnly: unread_only === 'true',
        priority: priority || null
      });

      return paginatedResponse(res, result.notifications, result.pagination);

    } catch (error) {
      logger.error('Error getting notifications', { error: error.message });
      return errorResponse(res, 'Failed to get notifications', 500);
    }
  }

  /**
   * Get unread notification count
   * GET /api/notifications/unread-count
   */
  static async getUnreadCount(req, res) {
    try {
      const userId = req.auth.userId;

      const counts = await Notification.getUnreadCounts(userId);

      return successResponse(res, { counts });

    } catch (error) {
      logger.error('Error getting unread count', { error: error.message });
      return errorResponse(res, 'Failed to get unread count', 500);
    }
  }

  /**
   * Get notification by ID
   * GET /api/notifications/:notificationId
   */
  static async getNotification(req, res) {
    try {
      const userId = req.auth.userId;
      const { notificationId } = req.params;

      const notification = await Notification.findById(notificationId);
      if (!notification) {
        return errorResponse(res, 'Notification not found', 404);
      }

      // Verify ownership
      if (notification.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      return successResponse(res, { notification });

    } catch (error) {
      logger.error('Error getting notification', { error: error.message });
      return errorResponse(res, 'Failed to get notification', 500);
    }
  }

  /**
   * Mark notification as read
   * POST /api/notifications/:notificationId/read
   */
  static async markAsRead(req, res) {
    try {
      const userId = req.auth.userId;
      const { notificationId } = req.params;

      const notification = await Notification.findById(notificationId);
      if (!notification) {
        return errorResponse(res, 'Notification not found', 404);
      }

      if (notification.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      await Notification.markAsRead(notificationId);

      return successResponse(res, {
        message: 'Notification marked as read'
      });

    } catch (error) {
      logger.error('Error marking notification as read', { error: error.message });
      return errorResponse(res, 'Failed to mark as read', 500);
    }
  }

  /**
   * Mark all notifications as read
   * POST /api/notifications/read-all
   */
  static async markAllAsRead(req, res) {
    try {
      const userId = req.auth.userId;
      const { category } = req.body;

      await Notification.markAllAsRead(userId, category);

      return successResponse(res, {
        message: 'All notifications marked as read'
      });

    } catch (error) {
      logger.error('Error marking all as read', { error: error.message });
      return errorResponse(res, 'Failed to mark all as read', 500);
    }
  }

  /**
   * Delete notification
   * DELETE /api/notifications/:notificationId
   */
  static async deleteNotification(req, res) {
    try {
      const userId = req.auth.userId;
      const { notificationId } = req.params;

      const notification = await Notification.findById(notificationId);
      if (!notification) {
        return errorResponse(res, 'Notification not found', 404);
      }

      if (notification.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      await Notification.delete(notificationId);

      return successResponse(res, {
        message: 'Notification deleted'
      });

    } catch (error) {
      logger.error('Error deleting notification', { error: error.message });
      return errorResponse(res, 'Failed to delete notification', 500);
    }
  }

  /**
   * Delete all notifications
   * DELETE /api/notifications
   */
  static async deleteAllNotifications(req, res) {
    try {
      const userId = req.auth.userId;
      const { category, read_only } = req.query;

      await Notification.deleteAll(userId, {
        category: category || null,
        readOnly: read_only === 'true'
      });

      return successResponse(res, {
        message: 'Notifications deleted'
      });

    } catch (error) {
      logger.error('Error deleting all notifications', { error: error.message });
      return errorResponse(res, 'Failed to delete notifications', 500);
    }
  }

  /**
   * Get notification preferences
   * GET /api/notifications/preferences
   */
  static async getPreferences(req, res) {
    try {
      const userId = req.auth.userId;

      const preferences = await Notification.getUserPreferences(userId);

      return successResponse(res, { preferences });

    } catch (error) {
      logger.error('Error getting preferences', { error: error.message });
      return errorResponse(res, 'Failed to get preferences', 500);
    }
  }

  /**
   * Update notification preferences
   * PUT /api/notifications/preferences
   */
  static async updatePreferences(req, res) {
    try {
      const userId = req.auth.userId;
      const { preferences } = req.body;

      if (!preferences || typeof preferences !== 'object') {
        return errorResponse(res, 'Invalid preferences format', 400);
      }

      await Notification.updatePreferences(userId, preferences);

      return successResponse(res, {
        message: 'Preferences updated successfully'
      });

    } catch (error) {
      logger.error('Error updating preferences', { error: error.message });
      return errorResponse(res, 'Failed to update preferences', 500);
    }
  }

  /**
   * Subscribe to push notifications
   * POST /api/notifications/push/subscribe
   */
  static async subscribeToPush(req, res) {
    try {
      const userId = req.auth.userId;
      const { subscription, device_type, device_token } = req.body;

      if (!subscription && !device_token) {
        return errorResponse(res, 'Subscription data is required', 400);
      }

      await Notification.subscribeToPush(userId, {
        subscription,
        deviceType: device_type,
        deviceToken: device_token
      });

      return successResponse(res, {
        message: 'Subscribed to push notifications'
      });

    } catch (error) {
      logger.error('Error subscribing to push', { error: error.message });
      return errorResponse(res, 'Failed to subscribe', 500);
    }
  }

  /**
   * Unsubscribe from push notifications
   * POST /api/notifications/push/unsubscribe
   */
  static async unsubscribeFromPush(req, res) {
    try {
      const userId = req.auth.userId;
      const { device_token } = req.body;

      await Notification.unsubscribeFromPush(userId, device_token);

      return successResponse(res, {
        message: 'Unsubscribed from push notifications'
      });

    } catch (error) {
      logger.error('Error unsubscribing from push', { error: error.message });
      return errorResponse(res, 'Failed to unsubscribe', 500);
    }
  }

  /**
   * Test push notification
   * POST /api/notifications/push/test
   */
  static async testPushNotification(req, res) {
    try {
      const userId = req.auth.userId;

      await Notification.create({
        user_id: userId,
        type: Notification.TYPES.SYSTEM_ANNOUNCEMENT,
        title: 'Test Notification',
        content: 'This is a test push notification from SoulSeer',
        priority: Notification.PRIORITIES.NORMAL,
        channels: [Notification.CHANNELS.PUSH, Notification.CHANNELS.IN_APP]
      });

      return successResponse(res, {
        message: 'Test notification sent'
      });

    } catch (error) {
      logger.error('Error sending test notification', { error: error.message });
      return errorResponse(res, 'Failed to send test notification', 500);
    }
  }
}

module.exports = NotificationController;