import express from 'express';
import { requireAuth, requireReader, requireAdmin, optionalAuth } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = express.Router();

// Get all readers (public)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { 
      status = 'online', 
      specialty, 
      minRating, 
      maxRate,
      limit = 20, 
      offset = 0 
    } = req.query;

    let queryText = `
      SELECT r.*, u.email, u.clerk_id,
             COUNT(DISTINCT s.id) as total_sessions
      FROM reader_profiles r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN reading_sessions s ON r.user_id = s.reader_id
      WHERE u.is_active = true
    `;
    const params = [];
    let paramCount = 1;

    if (status) {
      queryText += ` AND r.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (minRating) {
      queryText += ` AND r.average_rating >= $${paramCount}`;
      params.push(parseFloat(minRating));
      paramCount++;
    }

    if (maxRate) {
      queryText += ` AND (r.chat_rate <= $${paramCount} OR r.call_rate <= $${paramCount} OR r.video_rate <= $${paramCount})`;
      params.push(parseFloat(maxRate));
      paramCount++;
    }

    queryText += `
      GROUP BY r.id, u.email, u.clerk_id
      ORDER BY r.is_online DESC, r.average_rating DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    params.push(limit, offset);

    const result = await query(queryText, params);

    res.json({ readers: result.rows });
  } catch (error) {
    console.error('Error getting readers:', error);
    res.status(500).json({ error: 'Failed to get readers' });
  }
});

// Get reader by ID (public)
router.get('/:readerId', optionalAuth, async (req, res) => {
  try {
    const { readerId } = req.params;

    const result = await query(
      `SELECT r.*, u.email,
              COUNT(DISTINCT s.id) as total_sessions,
              COUNT(DISTINCT sr.id) as total_reviews
       FROM reader_profiles r
       JOIN users u ON r.user_id = u.id
       LEFT JOIN reading_sessions s ON r.user_id = s.reader_id
       LEFT JOIN session_reviews sr ON r.user_id = sr.reader_id
       WHERE r.user_id = $1
       GROUP BY r.id, u.email`,
      [readerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reader not found' });
    }

    // Get recent reviews
    const reviewsResult = await query(
      `SELECT sr.*, u.email as client_email
       FROM session_reviews sr
       JOIN users u ON sr.client_id = u.id
       WHERE sr.reader_id = $1
       ORDER BY sr.created_at DESC
       LIMIT 10`,
      [readerId]
    );

    res.json({ 
      reader: result.rows[0],
      reviews: reviewsResult.rows
    });
  } catch (error) {
    console.error('Error getting reader:', error);
    res.status(500).json({ error: 'Failed to get reader' });
  }
});

// Update reader profile
router.put('/profile', requireAuth, requireReader, async (req, res) => {
  try {
    const readerId = req.dbUserId;
    const {
      displayName,
      bio,
      specialties,
      chatRate,
      callRate,
      videoRate
    } = req.body;

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (displayName) {
      updates.push(`display_name = $${paramCount}`);
      params.push(displayName);
      paramCount++;
    }

    if (bio) {
      updates.push(`bio = $${paramCount}`);
      params.push(bio);
      paramCount++;
    }

    if (specialties) {
      updates.push(`specialties = $${paramCount}`);
      params.push(specialties);
      paramCount++;
    }

    if (chatRate !== undefined) {
      updates.push(`chat_rate = $${paramCount}`);
      params.push(parseFloat(chatRate));
      paramCount++;
    }

    if (callRate !== undefined) {
      updates.push(`call_rate = $${paramCount}`);
      params.push(parseFloat(callRate));
      paramCount++;
    }

    if (videoRate !== undefined) {
      updates.push(`video_rate = $${paramCount}`);
      params.push(parseFloat(videoRate));
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    params.push(readerId);
    const result = await query(
      `UPDATE reader_profiles 
       SET ${updates.join(', ')}
       WHERE user_id = $${paramCount}
       RETURNING *`,
      params
    );

    res.json({ reader: result.rows[0] });
  } catch (error) {
    console.error('Error updating reader profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Update reader status (online/offline/busy)
router.put('/status', requireAuth, requireReader, async (req, res) => {
  try {
    const readerId = req.dbUserId;
    const { status } = req.body;

    if (!['online', 'offline', 'busy'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await query(
      `UPDATE reader_profiles 
       SET status = $1, is_online = $2
       WHERE user_id = $3
       RETURNING *`,
      [status, status === 'online', readerId]
    );

    res.json({ reader: result.rows[0] });
  } catch (error) {
    console.error('Error updating reader status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Get reader dashboard stats
router.get('/dashboard/stats', requireAuth, requireReader, async (req, res) => {
  try {
    const readerId = req.dbUserId;

    // Get earnings and session stats
    const statsResult = await query(
      `SELECT 
         r.total_earnings,
         r.pending_payout,
         r.average_rating,
         r.total_reviews,
         COUNT(DISTINCT s.id) as total_sessions,
         COUNT(DISTINCT CASE WHEN s.created_at >= NOW() - INTERVAL '7 days' THEN s.id END) as sessions_this_week,
         COUNT(DISTINCT CASE WHEN s.created_at >= NOW() - INTERVAL '30 days' THEN s.id END) as sessions_this_month,
         SUM(CASE WHEN s.created_at >= NOW() - INTERVAL '7 days' THEN s.reader_earnings ELSE 0 END) as earnings_this_week,
         SUM(CASE WHEN s.created_at >= NOW() - INTERVAL '30 days' THEN s.reader_earnings ELSE 0 END) as earnings_this_month
       FROM reader_profiles r
       LEFT JOIN reading_sessions s ON r.user_id = s.reader_id
       WHERE r.user_id = $1
       GROUP BY r.id`,
      [readerId]
    );

    res.json({ stats: statsResult.rows[0] });
  } catch (error) {
    console.error('Error getting reader stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Get reader earnings history
router.get('/earnings/history', requireAuth, requireReader, async (req, res) => {
  try {
    const readerId = req.dbUserId;
    const { limit = 50, offset = 0 } = req.query;

    const result = await query(
      `SELECT s.*, u.email as client_email
       FROM reading_sessions s
       JOIN users u ON s.client_id = u.id
       WHERE s.reader_id = $1 AND s.status = 'completed'
       ORDER BY s.created_at DESC
       LIMIT $2 OFFSET $3`,
      [readerId, limit, offset]
    );

    res.json({ sessions: result.rows });
  } catch (error) {
    console.error('Error getting earnings history:', error);
    res.status(500).json({ error: 'Failed to get earnings history' });
  }
});

export default router;