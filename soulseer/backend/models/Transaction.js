/**
 * Transaction Model
 * Handles all transaction and payment operations
 */

import { query, transaction } from '../config/database.js';

class Transaction {
  /**
   * Create a new transaction
   */
  static async create({
    userId,
    readerId = null,
    sessionId = null,
    amount,
    type,
    status = 'pending',
    stripePaymentIntentId = null,
    metadata = {}
  }) {
    const result = await query(
      `INSERT INTO transactions (
        user_id, reader_id, session_id, amount, type, status,
        stripe_payment_intent_id, metadata, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *`,
      [userId, readerId, sessionId, amount, type, status, stripePaymentIntentId, JSON.stringify(metadata)]
    );
    return result.rows[0];
  }

  /**
   * Find transaction by ID
   */
  static async findById(transactionId) {
    const result = await query(
      `SELECT t.*,
              u.email as user_email,
              u.display_name as user_name
       FROM transactions t
       JOIN users u ON t.user_id = u.id
       WHERE t.id = $1`,
      [transactionId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find transaction by Stripe Payment Intent ID
   */
  static async findByStripePaymentIntent(paymentIntentId) {
    const result = await query(
      'SELECT * FROM transactions WHERE stripe_payment_intent_id = $1',
      [paymentIntentId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update transaction status
   */
  static async updateStatus(transactionId, status, metadata = {}) {
    const result = await query(
      `UPDATE transactions 
       SET status = $1,
           metadata = metadata || $2::jsonb,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, JSON.stringify(metadata), transactionId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get user transaction history
   */
  static async getUserHistory(userId, { limit = 50, offset = 0, type = null, status = null }) {
    let queryText = `
      SELECT t.*,
             r.display_name as reader_name,
             COUNT(*) OVER() as total_count
      FROM transactions t
      LEFT JOIN reader_profiles r ON t.reader_id = r.user_id
      WHERE t.user_id = $1
    `;
    const params = [userId];

    if (type) {
      params.push(type);
      queryText += ` AND t.type = $${params.length}`;
    }

    if (status) {
      params.push(status);
      queryText += ` AND t.status = $${params.length}`;
    }

    queryText += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);
    
    return {
      transactions: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Get reader earnings history
   */
  static async getReaderEarnings(readerId, { limit = 50, offset = 0, startDate = null, endDate = null }) {
    let queryText = `
      SELECT t.*,
             u.email as client_email,
             u.display_name as client_name,
             COUNT(*) OVER() as total_count
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.reader_id = $1 
        AND t.type IN ('session_earning', 'tip_earning')
        AND t.status = 'completed'
    `;
    const params = [readerId];

    if (startDate) {
      params.push(startDate);
      queryText += ` AND t.created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      queryText += ` AND t.created_at <= $${params.length}`;
    }

    queryText += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);
    
    return {
      transactions: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Get transaction statistics
   */
  static async getStats(userId, { startDate = null, endDate = null, role = 'client' }) {
    let queryText = `
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transactions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions,
        COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_transactions,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_amount,
        COALESCE(AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END), 0) as avg_amount
      FROM transactions
      WHERE 1=1
    `;
    const params = [];

    if (role === 'client') {
      params.push(userId);
      queryText += ` AND user_id = $${params.length}`;
    } else if (role === 'reader') {
      params.push(userId);
      queryText += ` AND reader_id = $${params.length}`;
    }

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
   * Process balance addition
   */
  static async addBalance(userId, amount, stripePaymentIntentId) {
    return await transaction(async (client) => {
      // Create transaction record
      const transactionResult = await client.query(
        `INSERT INTO transactions (
          user_id, amount, type, status, stripe_payment_intent_id, created_at, updated_at
        )
        VALUES ($1, $2, 'balance_add', 'completed', $3, NOW(), NOW())
        RETURNING *`,
        [userId, amount, stripePaymentIntentId]
      );

      // Update user balance
      await client.query(
        `UPDATE users 
         SET balance = balance + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [amount, userId]
      );

      return transactionResult.rows[0];
    });
  }

  /**
   * Process refund
   */
  static async processRefund(transactionId, refundAmount = null, reason = null) {
    return await transaction(async (client) => {
      // Get original transaction
      const originalResult = await client.query(
        'SELECT * FROM transactions WHERE id = $1 FOR UPDATE',
        [transactionId]
      );

      if (originalResult.rows.length === 0) {
        throw new Error('Transaction not found');
      }

      const original = originalResult.rows[0];

      if (original.status === 'refunded') {
        throw new Error('Transaction already refunded');
      }

      const amountToRefund = refundAmount || parseFloat(original.amount);

      // Update original transaction
      await client.query(
        `UPDATE transactions 
         SET status = 'refunded',
             metadata = metadata || $1::jsonb,
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify({ refund_amount: amountToRefund, refund_reason: reason }), transactionId]
      );

      // Create refund transaction
      const refundResult = await client.query(
        `INSERT INTO transactions (
          user_id, reader_id, session_id, amount, type, status,
          metadata, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, 'refund', 'completed', $5, NOW(), NOW())
        RETURNING *`,
        [
          original.user_id,
          original.reader_id,
          original.session_id,
          amountToRefund,
          JSON.stringify({ original_transaction_id: transactionId, reason })
        ]
      );

      // Update user balance
      await client.query(
        `UPDATE users 
         SET balance = balance + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [amountToRefund, original.user_id]
      );

      // If reader was involved, deduct from their balance
      if (original.reader_id) {
        const readerRefund = amountToRefund * 0.7; // 70% that reader received
        await client.query(
          `UPDATE users 
           SET balance = balance - $1,
               updated_at = NOW()
           WHERE id = $2`,
          [readerRefund, original.reader_id]
        );
      }

      return refundResult.rows[0];
    });
  }

  /**
   * Get all transactions (admin)
   */
  static async findAll({ limit = 50, offset = 0, type = null, status = null }) {
    let queryText = `
      SELECT t.*,
             u.email as user_email,
             u.display_name as user_name,
             r.display_name as reader_name,
             COUNT(*) OVER() as total_count
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN reader_profiles r ON t.reader_id = r.user_id
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      params.push(type);
      queryText += ` AND t.type = $${params.length}`;
    }

    if (status) {
      params.push(status);
      queryText += ` AND t.status = $${params.length}`;
    }

    queryText += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);
    
    return {
      transactions: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Get platform revenue statistics
   */
  static async getPlatformStats({ startDate = null, endDate = null }) {
    let queryText = `
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(CASE WHEN type = 'session_payment' AND status = 'completed' THEN amount ELSE 0 END), 0) as total_session_revenue,
        COALESCE(SUM(CASE WHEN type = 'balance_add' AND status = 'completed' THEN amount ELSE 0 END), 0) as total_balance_added,
        COALESCE(SUM(CASE WHEN type = 'refund' AND status = 'completed' THEN amount ELSE 0 END), 0) as total_refunded,
        COALESCE(SUM(CASE WHEN type = 'session_payment' AND status = 'completed' THEN amount * 0.3 ELSE 0 END), 0) as platform_commission
      FROM transactions
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
}

export default Transaction;