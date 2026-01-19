/**
 * Forum Model - Enterprise Level
 * Complete community forum system for SoulSeer platform
 * Handles posts, comments, categories, moderation, and engagement
 */

const { pool } = require('../config/database');
const { logger } = require('../utils/logger');

class Forum {
  // ============================================
  // POST TYPES & STATUSES
  // ============================================
  
  static POST_TYPES = {
    DISCUSSION: 'discussion',
    QUESTION: 'question',
    ARTICLE: 'article',
    ANNOUNCEMENT: 'announcement',
    POLL: 'poll',
    EXPERIENCE: 'experience',
    REVIEW: 'review',
    GUIDE: 'guide'
  };

  static POST_STATUSES = {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    HIDDEN: 'hidden',
    ARCHIVED: 'archived',
    DELETED: 'deleted',
    PENDING_REVIEW: 'pending_review'
  };

  static CATEGORIES = {
    GENERAL: 'general',
    TAROT: 'tarot',
    ASTROLOGY: 'astrology',
    MEDIUMSHIP: 'mediumship',
    PSYCHIC_DEVELOPMENT: 'psychic_development',
    SPIRITUAL_GROWTH: 'spiritual_growth',
    DREAMS: 'dreams',
    CRYSTALS: 'crystals',
    ENERGY_HEALING: 'energy_healing',
    NUMEROLOGY: 'numerology',
    READER_REVIEWS: 'reader_reviews',
    INTRODUCTIONS: 'introductions',
    OFF_TOPIC: 'off_topic',
    ANNOUNCEMENTS: 'announcements',
    HELP_SUPPORT: 'help_support'
  };

  static REACTION_TYPES = {
    LIKE: 'like',
    LOVE: 'love',
    INSIGHTFUL: 'insightful',
    HELPFUL: 'helpful',
    INSPIRING: 'inspiring'
  };

  static REPORT_REASONS = {
    SPAM: 'spam',
    HARASSMENT: 'harassment',
    INAPPROPRIATE: 'inappropriate',
    MISINFORMATION: 'misinformation',
    SELF_PROMOTION: 'self_promotion',
    OFF_TOPIC: 'off_topic',
    OTHER: 'other'
  };

  // ============================================
  // POST OPERATIONS
  // ============================================

