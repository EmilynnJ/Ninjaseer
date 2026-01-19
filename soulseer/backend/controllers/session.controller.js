/**
 * Session Controller - Enterprise Level
 * Complete reading session management endpoints for SoulSeer platform
 */

const Session = require('../models/Session');
const Reader = require('../models/Reader');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const Review = require('../models/Review');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { logger } = require('../utils/logger');

class SessionController {
  /**
   * Request a new reading session
   * POST /api/sessions
   */
  static async createSession(req, res) {
    try {
      const clientId = req.auth.userId;
      const {
        reader_id,
        type,
        scheduled_at,
        notes,
        questions
      } = req.body;

      // Validate required fields
      if (!reader_id) {
        return errorResponse(res, 'Reader ID is required', 400);
      }

      if (!type || !['chat', 'voice', 'video'].includes(type)) {
        return errorResponse(res, 'Valid session type is required (chat, voice, video)', 400);
      }

      // Check reader exists and is available
      const reader = await Reader.findById(reader_id);
      if (!reader) {
        return errorResponse(res, 'Reader not found', 404);
      }

      if (reader.status !== 'online' && !scheduled_at) {
        return errorResponse(res, 'Reader is not currently available', 400);
      }

      // Check client balance
      const client = await User.findById(clientId);
      if (!client) {
        return errorResponse(res, 'Client not found', 404);
      }

      // Get rate based on session type
      const rate = type === 'video' 
        ? reader.ratePerMinuteVideo 
        : type === 'voice' 
          ? reader.ratePerMinuteVoice 
          : reader.ratePerMinute;

      // Require minimum balance for 5 minutes
      const minimumBalance = rate * 5;
      if (client.balance < minimumBalance) {
        return errorResponse(res, `Insufficient balance. Minimum $${minimumBalance.toFixed(2)} required`, 400);
      }

      // Create session
      const session = await Session.create({
        client_id: clientId,
        reader_id: reader_id,
        type,
        rate_per_minute: rate,
        scheduled_at: scheduled_at ? new Date(scheduled_at) : null,
        client_notes: notes,
        questions
      });

      // Send notification to reader
      await Notification.create({
        user_id: reader.userId,
        type: Notification.TYPES.SESSION_REQUEST,
        title: 'New Reading Request',
        content: `${client.displayName} has requested a ${type} reading`,
        target_type: 'session',
        target_id: session.id,
        actor_id: clientId,
        priority: Notification.PRIORITIES.HIGH
      });

      return successResponse(res, {
        message: 'Session request created',
        session
      }, 201);

    } catch (error) {
      logger.error('Error creating session', { error: error.message });
      return errorResponse(res, error.message || 'Failed to create session', 500);
    }
  }

  /**
   * Get session by ID
   * GET /api/sessions/:sessionId
   */
  static async getSession(req, res) {
    try {
      const userId = req.auth.userId;
      const { sessionId } = req.params;

      const session = await Session.findById(sessionId);
      if (!session) {
        return errorResponse(res, 'Session not found', 404);
      }

      // Verify user is participant
      const reader = await Reader.findById(session.readerId);
      if (session.clientId !== userId && reader?.userId !== userId) {
        return errorResponse(res, 'Not authorized to view this session', 403);
      }

      return successResponse(res, { session });

    } catch (error) {
      logger.error('Error getting session', { error: error.message });
      return errorResponse(res, 'Failed to get session', 500);
    }
  }

