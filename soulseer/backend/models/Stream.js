/**
 * Stream Model - Enterprise Level
 * Complete live streaming management for SoulSeer platform
 * Handles live streams, scheduled streams, virtual gifts, and viewer engagement
 */

const { pool } = require('../config/database');
const { logger } = require('../utils/logger');

class Stream {
  // ============================================
  // STREAM TYPES & STATUSES
  // ============================================
  
  static STATUSES = {
    SCHEDULED: 'scheduled',
    LIVE: 'live',
    ENDED: 'ended',
    CANCELLED: 'cancelled',
    PAUSED: 'paused'
  };

  static TYPES = {
    PUBLIC: 'public',           // Free to watch
    PREMIUM: 'premium',         // Requires subscription or payment
    PRIVATE: 'private',         // Invite only
    GROUP_READING: 'group_reading' // Group reading session
  };

  static CATEGORIES = {
    TAROT: 'tarot',
    ASTROLOGY: 'astrology',
    MEDIUMSHIP: 'mediumship',
    PSYCHIC: 'psychic',
    SPIRITUAL_GUIDANCE: 'spiritual_guidance',
    ENERGY_HEALING: 'energy_healing',
    ORACLE_CARDS: 'oracle_cards',
    NUMEROLOGY: 'numerology',
    Q_AND_A: 'q_and_a',
    MEDITATION: 'meditation',
    WORKSHOP: 'workshop',
    OTHER: 'other'
  };

  // ============================================
  // CORE CRUD OPERATIONS
  // ============================================

