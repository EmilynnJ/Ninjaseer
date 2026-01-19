/**
 * Gift Model - Enterprise Level
 * Virtual gift system for SoulSeer platform
 * Handles gift catalog, purchases, and gift animations
 */

const { pool } = require('../config/database');
const { logger } = require('../utils/logger');

class Gift {
  // ============================================
  // GIFT CATEGORIES & TYPES
  // ============================================
  
  static CATEGORIES = {
    SPIRITUAL: 'spiritual',
    MYSTICAL: 'mystical',
    NATURE: 'nature',
    CELESTIAL: 'celestial',
    PREMIUM: 'premium',
    SEASONAL: 'seasonal',
    SPECIAL: 'special'
  };

  static ANIMATION_TYPES = {
    NONE: 'none',
    FLOAT: 'float',
    BURST: 'burst',
    RAIN: 'rain',
    SPARKLE: 'sparkle',
    FULLSCREEN: 'fullscreen'
  };

  // ============================================
  // GIFT CATALOG MANAGEMENT
  // ============================================

  /**
   * Create a new gift in catalog
   * @param {Object} giftData - Gift details
   * @returns {Object} Created gift
   */
  static async create(giftData) {
    try {
      const {
        name,
        description = null,
        category = this.CATEGORIES.SPIRITUAL,
        price,
        image_url,
        animation_url = null,
        animation_type = this.ANIMATION_TYPES.FLOAT,
        animation_duration = 3000,
        sound_url = null,
        sort_order = 0,
        is_active = true,
        is_premium = false,
        available_from = null,
        available_until = null,
        metadata = {}
      } = giftData;

      const query = `
        INSERT INTO virtual_gifts (
          name, description, category, price,
          image_url, animation_url, animation_type, animation_duration,
          sound_url, sort_order, is_active, is_premium,
          available_from, available_until, metadata,
          purchase_count, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15,
          0, NOW(), NOW()
        )
        RETURNING *
      `;

      const values = [
        name, description, category, price,
        image_url, animation_url, animation_type, animation_duration,
        sound_url, sort_order, is_active, is_premium,
        available_from, available_until, JSON.stringify(metadata)
      ];

      const result = await pool.query(query, values);

      logger.info('Gift created', { giftId: result.rows[0].id, name });

      return this.formatGift(result.rows[0]);

    } catch (error) {
      logger.error('Error creating gift', { error: error.message, giftData });
      throw error;
    }
  }

