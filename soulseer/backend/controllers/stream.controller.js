/**
 * Stream Controller - Enterprise Level
 * Complete live streaming management endpoints for SoulSeer platform
 */

const Stream = require('../models/Stream');
const Reader = require('../models/Reader');
const Gift = require('../models/Gift');
const Notification = require('../models/Notification');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { logger } = require('../utils/logger');

class StreamController {
  /**
   * Get live streams
   * GET /api/streams/live
   */
  static async getLiveStreams(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        type,
        sort_by = 'viewer_count',
        sort_order = 'DESC'
      } = req.query;

      const result = await Stream.getLiveStreams({
        page: parseInt(page),
        limit: parseInt(limit),
        category: category || null,
        type: type || null,
        sortBy: sort_by,
        sortOrder: sort_order
      });

      return paginatedResponse(res, result.streams, result.pagination);

    } catch (error) {
      logger.error('Error getting live streams', { error: error.message });
      return errorResponse(res, 'Failed to get live streams', 500);
    }
  }

  /**
   * Get scheduled streams
   * GET /api/streams/scheduled
   */
  static async getScheduledStreams(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        reader_id,
        start_date,
        end_date
      } = req.query;

      const result = await Stream.getScheduledStreams({
        page: parseInt(page),
        limit: parseInt(limit),
        category: category || null,
        readerId: reader_id || null,
        startDate: start_date ? new Date(start_date) : new Date(),
        endDate: end_date ? new Date(end_date) : null
      });

      return paginatedResponse(res, result.streams, result.pagination);

    } catch (error) {
      logger.error('Error getting scheduled streams', { error: error.message });
      return errorResponse(res, 'Failed to get scheduled streams', 500);
    }
  }

  /**
   * Get stream by ID
   * GET /api/streams/:streamId
   */
  static async getStream(req, res) {
    try {
      const { streamId } = req.params;

      const stream = await Stream.findById(streamId);
      if (!stream) {
        return errorResponse(res, 'Stream not found', 404);
      }

      // Get additional data for live streams
      let viewers = [];
      let recentGifts = [];

      if (stream.status === 'live') {
        viewers = await Stream.getCurrentViewers(streamId);
        const giftsResult = await Stream.getStreamGifts(streamId, { limit: 10 });
        recentGifts = giftsResult.gifts;
      }

      return successResponse(res, {
        stream,
        viewers,
        recentGifts
      });

    } catch (error) {
      logger.error('Error getting stream', { error: error.message });
      return errorResponse(res, 'Failed to get stream', 500);
    }
  }

  /**
   * Create a new stream
   * POST /api/streams
   */
  static async createStream(req, res) {
    try {
      const userId = req.auth.userId;
      const {
        title,
        description,
        type = 'public',
        category,
        thumbnail_url,
        scheduled_start,
        max_viewers,
        entry_fee = 0,
        is_recorded = false,
        tags = []
      } = req.body;

      // Verify user is a reader
      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Only readers can create streams', 403);
      }

      if (!title) {
        return errorResponse(res, 'Title is required', 400);
      }

      const stream = await Stream.create({
        reader_id: reader.id,
        title,
        description,
        type,
        category: category || Stream.CATEGORIES.OTHER,
        thumbnail_url,
        scheduled_start: scheduled_start ? new Date(scheduled_start) : null,
        max_viewers,
        entry_fee,
        is_recorded,
        tags
      });

      // Notify followers if scheduled
      if (scheduled_start) {
        const followers = await Reader.getFavoritedByUsers(reader.id);
        for (const follower of followers) {
          await Notification.create({
            user_id: follower.id,
            type: Notification.TYPES.STREAM_SCHEDULED,
            title: 'Upcoming Stream',
            content: `${reader.displayName} has scheduled a new stream: ${title}`,
            target_type: 'stream',
            target_id: stream.id,
            actor_id: userId
          });
        }
      }

      return successResponse(res, {
        message: 'Stream created successfully',
        stream
      }, 201);

    } catch (error) {
      logger.error('Error creating stream', { error: error.message });
      return errorResponse(res, error.message || 'Failed to create stream', 500);
    }
  }

  /**
   * Update stream
   * PUT /api/streams/:streamId
   */
  static async updateStream(req, res) {
    try {
      const userId = req.auth.userId;
      const { streamId } = req.params;
      const updates = req.body;

      const stream = await Stream.findById(streamId);
      if (!stream) {
        return errorResponse(res, 'Stream not found', 404);
      }

      // Verify ownership
      const reader = await Reader.findById(stream.readerId);
      if (!reader || reader.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      // Can't update certain fields if stream is live
      if (stream.status === 'live') {
        const restrictedFields = ['type', 'scheduled_start', 'entry_fee'];
        for (const field of restrictedFields) {
          if (updates[field] !== undefined) {
            return errorResponse(res, `Cannot update ${field} while stream is live`, 400);
          }
        }
      }

      const updatedStream = await Stream.update(streamId, updates);

      return successResponse(res, {
        message: 'Stream updated successfully',
        stream: updatedStream
      });

    } catch (error) {
      logger.error('Error updating stream', { error: error.message });
      return errorResponse(res, error.message || 'Failed to update stream', 500);
    }
  }

  /**
   * Delete stream
   * DELETE /api/streams/:streamId
   */
  static async deleteStream(req, res) {
    try {
      const userId = req.auth.userId;
      const { streamId } = req.params;

      const stream = await Stream.findById(streamId);
      if (!stream) {
        return errorResponse(res, 'Stream not found', 404);
      }

      // Verify ownership
      const reader = await Reader.findById(stream.readerId);
      if (!reader || reader.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      await Stream.delete(streamId);

      return successResponse(res, {
        message: 'Stream deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting stream', { error: error.message });
      return errorResponse(res, error.message || 'Failed to delete stream', 500);
    }
  }

  /**
   * Start stream (go live)
   * POST /api/streams/:streamId/start
   */
  static async startStream(req, res) {
    try {
      const userId = req.auth.userId;
      const { streamId } = req.params;

      const stream = await Stream.findById(streamId);
      if (!stream) {
        return errorResponse(res, 'Stream not found', 404);
      }

      // Verify ownership
      const reader = await Reader.findById(stream.readerId);
      if (!reader || reader.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      // Generate Agora credentials
      const agoraService = require('../services/agora.service');
      const channelName = `stream_${streamId}`;
      const token = agoraService.generateRtcToken(channelName, userId, 'publisher');

      // Start the stream
      const updatedStream = await Stream.startStream(streamId, {
        agora_channel_name: channelName,
        agora_token: token
      });

      // Notify followers
      const followers = await Reader.getFavoritedByUsers(reader.id);
      for (const follower of followers) {
        await Notification.create({
          user_id: follower.id,
          type: Notification.TYPES.STREAM_STARTED,
          title: `${reader.displayName} is Live!`,
          content: `${reader.displayName} just started streaming: ${stream.title}`,
          target_type: 'stream',
          target_id: streamId,
          actor_id: userId,
          priority: Notification.PRIORITIES.HIGH
        });
      }

      return successResponse(res, {
        message: 'Stream started',
        stream: updatedStream,
        agora: {
          channelName,
          token,
          uid: userId
        }
      });

    } catch (error) {
      logger.error('Error starting stream', { error: error.message });
      return errorResponse(res, error.message || 'Failed to start stream', 500);
    }
  }

  /**
   * End stream
   * POST /api/streams/:streamId/end
   */
  static async endStream(req, res) {
    try {
      const userId = req.auth.userId;
      const { streamId } = req.params;
      const { recording_url } = req.body;

      const stream = await Stream.findById(streamId);
      if (!stream) {
        return errorResponse(res, 'Stream not found', 404);
      }

      // Verify ownership
      const reader = await Reader.findById(stream.readerId);
      if (!reader || reader.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      const updatedStream = await Stream.endStream(streamId, { recording_url });

      // Get final analytics
      const analytics = await Stream.getStreamAnalytics(streamId);

      return successResponse(res, {
        message: 'Stream ended',
        stream: updatedStream,
        analytics
      });

    } catch (error) {
      logger.error('Error ending stream', { error: error.message });
      return errorResponse(res, error.message || 'Failed to end stream', 500);
    }
  }

  /**
   * Cancel scheduled stream
   * POST /api/streams/:streamId/cancel
   */
  static async cancelStream(req, res) {
    try {
      const userId = req.auth.userId;
      const { streamId } = req.params;
      const { reason } = req.body;

      const stream = await Stream.findById(streamId);
      if (!stream) {
        return errorResponse(res, 'Stream not found', 404);
      }

      // Verify ownership
      const reader = await Reader.findById(stream.readerId);
      if (!reader || reader.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      const updatedStream = await Stream.cancelStream(streamId, reason);

      return successResponse(res, {
        message: 'Stream cancelled',
        stream: updatedStream
      });

    } catch (error) {
      logger.error('Error cancelling stream', { error: error.message });
      return errorResponse(res, error.message || 'Failed to cancel stream', 500);
    }
  }

  /**
   * Join stream as viewer
   * POST /api/streams/:streamId/join
   */
  static async joinStream(req, res) {
    try {
      const userId = req.auth.userId;
      const { streamId } = req.params;

      const stream = await Stream.findById(streamId);
      if (!stream) {
        return errorResponse(res, 'Stream not found', 404);
      }

      if (stream.status !== 'live') {
        return errorResponse(res, 'Stream is not live', 400);
      }

      // Check entry fee
      if (stream.entryFee > 0) {
        const User = require('../models/User');
        const user = await User.findById(userId);
        
        if (user.balance < stream.entryFee) {
          return errorResponse(res, 'Insufficient balance for stream entry fee', 400);
        }

        // Deduct entry fee
        await User.deductBalance(userId, stream.entryFee);

        // Create transaction
        const Transaction = require('../models/Transaction');
        await Transaction.create({
          user_id: userId,
          reader_id: stream.readerId,
          stream_id: streamId,
          type: Transaction.TYPES.STREAM_TIP,
          amount: stream.entryFee,
          status: Transaction.STATUSES.COMPLETED,
          description: `Entry fee for stream: ${stream.title}`
        });
      }

      // Add viewer
      await Stream.addViewer(streamId, userId);

      // Generate viewer token
      const agoraService = require('../services/agora.service');
      const token = agoraService.generateRtcToken(stream.agoraChannelName, userId, 'audience');
      const rtmToken = agoraService.generateRtmToken(userId);

      return successResponse(res, {
        message: 'Joined stream',
        agora: {
          channelName: stream.agoraChannelName,
          rtcToken: token,
          rtmToken,
          uid: userId
        }
      });

    } catch (error) {
      logger.error('Error joining stream', { error: error.message });
      return errorResponse(res, error.message || 'Failed to join stream', 500);
    }
  }

  /**
   * Leave stream
   * POST /api/streams/:streamId/leave
   */
  static async leaveStream(req, res) {
    try {
      const userId = req.auth.userId;
      const { streamId } = req.params;

      await Stream.removeViewer(streamId, userId);

      return successResponse(res, {
        message: 'Left stream'
      });

    } catch (error) {
      logger.error('Error leaving stream', { error: error.message });
      return errorResponse(res, 'Failed to leave stream', 500);
    }
  }

  /**
   * Get stream token (refresh)
   * GET /api/streams/:streamId/token
   */
  static async getStreamToken(req, res) {
    try {
      const userId = req.auth.userId;
      const { streamId } = req.params;
      const { role = 'audience' } = req.query;

      const stream = await Stream.findById(streamId);
      if (!stream) {
        return errorResponse(res, 'Stream not found', 404);
      }

      if (stream.status !== 'live') {
        return errorResponse(res, 'Stream is not live', 400);
      }

      // Verify role
      const reader = await Reader.findById(stream.readerId);
      const isHost = reader?.userId === userId;
      const actualRole = isHost ? 'publisher' : role;

      const agoraService = require('../services/agora.service');
      const token = agoraService.generateRtcToken(stream.agoraChannelName, userId, actualRole);
      const rtmToken = agoraService.generateRtmToken(userId);

      return successResponse(res, {
        channelName: stream.agoraChannelName,
        rtcToken: token,
        rtmToken,
        uid: userId,
        role: actualRole
      });

    } catch (error) {
      logger.error('Error getting stream token', { error: error.message });
      return errorResponse(res, 'Failed to get token', 500);
    }
  }

  /**
   * Send gift in stream
   * POST /api/streams/:streamId/gifts
   */
  static async sendGift(req, res) {
    try {
      const userId = req.auth.userId;
      const { streamId } = req.params;
      const { gift_id, quantity = 1, message } = req.body;

      const stream = await Stream.findById(streamId);
      if (!stream) {
        return errorResponse(res, 'Stream not found', 404);
      }

      if (stream.status !== 'live') {
        return errorResponse(res, 'Stream is not live', 400);
      }

      if (!gift_id) {
        return errorResponse(res, 'Gift ID is required', 400);
      }

      const giftTransaction = await Stream.sendGift(streamId, userId, {
        gift_id,
        quantity,
        message
      });

      return successResponse(res, {
        message: 'Gift sent successfully',
        gift: giftTransaction
      });

    } catch (error) {
      logger.error('Error sending gift', { error: error.message });
      return errorResponse(res, error.message || 'Failed to send gift', 500);
    }
  }

  /**
   * Get stream gifts
   * GET /api/streams/:streamId/gifts
   */
  static async getStreamGifts(req, res) {
    try {
      const { streamId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const result = await Stream.getStreamGifts(streamId, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return paginatedResponse(res, result.gifts, result.pagination);

    } catch (error) {
      logger.error('Error getting stream gifts', { error: error.message });
      return errorResponse(res, 'Failed to get gifts', 500);
    }
  }

  /**
   * Send chat message in stream
   * POST /api/streams/:streamId/chat
   */
  static async sendChatMessage(req, res) {
    try {
      const userId = req.auth.userId;
      const { streamId } = req.params;
      const { message } = req.body;

      if (!message || message.trim().length === 0) {
        return errorResponse(res, 'Message is required', 400);
      }

      if (message.length > 500) {
        return errorResponse(res, 'Message too long (max 500 characters)', 400);
      }

      const chatMessage = await Stream.sendChatMessage(streamId, userId, message.trim());

      return successResponse(res, {
        message: 'Message sent',
        chatMessage
      });

    } catch (error) {
      logger.error('Error sending chat message', { error: error.message });
      return errorResponse(res, error.message || 'Failed to send message', 500);
    }
  }

  /**
   * Get stream chat messages
   * GET /api/streams/:streamId/chat
   */
  static async getChatMessages(req, res) {
    try {
      const { streamId } = req.params;
      const { limit = 100, before, after } = req.query;

      const messages = await Stream.getChatMessages(streamId, {
        limit: parseInt(limit),
        before: before || null,
        after: after || null
      });

      return successResponse(res, { messages });

    } catch (error) {
      logger.error('Error getting chat messages', { error: error.message });
      return errorResponse(res, 'Failed to get messages', 500);
    }
  }

  /**
   * Get stream viewers
   * GET /api/streams/:streamId/viewers
   */
  static async getViewers(req, res) {
    try {
      const { streamId } = req.params;

      const viewers = await Stream.getCurrentViewers(streamId);

      return successResponse(res, { viewers });

    } catch (error) {
      logger.error('Error getting viewers', { error: error.message });
      return errorResponse(res, 'Failed to get viewers', 500);
    }
  }

  /**
   * Get stream analytics
   * GET /api/streams/:streamId/analytics
   */
  static async getAnalytics(req, res) {
    try {
      const userId = req.auth.userId;
      const { streamId } = req.params;

      const stream = await Stream.findById(streamId);
      if (!stream) {
        return errorResponse(res, 'Stream not found', 404);
      }

      // Verify ownership
      const reader = await Reader.findById(stream.readerId);
      if (!reader || reader.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      const analytics = await Stream.getStreamAnalytics(streamId);

      return successResponse(res, { analytics });

    } catch (error) {
      logger.error('Error getting analytics', { error: error.message });
      return errorResponse(res, 'Failed to get analytics', 500);
    }
  }

  /**
   * Get available gifts
   * GET /api/streams/gifts
   */
  static async getAvailableGifts(req, res) {
    try {
      const { category } = req.query;

      const result = await Gift.getAvailableGifts({
        category: category || null,
        limit: 100
      });

      return successResponse(res, { gifts: result.gifts });

    } catch (error) {
      logger.error('Error getting available gifts', { error: error.message });
      return errorResponse(res, 'Failed to get gifts', 500);
    }
  }

  /**
   * Get stream categories
   * GET /api/streams/categories
   */
  static async getCategories(req, res) {
    try {
      const categories = Object.entries(Stream.CATEGORIES).map(([key, value]) => ({
        id: value,
        name: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
      }));

      return successResponse(res, { categories });

    } catch (error) {
      logger.error('Error getting categories', { error: error.message });
      return errorResponse(res, 'Failed to get categories', 500);
    }
  }

  /**
   * Search streams
   * GET /api/streams/search
   */
  static async searchStreams(req, res) {
    try {
      const { q, page = 1, limit = 20, status, category } = req.query;

      if (!q || q.length < 2) {
        return errorResponse(res, 'Search query must be at least 2 characters', 400);
      }

      const result = await Stream.searchStreams(q, {
        page: parseInt(page),
        limit: parseInt(limit),
        status: status || null,
        category: category || null
      });

      return paginatedResponse(res, result.streams, result.pagination);

    } catch (error) {
      logger.error('Error searching streams', { error: error.message });
      return errorResponse(res, 'Failed to search streams', 500);
    }
  }

  /**
   * Get my streams (reader)
   * GET /api/streams/me
   */
  static async getMyStreams(req, res) {
    try {
      const userId = req.auth.userId;
      const { page = 1, limit = 20, status } = req.query;

      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      const result = await Stream.getReaderStreams(reader.id, {
        page: parseInt(page),
        limit: parseInt(limit),
        status: status || null
      });

      return paginatedResponse(res, result.streams, result.pagination);

    } catch (error) {
      logger.error('Error getting my streams', { error: error.message });
      return errorResponse(res, 'Failed to get streams', 500);
    }
  }
}

module.exports = StreamController;