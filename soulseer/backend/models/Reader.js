/**
 * Reader Model
 * Handles all reader profile operations
 */

import { query, transaction } from '../config/database.js';

class Reader {
  /**
   * Create a new reader profile
   */
  static async create({ 
    userId, 
    displayName, 
    bio, 
    specialties = [], 
    chatRate, 
    callRate, 
    videoRate,
    profilePictureUrl = null 
  }) {
    const result = await query(
      `INSERT INTO reader_profiles (
        user_id, display_name, bio, specialties, 
        chat_rate, call_rate, video_rate, profile_picture_url,
        is_online, status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, 'offline', NOW(), NOW())
      RETURNING *`,
      [userId, displayName, bio, specialties, chatRate, callRate, videoRate, profilePictureUrl]
    );
    return result.rows[0];
  }

  /**
   * Find reader by user ID
   */
  static async findByUserId(userId) {
    const result = await query(
      `SELECT r.*, u.email, u.clerk_id
       FROM reader_profiles r
       JOIN users u ON r.user_id = u.id
       WHERE r.user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find reader by ID
   */
  static async findById(id) {
    const result = await query(
      `SELECT r.*, u.email, u.clerk_id
       FROM reader_profiles r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Update reader profile
   */
  static async update(userId, updates) {
    const allowedFields = [
      'display_name', 'bio', 'specialties', 'profile_picture_url',
      'chat_rate', 'call_rate', 'video_rate', 'is_online', 'status'
    ];
    
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [userId, ...fields.map(field => updates[field])];

    const result = await query(
      `UPDATE reader_profiles 
       SET ${setClause}, updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Get all readers with filters
   */
  static async findAll({ 
    status = null, 
    specialty = null, 
    minRating = null,
    maxRate = null,
    limit = 50, 
    offset = 0,
    sortBy = 'created_at',
    sortOrder = 'DESC'
  }) {
    let queryText = `
      SELECT r.*, 
             u.email,
             COUNT(*) OVER() as total_count
      FROM reader_profiles r
      JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      queryText += ` AND r.status = $${params.length}`;
    }

    if (specialty) {
      params.push(specialty);
      queryText += ` AND $${params.length} = ANY(r.specialties)`;
    }

    if (minRating) {
      params.push(minRating);
      queryText += ` AND r.average_rating >= $${params.length}`;
    }

    if (maxRate) {
      params.push(maxRate);
      queryText += ` AND (r.chat_rate <= $${params.length} OR r.call_rate <= $${params.length} OR r.video_rate <= $${params.length})`;
    }

    // Validate sort column
    const validSortColumns = ['created_at', 'average_rating', 'total_sessions', 'chat_rate'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    queryText += ` ORDER BY r.${sortColumn} ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);
    
    return {
      readers: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Get online readers
   */
  static async findOnline({ limit = 50, offset = 0 }) {
    const result = await query(
      `SELECT r.*, 
              u.email,
              COUNT(*) OVER() as total_count
       FROM reader_profiles r
       JOIN users u ON r.user_id = u.id
       WHERE r.is_online = true AND r.status = 'online'
       ORDER BY r.average_rating DESC, r.total_sessions DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return {
      readers: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Update reader online status
   */
  static async updateOnlineStatus(userId, isOnline, status = null) {
    const updates = { is_online: isOnline };
    if (status) {
      updates.status = status;
    }

    return await this.update(userId, updates);
  }

  /**
   * Update reader statistics after session
   */
  static async updateStats(userId, { rating = null, sessionCompleted = false }) {
    return await transaction(async (client) => {
      if (sessionCompleted) {
        await client.query(
          `UPDATE reader_profiles 
           SET total_sessions = total_sessions + 1,
               updated_at = NOW()
           WHERE user_id = $1`,
          [userId]
        );
      }

      if (rating !== null) {
        await client.query(
          `UPDATE reader_profiles 
           SET average_rating = (
             SELECT AVG(rating) 
             FROM session_reviews 
             WHERE reader_id = $1
           ),
           total_reviews = total_reviews + 1,
           updated_at = NOW()
           WHERE user_id = $1`,
          [userId]
        );
      }

      const result = await client.query(
        'SELECT * FROM reader_profiles WHERE user_id = $1',
        [userId]
      );

      return result.rows[0];
    });
  }

  /**
   * Get reader earnings
   */
  static async getEarnings(userId, { startDate = null, endDate = null }) {
    let queryText = `
      SELECT 
        COALESCE(SUM(t.amount), 0) as total_earnings,
        COUNT(t.id) as total_transactions,
        COALESCE(AVG(t.amount), 0) as average_transaction
      FROM transactions t
      WHERE t.reader_id = $1 
        AND t.type = 'session_payment'
        AND t.status = 'completed'
    `;
    const params = [userId];

    if (startDate) {
      params.push(startDate);
      queryText += ` AND t.created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      queryText += ` AND t.created_at <= $${params.length}`;
    }

    const result = await query(queryText, params);
    return result.rows[0];
  }

  /**
   * Search readers
   */
  static async search(searchTerm, { limit = 20, offset = 0 }) {
    const result = await query(
      `SELECT r.*, 
              u.email,
              COUNT(*) OVER() as total_count
       FROM reader_profiles r
       JOIN users u ON r.user_id = u.id
       WHERE r.display_name ILIKE $1 
          OR r.bio ILIKE $1
          OR EXISTS (
            SELECT 1 FROM unnest(r.specialties) s 
            WHERE s ILIKE $1
          )
       ORDER BY r.average_rating DESC
       LIMIT $2 OFFSET $3`,
      [`%${searchTerm}%`, limit, offset]
    );

    return {
      readers: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Get top rated readers
   */
  static async getTopRated(limit = 10) {
    const result = await query(
      `SELECT r.*, u.email
       FROM reader_profiles r
       JOIN users u ON r.user_id = u.id
       WHERE r.total_reviews >= 5
       ORDER BY r.average_rating DESC, r.total_reviews DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * Get reader availability
   */
  static async getAvailability(userId) {
    const result = await query(
      `SELECT is_online, status, 
              (SELECT COUNT(*) FROM reading_sessions 
               WHERE reader_id = $1 AND status = 'active') as active_sessions
       FROM reader_profiles
       WHERE user_id = $1`,
      [userId]
    );

    return result.rows[0] || null;
  }
}

export default Reader;