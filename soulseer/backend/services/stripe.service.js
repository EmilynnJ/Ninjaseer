import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Revenue split configuration
const PLATFORM_COMMISSION = parseFloat(process.env.PLATFORM_COMMISSION) || 0.30;
const READER_COMMISSION = parseFloat(process.env.READER_COMMISSION) || 0.70;
const MINIMUM_PAYOUT = parseFloat(process.env.MINIMUM_PAYOUT) || 15.00;

class StripeService {
  // Create a customer
  async createCustomer(email, metadata = {}) {
    try {
      const customer = await stripe.customers.create({
        email,
        metadata
      });
      return customer;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  // Create a payment intent for adding balance
  async createPaymentIntent(amount, customerId, metadata = {}) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        customer: customerId,
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });
      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  // Create Stripe Connect account for reader
  async createConnectAccount(email, metadata = {}) {
    try {
      const account = await stripe.accounts.create({
        type: 'express',
        email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata
      });
      return account;
    } catch (error) {
      console.error('Error creating Connect account:', error);
      throw error;
    }
  }

  // Create account link for reader onboarding
  async createAccountLink(accountId, refreshUrl, returnUrl) {
    try {
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });
      return accountLink;
    } catch (error) {
      console.error('Error creating account link:', error);
      throw error;
    }
  }

  // Transfer funds to reader (payout)
  async transferToReader(amount, stripeAccountId, metadata = {}) {
    try {
      const transfer = await stripe.transfers.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        destination: stripeAccountId,
        metadata
      });
      return transfer;
    } catch (error) {
      console.error('Error transferring to reader:', error);
      throw error;
    }
  }

  // Calculate revenue split
  calculateRevenueSplit(totalAmount) {
    const platformFee = totalAmount * PLATFORM_COMMISSION;
    const readerEarnings = totalAmount * READER_COMMISSION;
    
    return {
      totalAmount,
      platformFee: parseFloat(platformFee.toFixed(2)),
      readerEarnings: parseFloat(readerEarnings.toFixed(2))
    };
  }

  // Process automatic daily payouts
  async processDailyPayouts(readerId, pendingAmount, stripeAccountId) {
    try {
      if (pendingAmount < MINIMUM_PAYOUT) {
        return {
          success: false,
          message: `Payout amount $${pendingAmount} is below minimum threshold of $${MINIMUM_PAYOUT}`
        };
      }

      const transfer = await this.transferToReader(
        pendingAmount,
        stripeAccountId,
        {
          readerId,
          payoutType: 'automatic_daily',
          timestamp: new Date().toISOString()
        }
      );

      return {
        success: true,
        transfer,
        amount: pendingAmount
      };
    } catch (error) {
      console.error('Error processing daily payout:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create product in Stripe
  async createProduct(name, description, price, metadata = {}) {
    try {
      const product = await stripe.products.create({
        name,
        description,
        metadata
      });

      const priceObj = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(price * 100),
        currency: 'usd',
      });

      return { product, price: priceObj };
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  // Create refund
  async createRefund(paymentIntentId, amount = null, reason = 'requested_by_customer') {
    try {
      const refundData = {
        payment_intent: paymentIntentId,
        reason
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100);
      }

      const refund = await stripe.refunds.create(refundData);
      return refund;
    } catch (error) {
      console.error('Error creating refund:', error);
      throw error;
    }
  }

  // Verify webhook signature
  verifyWebhookSignature(payload, signature) {
    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      return event;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      throw error;
    }
  }

  // Get account balance
  async getAccountBalance(stripeAccountId) {
    try {
      const balance = await stripe.balance.retrieve({
        stripeAccount: stripeAccountId
      });
      return balance;
    } catch (error) {
      console.error('Error getting account balance:', error);
      throw error;
    }
  }
}

export default new StripeService();