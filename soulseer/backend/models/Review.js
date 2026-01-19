/**
 * Review Model - Enterprise Level
 * Complete review and rating system for SoulSeer platform
 * Handles reader reviews, session feedback, and reputation management
 */

const { pool } = require('../config/database');
const { logger } = require('../utils/logger');

class Review {
  // ============================================
  // REVIEW TYPES & STATUSES
  // ============================================
  
  static TYPES = {
    READER: 'reader',           // Review of a reader
    SESSION: 'session',         // Review of a specific session
    PRODUCT: 'product',         // Review of a shop product
    STREAM: 'stream'            // Review of a live stream
  };

  static STATUSES = {
    PENDING: 'pending',         // Awaiting moderation
    APPROVED: 'approved',       // Visible to public
    REJECTED: 'rejected',       // Rejected by moderation
    HIDDEN: 'hidden',           // Hidden by user or admin
    FLAGGED: 'flagged'          // Flagged for review
  };

  static RATING_CATEGORIES = {
    OVERALL: 'overall',
    ACCURACY: 'accuracy',
    CONNECTION: 'connection',
    COMMUNICATION: 'communication',
    PROFESSIONALISM: 'professionalism',
    VALUE: 'value'
  };

  // ============================================
  // CORE CRUD OPERATIONS
  // ============================================