  /**
   * Create a new post
   * @param {Object} postData - Post details
   * @returns {Object} Created post
   */
  static async createPost(postData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const {
        author_id,
        title,
        content,
        type = this.POST_TYPES.DISCUSSION,
        category = this.CATEGORIES.GENERAL,
        tags = [],
        images = [],
        is_pinned = false,
        is_featured = false,
        allow_comments = true,
        poll_options = null,
        poll_end_date = null,
        metadata = {},
        status = this.POST_STATUSES.PUBLISHED
      } = postData;

      // Generate slug
      const slug = this.generateSlug(title);

      // Check for duplicate slug
      const slugCheck = await client.query(
        'SELECT id FROM forum_posts WHERE slug = $1',
        [slug]
      );
      
      let finalSlug = slug;
      if (slugCheck.rows.length > 0) {
        finalSlug = `${slug}-${Date.now().toString(36)}`;
      }

      // Create post
      const postQuery = `
        INSERT INTO forum_posts (
          author_id, title, slug, content, type, category,
          tags, images, is_pinned, is_featured, allow_comments,
          poll_options, poll_end_date, metadata, status,
          view_count, comment_count, reaction_count,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15,
          0, 0, 0,
          NOW(), NOW()
        )
        RETURNING *
      `;

      const postValues = [
        author_id, title, finalSlug, content, type, category,
        tags, images, is_pinned, is_featured, allow_comments,
        poll_options ? JSON.stringify(poll_options) : null, poll_end_date,
        JSON.stringify(metadata), status
      ];

      const postResult = await client.query(postQuery, postValues);
      const post = postResult.rows[0];

      // Update user's post count
      await client.query(`
        UPDATE users SET post_count = post_count + 1, updated_at = NOW()
        WHERE id = $1
      `, [author_id]);

      // Create activity log
      await this.logActivity(client, {
        user_id: author_id,
        action: 'post_created',
        target_type: 'post',
        target_id: post.id,
        metadata: { title, category }
      });

      await client.query('COMMIT');

      logger.info('Post created', { postId: post.id, authorId: author_id, title });

      return this.getPostById(post.id);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating post', { error: error.message, postData });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get post by ID
   * @param {string} postId - Post ID
   * @param {string} viewerId - Viewer user ID (optional, for tracking views)
   * @returns {Object|null} Post or null
   */
  static async getPostById(postId, viewerId = null) {
    try {
      const query = `
        SELECT p.*,
               u.display_name as author_name,
               u.profile_image_url as author_image,
               u.is_verified as author_verified,
               rp.id as author_reader_id,
               rp.display_name as author_reader_name
        FROM forum_posts p
        JOIN users u ON p.author_id = u.id
        LEFT JOIN reader_profiles rp ON u.id = rp.user_id
        WHERE p.id = $1
      `;

      const result = await pool.query(query, [postId]);

      if (result.rows.length === 0) {
        return null;
      }

      const post = result.rows[0];

      // Increment view count if viewer provided
      if (viewerId && viewerId !== post.author_id) {
        await this.incrementViewCount(postId, viewerId);
      }

      // Get reactions summary
      const reactionsQuery = `
        SELECT type, COUNT(*) as count
        FROM forum_reactions
        WHERE post_id = $1 AND comment_id IS NULL
        GROUP BY type
      `;
      const reactionsResult = await pool.query(reactionsQuery, [postId]);

      // Get viewer's reaction if logged in
      let viewerReaction = null;
      if (viewerId) {
        const viewerReactionQuery = `
          SELECT type FROM forum_reactions
          WHERE post_id = $1 AND user_id = $2 AND comment_id IS NULL
        `;
        const viewerReactionResult = await pool.query(viewerReactionQuery, [postId, viewerId]);
        viewerReaction = viewerReactionResult.rows[0]?.type || null;
      }

      // Get bookmark status if logged in
      let isBookmarked = false;
      if (viewerId) {
        const bookmarkQuery = `
          SELECT id FROM forum_bookmarks
          WHERE post_id = $1 AND user_id = $2
        `;
        const bookmarkResult = await pool.query(bookmarkQuery, [postId, viewerId]);
        isBookmarked = bookmarkResult.rows.length > 0;
      }

      return this.formatPost({
        ...post,
        reactions: reactionsResult.rows.reduce((acc, r) => {
          acc[r.type] = parseInt(r.count);
          return acc;
        }, {}),
        viewer_reaction: viewerReaction,
        is_bookmarked: isBookmarked
      });

    } catch (error) {
      logger.error('Error getting post', { error: error.message, postId });
      throw error;
    }
  }

  /**
   * Get post by slug
   * @param {string} slug - Post slug
   * @param {string} viewerId - Viewer user ID
   * @returns {Object|null} Post or null
   */
  static async getPostBySlug(slug, viewerId = null) {
    try {
      const query = `SELECT id FROM forum_posts WHERE slug = $1`;
      const result = await pool.query(query, [slug]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.getPostById(result.rows[0].id, viewerId);

    } catch (error) {
      logger.error('Error getting post by slug', { error: error.message, slug });
      throw error;
    }
  }

  /**
   * Update post
   * @param {string} postId - Post ID
   * @param {string} userId - User ID (must be author or admin)
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated post
   */
  static async updatePost(postId, userId, updates) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verify ownership or admin
      const post = await this.getPostById(postId);
      if (!post) {
        throw new Error('Post not found');
      }

      // Check if user is author or admin
      const userQuery = `SELECT role FROM users WHERE id = $1`;
      const userResult = await client.query(userQuery, [userId]);
      const isAdmin = userResult.rows[0]?.role === 'admin';

      if (post.authorId !== userId && !isAdmin) {
        throw new Error('Not authorized to update this post');
      }

      const allowedFields = [
        'title', 'content', 'type', 'category', 'tags', 'images',
        'is_pinned', 'is_featured', 'allow_comments', 'poll_options',
        'poll_end_date', 'metadata', 'status'
      ];

      const setClause = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          if (['metadata', 'poll_options'].includes(key)) {
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

      // Update slug if title changed
      if (updates.title && updates.title !== post.title) {
        const newSlug = this.generateSlug(updates.title);
        setClause.push(`slug = $${paramIndex}`);
        values.push(newSlug);
        paramIndex++;
      }

      setClause.push(`updated_at = NOW()`);
      setClause.push(`edited_at = NOW()`);
      values.push(postId);

      const query = `
        UPDATE forum_posts 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      await client.query(query, values);

      // Log activity
      await this.logActivity(client, {
        user_id: userId,
        action: 'post_updated',
        target_type: 'post',
        target_id: postId,
        metadata: { updates: Object.keys(updates) }
      });

      await client.query('COMMIT');

      logger.info('Post updated', { postId, userId });

      return this.getPostById(postId);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating post', { error: error.message, postId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete post (soft delete)
   * @param {string} postId - Post ID
   * @param {string} userId - User ID
   * @returns {boolean} Success
   */
  static async deletePost(postId, userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const post = await this.getPostById(postId);
      if (!post) {
        throw new Error('Post not found');
      }

      // Check authorization
      const userQuery = `SELECT role FROM users WHERE id = $1`;
      const userResult = await client.query(userQuery, [userId]);
      const isAdmin = userResult.rows[0]?.role === 'admin';

      if (post.authorId !== userId && !isAdmin) {
        throw new Error('Not authorized to delete this post');
      }

      // Soft delete
      await client.query(`
        UPDATE forum_posts 
        SET status = $1, deleted_at = NOW(), deleted_by = $2, updated_at = NOW()
        WHERE id = $3
      `, [this.POST_STATUSES.DELETED, userId, postId]);

      // Update user's post count
      await client.query(`
        UPDATE users SET post_count = GREATEST(0, post_count - 1), updated_at = NOW()
        WHERE id = $1
      `, [post.authorId]);

      // Log activity
      await this.logActivity(client, {
        user_id: userId,
        action: 'post_deleted',
        target_type: 'post',
        target_id: postId
      });

      await client.query('COMMIT');

      logger.info('Post deleted', { postId, userId });
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error deleting post', { error: error.message, postId });
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // POST QUERIES
  // ============================================

  /**
   * Get posts with filters
   * @param {Object} options - Query options
   * @returns {Object} Paginated posts
   */
  static async getPosts(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        category = null,
        type = null,
        authorId = null,
        status = this.POST_STATUSES.PUBLISHED,
        tags = null,
        search = null,
        sortBy = 'created_at',
        sortOrder = 'DESC',
        isPinned = null,
        isFeatured = null
      } = options;

      const offset = (page - 1) * limit;
      const conditions = [];
      const values = [];
      let paramIndex = 1;

      if (status) {
        conditions.push(`p.status = $${paramIndex}`);
        values.push(status);
        paramIndex++;
      }

      if (category) {
        conditions.push(`p.category = $${paramIndex}`);
        values.push(category);
        paramIndex++;
      }

      if (type) {
        conditions.push(`p.type = $${paramIndex}`);
        values.push(type);
        paramIndex++;
      }

      if (authorId) {
        conditions.push(`p.author_id = $${paramIndex}`);
        values.push(authorId);
        paramIndex++;
      }

      if (tags && tags.length > 0) {
        conditions.push(`p.tags && $${paramIndex}`);
        values.push(tags);
        paramIndex++;
      }

      if (search) {
        conditions.push(`(p.title ILIKE $${paramIndex} OR p.content ILIKE $${paramIndex})`);
        values.push(`%${search}%`);
        paramIndex++;
      }

      if (isPinned !== null) {
        conditions.push(`p.is_pinned = $${paramIndex}`);
        values.push(isPinned);
        paramIndex++;
      }

      if (isFeatured !== null) {
        conditions.push(`p.is_featured = $${paramIndex}`);
        values.push(isFeatured);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const validSortFields = ['created_at', 'updated_at', 'view_count', 'comment_count', 'reaction_count'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM forum_posts p ${whereClause}`;
      const countResult = await pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // Get posts
      const query = `
        SELECT p.*,
               u.display_name as author_name,
               u.profile_image_url as author_image,
               u.is_verified as author_verified
        FROM forum_posts p
        JOIN users u ON p.author_id = u.id
        ${whereClause}
        ORDER BY p.is_pinned DESC, p.${sortField} ${order}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await pool.query(query, values);

      return {
        posts: result.rows.map(p => this.formatPost(p)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };

    } catch (error) {
      logger.error('Error getting posts', { error: error.message, options });
      throw error;
    }
  }

  /**
   * Get trending posts
   * @param {number} limit - Number of posts
   * @param {string} timeframe - Timeframe ('day', 'week', 'month')
   * @returns {Array} Trending posts
   */
  static async getTrendingPosts(limit = 10, timeframe = 'week') {
    try {
      let dateCondition;
      switch (timeframe) {
        case 'day':
          dateCondition = "created_at >= NOW() - INTERVAL '1 day'";
          break;
        case 'month':
          dateCondition = "created_at >= NOW() - INTERVAL '30 days'";
          break;
        default:
          dateCondition = "created_at >= NOW() - INTERVAL '7 days'";
      }

      const query = `
        SELECT p.*,
               u.display_name as author_name,
               u.profile_image_url as author_image,
               (p.view_count * 1 + p.comment_count * 5 + p.reaction_count * 3) as engagement_score
        FROM forum_posts p
        JOIN users u ON p.author_id = u.id
        WHERE p.status = $1 AND p.${dateCondition}
        ORDER BY engagement_score DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [this.POST_STATUSES.PUBLISHED, limit]);

      return result.rows.map(p => this.formatPost(p));

    } catch (error) {
      logger.error('Error getting trending posts', { error: error.message });
      throw error;
    }
  }

