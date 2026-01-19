/**
 * Reader Model - COMPLETE IMPLEMENTATION
 * Comprehensive reader profile management
 * NO SHORTCUTS - FULL PRODUCTION CODE
 */

import { query, transaction } from '../config/database.js';

class Reader {
  /**
   * ============================================================================
   * CREATE OPERATIONS
   * ============================================================================
   */

  /**
   * Create a new reader profile with complete validation
   */
  static async create({ 
    userId, 
    displayName, 
    bio, 
    specialties = [], 
    chatRate, 
    callRate, 
    videoRate,
    profilePictureUrl = null,
    yearsExperience = 0,
    certifications = [],
    languagesSpoken = ['English'],
    availabilitySchedule = {},
    introVideoUrl = null,
    websiteUrl = null,
    socialMediaLinks = {},
    acceptingNewClients = true,
    minimumSessionMinutes = 5,
    maximumSessionMinutes = 120
  }) {
    // Validate required fields
    if (!userId || !displayName || !bio) {
      throw new Error('userId, displayName, and bio are required');
    }

    // Validate bio length
    if (bio.length < 50) {
      throw new Error('Bio must be at least 50 characters long');
    }

    if (bio.length > 2000) {
      throw new Error('Bio must not exceed 2000 characters');
    }

    // Validate rates
    if (chatRate < 0.5 || chatRate > 100) {
      throw new Error('Chat rate must be between $0.50 and $100 per minute');
    }
    if (callRate < 0.5 || callRate > 100) {
      throw new Error('Call rate must be between $0.50 and $100 per minute');
    }
    if (videoRate < 0.5 || videoRate > 100) {
      throw new Error('Video rate must be between $0.50 and $100 per minute');
    }

    // Validate specialties
    const validSpecialties = [
      'tarot', 'astrology', 'numerology', 'palmistry', 
      'mediumship', 'clairvoyance', 'energy_healing', 
      'dream_interpretation', 'love_relationships', 'career',
      'life_coaching', 'spiritual_guidance', 'crystal_healing',
      'chakra_balancing', 'past_life_reading', 'angel_cards'
    ];

    if (specialties.length === 0) {
      throw new Error('At least one specialty is required');
    }

    for (const specialty of specialties) {
      if (!validSpecialties.includes(specialty)) {
        throw new Error(`Invalid specialty: ${specialty}`);
      }
    }

    // Check if reader profile already exists
    const existing = await this.findByUserId(userId);
    if (existing) {
      throw new Error('Reader profile already exists for this user');
    }

    const result = await query(
      `INSERT INTO reader_profiles (
        user_id, display_name, bio, specialties, 
        chat_rate, call_rate, video_rate, profile_picture_url,
        years_experience, certifications, languages_spoken,
        availability_schedule, intro_video_url, website_url,
        social_media_links, accepting_new_clients,
        minimum_session_minutes, maximum_session_minutes,
        is_online, status, average_rating, total_reviews, total_sessions,
        total_earnings, response_time_minutes, completion_rate,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
        false, 'offline', 0, 0, 0, 0, 0, 0, NOW(), NOW()
      )
      RETURNING *`,
      [
        userId, displayName, bio, specialties, chatRate, callRate, videoRate,
        profilePictureUrl, yearsExperience, certifications, languagesSpoken,
        JSON.stringify(availabilitySchedule), introVideoUrl, websiteUrl,
        JSON.stringify(socialMediaLinks), acceptingNewClients,
        minimumSessionMinutes, maximumSessionMinutes
      ]
    );

    return result.rows[0];
  }

  /**
   * ============================================================================
   * READ OPERATIONS
   * ============================================================================
   */