  /**
   * Get gift by ID
   * @param {string} giftId - Gift ID
   * @returns {Object|null} Gift or null
   */
  static async findById(giftId) {
    try {
      const query = `SELECT * FROM virtual_gifts WHERE id = $1`;
      const result = await pool.query(query, [giftId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatGift(result.rows[0]);

    } catch (error) {
      logger.error('Error finding gift', { error: error.message, giftId });
      throw error;
    }
  }

  /**
   * Update gift
   * @param {string} giftId - Gift ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated gift
   */
  static async update(giftId, updates) {
    try {
      const allowedFields = [
        'name', 'description', 'category', 'price',
        'image_url', 'animation_url', 'animation_type', 'animation_duration',
        'sound_url', 'sort_order', 'is_active', 'is_premium',
        'available_from', 'available_until', 'metadata'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          if (key === 'metadata') {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(JSON.stringify(value));
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
      values.push(giftId);

      const query = `
        UPDATE virtual_gifts 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Gift not found');
      }

      logger.info('Gift updated', { giftId });

      return this.formatGift(result.rows[0]);

    } catch (error) {
      logger.error('Error updating gift', { error: error.message, giftId });
      throw error;
    }
  }

  /**
   * Delete gift (soft delete)
   * @param {string} giftId - Gift ID
   * @returns {boolean} Success
   */
  static async delete(giftId) {
    try {
      await pool.query(`
        UPDATE virtual_gifts 
        SET is_active = false, deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [giftId]);

      logger.info('Gift deleted', { giftId });
      return true;

    } catch (error) {
      logger.error('Error deleting gift', { error: error.message, giftId });
      throw error;
    }
  }

  // ============================================
  // GIFT CATALOG QUERIES
  // ============================================

  /**
   * Get all available gifts
   * @param {Object} options - Query options
   * @returns {Object} Paginated gifts
   */
  static async getAvailableGifts(options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        category = null,
        isPremium = null,
        sortBy = 'sort_order',
        sortOrder = 'ASC'
      } = options;

      const offset = (page - 1) * limit;
      const conditions = [
        'is_active = true',
        '(available_from IS NULL OR available_from <= NOW())',
        '(available_until IS NULL OR available_until >= NOW())'
      ];
      const values = [];
      let paramIndex = 1;

      if (category) {
        conditions.push(`category = $${paramIndex}`);
        values.push(category);
        paramIndex++;
      }

      if (isPremium !== null) {
        conditions.push(`is_premium = $${paramIndex}`);
        values.push(isPremium);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      const countQuery = `SELECT COUNT(*) FROM virtual_gifts WHERE ${whereClause}`;
      const countResult = await pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      const validSortFields = ['sort_order', 'price', 'name', 'purchase_count', 'created_at'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'sort_order';
      const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

      const query = `
        SELECT * FROM virtual_gifts
        WHERE ${whereClause}
        ORDER BY ${sortField} ${order}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await pool.query(query, values);

      return {
        gifts: result.rows.map(g => this.formatGift(g)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };

    } catch (error) {
      logger.error('Error getting available gifts', { error: error.message });
      throw error;
    }
  }

  /**
   * Get gifts by category
   * @param {string} category - Gift category
   * @returns {Array} Gifts in category
   */
  static async getByCategory(category) {
    try {
      const query = `
        SELECT * FROM virtual_gifts
        WHERE category = $1 
          AND is_active = true
          AND (available_from IS NULL OR available_from <= NOW())
          AND (available_until IS NULL OR available_until >= NOW())
        ORDER BY sort_order ASC, price ASC
      `;

      const result = await pool.query(query, [category]);

      return result.rows.map(g => this.formatGift(g));

    } catch (error) {
      logger.error('Error getting gifts by category', { error: error.message, category });
      throw error;
    }
  }

  /**
   * Get popular gifts
   * @param {number} limit - Number of gifts
   * @returns {Array} Popular gifts
   */
  static async getPopularGifts(limit = 10) {
    try {
      const query = `
        SELECT * FROM virtual_gifts
        WHERE is_active = true
          AND (available_from IS NULL OR available_from <= NOW())
          AND (available_until IS NULL OR available_until >= NOW())
        ORDER BY purchase_count DESC
        LIMIT $1
      `;

      const result = await pool.query(query, [limit]);

      return result.rows.map(g => this.formatGift(g));

    } catch (error) {
      logger.error('Error getting popular gifts', { error: error.message });
      throw error;
    }
  }

  /**
   * Get seasonal/limited gifts
   * @returns {Array} Seasonal gifts
   */
  static async getSeasonalGifts() {
    try {
      const query = `
        SELECT * FROM virtual_gifts
        WHERE is_active = true
          AND (category = $1 OR (available_from IS NOT NULL AND available_until IS NOT NULL))
          AND available_from <= NOW()
          AND available_until >= NOW()
        ORDER BY available_until ASC
      `;

      const result = await pool.query(query, [this.CATEGORIES.SEASONAL]);

      return result.rows.map(g => this.formatGift(g));

    } catch (error) {
      logger.error('Error getting seasonal gifts', { error: error.message });
      throw error;
    }
  }

  // ============================================
  // GIFT SENDING & RECEIVING
  // ============================================

  /**
   * Send a gift
   * @param {Object} sendData - Gift send details
   * @returns {Object} Gift transaction
   */
  static async sendGift(sendData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const {
        sender_id,
        recipient_id,
        recipient_type, // 'user', 'reader', 'stream'
        gift_id,
        quantity = 1,
        message = null,
        context_type = null, // 'reading', 'stream', 'profile'
        context_id = null
      } = sendData;

      // Get gift details
      const gift = await this.findById(gift_id);
      if (!gift) {
        throw new Error('Gift not found');
      }

      if (!gift.isActive) {
        throw new Error('Gift is not available');
      }

      const totalCost = gift.price * quantity;

      // Check sender balance
      const senderQuery = `SELECT balance FROM users WHERE id = $1`;
      const senderResult = await client.query(senderQuery, [sender_id]);

      if (senderResult.rows.length === 0) {
        throw new Error('Sender not found');
      }

      if (senderResult.rows[0].balance < totalCost) {
        throw new Error('Insufficient balance');
      }

      // Deduct from sender balance
      await client.query(`
        UPDATE users SET balance = balance - $1, updated_at = NOW() WHERE id = $2
      `, [totalCost, sender_id]);

      // Determine recipient user ID
      let recipientUserId = recipient_id;
      let readerId = null;

      if (recipient_type === 'reader') {
        const readerQuery = `SELECT user_id FROM reader_profiles WHERE id = $1`;
        const readerResult = await client.query(readerQuery, [recipient_id]);
        if (readerResult.rows.length === 0) {
          throw new Error('Reader not found');
        }
        recipientUserId = readerResult.rows[0].user_id;
        readerId = recipient_id;
      }

      // Calculate reader earnings (70%)
      const readerEarnings = totalCost * 0.70;

      // Create gift transaction
      const transactionQuery = `
        INSERT INTO gift_transactions (
          sender_id, recipient_id, recipient_type, reader_id,
          gift_id, quantity, total_value, reader_earnings,
          message, context_type, context_id,
          created_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10, $11,
          NOW()
        )
        RETURNING *
      `;

      const transactionValues = [
        sender_id, recipientUserId, recipient_type, readerId,
        gift_id, quantity, totalCost, readerEarnings,
        message, context_type, context_id
      ];

      const transactionResult = await client.query(transactionQuery, transactionValues);
      const transaction = transactionResult.rows[0];

      // Update reader earnings if applicable
      if (readerId) {
        await client.query(`
          UPDATE reader_profiles 
          SET total_earnings = total_earnings + $1,
              gift_earnings = gift_earnings + $1,
              updated_at = NOW()
          WHERE id = $2
        `, [readerEarnings, readerId]);
      }

      // Update gift purchase count
      await client.query(`
        UPDATE virtual_gifts 
        SET purchase_count = purchase_count + $1, updated_at = NOW()
        WHERE id = $2
      `, [quantity, gift_id]);

      // Create financial transaction record
      const Transaction = require('./Transaction');
      await Transaction.create({
        user_id: sender_id,
        reader_id: readerId,
        gift_id: gift_id,
        type: Transaction.TYPES.GIFT_PURCHASE,
        amount: totalCost,
        status: Transaction.STATUSES.COMPLETED,
        description: `Gift: ${gift.name} x${quantity}`
      });

      if (readerId) {
        await Transaction.create({
          user_id: recipientUserId,
          reader_id: readerId,
          gift_id: gift_id,
          type: Transaction.TYPES.GIFT_RECEIVED,
          amount: readerEarnings,
          status: Transaction.STATUSES.COMPLETED,
          description: `Received gift: ${gift.name} x${quantity}`
        });
      }

      // Create notification for recipient
      await client.query(`
        INSERT INTO notifications (
          user_id, type, title, content, 
          target_type, target_id, actor_id,
          is_read, created_at
        ) VALUES (
          $1, 'gift_received', 'You received a gift!',
          $2, 'gift', $3, $4, false, NOW()
        )
      `, [
        recipientUserId,
        `You received ${quantity}x ${gift.name}${message ? `: "${message}"` : ''}`,
        transaction.id,
        sender_id
      ]);

      await client.query('COMMIT');

      logger.info('Gift sent', { 
        transactionId: transaction.id,
        senderId: sender_id,
        recipientId: recipient_id,
        giftId: gift_id,
        quantity,
        totalCost
      });

      // Return with gift details
      return {
        ...transaction,
        gift: gift
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error sending gift', { error: error.message, sendData });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get gifts received by user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated received gifts
   */
  static async getReceivedGifts(userId, options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const offset = (page - 1) * limit;

      const countQuery = `
        SELECT COUNT(*) FROM gift_transactions WHERE recipient_id = $1
      `;
      const countResult = await pool.query(countQuery, [userId]);
      const total = parseInt(countResult.rows[0].count);

      const query = `
        SELECT gt.*,
               vg.name as gift_name,
               vg.image_url as gift_image,
               vg.animation_url as gift_animation,
               u.display_name as sender_name,
               u.profile_image_url as sender_image
        FROM gift_transactions gt
        JOIN virtual_gifts vg ON gt.gift_id = vg.id
        JOIN users u ON gt.sender_id = u.id
        WHERE gt.recipient_id = $1
        ORDER BY gt.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await pool.query(query, [userId, limit, offset]);

      return {
        gifts: result.rows.map(g => this.formatGiftTransaction(g)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };

    } catch (error) {
      logger.error('Error getting received gifts', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get gifts sent by user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated sent gifts
   */
  static async getSentGifts(userId, options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const offset = (page - 1) * limit;

      const countQuery = `
        SELECT COUNT(*) FROM gift_transactions WHERE sender_id = $1
      `;
      const countResult = await pool.query(countQuery, [userId]);
      const total = parseInt(countResult.rows[0].count);

      const query = `
        SELECT gt.*,
               vg.name as gift_name,
               vg.image_url as gift_image,
               u.display_name as recipient_name,
               u.profile_image_url as recipient_image
        FROM gift_transactions gt
        JOIN virtual_gifts vg ON gt.gift_id = vg.id
        JOIN users u ON gt.recipient_id = u.id
        WHERE gt.sender_id = $1
        ORDER BY gt.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await pool.query(query, [userId, limit, offset]);

      return {
        gifts: result.rows.map(g => this.formatGiftTransaction(g)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };

    } catch (error) {
      logger.error('Error getting sent gifts', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get reader's gift earnings
   * @param {string} readerId - Reader profile ID
   * @param {Object} options - Query options
   * @returns {Object} Gift earnings summary
   */
  static async getReaderGiftEarnings(readerId, options = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date()
      } = options;

      // Summary stats
      const summaryQuery = `
        SELECT 
          COUNT(*) as total_gifts,
          COALESCE(SUM(quantity), 0) as total_quantity,
          COALESCE(SUM(total_value), 0) as total_value,
          COALESCE(SUM(reader_earnings), 0) as total_earnings
        FROM gift_transactions
        WHERE reader_id = $1
          AND created_at >= $2
          AND created_at <= $3
      `;

      const summaryResult = await pool.query(summaryQuery, [readerId, startDate, endDate]);
      const summary = summaryResult.rows[0];

      // Top gifts received
      const topGiftsQuery = `
        SELECT 
          vg.id, vg.name, vg.image_url, vg.price,
          COUNT(*) as times_received,
          SUM(gt.quantity) as total_quantity,
          SUM(gt.reader_earnings) as total_earnings
        FROM gift_transactions gt
        JOIN virtual_gifts vg ON gt.gift_id = vg.id
        WHERE gt.reader_id = $1
          AND gt.created_at >= $2
          AND gt.created_at <= $3
        GROUP BY vg.id, vg.name, vg.image_url, vg.price
        ORDER BY total_earnings DESC
        LIMIT 10
      `;

      const topGiftsResult = await pool.query(topGiftsQuery, [readerId, startDate, endDate]);

      // Top gifters
      const topGiftersQuery = `
        SELECT 
          u.id, u.display_name, u.profile_image_url,
          COUNT(*) as gift_count,
          SUM(gt.total_value) as total_value
        FROM gift_transactions gt
        JOIN users u ON gt.sender_id = u.id
        WHERE gt.reader_id = $1
          AND gt.created_at >= $2
          AND gt.created_at <= $3
        GROUP BY u.id, u.display_name, u.profile_image_url
        ORDER BY total_value DESC
        LIMIT 10
      `;

      const topGiftersResult = await pool.query(topGiftersQuery, [readerId, startDate, endDate]);

      return {
        summary: {
          totalGifts: parseInt(summary.total_gifts),
          totalQuantity: parseInt(summary.total_quantity),
          totalValue: parseFloat(summary.total_value),
          totalEarnings: parseFloat(summary.total_earnings),
          period: { startDate, endDate }
        },
        topGifts: topGiftsResult.rows.map(g => ({
          id: g.id,
          name: g.name,
          imageUrl: g.image_url,
          price: parseFloat(g.price),
          timesReceived: parseInt(g.times_received),
          totalQuantity: parseInt(g.total_quantity),
          totalEarnings: parseFloat(g.total_earnings)
        })),
        topGifters: topGiftersResult.rows.map(g => ({
          userId: g.id,
          displayName: g.display_name,
          profileImage: g.profile_image_url,
          giftCount: parseInt(g.gift_count),
          totalValue: parseFloat(g.total_value)
        }))
      };

    } catch (error) {
      logger.error('Error getting reader gift earnings', { error: error.message, readerId });
      throw error;
    }
  }

  // ============================================
  // GIFT LEADERBOARDS
  // ============================================

  /**
   * Get top gifters leaderboard
   * @param {Object} options - Query options
   * @returns {Array} Top gifters
   */
  static async getTopGifters(options = {}) {
    try {
      const {
        limit = 10,
        timeframe = 'all' // 'day', 'week', 'month', 'all'
      } = options;

      let dateCondition = '';
      if (timeframe !== 'all') {
        const intervals = {
          day: '1 day',
          week: '7 days',
          month: '30 days'
        };
        dateCondition = `AND created_at >= NOW() - INTERVAL '${intervals[timeframe]}'`;
      }

      const query = `
        SELECT 
          u.id, u.display_name, u.profile_image_url,
          COUNT(*) as gift_count,
          SUM(gt.total_value) as total_spent
        FROM gift_transactions gt
        JOIN users u ON gt.sender_id = u.id
        WHERE 1=1 ${dateCondition}
        GROUP BY u.id, u.display_name, u.profile_image_url
        ORDER BY total_spent DESC
        LIMIT $1
      `;

      const result = await pool.query(query, [limit]);

      return result.rows.map((g, index) => ({
        rank: index + 1,
        userId: g.id,
        displayName: g.display_name,
        profileImage: g.profile_image_url,
        giftCount: parseInt(g.gift_count),
        totalSpent: parseFloat(g.total_spent)
      }));

    } catch (error) {
      logger.error('Error getting top gifters', { error: error.message });
      throw error;
    }
  }

  /**
   * Get top gift receivers leaderboard
   * @param {Object} options - Query options
   * @returns {Array} Top receivers
   */
  static async getTopReceivers(options = {}) {
    try {
      const {
        limit = 10,
        timeframe = 'all'
      } = options;

      let dateCondition = '';
      if (timeframe !== 'all') {
        const intervals = {
          day: '1 day',
          week: '7 days',
          month: '30 days'
        };
        dateCondition = `AND gt.created_at >= NOW() - INTERVAL '${intervals[timeframe]}'`;
      }

      const query = `
        SELECT 
          rp.id as reader_id,
          rp.display_name,
          rp.profile_image_url,
          COUNT(*) as gift_count,
          SUM(gt.total_value) as total_received,
          SUM(gt.reader_earnings) as total_earnings
        FROM gift_transactions gt
        JOIN reader_profiles rp ON gt.reader_id = rp.id
        WHERE gt.reader_id IS NOT NULL ${dateCondition}
        GROUP BY rp.id, rp.display_name, rp.profile_image_url
        ORDER BY total_received DESC
        LIMIT $1
      `;

      const result = await pool.query(query, [limit]);

      return result.rows.map((r, index) => ({
        rank: index + 1,
        readerId: r.reader_id,
        displayName: r.display_name,
        profileImage: r.profile_image_url,
        giftCount: parseInt(r.gift_count),
        totalReceived: parseFloat(r.total_received),
        totalEarnings: parseFloat(r.total_earnings)
      }));

    } catch (error) {
      logger.error('Error getting top receivers', { error: error.message });
      throw error;
    }
  }

  // ============================================
  // ADMIN OPERATIONS
  // ============================================

  /**
   * Get all gifts (admin)
   * @param {Object} options - Query options
   * @returns {Object} Paginated gifts
   */
  static async getAllGifts(options = {}) {
    try {
      const { page = 1, limit = 50, includeInactive = true } = options;
      const offset = (page - 1) * limit;

      const conditions = includeInactive ? [] : ['is_active = true'];
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countQuery = `SELECT COUNT(*) FROM virtual_gifts ${whereClause}`;
      const countResult = await pool.query(countQuery);
      const total = parseInt(countResult.rows[0].count);

      const query = `
        SELECT * FROM virtual_gifts
        ${whereClause}
        ORDER BY category, sort_order, name
        LIMIT $1 OFFSET $2
      `;

      const result = await pool.query(query, [limit, offset]);

      return {
        gifts: result.rows.map(g => this.formatGift(g)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      logger.error('Error getting all gifts', { error: error.message });
      throw error;
    }
  }

  /**
   * Get gift statistics (admin)
   * @returns {Object} Gift statistics
   */
  static async getStatistics() {
    try {
      // Total gifts in catalog
      const catalogQuery = `
        SELECT 
          COUNT(*) as total_gifts,
          COUNT(*) FILTER (WHERE is_active = true) as active_gifts,
          COUNT(*) FILTER (WHERE is_premium = true) as premium_gifts
        FROM virtual_gifts
      `;
      const catalogResult = await pool.query(catalogQuery);

      // Transaction stats
      const transactionQuery = `
        SELECT 
          COUNT(*) as total_transactions,
          COALESCE(SUM(quantity), 0) as total_quantity,
          COALESCE(SUM(total_value), 0) as total_value,
          COALESCE(SUM(reader_earnings), 0) as total_reader_earnings
        FROM gift_transactions
      `;
      const transactionResult = await pool.query(transactionQuery);

      // Today's stats
      const todayQuery = `
        SELECT 
          COUNT(*) as transactions,
          COALESCE(SUM(total_value), 0) as value
        FROM gift_transactions
        WHERE DATE(created_at) = CURRENT_DATE
      `;
      const todayResult = await pool.query(todayQuery);

      // By category
      const byCategoryQuery = `
        SELECT 
          vg.category,
          COUNT(*) as transaction_count,
          SUM(gt.total_value) as total_value
        FROM gift_transactions gt
        JOIN virtual_gifts vg ON gt.gift_id = vg.id
        GROUP BY vg.category
        ORDER BY total_value DESC
      `;
      const byCategoryResult = await pool.query(byCategoryQuery);

      return {
        catalog: {
          totalGifts: parseInt(catalogResult.rows[0].total_gifts),
          activeGifts: parseInt(catalogResult.rows[0].active_gifts),
          premiumGifts: parseInt(catalogResult.rows[0].premium_gifts)
        },
        transactions: {
          totalTransactions: parseInt(transactionResult.rows[0].total_transactions),
          totalQuantity: parseInt(transactionResult.rows[0].total_quantity),
          totalValue: parseFloat(transactionResult.rows[0].total_value),
          totalReaderEarnings: parseFloat(transactionResult.rows[0].total_reader_earnings),
          platformRevenue: parseFloat(transactionResult.rows[0].total_value) - parseFloat(transactionResult.rows[0].total_reader_earnings)
        },
        today: {
          transactions: parseInt(todayResult.rows[0].transactions),
          value: parseFloat(todayResult.rows[0].value)
        },
        byCategory: byCategoryResult.rows.map(c => ({
          category: c.category,
          transactionCount: parseInt(c.transaction_count),
          totalValue: parseFloat(c.total_value)
        }))
      };

    } catch (error) {
      logger.error('Error getting gift statistics', { error: error.message });
      throw error;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Format gift for API response
   * @param {Object} gift - Raw gift data
   * @returns {Object} Formatted gift
   */
  static formatGift(gift) {
    if (!gift) return null;

    return {
      id: gift.id,
      name: gift.name,
      description: gift.description,
      category: gift.category,
      price: parseFloat(gift.price),
      imageUrl: gift.image_url,
      animationUrl: gift.animation_url,
      animationType: gift.animation_type,
      animationDuration: gift.animation_duration,
      soundUrl: gift.sound_url,
      sortOrder: gift.sort_order,
      isActive: gift.is_active,
      isPremium: gift.is_premium,
      availableFrom: gift.available_from,
      availableUntil: gift.available_until,
      metadata: typeof gift.metadata === 'string' ? JSON.parse(gift.metadata) : gift.metadata,
      purchaseCount: gift.purchase_count,
      createdAt: gift.created_at,
      updatedAt: gift.updated_at
    };
  }

  /**
   * Format gift transaction for API response
   * @param {Object} transaction - Raw transaction data
   * @returns {Object} Formatted transaction
   */
  static formatGiftTransaction(transaction) {
    if (!transaction) return null;

    return {
      id: transaction.id,
      senderId: transaction.sender_id,
      senderName: transaction.sender_name,
      senderImage: transaction.sender_image,
      recipientId: transaction.recipient_id,
      recipientName: transaction.recipient_name,
      recipientImage: transaction.recipient_image,
      recipientType: transaction.recipient_type,
      readerId: transaction.reader_id,
      giftId: transaction.gift_id,
      giftName: transaction.gift_name,
      giftImage: transaction.gift_image,
      giftAnimation: transaction.gift_animation,
      quantity: transaction.quantity,
      totalValue: parseFloat(transaction.total_value),
      readerEarnings: parseFloat(transaction.reader_earnings || 0),
      message: transaction.message,
      contextType: transaction.context_type,
      contextId: transaction.context_id,
      createdAt: transaction.created_at
    };
  }
}

module.exports = Gift;