  /**
   * Get featured posts
   * @param {number} limit - Number of posts
   * @returns {Array} Featured posts
   */
  static async getFeaturedPosts(limit = 5) {
    try {
      const query = `
        SELECT p.*,
               u.display_name as author_name,
               u.profile_image_url as author_image
        FROM forum_posts p
        JOIN users u ON p.author_id = u.id
        WHERE p.status = $1 AND p.is_featured = true
        ORDER BY p.created_at DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [this.POST_STATUSES.PUBLISHED, limit]);

      return result.rows.map(p => this.formatPost(p));

    } catch (error) {
      logger.error('Error getting featured posts', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user's posts
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated posts
   */
  static async getUserPosts(userId, options = {}) {
    return this.getPosts({ ...options, authorId: userId });
  }

  // ============================================
  // COMMENT OPERATIONS
  // ============================================

  /**
   * Create a comment
   * @param {Object} commentData - Comment details
   * @returns {Object} Created comment
   */
  static async createComment(commentData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const {
        post_id,
        author_id,
        content,
        parent_id = null,
        images = [],
        metadata = {}
      } = commentData;

      // Verify post exists and allows comments
      const postQuery = `
        SELECT id, author_id, allow_comments, status 
        FROM forum_posts WHERE id = $1
      `;
      const postResult = await client.query(postQuery, [post_id]);

      if (postResult.rows.length === 0) {
        throw new Error('Post not found');
      }

      const post = postResult.rows[0];

      if (post.status !== this.POST_STATUSES.PUBLISHED) {
        throw new Error('Cannot comment on this post');
      }

      if (!post.allow_comments) {
        throw new Error('Comments are disabled for this post');
      }

      // If replying, verify parent comment exists
      if (parent_id) {
        const parentQuery = `SELECT id, post_id FROM forum_comments WHERE id = $1`;
        const parentResult = await client.query(parentQuery, [parent_id]);

        if (parentResult.rows.length === 0) {
          throw new Error('Parent comment not found');
        }

        if (parentResult.rows[0].post_id !== post_id) {
          throw new Error('Parent comment belongs to different post');
        }
      }

      // Create comment
      const commentQuery = `
        INSERT INTO forum_comments (
          post_id, author_id, parent_id, content, images, metadata,
          reaction_count, reply_count, status,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          0, 0, 'published',
          NOW(), NOW()
        )
        RETURNING *
      `;

      const commentValues = [
        post_id, author_id, parent_id, content, images, JSON.stringify(metadata)
      ];

      const commentResult = await client.query(commentQuery, commentValues);
      const comment = commentResult.rows[0];

      // Update post comment count
      await client.query(`
        UPDATE forum_posts 
        SET comment_count = comment_count + 1, updated_at = NOW()
        WHERE id = $1
      `, [post_id]);

      // Update parent comment reply count if replying
      if (parent_id) {
        await client.query(`
          UPDATE forum_comments 
          SET reply_count = reply_count + 1, updated_at = NOW()
          WHERE id = $1
        `, [parent_id]);
      }

      // Create notification for post author (if not self-commenting)
      if (post.author_id !== author_id) {
        await this.createNotification(client, {
          user_id: post.author_id,
          type: 'comment',
          title: 'New comment on your post',
          content: `Someone commented on your post`,
          target_type: 'post',
          target_id: post_id,
          actor_id: author_id
        });
      }

      // Create notification for parent comment author if replying
      if (parent_id) {
        const parentAuthorQuery = `SELECT author_id FROM forum_comments WHERE id = $1`;
        const parentAuthorResult = await client.query(parentAuthorQuery, [parent_id]);
        const parentAuthorId = parentAuthorResult.rows[0]?.author_id;

        if (parentAuthorId && parentAuthorId !== author_id) {
          await this.createNotification(client, {
            user_id: parentAuthorId,
            type: 'reply',
            title: 'New reply to your comment',
            content: `Someone replied to your comment`,
            target_type: 'comment',
            target_id: parent_id,
            actor_id: author_id
          });
        }
      }

      // Log activity
      await this.logActivity(client, {
        user_id: author_id,
        action: 'comment_created',
        target_type: 'comment',
        target_id: comment.id,
        metadata: { post_id }
      });

      await client.query('COMMIT');

      logger.info('Comment created', { commentId: comment.id, postId: post_id });

      return this.getCommentById(comment.id);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating comment', { error: error.message, commentData });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get comment by ID
   * @param {string} commentId - Comment ID
   * @returns {Object|null} Comment or null
   */
  static async getCommentById(commentId) {
    try {
      const query = `
        SELECT c.*,
               u.display_name as author_name,
               u.profile_image_url as author_image,
               u.is_verified as author_verified
        FROM forum_comments c
        JOIN users u ON c.author_id = u.id
        WHERE c.id = $1
      `;

      const result = await pool.query(query, [commentId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatComment(result.rows[0]);

    } catch (error) {
      logger.error('Error getting comment', { error: error.message, commentId });
      throw error;
    }
  }

  /**
   * Get comments for a post
   * @param {string} postId - Post ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated comments
   */
  static async getPostComments(postId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'ASC',
        parentId = null
      } = options;

      const offset = (page - 1) * limit;
      const conditions = ['c.post_id = $1', "c.status = 'published'"];
      const values = [postId];
      let paramIndex = 2;

      if (parentId === null) {
        conditions.push('c.parent_id IS NULL');
      } else {
        conditions.push(`c.parent_id = $${paramIndex}`);
        values.push(parentId);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM forum_comments c WHERE ${whereClause}`;
      const countResult = await pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // Get comments
      const query = `
        SELECT c.*,
               u.display_name as author_name,
               u.profile_image_url as author_image,
               u.is_verified as author_verified
        FROM forum_comments c
        JOIN users u ON c.author_id = u.id
        WHERE ${whereClause}
        ORDER BY c.${sortBy} ${sortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await pool.query(query, values);

      // Get replies for each comment if fetching top-level comments
      const comments = await Promise.all(
        result.rows.map(async (comment) => {
          const formatted = this.formatComment(comment);
          
          if (parentId === null && comment.reply_count > 0) {
            // Fetch first few replies
            const repliesQuery = `
              SELECT c.*,
                     u.display_name as author_name,
                     u.profile_image_url as author_image
              FROM forum_comments c
              JOIN users u ON c.author_id = u.id
              WHERE c.parent_id = $1 AND c.status = 'published'
              ORDER BY c.created_at ASC
              LIMIT 3
            `;
            const repliesResult = await pool.query(repliesQuery, [comment.id]);
            formatted.replies = repliesResult.rows.map(r => this.formatComment(r));
            formatted.hasMoreReplies = comment.reply_count > 3;
          }

          return formatted;
        })
      );

      return {
        comments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };

    } catch (error) {
      logger.error('Error getting post comments', { error: error.message, postId });
      throw error;
    }
  }

  /**
   * Update comment
   * @param {string} commentId - Comment ID
   * @param {string} userId - User ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated comment
   */
  static async updateComment(commentId, userId, updates) {
    try {
      const comment = await this.getCommentById(commentId);
      if (!comment) {
        throw new Error('Comment not found');
      }

      if (comment.authorId !== userId) {
        throw new Error('Not authorized to update this comment');
      }

      const allowedFields = ['content', 'images'];
      const setClause = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          setClause.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      if (setClause.length === 0) {
        throw new Error('No valid fields to update');
      }

      setClause.push(`edited_at = NOW()`);
      setClause.push(`updated_at = NOW()`);
      values.push(commentId);

      const query = `
        UPDATE forum_comments 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      await pool.query(query, values);

      logger.info('Comment updated', { commentId, userId });

      return this.getCommentById(commentId);

    } catch (error) {
      logger.error('Error updating comment', { error: error.message, commentId });
      throw error;
    }
  }

