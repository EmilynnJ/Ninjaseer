/**
 * Session Model
 * Handles all reading session operations
 */

import { query, transaction } from '../config/database.js';

class Session {
  /**
   * Create a new reading session
   */
  static async create({
    clientId,
    readerId,
    sessionType,
    ratePerMinute,
    agoraChannelName,
    agoraToken,
    agoraRtmToken
  }) {
    const result = await query(
      `INSERT INTO reading_sessions (
        client_id, reader_id, session_type, rate_per_minute,
        agora_channel_name, agora_token, agora_rtm_token,
        status, started_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW(), NOW(), NOW())
      RETURNING *`,
      [clientId, readerId, sessionType, ratePerMinute, agoraChannelName, agoraToken, agoraRtmToken]
    );
    return result.rows[0];
  }

  /**
   * Find session by ID
   */
  static async findById(sessionId) {
    const result = await query(
      `SELECT s.*,
              c.email as client_email,
              c.display_name as client_name,
              r.display_name as reader_name,
              r.profile_picture_url as reader_picture
       FROM reading_sessions s
       JOIN users c ON s.client_id = c.id
       JOIN reader_profiles r ON s.reader_id = r.user_id
       WHERE s.id = $1`,
      [sessionId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update session
   */
  static async update(sessionId, updates) {
    const allowedFields = [
      'status', 'ended_at', 'duration_minutes', 
      'total_cost', 'client_rating', 'client_review'
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

    return result.rows[0] || null;
  }

  /**
   * End a session
   */
  static async end(sessionId, durationMinutes) {
    return await transaction(async (client) => {
      // Get session details
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

      // Calculate total cost
      const totalCost = parseFloat(session.rate_per_minute) * durationMinutes;

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
        [durationMinutes, totalCost, sessionId]
      );

      // Deduct from client balance
      await client.query(
        `UPDATE users 
         SET balance = balance - $1,
             updated_at = NOW()
         WHERE id = $2`,
        [totalCost, session.client_id]
      );

      // Calculate reader earnings (70% of total)
      const readerEarnings = totalCost * 0.7;

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
          user_id, reader_id, session_id, amount, type, status, created_at
        )
        VALUES 
          ($1, $2, $3, $4, 'session_payment', 'completed', NOW()),
          ($5, $2, $3, $6, 'session_earning', 'completed', NOW())`,
        [session.client_id, session.reader_id, sessionId, totalCost, 
         session.reader_id, readerEarnings]
      );

      // Update reader stats
      await client.query(
        `UPDATE reader_profiles 
         SET total_sessions = total_sessions + 1,
             updated_at = NOW()
         WHERE user_id = $1`,
        [session.reader_id]
      );

      return updatedSession.rows[0];
    });
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
              r.display_name as reader_name,
              r.profile_picture_url as reader_picture
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
   * Get session history for user
   */
  static async getHistory(userId, { limit = 20, offset = 0, role = 'client' }) {
    const column = role === 'client' ? 'client_id' : 'reader_id';
    
    const result = await query(
      `SELECT s.*,
              c.email as client_email,
              c.display_name as client_name,
              r.display_name as reader_name,
              r.profile_picture_url as reader_picture,
              COUNT(*) OVER() as total_count
       FROM reading_sessions s
       JOIN users c ON s.client_id = c.id
       JOIN reader_profiles r ON s.reader_id = r.user_id
       WHERE s.${column} = $1
       ORDER BY s.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      sessions: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

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
        COALESCE(SUM(duration_minutes), 0) as total_minutes,
        COALESCE(SUM(total_cost), 0) as total_spent,
        COALESCE(AVG(duration_minutes), 0) as avg_duration,
        COALESCE(AVG(total_cost), 0) as avg_cost
       FROM reading_sessions
       WHERE ${column} = $1`,
      [userId]
    );

    return result.rows[0];
  }

  /**
   * Cancel a session
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

      if (session.status !== 'active') {
        throw new Error('Session is not active');
      }

      // Calculate duration up to cancellation
      const startTime = new Date(session.started_at);
      const now = new Date();
      const durationMinutes = Math.ceil((now - startTime) / (1000 * 60));

      // Calculate cost for time used
      const costForTimeUsed = parseFloat(session.rate_per_minute) * durationMinutes;

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

      // Process refund/payment based on cancellation policy
      if (durationMinutes > 0) {
        // Charge for time used
        await client.query(
          `UPDATE users 
           SET balance = balance - $1,
               updated_at = NOW()
           WHERE id = $2`,
          [costForTimeUsed, session.client_id]
        );

        const readerEarnings = costForTimeUsed * 0.7;
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
            user_id, reader_id, session_id, amount, type, status, created_at
          )
          VALUES 
            ($1, $2, $3, $4, 'session_payment', 'completed', NOW()),
            ($5, $2, $3, $6, 'session_earning', 'completed', NOW())`,
          [session.client_id, session.reader_id, sessionId, costForTimeUsed,
           session.reader_id, readerEarnings]
        );
      }

      return updatedSession.rows[0];
    });
  }

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
   * Get all sessions (admin)
   */
  static async findAll({ limit = 50, offset = 0, status = null }) {
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
}

export default Session;