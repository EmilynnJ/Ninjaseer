/**
 * Review Controller - Enterprise Level
 * Complete review management endpoints for SoulSeer platform
 */

const Review = require('../models/Review');
const Reader = require('../models/Reader');
const Session = require('../models/Session');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { logger } = require('../utils/logger');

class ReviewController {
  /**
   * Get reviews for a target (reader, product, etc.)
   * GET /api/reviews
   */
  static async getReviews(req, res) {
    try {
      const {
        type,
        target_id,
        page = 1,
        limit = 10,
        rating,
        sort_by = 'created_at',
        sort_order = 'DESC',
        verified_only
      } = req.query;

      if (!type || !target_id) {
        return errorResponse(res, 'Type and target_id are required', 400);
      }

      const result = await Review.getByTarget(type, target_id, {
        page: parseInt(page),
        limit: parseInt(limit),
        rating: rating ? parseInt(rating) : null,
        sortBy: sort_by,
        sortOrder: sort_order,
        verifiedOnly: verified_only === 'true'
      });

      return paginatedResponse(res, result.reviews, result.pagination);

    } catch (error) {
      logger.error('Error getting reviews', { error: error.message });
      return errorResponse(res, 'Failed to get reviews', 500);
    }
  }

  /**
   * Get review by ID
   * GET /api/reviews/:reviewId
   */
  static async getReview(req, res) {
    try {
      const { reviewId } = req.params;

      const review = await Review.findById(reviewId);
      if (!review) {
        return errorResponse(res, 'Review not found', 404);
      }

      return successResponse(res, { review });

    } catch (error) {
      logger.error('Error getting review', { error: error.message });
      return errorResponse(res, 'Failed to get review', 500);
    }
  }

  /**
   * Create a review
   * POST /api/reviews
   */
  static async createReview(req, res) {
    try {
      const userId = req.auth.userId;
      const {
        type,
        target_id,
        rating,
        category_ratings,
        title,
        content,
        pros,
        cons,
        images,
        is_anonymous
      } = req.body;

      // Validate required fields
      if (!type || !target_id) {
        return errorResponse(res, 'Type and target_id are required', 400);
      }

      if (!rating || rating < 1 || rating > 5) {
        return errorResponse(res, 'Rating must be between 1 and 5', 400);
      }

      if (!content || content.trim().length < 10) {
        return errorResponse(res, 'Review content must be at least 10 characters', 400);
      }

      // Verify eligibility
      const eligibility = await ReviewController.checkEligibility(userId, type, target_id);
      if (!eligibility.eligible) {
        return errorResponse(res, eligibility.reason, 400);
      }

      const review = await Review.create({
        reviewer_id: userId,
        type,
        target_id,
        rating,
        category_ratings: category_ratings || {},
        title,
        content: content.trim(),
        pros: pros || [],
        cons: cons || [],
        images: images || [],
        is_anonymous: is_anonymous || false
      });

      // Notify target owner
      await ReviewController.notifyReviewTarget(review, type, target_id);

      return successResponse(res, {
        message: 'Review submitted successfully',
        review
      }, 201);

    } catch (error) {
      logger.error('Error creating review', { error: error.message });
      return errorResponse(res, error.message || 'Failed to create review', 500);
    }
  }