  /**
   * Create a new stream
   * @param {Object} streamData - Stream details
   * @returns {Object} Created stream
   */
  static async create(streamData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const {
        reader_id,
        title,
        description = null,
        type = this.TYPES.PUBLIC,
        category = this.CATEGORIES.OTHER,
        thumbnail_url = null,
        scheduled_start = null,
        max_viewers = null,
        entry_fee = 0,
        is_recorded = false,
        tags = [],
        metadata = {}
      } = streamData;

      // Validate reader exists and is approved
      const readerQuery = `
        SELECT rp.*, u.id as user_id, u.display_name
        FROM reader_profiles rp
        JOIN users u ON rp.user_id = u.id
        WHERE rp.id = $1 AND rp.status = 'approved'
      `;
      const readerResult = await client.query(readerQuery, [reader_id]);

      if (readerResult.rows.length === 0) {
        throw new Error('Reader not found or not approved');
      }

      const reader = readerResult.rows[0];

      // Generate unique stream key
      const stream_key = this.generateStreamKey();

      // Determine initial status
      const status = scheduled_start && new Date(scheduled_start) > new Date()
        ? this.STATUSES.SCHEDULED
        : this.STATUSES.SCHEDULED;

      const query = `
        INSERT INTO streams (
          reader_id, title, description, type, category,
          thumbnail_url, stream_key, status,
          scheduled_start, max_viewers, entry_fee,
          is_recorded, tags, metadata,
          viewer_count, peak_viewers, total_gifts_value,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11,
          $12, $13, $14,
          0, 0, 0,
          NOW(), NOW()
        )
        RETURNING *
      `;

      const values = [
        reader_id, title, description, type, category,
        thumbnail_url, stream_key, status,
        scheduled_start, max_viewers, entry_fee,
        is_recorded, tags, JSON.stringify(metadata)
      ];

      const result = await client.query(query, values);
      const stream = result.rows[0];

      // Create stream analytics record
      await client.query(`
        INSERT INTO stream_analytics (
          stream_id, created_at
        ) VALUES ($1, NOW())
      `, [stream.id]);

      await client.query('COMMIT');

      logger.info('Stream created', { 
        streamId: stream.id, 
        readerId: reader_id,
        title 
      });

      return this.formatStream({
        ...stream,
        reader_name: reader.display_name
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating stream', { error: error.message, streamData });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find stream by ID
   * @param {string} id - Stream ID
   * @returns {Object|null} Stream or null
   */
  static async findById(id) {
    try {
      const query = `
        SELECT s.*,
               rp.display_name as reader_name,
               rp.profile_image_url as reader_image,
               rp.specialties as reader_specialties,
               u.id as reader_user_id
        FROM streams s
        JOIN reader_profiles rp ON s.reader_id = rp.id
        JOIN users u ON rp.user_id = u.id
        WHERE s.id = $1
      `;

      const result = await pool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.formatStream(result.rows[0]);

    } catch (error) {
      logger.error('Error finding stream by ID', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Find stream by stream key
   * @param {string} streamKey - Stream key
   * @returns {Object|null} Stream or null
   */
  static async findByStreamKey(streamKey) {
    try {
      const query = `
        SELECT s.*, rp.display_name as reader_name
        FROM streams s
        JOIN reader_profiles rp ON s.reader_id = rp.id
        WHERE s.stream_key = $1
      `;

      const result = await pool.query(query, [streamKey]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.formatStream(result.rows[0]);

    } catch (error) {
      logger.error('Error finding stream by key', { error: error.message, streamKey });
      throw error;
    }
  }

  /**
   * Update stream
   * @param {string} id - Stream ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated stream
   */
  static async update(id, updates) {
    try {
      const allowedFields = [
        'title', 'description', 'type', 'category', 'thumbnail_url',
        'scheduled_start', 'max_viewers', 'entry_fee', 'is_recorded',
        'tags', 'metadata', 'status', 'agora_channel_name', 'agora_token',
        'started_at', 'ended_at', 'viewer_count', 'peak_viewers',
        'total_gifts_value', 'recording_url'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          if (key === 'metadata' || key === 'tags') {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(key === 'metadata' ? JSON.stringify(value) : value);
          } else {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(value);
          }
          paramIndex++;
        }
      }

      if (setClause.length === 0) {
        throw new Error('No valid fields to update');
      }

      setClause.push(`updated_at = NOW()`);
      values.push(id);

      const query = `
        UPDATE streams 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Stream not found');
      }

      logger.info('Stream updated', { streamId: id, updates: Object.keys(updates) });

      return this.formatStream(result.rows[0]);

    } catch (error) {
      logger.error('Error updating stream', { error: error.message, id, updates });
      throw error;
    }
  }

  /**
   * Delete stream
   * @param {string} id - Stream ID
   * @returns {boolean} Success
   */
  static async delete(id) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if stream can be deleted
      const stream = await this.findById(id);
      if (!stream) {
        throw new Error('Stream not found');
      }

      if (stream.status === this.STATUSES.LIVE) {
        throw new Error('Cannot delete a live stream');
      }

      // Delete related records
      await client.query('DELETE FROM stream_viewers WHERE stream_id = $1', [id]);
      await client.query('DELETE FROM stream_gifts WHERE stream_id = $1', [id]);
      await client.query('DELETE FROM stream_chat_messages WHERE stream_id = $1', [id]);
      await client.query('DELETE FROM stream_analytics WHERE stream_id = $1', [id]);
      
      // Delete stream
      await client.query('DELETE FROM streams WHERE id = $1', [id]);

      await client.query('COMMIT');

      logger.info('Stream deleted', { streamId: id });
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error deleting stream', { error: error.message, id });
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // STREAM LIFECYCLE MANAGEMENT
  // ============================================

  /**
   * Start a stream (go live)
   * @param {string} id - Stream ID
   * @param {Object} agoraData - Agora channel data
   * @returns {Object} Updated stream
   */
  static async startStream(id, agoraData = {}) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const stream = await this.findById(id);
      if (!stream) {
        throw new Error('Stream not found');
      }

      if (stream.status === this.STATUSES.LIVE) {
        throw new Error('Stream is already live');
      }

      if (stream.status === this.STATUSES.ENDED) {
        throw new Error('Cannot restart an ended stream');
      }

      const { agora_channel_name, agora_token } = agoraData;

      const query = `
        UPDATE streams 
        SET status = $1, 
            started_at = NOW(), 
            agora_channel_name = $2,
            agora_token = $3,
            updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `;

      const result = await client.query(query, [
        this.STATUSES.LIVE,
        agora_channel_name,
        agora_token,
        id
      ]);

      // Update reader status
      await client.query(`
        UPDATE reader_profiles 
        SET is_streaming = true, current_stream_id = $1, updated_at = NOW()
        WHERE id = $2
      `, [id, stream.readerId]);

      // Log stream start event
      await this.logStreamEvent(client, id, 'stream_started', {
        started_at: new Date()
      });

      await client.query('COMMIT');

      logger.info('Stream started', { streamId: id });

      return this.formatStream(result.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error starting stream', { error: error.message, id });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * End a stream
   * @param {string} id - Stream ID
   * @param {Object} endData - End stream data
   * @returns {Object} Updated stream
   */
  static async endStream(id, endData = {}) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const stream = await this.findById(id);
      if (!stream) {
        throw new Error('Stream not found');
      }

      if (stream.status !== this.STATUSES.LIVE && stream.status !== this.STATUSES.PAUSED) {
        throw new Error('Stream is not currently live');
      }

      // Calculate duration
      const duration = stream.startedAt 
        ? Math.floor((Date.now() - new Date(stream.startedAt).getTime()) / 1000)
        : 0;

      const query = `
        UPDATE streams 
        SET status = $1, 
            ended_at = NOW(), 
            duration_seconds = $2,
            recording_url = $3,
            updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `;

      const result = await client.query(query, [
        this.STATUSES.ENDED,
        duration,
        endData.recording_url || null,
        id
      ]);

      // Update reader status
      await client.query(`
        UPDATE reader_profiles 
        SET is_streaming = false, current_stream_id = NULL, updated_at = NOW()
        WHERE id = $1
      `, [stream.readerId]);

      // Finalize analytics
      await this.finalizeStreamAnalytics(client, id);

      // Log stream end event
      await this.logStreamEvent(client, id, 'stream_ended', {
        ended_at: new Date(),
        duration_seconds: duration,
        final_viewer_count: stream.viewerCount,
        peak_viewers: stream.peakViewers,
        total_gifts: stream.totalGiftsValue
      });

      await client.query('COMMIT');

      logger.info('Stream ended', { streamId: id, duration });

      return this.formatStream(result.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error ending stream', { error: error.message, id });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Pause a stream
   * @param {string} id - Stream ID
   * @returns {Object} Updated stream
   */
  static async pauseStream(id) {
    try {
      const stream = await this.findById(id);
      if (!stream) {
        throw new Error('Stream not found');
      }

      if (stream.status !== this.STATUSES.LIVE) {
        throw new Error('Can only pause a live stream');
      }

      return this.update(id, { status: this.STATUSES.PAUSED });

    } catch (error) {
      logger.error('Error pausing stream', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Resume a paused stream
   * @param {string} id - Stream ID
   * @returns {Object} Updated stream
   */
  static async resumeStream(id) {
    try {
      const stream = await this.findById(id);
      if (!stream) {
        throw new Error('Stream not found');
      }

      if (stream.status !== this.STATUSES.PAUSED) {
        throw new Error('Can only resume a paused stream');
      }

      return this.update(id, { status: this.STATUSES.LIVE });

    } catch (error) {
      logger.error('Error resuming stream', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Cancel a scheduled stream
   * @param {string} id - Stream ID
   * @param {string} reason - Cancellation reason
   * @returns {Object} Updated stream
   */
  static async cancelStream(id, reason = null) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const stream = await this.findById(id);
      if (!stream) {
        throw new Error('Stream not found');
      }

      if (stream.status === this.STATUSES.LIVE) {
        throw new Error('Cannot cancel a live stream. End it instead.');
      }

      if (stream.status === this.STATUSES.ENDED) {
        throw new Error('Cannot cancel an ended stream');
      }

      const query = `
        UPDATE streams 
        SET status = $1, 
            cancelled_at = NOW(),
            cancellation_reason = $2,
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;

      const result = await client.query(query, [
        this.STATUSES.CANCELLED,
        reason,
        id
      ]);

      // Notify scheduled viewers
      // This would integrate with notification system

      await client.query('COMMIT');

      logger.info('Stream cancelled', { streamId: id, reason });

      return this.formatStream(result.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error cancelling stream', { error: error.message, id });
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // VIEWER MANAGEMENT
  // ============================================

  /**
   * Add viewer to stream
   * @param {string} streamId - Stream ID
   * @param {string} userId - User ID
   * @returns {Object} Viewer record
   */
  static async addViewer(streamId, userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if stream is live
      const stream = await this.findById(streamId);
      if (!stream) {
        throw new Error('Stream not found');
      }

      if (stream.status !== this.STATUSES.LIVE) {
        throw new Error('Stream is not live');
      }

      // Check max viewers
      if (stream.maxViewers && stream.viewerCount >= stream.maxViewers) {
        throw new Error('Stream has reached maximum viewers');
      }

      // Check if user is already viewing
      const existingQuery = `
        SELECT * FROM stream_viewers 
        WHERE stream_id = $1 AND user_id = $2 AND left_at IS NULL
      `;
      const existingResult = await client.query(existingQuery, [streamId, userId]);

      if (existingResult.rows.length > 0) {
        // User is already viewing, return existing record
        return existingResult.rows[0];
      }

      // Add viewer
      const viewerQuery = `
        INSERT INTO stream_viewers (
          stream_id, user_id, joined_at
        ) VALUES ($1, $2, NOW())
        RETURNING *
      `;
      const viewerResult = await client.query(viewerQuery, [streamId, userId]);

      // Update viewer count
      const countQuery = `
        UPDATE streams 
        SET viewer_count = viewer_count + 1,
            peak_viewers = GREATEST(peak_viewers, viewer_count + 1),
            updated_at = NOW()
        WHERE id = $1
        RETURNING viewer_count, peak_viewers
      `;
      await client.query(countQuery, [streamId]);

      // Update analytics
      await client.query(`
        UPDATE stream_analytics 
        SET total_unique_viewers = total_unique_viewers + 1,
            updated_at = NOW()
        WHERE stream_id = $1
      `, [streamId]);

      await client.query('COMMIT');

      logger.info('Viewer added to stream', { streamId, userId });

      return viewerResult.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error adding viewer', { error: error.message, streamId, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Remove viewer from stream
   * @param {string} streamId - Stream ID
   * @param {string} userId - User ID
   * @returns {boolean} Success
   */
  static async removeViewer(streamId, userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Update viewer record
      const viewerQuery = `
        UPDATE stream_viewers 
        SET left_at = NOW(),
            watch_duration_seconds = EXTRACT(EPOCH FROM (NOW() - joined_at))
        WHERE stream_id = $1 AND user_id = $2 AND left_at IS NULL
        RETURNING *
      `;
      const viewerResult = await client.query(viewerQuery, [streamId, userId]);

      if (viewerResult.rows.length > 0) {
        // Decrement viewer count
        await client.query(`
          UPDATE streams 
          SET viewer_count = GREATEST(0, viewer_count - 1),
              updated_at = NOW()
          WHERE id = $1
        `, [streamId]);

        // Update analytics with watch time
        const watchDuration = viewerResult.rows[0].watch_duration_seconds;
        await client.query(`
          UPDATE stream_analytics 
          SET total_watch_time_seconds = total_watch_time_seconds + $1,
              updated_at = NOW()
          WHERE stream_id = $2
        `, [watchDuration, streamId]);
      }

      await client.query('COMMIT');

      logger.info('Viewer removed from stream', { streamId, userId });

      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error removing viewer', { error: error.message, streamId, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get current viewers of a stream
   * @param {string} streamId - Stream ID
   * @returns {Array} Current viewers
   */
  static async getCurrentViewers(streamId) {
    try {
      const query = `
        SELECT sv.*, 
               u.display_name,
               u.profile_image_url
        FROM stream_viewers sv
        JOIN users u ON sv.user_id = u.id
        WHERE sv.stream_id = $1 AND sv.left_at IS NULL
        ORDER BY sv.joined_at ASC
      `;

      const result = await pool.query(query, [streamId]);

      return result.rows.map(viewer => ({
        id: viewer.id,
        userId: viewer.user_id,
        displayName: viewer.display_name,
        profileImage: viewer.profile_image_url,
        joinedAt: viewer.joined_at
      }));

    } catch (error) {
      logger.error('Error getting current viewers', { error: error.message, streamId });
      throw error;
    }
  }

  // ============================================
  // GIFT MANAGEMENT
  // ============================================

  /**
   * Send a gift during stream
   * @param {string} streamId - Stream ID
   * @param {string} userId - Sender user ID
   * @param {Object} giftData - Gift details
   * @returns {Object} Gift record
   */
  static async sendGift(streamId, userId, giftData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const { gift_id, quantity = 1, message = null } = giftData;

      // Verify stream is live
      const stream = await this.findById(streamId);
      if (!stream || stream.status !== this.STATUSES.LIVE) {
        throw new Error('Stream is not live');
      }

      // Get gift details
      const giftQuery = `SELECT * FROM virtual_gifts WHERE id = $1 AND is_active = true`;
      const giftResult = await client.query(giftQuery, [gift_id]);

      if (giftResult.rows.length === 0) {
        throw new Error('Gift not found or inactive');
      }

      const gift = giftResult.rows[0];
      const totalCost = gift.price * quantity;

      // Check user balance
      const userQuery = `SELECT balance FROM users WHERE id = $1`;
      const userResult = await client.query(userQuery, [userId]);

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      if (userResult.rows[0].balance < totalCost) {
        throw new Error('Insufficient balance');
      }

      // Deduct from user balance
      await client.query(`
        UPDATE users SET balance = balance - $1, updated_at = NOW() WHERE id = $2
      `, [totalCost, userId]);

      // Create gift record
      const streamGiftQuery = `
        INSERT INTO stream_gifts (
          stream_id, user_id, gift_id, quantity, total_value, message, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;
      const streamGiftResult = await client.query(streamGiftQuery, [
        streamId, userId, gift_id, quantity, totalCost, message
      ]);

      // Update stream total gifts
      await client.query(`
        UPDATE streams 
        SET total_gifts_value = total_gifts_value + $1, updated_at = NOW()
        WHERE id = $2
      `, [totalCost, streamId]);

      // Calculate reader earnings (70%)
      const readerEarnings = totalCost * 0.70;

      // Create transaction for user
      const Transaction = require('./Transaction');
      await Transaction.create({
        user_id: userId,
        reader_id: stream.readerId,
        stream_id: streamId,
        gift_id: gift_id,
        type: Transaction.TYPES.GIFT_PURCHASE,
        amount: totalCost,
        status: Transaction.STATUSES.COMPLETED,
        description: `Gift: ${gift.name} x${quantity}`
      });

      // Create transaction for reader
      await Transaction.create({
        user_id: stream.readerUserId,
        reader_id: stream.readerId,
        stream_id: streamId,
        gift_id: gift_id,
        type: Transaction.TYPES.GIFT_RECEIVED,
        amount: readerEarnings,
        status: Transaction.STATUSES.COMPLETED,
        description: `Received gift: ${gift.name} x${quantity}`
      });

      // Update reader earnings
      await client.query(`
        UPDATE reader_profiles 
        SET total_earnings = total_earnings + $1, updated_at = NOW()
        WHERE id = $2
      `, [readerEarnings, stream.readerId]);

      await client.query('COMMIT');

      logger.info('Gift sent', { streamId, userId, giftId: gift_id, totalCost });

      return {
        ...streamGiftResult.rows[0],
        gift_name: gift.name,
        gift_image: gift.image_url,
        gift_animation: gift.animation_url
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error sending gift', { error: error.message, streamId, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get gifts sent during a stream
   * @param {string} streamId - Stream ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated gifts
   */
  static async getStreamGifts(streamId, options = {}) {
    try {
      const { page = 1, limit = 50 } = options;
      const offset = (page - 1) * limit;

      const query = `
        SELECT sg.*,
               u.display_name as sender_name,
               u.profile_image_url as sender_image,
               vg.name as gift_name,
               vg.image_url as gift_image,
               vg.animation_url as gift_animation
        FROM stream_gifts sg
        JOIN users u ON sg.user_id = u.id
        JOIN virtual_gifts vg ON sg.gift_id = vg.id
        WHERE sg.stream_id = $1
        ORDER BY sg.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const countQuery = `SELECT COUNT(*) FROM stream_gifts WHERE stream_id = $1`;

      const [result, countResult] = await Promise.all([
        pool.query(query, [streamId, limit, offset]),
        pool.query(countQuery, [streamId])
      ]);

      const total = parseInt(countResult.rows[0].count);

      return {
        gifts: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      logger.error('Error getting stream gifts', { error: error.message, streamId });
      throw error;
    }
  }

  // ============================================
  // CHAT MANAGEMENT
  // ============================================

  /**
   * Send a chat message in stream
   * @param {string} streamId - Stream ID
   * @param {string} userId - User ID
   * @param {string} message - Message content
   * @returns {Object} Chat message
   */
  static async sendChatMessage(streamId, userId, message) {
    try {
      // Verify stream is live
      const stream = await this.findById(streamId);
      if (!stream || stream.status !== this.STATUSES.LIVE) {
        throw new Error('Stream is not live');
      }

      // Get user info
      const userQuery = `SELECT display_name, profile_image_url FROM users WHERE id = $1`;
      const userResult = await pool.query(userQuery, [userId]);

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      // Check if user is the reader (host)
      const isHost = stream.readerUserId === userId;

      // Insert chat message
      const query = `
        INSERT INTO stream_chat_messages (
          stream_id, user_id, message, is_host, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;

      const result = await pool.query(query, [streamId, userId, message, isHost]);

      return {
        ...result.rows[0],
        display_name: user.display_name,
        profile_image: user.profile_image_url,
        is_host: isHost
      };

    } catch (error) {
      logger.error('Error sending chat message', { error: error.message, streamId, userId });
      throw error;
    }
  }

  /**
   * Get chat messages for a stream
   * @param {string} streamId - Stream ID
   * @param {Object} options - Query options
   * @returns {Array} Chat messages
   */
  static async getChatMessages(streamId, options = {}) {
    try {
      const { limit = 100, before = null, after = null } = options;

      let query = `
        SELECT scm.*,
               u.display_name,
               u.profile_image_url
        FROM stream_chat_messages scm
        JOIN users u ON scm.user_id = u.id
        WHERE scm.stream_id = $1
      `;

      const values = [streamId];
      let paramIndex = 2;

      if (before) {
        query += ` AND scm.created_at < $${paramIndex}`;
        values.push(before);
        paramIndex++;
      }

      if (after) {
        query += ` AND scm.created_at > $${paramIndex}`;
        values.push(after);
        paramIndex++;
      }

      query += ` ORDER BY scm.created_at DESC LIMIT $${paramIndex}`;
      values.push(limit);

      const result = await pool.query(query, values);

      return result.rows.reverse().map(msg => ({
        id: msg.id,
        userId: msg.user_id,
        displayName: msg.display_name,
        profileImage: msg.profile_image_url,
        message: msg.message,
        isHost: msg.is_host,
        createdAt: msg.created_at
      }));

    } catch (error) {
      logger.error('Error getting chat messages', { error: error.message, streamId });
      throw error;
    }
  }

  // ============================================
  // STREAM QUERIES
  // ============================================

  /**
   * Get live streams
   * @param {Object} options - Query options
   * @returns {Object} Paginated live streams
   */
  static async getLiveStreams(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        category = null,
        type = null,
        sortBy = 'viewer_count',
        sortOrder = 'DESC'
      } = options;

      const offset = (page - 1) * limit;
      const conditions = ['s.status = $1'];
      const values = [this.STATUSES.LIVE];
      let paramIndex = 2;

      if (category) {
        conditions.push(`s.category = $${paramIndex}`);
        values.push(category);
        paramIndex++;
      }

      if (type) {
        conditions.push(`s.type = $${paramIndex}`);
        values.push(type);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');
      const validSortFields = ['viewer_count', 'started_at', 'total_gifts_value'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'viewer_count';
      const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const countQuery = `
        SELECT COUNT(*) FROM streams s WHERE ${whereClause}
      `;
      const countResult = await pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      const query = `
        SELECT s.*,
               rp.display_name as reader_name,
               rp.profile_image_url as reader_image,
               rp.specialties as reader_specialties,
               rp.rating as reader_rating
        FROM streams s
        JOIN reader_profiles rp ON s.reader_id = rp.id
        WHERE ${whereClause}
        ORDER BY s.${sortField} ${order}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await pool.query(query, values);

      return {
        streams: result.rows.map(s => this.formatStream(s)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };

    } catch (error) {
      logger.error('Error getting live streams', { error: error.message });
      throw error;
    }
  }

  /**
   * Get scheduled streams
   * @param {Object} options - Query options
   * @returns {Object} Paginated scheduled streams
   */
  static async getScheduledStreams(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        category = null,
        readerId = null,
        startDate = new Date(),
        endDate = null
      } = options;

      const offset = (page - 1) * limit;
      const conditions = ['s.status = $1', 's.scheduled_start >= $2'];
      const values = [this.STATUSES.SCHEDULED, startDate];
      let paramIndex = 3;

      if (endDate) {
        conditions.push(`s.scheduled_start <= $${paramIndex}`);
        values.push(endDate);
        paramIndex++;
      }

      if (category) {
        conditions.push(`s.category = $${paramIndex}`);
        values.push(category);
        paramIndex++;
      }

      if (readerId) {
        conditions.push(`s.reader_id = $${paramIndex}`);
        values.push(readerId);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      const countQuery = `SELECT COUNT(*) FROM streams s WHERE ${whereClause}`;
      const countResult = await pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      const query = `
        SELECT s.*,
               rp.display_name as reader_name,
               rp.profile_image_url as reader_image,
               rp.specialties as reader_specialties
        FROM streams s
        JOIN reader_profiles rp ON s.reader_id = rp.id
        WHERE ${whereClause}
        ORDER BY s.scheduled_start ASC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await pool.query(query, values);

      return {
        streams: result.rows.map(s => this.formatStream(s)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };

    } catch (error) {
      logger.error('Error getting scheduled streams', { error: error.message });
      throw error;
    }
  }

  /**
   * Get reader's streams
   * @param {string} readerId - Reader profile ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated streams
   */
  static async getReaderStreams(readerId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        status = null,
        includeEnded = true
      } = options;

      const offset = (page - 1) * limit;
      const conditions = ['reader_id = $1'];
      const values = [readerId];
      let paramIndex = 2;

      if (status) {
        conditions.push(`status = $${paramIndex}`);
        values.push(status);
        paramIndex++;
      } else if (!includeEnded) {
        conditions.push(`status != $${paramIndex}`);
        values.push(this.STATUSES.ENDED);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      const countQuery = `SELECT COUNT(*) FROM streams WHERE ${whereClause}`;
      const countResult = await pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      const query = `
        SELECT * FROM streams
        WHERE ${whereClause}
        ORDER BY 
          CASE status 
            WHEN 'live' THEN 1 
            WHEN 'scheduled' THEN 2 
            ELSE 3 
          END,
          COALESCE(scheduled_start, created_at) DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await pool.query(query, values);

      return {
        streams: result.rows.map(s => this.formatStream(s)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };

    } catch (error) {
      logger.error('Error getting reader streams', { error: error.message, readerId });
      throw error;
    }
  }

  /**
   * Search streams
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} Search results
   */
  static async searchStreams(searchQuery, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        status = null,
        category = null
      } = options;

      const offset = (page - 1) * limit;
      const conditions = [
        `(s.title ILIKE $1 OR s.description ILIKE $1 OR rp.display_name ILIKE $1)`
      ];
      const values = [`%${searchQuery}%`];
      let paramIndex = 2;

      if (status) {
        conditions.push(`s.status = $${paramIndex}`);
        values.push(status);
        paramIndex++;
      }

      if (category) {
        conditions.push(`s.category = $${paramIndex}`);
        values.push(category);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      const countQuery = `
        SELECT COUNT(*) 
        FROM streams s
        JOIN reader_profiles rp ON s.reader_id = rp.id
        WHERE ${whereClause}
      `;
      const countResult = await pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      const query = `
        SELECT s.*,
               rp.display_name as reader_name,
               rp.profile_image_url as reader_image
        FROM streams s
        JOIN reader_profiles rp ON s.reader_id = rp.id
        WHERE ${whereClause}
        ORDER BY 
          CASE s.status WHEN 'live' THEN 0 ELSE 1 END,
          s.viewer_count DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await pool.query(query, values);

      return {
        streams: result.rows.map(s => this.formatStream(s)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };

    } catch (error) {
      logger.error('Error searching streams', { error: error.message, searchQuery });
      throw error;
    }
  }

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * Get stream analytics
   * @param {string} streamId - Stream ID
   * @returns {Object} Stream analytics
   */
  static async getStreamAnalytics(streamId) {
    try {
      const query = `
        SELECT sa.*,
               s.title,
               s.status,
               s.viewer_count,
               s.peak_viewers,
               s.total_gifts_value,
               s.duration_seconds,
               s.started_at,
               s.ended_at
        FROM stream_analytics sa
        JOIN streams s ON sa.stream_id = s.id
        WHERE sa.stream_id = $1
      `;

      const result = await pool.query(query, [streamId]);

      if (result.rows.length === 0) {
        return null;
      }

      const analytics = result.rows[0];

      // Get top gifters
      const topGiftersQuery = `
        SELECT u.id, u.display_name, u.profile_image_url,
               SUM(sg.total_value) as total_gifted,
               COUNT(*) as gift_count
        FROM stream_gifts sg
        JOIN users u ON sg.user_id = u.id
        WHERE sg.stream_id = $1
        GROUP BY u.id, u.display_name, u.profile_image_url
        ORDER BY total_gifted DESC
        LIMIT 10
      `;
      const topGiftersResult = await pool.query(topGiftersQuery, [streamId]);

      // Get viewer retention data
      const retentionQuery = `
        SELECT 
          AVG(watch_duration_seconds) as avg_watch_time,
          MAX(watch_duration_seconds) as max_watch_time,
          COUNT(DISTINCT user_id) as unique_viewers
        FROM stream_viewers
        WHERE stream_id = $1
      `;
      const retentionResult = await pool.query(retentionQuery, [streamId]);

      return {
        streamId: analytics.stream_id,
        title: analytics.title,
        status: analytics.status,
        currentViewers: analytics.viewer_count,
        peakViewers: analytics.peak_viewers,
        totalUniqueViewers: analytics.total_unique_viewers,
        totalGiftsValue: parseFloat(analytics.total_gifts_value),
        totalWatchTimeSeconds: analytics.total_watch_time_seconds,
        durationSeconds: analytics.duration_seconds,
        startedAt: analytics.started_at,
        endedAt: analytics.ended_at,
        averageWatchTime: parseFloat(retentionResult.rows[0]?.avg_watch_time || 0),
        topGifters: topGiftersResult.rows.map(g => ({
          userId: g.id,
          displayName: g.display_name,
          profileImage: g.profile_image_url,
          totalGifted: parseFloat(g.total_gifted),
          giftCount: parseInt(g.gift_count)
        }))
      };

    } catch (error) {
      logger.error('Error getting stream analytics', { error: error.message, streamId });
      throw error;
    }
  }

  /**
   * Finalize stream analytics after stream ends
   * @param {Object} client - Database client
   * @param {string} streamId - Stream ID
   */
  static async finalizeStreamAnalytics(client, streamId) {
    try {
      // Calculate final metrics
      const metricsQuery = `
        SELECT 
          COUNT(DISTINCT user_id) as unique_viewers,
          COALESCE(SUM(watch_duration_seconds), 0) as total_watch_time,
          COALESCE(AVG(watch_duration_seconds), 0) as avg_watch_time
        FROM stream_viewers
        WHERE stream_id = $1
      `;
      const metricsResult = await client.query(metricsQuery, [streamId]);
      const metrics = metricsResult.rows[0];

      // Update analytics
      await client.query(`
        UPDATE stream_analytics 
        SET total_unique_viewers = $1,
            total_watch_time_seconds = $2,
            average_watch_time_seconds = $3,
            finalized_at = NOW(),
            updated_at = NOW()
        WHERE stream_id = $4
      `, [
        metrics.unique_viewers,
        metrics.total_watch_time,
        metrics.avg_watch_time,
        streamId
      ]);

    } catch (error) {
      logger.error('Error finalizing stream analytics', { error: error.message, streamId });
      throw error;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Generate unique stream key
   * @returns {string} Stream key
   */
  static generateStreamKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'sk_';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  }

  /**
   * Log stream event
   * @param {Object} client - Database client
   * @param {string} streamId - Stream ID
   * @param {string} eventType - Event type
   * @param {Object} eventData - Event data
   */
  static async logStreamEvent(client, streamId, eventType, eventData) {
    try {
      await client.query(`
        INSERT INTO stream_events (
          stream_id, event_type, event_data, created_at
        ) VALUES ($1, $2, $3, NOW())
      `, [streamId, eventType, JSON.stringify(eventData)]);
    } catch (error) {
      logger.error('Error logging stream event', { error: error.message, streamId, eventType });
    }
  }

  /**
   * Format stream for API response
   * @param {Object} stream - Raw stream data
   * @returns {Object} Formatted stream
   */
  static formatStream(stream) {
    if (!stream) return null;

    return {
      id: stream.id,
      readerId: stream.reader_id,
      readerUserId: stream.reader_user_id,
      readerName: stream.reader_name,
      readerImage: stream.reader_image,
      readerSpecialties: stream.reader_specialties,
      readerRating: stream.reader_rating ? parseFloat(stream.reader_rating) : null,
      title: stream.title,
      description: stream.description,
      type: stream.type,
      category: stream.category,
      thumbnailUrl: stream.thumbnail_url,
      streamKey: stream.stream_key,
      agoraChannelName: stream.agora_channel_name,
      agoraToken: stream.agora_token,
      status: stream.status,
      scheduledStart: stream.scheduled_start,
      startedAt: stream.started_at,
      endedAt: stream.ended_at,
      durationSeconds: stream.duration_seconds,
      maxViewers: stream.max_viewers,
      entryFee: parseFloat(stream.entry_fee || 0),
      isRecorded: stream.is_recorded,
      recordingUrl: stream.recording_url,
      tags: stream.tags,
      metadata: typeof stream.metadata === 'string' 
        ? JSON.parse(stream.metadata) 
        : stream.metadata,
      viewerCount: stream.viewer_count || 0,
      peakViewers: stream.peak_viewers || 0,
      totalGiftsValue: parseFloat(stream.total_gifts_value || 0),
      createdAt: stream.created_at,
      updatedAt: stream.updated_at,
      cancelledAt: stream.cancelled_at,
      cancellationReason: stream.cancellation_reason
    };
  }
}

module.exports = Stream;