  /**
   * Accept session request (reader only)
   * POST /api/sessions/:sessionId/accept
   */
  static async acceptSession(req, res) {
    try {
      const userId = req.auth.userId;
      const { sessionId } = req.params;

      const session = await Session.findById(sessionId);
      if (!session) {
        return errorResponse(res, 'Session not found', 404);
      }

      // Verify user is the reader
      const reader = await Reader.findById(session.readerId);
      if (!reader || reader.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      if (session.status !== 'pending') {
        return errorResponse(res, 'Session cannot be accepted', 400);
      }

      // Accept the session
      const updatedSession = await Session.accept(sessionId);

      // Generate Agora tokens
      const agoraService = require('../services/agora.service');
      const channelName = `session_${sessionId}`;
      
      const readerToken = agoraService.generateRtcToken(channelName, reader.userId, 'publisher');
      const clientToken = agoraService.generateRtcToken(channelName, session.clientId, 'publisher');

      // Update session with Agora info
      await Session.update(sessionId, {
        agora_channel_name: channelName,
        agora_reader_token: readerToken,
        agora_client_token: clientToken
      });

      // Notify client
      await Notification.create({
        user_id: session.clientId,
        type: Notification.TYPES.SESSION_ACCEPTED,
        title: 'Reading Request Accepted',
        content: `${reader.displayName} has accepted your reading request`,
        target_type: 'session',
        target_id: sessionId,
        actor_id: userId,
        priority: Notification.PRIORITIES.HIGH
      });

      return successResponse(res, {
        message: 'Session accepted',
        session: updatedSession,
        agora: {
          channelName,
          token: readerToken
        }
      });

    } catch (error) {
      logger.error('Error accepting session', { error: error.message });
      return errorResponse(res, error.message || 'Failed to accept session', 500);
    }
  }

  /**
   * Decline session request (reader only)
   * POST /api/sessions/:sessionId/decline
   */
  static async declineSession(req, res) {
    try {
      const userId = req.auth.userId;
      const { sessionId } = req.params;
      const { reason } = req.body;

      const session = await Session.findById(sessionId);
      if (!session) {
        return errorResponse(res, 'Session not found', 404);
      }

      // Verify user is the reader
      const reader = await Reader.findById(session.readerId);
      if (!reader || reader.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      if (session.status !== 'pending') {
        return errorResponse(res, 'Session cannot be declined', 400);
      }

      // Decline the session
      const updatedSession = await Session.decline(sessionId, reason);

      // Notify client
      await Notification.create({
        user_id: session.clientId,
        type: Notification.TYPES.SESSION_DECLINED,
        title: 'Reading Request Declined',
        content: reason || `${reader.displayName} is unable to accept your request at this time`,
        target_type: 'session',
        target_id: sessionId,
        actor_id: userId
      });

      return successResponse(res, {
        message: 'Session declined',
        session: updatedSession
      });

    } catch (error) {
      logger.error('Error declining session', { error: error.message });
      return errorResponse(res, error.message || 'Failed to decline session', 500);
    }
  }

  /**
   * Start session
   * POST /api/sessions/:sessionId/start
   */
  static async startSession(req, res) {
    try {
      const userId = req.auth.userId;
      const { sessionId } = req.params;

      const session = await Session.findById(sessionId);
      if (!session) {
        return errorResponse(res, 'Session not found', 404);
      }

      // Verify user is participant
      const reader = await Reader.findById(session.readerId);
      if (session.clientId !== userId && reader?.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      if (session.status !== 'accepted' && session.status !== 'scheduled') {
        return errorResponse(res, 'Session cannot be started', 400);
      }

      // Verify client has sufficient balance
      const client = await User.findById(session.clientId);
      const minimumBalance = session.ratePerMinute * 3; // At least 3 minutes
      if (client.balance < minimumBalance) {
        return errorResponse(res, 'Client has insufficient balance', 400);
      }

      // Start the session
      const updatedSession = await Session.start(sessionId);

      // Notify both parties
      const notifyUserId = userId === session.clientId ? reader.userId : session.clientId;
      await Notification.create({
        user_id: notifyUserId,
        type: Notification.TYPES.SESSION_STARTED,
        title: 'Reading Started',
        content: 'Your reading session has begun',
        target_type: 'session',
        target_id: sessionId,
        priority: Notification.PRIORITIES.URGENT
      });

      return successResponse(res, {
        message: 'Session started',
        session: updatedSession
      });

    } catch (error) {
      logger.error('Error starting session', { error: error.message });
      return errorResponse(res, error.message || 'Failed to start session', 500);
    }
  }

  /**
   * End session
   * POST /api/sessions/:sessionId/end
   */
  static async endSession(req, res) {
    try {
      const userId = req.auth.userId;
      const { sessionId } = req.params;
      const { reason } = req.body;

      const session = await Session.findById(sessionId);
      if (!session) {
        return errorResponse(res, 'Session not found', 404);
      }

      // Verify user is participant
      const reader = await Reader.findById(session.readerId);
      if (session.clientId !== userId && reader?.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      if (session.status !== 'in_progress') {
        return errorResponse(res, 'Session is not in progress', 400);
      }

      // End the session
      const endedBy = userId === session.clientId ? 'client' : 'reader';
      const updatedSession = await Session.end(sessionId, endedBy, reason);

      // Process payment
      const paymentResult = await this.processSessionPayment(updatedSession);

      // Notify both parties
      const notifyUserId = userId === session.clientId ? reader.userId : session.clientId;
      await Notification.create({
        user_id: notifyUserId,
        type: Notification.TYPES.SESSION_ENDED,
        title: 'Reading Ended',
        content: `Your reading session has ended. Duration: ${updatedSession.durationMinutes} minutes`,
        target_type: 'session',
        target_id: sessionId
      });

      return successResponse(res, {
        message: 'Session ended',
        session: updatedSession,
        payment: paymentResult
      });

    } catch (error) {
      logger.error('Error ending session', { error: error.message });
      return errorResponse(res, error.message || 'Failed to end session', 500);
    }
  }

  /**
   * Cancel session
   * POST /api/sessions/:sessionId/cancel
   */
  static async cancelSession(req, res) {
    try {
      const userId = req.auth.userId;
      const { sessionId } = req.params;
      const { reason } = req.body;

      const session = await Session.findById(sessionId);
      if (!session) {
        return errorResponse(res, 'Session not found', 404);
      }

      // Verify user is participant
      const reader = await Reader.findById(session.readerId);
      if (session.clientId !== userId && reader?.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      if (!['pending', 'accepted', 'scheduled'].includes(session.status)) {
        return errorResponse(res, 'Session cannot be cancelled', 400);
      }

      // Cancel the session
      const cancelledBy = userId === session.clientId ? 'client' : 'reader';
      const updatedSession = await Session.cancel(sessionId, cancelledBy, reason);

      // Notify the other party
      const notifyUserId = userId === session.clientId ? reader.userId : session.clientId;
      await Notification.create({
        user_id: notifyUserId,
        type: Notification.TYPES.SESSION_CANCELLED,
        title: 'Reading Cancelled',
        content: reason || 'The reading session has been cancelled',
        target_type: 'session',
        target_id: sessionId,
        actor_id: userId
      });

      return successResponse(res, {
        message: 'Session cancelled',
        session: updatedSession
      });

    } catch (error) {
      logger.error('Error cancelling session', { error: error.message });
      return errorResponse(res, error.message || 'Failed to cancel session', 500);
    }
  }

  /**
   * Get Agora token for session
   * GET /api/sessions/:sessionId/token
   */
  static async getSessionToken(req, res) {
    try {
      const userId = req.auth.userId;
      const { sessionId } = req.params;

      const session = await Session.findById(sessionId);
      if (!session) {
        return errorResponse(res, 'Session not found', 404);
      }

      // Verify user is participant
      const reader = await Reader.findById(session.readerId);
      const isReader = reader?.userId === userId;
      const isClient = session.clientId === userId;

      if (!isReader && !isClient) {
        return errorResponse(res, 'Not authorized', 403);
      }

      if (!['accepted', 'in_progress'].includes(session.status)) {
        return errorResponse(res, 'Session is not active', 400);
      }

      // Generate fresh token
      const agoraService = require('../services/agora.service');
      const channelName = session.agoraChannelName || `session_${sessionId}`;
      const token = agoraService.generateRtcToken(channelName, userId, 'publisher');

      // Also generate RTM token for chat
      const rtmToken = agoraService.generateRtmToken(userId);

      return successResponse(res, {
        channelName,
        rtcToken: token,
        rtmToken,
        uid: userId,
        sessionType: session.type
      });

    } catch (error) {
      logger.error('Error getting session token', { error: error.message });
      return errorResponse(res, 'Failed to get session token', 500);
    }
  }

  /**
   * Send chat message in session
   * POST /api/sessions/:sessionId/messages
   */
  static async sendMessage(req, res) {
    try {
      const userId = req.auth.userId;
      const { sessionId } = req.params;
      const { content, type = 'text' } = req.body;

      const session = await Session.findById(sessionId);
      if (!session) {
        return errorResponse(res, 'Session not found', 404);
      }

      // Verify user is participant
      const reader = await Reader.findById(session.readerId);
      if (session.clientId !== userId && reader?.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      if (session.status !== 'in_progress') {
        return errorResponse(res, 'Session is not active', 400);
      }

      // Save message
      const message = await Session.addMessage(sessionId, {
        sender_id: userId,
        content,
        type
      });

      return successResponse(res, {
        message: 'Message sent',
        chatMessage: message
      });

    } catch (error) {
      logger.error('Error sending message', { error: error.message });
      return errorResponse(res, 'Failed to send message', 500);
    }
  }

  /**
   * Get session messages
   * GET /api/sessions/:sessionId/messages
   */
  static async getMessages(req, res) {
    try {
      const userId = req.auth.userId;
      const { sessionId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const session = await Session.findById(sessionId);
      if (!session) {
        return errorResponse(res, 'Session not found', 404);
      }

      // Verify user is participant
      const reader = await Reader.findById(session.readerId);
      if (session.clientId !== userId && reader?.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      const result = await Session.getMessages(sessionId, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return paginatedResponse(res, result.messages, result.pagination);

    } catch (error) {
      logger.error('Error getting messages', { error: error.message });
      return errorResponse(res, 'Failed to get messages', 500);
    }
  }

  /**
   * Extend session time
   * POST /api/sessions/:sessionId/extend
   */
  static async extendSession(req, res) {
    try {
      const userId = req.auth.userId;
      const { sessionId } = req.params;
      const { minutes } = req.body;

      const session = await Session.findById(sessionId);
      if (!session) {
        return errorResponse(res, 'Session not found', 404);
      }

      // Only client can extend
      if (session.clientId !== userId) {
        return errorResponse(res, 'Only the client can extend the session', 403);
      }

      if (session.status !== 'in_progress') {
        return errorResponse(res, 'Session is not in progress', 400);
      }

      // Check balance for extension
      const client = await User.findById(userId);
      const extensionCost = session.ratePerMinute * minutes;
      if (client.balance < extensionCost) {
        return errorResponse(res, 'Insufficient balance for extension', 400);
      }

      // Extend session
      const updatedSession = await Session.extend(sessionId, minutes);

      return successResponse(res, {
        message: `Session extended by ${minutes} minutes`,
        session: updatedSession
      });

    } catch (error) {
      logger.error('Error extending session', { error: error.message });
      return errorResponse(res, error.message || 'Failed to extend session', 500);
    }
  }

  /**
   * Rate and review session
   * POST /api/sessions/:sessionId/review
   */
  static async reviewSession(req, res) {
    try {
      const userId = req.auth.userId;
      const { sessionId } = req.params;
      const { rating, title, content, category_ratings } = req.body;

      const session = await Session.findById(sessionId);
      if (!session) {
        return errorResponse(res, 'Session not found', 404);
      }

      // Only client can review
      if (session.clientId !== userId) {
        return errorResponse(res, 'Only the client can review the session', 403);
      }

      if (session.status !== 'completed') {
        return errorResponse(res, 'Can only review completed sessions', 400);
      }

      // Create review
      const review = await Review.create({
        reviewer_id: userId,
        type: Review.TYPES.SESSION,
        target_id: sessionId,
        rating,
        title,
        content,
        category_ratings
      });

      // Also create reader review
      await Review.create({
        reviewer_id: userId,
        type: Review.TYPES.READER,
        target_id: session.readerId,
        rating,
        title,
        content,
        category_ratings
      });

      // Mark session as reviewed
      await Session.update(sessionId, { is_reviewed: true });

      return successResponse(res, {
        message: 'Review submitted successfully',
        review
      });

    } catch (error) {
      logger.error('Error reviewing session', { error: error.message });
      return errorResponse(res, error.message || 'Failed to submit review', 500);
    }
  }

  /**
   * Report session issue
   * POST /api/sessions/:sessionId/report
   */
  static async reportSession(req, res) {
    try {
      const userId = req.auth.userId;
      const { sessionId } = req.params;
      const { reason, description } = req.body;

      const session = await Session.findById(sessionId);
      if (!session) {
        return errorResponse(res, 'Session not found', 404);
      }

      // Verify user is participant
      const reader = await Reader.findById(session.readerId);
      if (session.clientId !== userId && reader?.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      // Create report
      const report = await Session.createReport(sessionId, {
        reporter_id: userId,
        reason,
        description
      });

      // Notify admins
      await Notification.broadcast({
        type: Notification.TYPES.SYSTEM_ANNOUNCEMENT,
        title: 'Session Report',
        content: `A session has been reported: ${reason}`,
        target_type: 'session',
        target_id: sessionId,
        priority: Notification.PRIORITIES.HIGH
      }, { role: 'admin' });

      return successResponse(res, {
        message: 'Report submitted successfully',
        report
      });

    } catch (error) {
      logger.error('Error reporting session', { error: error.message });
      return errorResponse(res, 'Failed to submit report', 500);
    }
  }

  /**
   * Request refund for session
   * POST /api/sessions/:sessionId/refund
   */
  static async requestRefund(req, res) {
    try {
      const userId = req.auth.userId;
      const { sessionId } = req.params;
      const { reason } = req.body;

      const session = await Session.findById(sessionId);
      if (!session) {
        return errorResponse(res, 'Session not found', 404);
      }

      // Only client can request refund
      if (session.clientId !== userId) {
        return errorResponse(res, 'Only the client can request a refund', 403);
      }

      if (!['completed', 'cancelled'].includes(session.status)) {
        return errorResponse(res, 'Cannot request refund for this session', 400);
      }

      // Check if already refunded
      if (session.isRefunded) {
        return errorResponse(res, 'Session has already been refunded', 400);
      }

      // Create refund request
      const refundRequest = await Session.createRefundRequest(sessionId, {
        requester_id: userId,
        reason,
        amount: session.totalCharged
      });

      // Notify admins
      await Notification.broadcast({
        type: Notification.TYPES.SYSTEM_ANNOUNCEMENT,
        title: 'Refund Request',
        content: `Refund requested for session: ${reason}`,
        target_type: 'session',
        target_id: sessionId,
        priority: Notification.PRIORITIES.HIGH
      }, { role: 'admin' });

      return successResponse(res, {
        message: 'Refund request submitted',
        refundRequest
      });

    } catch (error) {
      logger.error('Error requesting refund', { error: error.message });
      return errorResponse(res, 'Failed to request refund', 500);
    }
  }

  /**
   * Get session history for current user
   * GET /api/sessions
   */
  static async getSessions(req, res) {
    try {
      const userId = req.auth.userId;
      const { page = 1, limit = 20, status, role } = req.query;

      let result;
      
      if (role === 'reader') {
        const reader = await Reader.findByUserId(userId);
        if (!reader) {
          return errorResponse(res, 'Reader profile not found', 404);
        }
        result = await Session.getReaderSessions(reader.id, {
          page: parseInt(page),
          limit: parseInt(limit),
          status: status || null
        });
      } else {
        result = await Session.getClientSessions(userId, {
          page: parseInt(page),
          limit: parseInt(limit),
          status: status || null
        });
      }

      return paginatedResponse(res, result.sessions, result.pagination);

    } catch (error) {
      logger.error('Error getting sessions', { error: error.message });
      return errorResponse(res, 'Failed to get sessions', 500);
    }
  }

  /**
   * Process session payment
   * @private
   */
  static async processSessionPayment(session) {
    try {
      const totalAmount = session.totalCharged;
      const platformFee = totalAmount * 0.30; // 30% platform fee
      const readerEarnings = totalAmount - platformFee;

      // Deduct from client balance
      await User.deductBalance(session.clientId, totalAmount);

      // Create transaction for client
      await Transaction.create({
        user_id: session.clientId,
        reader_id: session.readerId,
        session_id: session.id,
        type: Transaction.TYPES.READING_PAYMENT,
        amount: totalAmount,
        status: Transaction.STATUSES.COMPLETED,
        description: `${session.type} reading - ${session.durationMinutes} minutes`
      });

      // Create transaction for reader
      await Transaction.create({
        user_id: session.readerUserId,
        reader_id: session.readerId,
        session_id: session.id,
        type: Transaction.TYPES.READING_PAYMENT,
        amount: readerEarnings,
        platform_fee: platformFee,
        status: Transaction.STATUSES.COMPLETED,
        description: `Earnings from ${session.type} reading`
      });

      // Update reader earnings
      await Reader.addEarnings(session.readerId, readerEarnings);

      // Send payment notifications
      await Notification.create({
        user_id: session.clientId,
        type: Notification.TYPES.PAYMENT_SENT,
        title: 'Payment Processed',
        content: `$${totalAmount.toFixed(2)} charged for your reading session`,
        target_type: 'session',
        target_id: session.id
      });

      await Notification.create({
        user_id: session.readerUserId,
        type: Notification.TYPES.PAYMENT_RECEIVED,
        title: 'Payment Received',
        content: `You earned $${readerEarnings.toFixed(2)} from your reading session`,
        target_type: 'session',
        target_id: session.id
      });

      return {
        totalCharged: totalAmount,
        platformFee,
        readerEarnings
      };

    } catch (error) {
      logger.error('Error processing session payment', { error: error.message });
      throw error;
    }
  }

  /**
   * Update session notes (reader only)
   * PUT /api/sessions/:sessionId/notes
   */
  static async updateNotes(req, res) {
    try {
      const userId = req.auth.userId;
      const { sessionId } = req.params;
      const { notes } = req.body;

      const session = await Session.findById(sessionId);
      if (!session) {
        return errorResponse(res, 'Session not found', 404);
      }

      // Verify user is the reader
      const reader = await Reader.findById(session.readerId);
      if (!reader || reader.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      await Session.update(sessionId, { reader_notes: notes });

      return successResponse(res, {
        message: 'Notes updated successfully'
      });

    } catch (error) {
      logger.error('Error updating notes', { error: error.message });
      return errorResponse(res, 'Failed to update notes', 500);
    }
  }

  /**
   * Get session statistics
   * GET /api/sessions/stats
   */
  static async getStats(req, res) {
    try {
      const userId = req.auth.userId;
      const { role, start_date, end_date } = req.query;

      let stats;
      
      if (role === 'reader') {
        const reader = await Reader.findByUserId(userId);
        if (!reader) {
          return errorResponse(res, 'Reader profile not found', 404);
        }
        stats = await Session.getReaderStatistics(reader.id, {
          startDate: start_date ? new Date(start_date) : undefined,
          endDate: end_date ? new Date(end_date) : undefined
        });
      } else {
        stats = await Session.getClientStatistics(userId, {
          startDate: start_date ? new Date(start_date) : undefined,
          endDate: end_date ? new Date(end_date) : undefined
        });
      }

      return successResponse(res, { stats });

    } catch (error) {
      logger.error('Error getting session stats', { error: error.message });
      return errorResponse(res, 'Failed to get statistics', 500);
    }
  }
}

module.exports = SessionController;