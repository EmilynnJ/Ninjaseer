/**
 * Reader Controller - Enterprise Level
 * Complete reader management endpoints for SoulSeer platform
 */

const Reader = require('../models/Reader');
const Review = require('../models/Review');
const Stream = require('../models/Stream');
const Session = require('../models/Session');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { logger } = require('../utils/logger');

class ReaderController {
  /**
   * Get all readers with filters
   * GET /api/readers
   */
  static async getReaders(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        specialty,
        status = 'online',
        min_rating,
        max_price,
        min_price,
        sort_by = 'rating',
        sort_order = 'DESC',
        search
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 50),
        specialty: specialty || null,
        status: status || null,
        minRating: min_rating ? parseFloat(min_rating) : null,
        maxPrice: max_price ? parseFloat(max_price) : null,
        minPrice: min_price ? parseFloat(min_price) : null,
        sortBy: sort_by,
        sortOrder: sort_order,
        search: search || null
      };

      const result = await Reader.getReaders(options);

      return paginatedResponse(res, result.readers, result.pagination);

    } catch (error) {
      logger.error('Error getting readers', { error: error.message });
      return errorResponse(res, 'Failed to get readers', 500);
    }
  }

  /**
   * Get featured readers
   * GET /api/readers/featured
   */
  static async getFeaturedReaders(req, res) {
    try {
      const { limit = 10 } = req.query;

      const readers = await Reader.getFeaturedReaders(parseInt(limit));

      return successResponse(res, { readers });

    } catch (error) {
      logger.error('Error getting featured readers', { error: error.message });
      return errorResponse(res, 'Failed to get featured readers', 500);
    }
  }

  /**
   * Get online readers
   * GET /api/readers/online
   */
  static async getOnlineReaders(req, res) {
    try {
      const { page = 1, limit = 20, specialty } = req.query;

      const result = await Reader.getOnlineReaders({
        page: parseInt(page),
        limit: parseInt(limit),
        specialty: specialty || null
      });

      return paginatedResponse(res, result.readers, result.pagination);

    } catch (error) {
      logger.error('Error getting online readers', { error: error.message });
      return errorResponse(res, 'Failed to get online readers', 500);
    }
  }

  /**
   * Get top rated readers
   * GET /api/readers/top-rated
   */
  static async getTopRatedReaders(req, res) {
    try {
      const { limit = 10, specialty } = req.query;

      const readers = await Reader.getTopRatedReaders({
        limit: parseInt(limit),
        specialty: specialty || null
      });

      return successResponse(res, { readers });

    } catch (error) {
      logger.error('Error getting top rated readers', { error: error.message });
      return errorResponse(res, 'Failed to get top rated readers', 500);
    }
  }

  /**
   * Get new readers
   * GET /api/readers/new
   */
  static async getNewReaders(req, res) {
    try {
      const { limit = 10 } = req.query;

      const readers = await Reader.getNewReaders(parseInt(limit));

      return successResponse(res, { readers });

    } catch (error) {
      logger.error('Error getting new readers', { error: error.message });
      return errorResponse(res, 'Failed to get new readers', 500);
    }
  }

  /**
   * Get reader by ID
   * GET /api/readers/:readerId
   */
  static async getReaderById(req, res) {
    try {
      const { readerId } = req.params;
      const viewerId = req.auth?.userId;

      const reader = await Reader.findById(readerId);
      if (!reader) {
        return errorResponse(res, 'Reader not found', 404);
      }

      // Get additional data
      const [reviews, stats, availability] = await Promise.all([
        Review.getReaderReviews(readerId, { limit: 5 }),
        Review.getReaderStatistics(readerId),
        Reader.getAvailability(readerId)
      ]);

      // Check if viewer has favorited this reader
      let isFavorited = false;
      if (viewerId) {
        const User = require('../models/User');
        isFavorited = await User.hasFavoritedReader(viewerId, readerId);
      }

      return successResponse(res, {
        reader: {
          ...reader,
          reviewStats: stats,
          recentReviews: reviews.reviews,
          availability,
          isFavorited
        }
      });

    } catch (error) {
      logger.error('Error getting reader', { error: error.message });
      return errorResponse(res, 'Failed to get reader', 500);
    }
  }

  /**
   * Get reader's reviews
   * GET /api/readers/:readerId/reviews
   */
  static async getReaderReviews(req, res) {
    try {
      const { readerId } = req.params;
      const { page = 1, limit = 10, rating, sort_by, sort_order } = req.query;

      const result = await Review.getReaderReviews(readerId, {
        page: parseInt(page),
        limit: parseInt(limit),
        rating: rating ? parseInt(rating) : null,
        sortBy: sort_by || 'created_at',
        sortOrder: sort_order || 'DESC'
      });

      return successResponse(res, {
        reviews: result.reviews,
        summary: result.summary,
        pagination: result.pagination
      });

    } catch (error) {
      logger.error('Error getting reader reviews', { error: error.message });
      return errorResponse(res, 'Failed to get reviews', 500);
    }
  }

  /**
   * Get reader's availability
   * GET /api/readers/:readerId/availability
   */
  static async getReaderAvailability(req, res) {
    try {
      const { readerId } = req.params;
      const { date } = req.query;

      const availability = await Reader.getAvailability(readerId, date ? new Date(date) : null);

      return successResponse(res, { availability });

    } catch (error) {
      logger.error('Error getting reader availability', { error: error.message });
      return errorResponse(res, 'Failed to get availability', 500);
    }
  }

  /**
   * Get reader's schedule
   * GET /api/readers/:readerId/schedule
   */
  static async getReaderSchedule(req, res) {
    try {
      const { readerId } = req.params;
      const { start_date, end_date } = req.query;

      const schedule = await Reader.getSchedule(readerId, {
        startDate: start_date ? new Date(start_date) : new Date(),
        endDate: end_date ? new Date(end_date) : null
      });

      return successResponse(res, { schedule });

    } catch (error) {
      logger.error('Error getting reader schedule', { error: error.message });
      return errorResponse(res, 'Failed to get schedule', 500);
    }
  }

  /**
   * Get reader's streams
   * GET /api/readers/:readerId/streams
   */
  static async getReaderStreams(req, res) {
    try {
      const { readerId } = req.params;
      const { page = 1, limit = 10, status } = req.query;

      const result = await Stream.getReaderStreams(readerId, {
        page: parseInt(page),
        limit: parseInt(limit),
        status: status || null
      });

      return paginatedResponse(res, result.streams, result.pagination);

    } catch (error) {
      logger.error('Error getting reader streams', { error: error.message });
      return errorResponse(res, 'Failed to get streams', 500);
    }
  }

  /**
   * Search readers
   * GET /api/readers/search
   */
  static async searchReaders(req, res) {
    try {
      const { q, page = 1, limit = 20 } = req.query;

      if (!q || q.length < 2) {
        return errorResponse(res, 'Search query must be at least 2 characters', 400);
      }

      const result = await Reader.search(q, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return paginatedResponse(res, result.readers, result.pagination);

    } catch (error) {
      logger.error('Error searching readers', { error: error.message });
      return errorResponse(res, 'Failed to search readers', 500);
    }
  }

  /**
   * Get reader specialties list
   * GET /api/readers/specialties
   */
  static async getSpecialties(req, res) {
    try {
      const specialties = await Reader.getSpecialtiesList();

      return successResponse(res, { specialties });

    } catch (error) {
      logger.error('Error getting specialties', { error: error.message });
      return errorResponse(res, 'Failed to get specialties', 500);
    }
  }

  // ============================================
  // READER DASHBOARD ENDPOINTS
  // ============================================

  /**
   * Get reader's own profile (dashboard)
   * GET /api/readers/me
   */
  static async getMyReaderProfile(req, res) {
    try {
      const userId = req.auth.userId;

      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      // Get comprehensive stats
      const [
        earnings,
        reviewStats,
        sessionStats,
        pendingBalance
      ] = await Promise.all([
        Transaction.getReaderEarningsReport(reader.id, {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }),
        Review.getReaderStatistics(reader.id),
        Session.getReaderStatistics(reader.id),
        Transaction.getReaderPendingBalance(reader.id)
      ]);

      return successResponse(res, {
        reader,
        earnings: earnings.summary,
        reviewStats,
        sessionStats,
        pendingBalance
      });

    } catch (error) {
      logger.error('Error getting reader profile', { error: error.message });
      return errorResponse(res, 'Failed to get reader profile', 500);
    }
  }

  /**
   * Update reader profile
   * PUT /api/readers/me
   */
  static async updateMyReaderProfile(req, res) {
    try {
      const userId = req.auth.userId;
      const updates = req.body;

      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      const allowedFields = [
        'display_name', 'bio', 'tagline', 'profile_image_url', 'cover_image_url',
        'specialties', 'reading_styles', 'languages', 'experience_years',
        'rate_per_minute', 'rate_per_minute_video', 'rate_per_minute_voice',
        'availability_schedule', 'auto_accept_sessions', 'max_session_duration',
        'social_links', 'certifications'
      ];

      const filteredUpdates = {};
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = value;
        }
      }

      const updatedReader = await Reader.update(reader.id, filteredUpdates);

      return successResponse(res, {
        message: 'Profile updated successfully',
        reader: updatedReader
      });

    } catch (error) {
      logger.error('Error updating reader profile', { error: error.message });
      return errorResponse(res, error.message || 'Failed to update profile', 500);
    }
  }

  /**
   * Set reader online status
   * PUT /api/readers/me/status
   */
  static async setOnlineStatus(req, res) {
    try {
      const userId = req.auth.userId;
      const { status, available_for } = req.body;

      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      const validStatuses = ['online', 'offline', 'busy', 'away'];
      if (!validStatuses.includes(status)) {
        return errorResponse(res, 'Invalid status', 400);
      }

      await Reader.setOnlineStatus(reader.id, status, available_for);

      // Notify favorited users if going online
      if (status === 'online') {
        const favoritedBy = await Reader.getFavoritedByUsers(reader.id);
        for (const user of favoritedBy) {
          await Notification.create({
            user_id: user.id,
            type: Notification.TYPES.READER_ONLINE,
            title: `${reader.displayName} is online`,
            content: 'Your favorite reader is now available for readings',
            target_type: 'reader',
            target_id: reader.id,
            actor_id: reader.userId
          });
        }
      }

      return successResponse(res, {
        message: 'Status updated',
        status
      });

    } catch (error) {
      logger.error('Error setting online status', { error: error.message });
      return errorResponse(res, 'Failed to update status', 500);
    }
  }

  /**
   * Get reader's earnings
   * GET /api/readers/me/earnings
   */
  static async getMyEarnings(req, res) {
    try {
      const userId = req.auth.userId;
      const { start_date, end_date, page = 1, limit = 20 } = req.query;

      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      const options = {
        startDate: start_date ? new Date(start_date) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: end_date ? new Date(end_date) : new Date(),
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const [earnings, transactions] = await Promise.all([
        Transaction.getReaderEarningsReport(reader.id, options),
        Transaction.getReaderEarnings(reader.id, options)
      ]);

      return successResponse(res, {
        summary: earnings.summary,
        byType: earnings.byType,
        daily: earnings.daily,
        topClients: earnings.topClients,
        transactions: transactions.transactions,
        pagination: transactions.pagination
      });

    } catch (error) {
      logger.error('Error getting earnings', { error: error.message });
      return errorResponse(res, 'Failed to get earnings', 500);
    }
  }

  /**
   * Get reader's pending balance
   * GET /api/readers/me/balance
   */
  static async getMyBalance(req, res) {
    try {
      const userId = req.auth.userId;

      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      const balance = await Transaction.getReaderPendingBalance(reader.id);

      return successResponse(res, { balance });

    } catch (error) {
      logger.error('Error getting balance', { error: error.message });
      return errorResponse(res, 'Failed to get balance', 500);
    }
  }

  /**
   * Request payout
   * POST /api/readers/me/payout
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

      if (!amount || amount < 25) {
        return errorResponse(res, 'Minimum payout amount is $25', 400);
      }

      const payout = await Transaction.createPayoutRequest(reader.id, amount);

      // Send notification
      await Notification.create({
        user_id: userId,
        type: Notification.TYPES.PAYOUT_PROCESSED,
        title: 'Payout Requested',
        content: `Your payout request for $${amount.toFixed(2)} has been submitted`,
        priority: Notification.PRIORITIES.NORMAL
      });

      return successResponse(res, {
        message: 'Payout request submitted',
        payout
      });

    } catch (error) {
      logger.error('Error requesting payout', { error: error.message });
      return errorResponse(res, error.message || 'Failed to request payout', 500);
    }
  }

  /**
   * Get reader's payout history
   * GET /api/readers/me/payouts
   */
  static async getMyPayouts(req, res) {
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
   * Get reader's sessions
   * GET /api/readers/me/sessions
   */
  static async getMySessions(req, res) {
    try {
      const userId = req.auth.userId;
      const { page = 1, limit = 20, status } = req.query;

      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      const result = await Session.getReaderSessions(reader.id, {
        page: parseInt(page),
        limit: parseInt(limit),
        status: status || null
      });

      return paginatedResponse(res, result.sessions, result.pagination);

    } catch (error) {
      logger.error('Error getting sessions', { error: error.message });
      return errorResponse(res, 'Failed to get sessions', 500);
    }
  }

  /**
   * Get reader's reviews
   * GET /api/readers/me/reviews
   */
  static async getMyReviews(req, res) {
    try {
      const userId = req.auth.userId;
      const { page = 1, limit = 10 } = req.query;

      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      const result = await Review.getReaderReviews(reader.id, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return successResponse(res, {
        reviews: result.reviews,
        summary: result.summary,
        pagination: result.pagination
      });

    } catch (error) {
      logger.error('Error getting reviews', { error: error.message });
      return errorResponse(res, 'Failed to get reviews', 500);
    }
  }

  /**
   * Respond to a review
   * POST /api/readers/me/reviews/:reviewId/respond
   */
  static async respondToReview(req, res) {
    try {
      const userId = req.auth.userId;
      const { reviewId } = req.params;
      const { response } = req.body;

      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      if (!response || response.length < 10) {
        return errorResponse(res, 'Response must be at least 10 characters', 400);
      }

      const updatedReview = await Review.addReaderResponse(reviewId, reader.id, response);

      return successResponse(res, {
        message: 'Response added successfully',
        review: updatedReview
      });

    } catch (error) {
      logger.error('Error responding to review', { error: error.message });
      return errorResponse(res, error.message || 'Failed to respond to review', 500);
    }
  }

  /**
   * Update availability schedule
   * PUT /api/readers/me/availability
   */
  static async updateAvailability(req, res) {
    try {
      const userId = req.auth.userId;
      const { schedule } = req.body;

      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      await Reader.updateAvailability(reader.id, schedule);

      return successResponse(res, {
        message: 'Availability updated successfully'
      });

    } catch (error) {
      logger.error('Error updating availability', { error: error.message });
      return errorResponse(res, 'Failed to update availability', 500);
    }
  }

  /**
   * Get reader's gift earnings
   * GET /api/readers/me/gifts
   */
  static async getMyGiftEarnings(req, res) {
    try {
      const userId = req.auth.userId;
      const { start_date, end_date } = req.query;

      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      const Gift = require('../models/Gift');
      const earnings = await Gift.getReaderGiftEarnings(reader.id, {
        startDate: start_date ? new Date(start_date) : undefined,
        endDate: end_date ? new Date(end_date) : undefined
      });

      return successResponse(res, earnings);

    } catch (error) {
      logger.error('Error getting gift earnings', { error: error.message });
      return errorResponse(res, 'Failed to get gift earnings', 500);
    }
  }

  /**
   * Get reader dashboard stats
   * GET /api/readers/me/dashboard
   */
  static async getDashboard(req, res) {
    try {
      const userId = req.auth.userId;

      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      // Get comprehensive dashboard data
      const today = new Date();
      const thirtyDaysAgo = new Date(today - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(today - 7 * 24 * 60 * 60 * 1000);

      const [
        pendingBalance,
        monthlyEarnings,
        weeklyEarnings,
        reviewStats,
        pendingSessions,
        recentSessions,
        upcomingStreams
      ] = await Promise.all([
        Transaction.getReaderPendingBalance(reader.id),
        Transaction.getReaderEarningsReport(reader.id, { startDate: thirtyDaysAgo }),
        Transaction.getReaderEarningsReport(reader.id, { startDate: sevenDaysAgo }),
        Review.getReaderStatistics(reader.id),
        Session.getReaderSessions(reader.id, { status: 'pending', limit: 5 }),
        Session.getReaderSessions(reader.id, { limit: 5 }),
        Stream.getReaderStreams(reader.id, { status: 'scheduled', limit: 3 })
      ]);

      return successResponse(res, {
        reader: {
          id: reader.id,
          displayName: reader.displayName,
          profileImageUrl: reader.profileImageUrl,
          status: reader.status,
          rating: reader.rating,
          reviewCount: reader.reviewCount
        },
        balance: pendingBalance,
        earnings: {
          monthly: monthlyEarnings.summary,
          weekly: weeklyEarnings.summary
        },
        reviews: reviewStats,
        pendingSessions: pendingSessions.sessions,
        recentSessions: recentSessions.sessions,
        upcomingStreams: upcomingStreams.streams
      });

    } catch (error) {
      logger.error('Error getting dashboard', { error: error.message });
      return errorResponse(res, 'Failed to get dashboard', 500);
    }
  }

  /**
   * Setup Stripe Connect account
   * POST /api/readers/me/stripe-connect
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
   * Get Stripe Connect dashboard link
   * GET /api/readers/me/stripe-dashboard
   */
  static async getStripeDashboard(req, res) {
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
      const dashboardLink = await stripeService.createDashboardLink(reader.stripeAccountId);

      return successResponse(res, {
        dashboardUrl: dashboardLink.url
      });

    } catch (error) {
      logger.error('Error getting Stripe dashboard', { error: error.message });
      return errorResponse(res, 'Failed to get dashboard link', 500);
    }
  }
}

module.exports = ReaderController;