  /**
   * Update review
   * PUT /api/reviews/:reviewId
   */
  static async updateReview(req, res) {
    try {
      const userId = req.auth.userId;
      const { reviewId } = req.params;
      const updates = req.body;

      const review = await Review.findById(reviewId);
      if (!review) {
        return errorResponse(res, 'Review not found', 404);
      }

      // Verify ownership
      if (review.reviewerId !== userId) {
        return errorResponse(res, 'Not authorized to edit this review', 403);
      }

      // Check edit time limit (e.g., 7 days)
      const editTimeLimit = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - new Date(review.createdAt).getTime() > editTimeLimit) {
        return errorResponse(res, 'Review can no longer be edited', 400);
      }

      // Filter allowed updates
      const allowedFields = ['rating', 'category_ratings', 'title', 'content', 'pros', 'cons', 'images'];
      const filteredUpdates = {};
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = value;
        }
      }

      const updatedReview = await Review.update(reviewId, filteredUpdates);

      return successResponse(res, {
        message: 'Review updated successfully',
        review: updatedReview
      });

    } catch (error) {
      logger.error('Error updating review', { error: error.message });
      return errorResponse(res, error.message || 'Failed to update review', 500);
    }
  }

  /**
   * Delete review
   * DELETE /api/reviews/:reviewId
   */
  static async deleteReview(req, res) {
    try {
      const userId = req.auth.userId;
      const { reviewId } = req.params;

      const review = await Review.findById(reviewId);
      if (!review) {
        return errorResponse(res, 'Review not found', 404);
      }

      // Verify ownership
      if (review.reviewerId !== userId) {
        return errorResponse(res, 'Not authorized to delete this review', 403);
      }

      await Review.delete(reviewId);

      return successResponse(res, {
        message: 'Review deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting review', { error: error.message });
      return errorResponse(res, 'Failed to delete review', 500);
    }
  }

  /**
   * Mark review as helpful
   * POST /api/reviews/:reviewId/helpful
   */
  static async markHelpful(req, res) {
    try {
      const userId = req.auth.userId;
      const { reviewId } = req.params;

      const review = await Review.findById(reviewId);
      if (!review) {
        return errorResponse(res, 'Review not found', 404);
      }

      // Can't mark own review as helpful
      if (review.reviewerId === userId) {
        return errorResponse(res, 'Cannot mark your own review as helpful', 400);
      }

      await Review.markHelpful(reviewId, userId);

      return successResponse(res, {
        message: 'Review marked as helpful'
      });

    } catch (error) {
      logger.error('Error marking review as helpful', { error: error.message });
      return errorResponse(res, error.message || 'Failed to mark as helpful', 500);
    }
  }

  /**
   * Remove helpful mark
   * DELETE /api/reviews/:reviewId/helpful
   */
  static async removeHelpful(req, res) {
    try {
      const userId = req.auth.userId;
      const { reviewId } = req.params;

      await Review.removeHelpful(reviewId, userId);

      return successResponse(res, {
        message: 'Helpful mark removed'
      });

    } catch (error) {
      logger.error('Error removing helpful mark', { error: error.message });
      return errorResponse(res, 'Failed to remove helpful mark', 500);
    }
  }

  /**
   * Report review
   * POST /api/reviews/:reviewId/report
   */
  static async reportReview(req, res) {
    try {
      const userId = req.auth.userId;
      const { reviewId } = req.params;
      const { reason, details } = req.body;

      if (!reason) {
        return errorResponse(res, 'Reason is required', 400);
      }

      const review = await Review.findById(reviewId);
      if (!review) {
        return errorResponse(res, 'Review not found', 404);
      }

      await Review.report(reviewId, userId, {
        reason,
        details
      });

      return successResponse(res, {
        message: 'Review reported successfully'
      });

    } catch (error) {
      logger.error('Error reporting review', { error: error.message });
      return errorResponse(res, error.message || 'Failed to report review', 500);
    }
  }

  /**
   * Respond to review (for readers/sellers)
   * POST /api/reviews/:reviewId/respond
   */
  static async respondToReview(req, res) {
    try {
      const userId = req.auth.userId;
      const { reviewId } = req.params;
      const { response } = req.body;

      if (!response || response.trim().length < 10) {
        return errorResponse(res, 'Response must be at least 10 characters', 400);
      }

      const review = await Review.findById(reviewId);
      if (!review) {
        return errorResponse(res, 'Review not found', 404);
      }

      // Verify user is the target owner
      const isOwner = await ReviewController.verifyTargetOwnership(userId, review.type, review.targetId);
      if (!isOwner) {
        return errorResponse(res, 'Not authorized to respond to this review', 403);
      }

      const updatedReview = await Review.addResponse(reviewId, {
        responder_id: userId,
        response: response.trim()
      });

      // Notify reviewer
      await Notification.create({
        user_id: review.reviewerId,
        type: Notification.TYPES.REVIEW_RESPONSE,
        title: 'Response to Your Review',
        content: 'The owner has responded to your review',
        target_type: 'review',
        target_id: reviewId,
        actor_id: userId
      });

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
   * Get user's reviews
   * GET /api/reviews/my-reviews
   */
  static async getMyReviews(req, res) {
    try {
      const userId = req.auth.userId;
      const { page = 1, limit = 10, type } = req.query;

      const result = await Review.getUserReviews(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        type: type || null
      });

      return paginatedResponse(res, result.reviews, result.pagination);

    } catch (error) {
      logger.error('Error getting user reviews', { error: error.message });
      return errorResponse(res, 'Failed to get reviews', 500);
    }
  }

  /**
   * Get reviews received (for readers)
   * GET /api/reviews/received
   */
  static async getReceivedReviews(req, res) {
    try {
      const userId = req.auth.userId;
      const { page = 1, limit = 10, rating, sort_by = 'created_at' } = req.query;

      // Get reader profile
      const reader = await Reader.findByUserId(userId);
      if (!reader) {
        return errorResponse(res, 'Reader profile not found', 404);
      }

      const result = await Review.getByTarget('reader', reader.id, {
        page: parseInt(page),
        limit: parseInt(limit),
        rating: rating ? parseInt(rating) : null,
        sortBy: sort_by
      });

      return paginatedResponse(res, result.reviews, result.pagination);

    } catch (error) {
      logger.error('Error getting received reviews', { error: error.message });
      return errorResponse(res, 'Failed to get reviews', 500);
    }
  }

  /**
   * Get review statistics for a target
   * GET /api/reviews/stats
   */
  static async getReviewStats(req, res) {
    try {
      const { type, target_id } = req.query;

      if (!type || !target_id) {
        return errorResponse(res, 'Type and target_id are required', 400);
      }

      const stats = await Review.getStats(type, target_id);

      return successResponse(res, { stats });

    } catch (error) {
      logger.error('Error getting review stats', { error: error.message });
      return errorResponse(res, 'Failed to get statistics', 500);
    }
  }

  /**
   * Check if user can review a target
   * GET /api/reviews/can-review
   */
  static async canReview(req, res) {
    try {
      const userId = req.auth.userId;
      const { type, target_id } = req.query;

      if (!type || !target_id) {
        return errorResponse(res, 'Type and target_id are required', 400);
      }

      const eligibility = await ReviewController.checkEligibility(userId, type, target_id);

      return successResponse(res, eligibility);

    } catch (error) {
      logger.error('Error checking review eligibility', { error: error.message });
      return errorResponse(res, 'Failed to check eligibility', 500);
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Check if user is eligible to review
   */
  static async checkEligibility(userId, type, targetId) {
    try {
      // Check if already reviewed
      const existingReview = await Review.findByUserAndTarget(userId, type, targetId);
      if (existingReview) {
        return {
          eligible: false,
          reason: 'You have already reviewed this',
          existingReview
        };
      }

      // Check based on type
      switch (type) {
        case 'reader':
          // Must have completed a session with the reader
          const readerSessions = await Session.getUserSessionsWithReader(userId, targetId);
          const completedSessions = readerSessions.filter(s => s.status === 'completed');
          if (completedSessions.length === 0) {
            return {
              eligible: false,
              reason: 'You must complete a reading session before reviewing this reader'
            };
          }
          break;

        case 'session':
          // Must be the client of the session
          const session = await Session.findById(targetId);
          if (!session || session.clientId !== userId) {
            return {
              eligible: false,
              reason: 'You can only review sessions you participated in'
            };
          }
          if (session.status !== 'completed') {
            return {
              eligible: false,
              reason: 'You can only review completed sessions'
            };
          }
          break;

        case 'product':
          // Must have purchased the product
          const hasPurchased = await Product.hasUserPurchased(userId, targetId);
          if (!hasPurchased) {
            return {
              eligible: false,
              reason: 'You must purchase this product before reviewing'
            };
          }
          break;

        case 'stream':
          // Must have watched the stream
          const Stream = require('../models/Stream');
          const hasWatched = await Stream.hasUserWatched(userId, targetId);
          if (!hasWatched) {
            return {
              eligible: false,
              reason: 'You must watch this stream before reviewing'
            };
          }
          break;
      }

      return {
        eligible: true,
        reason: null
      };

    } catch (error) {
      logger.error('Error checking eligibility', { error: error.message });
      return {
        eligible: false,
        reason: 'Unable to verify eligibility'
      };
    }
  }

  /**
   * Verify user owns the review target
   */
  static async verifyTargetOwnership(userId, type, targetId) {
    try {
      switch (type) {
        case 'reader':
          const reader = await Reader.findById(targetId);
          return reader && reader.userId === userId;

        case 'product':
          const product = await Product.findById(targetId);
          if (!product || !product.sellerId) return false;
          const seller = await Reader.findById(product.sellerId);
          return seller && seller.userId === userId;

        case 'stream':
          const Stream = require('../models/Stream');
          const stream = await Stream.findById(targetId);
          if (!stream) return false;
          const streamReader = await Reader.findById(stream.readerId);
          return streamReader && streamReader.userId === userId;

        default:
          return false;
      }
    } catch (error) {
      logger.error('Error verifying ownership', { error: error.message });
      return false;
    }
  }

  /**
   * Notify review target owner
   */
  static async notifyReviewTarget(review, type, targetId) {
    try {
      let targetUserId = null;

      switch (type) {
        case 'reader':
          const reader = await Reader.findById(targetId);
          targetUserId = reader?.userId;
          break;

        case 'product':
          const product = await Product.findById(targetId);
          if (product?.sellerId) {
            const seller = await Reader.findById(product.sellerId);
            targetUserId = seller?.userId;
          }
          break;

        case 'stream':
          const Stream = require('../models/Stream');
          const stream = await Stream.findById(targetId);
          if (stream) {
            const streamReader = await Reader.findById(stream.readerId);
            targetUserId = streamReader?.userId;
          }
          break;
      }

      if (targetUserId && targetUserId !== review.reviewerId) {
        await Notification.create({
          user_id: targetUserId,
          type: Notification.TYPES.NEW_REVIEW,
          title: 'New Review',
          content: `You received a ${review.rating}-star review`,
          target_type: 'review',
          target_id: review.id,
          actor_id: review.reviewerId,
          priority: Notification.PRIORITIES.NORMAL
        });
      }
    } catch (error) {
      logger.error('Error notifying review target', { error: error.message });
    }
  }
}

module.exports = ReviewController;