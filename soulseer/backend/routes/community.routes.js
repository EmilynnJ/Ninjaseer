import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { query, transaction } from '../config/database.js';

const router = express.Router();

// Get all forum posts
router.get('/posts', async (req, res) => {
  try {
    const { category, limit = 50, offset = 0 } = req.query;

    let queryText = `
      SELECT p.*, u.email as user_email,
             (SELECT COUNT(*) FROM forum_comments WHERE post_id = p.id) as comment_count
      FROM forum_posts p
      JOIN users u ON p.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (category) {
      queryText += ` AND p.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    queryText += ` ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    res.json({ posts: result.rows });
  } catch (error) {
    console.error('Error getting posts:', error);
    res.status(500).json({ error: 'Failed to get posts' });
  }
});

// Get single post with comments
router.get('/posts/:postId', async (req, res) => {
  try {
    const { postId } = req.params;

    // Get post
    const postResult = await query(
      `SELECT p.*, u.email as user_email
       FROM forum_posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [postId]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Increment view count
    await query(
      'UPDATE forum_posts SET view_count = view_count + 1 WHERE id = $1',
      [postId]
    );

    // Get comments
    const commentsResult = await query(
      `SELECT c.*, u.email as user_email
       FROM forum_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [postId]
    );

    res.json({
      post: postResult.rows[0],
      comments: commentsResult.rows
    });
  } catch (error) {
    console.error('Error getting post:', error);
    res.status(500).json({ error: 'Failed to get post' });
  }
});

// Create forum post
router.post('/posts', requireAuth, async (req, res) => {
  try {
    const { title, content, category } = req.body;
    const userId = req.dbUserId;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const result = await query(
      `INSERT INTO forum_posts (user_id, title, content, category)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, title, content, category || 'general']
    );

    res.status(201).json({ post: result.rows[0] });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Create comment
router.post('/posts/:postId/comments', requireAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { content, parentCommentId } = req.body;
    const userId = req.dbUserId;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = await query(
      `INSERT INTO forum_comments (post_id, user_id, content, parent_comment_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [postId, userId, content, parentCommentId || null]
    );

    res.status(201).json({ comment: result.rows[0] });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// Get user's messages
router.get('/messages', requireAuth, async (req, res) => {
  try {
    const userId = req.dbUserId;
    const { limit = 50, offset = 0 } = req.query;

    const result = await query(
      `SELECT m.*, 
              sender.email as sender_email,
              receiver.email as receiver_email
       FROM messages m
       JOIN users sender ON m.sender_id = sender.id
       JOIN users receiver ON m.receiver_id = receiver.id
       WHERE m.sender_id = $1 OR m.receiver_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json({ messages: result.rows });
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Send message
router.post('/messages', requireAuth, async (req, res) => {
  try {
    const { receiverId, content, isPaid } = req.body;
    const senderId = req.dbUserId;

    if (!receiverId || !content) {
      return res.status(400).json({ error: 'Receiver and content are required' });
    }

    const result = await query(
      `INSERT INTO messages (sender_id, receiver_id, content, is_paid)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [senderId, receiverId, content, isPaid || false]
    );

    res.status(201).json({ message: result.rows[0] });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mark message as read
router.put('/messages/:messageId/read', requireAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.dbUserId;

    const result = await query(
      `UPDATE messages 
       SET is_read = true 
       WHERE id = $1 AND receiver_id = $2
       RETURNING *`,
      [messageId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ message: result.rows[0] });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

export default router;