/**
 * Community Controller - Enterprise Level
 * Complete forum and community management endpoints for SoulSeer platform
 */

const Forum = require('../models/Forum');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const { logger } = require('../utils/logger');

class CommunityController {
  // ============================================
  // POST MANAGEMENT
  // ============================================

  /**
   * Get all posts with filters
   * GET /api/community/posts
   */
  static async getPosts(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        type,
        sort_by = 'created_at',
        sort_order = 'DESC',
        search,
        author_id,
        tag
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 50),
        category: category || null,
        type: type || null,
        sortBy: sort_by,
        sortOrder: sort_order,
        search: search || null,
        authorId: author_id || null,
        tag: tag || null
      };

      const result = await Forum.getPosts(options);

      return paginatedResponse(res, result.posts, result.pagination);

    } catch (error) {
      logger.error('Error getting posts', { error: error.message });
      return errorResponse(res, 'Failed to get posts', 500);
    }
  }

  /**
   * Get featured posts
   * GET /api/community/posts/featured
   */
  static async getFeaturedPosts(req, res) {
    try {
      const { limit = 5 } = req.query;

      const posts = await Forum.getFeaturedPosts(parseInt(limit));

      return successResponse(res, { posts });

    } catch (error) {
      logger.error('Error getting featured posts', { error: error.message });
      return errorResponse(res, 'Failed to get featured posts', 500);
    }
  }

  /**
   * Get pinned posts
   * GET /api/community/posts/pinned
   */
  static async getPinnedPosts(req, res) {
    try {
      const { category } = req.query;

      const posts = await Forum.getPinnedPosts(category || null);

      return successResponse(res, { posts });

    } catch (error) {
      logger.error('Error getting pinned posts', { error: error.message });
      return errorResponse(res, 'Failed to get pinned posts', 500);
    }
  }

  /**
   * Get trending posts
   * GET /api/community/posts/trending
   */
  static async getTrendingPosts(req, res) {
    try {
      const { limit = 10, period = '7d' } = req.query;

      const posts = await Forum.getTrendingPosts({
        limit: parseInt(limit),
        period
      });

      return successResponse(res, { posts });

    } catch (error) {
      logger.error('Error getting trending posts', { error: error.message });
      return errorResponse(res, 'Failed to get trending posts', 500);
    }
  }

  /**
   * Get recent posts
   * GET /api/community/posts/recent
   */
  static async getRecentPosts(req, res) {
    try {
      const { limit = 10, category } = req.query;

      const posts = await Forum.getRecentPosts({
        limit: parseInt(limit),
        category: category || null
      });

      return successResponse(res, { posts });

    } catch (error) {
      logger.error('Error getting recent posts', { error: error.message });
      return errorResponse(res, 'Failed to get recent posts', 500);
    }
  }

  /**
   * Get post by ID
   * GET /api/community/posts/:postId
   */
  static async getPost(req, res) {
    try {
      const { postId } = req.params;
      const userId = req.auth?.userId;

      const post = await Forum.getPostById(postId);
      if (!post) {
        return errorResponse(res, 'Post not found', 404);
      }

      // Increment view count
      await Forum.incrementViewCount(postId);

      // Check if user has reacted
      let userReaction = null;
      let isBookmarked = false;
      if (userId) {
        userReaction = await Forum.getUserReaction(postId, userId);
        isBookmarked = await Forum.isBookmarked(postId, userId);
      }

      return successResponse(res, {
        post: {
          ...post,
          userReaction,
          isBookmarked
        }
      });

    } catch (error) {
      logger.error('Error getting post', { error: error.message });
      return errorResponse(res, 'Failed to get post', 500);
    }
  }

  /**
   * Get post by slug
   * GET /api/community/posts/slug/:slug
   */
  static async getPostBySlug(req, res) {
    try {
      const { slug } = req.params;
      const userId = req.auth?.userId;

      const post = await Forum.getPostBySlug(slug);
      if (!post) {
        return errorResponse(res, 'Post not found', 404);
      }

      // Increment view count
      await Forum.incrementViewCount(post.id);

      // Check if user has reacted
      let userReaction = null;
      let isBookmarked = false;
      if (userId) {
        userReaction = await Forum.getUserReaction(post.id, userId);
        isBookmarked = await Forum.isBookmarked(post.id, userId);
      }

      return successResponse(res, {
        post: {
          ...post,
          userReaction,
          isBookmarked
        }
      });

    } catch (error) {
      logger.error('Error getting post by slug', { error: error.message });
      return errorResponse(res, 'Failed to get post', 500);
    }
  }

  /**
   * Create a new post
   * POST /api/community/posts
   */
  static async createPost(req, res) {
    try {
      const userId = req.auth.userId;
      const {
        title,
        content,
        type = 'discussion',
        category = 'general',
        tags = [],
        images = [],
        poll_options,
        poll_end_date
      } = req.body;

      // Validate required fields
      if (!title || title.trim().length < 5) {
        return errorResponse(res, 'Title must be at least 5 characters', 400);
      }

      if (!content || content.trim().length < 20) {
        return errorResponse(res, 'Content must be at least 20 characters', 400);
      }

      // Validate poll options if type is poll
      if (type === 'poll') {
        if (!poll_options || !Array.isArray(poll_options) || poll_options.length < 2) {
          return errorResponse(res, 'Poll must have at least 2 options', 400);
        }
      }

      const post = await Forum.createPost({
        author_id: userId,
        title: title.trim(),
        content: content.trim(),
        type,
        category,
        tags,
        images,
        poll_options,
        poll_end_date: poll_end_date ? new Date(poll_end_date) : null
      });

      return successResponse(res, {
        message: 'Post created successfully',
        post
      }, 201);

    } catch (error) {
      logger.error('Error creating post', { error: error.message });
      return errorResponse(res, error.message || 'Failed to create post', 500);
    }
  }

  /**
   * Update post
   * PUT /api/community/posts/:postId
   */
  static async updatePost(req, res) {
    try {
      const userId = req.auth.userId;
      const { postId } = req.params;
      const updates = req.body;

      const post = await Forum.getPostById(postId);
      if (!post) {
        return errorResponse(res, 'Post not found', 404);
      }

      // Verify ownership
      if (post.authorId !== userId) {
        return errorResponse(res, 'Not authorized to edit this post', 403);
      }

      // Filter allowed updates
      const allowedFields = ['title', 'content', 'category', 'tags', 'images'];
      const filteredUpdates = {};
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = value;
        }
      }

      const updatedPost = await Forum.updatePost(postId, filteredUpdates);

      return successResponse(res, {
        message: 'Post updated successfully',
        post: updatedPost
      });

    } catch (error) {
      logger.error('Error updating post', { error: error.message });
      return errorResponse(res, error.message || 'Failed to update post', 500);
    }
  }

  /**
   * Delete post
   * DELETE /api/community/posts/:postId
   */
  static async deletePost(req, res) {
    try {
      const userId = req.auth.userId;
      const { postId } = req.params;

      const post = await Forum.getPostById(postId);
      if (!post) {
        return errorResponse(res, 'Post not found', 404);
      }

      // Verify ownership or admin
      const user = await User.findById(userId);
      if (post.authorId !== userId && user.role !== 'admin') {
        return errorResponse(res, 'Not authorized to delete this post', 403);
      }

      await Forum.deletePost(postId);

      return successResponse(res, {
        message: 'Post deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting post', { error: error.message });
      return errorResponse(res, error.message || 'Failed to delete post', 500);
    }
  }

  // ============================================
  // COMMENT MANAGEMENT
  // ============================================

  /**
   * Get comments for a post
   * GET /api/community/posts/:postId/comments
   */
  static async getComments(req, res) {
    try {
      const { postId } = req.params;
      const {
        page = 1,
        limit = 20,
        sort_by = 'created_at',
        sort_order = 'ASC'
      } = req.query;

      const result = await Forum.getComments(postId, {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy: sort_by,
        sortOrder: sort_order
      });

      return paginatedResponse(res, result.comments, result.pagination);

    } catch (error) {
      logger.error('Error getting comments', { error: error.message });
      return errorResponse(res, 'Failed to get comments', 500);
    }
  }

  /**
   * Create comment
   * POST /api/community/posts/:postId/comments
   */
  static async createComment(req, res) {
    try {
      const userId = req.auth.userId;
      const { postId } = req.params;
      const { content, parent_id, images = [] } = req.body;

      // Validate content
      if (!content || content.trim().length < 2) {
        return errorResponse(res, 'Comment must be at least 2 characters', 400);
      }

      // Verify post exists and allows comments
      const post = await Forum.getPostById(postId);
      if (!post) {
        return errorResponse(res, 'Post not found', 404);
      }

      if (!post.allowComments) {
        return errorResponse(res, 'Comments are disabled for this post', 400);
      }

      // Verify parent comment exists if replying
      if (parent_id) {
        const parentComment = await Forum.getCommentById(parent_id);
        if (!parentComment || parentComment.postId !== postId) {
          return errorResponse(res, 'Parent comment not found', 404);
        }
      }

      const comment = await Forum.createComment({
        post_id: postId,
        author_id: userId,
        content: content.trim(),
        parent_id,
        images
      });

      // Notify post author
      if (post.authorId !== userId) {
        await Notification.create({
          user_id: post.authorId,
          type: Notification.TYPES.POST_REPLY,
          title: 'New Comment',
          content: `Someone commented on your post: "${post.title}"`,
          target_type: 'post',
          target_id: postId,
          actor_id: userId
        });
      }

      // Notify parent comment author if replying
      if (parent_id) {
        const parentComment = await Forum.getCommentById(parent_id);
        if (parentComment.authorId !== userId) {
          await Notification.create({
            user_id: parentComment.authorId,
            type: Notification.TYPES.COMMENT_REPLY,
            title: 'New Reply',
            content: 'Someone replied to your comment',
            target_type: 'comment',
            target_id: parent_id,
            actor_id: userId
          });
        }
      }

      return successResponse(res, {
        message: 'Comment created successfully',
        comment
      }, 201);

    } catch (error) {
      logger.error('Error creating comment', { error: error.message });
      return errorResponse(res, error.message || 'Failed to create comment', 500);
    }
  }

  /**
   * Update comment
   * PUT /api/community/comments/:commentId
   */
  static async updateComment(req, res) {
    try {
      const userId = req.auth.userId;
      const { commentId } = req.params;
      const { content, images } = req.body;

      const comment = await Forum.getCommentById(commentId);
      if (!comment) {
        return errorResponse(res, 'Comment not found', 404);
      }

      // Verify ownership
      if (comment.authorId !== userId) {
        return errorResponse(res, 'Not authorized to edit this comment', 403);
      }

      const updatedComment = await Forum.updateComment(commentId, {
        content: content?.trim(),
        images
      });

      return successResponse(res, {
        message: 'Comment updated successfully',
        comment: updatedComment
      });

    } catch (error) {
      logger.error('Error updating comment', { error: error.message });
      return errorResponse(res, error.message || 'Failed to update comment', 500);
    }
  }

  /**
   * Delete comment
   * DELETE /api/community/comments/:commentId
   */
  static async deleteComment(req, res) {
    try {
      const userId = req.auth.userId;
      const { commentId } = req.params;

      const comment = await Forum.getCommentById(commentId);
      if (!comment) {
        return errorResponse(res, 'Comment not found', 404);
      }

      // Verify ownership or admin
      const user = await User.findById(userId);
      if (comment.authorId !== userId && user.role !== 'admin') {
        return errorResponse(res, 'Not authorized to delete this comment', 403);
      }

      await Forum.deleteComment(commentId);

      return successResponse(res, {
        message: 'Comment deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting comment', { error: error.message });
      return errorResponse(res, error.message || 'Failed to delete comment', 500);
    }
  }

  // ============================================
  // REACTIONS
  // ============================================

  /**
   * Add reaction to post
   * POST /api/community/posts/:postId/reactions
   */
  static async addPostReaction(req, res) {
    try {
      const userId = req.auth.userId;
      const { postId } = req.params;
      const { type = 'like' } = req.body;

      // Validate reaction type
      const validTypes = ['like', 'love', 'insightful', 'helpful', 'inspiring'];
      if (!validTypes.includes(type)) {
        return errorResponse(res, 'Invalid reaction type', 400);
      }

      const post = await Forum.getPostById(postId);
      if (!post) {
        return errorResponse(res, 'Post not found', 404);
      }

      const reaction = await Forum.addReaction(postId, userId, type);

      // Notify post author
      if (post.authorId !== userId) {
        await Notification.create({
          user_id: post.authorId,
          type: Notification.TYPES.POST_REACTION,
          title: 'New Reaction',
          content: `Someone reacted to your post: "${post.title}"`,
          target_type: 'post',
          target_id: postId,
          actor_id: userId,
          priority: Notification.PRIORITIES.LOW
        });
      }

      return successResponse(res, {
        message: 'Reaction added',
        reaction
      });

    } catch (error) {
      logger.error('Error adding reaction', { error: error.message });
      return errorResponse(res, error.message || 'Failed to add reaction', 500);
    }
  }

  /**
   * Remove reaction from post
   * DELETE /api/community/posts/:postId/reactions
   */
  static async removePostReaction(req, res) {
    try {
      const userId = req.auth.userId;
      const { postId } = req.params;

      await Forum.removeReaction(postId, userId);

      return successResponse(res, {
        message: 'Reaction removed'
      });

    } catch (error) {
      logger.error('Error removing reaction', { error: error.message });
      return errorResponse(res, 'Failed to remove reaction', 500);
    }
  }

  /**
   * Add reaction to comment
   * POST /api/community/comments/:commentId/reactions
   */
  static async addCommentReaction(req, res) {
    try {
      const userId = req.auth.userId;
      const { commentId } = req.params;
      const { type = 'like' } = req.body;

      const comment = await Forum.getCommentById(commentId);
      if (!comment) {
        return errorResponse(res, 'Comment not found', 404);
      }

      const reaction = await Forum.addCommentReaction(commentId, userId, type);

      return successResponse(res, {
        message: 'Reaction added',
        reaction
      });

    } catch (error) {
      logger.error('Error adding comment reaction', { error: error.message });
      return errorResponse(res, error.message || 'Failed to add reaction', 500);
    }
  }

  /**
   * Remove reaction from comment
   * DELETE /api/community/comments/:commentId/reactions
   */
  static async removeCommentReaction(req, res) {
    try {
      const userId = req.auth.userId;
      const { commentId } = req.params;

      await Forum.removeCommentReaction(commentId, userId);

      return successResponse(res, {
        message: 'Reaction removed'
      });

    } catch (error) {
      logger.error('Error removing comment reaction', { error: error.message });
      return errorResponse(res, 'Failed to remove reaction', 500);
    }
  }

  // ============================================
  // BOOKMARKS
  // ============================================

  /**
   * Get user's bookmarks
   * GET /api/community/bookmarks
   */
  static async getBookmarks(req, res) {
    try {
      const userId = req.auth.userId;
      const { page = 1, limit = 20 } = req.query;

      const result = await Forum.getUserBookmarks(userId, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return paginatedResponse(res, result.posts, result.pagination);

    } catch (error) {
      logger.error('Error getting bookmarks', { error: error.message });
      return errorResponse(res, 'Failed to get bookmarks', 500);
    }
  }

  /**
   * Add bookmark
   * POST /api/community/posts/:postId/bookmark
   */
  static async addBookmark(req, res) {
    try {
      const userId = req.auth.userId;
      const { postId } = req.params;

      const post = await Forum.getPostById(postId);
      if (!post) {
        return errorResponse(res, 'Post not found', 404);
      }

      await Forum.addBookmark(postId, userId);

      return successResponse(res, {
        message: 'Post bookmarked'
      });

    } catch (error) {
      logger.error('Error adding bookmark', { error: error.message });
      return errorResponse(res, error.message || 'Failed to bookmark post', 500);
    }
  }

  /**
   * Remove bookmark
   * DELETE /api/community/posts/:postId/bookmark
   */
  static async removeBookmark(req, res) {
    try {
      const userId = req.auth.userId;
      const { postId } = req.params;

      await Forum.removeBookmark(postId, userId);

      return successResponse(res, {
        message: 'Bookmark removed'
      });

    } catch (error) {
      logger.error('Error removing bookmark', { error: error.message });
      return errorResponse(res, 'Failed to remove bookmark', 500);
    }
  }

  // ============================================
  // POLLS
  // ============================================

  /**
   * Vote on poll
   * POST /api/community/posts/:postId/vote
   */
  static async votePoll(req, res) {
    try {
      const userId = req.auth.userId;
      const { postId } = req.params;
      const { option_index } = req.body;

      if (option_index === undefined || option_index < 0) {
        return errorResponse(res, 'Valid option index is required', 400);
      }

      const post = await Forum.getPostById(postId);
      if (!post) {
        return errorResponse(res, 'Post not found', 404);
      }

      if (post.type !== 'poll') {
        return errorResponse(res, 'This post is not a poll', 400);
      }

      // Check if poll has ended
      if (post.pollEndDate && new Date(post.pollEndDate) < new Date()) {
        return errorResponse(res, 'This poll has ended', 400);
      }

      const result = await Forum.votePoll(postId, userId, option_index);

      return successResponse(res, {
        message: 'Vote recorded',
        poll: result
      });

    } catch (error) {
      logger.error('Error voting on poll', { error: error.message });
      return errorResponse(res, error.message || 'Failed to vote', 500);
    }
  }

  /**
   * Get poll results
   * GET /api/community/posts/:postId/poll-results
   */
  static async getPollResults(req, res) {
    try {
      const { postId } = req.params;
      const userId = req.auth?.userId;

      const post = await Forum.getPostById(postId);
      if (!post) {
        return errorResponse(res, 'Post not found', 404);
      }

      if (post.type !== 'poll') {
        return errorResponse(res, 'This post is not a poll', 400);
      }

      const results = await Forum.getPollResults(postId);

      // Check if user has voted
      let userVote = null;
      if (userId) {
        userVote = await Forum.getUserPollVote(postId, userId);
      }

      return successResponse(res, {
        results,
        userVote,
        hasEnded: post.pollEndDate && new Date(post.pollEndDate) < new Date()
      });

    } catch (error) {
      logger.error('Error getting poll results', { error: error.message });
      return errorResponse(res, 'Failed to get poll results', 500);
    }
  }

  // ============================================
  // CATEGORIES & TAGS
  // ============================================

  /**
   * Get all categories
   * GET /api/community/categories
   */
  static async getCategories(req, res) {
    try {
      const categories = await Forum.getCategories();

      return successResponse(res, { categories });

    } catch (error) {
      logger.error('Error getting categories', { error: error.message });
      return errorResponse(res, 'Failed to get categories', 500);
    }
  }

  /**
   * Get category by slug
   * GET /api/community/categories/:slug
   */
  static async getCategory(req, res) {
    try {
      const { slug } = req.params;

      const category = await Forum.getCategoryBySlug(slug);
      if (!category) {
        return errorResponse(res, 'Category not found', 404);
      }

      // Get category stats
      const stats = await Forum.getCategoryStats(category.id);

      return successResponse(res, {
        category: {
          ...category,
          ...stats
        }
      });

    } catch (error) {
      logger.error('Error getting category', { error: error.message });
      return errorResponse(res, 'Failed to get category', 500);
    }
  }

  /**
   * Get popular tags
   * GET /api/community/tags/popular
   */
  static async getPopularTags(req, res) {
    try {
      const { limit = 20 } = req.query;

      const tags = await Forum.getPopularTags(parseInt(limit));

      return successResponse(res, { tags });

    } catch (error) {
      logger.error('Error getting popular tags', { error: error.message });
      return errorResponse(res, 'Failed to get tags', 500);
    }
  }

  /**
   * Get posts by tag
   * GET /api/community/tags/:tag/posts
   */
  static async getPostsByTag(req, res) {
    try {
      const { tag } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await Forum.getPostsByTag(tag, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return paginatedResponse(res, result.posts, result.pagination);

    } catch (error) {
      logger.error('Error getting posts by tag', { error: error.message });
      return errorResponse(res, 'Failed to get posts', 500);
    }
  }

  // ============================================
  // REPORTING
  // ============================================

  /**
   * Report post
   * POST /api/community/posts/:postId/report
   */
  static async reportPost(req, res) {
    try {
      const userId = req.auth.userId;
      const { postId } = req.params;
      const { reason, details } = req.body;

      if (!reason) {
        return errorResponse(res, 'Reason is required', 400);
      }

      const post = await Forum.getPostById(postId);
      if (!post) {
        return errorResponse(res, 'Post not found', 404);
      }

      await Forum.reportPost(postId, userId, {
        reason,
        details
      });

      return successResponse(res, {
        message: 'Report submitted successfully'
      });

    } catch (error) {
      logger.error('Error reporting post', { error: error.message });
      return errorResponse(res, error.message || 'Failed to submit report', 500);
    }
  }

  /**
   * Report comment
   * POST /api/community/comments/:commentId/report
   */
  static async reportComment(req, res) {
    try {
      const userId = req.auth.userId;
      const { commentId } = req.params;
      const { reason, details } = req.body;

      if (!reason) {
        return errorResponse(res, 'Reason is required', 400);
      }

      const comment = await Forum.getCommentById(commentId);
      if (!comment) {
        return errorResponse(res, 'Comment not found', 404);
      }

      await Forum.reportComment(commentId, userId, {
        reason,
        details
      });

      return successResponse(res, {
        message: 'Report submitted successfully'
      });

    } catch (error) {
      logger.error('Error reporting comment', { error: error.message });
      return errorResponse(res, error.message || 'Failed to submit report', 500);
    }
  }

  // ============================================
  // USER ACTIVITY
  // ============================================

  /**
   * Get user's posts
   * GET /api/community/users/:userId/posts
   */
  static async getUserPosts(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await Forum.getUserPosts(userId, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return paginatedResponse(res, result.posts, result.pagination);

    } catch (error) {
      logger.error('Error getting user posts', { error: error.message });
      return errorResponse(res, 'Failed to get posts', 500);
    }
  }

  /**
   * Get user's comments
   * GET /api/community/users/:userId/comments
   */
  static async getUserComments(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await Forum.getUserComments(userId, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return paginatedResponse(res, result.comments, result.pagination);

    } catch (error) {
      logger.error('Error getting user comments', { error: error.message });
      return errorResponse(res, 'Failed to get comments', 500);
    }
  }

  /**
   * Get community statistics
   * GET /api/community/stats
   */
  static async getCommunityStats(req, res) {
    try {
      const stats = await Forum.getCommunityStats();

      return successResponse(res, { stats });

    } catch (error) {
      logger.error('Error getting community stats', { error: error.message });
      return errorResponse(res, 'Failed to get statistics', 500);
    }
  }

  /**
   * Search community
   * GET /api/community/search
   */
  static async search(req, res) {
    try {
      const {
        q,
        type = 'all', // all, posts, comments
        page = 1,
        limit = 20
      } = req.query;

      if (!q || q.trim().length < 2) {
        return errorResponse(res, 'Search query must be at least 2 characters', 400);
      }

      const result = await Forum.search({
        query: q.trim(),
        type,
        page: parseInt(page),
        limit: parseInt(limit)
      });

      return paginatedResponse(res, result.results, result.pagination);

    } catch (error) {
      logger.error('Error searching community', { error: error.message });
      return errorResponse(res, 'Failed to search', 500);
    }
  }
}

module.exports = CommunityController;