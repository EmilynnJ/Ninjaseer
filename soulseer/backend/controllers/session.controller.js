/**
 * Session Controller
 * Handles reading session business logic
 */

import Session from '../models/Session.js';
import Reader from '../models/Reader.js';
import User from '../models/User.js';
import agoraService from '../services/agora.service.js';

class SessionController {
  /**
   * Start a new reading session
   */
  static async startSession(req, res) {
    try {
      const { readerId, sessionType } = req.body;
      const clientId = req.dbUserId;

      // Validate session type
      if (!['chat', 'call', 'video'].includes(sessionType)) {
        return res.status(400).json({ error: 'Invalid session type' });
      }

      // Get reader profile
      const reader = await Reader.findByUserId(readerId);

      if (!reader) {
        return res.status(404).json({ error: 'Reader not found' });
      }

      // Check reader availability
      if (!reader.is_online || reader.status !== 'online') {
        return res.status(400).json({ error: 'Reader is not available' });
      }

      // Get rate for session type
      const ratePerMinute = parseFloat(reader[`${sessionType}_rate`]);

      // Check client balance (require at least 5 minutes worth)
      const clientBalance = await User.getBalance(clientId);
      const minimumRequired = ratePerMinute * 5;

      if (clientBalance < minimumRequired) {
        return res.status(400).json({
          error: 'Insufficient balance',
          currentBalance: clientBalance,
          required: minimumRequired,
          message: `You need at least $${minimumRequired.toFixed(2)} to start this session`
        });
      }

      // Generate Agora tokens
      const channelName = `session_${Date.now()}_${clientId}_${readerId}`;
      const agoraToken = await agoraService.generateRTCToken(channelName, clientId);
      const agoraRtmToken = await agoraService.generateRTMToken(clientId.toString());

      // Create session
      const session = await Session.create({
        clientId,
        readerId,
        sessionType,
        ratePerMinute,
        agoraChannelName: channelName,
        agoraToken,
        agoraRtmToken
      });

      res.status(201).json({
        session,
        agora: {
          appId: process.env.AGORA_APP_ID,
          channelName,
          token: agoraToken,
          rtmToken: agoraRtmToken,
          uid: clientId
        },
        message: 'Session started successfully'
      });
    } catch (error) {
      console.error('Error in startSession:', error);
      res.status(500).json({ error: 'Failed to start session' });
    }
  }

  /**
   * End a reading session
   */
  static async endSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { durationMinutes } = req.body;
      const userId = req.dbUserId;

      if (!durationMinutes || durationMinutes < 0) {
        return res.status(400).json({ error: 'Invalid duration' });
      }

      // Get session
      const existingSession = await Session.findById(sessionId);

      if (!existingSession) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Verify user is part of this session
      if (existingSession.client_id !== userId && existingSession.reader_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // End session
      const session = await Session.end(sessionId, durationMinutes);

      res.json({
        session,
        message: 'Session ended successfully'
      });
    } catch (error) {
      console.error('Error in endSession:', error);
      res.status(500).json({ error: error.message || 'Failed to end session' });
    }
  }

  /**
   * Get session by ID
   */
  static async getSessionById(req, res) {
    try {
      const { sessionId } = req.params;
      const userId = req.dbUserId;

      const session = await Session.findById(sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Verify user is part of this session
      if (session.client_id !== userId && session.reader_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      res.json({ session });
    } catch (error) {
      console.error('Error in getSessionById:', error);
      res.status(500).json({ error: 'Failed to get session' });
    }
  }

  /**
   * Get active session for user
   */
  static async getActiveSession(req, res) {
    try {
      const userId = req.dbUserId;
      const role = req.userRole === 'reader' ? 'reader' : 'client';

      const session = await Session.getActiveSession(userId, role);

      if (!session) {
        return res.json({ session: null, message: 'No active session' });
      }

      // Generate fresh Agora tokens
      const agoraToken = await agoraService.generateRTCToken(
        session.agora_channel_name,
        userId
      );
      const agoraRtmToken = await agoraService.generateRTMToken(userId.toString());

      res.json({
        session,
        agora: {
          appId: process.env.AGORA_APP_ID,
          channelName: session.agora_channel_name,
          token: agoraToken,
          rtmToken: agoraRtmToken,
          uid: userId
        }
      });
    } catch (error) {
      console.error('Error in getActiveSession:', error);
      res.status(500).json({ error: 'Failed to get active session' });
    }
  }

  /**
   * Get session history
   */
  static async getSessionHistory(req, res) {
    try {
      const userId = req.dbUserId;
      const { limit = 20, offset = 0 } = req.query;
      const role = req.userRole === 'reader' ? 'reader' : 'client';

      const result = await Session.getHistory(userId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        role
      });

      res.json(result);
    } catch (error) {
      console.error('Error in getSessionHistory:', error);
      res.status(500).json({ error: 'Failed to get session history' });
    }
  }

  /**
   * Get session statistics
   */
  static async getSessionStats(req, res) {
    try {
      const userId = req.dbUserId;
      const role = req.userRole === 'reader' ? 'reader' : 'client';

      const stats = await Session.getStats(userId, role);

      res.json({ stats });
    } catch (error) {
      console.error('Error in getSessionStats:', error);
      res.status(500).json({ error: 'Failed to get session statistics' });
    }
  }

  /**
   * Cancel a session
   */
  static async cancelSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { reason } = req.body;
      const userId = req.dbUserId;

      // Get session
      const existingSession = await Session.findById(sessionId);

      if (!existingSession) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Verify user is part of this session
      if (existingSession.client_id !== userId && existingSession.reader_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Determine who cancelled
      const cancelledBy = existingSession.client_id === userId ? 'client' : 'reader';

      // Cancel session
      const session = await Session.cancel(sessionId, cancelledBy, reason);

      res.json({
        session,
        message: 'Session cancelled successfully'
      });
    } catch (error) {
      console.error('Error in cancelSession:', error);
      res.status(500).json({ error: error.message || 'Failed to cancel session' });
    }
  }

  /**
   * Add review to session
   */
  static async addReview(req, res) {
    try {
      const { sessionId } = req.params;
      const { rating, reviewText } = req.body;
      const userId = req.dbUserId;

      // Validate rating
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }

      // Get session
      const existingSession = await Session.findById(sessionId);

      if (!existingSession) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Verify user is the client
      if (existingSession.client_id !== userId) {
        return res.status(403).json({ error: 'Only clients can review sessions' });
      }

      // Add review
      await Session.addReview(sessionId, { rating, reviewText });

      res.json({ message: 'Review submitted successfully' });
    } catch (error) {
      console.error('Error in addReview:', error);
      res.status(500).json({ error: error.message || 'Failed to submit review' });
    }
  }

  /**
   * Get all sessions (admin only)
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
      console.error('Error in getAllSessions:', error);
      res.status(500).json({ error: 'Failed to get sessions' });
    }
  }
}

export default SessionController;