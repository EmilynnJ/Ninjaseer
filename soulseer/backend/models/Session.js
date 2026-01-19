/**
 * Session Model - COMPLETE IMPLEMENTATION
 * Comprehensive reading session management with full lifecycle
 * NO SHORTCUTS - FULL PRODUCTION CODE
 */

import { query, transaction } from '../config/database.js';

class Session {
  /**
   * ============================================================================
   * CREATE OPERATIONS
   * ============================================================================
   */

  /**
   * Create a new reading session with complete validation
   */
  static async create({
    clientId,
    readerId,
    sessionType,
    ratePerMinute,
    agoraChannelName,
    agoraToken,
    agoraRtmToken,
    scheduledStartTime = null,
    estimatedDuration = null,
    specialRequests = null
  }) {
    // Validate session type
    const validTypes = ['chat', 'call', 'video'];
    if (!validTypes.includes(sessionType)) {
      throw new Error('Invalid session type. Must be chat, call, or video');
    }

    // Validate rate
    if (ratePerMinute < 0.5 || ratePerMinute > 100) {
      throw new Error('Rate per minute must be between $0.50 and $100');
    }

    // Validate required fields
    if (!clientId || !readerId || !agoraChannelName || !agoraToken) {
      throw new Error('Missing required fields');
    }

    // Check if client has active session
    const activeClientSession = await this.getActiveSession(clientId, 'client');
    if (activeClientSession) {
      throw new Error('Client already has an active session');
    }

    // Check if reader has active session
    const activeReaderSession = await this.getActiveSession(readerId, 'reader');
    if (activeReaderSession) {
      throw new Error('Reader already has an active session');
    }

    const result = await query(
      `INSERT INTO reading_sessions (
        client_id, reader_id, session_type, rate_per_minute,
        agora_channel_name, agora_token, agora_rtm_token,
        scheduled_start_time, estimated_duration, special_requests,
        status, started_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', NOW(), NOW(), NOW())
      RETURNING *`,
      [
        clientId, readerId, sessionType, ratePerMinute,
        agoraChannelName, agoraToken, agoraRtmToken,
        scheduledStartTime, estimatedDuration, specialRequests
      ]
    );

    return result.rows[0];
  }

  /**
   * Create scheduled session (for future booking)
   */
  static async createScheduled({
    clientId,
    readerId,
    sessionType,
    ratePerMinute,
    scheduledStartTime,
    estimatedDuration,
    specialRequests = null
  }) {
    // Validate scheduled time is in the future
    const scheduledTime = new Date(scheduledStartTime);
    if (scheduledTime <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }

    const result = await query(
      `INSERT INTO reading_sessions (
        client_id, reader_id, session_type, rate_per_minute,
        scheduled_start_time, estimated_duration, special_requests,
        status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', NOW(), NOW())
      RETURNING *`,
      [clientId, readerId, sessionType, ratePerMinute, scheduledStartTime, estimatedDuration, specialRequests]
    );

    return result.rows[0];
  }

  /**
   * ============================================================================
   * READ OPERATIONS
   * ============================================================================
   */

