/**
 * Stream Model
 * Handles live streaming operations
 */

import { query, transaction } from '../config/database.js';

class Stream {
  /**
   * Create a new live stream
   */
  static async create({
    readerId,
    title,
    description,
    thumbnailUrl = null,
    scheduledStart = null,
    agoraChannelName,
    agoraToken
  }) {
    const result = await query(
      `INSERT INTO live_streams (
        reader_id, title, description, thumbnail_url,
        scheduled_start, agora_channel_name, agora_token,
        status, viewer_count, total_gifts_received, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', 0, 0, NOW(), NOW())
      RETURNING *`,
      [readerId, title, description, thumbnailUrl, scheduledStart, agoraChannelName, agoraToken]
    );
    return result.rows[0];
  }

  /**
   * Find stream by ID
   */
  static async findById(streamId) {
    const result = await query(
      `SELECT s.*,
              r.display_name as reader_name,
              r.profile_picture_url as reader_picture
       FROM live_streams s
       JOIN reader_profiles r ON s.reader_id = r.user_id
       WHERE s.id = $1`,
      [streamId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update stream
   */
  static async update(streamId, updates) {
    const allowedFields = [
      'title', 'description', 'thumbnail_url', 'status',
      'viewer_count', 'total_gifts_received'
    ];
    
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [streamId, ...fields.map(field => updates[field])];

    const result = await query(
      `UPDATE live_streams 
       SET ${setClause}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Start a stream
   */
  static async start(streamId) {
    return await query(
      `UPDATE live_streams 
       SET status = 'live',
           started_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [streamId]
    ).then(res => res.rows[0]);
  }

  /**
   * End a stream
   */
  static async end(streamId) {
    return await query(
      `UPDATE live_streams 
       SET status = 'ended',
           ended_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [streamId]
    ).then(res => res.rows[0]);
  }

  /**
   * Update viewer count
   */
  static async updateViewerCount(streamId, change) {
    return await query(
      `UPDATE live_streams 
       SET viewer_count = viewer_count + $1,
           updated_at = NOW()
       WHERE id = $1
       RETURNING viewer_count`,
      [streamId, change]
    ).then(res => res.rows[0]?.viewer_count);
  }

  /**
   * Add gift to stream
   */
  static async addGift(streamId, giftValue) {
    return await query(
      `UPDATE live_streams 
       SET total_gifts_received = total_gifts_received + $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [giftValue, streamId]
    ).then(res => res.rows[0]);
  }

  /**
   * Get all streams with filters
   */
  static async findAll({ status = null, readerId = null, limit = 50, offset = 0 }) {
    let queryText = `
      SELECT s.*,
             r.display_name as reader_name,
             r.profile_picture_url as reader_picture,
             COUNT(*) OVER() as total_count
      FROM live_streams s
      JOIN reader_profiles r ON s.reader_id = r.user_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      queryText += ` AND s.status = $${params.length}`;
    }

    if (readerId) {
      params.push(readerId);
      queryText += ` AND s.reader_id = $${params.length}`;
    }

    queryText += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);
    
    return {
      streams: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Get live streams
   */
  static async getLiveStreams({ limit = 50, offset = 0 }) {
    const result = await query(
      `SELECT s.*,
              r.display_name as reader_name,
              r.profile_picture_url as reader_picture,
              COUNT(*) OVER() as total_count
       FROM live_streams s
       JOIN reader_profiles r ON s.reader_id = r.user_id
       WHERE s.status = 'live'
       ORDER BY s.viewer_count DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return {
      streams: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Get reader's streams
   */
  static async getReaderStreams(readerId, { limit = 50, offset = 0 }) {
    const result = await query(
      `SELECT s.*,
              COUNT(*) OVER() as total_count
       FROM live_streams s
       WHERE s.reader_id = $1
       ORDER BY s.created_at DESC
       LIMIT $2 OFFSET $3`,
      [readerId, limit, offset]
    );

    return {
      streams: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Get active stream for reader
   */
  static async getActiveStream(readerId) {
    const result = await query(
      `SELECT s.*,
              r.display_name as reader_name,
              r.profile_picture_url as reader_picture
       FROM live_streams s
       JOIN reader_profiles r ON s.reader_id = r.user_id
       WHERE s.reader_id = $1 AND s.status IN ('scheduled', 'live')
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [readerId]
    );

    return result.rows[0] || null;
  }

  /**
   * Delete stream
   */
  static async delete(streamId) {
    const result = await query(
      `DELETE FROM live_streams 
       WHERE id = $1
       RETURNING *`,
      [streamId]
    );
    return result.rows[0] || null;
  }
}

export default Stream;