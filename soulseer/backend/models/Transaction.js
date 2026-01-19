/**
 * Transaction Model - Enterprise Level
 * Complete financial transaction management for SoulSeer platform
 * Handles all payment flows, refunds, payouts, and financial reporting
 */

const { pool } = require('../config/database');
const { logger } = require('../utils/logger');

class Transaction {
  // ============================================
  // TRANSACTION TYPES & STATUSES
  // ============================================
  
  static TYPES = {
    BALANCE_ADD: 'balance_add',           // User adds funds to balance
    READING_PAYMENT: 'reading_payment',   // Payment for reading session
    READING_REFUND: 'reading_refund',     // Refund for reading session
    GIFT_PURCHASE: 'gift_purchase',       // Virtual gift purchase
    GIFT_RECEIVED: 'gift_received',       // Reader receives gift value
    PRODUCT_PURCHASE: 'product_purchase', // Shop product purchase
    PRODUCT_REFUND: 'product_refund',     // Shop product refund
    STREAM_TIP: 'stream_tip',             // Tip during live stream
    STREAM_TIP_RECEIVED: 'stream_tip_received', // Reader receives tip
    PAYOUT_REQUEST: 'payout_request',     // Reader requests payout
    PAYOUT_COMPLETED: 'payout_completed', // Payout sent to reader
    SUBSCRIPTION: 'subscription',         // Monthly subscription
    PROMOTIONAL_CREDIT: 'promotional_credit', // Promotional balance
    REFERRAL_BONUS: 'referral_bonus',     // Referral program bonus
    ADJUSTMENT: 'adjustment',             // Manual adjustment
    FEE: 'fee',                           // Platform fee
    CHARGEBACK: 'chargeback',             // Payment chargeback
    DISPUTE: 'dispute'                    // Payment dispute
  };