  /**
   * Find session by ID with complete details
   */
  static async findById(sessionId) {
    const result = await query(
      `SELECT s.*,
              c.email as client_email,
              c.display_name as client_name,
              c.profile_picture_url as client_picture,
              r.display_name as reader_name,
              r.profile_picture_url as reader_picture,
              r.average_rating as reader_rating,
              r.total_reviews as reader_reviews,
              sr.rating as session_rating,
              sr.review_text as session_review
       FROM reading_sessions s
       JOIN users c ON s.client_id = c.id
       JOIN reader_profiles r ON s.reader_id = r.user_id
       LEFT JOIN session_reviews sr ON s.id = sr.session_id
       WHERE s.id = $1`,
      [sessionId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find session with transaction lock
   */
  static async findByIdForUpdate(client, sessionId) {
    const result = await client.query(
      'SELECT * FROM reading_sessions WHERE id = $1 FOR UPDATE',
      [sessionId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get active session for user
   */
  static async getActiveSession(userId, role = 'client') {
    const column = role === 'client' ? 'client_id' : 'reader_id';
    
    const result = await query(
      `SELECT s.*,
              c.email as client_email,
              c.display_name as client_name,
              c.profile_picture_url as client_picture,
              r.display_name as reader_name,
              r.profile_picture_url as reader_picture,
              r.average_rating as reader_rating
       FROM reading_sessions s
       JOIN users c ON s.client_id = c.id
       JOIN reader_profiles r ON s.reader_id = r.user_id
       WHERE s.${column} = $1 AND s.status = 'active'
       ORDER BY s.started_at DESC
       LIMIT 1`,
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get all active sessions (for monitoring)
   */
  static async getAllActiveSessions({ limit = 100, offset = 0 }) {
    const result = await query(
      `SELECT s.*,
              c.display_name as client_name,
              r.display_name as reader_name,
              EXTRACT(EPOCH FROM (NOW() - s.started_at))/60 as current_duration_minutes,
              COUNT(*) OVER() as total_count
       FROM reading_sessions s
       JOIN users c ON s.client_id = c.id
       JOIN reader_profiles r ON s.reader_id = r.user_id
       WHERE s.status = 'active'
       ORDER BY s.started_at ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return {
      sessions: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * ============================================================================
   * UPDATE OPERATIONS
   * ============================================================================
   */

  /**
   * Update session
   */
  static async update(sessionId, updates) {
    const allowedFields = [
      'status', 'ended_at', 'duration_minutes', 'total_cost',
      'cancelled_by', 'cancellation_reason', 'client_rating',
      'client_review', 'reader_notes', 'session_notes'
    ];
    
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [sessionId, ...fields.map(field => updates[field])];

    const result = await query(
      `UPDATE reading_sessions 
       SET ${setClause}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Session not found');
    }

    return result.rows[0];
  }

  /**
   * Start a scheduled session
   */
  static async startScheduledSession(sessionId, agoraChannelName, agoraToken, agoraRtmToken) {
    const result = await query(
      `UPDATE reading_sessions 
       SET status = 'active',
           started_at = NOW(),
           agora_channel_name = $2,
           agora_token = $3,
           agora_rtm_token = $4,
           updated_at = NOW()
       WHERE id = $1 AND status = 'scheduled'
       RETURNING *`,
      [sessionId, agoraChannelName, agoraToken, agoraRtmToken]
    );

    if (result.rows.length === 0) {
      throw new Error('Session not found or not in scheduled status');
    }

    return result.rows[0];
  }

  /**
   * ============================================================================
   * END SESSION OPERATIONS
   * ============================================================================
   */

  /**
   * End a session with complete payment processing
   */
  static async end(sessionId, durationMinutes) {
    return await transaction(async (client) => {
      // Get and lock session
      const sessionResult = await client.query(
        'SELECT * FROM reading_sessions WHERE id = $1 FOR UPDATE',
        [sessionId]
      );

      if (sessionResult.rows.length === 0) {
        throw new Error('Session not found');
      }

      const session = sessionResult.rows[0];

      if (session.status !== 'active') {
        throw new Error('Session is not active');
      }

      // Validate duration
      if (durationMinutes < 1) {
        throw new Error('Duration must be at least 1 minute');
      }

      // Calculate total cost
      const totalCost = parseFloat(session.rate_per_minute) * durationMinutes;
      const roundedCost = Math.round(totalCost * 100) / 100;

      // Update session
      const updatedSession = await client.query(
        `UPDATE reading_sessions 
         SET status = 'completed',
             ended_at = NOW(),
             duration_minutes = $1,
             total_cost = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [durationMinutes, roundedCost, sessionId]
      );

      // Get client balance
      const clientResult = await client.query(
        'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
        [session.client_id]
      );

      const clientBalance = parseFloat(clientResult.rows[0].balance);

      if (clientBalance < roundedCost) {
        throw new Error('Insufficient client balance');
      }

      // Deduct from client balance
      await client.query(
        `UPDATE users 
         SET balance = balance - $1,
             updated_at = NOW()
         WHERE id = $2`,
        [roundedCost, session.client_id]
      );

      // Calculate reader earnings (70% of total)
      const readerEarnings = Math.round(roundedCost * 0.7 * 100) / 100;
      const platformFee = Math.round(roundedCost * 0.3 * 100) / 100;

      // Add to reader balance
      await client.query(
        `UPDATE users 
         SET balance = balance + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [readerEarnings, session.reader_id]
      );

      // Create transaction records
      await client.query(
        `INSERT INTO transactions (
          user_id, reader_id, session_id, amount, type, status, 
          metadata, created_at, updated_at
        )
        VALUES 
          ($1, $2, $3, $4, 'session_payment', 'completed', $5, NOW(), NOW()),
          ($6, $2, $3, $7, 'session_earning', 'completed', $8, NOW(), NOW())`,
        [
          session.client_id, session.reader_id, sessionId, roundedCost,
          JSON.stringify({ duration_minutes: durationMinutes, rate_per_minute: session.rate_per_minute }),
          session.reader_id, readerEarnings,
          JSON.stringify({ 
            duration_minutes: durationMinutes, 
            rate_per_minute: session.rate_per_minute,
            platform_fee: platformFee 
          })
        ]
      );

      // Update reader stats
      await client.query(
        `UPDATE reader_profiles 
         SET total_sessions = total_sessions + 1,
             total_earnings = total_earnings + $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [readerEarnings, session.reader_id]
      );

      // Update completion rate
      await client.query(
        `UPDATE reader_profiles 
         SET completion_rate = (
           SELECT CASE 
             WHEN COUNT(*) = 0 THEN 0
             ELSE (COUNT(CASE WHEN status = 'completed' THEN 1 END)::float / COUNT(*)::float * 100)
           END
           FROM reading_sessions 
           WHERE reader_id = $1
         )
         WHERE user_id = $1`,
        [session.reader_id]
      );

      return updatedSession.rows[0];
    });
  }

  /**
   * ============================================================================
   * CANCEL SESSION OPERATIONS
   * ============================================================================
   */

  /**
   * Cancel a session with refund logic
   */
  static async cancel(sessionId, cancelledBy, reason = null) {
    return await transaction(async (client) => {
      const sessionResult = await client.query(
        'SELECT * FROM reading_sessions WHERE id = $1 FOR UPDATE',
        [sessionId]
      );

      if (sessionResult.rows.length === 0) {
        throw new Error('Session not found');
      }

      const session = sessionResult.rows[0];

      if (session.status !== 'active' && session.status !== 'scheduled') {
        throw new Error('Session cannot be cancelled');
      }

      let durationMinutes = 0;
      let costForTimeUsed = 0;

      // If session was active, calculate time used
      if (session.status === 'active' && session.started_at) {
        const startTime = new Date(session.started_at);
        const now = new Date();
        durationMinutes = Math.ceil((now - startTime) / (1000 * 60));
        
        // Minimum 1 minute charge if session was started
        if (durationMinutes < 1) {
          durationMinutes = 1;
        }

        costForTimeUsed = Math.round(parseFloat(session.rate_per_minute) * durationMinutes * 100) / 100;
      }

      // Update session
      const updatedSession = await client.query(
        `UPDATE reading_sessions 
         SET status = 'cancelled',
             ended_at = NOW(),
             duration_minutes = $1,
             total_cost = $2,
             cancelled_by = $3,
             cancellation_reason = $4,
             updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [durationMinutes, costForTimeUsed, cancelledBy, reason, sessionId]
      );

      // Process payment/refund based on cancellation policy
      if (costForTimeUsed > 0) {
        // Charge for time used
        await client.query(
          `UPDATE users 
           SET balance = balance - $1,
               updated_at = NOW()
           WHERE id = $2`,
          [costForTimeUsed, session.client_id]
        );

        const readerEarnings = Math.round(costForTimeUsed * 0.7 * 100) / 100;
        await client.query(
          `UPDATE users 
           SET balance = balance + $1,
               updated_at = NOW()
           WHERE id = $2`,
          [readerEarnings, session.reader_id]
        );

        // Create transaction records
        await client.query(
          `INSERT INTO transactions (
            user_id, reader_id, session_id, amount, type, status, 
            metadata, created_at, updated_at
          )
          VALUES 
            ($1, $2, $3, $4, 'session_payment', 'completed', $5, NOW(), NOW()),
            ($6, $2, $3, $7, 'session_earning', 'completed', $8, NOW(), NOW())`,
          [
            session.client_id, session.reader_id, sessionId, costForTimeUsed,
            JSON.stringify({ 
              cancelled: true, 
              cancelled_by: cancelledBy,
              duration_minutes: durationMinutes 
            }),
            session.reader_id, readerEarnings,
            JSON.stringify({ 
              cancelled: true,
              duration_minutes: durationMinutes 
            })
          ]
        );
      }

      return updatedSession.rows[0];
    });
  }

  /**
   * ============================================================================
   * REVIEW OPERATIONS
   * ============================================================================
   */

  /**
   * Add review to session
   */
  static async addReview(sessionId, { rating, reviewText }) {
    return await transaction(async (client) => {
      // Get session
      const sessionResult = await client.query(
        'SELECT * FROM reading_sessions WHERE id = $1',
        [sessionId]
      );

      if (sessionResult.rows.length === 0) {
        throw new Error('Session not found');
      }

      const session = sessionResult.rows[0];

      if (session.status !== 'completed') {
        throw new Error('Can only review completed sessions');
      }

      // Check if already reviewed
      const existingReview = await client.query(
        'SELECT id FROM session_reviews WHERE session_id = $1',
        [sessionId]
      );

      if (existingReview.rows.length > 0) {
        throw new Error('Session already reviewed');
      }

      // Validate rating
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      // Create review
      await client.query(
        `INSERT INTO session_reviews (
          session_id, client_id, reader_id, rating, review_text, created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())`,
        [sessionId, session.client_id, session.reader_id, rating, reviewText]
      );

      // Update reader stats
      await client.query(
        `UPDATE reader_profiles 
         SET average_rating = (
           SELECT AVG(rating) FROM session_reviews WHERE reader_id = $1
         ),
         total_reviews = total_reviews + 1,
         updated_at = NOW()
         WHERE user_id = $1`,
        [session.reader_id]
      );

      return { success: true };
    });
  }

  /**
   * Get session review
   */
  static async getReview(sessionId) {
    const result = await query(
      `SELECT sr.*,
              u.display_name as client_name,
              u.profile_picture_url as client_picture
       FROM session_reviews sr
       JOIN users u ON sr.client_id = u.id
       WHERE sr.session_id = $1`,
      [sessionId]
    );
    return result.rows[0] || null;
  }

  /**
   * ============================================================================
   * QUERY OPERATIONS
   * ============================================================================
   */

  /**
   * Get session history for user
   */
  static async getHistory(userId, { 
    limit = 20, 
    offset = 0, 
    role = 'client',
    status = null,
    sessionType = null,
    startDate = null,
    endDate = null
  }) {
    const column = role === 'client' ? 'client_id' : 'reader_id';
    
    let queryText = `
      SELECT s.*,
             c.email as client_email,
             c.display_name as client_name,
             c.profile_picture_url as client_picture,
             r.display_name as reader_name,
             r.profile_picture_url as reader_picture,
             r.average_rating as reader_rating,
             sr.rating as session_rating,
             sr.review_text as session_review,
             COUNT(*) OVER() as total_count
      FROM reading_sessions s
      JOIN users c ON s.client_id = c.id
      JOIN reader_profiles r ON s.reader_id = r.user_id
      LEFT JOIN session_reviews sr ON s.id = sr.session_id
      WHERE s.${column} = $1
    `;
    const params = [userId];

    if (status) {
      params.push(status);
      queryText += ` AND s.status = $${params.length}`;
    }

    if (sessionType) {
      params.push(sessionType);
      queryText += ` AND s.session_type = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      queryText += ` AND s.created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      queryText += ` AND s.created_at <= $${params.length}`;
    }

    queryText += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    return {
      sessions: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Get upcoming scheduled sessions
   */
  static async getUpcomingSessions(userId, role = 'client', { limit = 10 }) {
    const column = role === 'client' ? 'client_id' : 'reader_id';
    
    const result = await query(
      `SELECT s.*,
              c.display_name as client_name,
              r.display_name as reader_name,
              r.profile_picture_url as reader_picture
       FROM reading_sessions s
       JOIN users c ON s.client_id = c.id
       JOIN reader_profiles r ON s.reader_id = r.user_id
       WHERE s.${column} = $1 
         AND s.status = 'scheduled'
         AND s.scheduled_start_time > NOW()
       ORDER BY s.scheduled_start_time ASC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  /**
   * Get all sessions (admin)
   */
  static async findAll({ 
    limit = 50, 
    offset = 0, 
    status = null,
    sessionType = null,
    startDate = null,
    endDate = null
  }) {
    let queryText = `
      SELECT s.*,
             c.email as client_email,
             c.display_name as client_name,
             r.display_name as reader_name,
             COUNT(*) OVER() as total_count
      FROM reading_sessions s
      JOIN users c ON s.client_id = c.id
      JOIN reader_profiles r ON s.reader_id = r.user_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      queryText += ` AND s.status = $${params.length}`;
    }

    if (sessionType) {
      params.push(sessionType);
      queryText += ` AND s.session_type = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      queryText += ` AND s.created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      queryText += ` AND s.created_at <= $${params.length}`;
    }

    queryText += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);
    
    return {
      sessions: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * ============================================================================
   * STATISTICS OPERATIONS
   * ============================================================================
   */

  /**
   * Get session statistics for user
   */
  static async getStats(userId, role = 'client') {
    const column = role === 'client' ? 'client_id' : 'reader_id';
    
    const result = await query(
      `SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_sessions,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_sessions,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_sessions,
        COALESCE(SUM(duration_minutes), 0) as total_minutes,
        COALESCE(SUM(total_cost), 0) as total_spent,
        COALESCE(AVG(duration_minutes), 0) as avg_duration,
        COALESCE(AVG(total_cost), 0) as avg_cost,
        COUNT(CASE WHEN session_type = 'chat' THEN 1 END) as chat_sessions,
        COUNT(CASE WHEN session_type = 'call' THEN 1 END) as call_sessions,
        COUNT(CASE WHEN session_type = 'video' THEN 1 END) as video_sessions
       FROM reading_sessions
       WHERE ${column} = $1`,
      [userId]
    );

    return result.rows[0];
  }

  /**
   * Get session statistics by date range
   */
  static async getStatsByDateRange(userId, role, startDate, endDate) {
    const column = role === 'client' ? 'client_id' : 'reader_id';
    
    const result = await query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as session_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
        COALESCE(SUM(duration_minutes), 0) as total_minutes,
        COALESCE(SUM(total_cost), 0) as total_cost
       FROM reading_sessions
       WHERE ${column} = $1
         AND created_at >= $2
         AND created_at <= $3
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [userId, startDate, endDate]
    );

    return result.rows;
  }

  /**
   * Get platform-wide session statistics
   */
  static async getPlatformStats({ startDate = null, endDate = null }) {
    let queryText = `
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_sessions,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_sessions,
        COALESCE(SUM(duration_minutes), 0) as total_minutes,
        COALESCE(SUM(total_cost), 0) as total_revenue,
        COALESCE(AVG(duration_minutes), 0) as avg_duration,
        COUNT(CASE WHEN session_type = 'chat' THEN 1 END) as chat_sessions,
        COUNT(CASE WHEN session_type = 'call' THEN 1 END) as call_sessions,
        COUNT(CASE WHEN session_type = 'video' THEN 1 END) as video_sessions
      FROM reading_sessions
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      params.push(startDate);
      queryText += ` AND created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      queryText += ` AND created_at <= $${params.length}`;
    }

    const result = await query(queryText, params);
    return result.rows[0];
  }

  /**
   * ============================================================================
   * VALIDATION & HELPERS
   * ============================================================================
   */

  /**
   * Validate session exists and user has access
   */
  static async validateAccess(sessionId, userId) {
    const session = await this.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    if (session.client_id !== userId && session.reader_id !== userId) {
      throw new Error('Unauthorized access to session');
    }
    return session;
  }

  /**
   * Check if user can start new session
   */
  static async canStartNewSession(userId, role = 'client') {
    const activeSession = await this.getActiveSession(userId, role);
    return !activeSession;
  }

  /**
   * Get session duration in real-time
   */
  static async getCurrentDuration(sessionId) {
    const session = await this.findById(sessionId);
    if (!session || session.status !== 'active' || !session.started_at) {
      return 0;
    }

    const startTime = new Date(session.started_at);
    const now = new Date();
    const durationMs = now - startTime;
    const durationMinutes = Math.ceil(durationMs / (1000 * 60));

    return durationMinutes;
  }

  /**
   * Calculate estimated cost for current session
   */
  static async getEstimatedCost(sessionId) {
    const session = await this.findById(sessionId);
    if (!session || session.status !== 'active') {
      return 0;
    }

    const durationMinutes = await this.getCurrentDuration(sessionId);
    const estimatedCost = parseFloat(session.rate_per_minute) * durationMinutes;

    return Math.round(estimatedCost * 100) / 100;
  }
}

export default Session;