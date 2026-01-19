/**
 * Message Controller - Enterprise Level
 * Complete messaging system endpoints for SoulSeer platform
 */

const Message = require('../models/Message');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { logger } = require('../utils/logger');

class MessageController {
  // ============================================
  // CONVERSATION MANAGEMENT
  // ============================================

  /**
   * Get user's conversations
   * GET /api/messages/conversations
   */
  static async getConversations(req, res) {
    try {
      const userId = req.auth.userId;
      const {
        page = 1,
        limit = 20,
        type,
        unread_only
      } = req.query;

      const result = await Message.getUserConversations(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        type: type || null,
        unreadOnly: unread_only === 'true'
      });

      return paginatedResponse(res, result.conversations, result.pagination);

    } catch (error) {
      logger.error('Error getting conversations', { error: error.message });
      return errorResponse(res, 'Failed to get conversations', 500);
    }
  }

  /**
   * Get or create conversation with user
   * POST /api/messages/conversations
   */
  static async createConversation(req, res) {
    try {
      const userId = req.auth.userId;
      const { recipient_id, type = 'direct' } = req.body;

      if (!recipient_id) {
        return errorResponse(res, 'Recipient ID is required', 400);
      }

      if (recipient_id === userId) {
        return errorResponse(res, 'Cannot create conversation with yourself', 400);
      }

      // Verify recipient exists
      const recipient = await User.findById(recipient_id);
      if (!recipient) {
        return errorResponse(res, 'Recipient not found', 404);
      }

      // Check if user is blocked
      const isBlocked = await Message.isBlocked(userId, recipient_id);
      if (isBlocked) {
        return errorResponse(res, 'Cannot message this user', 403);
      }

      const conversation = await Message.getOrCreateConversation(userId, recipient_id);

      return successResponse(res, {
        conversation
      }, 201);

    } catch (error) {
      logger.error('Error creating conversation', { error: error.message });
      return errorResponse(res, error.message || 'Failed to create conversation', 500);
    }
  }

  /**
   * Create group conversation
   * POST /api/messages/conversations/group
   */
  static async createGroupConversation(req, res) {
    try {
      const userId = req.auth.userId;
      const {
        name,
        description,
        participant_ids,
        image_url
      } = req.body;

      if (!name || name.trim().length < 2) {
        return errorResponse(res, 'Group name must be at least 2 characters', 400);
      }

      if (!participant_ids || !Array.isArray(participant_ids) || participant_ids.length < 1) {
        return errorResponse(res, 'At least one participant is required', 400);
      }

      // Verify all participants exist
      for (const participantId of participant_ids) {
        const participant = await User.findById(participantId);
        if (!participant) {
          return errorResponse(res, `Participant ${participantId} not found`, 404);
        }
      }

      const conversation = await Message.createGroupConversation({
        name: name.trim(),
        description,
        creator_id: userId,
        participant_ids: [...new Set([...participant_ids, userId])],
        image_url
      });

      // Notify participants
      for (const participantId of participant_ids) {
        if (participantId !== userId) {
          await Notification.create({
            user_id: participantId,
            type: Notification.TYPES.NEW_MESSAGE,
            title: 'Added to Group',
            content: `You've been added to the group "${name}"`,
            target_type: 'conversation',
            target_id: conversation.id,
            actor_id: userId
          });
        }
      }

      return successResponse(res, {
        message: 'Group created successfully',
        conversation
      }, 201);

    } catch (error) {
      logger.error('Error creating group conversation', { error: error.message });
      return errorResponse(res, error.message || 'Failed to create group', 500);
    }
  }

  /**
   * Get conversation by ID
   * GET /api/messages/conversations/:conversationId
   */
  static async getConversation(req, res) {
    try {
      const userId = req.auth.userId;
      const { conversationId } = req.params;

      const conversation = await Message.getConversationById(conversationId);
      if (!conversation) {
        return errorResponse(res, 'Conversation not found', 404);
      }

      // Verify user is participant
      const isParticipant = await Message.isParticipant(conversationId, userId);
      if (!isParticipant) {
        return errorResponse(res, 'Not authorized', 403);
      }

      return successResponse(res, { conversation });

    } catch (error) {
      logger.error('Error getting conversation', { error: error.message });
      return errorResponse(res, 'Failed to get conversation', 500);
    }
  }

  /**
   * Update conversation (group settings)
   * PUT /api/messages/conversations/:conversationId
   */
  static async updateConversation(req, res) {
    try {
      const userId = req.auth.userId;
      const { conversationId } = req.params;
      const { name, description, image_url } = req.body;

      const conversation = await Message.getConversationById(conversationId);
      if (!conversation) {
        return errorResponse(res, 'Conversation not found', 404);
      }

      // Only group conversations can be updated
      if (conversation.type !== 'group') {
        return errorResponse(res, 'Only group conversations can be updated', 400);
      }

      // Verify user is participant (or admin)
      const isParticipant = await Message.isParticipant(conversationId, userId);
      if (!isParticipant) {
        return errorResponse(res, 'Not authorized', 403);
      }

      const updatedConversation = await Message.updateConversation(conversationId, {
        name,
        description,
        image_url
      });

      return successResponse(res, {
        message: 'Conversation updated',
        conversation: updatedConversation
      });

    } catch (error) {
      logger.error('Error updating conversation', { error: error.message });
      return errorResponse(res, error.message || 'Failed to update conversation', 500);
    }
  }

  /**
   * Leave conversation
   * POST /api/messages/conversations/:conversationId/leave
   */
  static async leaveConversation(req, res) {
    try {
      const userId = req.auth.userId;
      const { conversationId } = req.params;

      const conversation = await Message.getConversationById(conversationId);
      if (!conversation) {
        return errorResponse(res, 'Conversation not found', 404);
      }

      if (conversation.type !== 'group') {
        return errorResponse(res, 'Cannot leave direct conversations', 400);
      }

      await Message.removeParticipant(conversationId, userId);

      return successResponse(res, {
        message: 'Left conversation successfully'
      });

    } catch (error) {
      logger.error('Error leaving conversation', { error: error.message });
      return errorResponse(res, 'Failed to leave conversation', 500);
    }
  }

  /**
   * Add participant to group
   * POST /api/messages/conversations/:conversationId/participants
   */
  static async addParticipant(req, res) {
    try {
      const userId = req.auth.userId;
      const { conversationId } = req.params;
      const { user_id } = req.body;

      if (!user_id) {
        return errorResponse(res, 'User ID is required', 400);
      }

      const conversation = await Message.getConversationById(conversationId);
      if (!conversation) {
        return errorResponse(res, 'Conversation not found', 404);
      }

      if (conversation.type !== 'group') {
        return errorResponse(res, 'Can only add participants to group conversations', 400);
      }

      // Verify requester is participant
      const isParticipant = await Message.isParticipant(conversationId, userId);
      if (!isParticipant) {
        return errorResponse(res, 'Not authorized', 403);
      }

      // Verify new user exists
      const newUser = await User.findById(user_id);
      if (!newUser) {
        return errorResponse(res, 'User not found', 404);
      }

      await Message.addParticipant(conversationId, user_id, userId);

      // Notify new participant
      await Notification.create({
        user_id: user_id,
        type: Notification.TYPES.NEW_MESSAGE,
        title: 'Added to Group',
        content: `You've been added to the group "${conversation.name}"`,
        target_type: 'conversation',
        target_id: conversationId,
        actor_id: userId
      });

      return successResponse(res, {
        message: 'Participant added successfully'
      });

    } catch (error) {
      logger.error('Error adding participant', { error: error.message });
      return errorResponse(res, error.message || 'Failed to add participant', 500);
    }
  }

  /**
   * Remove participant from group
   * DELETE /api/messages/conversations/:conversationId/participants/:userId
   */
  static async removeParticipant(req, res) {
    try {
      const requesterId = req.auth.userId;
      const { conversationId, participantId } = req.params;

      const conversation = await Message.getConversationById(conversationId);
      if (!conversation) {
        return errorResponse(res, 'Conversation not found', 404);
      }

      if (conversation.type !== 'group') {
        return errorResponse(res, 'Can only remove participants from group conversations', 400);
      }

      // Verify requester is creator or admin
      if (conversation.creatorId !== requesterId) {
        return errorResponse(res, 'Only group creator can remove participants', 403);
      }

      // Cannot remove creator
      if (participantId === conversation.creatorId) {
        return errorResponse(res, 'Cannot remove group creator', 400);
      }

      await Message.removeParticipant(conversationId, participantId);

      return successResponse(res, {
        message: 'Participant removed successfully'
      });

    } catch (error) {
      logger.error('Error removing participant', { error: error.message });
      return errorResponse(res, error.message || 'Failed to remove participant', 500);
    }
  }

  /**
   * Delete conversation
   * DELETE /api/messages/conversations/:conversationId
   */
  static async deleteConversation(req, res) {
    try {
      const userId = req.auth.userId;
      const { conversationId } = req.params;

      const conversation = await Message.getConversationById(conversationId);
      if (!conversation) {
        return errorResponse(res, 'Conversation not found', 404);
      }

      // For direct conversations, just hide for user
      // For groups, only creator can delete
      if (conversation.type === 'group' && conversation.creatorId !== userId) {
        return errorResponse(res, 'Only group creator can delete the group', 403);
      }

      await Message.deleteConversation(conversationId, userId);

      return successResponse(res, {
        message: 'Conversation deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting conversation', { error: error.message });
      return errorResponse(res, 'Failed to delete conversation', 500);
    }
  }

  // ============================================
  // MESSAGE MANAGEMENT
  // ============================================

  /**
   * Get messages in conversation
   * GET /api/messages/conversations/:conversationId/messages
   */
  static async getMessages(req, res) {
    try {
      const userId = req.auth.userId;
      const { conversationId } = req.params;
      const {
        page = 1,
        limit = 50,
        before,
        after
      } = req.query;

      // Verify user is participant
      const isParticipant = await Message.isParticipant(conversationId, userId);
      if (!isParticipant) {
        return errorResponse(res, 'Not authorized', 403);
      }

      const result = await Message.getMessages(conversationId, {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        before: before ? new Date(before) : null,
        after: after ? new Date(after) : null
      });

      // Mark messages as read
      await Message.markConversationAsRead(conversationId, userId);

      return paginatedResponse(res, result.messages, result.pagination);

    } catch (error) {
      logger.error('Error getting messages', { error: error.message });
      return errorResponse(res, 'Failed to get messages', 500);
    }
  }

  /**
   * Send message
   * POST /api/messages/conversations/:conversationId/messages
   */
  static async sendMessage(req, res) {
    try {
      const userId = req.auth.userId;
      const { conversationId } = req.params;
      const {
        content,
        type = 'text',
        attachments = [],
        reply_to_id,
        metadata = {}
      } = req.body;

      // Validate content
      if (!content && attachments.length === 0) {
        return errorResponse(res, 'Message content or attachment is required', 400);
      }

      // Verify user is participant
      const isParticipant = await Message.isParticipant(conversationId, userId);
      if (!isParticipant) {
        return errorResponse(res, 'Not authorized', 403);
      }

      // Get conversation to check for blocks
      const conversation = await Message.getConversationById(conversationId);
      
      // For direct conversations, check if blocked
      if (conversation.type === 'direct') {
        const otherParticipant = conversation.participants.find(p => p.id !== userId);
        if (otherParticipant) {
          const isBlocked = await Message.isBlocked(userId, otherParticipant.id);
          if (isBlocked) {
            return errorResponse(res, 'Cannot send message to this user', 403);
          }
        }
      }

      // Verify reply_to message exists
      if (reply_to_id) {
        const replyToMessage = await Message.getMessageById(reply_to_id);
        if (!replyToMessage || replyToMessage.conversationId !== conversationId) {
          return errorResponse(res, 'Reply message not found', 404);
        }
      }

      const message = await Message.sendMessage({
        conversation_id: conversationId,
        sender_id: userId,
        content,
        type,
        attachments,
        reply_to_id,
        metadata
      });

      // Notify other participants
      const sender = await User.findById(userId);
      for (const participant of conversation.participants) {
        if (participant.id !== userId) {
          // Check notification preferences
          const shouldNotify = await Message.shouldNotifyUser(participant.id, conversationId);
          if (shouldNotify) {
            await Notification.create({
              user_id: participant.id,
              type: Notification.TYPES.NEW_MESSAGE,
              title: conversation.type === 'group' 
                ? `New message in ${conversation.name}`
                : `New message from ${sender.displayName}`,
              content: content?.substring(0, 100) || 'Sent an attachment',
              target_type: 'conversation',
              target_id: conversationId,
              actor_id: userId,
              channels: [Notification.CHANNELS.IN_APP, Notification.CHANNELS.PUSH]
            });
          }
        }
      }

      return successResponse(res, {
        message: message
      }, 201);

    } catch (error) {
      logger.error('Error sending message', { error: error.message });
      return errorResponse(res, error.message || 'Failed to send message', 500);
    }
  }

  /**
   * Edit message
   * PUT /api/messages/:messageId
   */
  static async editMessage(req, res) {
    try {
      const userId = req.auth.userId;
      const { messageId } = req.params;
      const { content } = req.body;

      if (!content || content.trim().length === 0) {
        return errorResponse(res, 'Content is required', 400);
      }

      const message = await Message.getMessageById(messageId);
      if (!message) {
        return errorResponse(res, 'Message not found', 404);
      }

      // Verify ownership
      if (message.senderId !== userId) {
        return errorResponse(res, 'Not authorized to edit this message', 403);
      }

      // Check edit time limit (e.g., 15 minutes)
      const editTimeLimit = 15 * 60 * 1000; // 15 minutes
      if (Date.now() - new Date(message.createdAt).getTime() > editTimeLimit) {
        return errorResponse(res, 'Message can no longer be edited', 400);
      }

      const updatedMessage = await Message.editMessage(messageId, content.trim());

      return successResponse(res, {
        message: updatedMessage
      });

    } catch (error) {
      logger.error('Error editing message', { error: error.message });
      return errorResponse(res, 'Failed to edit message', 500);
    }
  }

  /**
   * Delete message
   * DELETE /api/messages/:messageId
   */
  static async deleteMessage(req, res) {
    try {
      const userId = req.auth.userId;
      const { messageId } = req.params;
      const { for_everyone = false } = req.query;

      const message = await Message.getMessageById(messageId);
      if (!message) {
        return errorResponse(res, 'Message not found', 404);
      }

      // Verify ownership for delete for everyone
      if (for_everyone === 'true' && message.senderId !== userId) {
        return errorResponse(res, 'Not authorized to delete this message for everyone', 403);
      }

      await Message.deleteMessage(messageId, userId, for_everyone === 'true');

      return successResponse(res, {
        message: 'Message deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting message', { error: error.message });
      return errorResponse(res, 'Failed to delete message', 500);
    }
  }

  /**
   * React to message
   * POST /api/messages/:messageId/reactions
   */
  static async addReaction(req, res) {
    try {
      const userId = req.auth.userId;
      const { messageId } = req.params;
      const { emoji } = req.body;

      if (!emoji) {
        return errorResponse(res, 'Emoji is required', 400);
      }

      const message = await Message.getMessageById(messageId);
      if (!message) {
        return errorResponse(res, 'Message not found', 404);
      }

      // Verify user is participant in conversation
      const isParticipant = await Message.isParticipant(message.conversationId, userId);
      if (!isParticipant) {
        return errorResponse(res, 'Not authorized', 403);
      }

      const reaction = await Message.addReaction(messageId, userId, emoji);

      return successResponse(res, {
        reaction
      });

    } catch (error) {
      logger.error('Error adding reaction', { error: error.message });
      return errorResponse(res, error.message || 'Failed to add reaction', 500);
    }
  }

  /**
   * Remove reaction from message
   * DELETE /api/messages/:messageId/reactions
   */
  static async removeReaction(req, res) {
    try {
      const userId = req.auth.userId;
      const { messageId } = req.params;
      const { emoji } = req.query;

      await Message.removeReaction(messageId, userId, emoji);

      return successResponse(res, {
        message: 'Reaction removed'
      });

    } catch (error) {
      logger.error('Error removing reaction', { error: error.message });
      return errorResponse(res, 'Failed to remove reaction', 500);
    }
  }

  /**
   * Mark message as read
   * POST /api/messages/:messageId/read
   */
  static async markAsRead(req, res) {
    try {
      const userId = req.auth.userId;
      const { messageId } = req.params;

      const message = await Message.getMessageById(messageId);
      if (!message) {
        return errorResponse(res, 'Message not found', 404);
      }

      await Message.markAsRead(messageId, userId);

      return successResponse(res, {
        message: 'Marked as read'
      });

    } catch (error) {
      logger.error('Error marking message as read', { error: error.message });
      return errorResponse(res, 'Failed to mark as read', 500);
    }
  }

  /**
   * Mark conversation as read
   * POST /api/messages/conversations/:conversationId/read
   */
  static async markConversationAsRead(req, res) {
    try {
      const userId = req.auth.userId;
      const { conversationId } = req.params;

      // Verify user is participant
      const isParticipant = await Message.isParticipant(conversationId, userId);
      if (!isParticipant) {
        return errorResponse(res, 'Not authorized', 403);
      }

      await Message.markConversationAsRead(conversationId, userId);

      return successResponse(res, {
        message: 'Conversation marked as read'
      });

    } catch (error) {
      logger.error('Error marking conversation as read', { error: error.message });
      return errorResponse(res, 'Failed to mark as read', 500);
    }
  }

  // ============================================
  // SEARCH & FILTERS
  // ============================================

  /**
   * Search messages
   * GET /api/messages/search
   */
  static async searchMessages(req, res) {
    try {
      const userId = req.auth.userId;
      const {
        q,
        conversation_id,
        page = 1,
        limit = 20
      } = req.query;

      if (!q || q.trim().length < 2) {
        return errorResponse(res, 'Search query must be at least 2 characters', 400);
      }

      // If conversation_id provided, verify access
      if (conversation_id) {
        const isParticipant = await Message.isParticipant(conversation_id, userId);
        if (!isParticipant) {
          return errorResponse(res, 'Not authorized', 403);
        }
      }

      const result = await Message.searchMessages(userId, {
        query: q.trim(),
        conversationId: conversation_id || null,
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return paginatedResponse(res, result.messages, result.pagination);

    } catch (error) {
      logger.error('Error searching messages', { error: error.message });
      return errorResponse(res, 'Failed to search messages', 500);
    }
  }

  /**
   * Get unread count
   * GET /api/messages/unread-count
   */
  static async getUnreadCount(req, res) {
    try {
      const userId = req.auth.userId;

      const count = await Message.getUnreadCount(userId);

      return successResponse(res, { unreadCount: count });

    } catch (error) {
      logger.error('Error getting unread count', { error: error.message });
      return errorResponse(res, 'Failed to get unread count', 500);
    }
  }

  /**
   * Get media in conversation
   * GET /api/messages/conversations/:conversationId/media
   */
  static async getConversationMedia(req, res) {
    try {
      const userId = req.auth.userId;
      const { conversationId } = req.params;
      const { page = 1, limit = 20, type } = req.query;

      // Verify user is participant
      const isParticipant = await Message.isParticipant(conversationId, userId);
      if (!isParticipant) {
        return errorResponse(res, 'Not authorized', 403);
      }

      const result = await Message.getConversationMedia(conversationId, {
        page: parseInt(page),
        limit: parseInt(limit),
        type: type || null // image, video, file, audio
      });

      return paginatedResponse(res, result.media, result.pagination);

    } catch (error) {
      logger.error('Error getting conversation media', { error: error.message });
      return errorResponse(res, 'Failed to get media', 500);
    }
  }

  // ============================================
  // BLOCKING & MUTING
  // ============================================

  /**
   * Block user
   * POST /api/messages/block/:userId
   */
  static async blockUser(req, res) {
    try {
      const requesterId = req.auth.userId;
      const { userId } = req.params;

      if (userId === requesterId) {
        return errorResponse(res, 'Cannot block yourself', 400);
      }

      const user = await User.findById(userId);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      await Message.blockUser(requesterId, userId);

      return successResponse(res, {
        message: 'User blocked successfully'
      });

    } catch (error) {
      logger.error('Error blocking user', { error: error.message });
      return errorResponse(res, error.message || 'Failed to block user', 500);
    }
  }

  /**
   * Unblock user
   * DELETE /api/messages/block/:userId
   */
  static async unblockUser(req, res) {
    try {
      const requesterId = req.auth.userId;
      const { userId } = req.params;

      await Message.unblockUser(requesterId, userId);

      return successResponse(res, {
        message: 'User unblocked successfully'
      });

    } catch (error) {
      logger.error('Error unblocking user', { error: error.message });
      return errorResponse(res, 'Failed to unblock user', 500);
    }
  }

  /**
   * Get blocked users
   * GET /api/messages/blocked
   */
  static async getBlockedUsers(req, res) {
    try {
      const userId = req.auth.userId;

      const blockedUsers = await Message.getBlockedUsers(userId);

      return successResponse(res, { blockedUsers });

    } catch (error) {
      logger.error('Error getting blocked users', { error: error.message });
      return errorResponse(res, 'Failed to get blocked users', 500);
    }
  }

  /**
   * Mute conversation
   * POST /api/messages/conversations/:conversationId/mute
   */
  static async muteConversation(req, res) {
    try {
      const userId = req.auth.userId;
      const { conversationId } = req.params;
      const { duration } = req.body; // in hours, null for permanent

      // Verify user is participant
      const isParticipant = await Message.isParticipant(conversationId, userId);
      if (!isParticipant) {
        return errorResponse(res, 'Not authorized', 403);
      }

      await Message.muteConversation(conversationId, userId, duration);

      return successResponse(res, {
        message: 'Conversation muted'
      });

    } catch (error) {
      logger.error('Error muting conversation', { error: error.message });
      return errorResponse(res, 'Failed to mute conversation', 500);
    }
  }

  /**
   * Unmute conversation
   * DELETE /api/messages/conversations/:conversationId/mute
   */
  static async unmuteConversation(req, res) {
    try {
      const userId = req.auth.userId;
      const { conversationId } = req.params;

      await Message.unmuteConversation(conversationId, userId);

      return successResponse(res, {
        message: 'Conversation unmuted'
      });

    } catch (error) {
      logger.error('Error unmuting conversation', { error: error.message });
      return errorResponse(res, 'Failed to unmute conversation', 500);
    }
  }

  // ============================================
  // TYPING INDICATORS
  // ============================================

  /**
   * Send typing indicator
   * POST /api/messages/conversations/:conversationId/typing
   */
  static async sendTypingIndicator(req, res) {
    try {
      const userId = req.auth.userId;
      const { conversationId } = req.params;
      const { is_typing = true } = req.body;

      // Verify user is participant
      const isParticipant = await Message.isParticipant(conversationId, userId);
      if (!isParticipant) {
        return errorResponse(res, 'Not authorized', 403);
      }

      // This would typically emit a WebSocket event
      await Message.setTypingStatus(conversationId, userId, is_typing);

      return successResponse(res, {
        message: is_typing ? 'Typing indicator sent' : 'Typing indicator cleared'
      });

    } catch (error) {
      logger.error('Error sending typing indicator', { error: error.message });
      return errorResponse(res, 'Failed to send typing indicator', 500);
    }
  }

  // ============================================
  // MESSAGE REQUESTS (for non-followers)
  // ============================================

  /**
   * Get message requests
   * GET /api/messages/requests
   */
  static async getMessageRequests(req, res) {
    try {
      const userId = req.auth.userId;
      const { page = 1, limit = 20 } = req.query;

      const result = await Message.getMessageRequests(userId, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return paginatedResponse(res, result.requests, result.pagination);

    } catch (error) {
      logger.error('Error getting message requests', { error: error.message });
      return errorResponse(res, 'Failed to get message requests', 500);
    }
  }

  /**
   * Accept message request
   * POST /api/messages/requests/:conversationId/accept
   */
  static async acceptMessageRequest(req, res) {
    try {
      const userId = req.auth.userId;
      const { conversationId } = req.params;

      await Message.acceptMessageRequest(conversationId, userId);

      return successResponse(res, {
        message: 'Message request accepted'
      });

    } catch (error) {
      logger.error('Error accepting message request', { error: error.message });
      return errorResponse(res, error.message || 'Failed to accept request', 500);
    }
  }

  /**
   * Decline message request
   * POST /api/messages/requests/:conversationId/decline
   */
  static async declineMessageRequest(req, res) {
    try {
      const userId = req.auth.userId;
      const { conversationId } = req.params;

      await Message.declineMessageRequest(conversationId, userId);

      return successResponse(res, {
        message: 'Message request declined'
      });

    } catch (error) {
      logger.error('Error declining message request', { error: error.message });
      return errorResponse(res, error.message || 'Failed to decline request', 500);
    }
  }

  // ============================================
  // PINNED MESSAGES
  // ============================================

  /**
   * Pin message
   * POST /api/messages/:messageId/pin
   */
  static async pinMessage(req, res) {
    try {
      const userId = req.auth.userId;
      const { messageId } = req.params;

      const message = await Message.getMessageById(messageId);
      if (!message) {
        return errorResponse(res, 'Message not found', 404);
      }

      // Verify user is participant
      const isParticipant = await Message.isParticipant(message.conversationId, userId);
      if (!isParticipant) {
        return errorResponse(res, 'Not authorized', 403);
      }

      await Message.pinMessage(messageId, userId);

      return successResponse(res, {
        message: 'Message pinned'
      });

    } catch (error) {
      logger.error('Error pinning message', { error: error.message });
      return errorResponse(res, error.message || 'Failed to pin message', 500);
    }
  }

  /**
   * Unpin message
   * DELETE /api/messages/:messageId/pin
   */
  static async unpinMessage(req, res) {
    try {
      const userId = req.auth.userId;
      const { messageId } = req.params;

      const message = await Message.getMessageById(messageId);
      if (!message) {
        return errorResponse(res, 'Message not found', 404);
      }

      // Verify user is participant
      const isParticipant = await Message.isParticipant(message.conversationId, userId);
      if (!isParticipant) {
        return errorResponse(res, 'Not authorized', 403);
      }

      await Message.unpinMessage(messageId);

      return successResponse(res, {
        message: 'Message unpinned'
      });

    } catch (error) {
      logger.error('Error unpinning message', { error: error.message });
      return errorResponse(res, 'Failed to unpin message', 500);
    }
  }

  /**
   * Get pinned messages in conversation
   * GET /api/messages/conversations/:conversationId/pinned
   */
  static async getPinnedMessages(req, res) {
    try {
      const userId = req.auth.userId;
      const { conversationId } = req.params;

      // Verify user is participant
      const isParticipant = await Message.isParticipant(conversationId, userId);
      if (!isParticipant) {
        return errorResponse(res, 'Not authorized', 403);
      }

      const pinnedMessages = await Message.getPinnedMessages(conversationId);

      return successResponse(res, { pinnedMessages });

    } catch (error) {
      logger.error('Error getting pinned messages', { error: error.message });
      return errorResponse(res, 'Failed to get pinned messages', 500);
    }
  }

  // ============================================
  // READING REQUESTS (Special for psychic platform)
  // ============================================

  /**
   * Send reading request via message
   * POST /api/messages/reading-request
   */
  static async sendReadingRequest(req, res) {
    try {
      const userId = req.auth.userId;
      const {
        reader_id,
        session_type,
        message,
        preferred_time
      } = req.body;

      if (!reader_id) {
        return errorResponse(res, 'Reader ID is required', 400);
      }

      // Get reader's user ID
      const Reader = require('../models/Reader');
      const reader = await Reader.findById(reader_id);
      if (!reader) {
        return errorResponse(res, 'Reader not found', 404);
      }

      // Create or get conversation
      const conversation = await Message.getOrCreateConversation(userId, reader.userId);

      // Send reading request message
      const requestMessage = await Message.sendMessage({
        conversation_id: conversation.id,
        sender_id: userId,
        content: message || `I would like to request a ${session_type} reading.`,
        type: 'reading_request',
        metadata: {
          session_type,
          preferred_time,
          reader_id
        }
      });

      // Notify reader
      await Notification.create({
        user_id: reader.userId,
        type: Notification.TYPES.MESSAGE_REQUEST,
        title: 'New Reading Request',
        content: `You have a new ${session_type} reading request`,
        target_type: 'conversation',
        target_id: conversation.id,
        actor_id: userId,
        priority: Notification.PRIORITIES.HIGH
      });

      return successResponse(res, {
        message: 'Reading request sent',
        conversation,
        requestMessage
      }, 201);

    } catch (error) {
      logger.error('Error sending reading request', { error: error.message });
      return errorResponse(res, error.message || 'Failed to send reading request', 500);
    }
  }

  /**
   * Respond to reading request
   * POST /api/messages/:messageId/reading-response
   */
  static async respondToReadingRequest(req, res) {
    try {
      const userId = req.auth.userId;
      const { messageId } = req.params;
      const { accepted, response_message, proposed_time } = req.body;

      const message = await Message.getMessageById(messageId);
      if (!message) {
        return errorResponse(res, 'Message not found', 404);
      }

      if (message.type !== 'reading_request') {
        return errorResponse(res, 'This is not a reading request', 400);
      }

      // Verify user is the reader
      const Reader = require('../models/Reader');
      const reader = await Reader.findByUserId(userId);
      if (!reader || reader.id !== message.metadata?.reader_id) {
        return errorResponse(res, 'Not authorized', 403);
      }

      // Send response message
      const responseMsg = await Message.sendMessage({
        conversation_id: message.conversationId,
        sender_id: userId,
        content: response_message || (accepted ? 'I accept your reading request!' : 'I\'m unable to accept this request at this time.'),
        type: 'reading_response',
        reply_to_id: messageId,
        metadata: {
          accepted,
          proposed_time,
          original_request_id: messageId
        }
      });

      // Notify requester
      await Notification.create({
        user_id: message.senderId,
        type: Notification.TYPES.NEW_MESSAGE,
        title: accepted ? 'Reading Request Accepted!' : 'Reading Request Response',
        content: accepted 
          ? `${reader.displayName} has accepted your reading request`
          : `${reader.displayName} has responded to your reading request`,
        target_type: 'conversation',
        target_id: message.conversationId,
        actor_id: userId,
        priority: Notification.PRIORITIES.HIGH
      });

      return successResponse(res, {
        message: 'Response sent',
        responseMessage: responseMsg
      });

    } catch (error) {
      logger.error('Error responding to reading request', { error: error.message });
      return errorResponse(res, error.message || 'Failed to respond', 500);
    }
  }
}

module.exports = MessageController;