  /**
   * Delete comment
   * @param {string} commentId - Comment ID
   * @param {string} userId - User ID
   * @returns {boolean} Success
   */
  static async deleteComment(commentId, userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const comment = await this.getCommentById(commentId);
      if (!comment) {
        throw new Error('Comment not found');
      }

      // Check authorization
      const userQuery = `SELECT role FROM users WHERE id = $1`;
      const userResult = await client.query(userQuery, [userId]);
      const isAdmin = userResult.rows[0]?.role === 'admin';

      if (comment.authorId !== userId && !isAdmin) {
        throw new Error('Not authorized to delete this comment');
      }

      // Soft delete
      await client.query(`
        UPDATE forum_comments 
        SET status = 'deleted', deleted_at = NOW(), deleted_by = $1, updated_at = NOW()
        WHERE id = $2
      `, [userId, commentId]);

      // Update post comment count
      await client.query(`
        UPDATE forum_posts 
        SET comment_count = GREATEST(0, comment_count - 1), updated_at = NOW()
        WHERE id = $1
      `, [comment.postId]);

      // Update parent reply count if applicable
      if (comment.parentId) {
        await client.query(`
          UPDATE forum_comments 
          SET reply_count = GREATEST(0, reply_count - 1), updated_at = NOW()
          WHERE id = $1
        `, [comment.parentId]);
      }

      await client.query('COMMIT');

      logger.info('Comment deleted', { commentId, userId });
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error deleting comment', { error: error.message, commentId });
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // REACTIONS
  // ============================================

  /**
   * Add or update reaction
   * @param {string} userId - User ID
   * @param {string} postId - Post ID
   * @param {string} commentId - Comment ID (optional)
   * @param {string} type - Reaction type
   * @returns {Object} Reaction result
   */
  static async addReaction(userId, postId, commentId, type) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      if (!Object.values(this.REACTION_TYPES).includes(type)) {
        throw new Error('Invalid reaction type');
      }

      // Check for existing reaction
      const existingQuery = `
        SELECT id, type FROM forum_reactions
        WHERE user_id = $1 AND post_id = $2 AND ${commentId ? 'comment_id = $3' : 'comment_id IS NULL'}
      `;
      const existingValues = commentId ? [userId, postId, commentId] : [userId, postId];
      const existingResult = await client.query(existingQuery, existingValues);

      let action;
      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];
        
