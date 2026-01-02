import express from 'express';
import { requireAuth, requireReader, optionalAuth } from '../middleware/auth.js';
import agoraService from '../services/agora.service.js';
import { query, transaction } from '../config/database.js';

const router = express.Router();

// Create a new live stream
router.post('/create', requireAuth, requireReader, async (req, res) => {
  try {
    const readerId = req.dbUserId;
    const { title, description, streamType = 'public', scheduledTime } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Generate unique channel name
    const channelName = agoraService.generateChannelName(readerId, Date.now());

    // Generate Agora token for streamer
    const uid = parseInt(readerId.replace(/-/g, '').substring(0, 8), 16);
    const tokenData = agoraService.generateStreamerToken(channelName, uid);

    // Create stream in database
    const result = await query(
      `INSERT INTO live_streams 
       (reader_id, title, description, stream_type, agora_channel_name, agora_token, start_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        readerId,
        title,
        description,
        streamType,
        channelName,
        tokenData.token,
        scheduledTime || new Date(),
        scheduledTime ? 'scheduled' : 'live'
      ]
    );

    res.json({
      stream: result.rows[0],
      agoraConfig: {
        appId: tokenData.appId,
        channelName: tokenData.channelName,
        token: tokenData.token,
        uid: tokenData.uid
      }
    });
  } catch (error) {
    console.error('Error creating stream:', error);
    res.status(500).json({ error: 'Failed to create stream' });
  }
});

// Start a scheduled stream
router.post('/:streamId/start', requireAuth, requireReader, async (req, res) => {
  try {
    const { streamId } = req.params;
    const readerId = req.dbUserId;

    const result = await query(
      `UPDATE live_streams 
       SET status = 'live', start_time = NOW()
       WHERE id = $1 AND reader_id = $2 AND status = 'scheduled'
       RETURNING *`,
      [streamId, readerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stream not found or already started' });
    }

    res.json({ stream: result.rows[0] });
  } catch (error) {
    console.error('Error starting stream:', error);
    res.status(500).json({ error: 'Failed to start stream' });
  }
});

// End a live stream
router.post('/:streamId/end', requireAuth, requireReader, async (req, res) => {
  try {
    const { streamId } = req.params;
    const readerId = req.dbUserId;

    const result = await query(
      `UPDATE live_streams 
       SET status = 'ended', end_time = NOW()
       WHERE id = $1 AND reader_id = $2 AND status = 'live'
       RETURNING *`,
      [streamId, readerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Stream not found or already ended' });
    }

    res.json({ stream: result.rows[0] });
  } catch (error) {
    console.error('Error ending stream:', error);
    res.status(500).json({ error: 'Failed to end stream' });
  }
});

// Join a live stream (get viewer token)
router.post('/:streamId/join', requireAuth, async (req, res) => {
  try {
    const { streamId } = req.params;
    const userId = req.dbUserId;

    // Get stream details
    const streamResult = await query(
      'SELECT * FROM live_streams WHERE id = $1 AND status = $2',
      [streamId, 'live']
    );

    if (streamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Stream not found or not live' });
    }

    const stream = streamResult.rows[0];

    // Generate viewer token
    const uid = parseInt(userId.replace(/-/g, '').substring(0, 8), 16);
    const tokenData = agoraService.generateViewerToken(stream.agora_channel_name, uid);

    // Increment viewer count
    await query(
      'UPDATE live_streams SET viewer_count = viewer_count + 1 WHERE id = $1',
      [streamId]
    );

    res.json({
      stream,
      agoraConfig: {
        appId: tokenData.appId,
        channelName: tokenData.channelName,
        token: tokenData.token,
        uid: tokenData.uid
      }
    });
  } catch (error) {
    console.error('Error joining stream:', error);
    res.status(500).json({ error: 'Failed to join stream' });
  }
});

// Get all live streams
router.get('/live', optionalAuth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const result = await query(
      `SELECT s.*, r.display_name, r.profile_picture_url, r.average_rating
       FROM live_streams s
       JOIN reader_profiles r ON s.reader_id = r.user_id
       WHERE s.status = 'live'
       ORDER BY s.viewer_count DESC, s.start_time DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({ streams: result.rows });
  } catch (error) {
    console.error('Error getting live streams:', error);
    res.status(500).json({ error: 'Failed to get live streams' });
  }
});

// Get scheduled streams
router.get('/scheduled', optionalAuth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const result = await query(
      `SELECT s.*, r.display_name, r.profile_picture_url, r.average_rating
       FROM live_streams s
       JOIN reader_profiles r ON s.reader_id = r.user_id
       WHERE s.status = 'scheduled' AND s.start_time > NOW()
       ORDER BY s.start_time ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({ streams: result.rows });
  } catch (error) {
    console.error('Error getting scheduled streams:', error);
    res.status(500).json({ error: 'Failed to get scheduled streams' });
  }
});

// Send virtual gift during stream
router.post('/:streamId/gift', requireAuth, async (req, res) => {
  try {
    const { streamId } = req.params;
    const { giftId } = req.body;
    const senderId = req.dbUserId;

    // Get gift details
    const giftResult = await query(
      'SELECT * FROM virtual_gifts WHERE id = $1 AND is_active = true',
      [giftId]
    );

    if (giftResult.rows.length === 0) {
      return res.status(404).json({ error: 'Gift not found' });
    }

    const gift = giftResult.rows[0];

    // Get stream details
    const streamResult = await query(
      'SELECT * FROM live_streams WHERE id = $1 AND status = $2',
      [streamId, 'live']
    );

    if (streamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Stream not found or not live' });
    }

    const stream = streamResult.rows[0];

    // Check sender balance
    const balanceResult = await query(
      'SELECT balance FROM users WHERE id = $1',
      [senderId]
    );

    if (balanceResult.rows[0].balance < gift.price) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Calculate revenue split
    const receiverEarnings = gift.price * 0.70;
    const platformFee = gift.price * 0.30;

    // Process gift transaction
    await transaction(async (client) => {
      // Deduct from sender
      await client.query(
        'UPDATE users SET balance = balance - $1 WHERE id = $2',
        [gift.price, senderId]
      );

      // Add to receiver earnings
      await client.query(
        `UPDATE reader_profiles 
         SET pending_payout = pending_payout + $1,
             total_earnings = total_earnings + $1
         WHERE user_id = $2`,
        [receiverEarnings, stream.reader_id]
      );

      // Update stream total gifts
      await client.query(
        'UPDATE live_streams SET total_gifts_received = total_gifts_received + $1 WHERE id = $2',
        [gift.price, streamId]
      );

      // Create gift transaction record
      await client.query(
        `INSERT INTO gift_transactions 
         (sender_id, receiver_id, gift_id, stream_id, amount, receiver_earnings, platform_fee)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [senderId, stream.reader_id, giftId, streamId, gift.price, receiverEarnings, platformFee]
      );

      // Create transaction records
      await client.query(
        `INSERT INTO transactions 
         (user_id, transaction_type, amount, balance_after, description, metadata)
         VALUES ($1, 'gift', $2, (SELECT balance FROM users WHERE id = $1), $3, $4)`,
        [senderId, gift.price, `Sent ${gift.name} gift`, JSON.stringify({ streamId, giftId })]
      );
    });

    res.json({ success: true, message: 'Gift sent successfully' });
  } catch (error) {
    console.error('Error sending gift:', error);
    res.status(500).json({ error: 'Failed to send gift' });
  }
});

// Get available virtual gifts
router.get('/gifts', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM virtual_gifts WHERE is_active = true ORDER BY price ASC'
    );

    res.json({ gifts: result.rows });
  } catch (error) {
    console.error('Error getting gifts:', error);
    res.status(500).json({ error: 'Failed to get gifts' });
  }
});

export default router;