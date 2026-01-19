/**
 * Payment Controller - Enterprise Level
 * Complete payment management endpoints for SoulSeer platform
 */

const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Reader = require('../models/Reader');
const Notification = require('../models/Notification');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { logger } = require('../utils/logger');

class PaymentController {
  /**
   * Get available balance options
   * GET /api/payments/balance-options
   */
  static async getBalanceOptions(req, res) {
    try {
      const options = [
        { amount: 10, label: '$10', bonus: 0 },
        { amount: 20, label: '$20', bonus: 0 },
        { amount: 30, label: '$30', bonus: 0 },
        { amount: 50, label: '$50', bonus: 2.50, bonusLabel: '+$2.50 bonus' },
        { amount: 100, label: '$100', bonus: 10, bonusLabel: '+$10 bonus' }
      ];

      return successResponse(res, { options });

    } catch (error) {
      logger.error('Error getting balance options', { error: error.message });
      return errorResponse(res, 'Failed to get balance options', 500);
    }
  }

  /**
   * Create payment intent for adding balance
   * POST /api/payments/create-intent
   */
  static async createPaymentIntent(req, res) {
    try {
      const userId = req.auth.userId;
      const { amount } = req.body;

      // Validate amount
      const validAmounts = [10, 20, 30, 50, 100];
      if (!validAmounts.includes(amount)) {
        return errorResponse(res, 'Invalid amount', 400);
      }

      const stripeService = require('../services/stripe.service');
      
      // Get or create Stripe customer
      const user = await User.findById(userId);
      let stripeCustomerId = user.stripeCustomerId;

      if (!stripeCustomerId) {
        const customer = await stripeService.createCustomer(userId, user.email, user.displayName);
        stripeCustomerId = customer.id;
        await User.update(userId, { stripe_customer_id: stripeCustomerId });
      }

      // Create payment intent
      const paymentIntent = await stripeService.createPaymentIntent(
        amount * 100, // Convert to cents
        'usd',
        stripeCustomerId,
        {
          user_id: userId,
          type: 'balance_add'
        }
      );

      return successResponse(res, {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount
      });

    } catch (error) {
      logger.error('Error creating payment intent', { error: error.message });
      return errorResponse(res, 'Failed to create payment', 500);
    }
  }

  /**
   * Confirm payment and add balance
   * POST /api/payments/confirm
   */
  static async confirmPayment(req, res) {
    try {
      const userId = req.auth.userId;
      const { payment_intent_id } = req.body;

      if (!payment_intent_id) {
        return errorResponse(res, 'Payment intent ID is required', 400);
      }

      const stripeService = require('../services/stripe.service');
      
      // Verify payment intent
      const paymentIntent = await stripeService.retrievePaymentIntent(payment_intent_id);

      if (paymentIntent.status !== 'succeeded') {
        return errorResponse(res, 'Payment not completed', 400);
      }

      // Check if already processed
      const existingTransaction = await Transaction.findByStripePaymentIntent(payment_intent_id);
      if (existingTransaction) {
        return errorResponse(res, 'Payment already processed', 400);
      }

      const amount = paymentIntent.amount / 100; // Convert from cents

      // Calculate bonus
      let bonus = 0;
      if (amount >= 100) bonus = 10;
      else if (amount >= 50) bonus = 2.50;

      const totalCredit = amount + bonus;

      // Add to user balance
      await User.addBalance(userId, totalCredit);

      // Create transaction record
      const transaction = await Transaction.create({
        user_id: userId,
        type: Transaction.TYPES.BALANCE_ADD,
        amount: totalCredit,
        payment_method: 'stripe_card',
        stripe_payment_intent_id: payment_intent_id,
        status: Transaction.STATUSES.COMPLETED,
        description: bonus > 0 
          ? `Added $${amount} + $${bonus} bonus to balance`
          : `Added $${amount} to balance`,
        metadata: { original_amount: amount, bonus }
      });

      // Send notification
      await Notification.create({
        user_id: userId,
        type: Notification.TYPES.PAYMENT_RECEIVED,
        title: 'Funds Added Successfully',
        content: bonus > 0
          ? `$${totalCredit.toFixed(2)} has been added to your balance (includes $${bonus.toFixed(2)} bonus!)`
          : `$${totalCredit.toFixed(2)} has been added to your balance`,
        priority: Notification.PRIORITIES.NORMAL
      });

      // Get updated balance
      const user = await User.findById(userId);

      return successResponse(res, {
        message: 'Payment successful',
        transaction,
        newBalance: user.balance,
        bonus
      });

    } catch (error) {
      logger.error('Error confirming payment', { error: error.message });
      return errorResponse(res, 'Failed to confirm payment', 500);
    }
  }