        if (existing.type === type) {
          // Remove reaction
          await client.query('DELETE FROM forum_reactions WHERE id = $1', [existing.id]);
          action = 'removed';
        } else {
          // Update reaction
          await client.query(`
            UPDATE forum_reactions SET type = $1, updated_at = NOW() WHERE id = $2
          `, [type, existing.id]);
          action = 'updated';
        }
      } else {
        // Add new reaction
        const insertQuery = `
          INSERT INTO forum_reactions (user_id, post_id, comment_id, type, created_at)
          VALUES ($1, $2, $3, $4, NOW())
        `;
        await client.query(insertQuery, [userId, postId, commentId, type]);
        action = 'added';
      }

      // Update reaction count
      const countQuery = `
        SELECT COUNT(*) FROM forum_reactions
        WHERE post_id = $1 AND ${commentId ? 'comment_id = $2' : 'comment_id IS NULL'}
      `;
      const countValues = commentId ? [postId, commentId] : [postId];
      const countResult = await client.query(countQuery, countValues);
      const newCount = parseInt(countResult.rows[0].count);

      if (commentId) {
        await client.query(`
          UPDATE forum_comments SET reaction_count = $1, updated_at = NOW() WHERE id = $2
        `, [newCount, commentId]);
      } else {
        await client.query(`
          UPDATE forum_posts SET reaction_count = $1, updated_at = NOW() WHERE id = $2
        `, [newCount, postId]);
      }

      await client.query('COMMIT');

      logger.info('Reaction processed', { userId, postId, commentId, type, action });

      return { action, type, count: newCount };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error processing reaction', { error: error.message, userId, postId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get reactions for a post or comment
   * @param {string} postId - Post ID
   * @param {string} commentId - Comment ID (optional)
   * @returns {Object} Reactions summary
   */
  static async getReactions(postId, commentId = null) {
    try {
      const query = `
        SELECT type, COUNT(*) as count
        FROM forum_reactions
        WHERE post_id = $1 AND ${commentId ? 'comment_id = $2' : 'comment_id IS NULL'}
        GROUP BY type
      `;

      const values = commentId ? [postId, commentId] : [postId];
      const result = await pool.query(query, values);

      return result.rows.reduce((acc, r) => {
        acc[r.type] = parseInt(r.count);
        return acc;
      }, {});

    } catch (error) {
      logger.error('Error getting reactions', { error: error.message, postId });
      throw error;
    }
  }

  // ============================================
  // BOOKMARKS
  // ============================================

  /**
   * Toggle bookmark
   * @param {string} userId - User ID
   * @param {string} postId - Post ID
   * @returns {Object} Bookmark result
   */
  static async toggleBookmark(userId, postId) {
    try {
      // Check existing bookmark
      const existingQuery = `
        SELECT id FROM forum_bookmarks WHERE user_id = $1 AND post_id = $2
      `;
      const existingResult = await pool.query(existingQuery, [userId, postId]);

      if (existingResult.rows.length > 0) {
        // Remove bookmark
        await pool.query('DELETE FROM forum_bookmarks WHERE id = $1', [existingResult.rows[0].id]);
        return { bookmarked: false };
      } else {
        // Add bookmark
        await pool.query(`
          INSERT INTO forum_bookmarks (user_id, post_id, created_at)
          VALUES ($1, $2, NOW())
        `, [userId, postId]);
        return { bookmarked: true };
      }

    } catch (error) {
      logger.error('Error toggling bookmark', { error: error.message, userId, postId });
      throw error;
    }
  }

  /**
   * Get user's bookmarked posts
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated bookmarks
   */
  static async getUserBookmarks(userId, options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const offset = (page - 1) * limit;

      const countQuery = `SELECT COUNT(*) FROM forum_bookmarks WHERE user_id = $1`;
      const countResult = await pool.query(countQuery, [userId]);
      const total = parseInt(countResult.rows[0].count);

      const query = `
        SELECT p.*,
               u.display_name as author_name,
               u.profile_image_url as author_image,
               fb.created_at as bookmarked_at
        FROM forum_bookmarks fb
        JOIN forum_posts p ON fb.post_id = p.id
        JOIN users u ON p.author_id = u.id
        WHERE fb.user_id = $1 AND p.status = $2
        ORDER BY fb.created_at DESC
        LIMIT $3 OFFSET $4
      `;

      const result = await pool.query(query, [
        userId, 
        this.POST_STATUSES.PUBLISHED, 
        limit, 
        offset
      ]);

      return {
        posts: result.rows.map(p => ({
          ...this.formatPost(p),
          bookmarkedAt: p.bookmarked_at
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
      logger.error('Error getting user bookmarks', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // REPORTING & MODERATION
  // ============================================

  /**
   * Report content
   * @param {Object} reportData - Report details
   * @returns {Object} Created report
   */
  static async createReport(reportData) {
    try {
      const {
        reporter_id,
        post_id = null,
        comment_id = null,
        reason,
        description = null
      } = reportData;

      if (!post_id && !comment_id) {
        throw new Error('Must specify post_id or comment_id');
      }

      const query = `
        INSERT INTO forum_reports (
          reporter_id, post_id, comment_id, reason, description,
          status, created_at
        ) VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
        RETURNING *
      `;

      const result = await pool.query(query, [
        reporter_id, post_id, comment_id, reason, description
      ]);

      logger.info('Report created', { 
        reportId: result.rows[0].id, 
        reporterId: reporter_id,
        postId: post_id,
        commentId: comment_id
      });

      return result.rows[0];

    } catch (error) {
      logger.error('Error creating report', { error: error.message, reportData });
      throw error;
    }
  }

  /**
   * Get pending reports (admin)
   * @param {Object} options - Query options
   * @returns {Object} Paginated reports
   */
  static async getPendingReports(options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const offset = (page - 1) * limit;

      const countQuery = `SELECT COUNT(*) FROM forum_reports WHERE status = 'pending'`;
      const countResult = await pool.query(countQuery);
      const total = parseInt(countResult.rows[0].count);

      const query = `
        SELECT r.*,
               reporter.display_name as reporter_name,
               p.title as post_title,
               c.content as comment_content
        FROM forum_reports r
        JOIN users reporter ON r.reporter_id = reporter.id
        LEFT JOIN forum_posts p ON r.post_id = p.id
        LEFT JOIN forum_comments c ON r.comment_id = c.id
        WHERE r.status = 'pending'
        ORDER BY r.created_at ASC
        LIMIT $1 OFFSET $2
      `;

      const result = await pool.query(query, [limit, offset]);

      return {
        reports: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      logger.error('Error getting pending reports', { error: error.message });
      throw error;
    }
  }

  /**
   * Resolve report (admin)
   * @param {string} reportId - Report ID
   * @param {string} adminId - Admin user ID
   * @param {Object} resolution - Resolution details
   * @returns {Object} Updated report
   */
  static async resolveReport(reportId, adminId, resolution) {
    try {
      const { action, note } = resolution;

      const query = `
        UPDATE forum_reports 
        SET status = 'resolved', 
            resolved_by = $1, 
            resolved_at = NOW(),
            resolution_action = $2,
            resolution_note = $3
        WHERE id = $4
        RETURNING *
      `;

      const result = await pool.query(query, [adminId, action, note, reportId]);

      if (result.rows.length === 0) {
        throw new Error('Report not found');
      }

      logger.info('Report resolved', { reportId, adminId, action });

      return result.rows[0];

    } catch (error) {
      logger.error('Error resolving report', { error: error.message, reportId });
      throw error;
    }
  }

  // ============================================
  // STATISTICS & ANALYTICS
  // ============================================

  /**
   * Get forum statistics
   * @returns {Object} Forum statistics
   */
  static async getStatistics() {
    try {
      const stats = {};

      // Total posts
      const postsQuery = `SELECT COUNT(*) FROM forum_posts WHERE status = $1`;
      const postsResult = await pool.query(postsQuery, [this.POST_STATUSES.PUBLISHED]);
      stats.totalPosts = parseInt(postsResult.rows[0].count);

      // Total comments
      const commentsQuery = `SELECT COUNT(*) FROM forum_comments WHERE status = 'published'`;
      const commentsResult = await pool.query(commentsQuery);
      stats.totalComments = parseInt(commentsResult.rows[0].count);

      // Posts by category
      const byCategoryQuery = `
        SELECT category, COUNT(*) as count
        FROM forum_posts
        WHERE status = $1
        GROUP BY category
        ORDER BY count DESC
      `;
      const byCategoryResult = await pool.query(byCategoryQuery, [this.POST_STATUSES.PUBLISHED]);
      stats.postsByCategory = byCategoryResult.rows;

      // Active users (posted in last 30 days)
      const activeUsersQuery = `
        SELECT COUNT(DISTINCT author_id)
        FROM forum_posts
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `;
      const activeUsersResult = await pool.query(activeUsersQuery);
      stats.activeUsers = parseInt(activeUsersResult.rows[0].count);

      // Posts today
      const todayQuery = `
        SELECT COUNT(*) FROM forum_posts
        WHERE DATE(created_at) = CURRENT_DATE AND status = $1
      `;
      const todayResult = await pool.query(todayQuery, [this.POST_STATUSES.PUBLISHED]);
      stats.postsToday = parseInt(todayResult.rows[0].count);

      return stats;

    } catch (error) {
      logger.error('Error getting forum statistics', { error: error.message });
      throw error;
    }
  }

  /**
   * Get category statistics
   * @param {string} category - Category
   * @returns {Object} Category statistics
   */
  static async getCategoryStatistics(category) {
    try {
      const query = `
        SELECT 
          COUNT(*) as post_count,
          SUM(view_count) as total_views,
          SUM(comment_count) as total_comments,
          SUM(reaction_count) as total_reactions
        FROM forum_posts
        WHERE category = $1 AND status = $2
      `;

      const result = await pool.query(query, [category, this.POST_STATUSES.PUBLISHED]);

      return {
        category,
        postCount: parseInt(result.rows[0].post_count),
        totalViews: parseInt(result.rows[0].total_views) || 0,
        totalComments: parseInt(result.rows[0].total_comments) || 0,
        totalReactions: parseInt(result.rows[0].total_reactions) || 0
      };

    } catch (error) {
      logger.error('Error getting category statistics', { error: error.message, category });
      throw error;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Generate slug from title
   * @param {string} title - Post title
   * @returns {string} Slug
   */
  static generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);
  }

  /**
   * Increment view count
   * @param {string} postId - Post ID
   * @param {string} viewerId - Viewer user ID
   */
  static async incrementViewCount(postId, viewerId) {
    try {
      // Check if already viewed recently (within 24 hours)
      const viewCheck = await pool.query(`
        SELECT id FROM forum_post_views
        WHERE post_id = $1 AND user_id = $2 AND viewed_at > NOW() - INTERVAL '24 hours'
      `, [postId, viewerId]);

      if (viewCheck.rows.length === 0) {
        // Record view
        await pool.query(`
          INSERT INTO forum_post_views (post_id, user_id, viewed_at)
          VALUES ($1, $2, NOW())
        `, [postId, viewerId]);

        // Increment count
        await pool.query(`
          UPDATE forum_posts SET view_count = view_count + 1 WHERE id = $1
        `, [postId]);
      }
    } catch (error) {
      // Non-critical, just log
      logger.error('Error incrementing view count', { error: error.message, postId });
    }
  }

  /**
   * Log activity
   * @param {Object} client - Database client
   * @param {Object} activityData - Activity details
   */
  static async logActivity(client, activityData) {
    try {
      const { user_id, action, target_type, target_id, metadata = {} } = activityData;

      await client.query(`
        INSERT INTO forum_activity_log (
          user_id, action, target_type, target_id, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `, [user_id, action, target_type, target_id, JSON.stringify(metadata)]);

    } catch (error) {
      logger.error('Error logging activity', { error: error.message });
    }
  }

  /**
   * Create notification
   * @param {Object} client - Database client
   * @param {Object} notificationData - Notification details
   */
  static async createNotification(client, notificationData) {
    try {
      const { user_id, type, title, content, target_type, target_id, actor_id } = notificationData;

      await client.query(`
        INSERT INTO notifications (
          user_id, type, title, content, target_type, target_id, actor_id,
          is_read, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW())
      `, [user_id, type, title, content, target_type, target_id, actor_id]);

    } catch (error) {
      logger.error('Error creating notification', { error: error.message });
    }
  }

  /**
   * Format post for API response
   * @param {Object} post - Raw post data
   * @returns {Object} Formatted post
   */
  static formatPost(post) {
    if (!post) return null;

    return {
      id: post.id,
      authorId: post.author_id,
      authorName: post.author_name,
      authorImage: post.author_image,
      authorVerified: post.author_verified,
      authorReaderId: post.author_reader_id,
      title: post.title,
      slug: post.slug,
      content: post.content,
      type: post.type,
      category: post.category,
      tags: post.tags,
      images: post.images,
      isPinned: post.is_pinned,
      isFeatured: post.is_featured,
      allowComments: post.allow_comments,
      pollOptions: post.poll_options ? JSON.parse(post.poll_options) : null,
      pollEndDate: post.poll_end_date,
      metadata: typeof post.metadata === 'string' ? JSON.parse(post.metadata) : post.metadata,
      status: post.status,
      viewCount: post.view_count,
      commentCount: post.comment_count,
      reactionCount: post.reaction_count,
      reactions: post.reactions || {},
      viewerReaction: post.viewer_reaction,
      isBookmarked: post.is_bookmarked || false,
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      editedAt: post.edited_at
    };
  }

  /**
   * Format comment for API response
   * @param {Object} comment - Raw comment data
   * @returns {Object} Formatted comment
   */
  static formatComment(comment) {
    if (!comment) return null;

    return {
      id: comment.id,
      postId: comment.post_id,
      authorId: comment.author_id,
      authorName: comment.author_name,
      authorImage: comment.author_image,
      authorVerified: comment.author_verified,
      parentId: comment.parent_id,
      content: comment.content,
      images: comment.images,
      metadata: typeof comment.metadata === 'string' ? JSON.parse(comment.metadata) : comment.metadata,
      status: comment.status,
      reactionCount: comment.reaction_count,
      replyCount: comment.reply_count,
      replies: comment.replies || [],
      hasMoreReplies: comment.hasMoreReplies || false,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      editedAt: comment.edited_at
    };
  }
}

module.exports = Forum;