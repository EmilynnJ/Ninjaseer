/**
 * Payment Controller
 * Handles payment and balance operations
 */

import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import stripeService from '../services/stripe.service.js';
import logger from '../utils/logger.js';

class PaymentController {
  /**
   * Add balance to user account
   */
  static async addBalance(req, res) {
    try {
      const userId = req.dbUserId;
      const { amount } = req.body;

      // Validate amount
      if (!amount || amount < 10 || amount > 1000) {
        return res.status(400).json({ 
          error: 'Invalid amount',
          message: 'Amount must be between $10 and $1000'
        });
      }

      // Create Stripe payment intent
      const paymentIntent = await stripeService.createPaymentIntent(
        amount,
        userId,
        'balance_add'
      );

      logger.logPayment('balance_add_initiated', amount, userId, 'pending');

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount
      });
    } catch (error) {
      logger.error('Error in addBalance', error, { userId: req.dbUserId });
      res.status(500).json({ error: 'Failed to initiate payment' });
    }
  }

  /**
   * Confirm balance addition (webhook handler)
   */
  static async confirmBalanceAddition(paymentIntentId, amount, userId) {
    try {
      // Add balance and create transaction
      const transaction = await Transaction.addBalance(
        userId,
        amount,
        paymentIntentId
      );

      logger.logPayment('balance_add_completed', amount, userId, 'completed');

      return transaction;
    } catch (error) {
      logger.error('Error in confirmBalanceAddition', error, { userId, paymentIntentId });
      throw error;
    }
  }

  /**
   * Get user balance
   */
  static async getBalance(req, res) {
    try {
      const userId = req.dbUserId;

      const balance = await User.getBalance(userId);

      res.json({ balance });
    } catch (error) {
      logger.error('Error in getBalance', error, { userId: req.dbUserId });
      res.status(500).json({ error: 'Failed to get balance' });
    }
  }

  /**
   * Get transaction history
   */
  static async getTransactionHistory(req, res) {
    try {
      const userId = req.dbUserId;
      const { limit = 50, offset = 0, type = null, status = null } = req.query;

      const result = await Transaction.getUserHistory(userId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        type,
        status
      });

      res.json(result);
    } catch (error) {
      logger.error('Error in getTransactionHistory', error, { userId: req.dbUserId });
      res.status(500).json({ error: 'Failed to get transaction history' });
    }
  }

  /**
   * Get transaction by ID
   */
  static async getTransactionById(req, res) {
    try {
      const { transactionId } = req.params;
      const userId = req.dbUserId;

      const transaction = await Transaction.findById(transactionId);

      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Verify user owns this transaction
      if (transaction.user_id !== userId && transaction.reader_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      res.json({ transaction });
    } catch (error) {
      logger.error('Error in getTransactionById', error, { userId: req.dbUserId });
      res.status(500).json({ error: 'Failed to get transaction' });
    }
  }

  /**
   * Get transaction statistics
   */
  static async getTransactionStats(req, res) {
    try {
      const userId = req.dbUserId;
      const { startDate = null, endDate = null } = req.query;
      const role = req.userRole === 'reader' ? 'reader' : 'client';

      const stats = await Transaction.getStats(userId, {
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        role
      });

      res.json({ stats });
    } catch (error) {
      logger.error('Error in getTransactionStats', error, { userId: req.dbUserId });
      res.status(500).json({ error: 'Failed to get transaction statistics' });
    }
  }

  /**
   * Request refund
   */
  static async requestRefund(req, res) {
    try {
      const { transactionId } = req.params;
      const { reason } = req.body;
      const userId = req.dbUserId;

      // Get transaction
      const transaction = await Transaction.findById(transactionId);

      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      // Verify user owns this transaction
      if (transaction.user_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Check if refund is allowed (within 24 hours)
      const transactionDate = new Date(transaction.created_at);
      const now = new Date();
      const hoursSince = (now - transactionDate) / (1000 * 60 * 60);

      if (hoursSince > 24) {
        return res.status(400).json({ 
          error: 'Refund period expired',
          message: 'Refunds are only available within 24 hours of transaction'
        });
      }

      // Process refund
      const refund = await Transaction.processRefund(transactionId, null, reason);

      logger.logPayment('refund_processed', refund.amount, userId, 'completed');

      res.json({
        refund,
        message: 'Refund processed successfully'
      });
    } catch (error) {
      logger.error('Error in requestRefund', error, { userId: req.dbUserId });
      res.status(500).json({ error: error.message || 'Failed to process refund' });
    }
  }

  /**
   * Stripe webhook handler
   */
  static async handleWebhook(req, res) {
    try {
      const sig = req.headers['stripe-signature'];
      const event = stripeService.constructWebhookEvent(req.body, sig);

      logger.info('Stripe webhook received', { type: event.type });

      switch (event.type) {
        case 'payment_intent.succeeded':
          await PaymentController.handlePaymentSuccess(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await PaymentController.handlePaymentFailure(event.data.object);
          break;

        default:
          logger.debug('Unhandled webhook event', { type: event.type });
      }

      res.json({ received: true });
    } catch (error) {
      logger.error('Error in handleWebhook', error);
      res.status(400).json({ error: 'Webhook error' });
    }
  }

  /**
   * Handle successful payment
   */
  static async handlePaymentSuccess(paymentIntent) {
    try {
      const { id, amount, metadata } = paymentIntent;
      const userId = parseInt(metadata.userId);
      const amountInDollars = amount / 100;

      // Find or create transaction
      let transaction = await Transaction.findByStripePaymentIntent(id);

      if (!transaction) {
        transaction = await Transaction.addBalance(userId, amountInDollars, id);
      } else if (transaction.status !== 'completed') {
        await Transaction.updateStatus(transaction.id, 'completed');
        await User.updateBalance(userId, amountInDollars, 'add');
      }

      logger.logPayment('payment_succeeded', amountInDollars, userId, 'completed');
    } catch (error) {
      logger.error('Error in handlePaymentSuccess', error);
      throw error;
    }
  }

  /**
   * Handle failed payment
   */
  static async handlePaymentFailure(paymentIntent) {
    try {
      const { id, metadata } = paymentIntent;
      const userId = parseInt(metadata.userId);

      const transaction = await Transaction.findByStripePaymentIntent(id);

      if (transaction) {
        await Transaction.updateStatus(transaction.id, 'failed', {
          failure_reason: paymentIntent.last_payment_error?.message
        });
      }

      logger.logPayment('payment_failed', 0, userId, 'failed');
    } catch (error) {
      logger.error('Error in handlePaymentFailure', error);
      throw error;
    }
  }

  /**
   * Get all transactions (admin only)
   */
  static async getAllTransactions(req, res) {
    try {
      const { limit = 50, offset = 0, type = null, status = null } = req.query;

      const result = await Transaction.findAll({
        limit: parseInt(limit),
        offset: parseInt(offset),
        type,
        status
      });

      res.json(result);
    } catch (error) {
      logger.error('Error in getAllTransactions', error);
      res.status(500).json({ error: 'Failed to get transactions' });
    }
  }

  /**
   * Get platform statistics (admin only)
   */
  static async getPlatformStats(req, res) {
    try {
      const { startDate = null, endDate = null } = req.query;

      const stats = await Transaction.getPlatformStats({
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null
      });

      res.json({ stats });
    } catch (error) {
      logger.error('Error in getPlatformStats', error);
      res.status(500).json({ error: 'Failed to get platform statistics' });
    }
  }
}

export default PaymentController;