  /**
   * Create a new review
   * @param {Object} reviewData - Review details
   * @returns {Object} Created review
   */
  static async create(reviewData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const {
        reviewer_id,
        type,
        target_id,          // reader_id, session_id, product_id, or stream_id
        rating,             // 1-5 overall rating
        category_ratings = {}, // Optional detailed ratings
        title = null,
        content,
        pros = [],
        cons = [],
        images = [],
        is_anonymous = false,
        metadata = {}
      } = reviewData;

      // Validate rating
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      // Verify eligibility based on type
      await this.verifyReviewEligibility(client, reviewer_id, type, target_id);

      // Check for existing review
      const existingQuery = `
        SELECT id FROM reviews 
        WHERE reviewer_id = $1 AND type = $2 AND target_id = $3
      `;
      const existingResult = await client.query(existingQuery, [reviewer_id, type, target_id]);

      if (existingResult.rows.length > 0) {
        throw new Error('You have already reviewed this');
      }

      // Determine if auto-approve or needs moderation
      const status = await this.determineInitialStatus(client, reviewer_id, content);

      // Create review
      const reviewQuery = `
        INSERT INTO reviews (
          reviewer_id, type, target_id, rating, category_ratings,
          title, content, pros, cons, images,
          is_anonymous, is_verified_purchase, metadata, status,
          helpful_count, report_count,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14,
          0, 0,
          NOW(), NOW()
        )
        RETURNING *
      `;

      // Check if verified purchase/session
      const isVerified = await this.checkVerifiedInteraction(client, reviewer_id, type, target_id);

      const reviewValues = [
        reviewer_id, type, target_id, rating, JSON.stringify(category_ratings),
        title, content, pros, cons, images,
        is_anonymous, isVerified, JSON.stringify(metadata), status
      ];

      const reviewResult = await client.query(reviewQuery, reviewValues);
      const review = reviewResult.rows[0];

      // Update target's rating if approved
      if (status === this.STATUSES.APPROVED) {
        await this.updateTargetRating(client, type, target_id);
      }

      // Create notification for target (if reader review)
      if (type === this.TYPES.READER || type === this.TYPES.SESSION) {
        const targetUserId = await this.getTargetUserId(client, type, target_id);
        if (targetUserId && targetUserId !== reviewer_id) {
          await client.query(`
            INSERT INTO notifications (
              user_id, type, title, content,
              target_type, target_id, actor_id,
              is_read, created_at
            ) VALUES (
              $1, 'new_review', 'New Review Received',
              $2, 'review', $3, $4, false, NOW()
            )
          `, [
            targetUserId,
            `You received a ${rating}-star review`,
            review.id,
            is_anonymous ? null : reviewer_id
          ]);
        }
      }

      await client.query('COMMIT');

      logger.info('Review created', { 
        reviewId: review.id, 
        reviewerId: reviewer_id,
        type,
        targetId: target_id,
        rating
      });

      return this.getById(review.id);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating review', { error: error.message, reviewData });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get review by ID
   * @param {string} reviewId - Review ID
   * @returns {Object|null} Review or null
   */
  static async getById(reviewId) {
    try {
      const query = `
        SELECT r.*,
               u.display_name as reviewer_name,
               u.profile_image_url as reviewer_image,
               CASE 
                 WHEN r.type = 'reader' THEN rp.display_name
                 WHEN r.type = 'session' THEN rp2.display_name
                 ELSE NULL
               END as target_name
        FROM reviews r
        JOIN users u ON r.reviewer_id = u.id
        LEFT JOIN reader_profiles rp ON r.type = 'reader' AND r.target_id = rp.id
        LEFT JOIN reading_sessions rs ON r.type = 'session' AND r.target_id = rs.id
        LEFT JOIN reader_profiles rp2 ON rs.reader_id = rp2.id
        WHERE r.id = $1
      `;

      const result = await pool.query(query, [reviewId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatReview(result.rows[0]);

    } catch (error) {
      logger.error('Error getting review', { error: error.message, reviewId });
      throw error;
    }
  }

  /**
   * Update review
   * @param {string} reviewId - Review ID
   * @param {string} userId - User ID (must be reviewer)
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated review
   */
  static async update(reviewId, userId, updates) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verify ownership
      const review = await this.getById(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }

      if (review.reviewerId !== userId) {
        throw new Error('Not authorized to update this review');
      }

      const allowedFields = [
        'rating', 'category_ratings', 'title', 'content',
        'pros', 'cons', 'images'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          if (key === 'category_ratings') {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(JSON.stringify(value));
          } else {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(value);
          }
          paramIndex++;
        }
      }

      if (setClause.length === 0) {
        throw new Error('No valid fields to update');
      }

      // Reset to pending if content changed significantly
      if (updates.content && updates.content !== review.content) {
        setClause.push(`status = $${paramIndex}`);
        values.push(this.STATUSES.PENDING);
        paramIndex++;
      }

      setClause.push(`edited_at = NOW()`);
      setClause.push(`updated_at = NOW()`);
      values.push(reviewId);

      const query = `
        UPDATE reviews 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      await client.query(query, values);

      // Update target rating if rating changed
      if (updates.rating && updates.rating !== review.rating) {
        await this.updateTargetRating(client, review.type, review.targetId);
      }

      await client.query('COMMIT');

      logger.info('Review updated', { reviewId, userId });

      return this.getById(reviewId);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating review', { error: error.message, reviewId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete review
   * @param {string} reviewId - Review ID
   * @param {string} userId - User ID
   * @returns {boolean} Success
   */
  static async delete(reviewId, userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const review = await this.getById(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }

      // Check authorization
      const userQuery = `SELECT role FROM users WHERE id = $1`;
      const userResult = await client.query(userQuery, [userId]);
      const isAdmin = userResult.rows[0]?.role === 'admin';

      if (review.reviewerId !== userId && !isAdmin) {
        throw new Error('Not authorized to delete this review');
      }

      // Soft delete
      await client.query(`
        UPDATE reviews 
        SET status = $1, deleted_at = NOW(), deleted_by = $2, updated_at = NOW()
        WHERE id = $3
      `, [this.STATUSES.HIDDEN, userId, reviewId]);

      // Update target rating
      await this.updateTargetRating(client, review.type, review.targetId);

      await client.query('COMMIT');

      logger.info('Review deleted', { reviewId, userId });
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error deleting review', { error: error.message, reviewId });
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // REVIEW QUERIES
  // ============================================

  /**
   * Get reviews for a target
   * @param {string} type - Review type
   * @param {string} targetId - Target ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated reviews
   */
  static async getForTarget(type, targetId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        rating = null,
        sortBy = 'created_at',
        sortOrder = 'DESC',
        verifiedOnly = false
      } = options;

      const offset = (page - 1) * limit;
      const conditions = [
        'r.type = $1',
        'r.target_id = $2',
        'r.status = $3'
      ];
      const values = [type, targetId, this.STATUSES.APPROVED];
      let paramIndex = 4;

      if (rating) {
        conditions.push(`r.rating = $${paramIndex}`);
        values.push(rating);
        paramIndex++;
      }

      if (verifiedOnly) {
        conditions.push('r.is_verified_purchase = true');
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM reviews r WHERE ${whereClause}`;
      const countResult = await pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // Get rating distribution
      const distributionQuery = `
        SELECT rating, COUNT(*) as count
        FROM reviews
        WHERE type = $1 AND target_id = $2 AND status = $3
        GROUP BY rating
        ORDER BY rating DESC
      `;
      const distributionResult = await pool.query(distributionQuery, [type, targetId, this.STATUSES.APPROVED]);

      const validSortFields = ['created_at', 'rating', 'helpful_count'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // Get reviews
      const query = `
        SELECT r.*,
               CASE WHEN r.is_anonymous THEN 'Anonymous' ELSE u.display_name END as reviewer_name,
               CASE WHEN r.is_anonymous THEN NULL ELSE u.profile_image_url END as reviewer_image
        FROM reviews r
        JOIN users u ON r.reviewer_id = u.id
        WHERE ${whereClause}
        ORDER BY r.${sortField} ${order}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await pool.query(query, values);

      // Calculate average rating
      const avgQuery = `
        SELECT AVG(rating) as avg_rating
        FROM reviews
        WHERE type = $1 AND target_id = $2 AND status = $3
      `;
      const avgResult = await pool.query(avgQuery, [type, targetId, this.STATUSES.APPROVED]);

      return {
        reviews: result.rows.map(r => this.formatReview(r)),
        summary: {
          averageRating: parseFloat(avgResult.rows[0].avg_rating) || 0,
          totalReviews: total,
          distribution: distributionResult.rows.reduce((acc, row) => {
            acc[row.rating] = parseInt(row.count);
            return acc;
          }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };

    } catch (error) {
      logger.error('Error getting reviews for target', { error: error.message, type, targetId });
      throw error;
    }
  }

  /**
   * Get reader reviews
   * @param {string} readerId - Reader profile ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated reviews
   */
  static async getReaderReviews(readerId, options = {}) {
    return this.getForTarget(this.TYPES.READER, readerId, options);
  }

  /**
   * Get user's reviews (reviews they've written)
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated reviews
   */
  static async getUserReviews(userId, options = {}) {
    try {
      const { page = 1, limit = 10, type = null } = options;
      const offset = (page - 1) * limit;

      const conditions = ['r.reviewer_id = $1', 'r.status != $2'];
      const values = [userId, this.STATUSES.HIDDEN];
      let paramIndex = 3;

      if (type) {
        conditions.push(`r.type = $${paramIndex}`);
        values.push(type);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      const countQuery = `SELECT COUNT(*) FROM reviews r WHERE ${whereClause}`;
      const countResult = await pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      const query = `
        SELECT r.*,
               CASE 
                 WHEN r.type = 'reader' THEN rp.display_name
                 WHEN r.type = 'product' THEN p.name
                 ELSE NULL
               END as target_name,
               CASE 
                 WHEN r.type = 'reader' THEN rp.profile_image_url
                 WHEN r.type = 'product' THEN p.thumbnail_url
                 ELSE NULL
               END as target_image
        FROM reviews r
        LEFT JOIN reader_profiles rp ON r.type = 'reader' AND r.target_id = rp.id
        LEFT JOIN products p ON r.type = 'product' AND r.target_id = p.id
        WHERE ${whereClause}
        ORDER BY r.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await pool.query(query, values);

      return {
        reviews: result.rows.map(r => ({
          ...this.formatReview(r),
          targetName: r.target_name,
          targetImage: r.target_image
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };

    } catch (error) {
      logger.error('Error getting user reviews', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get recent reviews
   * @param {Object} options - Query options
   * @returns {Array} Recent reviews
   */
  static async getRecentReviews(options = {}) {
    try {
      const { limit = 10, type = null, minRating = null } = options;

      const conditions = ['r.status = $1'];
      const values = [this.STATUSES.APPROVED];
      let paramIndex = 2;

      if (type) {
        conditions.push(`r.type = $${paramIndex}`);
        values.push(type);
        paramIndex++;
      }

      if (minRating) {
        conditions.push(`r.rating >= $${paramIndex}`);
        values.push(minRating);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      const query = `
        SELECT r.*,
               CASE WHEN r.is_anonymous THEN 'Anonymous' ELSE u.display_name END as reviewer_name,
               CASE WHEN r.is_anonymous THEN NULL ELSE u.profile_image_url END as reviewer_image,
               rp.display_name as reader_name,
               rp.profile_image_url as reader_image
        FROM reviews r
        JOIN users u ON r.reviewer_id = u.id
        LEFT JOIN reader_profiles rp ON r.type = 'reader' AND r.target_id = rp.id
        WHERE ${whereClause}
        ORDER BY r.created_at DESC
        LIMIT $${paramIndex}
      `;

      values.push(limit);
      const result = await pool.query(query, values);

      return result.rows.map(r => ({
        ...this.formatReview(r),
        readerName: r.reader_name,
        readerImage: r.reader_image
      }));

    } catch (error) {
      logger.error('Error getting recent reviews', { error: error.message });
      throw error;
    }
  }

  // ============================================
  // HELPFUL VOTES
  // ============================================

  /**
   * Mark review as helpful
   * @param {string} reviewId - Review ID
   * @param {string} userId - User ID
   * @returns {Object} Vote result
   */
  static async markHelpful(reviewId, userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if already voted
      const existingQuery = `
        SELECT id, is_helpful FROM review_votes
        WHERE review_id = $1 AND user_id = $2
      `;
      const existingResult = await client.query(existingQuery, [reviewId, userId]);

      let action;
      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];
        
        if (existing.is_helpful) {
          // Remove vote
          await client.query('DELETE FROM review_votes WHERE id = $1', [existing.id]);
          action = 'removed';
        } else {
          // Change to helpful
          await client.query(`
            UPDATE review_votes SET is_helpful = true, updated_at = NOW() WHERE id = $1
          `, [existing.id]);
          action = 'changed_to_helpful';
        }
      } else {
        // Add new vote
        await client.query(`
          INSERT INTO review_votes (review_id, user_id, is_helpful, created_at)
          VALUES ($1, $2, true, NOW())
        `, [reviewId, userId]);
        action = 'added';
      }

      // Update helpful count
      const countQuery = `
        SELECT COUNT(*) FROM review_votes
        WHERE review_id = $1 AND is_helpful = true
      `;
      const countResult = await client.query(countQuery, [reviewId]);
      const helpfulCount = parseInt(countResult.rows[0].count);

      await client.query(`
        UPDATE reviews SET helpful_count = $1, updated_at = NOW() WHERE id = $2
      `, [helpfulCount, reviewId]);

      await client.query('COMMIT');

      return { action, helpfulCount };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error marking review helpful', { error: error.message, reviewId, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Mark review as not helpful
   * @param {string} reviewId - Review ID
   * @param {string} userId - User ID
   * @returns {Object} Vote result
   */
  static async markNotHelpful(reviewId, userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const existingQuery = `
        SELECT id, is_helpful FROM review_votes
        WHERE review_id = $1 AND user_id = $2
      `;
      const existingResult = await client.query(existingQuery, [reviewId, userId]);

      let action;
      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];
        
        if (!existing.is_helpful) {
          // Remove vote
          await client.query('DELETE FROM review_votes WHERE id = $1', [existing.id]);
          action = 'removed';
        } else {
          // Change to not helpful
          await client.query(`
            UPDATE review_votes SET is_helpful = false, updated_at = NOW() WHERE id = $1
          `, [existing.id]);
          action = 'changed_to_not_helpful';
        }
      } else {
        // Add new vote
        await client.query(`
          INSERT INTO review_votes (review_id, user_id, is_helpful, created_at)
          VALUES ($1, $2, false, NOW())
        `, [reviewId, userId]);
        action = 'added';
      }

      // Update helpful count
      const countQuery = `
        SELECT COUNT(*) FROM review_votes
        WHERE review_id = $1 AND is_helpful = true
      `;
      const countResult = await client.query(countQuery, [reviewId]);
      const helpfulCount = parseInt(countResult.rows[0].count);

      await client.query(`
        UPDATE reviews SET helpful_count = $1, updated_at = NOW() WHERE id = $2
      `, [helpfulCount, reviewId]);

      await client.query('COMMIT');

      return { action, helpfulCount };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error marking review not helpful', { error: error.message, reviewId, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // REPORTING
  // ============================================

  /**
   * Report a review
   * @param {string} reviewId - Review ID
   * @param {string} userId - Reporter user ID
   * @param {Object} reportData - Report details
   * @returns {Object} Report result
   */
  static async report(reviewId, userId, reportData) {
    try {
      const { reason, description = null } = reportData;

      // Check if already reported by this user
      const existingQuery = `
        SELECT id FROM review_reports
        WHERE review_id = $1 AND reporter_id = $2
      `;
      const existingResult = await pool.query(existingQuery, [reviewId, userId]);

      if (existingResult.rows.length > 0) {
        throw new Error('You have already reported this review');
      }

      // Create report
      const reportQuery = `
        INSERT INTO review_reports (
          review_id, reporter_id, reason, description, status, created_at
        ) VALUES ($1, $2, $3, $4, 'pending', NOW())
        RETURNING *
      `;

      const reportResult = await pool.query(reportQuery, [reviewId, userId, reason, description]);

      // Update report count
      await pool.query(`
        UPDATE reviews SET report_count = report_count + 1, updated_at = NOW()
        WHERE id = $1
      `, [reviewId]);

      // Auto-flag if too many reports
      const review = await this.getById(reviewId);
      if (review.reportCount >= 3) {
        await pool.query(`
          UPDATE reviews SET status = $1, updated_at = NOW() WHERE id = $2
        `, [this.STATUSES.FLAGGED, reviewId]);
      }

      logger.info('Review reported', { reviewId, userId, reason });

      return reportResult.rows[0];

    } catch (error) {
      logger.error('Error reporting review', { error: error.message, reviewId, userId });
      throw error;
    }
  }

  // ============================================
  // READER RESPONSE
  // ============================================

  /**
   * Add reader response to review
   * @param {string} reviewId - Review ID
   * @param {string} readerId - Reader profile ID
   * @param {string} response - Response content
   * @returns {Object} Updated review
   */
  static async addReaderResponse(reviewId, readerId, response) {
    try {
      const review = await this.getById(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }

      if (review.type !== this.TYPES.READER && review.type !== this.TYPES.SESSION) {
        throw new Error('Can only respond to reader or session reviews');
      }

      // Verify reader owns the target
      const verifyQuery = `
        SELECT id FROM reader_profiles WHERE id = $1
      `;
      const verifyResult = await pool.query(verifyQuery, [readerId]);

      if (verifyResult.rows.length === 0) {
        throw new Error('Reader not found');
      }

      // Add response
      await pool.query(`
        UPDATE reviews 
        SET reader_response = $1, 
            reader_response_at = NOW(),
            updated_at = NOW()
        WHERE id = $2
      `, [response, reviewId]);

      // Notify reviewer
      await pool.query(`
        INSERT INTO notifications (
          user_id, type, title, content,
          target_type, target_id,
          is_read, created_at
        ) VALUES (
          $1, 'review_response', 'Reader responded to your review',
          'The reader has responded to your review',
          'review', $2, false, NOW()
        )
      `, [review.reviewerId, reviewId]);

      logger.info('Reader response added', { reviewId, readerId });

      return this.getById(reviewId);

    } catch (error) {
      logger.error('Error adding reader response', { error: error.message, reviewId, readerId });
      throw error;
    }
  }

  // ============================================
  // MODERATION
  // ============================================

  /**
   * Get pending reviews (admin)
   * @param {Object} options - Query options
   * @returns {Object} Paginated pending reviews
   */
  static async getPendingReviews(options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const offset = (page - 1) * limit;

      const countQuery = `
        SELECT COUNT(*) FROM reviews WHERE status = $1
      `;
      const countResult = await pool.query(countQuery, [this.STATUSES.PENDING]);
      const total = parseInt(countResult.rows[0].count);

      const query = `
        SELECT r.*,
               u.display_name as reviewer_name,
               u.email as reviewer_email
        FROM reviews r
        JOIN users u ON r.reviewer_id = u.id
        WHERE r.status = $1
        ORDER BY r.created_at ASC
        LIMIT $2 OFFSET $3
      `;

      const result = await pool.query(query, [this.STATUSES.PENDING, limit, offset]);

      return {
        reviews: result.rows.map(r => this.formatReview(r)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      logger.error('Error getting pending reviews', { error: error.message });
      throw error;
    }
  }

  /**
   * Approve review (admin)
   * @param {string} reviewId - Review ID
   * @param {string} adminId - Admin user ID
   * @returns {Object} Updated review
   */
  static async approve(reviewId, adminId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      await client.query(`
        UPDATE reviews 
        SET status = $1, 
            moderated_by = $2, 
            moderated_at = NOW(),
            updated_at = NOW()
        WHERE id = $3
      `, [this.STATUSES.APPROVED, adminId, reviewId]);

      const review = await this.getById(reviewId);

      // Update target rating
      await this.updateTargetRating(client, review.type, review.targetId);

      await client.query('COMMIT');

      logger.info('Review approved', { reviewId, adminId });

      return this.getById(reviewId);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error approving review', { error: error.message, reviewId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reject review (admin)
   * @param {string} reviewId - Review ID
   * @param {string} adminId - Admin user ID
   * @param {string} reason - Rejection reason
   * @returns {Object} Updated review
   */
  static async reject(reviewId, adminId, reason) {
    try {
      await pool.query(`
        UPDATE reviews 
        SET status = $1, 
            moderated_by = $2, 
            moderated_at = NOW(),
            rejection_reason = $3,
            updated_at = NOW()
        WHERE id = $4
      `, [this.STATUSES.REJECTED, adminId, reason, reviewId]);

      // Notify reviewer
      const review = await this.getById(reviewId);
      await pool.query(`
        INSERT INTO notifications (
          user_id, type, title, content,
          target_type, target_id,
          is_read, created_at
        ) VALUES (
          $1, 'review_rejected', 'Review Not Published',
          $2, 'review', $3, false, NOW()
        )
      `, [review.reviewerId, `Your review was not published: ${reason}`, reviewId]);

      logger.info('Review rejected', { reviewId, adminId, reason });

      return this.getById(reviewId);

    } catch (error) {
      logger.error('Error rejecting review', { error: error.message, reviewId });
      throw error;
    }
  }

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * Get review statistics for a reader
   * @param {string} readerId - Reader profile ID
   * @returns {Object} Review statistics
   */
  static async getReaderStatistics(readerId) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_reviews,
          AVG(rating) as average_rating,
          COUNT(*) FILTER (WHERE rating = 5) as five_star,
          COUNT(*) FILTER (WHERE rating = 4) as four_star,
          COUNT(*) FILTER (WHERE rating = 3) as three_star,
          COUNT(*) FILTER (WHERE rating = 2) as two_star,
          COUNT(*) FILTER (WHERE rating = 1) as one_star,
          COUNT(*) FILTER (WHERE is_verified_purchase = true) as verified_reviews
        FROM reviews
        WHERE type = $1 AND target_id = $2 AND status = $3
      `;

      const result = await pool.query(query, [
        this.TYPES.READER,
        readerId,
        this.STATUSES.APPROVED
      ]);

      const stats = result.rows[0];

      // Get category averages
      const categoryQuery = `
        SELECT 
          AVG((category_ratings->>'accuracy')::numeric) as accuracy,
          AVG((category_ratings->>'connection')::numeric) as connection,
          AVG((category_ratings->>'communication')::numeric) as communication,
          AVG((category_ratings->>'professionalism')::numeric) as professionalism,
          AVG((category_ratings->>'value')::numeric) as value
        FROM reviews
        WHERE type = $1 AND target_id = $2 AND status = $3
          AND category_ratings IS NOT NULL
      `;

      const categoryResult = await pool.query(categoryQuery, [
        this.TYPES.READER,
        readerId,
        this.STATUSES.APPROVED
      ]);

      return {
        totalReviews: parseInt(stats.total_reviews),
        averageRating: parseFloat(stats.average_rating) || 0,
        distribution: {
          5: parseInt(stats.five_star),
          4: parseInt(stats.four_star),
          3: parseInt(stats.three_star),
          2: parseInt(stats.two_star),
          1: parseInt(stats.one_star)
        },
        verifiedReviews: parseInt(stats.verified_reviews),
        categoryAverages: {
          accuracy: parseFloat(categoryResult.rows[0]?.accuracy) || null,
          connection: parseFloat(categoryResult.rows[0]?.connection) || null,
          communication: parseFloat(categoryResult.rows[0]?.communication) || null,
          professionalism: parseFloat(categoryResult.rows[0]?.professionalism) || null,
          value: parseFloat(categoryResult.rows[0]?.value) || null
        }
      };

    } catch (error) {
      logger.error('Error getting reader statistics', { error: error.message, readerId });
      throw error;
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Verify review eligibility
   */
  static async verifyReviewEligibility(client, reviewerId, type, targetId) {
    if (type === this.TYPES.READER) {
      // Check if user has had a session with this reader
      const sessionQuery = `
        SELECT id FROM reading_sessions
        WHERE client_id = $1 AND reader_id = $2 AND status = 'completed'
        LIMIT 1
      `;
      const sessionResult = await client.query(sessionQuery, [reviewerId, targetId]);

      if (sessionResult.rows.length === 0) {
        throw new Error('You must have a completed session with this reader to leave a review');
      }
    } else if (type === this.TYPES.SESSION) {
      // Check if user was the client in this session
      const sessionQuery = `
        SELECT id FROM reading_sessions
        WHERE id = $1 AND client_id = $2 AND status = 'completed'
      `;
      const sessionResult = await client.query(sessionQuery, [targetId, reviewerId]);

      if (sessionResult.rows.length === 0) {
        throw new Error('You can only review sessions you participated in');
      }
    }
  }

  /**
   * Check if interaction is verified
   */
  static async checkVerifiedInteraction(client, reviewerId, type, targetId) {
    if (type === this.TYPES.READER || type === this.TYPES.SESSION) {
      const query = `
        SELECT id FROM reading_sessions
        WHERE client_id = $1 AND (reader_id = $2 OR id = $2) AND status = 'completed'
        LIMIT 1
      `;
      const result = await client.query(query, [reviewerId, targetId]);
      return result.rows.length > 0;
    }
    return false;
  }

  /**
   * Determine initial status
   */
  static async determineInitialStatus(client, reviewerId, content) {
    // Check user's review history
    const historyQuery = `
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE status = 'approved') as approved
      FROM reviews
      WHERE reviewer_id = $1
    `;
    const historyResult = await client.query(historyQuery, [reviewerId]);
    const history = historyResult.rows[0];

    // Auto-approve if user has good history
    if (parseInt(history.total) >= 3 && parseInt(history.approved) / parseInt(history.total) >= 0.8) {
      return this.STATUSES.APPROVED;
    }

    // Check for spam indicators
    const spamIndicators = ['http://', 'https://', 'www.', 'click here', 'buy now'];
    const hasSpam = spamIndicators.some(indicator => 
      content.toLowerCase().includes(indicator)
    );

    if (hasSpam) {
      return this.STATUSES.PENDING;
    }

    // Default to approved for now (can be changed to PENDING for stricter moderation)
    return this.STATUSES.APPROVED;
  }

  /**
   * Update target's rating
   */
  static async updateTargetRating(client, type, targetId) {
    const avgQuery = `
      SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
      FROM reviews
      WHERE type = $1 AND target_id = $2 AND status = $3
    `;
    const avgResult = await client.query(avgQuery, [type, targetId, this.STATUSES.APPROVED]);
    const { avg_rating, review_count } = avgResult.rows[0];

    if (type === this.TYPES.READER) {
      await client.query(`
        UPDATE reader_profiles 
        SET rating = $1, review_count = $2, updated_at = NOW()
        WHERE id = $3
      `, [avg_rating || 0, review_count, targetId]);
    } else if (type === this.TYPES.PRODUCT) {
      await client.query(`
        UPDATE products 
        SET rating = $1, review_count = $2, updated_at = NOW()
        WHERE id = $3
      `, [avg_rating || 0, review_count, targetId]);
    }
  }

  /**
   * Get target user ID
   */
  static async getTargetUserId(client, type, targetId) {
    if (type === this.TYPES.READER) {
      const query = `SELECT user_id FROM reader_profiles WHERE id = $1`;
      const result = await client.query(query, [targetId]);
      return result.rows[0]?.user_id;
    } else if (type === this.TYPES.SESSION) {
      const query = `
        SELECT rp.user_id 
        FROM reading_sessions rs
        JOIN reader_profiles rp ON rs.reader_id = rp.id
        WHERE rs.id = $1
      `;
      const result = await client.query(query, [targetId]);
      return result.rows[0]?.user_id;
    }
    return null;
  }

  /**
   * Format review for API response
   */
  static formatReview(review) {
    if (!review) return null;

    return {
      id: review.id,
      reviewerId: review.reviewer_id,
      reviewerName: review.reviewer_name,
      reviewerImage: review.reviewer_image,
      type: review.type,
      targetId: review.target_id,
      targetName: review.target_name,
      rating: review.rating,
      categoryRatings: typeof review.category_ratings === 'string'
        ? JSON.parse(review.category_ratings)
        : review.category_ratings,
      title: review.title,
      content: review.content,
      pros: review.pros,
      cons: review.cons,
      images: review.images,
      isAnonymous: review.is_anonymous,
      isVerifiedPurchase: review.is_verified_purchase,
      metadata: typeof review.metadata === 'string'
        ? JSON.parse(review.metadata)
        : review.metadata,
      status: review.status,
      helpfulCount: review.helpful_count,
      reportCount: review.report_count,
      readerResponse: review.reader_response,
      readerResponseAt: review.reader_response_at,
      createdAt: review.created_at,
      updatedAt: review.updated_at,
      editedAt: review.edited_at
    };
  }
}

module.exports = Review;