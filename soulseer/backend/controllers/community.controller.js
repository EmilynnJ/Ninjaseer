/**
 * Community Controller
 * Handles forum and community operations
 */

import Forum from '../models/Forum.js';
import logger from '../utils/logger.js';

class CommunityController {
  /**
   * Get all forum posts
   */
  static async getAllPosts(req, res) {
    try {
      const { category, limit = 50, offset = 0 } = req.query;

      const result = await Forum.findAllPosts({
        category,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json(result);
    } catch (error) {
      logger.error('Error in getAllPosts', error);
      res.status(500).json({ error: 'Failed to get posts' });
    }
  }

  /**
   * Get post by ID
   */
  static async getPostById(req, res) {
    try {
      const { postId } = req.params;

      // Increment view count
      await Forum.incrementViewCount(parseInt(postId));

      const post = await Forum.findPostById(postId);

      if (!post) {
        return res.status(404).json({ error: 'Post not found' });
      }

      res.json({ post });
    } catch (error) {
      logger.error('Error in getPostById', error);
      res.status(500).json({ error: 'Failed to get post' });
    }
  }

  /**
   * Create a new post
   */
  static async createPost(req, res) {
    try {
      const userId = req.dbUserId;
      const { title, content, category } = req.body;

      // Validate required fields
      if (!title || !content || !category) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['title', 'content', 'category']
        });
      }

      const post = await Forum.createPost({
        userId,
        title,
        content,
        category
      });

      logger.info('Forum post created', { postId: post.id, userId });

      res.status(201).json({
        post,
        message: 'Post created successfully'
      });
    } catch (error) {
      logger.error('Error in createPost', error);
      res.status(500).json({ error: 'Failed to create post' });
    }
  }

  /**
   * Update post
   */
  static async updatePost(req, res) {
    try {
      const { postId } = req.params;
      const userId = req.dbUserId;
      const updates = req.body;

      // Get post to verify ownership
      const existingPost = await Forum.findPostById(postId);

      if (!existingPost) {
        return res.status(404).json({ error: 'Post not found' });
      }

      // Verify ownership
      if (existingPost.user_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const post = await Forum.updatePost(postId, updates);

      res.json({
        post,
        message: 'Post updated successfully'
      });
    } catch (error) {
      logger.error('Error in updatePost', error);
      res.status(500).json({ error: 'Failed to update post' });
    }
  }

  /**
   * Delete post
   */
  static async deletePost(req, res) {
    try {
      const { postId } = req.params;
      const userId = req.dbUserId;

      // Get post to verify ownership
      const existingPost = await Forum.findPostById(postId);

      if (!existingPost) {
        return res.status(404).json({ error: 'Post not found' });
      }

      // Verify ownership
      if (existingPost.user_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      await Forum.deletePost(postId);

      logger.info('Forum post deleted', { postId, userId });

      res.json({ message: 'Post deleted successfully' });
    } catch (error) {
      logger.error('Error in deletePost', error);
      res.status(500).json({ error: 'Failed to delete post' });
    }
  }

  /**
   * Like/unlike post
   */
  static async toggleLike(req, res) {
    try {
      const { postId } = req.params;
      const userId = req.dbUserId;

      const result = await Forum.toggleLike(parseInt(postId), userId);

      res.json(result);
    } catch (error) {
      logger.error('Error in toggleLike', error);
      res.status(500).json({ error: 'Failed to toggle like' });
    }
  }

  /**
   * Search posts
   */
  static async searchPosts(req, res) {
    try {
      const { q: searchTerm, limit = 20, offset = 0 } = req.query;

      if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required' });
      }

      const result = await Forum.searchPosts(searchTerm, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json(result);
    } catch (error) {
      logger.error('Error in searchPosts', error);
      res.status(500).json({ error: 'Failed to search posts' });
    }
  }

  /**
   * Get post comments
   */
  static async getComments(req, res) {
    try {
      const { postId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const result = await Forum.getComments(postId, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json(result);
    } catch (error) {
      logger.error('Error in getComments', error);
      res.status(500).json({ error: 'Failed to get comments' });
    }
  }

  /**
   * Add comment to post
   */
  static async addComment(req, res) {
    try {
      const { postId } = req.params;
      const userId = req.dbUserId;
      const { content } = req.body;

      // Validate required fields
      if (!content) {
        return res.status(400).json({ 
          error: 'Missing required field',
          required: ['content']
        });
      }

      const comment = await Forum.createComment({
        postId: parseInt(postId),
        userId,
        content
      });

      res.status(201).json({
        comment,
        message: 'Comment added successfully'
      });
    } catch (error) {
      logger.error('Error in addComment', error);
      res.status(500).json({ error: 'Failed to add comment' });
    }
  }

  /**
   * Update comment
   */
  static async updateComment(req, res) {
    try {
      const { postId, commentId } = req.params;
      const userId = req.dbUserId;
      const { content } = req.body;

      // Get comment to verify ownership
      const existingComment = await Forum.findCommentById(commentId);

      if (!existingComment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      // Verify ownership
      if (existingComment.user_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const comment = await Forum.updateComment(commentId, content);

      res.json({
        comment,
        message: 'Comment updated successfully'
      });
    } catch (error) {
      logger.error('Error in updateComment', error);
      res.status(500).json({ error: 'Failed to update comment' });
    }
  }

  /**
   * Delete comment
   */
  static async deleteComment(req, res) {
    try {
      const { postId, commentId } = req.params;
      const userId = req.dbUserId;

      // Get comment to verify ownership
      const existingComment = await Forum.findCommentById(commentId);

      if (!existingComment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      // Verify ownership
      if (existingComment.user_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      await Forum.deleteComment(commentId);

      res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
      logger.error('Error in deleteComment', error);
      res.status(500).json({ error: 'Failed to delete comment' });
    }
  }

  /**
   * Get all categories
   */
  static async getCategories(req, res) {
    try {
      const categories = await Forum.getCategories();

      res.json({ categories });
    } catch (error) {
      logger.error('Error in getCategories', error);
      res.status(500).json({ error: 'Failed to get categories' });
    }
  }

  /**
   * Get trending posts
   */
  static async getTrending(req, res) {
    try {
      const { limit = 10, days = 7 } = req.query;

      const posts = await Forum.getTrending(parseInt(limit), parseInt(days));

      res.json({ posts });
    } catch (error) {
      logger.error('Error in getTrending', error);
      res.status(500).json({ error: 'Failed to get trending posts' });
    }
  }
}

export default CommunityController;