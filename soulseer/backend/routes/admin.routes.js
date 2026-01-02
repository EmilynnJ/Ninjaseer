import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { query, transaction } from '../config/database.js';
import stripeService from '../services/stripe.service.js';

const router = express.Router();

// Create reader account (called from Django admin)
router.post('/readers', async (req, res) => {
  try {
    const {
      clerk_id,
      email,
      display_name,
      bio,
      specialties,
      chat_rate,
      call_rate,
      video_rate
    } = req.body;

    // Create user in database
    await transaction(async (client) => {
      // Create user
      const userResult = await client.query(
        `INSERT INTO users (clerk_id, email, role)
         VALUES ($1, $2, 'reader')
         RETURNING id`,
        [clerk_id, email]
      );

      const userId = userResult.rows[0].id;

      // Create reader profile
      await client.query(
        `INSERT INTO reader_profiles 
         (user_id, display_name, bio, specialties, chat_rate, call_rate, video_rate)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, display_name, bio, JSON.stringify(specialties), chat_rate, call_rate, video_rate]
      );

      // Create Stripe Connect account
      const stripeAccount = await stripeService.createConnectAccount(email, {
        userId,
        displayName: display_name
      });

      // Update reader profile with Stripe account ID
      await client.query(
        'UPDATE reader_profiles SET stripe_account_id = $1 WHERE user_id = $2',
        [stripeAccount.id, userId]
      );
    });

    res.status(201).json({ success: true, message: 'Reader account created' });
  } catch (error) {
    console.error('Error creating reader account:', error);
    res.status(500).json({ error: 'Failed to create reader account' });
  }
});

// Get all users
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { role, limit = 50, offset = 0 } = req.query;

    let queryText = 'SELECT * FROM users WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (role) {
      queryText += ` AND role = $${paramCount}`;
      params.push(role);
      paramCount++;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get platform statistics
router.get('/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'client') as total_clients,
        (SELECT COUNT(*) FROM users WHERE role = 'reader') as total_readers,
        (SELECT COUNT(*) FROM reading_sessions WHERE status = 'completed') as total_sessions,
        (SELECT SUM(total_cost) FROM reading_sessions WHERE status = 'completed') as total_revenue,
        (SELECT SUM(platform_fee) FROM reading_sessions WHERE status = 'completed') as platform_earnings,
        (SELECT COUNT(*) FROM live_streams WHERE status = 'live') as active_streams,
        (SELECT COUNT(*) FROM orders WHERE status = 'completed') as total_orders
    `);

    res.json({ stats: stats.rows[0] });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Get disputed sessions
router.get('/disputes', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT s.*, 
              c.email as client_email,
              r.display_name as reader_name
       FROM reading_sessions s
       JOIN users c ON s.client_id = c.id
       JOIN reader_profiles r ON s.reader_id = r.user_id
       WHERE s.status = 'disputed'
       ORDER BY s.created_at DESC`
    );

    res.json({ disputes: result.rows });
  } catch (error) {
    console.error('Error getting disputes:', error);
    res.status(500).json({ error: 'Failed to get disputes' });
  }
});

// Resolve dispute
router.post('/disputes/:sessionId/resolve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { resolution, refundAmount } = req.body;

    await transaction(async (client) => {
      // Get session details
      const sessionResult = await client.query(
        'SELECT * FROM reading_sessions WHERE id = $1',
        [sessionId]
      );

      if (sessionResult.rows.length === 0) {
        throw new Error('Session not found');
      }

      const session = sessionResult.rows[0];

      if (resolution === 'refund' && refundAmount) {
        // Refund to client
        await client.query(
          'UPDATE users SET balance = balance + $1 WHERE id = $2',
          [refundAmount, session.client_id]
        );

        // Deduct from reader
        await client.query(
          `UPDATE reader_profiles 
           SET pending_payout = pending_payout - $1,
               total_earnings = total_earnings - $1
           WHERE user_id = $2`,
          [refundAmount * 0.70, session.reader_id]
        );

        // Create transaction record
        await client.query(
          `INSERT INTO transactions 
           (user_id, transaction_type, amount, balance_after, description, status)
           VALUES ($1, 'refund', $2, (SELECT balance FROM users WHERE id = $1), $3, 'completed')`,
          [session.client_id, refundAmount, `Refund for disputed session ${sessionId}`]
        );
      }

      // Update session status
      await client.query(
        'UPDATE reading_sessions SET status = $1 WHERE id = $2',
        ['completed', sessionId]
      );
    });

    res.json({ success: true, message: 'Dispute resolved' });
  } catch (error) {
    console.error('Error resolving dispute:', error);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

// Process daily payouts
router.post('/payouts/process', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Get all readers with pending payouts >= $15
    const readersResult = await query(
      `SELECT r.*, u.email
       FROM reader_profiles r
       JOIN users u ON r.user_id = u.id
       WHERE r.pending_payout >= 15.00 AND r.stripe_account_id IS NOT NULL`
    );

    const results = [];

    for (const reader of readersResult.rows) {
      const result = await stripeService.processDailyPayouts(
        reader.user_id,
        parseFloat(reader.pending_payout),
        reader.stripe_account_id
      );

      if (result.success) {
        // Update reader's pending payout
        await query(
          'UPDATE reader_profiles SET pending_payout = 0 WHERE user_id = $1',
          [reader.user_id]
        );

        // Create transaction record
        await query(
          `INSERT INTO transactions 
           (user_id, transaction_type, amount, balance_after, stripe_transfer_id, description, status)
           VALUES ($1, 'payout', $2, 0, $3, $4, 'completed')`,
          [
            reader.user_id,
            result.amount,
            result.transfer.id,
            `Daily payout of $${result.amount}`
          ]
        );
      }

      results.push({
        reader: reader.display_name,
        email: reader.email,
        amount: reader.pending_payout,
        success: result.success,
        message: result.message || 'Payout processed'
      });
    }

    res.json({ results });
  } catch (error) {
    console.error('Error processing payouts:', error);
    res.status(500).json({ error: 'Failed to process payouts' });
  }
});

export default router;