  /**
   * Get saved payment methods
   * GET /api/payments/methods
   */
  static async getPaymentMethods(req, res) {
    try {
      const userId = req.auth.userId;

      const user = await User.findById(userId);
      if (!user.stripeCustomerId) {
        return successResponse(res, { paymentMethods: [] });
      }

      const stripeService = require('../services/stripe.service');
      const paymentMethods = await stripeService.listPaymentMethods(user.stripeCustomerId);

      return successResponse(res, {
        paymentMethods: paymentMethods.map(pm => ({
          id: pm.id,
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
          isDefault: pm.id === user.defaultPaymentMethodId
        }))
      });

    } catch (error) {
      logger.error('Error getting payment methods', { error: error.message });
      return errorResponse(res, 'Failed to get payment methods', 500);
    }
  }

  /**
   * Add payment method
   * POST /api/payments/methods
   */
  static async addPaymentMethod(req, res) {
    try {
      const userId = req.auth.userId;
      const { payment_method_id, set_default = false } = req.body;

      if (!payment_method_id) {
        return errorResponse(res, 'Payment method ID is required', 400);
      }

      const stripeService = require('../services/stripe.service');
      const user = await User.findById(userId);

      // Get or create customer
      let stripeCustomerId = user.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripeService.createCustomer(userId, user.email, user.displayName);
        stripeCustomerId = customer.id;
        await User.update(userId, { stripe_customer_id: stripeCustomerId });
      }

      // Attach payment method to customer
      await stripeService.attachPaymentMethod(payment_method_id, stripeCustomerId);

      // Set as default if requested or if first payment method
      if (set_default || !user.defaultPaymentMethodId) {
        await stripeService.setDefaultPaymentMethod(stripeCustomerId, payment_method_id);
        await User.update(userId, { default_payment_method_id: payment_method_id });
      }

      return successResponse(res, {
        message: 'Payment method added successfully'
      });

    } catch (error) {
      logger.error('Error adding payment method', { error: error.message });
      return errorResponse(res, 'Failed to add payment method', 500);
    }
  }

  /**
   * Remove payment method
   * DELETE /api/payments/methods/:methodId
   */
  static async removePaymentMethod(req, res) {
    try {
      const userId = req.auth.userId;
      const { methodId } = req.params;

      const stripeService = require('../services/stripe.service');
      
      // Detach payment method
      await stripeService.detachPaymentMethod(methodId);

      // If it was the default, clear it
      const user = await User.findById(userId);
      if (user.defaultPaymentMethodId === methodId) {
        await User.update(userId, { default_payment_method_id: null });
      }

      return successResponse(res, {
        message: 'Payment method removed successfully'
      });

    } catch (error) {
      logger.error('Error removing payment method', { error: error.message });
      return errorResponse(res, 'Failed to remove payment method', 500);
    }
  }

  /**
   * Set default payment method
   * PUT /api/payments/methods/:methodId/default
   */
  static async setDefaultPaymentMethod(req, res) {
    try {
      const userId = req.auth.userId;
      const { methodId } = req.params;

      const user = await User.findById(userId);
      if (!user.stripeCustomerId) {
        return errorResponse(res, 'No payment methods found', 400);
      }

      const stripeService = require('../services/stripe.service');
      await stripeService.setDefaultPaymentMethod(user.stripeCustomerId, methodId);
      await User.update(userId, { default_payment_method_id: methodId });

      return successResponse(res, {
        message: 'Default payment method updated'
      });

    } catch (error) {
      logger.error('Error setting default payment method', { error: error.message });
      return errorResponse(res, 'Failed to update default payment method', 500);
    }
  }

  /**
   * Get transaction history
   * GET /api/payments/transactions
   */
  static async getTransactions(req, res) {
    try {
      const userId = req.auth.userId;
      const {
        page = 1,
        limit = 20,
        type,
        status,
        start_date,
        end_date
      } = req.query;

      const result = await Transaction.getUserTransactions(userId, {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        type: type || null,
        status: status || null,
        startDate: start_date ? new Date(start_date) : null,
        endDate: end_date ? new Date(end_date) : null
      });

      return paginatedResponse(res, result.transactions, result.pagination);

    } catch (error) {
      logger.error('Error getting transactions', { error: error.message });
      return errorResponse(res, 'Failed to get transactions', 500);
    }
  }

  /**
   * Get transaction by ID
   * GET /api/payments/transactions/:transactionId
   */
  static async getTransaction(req, res) {
    try {
      const userId = req.auth.userId;
      const { transactionId } = req.params;

      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        return errorResponse(res, 'Transaction not found', 404);
      }

      // Verify ownership
      if (transaction.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      // Get transaction history
      const history = await Transaction.getTransactionHistory(transactionId);

      return successResponse(res, {
        transaction,
        history
      });

    } catch (error) {
      logger.error('Error getting transaction', { error: error.message });
      return errorResponse(res, 'Failed to get transaction', 500);
    }
  }

  /**
   * Request refund
   * POST /api/payments/transactions/:transactionId/refund
   */
  static async requestRefund(req, res) {
    try {
      const userId = req.auth.userId;
      const { transactionId } = req.params;
      const { reason } = req.body;

      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        return errorResponse(res, 'Transaction not found', 404);
      }

      // Verify ownership
      if (transaction.userId !== userId) {
        return errorResponse(res, 'Not authorized', 403);
      }

      // Check if refundable
      const refundableTypes = [
        Transaction.TYPES.READING_PAYMENT,
        Transaction.TYPES.PRODUCT_PURCHASE
      ];

      if (!refundableTypes.includes(transaction.type)) {
        return errorResponse(res, 'This transaction type is not refundable', 400);
      }

      if (transaction.status === Transaction.STATUSES.REFUNDED) {
        return errorResponse(res, 'Transaction already refunded', 400);
      }

      // Check time limit (7 days)
      const daysSinceTransaction = (Date.now() - new Date(transaction.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceTransaction > 7) {
        return errorResponse(res, 'Refund window has expired (7 days)', 400);
      }

      // Process refund
      const refund = await Transaction.processRefund(transactionId, {
        amount: transaction.amount,
        reason,
        initiated_by: userId
      });

      // Send notification
      await Notification.create({
        user_id: userId,
        type: Notification.TYPES.REFUND_PROCESSED,
        title: 'Refund Processed',
        content: `$${Math.abs(refund.amount).toFixed(2)} has been refunded to your balance`,
        target_type: 'transaction',
        target_id: refund.id
      });

      return successResponse(res, {
        message: 'Refund processed successfully',
        refund
      });

    } catch (error) {
      logger.error('Error processing refund', { error: error.message });
      return errorResponse(res, error.message || 'Failed to process refund', 500);
    }
  }

  /**
   * Get balance history
   * GET /api/payments/balance-history
   */
  static async getBalanceHistory(req, res) {
    try {
      const userId = req.auth.userId;
      const { page = 1, limit = 20 } = req.query;

      const result = await Transaction.getUserBalanceHistory(userId, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      // Get current balance
      const user = await User.findById(userId);

      return successResponse(res, {
        currentBalance: user.balance,
        transactions: result.transactions,
        pagination: result.pagination
      });

    } catch (error) {
      logger.error('Error getting balance history', { error: error.message });
      return errorResponse(res, 'Failed to get balance history', 500);
    }
  }

  // ============================================
  // READER PAYMENT ENDPOINTS
  // ============================================

  /**
   * Get reader earnings
   * GET /api/payments/earnings
   */
  static async getEarnings(req, res) {
    try {
      const userId = req.auth.userId;
      const { start_date, end_date } = req.query;

      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      const earnings = await Transaction.getReaderEarningsReport(reader.id, {
        startDate: start_date ? new Date(start_date) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: end_date ? new Date(end_date) : new Date()
      });

      return successResponse(res, earnings);

    } catch (error) {
      logger.error('Error getting earnings', { error: error.message });
      return errorResponse(res, 'Failed to get earnings', 500);
    }
  }

  /**
   * Get reader pending balance
   * GET /api/payments/pending-balance
   */
  static async getPendingBalance(req, res) {
    try {
      const userId = req.auth.userId;

      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      const balance = await Transaction.getReaderPendingBalance(reader.id);

      return successResponse(res, { balance });

    } catch (error) {
      logger.error('Error getting pending balance', { error: error.message });
      return errorResponse(res, 'Failed to get pending balance', 500);
    }
  }

  /**
   * Request payout
   * POST /api/payments/payout
   */
  static async requestPayout(req, res) {
    try {
      const userId = req.auth.userId;
      const { amount } = req.body;

      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      if (!reader.stripeAccountId) {
        return errorResponse(res, 'Please set up your payment account first', 400);
      }

      // Minimum payout amount
      if (!amount || amount < 25) {
        return errorResponse(res, 'Minimum payout amount is $25', 400);
      }

      // Check available balance
      const balance = await Transaction.getReaderPendingBalance(reader.id);
      if (amount > balance.availableBalance) {
        return errorResponse(res, `Insufficient balance. Available: $${balance.availableBalance.toFixed(2)}`, 400);
      }

      // Create payout request
      const payout = await Transaction.createPayoutRequest(reader.id, amount);

      // Send notification
      await Notification.create({
        user_id: userId,
        type: Notification.TYPES.PAYOUT_PROCESSED,
        title: 'Payout Requested',
        content: `Your payout request for $${amount.toFixed(2)} has been submitted and will be processed within 1-3 business days`,
        target_type: 'transaction',
        target_id: payout.id
      });

      return successResponse(res, {
        message: 'Payout request submitted',
        payout,
        remainingBalance: balance.availableBalance - amount
      });

    } catch (error) {
      logger.error('Error requesting payout', { error: error.message });
      return errorResponse(res, error.message || 'Failed to request payout', 500);
    }
  }

  /**
   * Get payout history
   * GET /api/payments/payouts
   */
  static async getPayouts(req, res) {
    try {
      const userId = req.auth.userId;
      const { page = 1, limit = 20 } = req.query;

      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      const result = await Transaction.getReaderPayouts(reader.id, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return paginatedResponse(res, result.payouts, result.pagination);

    } catch (error) {
      logger.error('Error getting payouts', { error: error.message });
      return errorResponse(res, 'Failed to get payouts', 500);
    }
  }

  /**
   * Setup Stripe Connect account
   * POST /api/payments/connect/setup
   */
  static async setupStripeConnect(req, res) {
    try {
      const userId = req.auth.userId;

      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      const stripeService = require('../services/stripe.service');
      const result = await stripeService.createConnectAccount(reader.id, userId);

      // Save account ID
      await Reader.update(reader.id, { stripe_account_id: result.accountId });

      return successResponse(res, {
        message: 'Stripe Connect setup initiated',
        onboardingUrl: result.onboardingUrl
      });

    } catch (error) {
      logger.error('Error setting up Stripe Connect', { error: error.message });
      return errorResponse(res, 'Failed to setup payment account', 500);
    }
  }

  /**
   * Get Stripe Connect onboarding link
   * GET /api/payments/connect/onboarding
   */
  static async getConnectOnboarding(req, res) {
    try {
      const userId = req.auth.userId;

      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      if (!reader.stripeAccountId) {
        return errorResponse(res, 'Stripe account not created', 400);
      }

      const stripeService = require('../services/stripe.service');
      const link = await stripeService.createAccountLink(reader.stripeAccountId);

      return successResponse(res, {
        onboardingUrl: link.url
      });

    } catch (error) {
      logger.error('Error getting onboarding link', { error: error.message });
      return errorResponse(res, 'Failed to get onboarding link', 500);
    }
  }

  /**
   * Get Stripe Connect dashboard link
   * GET /api/payments/connect/dashboard
   */
  static async getConnectDashboard(req, res) {
    try {
      const userId = req.auth.userId;

      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      if (!reader.stripeAccountId) {
        return errorResponse(res, 'Payment account not set up', 400);
      }

      const stripeService = require('../services/stripe.service');
      const link = await stripeService.createDashboardLink(reader.stripeAccountId);

      return successResponse(res, {
        dashboardUrl: link.url
      });

    } catch (error) {
      logger.error('Error getting dashboard link', { error: error.message });
      return errorResponse(res, 'Failed to get dashboard link', 500);
    }
  }

  /**
   * Get Stripe Connect account status
   * GET /api/payments/connect/status
   */
  static async getConnectStatus(req, res) {
    try {
      const userId = req.auth.userId;

      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      if (!reader.stripeAccountId) {
        return successResponse(res, {
          status: 'not_created',
          message: 'Payment account not set up'
        });
      }

      const stripeService = require('../services/stripe.service');
      const account = await stripeService.retrieveConnectAccount(reader.stripeAccountId);

      return successResponse(res, {
        status: account.charges_enabled ? 'active' : 'pending',
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        requirements: account.requirements
      });

    } catch (error) {
      logger.error('Error getting connect status', { error: error.message });
      return errorResponse(res, 'Failed to get account status', 500);
    }
  }

  // ============================================
  // WEBHOOK HANDLERS
  // ============================================

  /**
   * Handle Stripe webhooks
   * POST /api/payments/webhook
   */
  static async handleWebhook(req, res) {
    try {
      const stripeService = require('../services/stripe.service');
      const sig = req.headers['stripe-signature'];
      
      const event = stripeService.constructWebhookEvent(req.rawBody, sig);

      logger.info('Stripe webhook received', { type: event.type });

      switch (event.type) {
        case 'payment_intent.succeeded':
          await PaymentController.handlePaymentSuccess(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await PaymentController.handlePaymentFailure(event.data.object);
          break;

        case 'account.updated':
          await PaymentController.handleAccountUpdate(event.data.object);
          break;

        case 'payout.paid':
          await PaymentController.handlePayoutPaid(event.data.object);
          break;

        case 'payout.failed':
          await PaymentController.handlePayoutFailed(event.data.object);
          break;

        case 'charge.dispute.created':
          await PaymentController.handleDisputeCreated(event.data.object);
          break;

        default:
          logger.info('Unhandled webhook event', { type: event.type });
      }

      return res.json({ received: true });

    } catch (error) {
      logger.error('Webhook error', { error: error.message });
      return res.status(400).json({ error: error.message });
    }
  }

  /**
   * Handle successful payment
   * @private
   */
  static async handlePaymentSuccess(paymentIntent) {
    try {
      const { user_id, type } = paymentIntent.metadata;

      if (type === 'balance_add') {
        // Already handled in confirmPayment
        logger.info('Balance add payment confirmed', { paymentIntentId: paymentIntent.id });
      }

    } catch (error) {
      logger.error('Error handling payment success', { error: error.message });
    }
  }

  /**
   * Handle failed payment
   * @private
   */
  static async handlePaymentFailure(paymentIntent) {
    try {
      const { user_id } = paymentIntent.metadata;

      if (user_id) {
        await Notification.create({
          user_id,
          type: Notification.TYPES.PAYMENT_SENT,
          title: 'Payment Failed',
          content: 'Your payment could not be processed. Please try again or use a different payment method.',
          priority: Notification.PRIORITIES.HIGH
        });
      }

    } catch (error) {
      logger.error('Error handling payment failure', { error: error.message });
    }
  }

  /**
   * Handle Connect account update
   * @private
   */
  static async handleAccountUpdate(account) {
    try {
      const reader = await Reader.findByStripeAccountId(account.id);
      if (!reader) return;

      // Update reader's payout status
      await Reader.update(reader.id, {
        stripe_charges_enabled: account.charges_enabled,
        stripe_payouts_enabled: account.payouts_enabled
      });

      if (account.charges_enabled && account.payouts_enabled) {
        await Notification.create({
          user_id: reader.userId,
          type: Notification.TYPES.ACCOUNT_UPDATE,
          title: 'Payment Account Ready',
          content: 'Your payment account is now fully set up. You can start receiving payments!',
          priority: Notification.PRIORITIES.HIGH
        });
      }

    } catch (error) {
      logger.error('Error handling account update', { error: error.message });
    }
  }

  /**
   * Handle payout paid
   * @private
   */
  static async handlePayoutPaid(payout) {
    try {
      // Find the transaction and mark as completed
      logger.info('Payout paid', { payoutId: payout.id });

    } catch (error) {
      logger.error('Error handling payout paid', { error: error.message });
    }
  }

  /**
   * Handle payout failed
   * @private
   */
  static async handlePayoutFailed(payout) {
    try {
      logger.error('Payout failed', { payoutId: payout.id, failureMessage: payout.failure_message });

    } catch (error) {
      logger.error('Error handling payout failed', { error: error.message });
    }
  }

  /**
   * Handle dispute created
   * @private
   */
  static async handleDisputeCreated(dispute) {
    try {
      logger.warn('Dispute created', { disputeId: dispute.id, chargeId: dispute.charge });

      // Notify admins
      await Notification.broadcast({
        type: Notification.TYPES.SYSTEM_ANNOUNCEMENT,
        title: 'Payment Dispute',
        content: `A payment dispute has been created for charge ${dispute.charge}`,
        priority: Notification.PRIORITIES.URGENT
      }, { role: 'admin' });

    } catch (error) {
      logger.error('Error handling dispute', { error: error.message });
    }
  }
}

module.exports = PaymentController;