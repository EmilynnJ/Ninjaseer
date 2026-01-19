/**
 * Stripe Service - Enterprise Level
 * Complete Stripe payment integration for SoulSeer platform
 * Handles payments, subscriptions, Connect accounts, and payouts
 */

const Stripe = require('stripe');
const { logger } = require('../utils/logger');

class StripeService {
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16'
    });
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    this.platformFeePercent = 30; // 30% platform fee (70/30 split)
    this.currency = 'usd';
  }

  // ============================================
  // CUSTOMER MANAGEMENT
  // ============================================

  /**
   * Create a Stripe customer
   * @param {string} userId - User ID
   * @param {string} email - Customer email
   * @param {string} name - Customer name
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Stripe customer
   */
  async createCustomer(userId, email, name, metadata = {}) {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: {
          user_id: userId,
          ...metadata
        }
      });

      logger.info('Stripe customer created', { customerId: customer.id, userId });
      return customer;

    } catch (error) {
      logger.error('Error creating Stripe customer', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get customer by ID
   * @param {string} customerId - Stripe customer ID
   * @returns {Object} Stripe customer
   */
  async getCustomer(customerId) {
    try {
      return await this.stripe.customers.retrieve(customerId);
    } catch (error) {
      logger.error('Error retrieving customer', { error: error.message, customerId });
      throw error;
    }
  }

  /**
   * Update customer
   * @param {string} customerId - Stripe customer ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated customer
   */
  async updateCustomer(customerId, updates) {
    try {
      const customer = await this.stripe.customers.update(customerId, updates);
      logger.info('Stripe customer updated', { customerId });
      return customer;
    } catch (error) {
      logger.error('Error updating customer', { error: error.message, customerId });
      throw error;
    }
  }

  /**
   * Delete customer
   * @param {string} customerId - Stripe customer ID
   * @returns {Object} Deletion confirmation
   */
  async deleteCustomer(customerId) {
    try {
      const deleted = await this.stripe.customers.del(customerId);
      logger.info('Stripe customer deleted', { customerId });
      return deleted;
    } catch (error) {
      logger.error('Error deleting customer', { error: error.message, customerId });
      throw error;
    }
  }

  // ============================================
  // PAYMENT INTENTS
  // ============================================

  /**
   * Create a payment intent
   * @param {number} amount - Amount in cents
   * @param {string} currency - Currency code
   * @param {string} customerId - Stripe customer ID
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Payment intent
   */
  async createPaymentIntent(amount, currency = 'usd', customerId = null, metadata = {}) {
    try {
      const paymentIntentData = {
        amount,
        currency,
        metadata,
        automatic_payment_methods: {
          enabled: true
        }
      };

      if (customerId) {
        paymentIntentData.customer = customerId;
      }

      const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentData);

      logger.info('Payment intent created', { 
        paymentIntentId: paymentIntent.id, 
        amount,
        customerId 
      });

      return paymentIntent;

    } catch (error) {
      logger.error('Error creating payment intent', { error: error.message, amount });
      throw error;
    }
  }

  /**
   * Retrieve payment intent
   * @param {string} paymentIntentId - Payment intent ID
   * @returns {Object} Payment intent
   */
  async retrievePaymentIntent(paymentIntentId) {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      logger.error('Error retrieving payment intent', { error: error.message, paymentIntentId });
      throw error;
    }
  }

  /**
   * Confirm payment intent
   * @param {string} paymentIntentId - Payment intent ID
   * @param {Object} options - Confirmation options
   * @returns {Object} Confirmed payment intent
   */
  async confirmPaymentIntent(paymentIntentId, options = {}) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, options);
      logger.info('Payment intent confirmed', { paymentIntentId });
      return paymentIntent;
    } catch (error) {
      logger.error('Error confirming payment intent', { error: error.message, paymentIntentId });
      throw error;
    }
  }

  /**
   * Cancel payment intent
   * @param {string} paymentIntentId - Payment intent ID
   * @returns {Object} Cancelled payment intent
   */
  async cancelPaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.cancel(paymentIntentId);
      logger.info('Payment intent cancelled', { paymentIntentId });
      return paymentIntent;
    } catch (error) {
      logger.error('Error cancelling payment intent', { error: error.message, paymentIntentId });
      throw error;
    }
  }

  /**
   * Create payment intent for balance top-up
   * @param {number} amount - Amount in dollars
   * @param {string} customerId - Stripe customer ID
   * @param {string} userId - User ID
   * @returns {Object} Payment intent with client secret
   */
  async createBalanceTopUpIntent(amount, customerId, userId) {
    try {
      const amountInCents = Math.round(amount * 100);

      const paymentIntent = await this.createPaymentIntent(
        amountInCents,
        this.currency,
        customerId,
        {
          type: 'balance_add',
          user_id: userId,
          amount_dollars: amount.toString()
        }
      );

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: amountInCents
      };

    } catch (error) {
      logger.error('Error creating balance top-up intent', { error: error.message, amount });
      throw error;
    }
  }

  // ============================================
  // STRIPE CONNECT (Reader Payouts)
  // ============================================

  /**
   * Create Connect account for reader
   * @param {string} userId - User ID
   * @param {string} email - Reader email
   * @param {Object} options - Account options
   * @returns {Object} Connect account
   */
  async createConnectAccount(userId, email, options = {}) {
    try {
      const {
        country = 'US',
        type = 'express',
        businessType = 'individual'
      } = options;

      const account = await this.stripe.accounts.create({
        type,
        country,
        email,
        business_type: businessType,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        metadata: {
          user_id: userId
        }
      });

      logger.info('Connect account created', { accountId: account.id, userId });
      return account;

    } catch (error) {
      logger.error('Error creating Connect account', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Create account link for onboarding
   * @param {string} accountId - Connect account ID
   * @param {string} refreshUrl - URL for refresh
   * @param {string} returnUrl - URL after completion
   * @returns {Object} Account link
   */
  async createAccountLink(accountId, refreshUrl, returnUrl) {
    try {
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding'
      });

      logger.info('Account link created', { accountId });
      return accountLink;

    } catch (error) {
      logger.error('Error creating account link', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get Connect account
   * @param {string} accountId - Connect account ID
   * @returns {Object} Connect account
   */
  async getConnectAccount(accountId) {
    try {
      return await this.stripe.accounts.retrieve(accountId);
    } catch (error) {
      logger.error('Error retrieving Connect account', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Check if Connect account is fully onboarded
   * @param {string} accountId - Connect account ID
   * @returns {Object} Onboarding status
   */
  async checkOnboardingStatus(accountId) {
    try {
      const account = await this.getConnectAccount(accountId);

      return {
        accountId,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        requirements: account.requirements,
        isComplete: account.charges_enabled && account.payouts_enabled && account.details_submitted
      };

    } catch (error) {
      logger.error('Error checking onboarding status', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Create login link for Connect dashboard
   * @param {string} accountId - Connect account ID
   * @returns {Object} Login link
   */
  async createLoginLink(accountId) {
    try {
      const loginLink = await this.stripe.accounts.createLoginLink(accountId);
      return loginLink;
    } catch (error) {
      logger.error('Error creating login link', { error: error.message, accountId });
      throw error;
    }
  }

  // ============================================
  // TRANSFERS & PAYOUTS
  // ============================================

  /**
   * Create transfer to Connect account
   * @param {number} amount - Amount in cents
   * @param {string} destinationAccountId - Connect account ID
   * @param {string} description - Transfer description
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Transfer
   */
  async createTransfer(amount, destinationAccountId, description = '', metadata = {}) {
    try {
      const transfer = await this.stripe.transfers.create({
        amount,
        currency: this.currency,
        destination: destinationAccountId,
        description,
        metadata
      });

      logger.info('Transfer created', { 
        transferId: transfer.id, 
        amount, 
        destinationAccountId 
      });

      return transfer;

    } catch (error) {
      logger.error('Error creating transfer', { error: error.message, amount, destinationAccountId });
      throw error;
    }
  }

  /**
   * Process reading session payment with split
   * @param {Object} sessionData - Session payment data
   * @returns {Object} Payment result
   */
  async processReadingPayment(sessionData) {
    try {
      const {
        amount,
        clientCustomerId,
        readerConnectAccountId,
        sessionId,
        readerId,
        clientId
      } = sessionData;

      const amountInCents = Math.round(amount * 100);
      const platformFee = Math.round(amountInCents * (this.platformFeePercent / 100));
      const readerAmount = amountInCents - platformFee;

      // Create payment intent with transfer
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: this.currency,
        customer: clientCustomerId,
        transfer_data: {
          destination: readerConnectAccountId,
          amount: readerAmount
        },
        metadata: {
          type: 'reading_payment',
          session_id: sessionId,
          reader_id: readerId,
          client_id: clientId,
          platform_fee: platformFee.toString(),
          reader_amount: readerAmount.toString()
        }
      });

      logger.info('Reading payment processed', {
        paymentIntentId: paymentIntent.id,
        totalAmount: amountInCents,
        platformFee,
        readerAmount,
        sessionId
      });

      return {
        paymentIntent,
        totalAmount: amountInCents,
        platformFee,
        readerAmount,
        clientSecret: paymentIntent.client_secret
      };

    } catch (error) {
      logger.error('Error processing reading payment', { error: error.message, sessionData });
      throw error;
    }
  }

  /**
   * Process payout to reader's bank account
   * @param {string} accountId - Connect account ID
   * @param {number} amount - Amount in cents
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Payout result
   */
  async processPayout(accountId, amount, metadata = {}) {
    try {
      // First, check account balance
      const balance = await this.stripe.balance.retrieve({
        stripeAccount: accountId
      });

      const availableBalance = balance.available.find(b => b.currency === this.currency);
      if (!availableBalance || availableBalance.amount < amount) {
        throw new Error('Insufficient balance for payout');
      }

      // Create payout
      const payout = await this.stripe.payouts.create({
        amount,
        currency: this.currency,
        metadata
      }, {
        stripeAccount: accountId
      });

      logger.info('Payout created', { payoutId: payout.id, amount, accountId });

      return payout;

    } catch (error) {
      logger.error('Error processing payout', { error: error.message, accountId, amount });
      throw error;
    }
  }

  /**
   * Get Connect account balance
   * @param {string} accountId - Connect account ID
   * @returns {Object} Balance info
   */
  async getConnectBalance(accountId) {
    try {
      const balance = await this.stripe.balance.retrieve({
        stripeAccount: accountId
      });

      return {
        available: balance.available,
        pending: balance.pending,
        connectReserved: balance.connect_reserved || []
      };

    } catch (error) {
      logger.error('Error getting Connect balance', { error: error.message, accountId });
      throw error;
    }
  }

  // ============================================
  // REFUNDS
  // ============================================

  /**
   * Create refund
   * @param {string} paymentIntentId - Payment intent ID
   * @param {number} amount - Refund amount in cents (optional, full refund if not specified)
   * @param {string} reason - Refund reason
   * @returns {Object} Refund
   */
  async createRefund(paymentIntentId, amount = null, reason = 'requested_by_customer') {
    try {
      const refundData = {
        payment_intent: paymentIntentId,
        reason
      };

      if (amount) {
        refundData.amount = amount;
      }

      const refund = await this.stripe.refunds.create(refundData);

      logger.info('Refund created', { 
        refundId: refund.id, 
        paymentIntentId, 
        amount: refund.amount 
      });

      return refund;

    } catch (error) {
      logger.error('Error creating refund', { error: error.message, paymentIntentId });
      throw error;
    }
  }

  /**
   * Reverse transfer (for refunds involving Connect)
   * @param {string} transferId - Transfer ID
   * @param {number} amount - Amount to reverse in cents
   * @returns {Object} Transfer reversal
   */
  async reverseTransfer(transferId, amount = null) {
    try {
      const reversalData = {};
      if (amount) {
        reversalData.amount = amount;
      }

      const reversal = await this.stripe.transfers.createReversal(transferId, reversalData);

      logger.info('Transfer reversed', { transferId, amount: reversal.amount });

      return reversal;

    } catch (error) {
      logger.error('Error reversing transfer', { error: error.message, transferId });
      throw error;
    }
  }

  // ============================================
  // PAYMENT METHODS
  // ============================================

  /**
   * Attach payment method to customer
   * @param {string} paymentMethodId - Payment method ID
   * @param {string} customerId - Customer ID
   * @returns {Object} Payment method
   */
  async attachPaymentMethod(paymentMethodId, customerId) {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });

      logger.info('Payment method attached', { paymentMethodId, customerId });

      return paymentMethod;

    } catch (error) {
      logger.error('Error attaching payment method', { error: error.message, paymentMethodId });
      throw error;
    }
  }

  /**
   * Detach payment method from customer
   * @param {string} paymentMethodId - Payment method ID
   * @returns {Object} Detached payment method
   */
  async detachPaymentMethod(paymentMethodId) {
    try {
      const paymentMethod = await this.stripe.paymentMethods.detach(paymentMethodId);
      logger.info('Payment method detached', { paymentMethodId });
      return paymentMethod;
    } catch (error) {
      logger.error('Error detaching payment method', { error: error.message, paymentMethodId });
      throw error;
    }
  }

  /**
   * List customer's payment methods
   * @param {string} customerId - Customer ID
   * @param {string} type - Payment method type
   * @returns {Array} Payment methods
   */
  async listPaymentMethods(customerId, type = 'card') {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type
      });

      return paymentMethods.data;

    } catch (error) {
      logger.error('Error listing payment methods', { error: error.message, customerId });
      throw error;
    }
  }

  /**
   * Set default payment method for customer
   * @param {string} customerId - Customer ID
   * @param {string} paymentMethodId - Payment method ID
   * @returns {Object} Updated customer
   */
  async setDefaultPaymentMethod(customerId, paymentMethodId) {
    try {
      const customer = await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });

      logger.info('Default payment method set', { customerId, paymentMethodId });

      return customer;

    } catch (error) {
      logger.error('Error setting default payment method', { error: error.message, customerId });
      throw error;
    }
  }

  // ============================================
  // SUBSCRIPTIONS
  // ============================================

  /**
   * Create subscription
   * @param {string} customerId - Customer ID
   * @param {string} priceId - Price ID
   * @param {Object} options - Subscription options
   * @returns {Object} Subscription
   */
  async createSubscription(customerId, priceId, options = {}) {
    try {
      const subscriptionData = {
        customer: customerId,
        items: [{ price: priceId }],
        ...options
      };

      const subscription = await this.stripe.subscriptions.create(subscriptionData);

      logger.info('Subscription created', { 
        subscriptionId: subscription.id, 
        customerId, 
        priceId 
      });

      return subscription;

    } catch (error) {
      logger.error('Error creating subscription', { error: error.message, customerId });
      throw error;
    }
  }

  /**
   * Cancel subscription
   * @param {string} subscriptionId - Subscription ID
   * @param {boolean} immediately - Cancel immediately or at period end
   * @returns {Object} Cancelled subscription
   */
  async cancelSubscription(subscriptionId, immediately = false) {
    try {
      let subscription;

      if (immediately) {
        subscription = await this.stripe.subscriptions.cancel(subscriptionId);
      } else {
        subscription = await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true
        });
      }

      logger.info('Subscription cancelled', { subscriptionId, immediately });

      return subscription;

    } catch (error) {
      logger.error('Error cancelling subscription', { error: error.message, subscriptionId });
      throw error;
    }
  }

  /**
   * Get subscription
   * @param {string} subscriptionId - Subscription ID
   * @returns {Object} Subscription
   */
  async getSubscription(subscriptionId) {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      logger.error('Error retrieving subscription', { error: error.message, subscriptionId });
      throw error;
    }
  }

  // ============================================
  // WEBHOOKS
  // ============================================

  /**
   * Construct webhook event
   * @param {string} payload - Request body
   * @param {string} signature - Stripe signature header
   * @returns {Object} Webhook event
   */
  constructWebhookEvent(payload, signature) {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (error) {
      logger.error('Error constructing webhook event', { error: error.message });
      throw error;
    }
  }

  /**
   * Handle webhook event
   * @param {Object} event - Stripe webhook event
   * @returns {Object} Processing result
   */
  async handleWebhookEvent(event) {
    try {
      logger.info('Stripe webhook received', { type: event.type });

      switch (event.type) {
        case 'payment_intent.succeeded':
          return this.handlePaymentSucceeded(event.data.object);
        case 'payment_intent.payment_failed':
          return this.handlePaymentFailed(event.data.object);
        case 'customer.subscription.created':
          return this.handleSubscriptionCreated(event.data.object);
        case 'customer.subscription.updated':
          return this.handleSubscriptionUpdated(event.data.object);
        case 'customer.subscription.deleted':
          return this.handleSubscriptionDeleted(event.data.object);
        case 'account.updated':
          return this.handleAccountUpdated(event.data.object);
        case 'payout.paid':
          return this.handlePayoutPaid(event.data.object);
        case 'payout.failed':
          return this.handlePayoutFailed(event.data.object);
        case 'charge.refunded':
          return this.handleChargeRefunded(event.data.object);
        case 'charge.dispute.created':
          return this.handleDisputeCreated(event.data.object);
        default:
          logger.info('Unhandled webhook event type', { type: event.type });
          return { handled: false };
      }

    } catch (error) {
      logger.error('Error handling webhook event', { error: error.message, type: event.type });
      throw error;
    }
  }

  async handlePaymentSucceeded(paymentIntent) {
    logger.info('Payment succeeded', { paymentIntentId: paymentIntent.id });
    return { handled: true, action: 'payment_succeeded', paymentIntentId: paymentIntent.id };
  }

  async handlePaymentFailed(paymentIntent) {
    logger.warn('Payment failed', { paymentIntentId: paymentIntent.id });
    return { handled: true, action: 'payment_failed', paymentIntentId: paymentIntent.id };
  }

  async handleSubscriptionCreated(subscription) {
    logger.info('Subscription created', { subscriptionId: subscription.id });
    return { handled: true, action: 'subscription_created', subscriptionId: subscription.id };
  }

  async handleSubscriptionUpdated(subscription) {
    logger.info('Subscription updated', { subscriptionId: subscription.id });
    return { handled: true, action: 'subscription_updated', subscriptionId: subscription.id };
  }

  async handleSubscriptionDeleted(subscription) {
    logger.info('Subscription deleted', { subscriptionId: subscription.id });
    return { handled: true, action: 'subscription_deleted', subscriptionId: subscription.id };
  }

  async handleAccountUpdated(account) {
    logger.info('Connect account updated', { accountId: account.id });
    return { handled: true, action: 'account_updated', accountId: account.id };
  }

  async handlePayoutPaid(payout) {
    logger.info('Payout paid', { payoutId: payout.id });
    return { handled: true, action: 'payout_paid', payoutId: payout.id };
  }

  async handlePayoutFailed(payout) {
    logger.warn('Payout failed', { payoutId: payout.id });
    return { handled: true, action: 'payout_failed', payoutId: payout.id };
  }

  async handleChargeRefunded(charge) {
    logger.info('Charge refunded', { chargeId: charge.id });
    return { handled: true, action: 'charge_refunded', chargeId: charge.id };
  }

  async handleDisputeCreated(dispute) {
    logger.warn('Dispute created', { disputeId: dispute.id });
    return { handled: true, action: 'dispute_created', disputeId: dispute.id };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Calculate platform fee
   * @param {number} amount - Amount in cents
   * @returns {Object} Fee breakdown
   */
  calculateFees(amount) {
    const platformFee = Math.round(amount * (this.platformFeePercent / 100));
    const readerAmount = amount - platformFee;

    return {
      totalAmount: amount,
      platformFee,
      readerAmount,
      platformFeePercent: this.platformFeePercent
    };
  }

  /**
   * Format amount for display
   * @param {number} amountInCents - Amount in cents
   * @returns {string} Formatted amount
   */
  formatAmount(amountInCents) {
    return `$${(amountInCents / 100).toFixed(2)}`;
  }

  /**
   * Convert dollars to cents
   * @param {number} dollars - Amount in dollars
   * @returns {number} Amount in cents
   */
  dollarsToCents(dollars) {
    return Math.round(dollars * 100);
  }

  /**
   * Convert cents to dollars
   * @param {number} cents - Amount in cents
   * @returns {number} Amount in dollars
   */
  centsToDollars(cents) {
    return cents / 100;
  }
}

// Export singleton instance
module.exports = new StripeService();