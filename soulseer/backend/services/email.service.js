/**
 * Email Service - Enterprise Level
 * Complete email notification system for SoulSeer platform
 * Handles transactional emails, templates, and email preferences
 */

const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@soulseer.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'SoulSeer';
    this.baseUrl = process.env.FRONTEND_URL || 'https://soulseer.com';
    
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  initializeTransporter() {
    try {
      // Use different configurations based on environment
      if (process.env.NODE_ENV === 'production') {
        // Production: Use SendGrid, AWS SES, or similar
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
      } else {
        // Development: Use Ethereal or local SMTP
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.ethereal.email',
          port: parseInt(process.env.SMTP_PORT) || 587,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
      }

      logger.info('Email transporter initialized');
    } catch (error) {
      logger.error('Error initializing email transporter', { error: error.message });
    }
  }

  // ============================================
  // CORE EMAIL SENDING
  // ============================================

  /**
   * Send email
   * @param {Object} options - Email options
   * @returns {Object} Send result
   */
  async sendEmail(options) {
    try {
      const {
        to,
        subject,
        html,
        text,
        attachments = [],
        replyTo = null,
        cc = null,
        bcc = null
      } = options;

      const mailOptions = {
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to,
        subject,
        html,
        text: text || this.stripHtml(html),
        attachments
      };

      if (replyTo) mailOptions.replyTo = replyTo;
      if (cc) mailOptions.cc = cc;
      if (bcc) mailOptions.bcc = bcc;

      const result = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent', { to, subject, messageId: result.messageId });

      return {
        success: true,
        messageId: result.messageId
      };

    } catch (error) {
      logger.error('Error sending email', { error: error.message, to: options.to });
      throw error;
    }
  }

  /**
   * Send templated email
   * @param {string} templateName - Template name
   * @param {string} to - Recipient email
   * @param {Object} data - Template data
   * @returns {Object} Send result
   */
  async sendTemplatedEmail(templateName, to, data) {
    try {
      const template = this.getTemplate(templateName, data);
      
      return await this.sendEmail({
        to,
        subject: template.subject,
        html: template.html
      });

    } catch (error) {
      logger.error('Error sending templated email', { error: error.message, templateName, to });
      throw error;
    }
  }

  // ============================================
  // EMAIL TEMPLATES
  // ============================================

  /**
   * Get email template
   * @param {string} templateName - Template name
   * @param {Object} data - Template data
   * @returns {Object} Template with subject and html
   */
  getTemplate(templateName, data) {
    const templates = {
      // Authentication
      welcome: this.welcomeTemplate(data),
      email_verification: this.emailVerificationTemplate(data),
      password_reset: this.passwordResetTemplate(data),
      
      // Sessions
      session_request: this.sessionRequestTemplate(data),
      session_accepted: this.sessionAcceptedTemplate(data),
      session_declined: this.sessionDeclinedTemplate(data),
      session_reminder: this.sessionReminderTemplate(data),
      session_completed: this.sessionCompletedTemplate(data),
      session_cancelled: this.sessionCancelledTemplate(data),
      
      // Payments
      payment_received: this.paymentReceivedTemplate(data),
      payment_failed: this.paymentFailedTemplate(data),
      payout_processed: this.payoutProcessedTemplate(data),
      low_balance: this.lowBalanceTemplate(data),
      refund_processed: this.refundProcessedTemplate(data),
      
      // Reader
      reader_application_received: this.readerApplicationReceivedTemplate(data),
      reader_approved: this.readerApprovedTemplate(data),
      reader_rejected: this.readerRejectedTemplate(data),
      
      // Reviews
      new_review: this.newReviewTemplate(data),
      review_response: this.reviewResponseTemplate(data),
      
      // Orders
      order_confirmation: this.orderConfirmationTemplate(data),
      order_shipped: this.orderShippedTemplate(data),
      order_delivered: this.orderDeliveredTemplate(data),
      
      // Streams
      stream_starting: this.streamStartingTemplate(data),
      stream_scheduled: this.streamScheduledTemplate(data),
      
      // System
      account_suspended: this.accountSuspendedTemplate(data),
      account_restored: this.accountRestoredTemplate(data),
      security_alert: this.securityAlertTemplate(data)
    };

    if (!templates[templateName]) {
      throw new Error(`Email template '${templateName}' not found`);
    }

    return templates[templateName];
  }

  /**
   * Base email wrapper
   */
  baseTemplate(content, preheader = '') {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SoulSeer</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #0a0a0f; color: #ffffff; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 30px 0; border-bottom: 1px solid #2a2a3a; }
    .logo { font-size: 32px; font-weight: bold; color: #ff6b9d; font-family: 'Alex Brush', cursive; }
    .content { padding: 30px 0; }
    .button { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #ff6b9d, #c44569); color: #ffffff; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
    .button:hover { opacity: 0.9; }
    .footer { text-align: center; padding: 30px 0; border-top: 1px solid #2a2a3a; color: #888; font-size: 12px; }
    .highlight { color: #ff6b9d; }
    .card { background: #1a1a2e; border-radius: 12px; padding: 20px; margin: 20px 0; }
    h1, h2, h3 { color: #ffffff; }
    p { line-height: 1.6; color: #cccccc; }
    .preheader { display: none; max-height: 0; overflow: hidden; }
  </style>
</head>
<body>
  <span class="preheader">${preheader}</span>
  <div class="container">
    <div class="header">
      <div class="logo">✨ SoulSeer</div>
      <p style="color: #888; margin-top: 5px;">Spiritual Guidance & Psychic Readings</p>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} SoulSeer. All rights reserved.</p>
      <p>
        <a href="${this.baseUrl}/privacy" style="color: #ff6b9d;">Privacy Policy</a> | 
        <a href="${this.baseUrl}/terms" style="color: #ff6b9d;">Terms of Service</a> |
        <a href="${this.baseUrl}/settings/notifications" style="color: #ff6b9d;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  // ============================================
  // AUTHENTICATION TEMPLATES
  // ============================================

  welcomeTemplate(data) {
    const { name } = data;
    return {
      subject: 'Welcome to SoulSeer! ✨',
      html: this.baseTemplate(`
        <h1>Welcome, ${name}! 🌟</h1>
        <p>We're thrilled to have you join the SoulSeer community. Your spiritual journey begins now.</p>
        
        <div class="card">
          <h3>What you can do on SoulSeer:</h3>
          <ul style="color: #cccccc;">
            <li>Connect with gifted psychic readers</li>
            <li>Get personalized readings via chat, voice, or video</li>
            <li>Watch live spiritual streams</li>
            <li>Join our community forum</li>
            <li>Shop for spiritual products</li>
          </ul>
        </div>
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}/readings" class="button">Find Your Reader</a>
        </p>
        
        <p>If you have any questions, our support team is here to help.</p>
        <p>Blessings,<br>The SoulSeer Team</p>
      `, 'Welcome to SoulSeer - Your spiritual journey begins!')
    };
  }

  emailVerificationTemplate(data) {
    const { name, verificationUrl } = data;
    return {
      subject: 'Verify Your Email - SoulSeer',
      html: this.baseTemplate(`
        <h1>Verify Your Email</h1>
        <p>Hi ${name},</p>
        <p>Please verify your email address to complete your SoulSeer account setup.</p>
        
        <p style="text-align: center;">
          <a href="${verificationUrl}" class="button">Verify Email</a>
        </p>
        
        <p style="color: #888; font-size: 12px;">This link will expire in 24 hours. If you didn't create an account, please ignore this email.</p>
      `, 'Please verify your email address')
    };
  }

  passwordResetTemplate(data) {
    const { name, resetUrl } = data;
    return {
      subject: 'Reset Your Password - SoulSeer',
      html: this.baseTemplate(`
        <h1>Reset Your Password</h1>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. Click the button below to create a new password.</p>
        
        <p style="text-align: center;">
          <a href="${resetUrl}" class="button">Reset Password</a>
        </p>
        
        <p style="color: #888; font-size: 12px;">This link will expire in 1 hour. If you didn't request a password reset, please ignore this email or contact support if you're concerned.</p>
      `, 'Reset your SoulSeer password')
    };
  }

  // ============================================
  // SESSION TEMPLATES
  // ============================================

  sessionRequestTemplate(data) {
    const { readerName, clientName, sessionType, scheduledTime } = data;
    return {
      subject: `New Reading Request from ${clientName}`,
      html: this.baseTemplate(`
        <h1>New Reading Request! 🔮</h1>
        <p>Hi ${readerName},</p>
        <p>You have a new ${sessionType} reading request from <strong class="highlight">${clientName}</strong>.</p>
        
        <div class="card">
          <p><strong>Session Type:</strong> ${sessionType}</p>
          ${scheduledTime ? `<p><strong>Requested Time:</strong> ${scheduledTime}</p>` : ''}
        </div>
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}/dashboard/reader" class="button">View Request</a>
        </p>
      `, `New ${sessionType} reading request from ${clientName}`)
    };
  }

  sessionAcceptedTemplate(data) {
    const { clientName, readerName, sessionType, scheduledTime } = data;
    return {
      subject: `${readerName} Accepted Your Reading Request!`,
      html: this.baseTemplate(`
        <h1>Your Request Was Accepted! ✨</h1>
        <p>Hi ${clientName},</p>
        <p>Great news! <strong class="highlight">${readerName}</strong> has accepted your ${sessionType} reading request.</p>
        
        <div class="card">
          <p><strong>Reader:</strong> ${readerName}</p>
          <p><strong>Session Type:</strong> ${sessionType}</p>
          ${scheduledTime ? `<p><strong>Scheduled Time:</strong> ${scheduledTime}</p>` : '<p><strong>Status:</strong> Ready to start</p>'}
        </div>
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}/dashboard" class="button">Go to Dashboard</a>
        </p>
      `, `${readerName} accepted your reading request`)
    };
  }

  sessionDeclinedTemplate(data) {
    const { clientName, readerName, reason } = data;
    return {
      subject: 'Reading Request Update',
      html: this.baseTemplate(`
        <h1>Reading Request Update</h1>
        <p>Hi ${clientName},</p>
        <p>Unfortunately, ${readerName} is unable to accept your reading request at this time.</p>
        
        ${reason ? `<div class="card"><p><strong>Reason:</strong> ${reason}</p></div>` : ''}
        
        <p>Don't worry! There are many other talented readers available.</p>
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}/readings" class="button">Find Another Reader</a>
        </p>
      `, 'Your reading request could not be accepted')
    };
  }

  sessionReminderTemplate(data) {
    const { name, readerName, sessionType, scheduledTime, minutesUntil } = data;
    return {
      subject: `Reminder: Your Reading Starts in ${minutesUntil} Minutes!`,
      html: this.baseTemplate(`
        <h1>Your Reading is Coming Up! ⏰</h1>
        <p>Hi ${name},</p>
        <p>This is a reminder that your ${sessionType} reading with <strong class="highlight">${readerName}</strong> starts in <strong>${minutesUntil} minutes</strong>.</p>
        
        <div class="card">
          <p><strong>Reader:</strong> ${readerName}</p>
          <p><strong>Session Type:</strong> ${sessionType}</p>
          <p><strong>Time:</strong> ${scheduledTime}</p>
        </div>
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}/dashboard" class="button">Join Session</a>
        </p>
        
        <p style="color: #888; font-size: 12px;">Make sure you're in a quiet space with a stable internet connection.</p>
      `, `Your reading with ${readerName} starts in ${minutesUntil} minutes`)
    };
  }

  sessionCompletedTemplate(data) {
    const { clientName, readerName, duration, amount } = data;
    return {
      subject: 'Your Reading Session is Complete',
      html: this.baseTemplate(`
        <h1>Session Complete! 🌟</h1>
        <p>Hi ${clientName},</p>
        <p>Thank you for your reading session with <strong class="highlight">${readerName}</strong>.</p>
        
        <div class="card">
          <p><strong>Duration:</strong> ${duration} minutes</p>
          <p><strong>Amount:</strong> $${amount.toFixed(2)}</p>
        </div>
        
        <p>We hope you found the guidance you were seeking. Please consider leaving a review to help others find great readers!</p>
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}/dashboard" class="button">Leave a Review</a>
        </p>
      `, `Your reading with ${readerName} is complete`)
    };
  }

  sessionCancelledTemplate(data) {
    const { name, readerName, reason, refundAmount } = data;
    return {
      subject: 'Reading Session Cancelled',
      html: this.baseTemplate(`
        <h1>Session Cancelled</h1>
        <p>Hi ${name},</p>
        <p>Your reading session with ${readerName} has been cancelled.</p>
        
        ${reason ? `<div class="card"><p><strong>Reason:</strong> ${reason}</p></div>` : ''}
        
        ${refundAmount ? `<p>A refund of <strong class="highlight">$${refundAmount.toFixed(2)}</strong> has been processed to your account balance.</p>` : ''}
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}/readings" class="button">Book Another Reading</a>
        </p>
      `, 'Your reading session has been cancelled')
    };
  }

  // ============================================
  // PAYMENT TEMPLATES
  // ============================================

  paymentReceivedTemplate(data) {
    const { name, amount, description } = data;
    return {
      subject: 'Payment Received - SoulSeer',
      html: this.baseTemplate(`
        <h1>Payment Received! 💫</h1>
        <p>Hi ${name},</p>
        <p>We've received your payment of <strong class="highlight">$${amount.toFixed(2)}</strong>.</p>
        
        <div class="card">
          <p><strong>Amount:</strong> $${amount.toFixed(2)}</p>
          <p><strong>Description:</strong> ${description}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        </div>
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}/dashboard" class="button">View Balance</a>
        </p>
      `, `Payment of $${amount.toFixed(2)} received`)
    };
  }

  paymentFailedTemplate(data) {
    const { name, amount, reason } = data;
    return {
      subject: 'Payment Failed - Action Required',
      html: this.baseTemplate(`
        <h1>Payment Failed</h1>
        <p>Hi ${name},</p>
        <p>Unfortunately, your payment of <strong>$${amount.toFixed(2)}</strong> could not be processed.</p>
        
        <div class="card">
          <p><strong>Reason:</strong> ${reason || 'Payment declined'}</p>
        </div>
        
        <p>Please update your payment method and try again.</p>
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}/settings/payment" class="button">Update Payment Method</a>
        </p>
      `, 'Your payment could not be processed')
    };
  }

  payoutProcessedTemplate(data) {
    const { name, amount, bankLast4 } = data;
    return {
      subject: 'Payout Processed - SoulSeer',
      html: this.baseTemplate(`
        <h1>Payout Processed! 💰</h1>
        <p>Hi ${name},</p>
        <p>Your payout of <strong class="highlight">$${amount.toFixed(2)}</strong> has been processed and is on its way to your bank account.</p>
        
        <div class="card">
          <p><strong>Amount:</strong> $${amount.toFixed(2)}</p>
          <p><strong>Destination:</strong> Bank account ending in ${bankLast4}</p>
          <p><strong>Expected Arrival:</strong> 2-3 business days</p>
        </div>
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}/dashboard/reader" class="button">View Earnings</a>
        </p>
      `, `Payout of $${amount.toFixed(2)} processed`)
    };
  }

  lowBalanceTemplate(data) {
    const { name, balance } = data;
    return {
      subject: 'Low Balance Alert - SoulSeer',
      html: this.baseTemplate(`
        <h1>Low Balance Alert ⚠️</h1>
        <p>Hi ${name},</p>
        <p>Your SoulSeer balance is running low. Current balance: <strong class="highlight">$${balance.toFixed(2)}</strong></p>
        
        <p>Add funds to continue enjoying readings with your favorite psychics.</p>
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}/dashboard" class="button">Add Funds</a>
        </p>
      `, `Your balance is low: $${balance.toFixed(2)}`)
    };
  }

  refundProcessedTemplate(data) {
    const { name, amount, reason } = data;
    return {
      subject: 'Refund Processed - SoulSeer',
      html: this.baseTemplate(`
        <h1>Refund Processed</h1>
        <p>Hi ${name},</p>
        <p>A refund of <strong class="highlight">$${amount.toFixed(2)}</strong> has been processed to your account.</p>
        
        <div class="card">
          <p><strong>Amount:</strong> $${amount.toFixed(2)}</p>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        </div>
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}/dashboard" class="button">View Balance</a>
        </p>
      `, `Refund of $${amount.toFixed(2)} processed`)
    };
  }

  // ============================================
  // READER TEMPLATES
  // ============================================

  readerApplicationReceivedTemplate(data) {
    const { name } = data;
    return {
      subject: 'Reader Application Received - SoulSeer',
      html: this.baseTemplate(`
        <h1>Application Received! 📝</h1>
        <p>Hi ${name},</p>
        <p>Thank you for applying to become a reader on SoulSeer! We've received your application and our team will review it shortly.</p>
        
        <div class="card">
          <h3>What happens next?</h3>
          <ul style="color: #cccccc;">
            <li>Our team will review your application within 2-3 business days</li>
            <li>We may reach out for additional information</li>
            <li>You'll receive an email with our decision</li>
          </ul>
        </div>
        
        <p>Thank you for your patience!</p>
        <p>Blessings,<br>The SoulSeer Team</p>
      `, 'Your reader application has been received')
    };
  }

  readerApprovedTemplate(data) {
    const { name } = data;
    return {
      subject: 'Congratulations! Your Reader Application is Approved! 🎉',
      html: this.baseTemplate(`
        <h1>You're Approved! 🎉</h1>
        <p>Hi ${name},</p>
        <p>Congratulations! Your application to become a reader on SoulSeer has been <strong class="highlight">approved</strong>!</p>
        
        <div class="card">
          <h3>Next Steps:</h3>
          <ol style="color: #cccccc;">
            <li>Complete your reader profile</li>
            <li>Set up your payout information</li>
            <li>Set your availability and rates</li>
            <li>Start accepting readings!</li>
          </ol>
        </div>
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}/dashboard/reader" class="button">Set Up Your Profile</a>
        </p>
        
        <p>Welcome to the SoulSeer family!</p>
      `, 'Your reader application has been approved!')
    };
  }

  readerRejectedTemplate(data) {
    const { name, reason } = data;
    return {
      subject: 'Reader Application Update - SoulSeer',
      html: this.baseTemplate(`
        <h1>Application Update</h1>
        <p>Hi ${name},</p>
        <p>Thank you for your interest in becoming a reader on SoulSeer. After careful review, we're unable to approve your application at this time.</p>
        
        ${reason ? `<div class="card"><p><strong>Feedback:</strong> ${reason}</p></div>` : ''}
        
        <p>You're welcome to reapply in the future. If you have questions, please contact our support team.</p>
        
        <p>Blessings,<br>The SoulSeer Team</p>
      `, 'Update on your reader application')
    };
  }

  // ============================================
  // REVIEW TEMPLATES
  // ============================================

  newReviewTemplate(data) {
    const { readerName, reviewerName, rating, content } = data;
    return {
      subject: `New ${rating}-Star Review! ⭐`,
      html: this.baseTemplate(`
        <h1>New Review Received! ⭐</h1>
        <p>Hi ${readerName},</p>
        <p>You've received a new <strong class="highlight">${rating}-star</strong> review from ${reviewerName}!</p>
        
        <div class="card">
          <p><strong>Rating:</strong> ${'⭐'.repeat(rating)}</p>
          <p><strong>Review:</strong> "${content}"</p>
        </div>
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}/dashboard/reader" class="button">View Review</a>
        </p>
      `, `New ${rating}-star review from ${reviewerName}`)
    };
  }

  reviewResponseTemplate(data) {
    const { clientName, readerName } = data;
    return {
      subject: `${readerName} Responded to Your Review`,
      html: this.baseTemplate(`
        <h1>Response to Your Review</h1>
        <p>Hi ${clientName},</p>
        <p><strong class="highlight">${readerName}</strong> has responded to your review.</p>
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}/dashboard" class="button">View Response</a>
        </p>
      `, `${readerName} responded to your review`)
    };
  }

  // ============================================
  // ORDER TEMPLATES
  // ============================================

  orderConfirmationTemplate(data) {
    const { name, orderNumber, items, total } = data;
    return {
      subject: `Order Confirmed #${orderNumber}`,
      html: this.baseTemplate(`
        <h1>Order Confirmed! 📦</h1>
        <p>Hi ${name},</p>
        <p>Thank you for your order! We're preparing it now.</p>
        
        <div class="card">
          <p><strong>Order Number:</strong> #${orderNumber}</p>
          <p><strong>Total:</strong> $${total.toFixed(2)}</p>
        </div>
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}/orders/${orderNumber}" class="button">Track Order</a>
        </p>
      `, `Order #${orderNumber} confirmed`)
    };
  }

  orderShippedTemplate(data) {
    const { name, orderNumber, trackingNumber, trackingUrl } = data;
    return {
      subject: `Your Order Has Shipped! #${orderNumber}`,
      html: this.baseTemplate(`
        <h1>Your Order Has Shipped! 🚚</h1>
        <p>Hi ${name},</p>
        <p>Great news! Your order #${orderNumber} is on its way.</p>
        
        <div class="card">
          <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
        </div>
        
        <p style="text-align: center;">
          <a href="${trackingUrl || this.baseUrl + '/orders/' + orderNumber}" class="button">Track Package</a>
        </p>
      `, `Order #${orderNumber} has shipped`)
    };
  }

  orderDeliveredTemplate(data) {
    const { name, orderNumber } = data;
    return {
      subject: `Your Order Has Been Delivered! #${orderNumber}`,
      html: this.baseTemplate(`
        <h1>Order Delivered! 🎁</h1>
        <p>Hi ${name},</p>
        <p>Your order #${orderNumber} has been delivered. We hope you love it!</p>
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}/orders/${orderNumber}" class="button">Leave a Review</a>
        </p>
      `, `Order #${orderNumber} delivered`)
    };
  }

  // ============================================
  // STREAM TEMPLATES
  // ============================================

  streamStartingTemplate(data) {
    const { name, readerName, streamTitle } = data;
    return {
      subject: `${readerName} is Live Now! 🔴`,
      html: this.baseTemplate(`
        <h1>${readerName} is Live! 🔴</h1>
        <p>Hi ${name},</p>
        <p>One of your favorite readers just went live!</p>
        
        <div class="card">
          <p><strong>Reader:</strong> ${readerName}</p>
          <p><strong>Stream:</strong> ${streamTitle}</p>
        </div>
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}/live" class="button">Watch Now</a>
        </p>
      `, `${readerName} is streaming live now!`)
    };
  }

  streamScheduledTemplate(data) {
    const { name, readerName, streamTitle, scheduledTime } = data;
    return {
      subject: `Upcoming Stream: ${streamTitle}`,
      html: this.baseTemplate(`
        <h1>Upcoming Stream! 📅</h1>
        <p>Hi ${name},</p>
        <p><strong class="highlight">${readerName}</strong> has scheduled a new stream.</p>
        
        <div class="card">
          <p><strong>Stream:</strong> ${streamTitle}</p>
          <p><strong>When:</strong> ${scheduledTime}</p>
        </div>
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}/live" class="button">Set Reminder</a>
        </p>
      `, `${readerName} scheduled a stream: ${streamTitle}`)
    };
  }

  // ============================================
  // SYSTEM TEMPLATES
  // ============================================

  accountSuspendedTemplate(data) {
    const { name, reason } = data;
    return {
      subject: 'Account Suspended - SoulSeer',
      html: this.baseTemplate(`
        <h1>Account Suspended</h1>
        <p>Hi ${name},</p>
        <p>Your SoulSeer account has been suspended.</p>
        
        ${reason ? `<div class="card"><p><strong>Reason:</strong> ${reason}</p></div>` : ''}
        
        <p>If you believe this is an error, please contact our support team.</p>
        
        <p style="text-align: center;">
          <a href="mailto:support@soulseer.com" class="button">Contact Support</a>
        </p>
      `, 'Your account has been suspended')
    };
  }

  accountRestoredTemplate(data) {
    const { name } = data;
    return {
      subject: 'Account Restored - SoulSeer',
      html: this.baseTemplate(`
        <h1>Account Restored! ✨</h1>
        <p>Hi ${name},</p>
        <p>Good news! Your SoulSeer account has been restored and you can now access all features again.</p>
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}" class="button">Go to SoulSeer</a>
        </p>
      `, 'Your account has been restored')
    };
  }

  securityAlertTemplate(data) {
    const { name, alertType, details } = data;
    return {
      subject: 'Security Alert - SoulSeer',
      html: this.baseTemplate(`
        <h1>Security Alert ⚠️</h1>
        <p>Hi ${name},</p>
        <p>We detected unusual activity on your account.</p>
        
        <div class="card">
          <p><strong>Alert Type:</strong> ${alertType}</p>
          <p><strong>Details:</strong> ${details}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <p>If this wasn't you, please secure your account immediately.</p>
        
        <p style="text-align: center;">
          <a href="${this.baseUrl}/settings/security" class="button">Secure Account</a>
        </p>
      `, 'Security alert for your account')
    };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Strip HTML tags from content
   * @param {string} html - HTML content
   * @returns {string} Plain text
   */
  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Verify email transporter connection
   * @returns {boolean} Is connected
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      logger.info('Email transporter verified');
      return true;
    } catch (error) {
      logger.error('Email transporter verification failed', { error: error.message });
      return false;
    }
  }
}

// Export singleton instance
module.exports = new EmailService();