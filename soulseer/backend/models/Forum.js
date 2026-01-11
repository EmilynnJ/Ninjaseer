/**
 * Forum Model
 * Handles community forum operations
 */

import { query, transaction } from '../config/database.js';

class Forum {
  /**
   * Create a new forum post
   */
  static async createPost({ userId, title, content, category }) {
    const result = await query(
      `INSERT INTO forum_posts (
        user_id, title, content, category,
        view_count, like_count, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, 0, 0, NOW(), NOW())
      RETURNING *`,
      [userId, title, content, category]
    );
    return result.rows[0];
  }

  /**
   * Find post by ID
   */
  static async findPostById(postId) {
    const result = await query(
      `SELECT p.*,
              u.display_name as user_name,
              u.profile_picture_url as user_picture,
              COUNT(c.id) as comment_count
       FROM forum_posts p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN forum_comments c ON p.id = c.post_id
       WHERE p.id = $1
       GROUP BY p.id, u.display_name, u.profile_picture_url`,
      [postId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update post
   */
  static async updatePost(postId, updates) {
    const allowedFields = ['title', 'content', 'category'];
    
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [postId, ...fields.map(field => updates[field])];

    const result = await query(
      `UPDATE forum_posts 
       SET ${setClause}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Increment post view count
   */
  static async incrementViewCount(postId) {
    const result = await query(
      `UPDATE forum_posts 
       SET view_count = view_count + 1,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [postId]
    );
    return result.rows[0] || null;
  }

  /**
   * Like/unlike post
   */
  static async toggleLike(postId, userId) {
    return await transaction(async (client) => {
      // Check if already liked
      const existing = await client.query(
        `SELECT id FROM post_likes 
         WHERE post_id = $1 AND user_id = $2`,
        [postId, userId]
      );

      if (existing.rows.length > 0) {
        // Unlike
        await client.query(
          `DELETE FROM post_likes 
           WHERE post_id = $1 AND user_id = $2`,
          [postId, userId]
        );

        await client.query(
          `UPDATE forum_posts 
           SET like_count = like_count - 1,
               updated_at = NOW()
           WHERE id = $1`,
          [postId]
        );

        return { liked: false };
      } else {
        // Like
        await client.query(
          `INSERT INTO post_likes (post_id, user_id)
           VALUES ($1, $2)`,
          [postId, userId]
        );

        await client.query(
          `UPDATE forum_posts 
           SET like_count = like_count + 1,
               updated_at = NOW()
           WHERE id = $1`,
          [postId]
        );

        return { liked: true };
      }
    });
  }

  /**
   * Get all posts with filters
   */
  static async findAllPosts({ category = null, limit = 50, offset = 0 }) {
    let queryText = `
      SELECT p.*,
             u.display_name as user_name,
             u.profile_picture_url as user_picture,
             COUNT(c.id) as comment_count,
             COUNT(*) OVER() as total_count
      FROM forum_posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN forum_comments c ON p.id = c.post_id
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      params.push(category);
      queryText += ` AND p.category = $${params.length}`;
    }

    queryText += ` GROUP BY p.id, u.display_name, u.profile_picture_url ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);
    
    return {
      posts: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Search posts
   */
  static async searchPosts(searchTerm, { limit = 20, offset = 0 }) {
    const result = await query(
      `SELECT p.*,
              u.display_name as user_name,
              u.profile_picture_url as user_picture,
              COUNT(c.id) as comment_count,
              COUNT(*) OVER() as total_count
       FROM forum_posts p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN forum_comments c ON p.id = c.post_id
       WHERE p.title ILIKE $1 OR p.content ILIKE $1
       GROUP BY p.id, u.display_name, u.profile_picture_url
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [`%${searchTerm}%`, limit, offset]
    );

    return {
      posts: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Delete post
   */
  static async deletePost(postId) {
    return await transaction(async (client) => {
      // Delete comments first
      await client.query(
        'DELETE FROM forum_comments WHERE post_id = $1',
        [postId]
      );

      // Delete likes
      await client.query(
        'DELETE FROM post_likes WHERE post_id = $1',
        [postId]
      );

      // Delete post
      const result = await client.query(
        'DELETE FROM forum_posts WHERE id = $1 RETURNING *',
        [postId]
      );

      return result.rows[0] || null;
    });
  }

  /**
   * Create comment
   */
  static async createComment({ postId, userId, content }) {
    const result = await query(
      `INSERT INTO forum_comments (
        post_id, user_id, content, created_at, updated_at
      )
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING *`,
      [postId, userId, content]
    );
    return result.rows[0];
  }

  /**
   * Find comment by ID
   */
  static async findCommentById(commentId) {
    const result = await query(
      `SELECT c.*,
              u.display_name as user_name,
              u.profile_picture_url as user_picture
       FROM forum_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = $1`,
      [commentId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update comment
   */
  static async updateComment(commentId, content) {
    const result = await query(
      `UPDATE forum_comments 
       SET content = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [content, commentId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get comments for a post
   */
  static async getComments(postId, { limit = 50, offset = 0 }) {
    const result = await query(
      `SELECT c.*,
              u.display_name as user_name,
              u.profile_picture_url as user_picture,
              COUNT(*) OVER() as total_count
       FROM forum_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC
       LIMIT $2 OFFSET $3`,
      [postId, limit, offset]
    );

    return {
      comments: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Delete comment
   */
  static async deleteComment(commentId) {
    const result = await query(
      'DELETE FROM forum_comments WHERE id = $1 RETURNING *',
      [commentId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all categories
   */
  static async getCategories() {
    const result = await query(
      `SELECT DISTINCT category,
              COUNT(*) as post_count
       FROM forum_posts
       GROUP BY category
       ORDER BY post_count DESC`
    );

    return result.rows;
  }

  /**
   * Get trending posts
   */
  static async getTrending(limit = 10, days = 7) {
    const result = await query(
      `SELECT p.*,
              u.display_name as user_name,
              u.profile_picture_url as user_picture,
              COUNT(c.id) as comment_count
       FROM forum_posts p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN forum_comments c ON p.id = c.post_id
       WHERE p.created_at >= NOW() - INTERVAL '$1 days'
       GROUP BY p.id, u.display_name, u.profile_picture_url
       ORDER BY (p.like_count * 2 + p.view_count + COUNT(c.id) * 3) DESC
       LIMIT $2`,
      [days, limit]
    );

    return result.rows;
  }
}

export default Forum;