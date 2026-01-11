/**
 * Message Controller
 * Handles direct messaging operations
 */

import Message from '../models/Message.js';
import logger from '../utils/logger.js';

class MessageController {
  /**
   * Get user's conversations
   */
  static async getConversations(req, res) {
    try {
      const userId = req.dbUserId;
      const { limit = 50, offset = 0 } = req.query;

      const result = await Message.getConversations(userId, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json(result);
    } catch (error) {
      logger.error('Error in getConversations', error);
      res.status(500).json({ error: 'Failed to get conversations' });
    }
  }

  /**
   * Get messages with a specific user
   */
  static async getMessages(req, res) {
    try {
      const { userId } = req.params;
      const currentUserId = req.dbUserId;
      const { limit = 50, offset = 0 } = req.query;

      const result = await Message.getConversation(currentUserId, parseInt(userId), {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // Mark messages as read
      await Message.markConversationAsRead(parseInt(userId), currentUserId);

      res.json(result);
    } catch (error) {
      logger.error('Error in getMessages', error);
      res.status(500).json({ error: 'Failed to get messages' });
    }
  }

  /**
   * Send a message
   */
  static async sendMessage(req, res) {
    try {
      const senderId = req.dbUserId;
      const { receiverId, content } = req.body;

      // Validate required fields
      if (!receiverId || !content) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['receiverId', 'content']
        });
      }

      // Don't allow sending messages to self
      if (senderId === parseInt(receiverId)) {
        return res.status(400).json({ error: 'Cannot send message to yourself' });
      }

      const message = await Message.create({
        senderId,
        receiverId: parseInt(receiverId),
        content
      });

      logger.info('Message sent', { messageId: message.id, senderId, receiverId });

      res.status(201).json({
        message,
        status: 'sent'
      });
    } catch (error) {
      logger.error('Error in sendMessage', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }

  /**
   * Mark message as read
   */
  static async markAsRead(req, res) {
    try {
      const { messageId } = req.params;
      const userId = req.dbUserId;

      const message = await Message.findById(messageId);

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      // Verify receiver is the current user
      if (message.receiver_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      await Message.markAsRead(messageId);

      res.json({ message: 'Message marked as read' });
    } catch (error) {
      logger.error('Error in markAsRead', error);
      res.status(500).json({ error: 'Failed to mark message as read' });
    }
  }

  /**
   * Delete a message
   */
  static async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      const userId = req.dbUserId;

      const message = await Message.findById(messageId);

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      // Verify sender is the current user
      if (message.sender_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      await Message.delete(messageId);

      logger.info('Message deleted', { messageId, userId });

      res.json({ message: 'Message deleted successfully' });
    } catch (error) {
      logger.error('Error in deleteMessage', error);
      res.status(500).json({ error: 'Failed to delete message' });
    }
  }

  /**
   * Get unread message count
   */
  static async getUnreadCount(req, res) {
    try {
      const userId = req.dbUserId;

      const count = await Message.getUnreadCount(userId);

      res.json({ unreadCount: count });
    } catch (error) {
      logger.error('Error in getUnreadCount', error);
      res.status(500).json({ error: 'Failed to get unread count' });
    }
  }

  /**
   * Search messages
   */
  static async searchMessages(req, res) {
    try {
      const userId = req.dbUserId;
      const { q: searchTerm, limit = 50, offset = 0 } = req.query;

      if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required' });
      }

      const result = await Message.search(userId, searchTerm, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json(result);
    } catch (error) {
      logger.error('Error in searchMessages', error);
      res.status(500).json({ error: 'Failed to search messages' });
    }
  }

  /**
   * Delete conversation
   */
  static async deleteConversation(req, res) {
    try {
      const { userId } = req.params;
      const currentUserId = req.dbUserId;

      await Message.deleteConversation(currentUserId, parseInt(userId));

      logger.info('Conversation deleted', { userId, currentUserId });

      res.json({ message: 'Conversation deleted successfully' });
    } catch (error) {
      logger.error('Error in deleteConversation', error);
      res.status(500).json({ error: 'Failed to delete conversation' });
    }
  }
}

export default MessageController;