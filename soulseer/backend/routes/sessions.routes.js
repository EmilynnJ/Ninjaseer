import express from 'express';
import { requireAuth, requireClient, requireReader } from '../middleware/auth.js';
import agoraService from '../services/agora.service.js';
import stripeService from '../services/stripe.service.js';
import { query, transaction } from '../config/database.js';

const router = express.Router();

// Start a new reading session
router.post('/start', requireAuth, requireClient, async (req, res) => {
  try {
    const { readerId, sessionType } = req.body;
    const clientId = req.dbUserId;

    // Validate session type
    if (!['chat', 'call', 'video'].includes(sessionType)) {
      return res.status(400).json({ error: 'Invalid session type' });
    }

    // Get reader's rate for this session type
    const readerResult = await query(
      `SELECT ${sessionType}_rate as rate, is_online, status, user_id 
       FROM reader_profiles 
       WHERE user_id = $1`,
      [readerId]
    );

    if (readerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Reader not found' });
    }

    const reader = readerResult.rows[0];

    if (!reader.is_online || reader.status !== 'online') {
      return res.status(400).json({ error: 'Reader is not available' });
    }

    const ratePerMinute = parseFloat(reader.rate);

    // Check client balance (require at least 5 minutes worth)
    const balanceCheck = await agoraService.checkBalance(clientId, 5, ratePerMinute);

    if (!balanceCheck.hasBalance) {
      return res.status(400).json({ 
        error: 'Insufficient balance',
        currentBalance: balanceCheck.currentBalance,
        required: balanceCheck.estimatedCost
      });
    }

    // Create session with Agora
    const sessionData = agoraService.createReadingSession(
      clientId,
      readerId,
      sessionType,
      ratePerMinute
    );

    // Save to database
    const dbResult = await query(
      `INSERT INTO reading_sessions 
       (id, client_id, reader_id, session_type, rate_per_minute, start_time, room_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        sessionData.session.sessionId,
        clientId,
        readerId,
        sessionType,
        ratePerMinute,
        sessionData.session.startTime,
        sessionData.session.channelName,
        'active'
      ]
    );

    res.json({
      success: true,
      session: dbResult.rows[0],
      agora: {
        appId: sessionData.clientTokens.rtc.appId,
        channelName: sessionData.session.channelName,
        rtcToken: sessionData.clientTokens.rtc.token,
        rtmToken: sessionData.clientTokens.rtm.token,
        uid: sessionData.clientTokens.rtc.uid
      }
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Failed to start session', details: error.message });
  }
});

// Get session tokens (for reader joining)
router.get('/:sessionId/tokens', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.dbUserId;

    // Get session from database
    const sessionResult = await query(
      'SELECT * FROM reading_sessions WHERE id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const dbSession = sessionResult.rows[0];

    // Verify user is part of this session
    if (dbSession.client_id !== userId && dbSession.reader_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Generate tokens
    const uid = parseInt(userId.replace(/-/g, '').substring(0, 8), 16);
    const rtcToken = agoraService.generateRTCToken(dbSession.room_id, uid, 'publisher');
    const rtmToken = agoraService.generateRTMToken(userId);

    res.json({
      agora: {
        appId: rtcToken.appId,
        channelName: dbSession.room_id,
        rtcToken: rtcToken.token,
        rtmToken: rtmToken.token,
        uid: rtcToken.uid
      }
    });
  } catch (error) {
    console.error('Error getting tokens:', error);
    res.status(500).json({ error: 'Failed to get tokens' });
  }
});

// End a reading session
router.post('/end/:sessionId', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.dbUserId;

    // Get session from database
    const sessionResult = await query(
      'SELECT * FROM reading_sessions WHERE id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const dbSession = sessionResult.rows[0];

    // Verify user is part of this session
    if (dbSession.client_id !== userId && dbSession.reader_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // End session in Agora service
    const endedSession = agoraService.endSession(sessionId);

    // Calculate revenue split
    const revenueSplit = stripeService.calculateRevenueSplit(endedSession.totalCost);

    // Update database with transaction
    await transaction(async (client) => {
      // Update session
      await client.query(
        `UPDATE reading_sessions 
         SET end_time = $1, duration_minutes = $2, total_cost = $3, 
             reader_earnings = $4, platform_fee = $5, status = $6,
             chat_transcript = $7
         WHERE id = $8`,
        [
          endedSession.endTime,
          endedSession.durationMinutes,
          endedSession.totalCost,
          revenueSplit.readerEarnings,
          revenueSplit.platformFee,
          'completed',
          JSON.stringify(endedSession.chatMessages),
          sessionId
        ]
      );

      // Deduct from client balance
      await client.query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2',
        [endedSession.totalCost, dbSession.client_id]
      );

      // Add to reader earnings
      await client.query(
        `UPDATE reader_profiles 
         SET pending_payout = pending_payout + $1,
             total_earnings = total_earnings + $1
         WHERE user_id = $2`,
        [revenueSplit.readerEarnings, dbSession.reader_id]
      );

      // Create transaction records
      await client.query(
        `INSERT INTO transactions 
         (user_id, transaction_type, amount, balance_after, description, metadata)
         VALUES 
         ($1, 'reading_charge', $2, (SELECT balance FROM users WHERE id = $1), $3, $4)`,
        [
          dbSession.client_id,
          endedSession.totalCost,
          `Reading session charge - ${endedSession.durationMinutes} minutes`,
          JSON.stringify({ sessionId, sessionType: dbSession.session_type })
        ]
      );
    });

    res.json({
      success: true,
      session: {
        sessionId,
        durationMinutes: endedSession.durationMinutes,
        totalCost: endedSession.totalCost,
        readerEarnings: revenueSplit.readerEarnings,
        platformFee: revenueSplit.platformFee
      }
    });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session', details: error.message });
  }
});

// Get session details
router.get('/:sessionId', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.dbUserId;

    const result = await query(
      `SELECT s.*, 
              c.email as client_email,
              r.display_name as reader_name
       FROM reading_sessions s
       JOIN users c ON s.client_id = c.id
       JOIN reader_profiles r ON s.reader_id = r.user_id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = result.rows[0];

    // Verify user is part of this session
    if (session.client_id !== userId && session.reader_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({ session });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Get user's session history
router.get('/history/me', requireAuth, async (req, res) => {
  try {
    const userId = req.dbUserId;
    const { limit = 20, offset = 0 } = req.query;

    const result = await query(
      `SELECT s.*, 
              CASE 
                WHEN s.client_id = $1 THEN r.display_name
                ELSE c.email
              END as other_party_name
       FROM reading_sessions s
       LEFT JOIN reader_profiles r ON s.reader_id = r.user_id
       LEFT JOIN users c ON s.client_id = c.id
       WHERE s.client_id = $1 OR s.reader_id = $1
       ORDER BY s.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({ sessions: result.rows });
  } catch (error) {
    console.error('Error getting session history:', error);
    res.status(500).json({ error: 'Failed to get session history' });
  }
});

// Submit session review
router.post('/:sessionId/review', requireAuth, requireClient, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { rating, reviewText } = req.body;
    const clientId = req.dbUserId;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Get session
    const sessionResult = await query(
      'SELECT * FROM reading_sessions WHERE id = $1 AND client_id = $2',
      [sessionId, clientId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Check if already reviewed
    const existingReview = await query(
      'SELECT id FROM session_reviews WHERE session_id = $1',
      [sessionId]
    );

    if (existingReview.rows.length > 0) {
      return res.status(400).json({ error: 'Session already reviewed' });
    }

    // Create review
    await transaction(async (client) => {
      // Insert review
      await client.query(
        `INSERT INTO session_reviews 
         (session_id, client_id, reader_id, rating, review_text)
         VALUES ($1, $2, $3, $4, $5)`,
        [sessionId, clientId, session.reader_id, rating, reviewText]
      );

      // Update reader's average rating
      await client.query(
        `UPDATE reader_profiles 
         SET average_rating = (
           SELECT AVG(rating) FROM session_reviews WHERE reader_id = $1
         ),
         total_reviews = total_reviews + 1
         WHERE user_id = $1`,
        [session.reader_id]
      );
    });

    res.json({ success: true, message: 'Review submitted successfully' });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

export default router;