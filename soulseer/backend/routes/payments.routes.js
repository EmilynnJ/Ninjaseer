import express from 'express';
import { requireAuth, requireClient } from '../middleware/auth.js';
import stripeService from '../services/stripe.service.js';
import { query, transaction } from '../config/database.js';

const router = express.Router();

// Add balance to client account
router.post('/add-balance', requireAuth, requireClient, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.dbUserId;

    // Only allow specific amounts: $10, $20, $30, $50, $100
    const allowedAmounts = [10, 20, 30, 50, 100];
    if (!allowedAmounts.includes(Number(amount))) {
      return res.status(400).json({ 
        error: 'Invalid amount. Please select $10, $20, $30, $50, or $100',
        allowedAmounts 
      });
    }

    // Get or create Stripe customer
    const userResult = await query(
      'SELECT email, clerk_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Create payment intent
    const paymentIntent = await stripeService.createPaymentIntent(
      amount,
      user.clerk_id,
      {
        userId,
        type: 'balance_add'
      }
    );

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Error adding balance:', error);
    res.status(500).json({ error: 'Failed to add balance' });
  }
});

// Confirm balance addition (webhook or manual)
router.post('/confirm-balance', requireAuth, requireClient, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const userId = req.dbUserId;

    // Verify payment intent with Stripe
    const stripe = await import('stripe').then(m => m.default(process.env.STRIPE_SECRET_KEY));
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    const amount = paymentIntent.amount / 100; // Convert from cents

    // Update user balance
    await transaction(async (client) => {
      const result = await client.query(
        'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance',
        [amount, userId]
      );

      // Create transaction record
      await client.query(
        `INSERT INTO transactions 
         (user_id, transaction_type, amount, balance_after, stripe_payment_intent_id, description, status)
         VALUES ($1, 'deposit', $2, $3, $4, $5, 'completed')`,
        [userId, amount, result.rows[0].balance, paymentIntentId, `Balance deposit of $${amount}`]
      );
    });

    res.json({ success: true, message: 'Balance added successfully' });
  } catch (error) {
    console.error('Error confirming balance:', error);
    res.status(500).json({ error: 'Failed to confirm balance' });
  }
});

// Get user balance
router.get('/balance', requireAuth, async (req, res) => {
  try {
    const userId = req.dbUserId;

    const result = await query(
      'SELECT balance FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ balance: parseFloat(result.rows[0].balance) });
  } catch (error) {
    console.error('Error getting balance:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// Get transaction history
router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const userId = req.dbUserId;
    const { limit = 50, offset = 0, type } = req.query;

    let queryText = `
      SELECT * FROM transactions 
      WHERE user_id = $1
    `;
    const params = [userId];

    if (type) {
      queryText += ` AND transaction_type = $2`;
      params.push(type);
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    res.json({ transactions: result.rows });
  } catch (error) {
    console.error('Error getting transactions:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// Request refund
router.post('/refund', requireAuth, async (req, res) => {
  try {
    const { sessionId, reason } = req.body;
    const userId = req.dbUserId;

    // Get session
    const sessionResult = await query(
      'SELECT * FROM reading_sessions WHERE id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Verify user is the client
    if (session.client_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if session is eligible for refund (within 24 hours)
    const hoursSinceSession = (Date.now() - new Date(session.end_time)) / (1000 * 60 * 60);
    if (hoursSinceSession > 24) {
      return res.status(400).json({ error: 'Refund period has expired' });
    }

    // Update session status to disputed
    await query(
      'UPDATE reading_sessions SET status = $1 WHERE id = $2',
      ['disputed', sessionId]
    );

    res.json({ 
      success: true, 
      message: 'Refund request submitted. An administrator will review your request.' 
    });
  } catch (error) {
    console.error('Error requesting refund:', error);
    res.status(500).json({ error: 'Failed to request refund' });
  }
});

// Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const event = stripeService.verifyWebhookSignature(req.body, sig);

    switch (event.type) {
      case 'payment_intent.succeeded':
        // Handle successful payment
        console.log('Payment succeeded:', event.data.object.id);
        break;

      case 'payment_intent.payment_failed':
        // Handle failed payment
        console.log('Payment failed:', event.data.object.id);
        break;

      case 'transfer.created':
        // Handle reader payout
        console.log('Transfer created:', event.data.object.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
});

export default router;