  /**
   * Find reader by user ID with complete profile
   */
  static async findByUserId(userId) {
    const result = await query(
      `SELECT r.*, 
              u.email, 
              u.clerk_id,
              u.phone_number,
              u.timezone,
              u.language,
              u.created_at as user_created_at,
              COUNT(DISTINCT s.id) as session_count,
              COUNT(DISTINCT f.id) as favorite_count,
              AVG(CASE WHEN s.status = 'completed' THEN s.duration_minutes END) as avg_session_duration
       FROM reader_profiles r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN reading_sessions s ON r.user_id = s.reader_id
       LEFT JOIN user_favorites f ON r.user_id = f.reader_id
       WHERE r.user_id = $1
       GROUP BY r.id, u.email, u.clerk_id, u.phone_number, u.timezone, u.language, u.created_at`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find reader by ID
   */
  static async findById(id) {
    const result = await query(
      `SELECT r.*, 
              u.email, 
              u.clerk_id,
              COUNT(DISTINCT s.id) as session_count,
              COUNT(DISTINCT f.id) as favorite_count
       FROM reader_profiles r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN reading_sessions s ON r.user_id = s.reader_id
       LEFT JOIN user_favorites f ON r.user_id = f.reader_id
       WHERE r.id = $1
       GROUP BY r.id, u.email, u.clerk_id`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get reader with detailed statistics
   */
  static async findWithStats(userId) {
    const result = await query(
      `SELECT 
        r.*,
        u.email,
        u.clerk_id,
        COUNT(DISTINCT s.id) as total_sessions_count,
        COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END) as completed_sessions_count,
        COUNT(DISTINCT CASE WHEN s.status = 'cancelled' THEN s.id END) as cancelled_sessions_count,
        COUNT(DISTINCT CASE WHEN s.created_at >= NOW() - INTERVAL '30 days' THEN s.id END) as sessions_last_30_days,
        COUNT(DISTINCT CASE WHEN s.created_at >= NOW() - INTERVAL '7 days' THEN s.id END) as sessions_last_7_days,
        COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.duration_minutes ELSE 0 END), 0) as total_minutes,
        COALESCE(AVG(CASE WHEN s.status = 'completed' THEN s.duration_minutes END), 0) as avg_session_duration,
        COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total_cost * 0.7 ELSE 0 END), 0) as total_earnings_calculated,
        COUNT(DISTINCT sr.id) as total_reviews_count,
        COALESCE(AVG(sr.rating), 0) as average_rating_calculated,
        COUNT(DISTINCT f.id) as favorite_count,
        COUNT(DISTINCT ls.id) as total_streams,
        COUNT(DISTINCT CASE WHEN ls.status = 'live' THEN ls.id END) as active_streams
      FROM reader_profiles r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN reading_sessions s ON r.user_id = s.reader_id
      LEFT JOIN session_reviews sr ON r.user_id = sr.reader_id
      LEFT JOIN user_favorites f ON r.user_id = f.reader_id
      LEFT JOIN live_streams ls ON r.user_id = ls.reader_id
      WHERE r.user_id = $1
      GROUP BY r.id, u.email, u.clerk_id`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * ============================================================================
   * UPDATE OPERATIONS
   * ============================================================================
   */

  /**
   * Update reader profile with validation
   */
  static async update(userId, updates) {
    const allowedFields = [
      'display_name', 'bio', 'specialties', 'profile_picture_url',
      'chat_rate', 'call_rate', 'video_rate', 'is_online', 'status',
      'years_experience', 'certifications', 'languages_spoken',
      'availability_schedule', 'intro_video_url', 'website_url',
      'social_media_links', 'accepting_new_clients',
      'minimum_session_minutes', 'maximum_session_minutes'
    ];
    
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Validate bio if being updated
    if (updates.bio) {
      if (updates.bio.length < 50) {
        throw new Error('Bio must be at least 50 characters long');
      }
      if (updates.bio.length > 2000) {
        throw new Error('Bio must not exceed 2000 characters');
      }
    }

    // Validate rates if being updated
    if (updates.chat_rate && (updates.chat_rate < 0.5 || updates.chat_rate > 100)) {
      throw new Error('Chat rate must be between $0.50 and $100 per minute');
    }
    if (updates.call_rate && (updates.call_rate < 0.5 || updates.call_rate > 100)) {
      throw new Error('Call rate must be between $0.50 and $100 per minute');
    }
    if (updates.video_rate && (updates.video_rate < 0.5 || updates.video_rate > 100)) {
      throw new Error('Video rate must be between $0.50 and $100 per minute');
    }

    // Validate status if being updated
    if (updates.status) {
      const validStatuses = ['online', 'offline', 'busy', 'away'];
      if (!validStatuses.includes(updates.status)) {
        throw new Error('Invalid status');
      }
    }

    // Convert objects to JSON strings
    const processedUpdates = { ...updates };
    if (updates.availability_schedule && typeof updates.availability_schedule === 'object') {
      processedUpdates.availability_schedule = JSON.stringify(updates.availability_schedule);
    }
    if (updates.social_media_links && typeof updates.social_media_links === 'object') {
      processedUpdates.social_media_links = JSON.stringify(updates.social_media_links);
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [userId, ...fields.map(field => processedUpdates[field])];

    const result = await query(
      `UPDATE reader_profiles 
       SET ${setClause}, updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Reader profile not found');
    }

    return result.rows[0];
  }

  /**
   * Update reader online status
   */
  static async updateOnlineStatus(userId, isOnline, status = null) {
    const updates = { is_online: isOnline };
    
    if (status) {
      const validStatuses = ['online', 'offline', 'busy', 'away'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid status');
      }
      updates.status = status;
    } else {
      updates.status = isOnline ? 'online' : 'offline';
    }

    return await this.update(userId, updates);
  }

  /**
   * Update reader statistics after session
   */
  static async updateStats(userId, { rating = null, sessionCompleted = false, sessionDuration = 0, sessionCost = 0 }) {
    return await transaction(async (client) => {
      if (sessionCompleted) {
        const readerEarnings = sessionCost * 0.7; // 70% to reader

        await client.query(
          `UPDATE reader_profiles 
           SET total_sessions = total_sessions + 1,
               total_earnings = total_earnings + $1,
               updated_at = NOW()
           WHERE user_id = $2`,
          [readerEarnings, userId]
        );
      }

      if (rating !== null) {
        // Recalculate average rating from all reviews
        await client.query(
          `UPDATE reader_profiles 
           SET average_rating = (
             SELECT COALESCE(AVG(rating), 0) 
             FROM session_reviews 
             WHERE reader_id = $1
           ),
           total_reviews = (
             SELECT COUNT(*) 
             FROM session_reviews 
             WHERE reader_id = $1
           ),
           updated_at = NOW()
           WHERE user_id = $1`,
          [userId]
        );
      }

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
         ),
         updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );

      const result = await client.query(
        'SELECT * FROM reader_profiles WHERE user_id = $1',
        [userId]
      );

      return result.rows[0];
    });
  }

  /**
   * Update response time
   */
  static async updateResponseTime(userId, responseTimeMinutes) {
    const result = await query(
      `UPDATE reader_profiles 
       SET response_time_minutes = (
         CASE 
           WHEN response_time_minutes = 0 THEN $1
           ELSE (response_time_minutes + $1) / 2
         END
       ),
       updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [responseTimeMinutes, userId]
    );
    return result.rows[0] || null;
  }

  /**
   * ============================================================================
   * QUERY OPERATIONS
   * ============================================================================
   */

  /**
   * Get all readers with comprehensive filtering
   */
  static async findAll({ 
    status = null, 
    specialty = null, 
    minRating = null,
    maxRate = null,
    minExperience = null,
    language = null,
    acceptingNewClients = null,
    isOnline = null,
    limit = 50, 
    offset = 0,
    sortBy = 'created_at',
    sortOrder = 'DESC',
    searchTerm = null
  }) {
    let queryText = `
      SELECT r.*, 
             u.email,
             COUNT(*) OVER() as total_count,
             COUNT(DISTINCT f.id) as favorite_count,
             COUNT(DISTINCT s.id) as session_count
      FROM reader_profiles r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN user_favorites f ON r.user_id = f.reader_id
      LEFT JOIN reading_sessions s ON r.user_id = s.reader_id
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

    if (minExperience) {
      params.push(minExperience);
      queryText += ` AND r.years_experience >= $${params.length}`;
    }

    if (language) {
      params.push(language);
      queryText += ` AND $${params.length} = ANY(r.languages_spoken)`;
    }

    if (acceptingNewClients !== null) {
      params.push(acceptingNewClients);
      queryText += ` AND r.accepting_new_clients = $${params.length}`;
    }

    if (isOnline !== null) {
      params.push(isOnline);
      queryText += ` AND r.is_online = $${params.length}`;
    }

    if (searchTerm) {
      params.push(`%${searchTerm}%`);
      queryText += ` AND (r.display_name ILIKE $${params.length} OR r.bio ILIKE $${params.length})`;
    }

    queryText += ' GROUP BY r.id, u.email';

    // Validate sort column
    const validSortColumns = [
      'created_at', 'average_rating', 'total_sessions', 'total_reviews',
      'chat_rate', 'call_rate', 'video_rate', 'years_experience',
      'response_time_minutes', 'completion_rate'
    ];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    queryText += ` ORDER BY r.${sortColumn} ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);
    
    return {
      readers: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset,
      hasMore: (result.rows[0]?.total_count || 0) > offset + limit
    };
  }

  /**
   * Get online readers
   */
  static async findOnline({ limit = 50, offset = 0 }) {
    const result = await query(
      `SELECT r.*, 
              u.email,
              COUNT(*) OVER() as total_count,
              COUNT(DISTINCT f.id) as favorite_count
       FROM reader_profiles r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN user_favorites f ON r.user_id = f.reader_id
       WHERE r.is_online = true AND r.status = 'online' AND r.accepting_new_clients = true
       GROUP BY r.id, u.email
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
   * Search readers with fuzzy matching
   */
  static async search(searchTerm, { limit = 20, offset = 0 }) {
    const result = await query(
      `SELECT r.*, 
              u.email,
              COUNT(*) OVER() as total_count,
              SIMILARITY(r.display_name, $1) + SIMILARITY(r.bio, $1) as relevance
       FROM reader_profiles r
       JOIN users u ON r.user_id = u.id
       WHERE r.display_name ILIKE $2 
          OR r.bio ILIKE $2
          OR EXISTS (
            SELECT 1 FROM unnest(r.specialties) s 
            WHERE s ILIKE $2
          )
       ORDER BY relevance DESC, r.average_rating DESC
       LIMIT $3 OFFSET $4`,
      [searchTerm, `%${searchTerm}%`, limit, offset]
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
  static async getTopRated(limit = 10, minReviews = 5) {
    const result = await query(
      `SELECT r.*, u.email,
              COUNT(DISTINCT f.id) as favorite_count
       FROM reader_profiles r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN user_favorites f ON r.user_id = f.reader_id
       WHERE r.total_reviews >= $1
       GROUP BY r.id, u.email
       ORDER BY r.average_rating DESC, r.total_reviews DESC
       LIMIT $2`,
      [minReviews, limit]
    );

    return result.rows;
  }

  /**
   * Get featured readers
   */
  static async getFeatured(limit = 10) {
    const result = await query(
      `SELECT r.*, u.email,
              COUNT(DISTINCT f.id) as favorite_count
       FROM reader_profiles r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN user_favorites f ON r.user_id = f.reader_id
       WHERE r.is_online = true 
         AND r.accepting_new_clients = true
         AND r.average_rating >= 4.0
         AND r.total_reviews >= 10
       GROUP BY r.id, u.email
       ORDER BY RANDOM()
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * Get readers by specialty
   */
  static async findBySpecialty(specialty, { limit = 50, offset = 0 }) {
    const result = await query(
      `SELECT r.*, 
              u.email,
              COUNT(*) OVER() as total_count
       FROM reader_profiles r
       JOIN users u ON r.user_id = u.id
       WHERE $1 = ANY(r.specialties)
       ORDER BY r.average_rating DESC
       LIMIT $2 OFFSET $3`,
      [specialty, limit, offset]
    );

    return {
      readers: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * ============================================================================
   * EARNINGS & FINANCIAL OPERATIONS
   * ============================================================================
   */

  /**
   * Get reader earnings with detailed breakdown
   */
  static async getEarnings(userId, { startDate = null, endDate = null }) {
    let queryText = `
      SELECT 
        COALESCE(SUM(t.amount), 0) as total_earnings,
        COUNT(t.id) as total_transactions,
        COALESCE(AVG(t.amount), 0) as average_transaction,
        COALESCE(SUM(CASE WHEN t.created_at >= NOW() - INTERVAL '30 days' THEN t.amount ELSE 0 END), 0) as earnings_last_30_days,
        COALESCE(SUM(CASE WHEN t.created_at >= NOW() - INTERVAL '7 days' THEN t.amount ELSE 0 END), 0) as earnings_last_7_days,
        COALESCE(SUM(CASE WHEN DATE(t.created_at) = CURRENT_DATE THEN t.amount ELSE 0 END), 0) as earnings_today
      FROM transactions t
      WHERE t.reader_id = $1 
        AND t.type = 'session_earning'
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
   * Get earnings by date range
   */
  static async getEarningsByDateRange(userId, startDate, endDate) {
    const result = await query(
      `SELECT 
        DATE(t.created_at) as date,
        COALESCE(SUM(t.amount), 0) as daily_earnings,
        COUNT(t.id) as transaction_count
      FROM transactions t
      WHERE t.reader_id = $1 
        AND t.type = 'session_earning'
        AND t.status = 'completed'
        AND t.created_at >= $2
        AND t.created_at <= $3
      GROUP BY DATE(t.created_at)
      ORDER BY date ASC`,
      [userId, startDate, endDate]
    );

    return result.rows;
  }

  /**
   * Get earnings breakdown by session type
   */
  static async getEarningsBySessionType(userId, { startDate = null, endDate = null }) {
    let queryText = `
      SELECT 
        s.session_type,
        COUNT(s.id) as session_count,
        COALESCE(SUM(s.total_cost * 0.7), 0) as total_earnings,
        COALESCE(AVG(s.total_cost * 0.7), 0) as avg_earnings_per_session,
        COALESCE(SUM(s.duration_minutes), 0) as total_minutes
      FROM reading_sessions s
      WHERE s.reader_id = $1 
        AND s.status = 'completed'
    `;
    const params = [userId];

    if (startDate) {
      params.push(startDate);
      queryText += ` AND s.created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      queryText += ` AND s.created_at <= $${params.length}`;
    }

    queryText += ' GROUP BY s.session_type ORDER BY total_earnings DESC';

    const result = await query(queryText, params);
    return result.rows;
  }

  /**
   * ============================================================================
   * AVAILABILITY & SCHEDULING
   * ============================================================================
   */

  /**
   * Get reader availability
   */
  static async getAvailability(userId) {
    const result = await query(
      `SELECT 
        is_online, 
        status, 
        accepting_new_clients,
        availability_schedule,
        (SELECT COUNT(*) FROM reading_sessions 
         WHERE reader_id = $1 AND status = 'active') as active_sessions,
        minimum_session_minutes,
        maximum_session_minutes
       FROM reader_profiles
       WHERE user_id = $1`,
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Check if reader is available for session
   */
  static async isAvailableForSession(userId, sessionType, durationMinutes) {
    const reader = await this.getAvailability(userId);
    
    if (!reader) {
      return { available: false, reason: 'Reader not found' };
    }

    if (!reader.is_online || reader.status !== 'online') {
      return { available: false, reason: 'Reader is not online' };
    }

    if (!reader.accepting_new_clients) {
      return { available: false, reason: 'Reader is not accepting new clients' };
    }

    if (reader.active_sessions > 0) {
      return { available: false, reason: 'Reader is currently in a session' };
    }

    if (durationMinutes < reader.minimum_session_minutes) {
      return { 
        available: false, 
        reason: `Minimum session duration is ${reader.minimum_session_minutes} minutes` 
      };
    }

    if (durationMinutes > reader.maximum_session_minutes) {
      return { 
        available: false, 
        reason: `Maximum session duration is ${reader.maximum_session_minutes} minutes` 
      };
    }

    return { available: true };
  }

  /**
   * ============================================================================
   * REVIEWS & RATINGS
   * ============================================================================
   */

  /**
   * Get reader reviews with pagination
   */
  static async getReviews(userId, { limit = 20, offset = 0, minRating = null }) {
    let queryText = `
      SELECT 
        sr.*,
        u.display_name as client_name,
        u.profile_picture_url as client_picture,
        s.session_type,
        s.duration_minutes,
        COUNT(*) OVER() as total_count
      FROM session_reviews sr
      JOIN users u ON sr.client_id = u.id
      JOIN reading_sessions s ON sr.session_id = s.id
      WHERE sr.reader_id = $1
    `;
    const params = [userId];

    if (minRating) {
      params.push(minRating);
      queryText += ` AND sr.rating >= $${params.length}`;
    }

    queryText += ` ORDER BY sr.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    return {
      reviews: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Get rating distribution
   */
  static async getRatingDistribution(userId) {
    const result = await query(
      `SELECT 
        rating,
        COUNT(*) as count,
        (COUNT(*)::float / (SELECT COUNT(*) FROM session_reviews WHERE reader_id = $1)::float * 100) as percentage
      FROM session_reviews
      WHERE reader_id = $1
      GROUP BY rating
      ORDER BY rating DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * ============================================================================
   * STATISTICS & ANALYTICS
   * ============================================================================
   */

  /**
   * Get comprehensive reader statistics
   */
  static async getComprehensiveStats(userId) {
    const result = await query(
      `SELECT 
        r.*,
        COUNT(DISTINCT s.id) as total_sessions_all_time,
        COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END) as completed_sessions,
        COUNT(DISTINCT CASE WHEN s.status = 'cancelled' THEN s.id END) as cancelled_sessions,
        COUNT(DISTINCT CASE WHEN s.created_at >= NOW() - INTERVAL '30 days' THEN s.id END) as sessions_last_30_days,
        COUNT(DISTINCT CASE WHEN s.created_at >= NOW() - INTERVAL '7 days' THEN s.id END) as sessions_last_7_days,
        COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.duration_minutes ELSE 0 END), 0) as total_minutes_all_time,
        COALESCE(AVG(CASE WHEN s.status = 'completed' THEN s.duration_minutes END), 0) as avg_session_duration,
        COUNT(DISTINCT sr.id) as total_reviews_count,
        COALESCE(AVG(sr.rating), 0) as calculated_avg_rating,
        COUNT(DISTINCT f.id) as total_favorites,
        COUNT(DISTINCT ls.id) as total_streams,
        COUNT(DISTINCT CASE WHEN ls.status = 'live' THEN ls.id END) as active_streams_count,
        COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total_cost * 0.7 ELSE 0 END), 0) as lifetime_earnings
      FROM reader_profiles r
      LEFT JOIN reading_sessions s ON r.user_id = s.reader_id
      LEFT JOIN session_reviews sr ON r.user_id = sr.reader_id
      LEFT JOIN user_favorites f ON r.user_id = f.reader_id
      LEFT JOIN live_streams ls ON r.user_id = ls.reader_id
      WHERE r.user_id = $1
      GROUP BY r.id`,
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get reader performance metrics
   */
  static async getPerformanceMetrics(userId, days = 30) {
    const result = await query(
      `SELECT 
        COUNT(DISTINCT s.id) as total_sessions,
        COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END) as completed_sessions,
        COUNT(DISTINCT CASE WHEN s.status = 'cancelled' THEN s.id END) as cancelled_sessions,
        CASE 
          WHEN COUNT(s.id) = 0 THEN 0
          ELSE (COUNT(CASE WHEN s.status = 'completed' THEN 1 END)::float / COUNT(s.id)::float * 100)
        END as completion_rate,
        COALESCE(AVG(CASE WHEN s.status = 'completed' THEN s.duration_minutes END), 0) as avg_session_duration,
        COALESCE(AVG(sr.rating), 0) as avg_rating,
        COUNT(DISTINCT sr.id) as review_count,
        COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total_cost * 0.7 ELSE 0 END), 0) as total_earnings
      FROM reading_sessions s
      LEFT JOIN session_reviews sr ON s.id = sr.session_id
      WHERE s.reader_id = $1 
        AND s.created_at >= NOW() - INTERVAL '${days} days'`,
      [userId]
    );

    return result.rows[0];
  }

  /**
   * ============================================================================
   * VALIDATION & HELPERS
   * ============================================================================
   */

  /**
   * Validate reader exists and is active
   */
  static async validateReaderExists(userId) {
    const reader = await this.findByUserId(userId);
    if (!reader) {
      throw new Error('Reader profile not found');
    }
    return reader;
  }

  /**
   * Validate reader can accept sessions
   */
  static async validateCanAcceptSessions(userId) {
    const reader = await this.findByUserId(userId);
    if (!reader) {
      throw new Error('Reader profile not found');
    }
    if (!reader.accepting_new_clients) {
      throw new Error('Reader is not accepting new clients');
    }
    if (!reader.is_online) {
      throw new Error('Reader is not online');
    }
    if (reader.status !== 'online') {
      throw new Error('Reader is not available');
    }
    return reader;
  }
}

export default Reader;