  static STATUSES = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded',
    DISPUTED: 'disputed',
    ON_HOLD: 'on_hold'
  };

  static PAYMENT_METHODS = {
    STRIPE_CARD: 'stripe_card',
    STRIPE_ACH: 'stripe_ach',
    PAYPAL: 'paypal',
    BALANCE: 'balance',
    PROMOTIONAL: 'promotional'
  };

  // ============================================
  // CORE CRUD OPERATIONS
  // ============================================

  /**
   * Create a new transaction
   * @param {Object} transactionData - Transaction details
   * @returns {Object} Created transaction
   */
  static async create(transactionData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const {
        user_id,
        reader_id = null,
        session_id = null,
        stream_id = null,
        order_id = null,
        gift_id = null,
        type,
        amount,
        currency = 'USD',
        payment_method = null,
        stripe_payment_intent_id = null,
        stripe_charge_id = null,
        stripe_transfer_id = null,
        description = null,
        metadata = {},
        status = this.STATUSES.PENDING
      } = transactionData;

      // Validate transaction type
      if (!Object.values(this.TYPES).includes(type)) {
        throw new Error(`Invalid transaction type: ${type}`);
      }

      // Generate unique transaction reference
      const reference = this.generateReference(type);

      // Calculate platform fee and net amount for reader transactions
      let platform_fee = 0;
      let net_amount = amount;
      
      if (reader_id && this.isReaderEarningType(type)) {
        platform_fee = this.calculatePlatformFee(amount);
        net_amount = amount - platform_fee;
      }

      const query = `
        INSERT INTO transactions (
          user_id, reader_id, session_id, stream_id, order_id, gift_id,
          type, amount, currency, platform_fee, net_amount,
          payment_method, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id,
          reference, description, metadata, status,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15,
          $16, $17, $18, $19,
          NOW(), NOW()
        )
        RETURNING *
      `;

      const values = [
        user_id, reader_id, session_id, stream_id, order_id, gift_id,
        type, amount, currency, platform_fee, net_amount,
        payment_method, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id,
        reference, description, JSON.stringify(metadata), status
      ];

      const result = await client.query(query, values);
      const transaction = result.rows[0];

      // Create transaction history entry
      await this.createHistoryEntry(client, transaction.id, status, 'Transaction created');

      await client.query('COMMIT');

      logger.info('Transaction created', { 
        transactionId: transaction.id, 
        type, 
        amount,
        reference 
      });

      return this.formatTransaction(transaction);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating transaction', { error: error.message, transactionData });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Find transaction by ID
   * @param {string} id - Transaction ID
   * @returns {Object|null} Transaction or null
   */
  static async findById(id) {
    try {
      const query = `
        SELECT t.*,
               u.email as user_email,
               u.display_name as user_name,
               r.display_name as reader_name,
               r.id as reader_user_id
        FROM transactions t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN reader_profiles rp ON t.reader_id = rp.id
        LEFT JOIN users r ON rp.user_id = r.id
        WHERE t.id = $1
      `;

      const result = await pool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.formatTransaction(result.rows[0]);

    } catch (error) {
      logger.error('Error finding transaction by ID', { error: error.message, id });
      throw error;
    }
  }

  /**
   * Find transaction by reference
   * @param {string} reference - Transaction reference
   * @returns {Object|null} Transaction or null
   */
  static async findByReference(reference) {
    try {
      const query = `SELECT * FROM transactions WHERE reference = $1`;
      const result = await pool.query(query, [reference]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.formatTransaction(result.rows[0]);

    } catch (error) {
      logger.error('Error finding transaction by reference', { error: error.message, reference });
      throw error;
    }
  }

  /**
   * Find transaction by Stripe Payment Intent ID
   * @param {string} paymentIntentId - Stripe Payment Intent ID
   * @returns {Object|null} Transaction or null
   */
  static async findByStripePaymentIntent(paymentIntentId) {
    try {
      const query = `SELECT * FROM transactions WHERE stripe_payment_intent_id = $1`;
      const result = await pool.query(query, [paymentIntentId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.formatTransaction(result.rows[0]);

    } catch (error) {
      logger.error('Error finding transaction by payment intent', { error: error.message, paymentIntentId });
      throw error;
    }
  }

  /**
   * Update transaction
   * @param {string} id - Transaction ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated transaction
   */
  static async update(id, updates) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const allowedFields = [
        'status', 'stripe_payment_intent_id', 'stripe_charge_id', 
        'stripe_transfer_id', 'description', 'metadata', 'completed_at',
        'failed_at', 'failure_reason', 'refunded_at', 'refund_reason'
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
      values.push(id);

      const query = `
        UPDATE transactions 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Transaction not found');
      }

      const transaction = result.rows[0];

      // Create history entry for status changes
      if (updates.status) {
        await this.createHistoryEntry(
          client, 
          id, 
          updates.status, 
          updates.status_reason || `Status changed to ${updates.status}`
        );
      }

      await client.query('COMMIT');

      logger.info('Transaction updated', { transactionId: id, updates });

      return this.formatTransaction(transaction);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating transaction', { error: error.message, id, updates });
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // STATUS MANAGEMENT
  // ============================================

  /**
   * Mark transaction as completed
   * @param {string} id - Transaction ID
   * @param {Object} completionData - Completion details
   * @returns {Object} Updated transaction
   */
  static async markCompleted(id, completionData = {}) {
    return this.update(id, {
      status: this.STATUSES.COMPLETED,
      completed_at: new Date(),
      stripe_charge_id: completionData.stripe_charge_id,
      stripe_transfer_id: completionData.stripe_transfer_id,
      metadata: completionData.metadata
    });
  }

  /**
   * Mark transaction as failed
   * @param {string} id - Transaction ID
   * @param {string} reason - Failure reason
   * @returns {Object} Updated transaction
   */
  static async markFailed(id, reason) {
    return this.update(id, {
      status: this.STATUSES.FAILED,
      failed_at: new Date(),
      failure_reason: reason
    });
  }

  /**
   * Mark transaction as refunded
   * @param {string} id - Transaction ID
   * @param {string} reason - Refund reason
   * @returns {Object} Updated transaction
   */
  static async markRefunded(id, reason) {
    return this.update(id, {
      status: this.STATUSES.REFUNDED,
      refunded_at: new Date(),
      refund_reason: reason
    });
  }

  /**
   * Mark transaction as disputed
   * @param {string} id - Transaction ID
   * @param {Object} disputeData - Dispute details
   * @returns {Object} Updated transaction
   */
  static async markDisputed(id, disputeData) {
    return this.update(id, {
      status: this.STATUSES.DISPUTED,
      metadata: {
        dispute: disputeData
      }
    });
  }

  // ============================================
  // USER TRANSACTION QUERIES
  // ============================================

  /**
   * Get user's transaction history
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated transactions
   */
  static async getUserTransactions(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        type = null,
        status = null,
        startDate = null,
        endDate = null,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = options;

      const offset = (page - 1) * limit;
      const conditions = ['user_id = $1'];
      const values = [userId];
      let paramIndex = 2;

      if (type) {
        if (Array.isArray(type)) {
          conditions.push(`type = ANY($${paramIndex})`);
          values.push(type);
        } else {
          conditions.push(`type = $${paramIndex}`);
          values.push(type);
        }
        paramIndex++;
      }

      if (status) {
        conditions.push(`status = $${paramIndex}`);
        values.push(status);
        paramIndex++;
      }

      if (startDate) {
        conditions.push(`created_at >= $${paramIndex}`);
        values.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        conditions.push(`created_at <= $${paramIndex}`);
        values.push(endDate);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');
      const validSortFields = ['created_at', 'amount', 'type', 'status'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM transactions WHERE ${whereClause}`;
      const countResult = await pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // Get transactions
      const query = `
        SELECT t.*,
               rp.display_name as reader_name,
               rp.profile_image_url as reader_image
        FROM transactions t
        LEFT JOIN reader_profiles rp ON t.reader_id = rp.id
        WHERE ${whereClause}
        ORDER BY ${sortField} ${order}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await pool.query(query, values);

      return {
        transactions: result.rows.map(t => this.formatTransaction(t)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };

    } catch (error) {
      logger.error('Error getting user transactions', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get user's balance history (deposits and withdrawals)
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} Balance history
   */
  static async getUserBalanceHistory(userId, options = {}) {
    const balanceTypes = [
      this.TYPES.BALANCE_ADD,
      this.TYPES.READING_PAYMENT,
      this.TYPES.GIFT_PURCHASE,
      this.TYPES.PRODUCT_PURCHASE,
      this.TYPES.STREAM_TIP,
      this.TYPES.PROMOTIONAL_CREDIT,
      this.TYPES.REFERRAL_BONUS
    ];

    return this.getUserTransactions(userId, {
      ...options,
      type: balanceTypes
    });
  }

  // ============================================
  // READER TRANSACTION QUERIES
  // ============================================

  /**
   * Get reader's earnings history
   * @param {string} readerId - Reader profile ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated earnings
   */
  static async getReaderEarnings(readerId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        startDate = null,
        endDate = null,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = options;

      const offset = (page - 1) * limit;
      const earningTypes = [
        this.TYPES.READING_PAYMENT,
        this.TYPES.GIFT_RECEIVED,
        this.TYPES.STREAM_TIP_RECEIVED
      ];

      const conditions = ['reader_id = $1', 'type = ANY($2)', 'status = $3'];
      const values = [readerId, earningTypes, this.STATUSES.COMPLETED];
      let paramIndex = 4;

      if (startDate) {
        conditions.push(`created_at >= $${paramIndex}`);
        values.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        conditions.push(`created_at <= $${paramIndex}`);
        values.push(endDate);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      // Get total count and sum
      const statsQuery = `
        SELECT COUNT(*) as count, 
               COALESCE(SUM(net_amount), 0) as total_earnings,
               COALESCE(SUM(platform_fee), 0) as total_fees
        FROM transactions 
        WHERE ${whereClause}
      `;
      const statsResult = await pool.query(statsQuery, values);
      const stats = statsResult.rows[0];

      // Get transactions
      const query = `
        SELECT t.*,
               u.display_name as client_name,
               u.profile_image_url as client_image
        FROM transactions t
        LEFT JOIN users u ON t.user_id = u.id
        WHERE ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await pool.query(query, values);

      return {
        transactions: result.rows.map(t => this.formatTransaction(t)),
        summary: {
          totalEarnings: parseFloat(stats.total_earnings),
          totalFees: parseFloat(stats.total_fees),
          transactionCount: parseInt(stats.count)
        },
        pagination: {
          page,
          limit,
          total: parseInt(stats.count),
          totalPages: Math.ceil(parseInt(stats.count) / limit),
          hasMore: page * limit < parseInt(stats.count)
        }
      };

    } catch (error) {
      logger.error('Error getting reader earnings', { error: error.message, readerId });
      throw error;
    }
  }

  /**
   * Get reader's payout history
   * @param {string} readerId - Reader profile ID
   * @param {Object} options - Query options
   * @returns {Object} Payout history
   */
  static async getReaderPayouts(readerId, options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const offset = (page - 1) * limit;

      const payoutTypes = [this.TYPES.PAYOUT_REQUEST, this.TYPES.PAYOUT_COMPLETED];

      const query = `
        SELECT * FROM transactions
        WHERE reader_id = $1 AND type = ANY($2)
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `;

      const countQuery = `
        SELECT COUNT(*) FROM transactions
        WHERE reader_id = $1 AND type = ANY($2)
      `;

      const [result, countResult] = await Promise.all([
        pool.query(query, [readerId, payoutTypes, limit, offset]),
        pool.query(countQuery, [readerId, payoutTypes])
      ]);

      const total = parseInt(countResult.rows[0].count);

      return {
        payouts: result.rows.map(t => this.formatTransaction(t)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };

    } catch (error) {
      logger.error('Error getting reader payouts', { error: error.message, readerId });
      throw error;
    }
  }

  /**
   * Calculate reader's pending balance (earnings not yet paid out)
   * @param {string} readerId - Reader profile ID
   * @returns {Object} Pending balance details
   */
  static async getReaderPendingBalance(readerId) {
    try {
      const earningTypes = [
        this.TYPES.READING_PAYMENT,
        this.TYPES.GIFT_RECEIVED,
        this.TYPES.STREAM_TIP_RECEIVED
      ];

      // Get total completed earnings
      const earningsQuery = `
        SELECT COALESCE(SUM(net_amount), 0) as total
        FROM transactions
        WHERE reader_id = $1 
          AND type = ANY($2) 
          AND status = $3
      `;
      const earningsResult = await pool.query(earningsQuery, [
        readerId, 
        earningTypes, 
        this.STATUSES.COMPLETED
      ]);

      // Get total completed payouts
      const payoutsQuery = `
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE reader_id = $1 
          AND type = $2 
          AND status = $3
      `;
      const payoutsResult = await pool.query(payoutsQuery, [
        readerId,
        this.TYPES.PAYOUT_COMPLETED,
        this.STATUSES.COMPLETED
      ]);

      // Get pending payouts
      const pendingPayoutsQuery = `
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE reader_id = $1 
          AND type = $2 
          AND status IN ($3, $4)
      `;
      const pendingPayoutsResult = await pool.query(pendingPayoutsQuery, [
        readerId,
        this.TYPES.PAYOUT_REQUEST,
        this.STATUSES.PENDING,
        this.STATUSES.PROCESSING
      ]);

      const totalEarnings = parseFloat(earningsResult.rows[0].total);
      const totalPayouts = parseFloat(payoutsResult.rows[0].total);
      const pendingPayouts = parseFloat(pendingPayoutsResult.rows[0].total);

      return {
        totalEarnings,
        totalPayouts,
        pendingPayouts,
        availableBalance: totalEarnings - totalPayouts - pendingPayouts
      };

    } catch (error) {
      logger.error('Error getting reader pending balance', { error: error.message, readerId });
      throw error;
    }
  }

  // ============================================
  // FINANCIAL REPORTING
  // ============================================

  /**
   * Get platform revenue report
   * @param {Object} options - Report options
   * @returns {Object} Revenue report
   */
  static async getPlatformRevenueReport(options = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        groupBy = 'day'
      } = options;

      // Total platform fees
      const feesQuery = `
        SELECT 
          COALESCE(SUM(platform_fee), 0) as total_fees,
          COUNT(*) as transaction_count
        FROM transactions
        WHERE status = $1
          AND created_at >= $2
          AND created_at <= $3
          AND platform_fee > 0
      `;
      const feesResult = await pool.query(feesQuery, [
        this.STATUSES.COMPLETED,
        startDate,
        endDate
      ]);

      // Revenue by type
      const byTypeQuery = `
        SELECT 
          type,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total_amount,
          COALESCE(SUM(platform_fee), 0) as total_fees
        FROM transactions
        WHERE status = $1
          AND created_at >= $2
          AND created_at <= $3
        GROUP BY type
        ORDER BY total_amount DESC
      `;
      const byTypeResult = await pool.query(byTypeQuery, [
        this.STATUSES.COMPLETED,
        startDate,
        endDate
      ]);

      // Daily/weekly/monthly breakdown
      let dateFormat;
      switch (groupBy) {
        case 'week':
          dateFormat = 'YYYY-WW';
          break;
        case 'month':
          dateFormat = 'YYYY-MM';
          break;
        default:
          dateFormat = 'YYYY-MM-DD';
      }

      const timeSeriesQuery = `
        SELECT 
          TO_CHAR(created_at, '${dateFormat}') as period,
          COUNT(*) as transaction_count,
          COALESCE(SUM(amount), 0) as total_amount,
          COALESCE(SUM(platform_fee), 0) as total_fees
        FROM transactions
        WHERE status = $1
          AND created_at >= $2
          AND created_at <= $3
        GROUP BY period
        ORDER BY period ASC
      `;
      const timeSeriesResult = await pool.query(timeSeriesQuery, [
        this.STATUSES.COMPLETED,
        startDate,
        endDate
      ]);

      return {
        summary: {
          totalFees: parseFloat(feesResult.rows[0].total_fees),
          transactionCount: parseInt(feesResult.rows[0].transaction_count),
          period: { startDate, endDate }
        },
        byType: byTypeResult.rows.map(row => ({
          type: row.type,
          count: parseInt(row.count),
          totalAmount: parseFloat(row.total_amount),
          totalFees: parseFloat(row.total_fees)
        })),
        timeSeries: timeSeriesResult.rows.map(row => ({
          period: row.period,
          transactionCount: parseInt(row.transaction_count),
          totalAmount: parseFloat(row.total_amount),
          totalFees: parseFloat(row.total_fees)
        }))
      };

    } catch (error) {
      logger.error('Error generating platform revenue report', { error: error.message });
      throw error;
    }
  }

  /**
   * Get reader earnings report
   * @param {string} readerId - Reader profile ID
   * @param {Object} options - Report options
   * @returns {Object} Earnings report
   */
  static async getReaderEarningsReport(readerId, options = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date()
      } = options;

      const earningTypes = [
        this.TYPES.READING_PAYMENT,
        this.TYPES.GIFT_RECEIVED,
        this.TYPES.STREAM_TIP_RECEIVED
      ];

      // Summary stats
      const summaryQuery = `
        SELECT 
          COALESCE(SUM(net_amount), 0) as total_earnings,
          COALESCE(SUM(platform_fee), 0) as total_fees,
          COALESCE(SUM(amount), 0) as gross_amount,
          COUNT(*) as transaction_count
        FROM transactions
        WHERE reader_id = $1
          AND type = ANY($2)
          AND status = $3
          AND created_at >= $4
          AND created_at <= $5
      `;
      const summaryResult = await pool.query(summaryQuery, [
        readerId,
        earningTypes,
        this.STATUSES.COMPLETED,
        startDate,
        endDate
      ]);

      // Earnings by type
      const byTypeQuery = `
        SELECT 
          type,
          COUNT(*) as count,
          COALESCE(SUM(net_amount), 0) as total_earnings
        FROM transactions
        WHERE reader_id = $1
          AND type = ANY($2)
          AND status = $3
          AND created_at >= $4
          AND created_at <= $5
        GROUP BY type
      `;
      const byTypeResult = await pool.query(byTypeQuery, [
        readerId,
        earningTypes,
        this.STATUSES.COMPLETED,
        startDate,
        endDate
      ]);

      // Daily breakdown
      const dailyQuery = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as transaction_count,
          COALESCE(SUM(net_amount), 0) as earnings
        FROM transactions
        WHERE reader_id = $1
          AND type = ANY($2)
          AND status = $3
          AND created_at >= $4
          AND created_at <= $5
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;
      const dailyResult = await pool.query(dailyQuery, [
        readerId,
        earningTypes,
        this.STATUSES.COMPLETED,
        startDate,
        endDate
      ]);

      // Top clients
      const topClientsQuery = `
        SELECT 
          t.user_id,
          u.display_name,
          u.profile_image_url,
          COUNT(*) as session_count,
          COALESCE(SUM(t.net_amount), 0) as total_spent
        FROM transactions t
        JOIN users u ON t.user_id = u.id
        WHERE t.reader_id = $1
          AND t.type = ANY($2)
          AND t.status = $3
          AND t.created_at >= $4
          AND t.created_at <= $5
        GROUP BY t.user_id, u.display_name, u.profile_image_url
        ORDER BY total_spent DESC
        LIMIT 10
      `;
      const topClientsResult = await pool.query(topClientsQuery, [
        readerId,
        earningTypes,
        this.STATUSES.COMPLETED,
        startDate,
        endDate
      ]);

      const summary = summaryResult.rows[0];

      return {
        summary: {
          grossAmount: parseFloat(summary.gross_amount),
          platformFees: parseFloat(summary.total_fees),
          netEarnings: parseFloat(summary.total_earnings),
          transactionCount: parseInt(summary.transaction_count),
          period: { startDate, endDate }
        },
        byType: byTypeResult.rows.map(row => ({
          type: row.type,
          count: parseInt(row.count),
          earnings: parseFloat(row.total_earnings)
        })),
        daily: dailyResult.rows.map(row => ({
          date: row.date,
          transactionCount: parseInt(row.transaction_count),
          earnings: parseFloat(row.earnings)
        })),
        topClients: topClientsResult.rows.map(row => ({
          userId: row.user_id,
          displayName: row.display_name,
          profileImage: row.profile_image_url,
          sessionCount: parseInt(row.session_count),
          totalSpent: parseFloat(row.total_spent)
        }))
      };

    } catch (error) {
      logger.error('Error generating reader earnings report', { error: error.message, readerId });
      throw error;
    }
  }

  // ============================================
  // REFUND PROCESSING
  // ============================================

  /**
   * Process a refund for a transaction
   * @param {string} transactionId - Original transaction ID
   * @param {Object} refundData - Refund details
   * @returns {Object} Refund transaction
   */
  static async processRefund(transactionId, refundData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const { amount, reason, initiated_by } = refundData;

      // Get original transaction
      const originalQuery = `SELECT * FROM transactions WHERE id = $1`;
      const originalResult = await client.query(originalQuery, [transactionId]);

      if (originalResult.rows.length === 0) {
        throw new Error('Original transaction not found');
      }

      const original = originalResult.rows[0];

      // Validate refund
      if (original.status === this.STATUSES.REFUNDED) {
        throw new Error('Transaction already refunded');
      }

      if (amount > original.amount) {
        throw new Error('Refund amount exceeds original transaction amount');
      }

      // Determine refund type based on original type
      let refundType;
      switch (original.type) {
        case this.TYPES.READING_PAYMENT:
          refundType = this.TYPES.READING_REFUND;
          break;
        case this.TYPES.PRODUCT_PURCHASE:
          refundType = this.TYPES.PRODUCT_REFUND;
          break;
        default:
          refundType = this.TYPES.ADJUSTMENT;
      }

      // Create refund transaction
      const refundQuery = `
        INSERT INTO transactions (
          user_id, reader_id, session_id, order_id,
          type, amount, currency, status,
          reference, description, metadata,
          original_transaction_id,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10, $11,
          $12,
          NOW(), NOW()
        )
        RETURNING *
      `;

      const refundReference = this.generateReference(refundType);
      const refundValues = [
        original.user_id,
        original.reader_id,
        original.session_id,
        original.order_id,
        refundType,
        -amount, // Negative amount for refund
        original.currency,
        this.STATUSES.PENDING,
        refundReference,
        `Refund: ${reason}`,
        JSON.stringify({ 
          original_transaction_id: transactionId,
          initiated_by,
          reason 
        }),
        transactionId
      ];

      const refundResult = await client.query(refundQuery, refundValues);
      const refundTransaction = refundResult.rows[0];

      // Update original transaction
      await client.query(`
        UPDATE transactions 
        SET status = $1, refunded_at = NOW(), refund_reason = $2, updated_at = NOW()
        WHERE id = $3
      `, [this.STATUSES.REFUNDED, reason, transactionId]);

      // Update user balance
      await client.query(`
        UPDATE users 
        SET balance = balance + $1, updated_at = NOW()
        WHERE id = $2
      `, [amount, original.user_id]);

      // If reader was involved, deduct from their earnings
      if (original.reader_id && original.net_amount > 0) {
        const readerDeduction = (amount / original.amount) * original.net_amount;
        await client.query(`
          UPDATE reader_profiles 
          SET total_earnings = total_earnings - $1, updated_at = NOW()
          WHERE id = $2
        `, [readerDeduction, original.reader_id]);
      }

      await client.query('COMMIT');

      logger.info('Refund processed', { 
        originalTransactionId: transactionId,
        refundTransactionId: refundTransaction.id,
        amount,
        reason
      });

      return this.formatTransaction(refundTransaction);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error processing refund', { error: error.message, transactionId });
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // PAYOUT PROCESSING
  // ============================================

  /**
   * Create a payout request for a reader
   * @param {string} readerId - Reader profile ID
   * @param {number} amount - Payout amount
   * @returns {Object} Payout transaction
   */
  static async createPayoutRequest(readerId, amount) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verify available balance
      const balanceInfo = await this.getReaderPendingBalance(readerId);
      
      if (amount > balanceInfo.availableBalance) {
        throw new Error(`Insufficient balance. Available: $${balanceInfo.availableBalance.toFixed(2)}`);
      }

      // Get reader info
      const readerQuery = `
        SELECT rp.*, u.id as user_id, u.email
        FROM reader_profiles rp
        JOIN users u ON rp.user_id = u.id
        WHERE rp.id = $1
      `;
      const readerResult = await client.query(readerQuery, [readerId]);

      if (readerResult.rows.length === 0) {
        throw new Error('Reader not found');
      }

      const reader = readerResult.rows[0];

      // Verify Stripe Connect account
      if (!reader.stripe_account_id) {
        throw new Error('Reader has not set up payment account');
      }

      // Create payout transaction
      const payoutQuery = `
        INSERT INTO transactions (
          user_id, reader_id, type, amount, currency, status,
          reference, description, metadata,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9,
          NOW(), NOW()
        )
        RETURNING *
      `;

      const reference = this.generateReference(this.TYPES.PAYOUT_REQUEST);
      const payoutValues = [
        reader.user_id,
        readerId,
        this.TYPES.PAYOUT_REQUEST,
        amount,
        'USD',
        this.STATUSES.PENDING,
        reference,
        `Payout request for $${amount.toFixed(2)}`,
        JSON.stringify({
          stripe_account_id: reader.stripe_account_id,
          available_balance: balanceInfo.availableBalance
        })
      ];

      const payoutResult = await client.query(payoutQuery, payoutValues);

      await client.query('COMMIT');

      logger.info('Payout request created', { 
        readerId, 
        amount, 
        transactionId: payoutResult.rows[0].id 
      });

      return this.formatTransaction(payoutResult.rows[0]);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating payout request', { error: error.message, readerId, amount });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process pending payouts (called by scheduled job)
   * @returns {Object} Processing results
   */
  static async processPendingPayouts() {
    const client = await pool.connect();
    
    try {
      // Get pending payout requests
      const pendingQuery = `
        SELECT t.*, rp.stripe_account_id
        FROM transactions t
        JOIN reader_profiles rp ON t.reader_id = rp.id
        WHERE t.type = $1 AND t.status = $2
        ORDER BY t.created_at ASC
        LIMIT 50
      `;

      const pendingResult = await pool.query(pendingQuery, [
        this.TYPES.PAYOUT_REQUEST,
        this.STATUSES.PENDING
      ]);

      const results = {
        processed: 0,
        failed: 0,
        errors: []
      };

      for (const payout of pendingResult.rows) {
        try {
          await client.query('BEGIN');

          // Update status to processing
          await client.query(`
            UPDATE transactions SET status = $1, updated_at = NOW() WHERE id = $2
          `, [this.STATUSES.PROCESSING, payout.id]);

          // Here you would integrate with Stripe to process the actual payout
          // For now, we'll simulate success
          // const stripeTransfer = await stripe.transfers.create({...});

          // Mark as completed
          await client.query(`
            UPDATE transactions 
            SET status = $1, completed_at = NOW(), updated_at = NOW()
            WHERE id = $2
          `, [this.STATUSES.COMPLETED, payout.id]);

          // Create completion record
          const completionQuery = `
            INSERT INTO transactions (
              user_id, reader_id, type, amount, currency, status,
              reference, description, original_transaction_id,
              created_at, updated_at, completed_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9,
              NOW(), NOW(), NOW()
            )
          `;

          await client.query(completionQuery, [
            payout.user_id,
            payout.reader_id,
            this.TYPES.PAYOUT_COMPLETED,
            payout.amount,
            payout.currency,
            this.STATUSES.COMPLETED,
            this.generateReference(this.TYPES.PAYOUT_COMPLETED),
            `Payout completed for request ${payout.reference}`,
            payout.id
          ]);

          await client.query('COMMIT');
          results.processed++;

        } catch (payoutError) {
          await client.query('ROLLBACK');
          
          // Mark as failed
          await pool.query(`
            UPDATE transactions 
            SET status = $1, failed_at = NOW(), failure_reason = $2, updated_at = NOW()
            WHERE id = $3
          `, [this.STATUSES.FAILED, payoutError.message, payout.id]);

          results.failed++;
          results.errors.push({
            transactionId: payout.id,
            error: payoutError.message
          });
        }
      }

      logger.info('Payout processing completed', results);
      return results;

    } catch (error) {
      logger.error('Error processing pending payouts', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // TRANSACTION HISTORY
  // ============================================

  /**
   * Create a history entry for transaction status changes
   * @param {Object} client - Database client
   * @param {string} transactionId - Transaction ID
   * @param {string} status - New status
   * @param {string} note - Status change note
   */
  static async createHistoryEntry(client, transactionId, status, note) {
    const query = `
      INSERT INTO transaction_history (
        transaction_id, status, note, created_at
      ) VALUES ($1, $2, $3, NOW())
    `;

    await client.query(query, [transactionId, status, note]);
  }

  /**
   * Get transaction history
   * @param {string} transactionId - Transaction ID
   * @returns {Array} History entries
   */
  static async getTransactionHistory(transactionId) {
    try {
      const query = `
        SELECT * FROM transaction_history
        WHERE transaction_id = $1
        ORDER BY created_at ASC
      `;

      const result = await pool.query(query, [transactionId]);
      return result.rows;

    } catch (error) {
      logger.error('Error getting transaction history', { error: error.message, transactionId });
      throw error;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Generate unique transaction reference
   * @param {string} type - Transaction type
   * @returns {string} Unique reference
   */
  static generateReference(type) {
    const prefix = type.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Calculate platform fee (30% of transaction)
   * @param {number} amount - Transaction amount
   * @returns {number} Platform fee
   */
  static calculatePlatformFee(amount) {
    const FEE_PERCENTAGE = 0.30; // 30% platform fee
    return Math.round(amount * FEE_PERCENTAGE * 100) / 100;
  }

  /**
   * Check if transaction type is a reader earning
   * @param {string} type - Transaction type
   * @returns {boolean} Is reader earning type
   */
  static isReaderEarningType(type) {
    return [
      this.TYPES.READING_PAYMENT,
      this.TYPES.GIFT_RECEIVED,
      this.TYPES.STREAM_TIP_RECEIVED
    ].includes(type);
  }

  /**
   * Format transaction for API response
   * @param {Object} transaction - Raw transaction data
   * @returns {Object} Formatted transaction
   */
  static formatTransaction(transaction) {
    if (!transaction) return null;

    return {
      id: transaction.id,
      userId: transaction.user_id,
      readerId: transaction.reader_id,
      sessionId: transaction.session_id,
      streamId: transaction.stream_id,
      orderId: transaction.order_id,
      giftId: transaction.gift_id,
      type: transaction.type,
      amount: parseFloat(transaction.amount),
      currency: transaction.currency,
      platformFee: parseFloat(transaction.platform_fee || 0),
      netAmount: parseFloat(transaction.net_amount || transaction.amount),
      paymentMethod: transaction.payment_method,
      stripePaymentIntentId: transaction.stripe_payment_intent_id,
      stripeChargeId: transaction.stripe_charge_id,
      stripeTransferId: transaction.stripe_transfer_id,
      reference: transaction.reference,
      description: transaction.description,
      metadata: typeof transaction.metadata === 'string' 
        ? JSON.parse(transaction.metadata) 
        : transaction.metadata,
      status: transaction.status,
      createdAt: transaction.created_at,
      updatedAt: transaction.updated_at,
      completedAt: transaction.completed_at,
      failedAt: transaction.failed_at,
      failureReason: transaction.failure_reason,
      refundedAt: transaction.refunded_at,
      refundReason: transaction.refund_reason,
      // Related data if joined
      userName: transaction.user_name,
      userEmail: transaction.user_email,
      readerName: transaction.reader_name,
      readerImage: transaction.reader_image,
      clientName: transaction.client_name,
      clientImage: transaction.client_image
    };
  }
}

module.exports = Transaction;