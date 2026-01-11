/**
 * Stream Controller
 * Handles live streaming business logic
 */

import Stream from '../models/Stream.js';
import agoraService from '../services/agora.service.js';
import logger from '../utils/logger.js';

class StreamController {
  /**
   * Get all streams
   */
  static async getAllStreams(req, res) {
    try {
      const { status, readerId, limit = 50, offset = 0 } = req.query;

      const result = await Stream.findAll({
        status,
        readerId: readerId ? parseInt(readerId) : null,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json(result);
    } catch (error) {
      logger.error('Error in getAllStreams', error);
      res.status(500).json({ error: 'Failed to get streams' });
    }
  }

  /**
   * Get live streams
   */
  static async getLiveStreams(req, res) {
    try {
      const { limit = 50, offset = 0 } = req.query;

      const result = await Stream.getLiveStreams({
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json(result);
    } catch (error) {
      logger.error('Error in getLiveStreams', error);
      res.status(500).json({ error: 'Failed to get live streams' });
    }
  }

  /**
   * Get stream by ID
   */
  static async getStreamById(req, res) {
    try {
      const { streamId } = req.params;

      const stream = await Stream.findById(streamId);

      if (!stream) {
        return res.status(404).json({ error: 'Stream not found' });
      }

      // Generate fresh Agora tokens if live
      let agora = null;
      if (stream.status === 'live') {
        agora = {
          appId: process.env.AGORA_APP_ID,
          channelName: stream.agora_channel_name,
          token: await agoraService.generateRTCToken(stream.agora_channel_name, req.dbUserId),
          uid: req.dbUserId
        };
      }

      res.json({ stream, agora });
    } catch (error) {
      logger.error('Error in getStreamById', error);
      res.status(500).json({ error: 'Failed to get stream' });
    }
  }

  /**
   * Create a new stream
   */
  static async createStream(req, res) {
    try {
      const userId = req.dbUserId;
      const { title, description, scheduledStart, thumbnailUrl } = req.body;

      // Validate required fields
      if (!title || !description) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['title', 'description']
        });
      }

      // Check if reader already has an active stream
      const existingStream = await Stream.getActiveStream(userId);
      if (existingStream && (existingStream.status === 'scheduled' || existingStream.status === 'live')) {
        return res.status(400).json({ 
          error: 'You already have an active stream',
          activeStreamId: existingStream.id
        });
      }

      // Generate Agora channel and tokens
      const channelName = `stream_${Date.now()}_${userId}`;
      const agoraToken = await agoraService.generateRTCToken(channelName, userId);

      // Create stream
      const stream = await Stream.create({
        readerId: userId,
        title,
        description,
        thumbnailUrl,
        scheduledStart: scheduledStart ? new Date(scheduledStart) : null,
        agoraChannelName: channelName,
        agoraToken
      });

      logger.logSession('stream_created', stream.id, userId, null);

      res.status(201).json({
        stream,
        agora: {
          appId: process.env.AGORA_APP_ID,
          channelName,
          token: agoraToken,
          uid: userId
        },
        message: 'Stream created successfully'
      });
    } catch (error) {
      logger.error('Error in createStream', error, { userId: req.dbUserId });
      res.status(500).json({ error: 'Failed to create stream' });
    }
  }

  /**
   * Start a stream
   */
  static async startStream(req, res) {
    try {
      const { streamId } = req.params;
      const userId = req.dbUserId;

      const stream = await Stream.findById(streamId);

      if (!stream) {
        return res.status(404).json({ error: 'Stream not found' });
      }

      // Verify ownership
      if (stream.reader_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Start stream
      const updatedStream = await Stream.start(streamId);

      logger.logSession('stream_started', streamId, userId, null);

      res.json({
        stream: updatedStream,
        message: 'Stream started successfully'
      });
    } catch (error) {
      logger.error('Error in startStream', error, { userId: req.dbUserId });
      res.status(500).json({ error: 'Failed to start stream' });
    }
  }

  /**
   * End a stream
   */
  static async endStream(req, res) {
    try {
      const { streamId } = req.params;
      const userId = req.dbUserId;

      const stream = await Stream.findById(streamId);

      if (!stream) {
        return res.status(404).json({ error: 'Stream not found' });
      }

      // Verify ownership
      if (stream.reader_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // End stream
      const updatedStream = await Stream.end(streamId);

      logger.logSession('stream_ended', streamId, userId, null);

      res.json({
        stream: updatedStream,
        message: 'Stream ended successfully'
      });
    } catch (error) {
      logger.error('Error in endStream', error, { userId: req.dbUserId });
      res.status(500).json({ error: 'Failed to end stream' });
    }
  }

  /**
   * Update viewer count
   */
  static async updateViewerCount(req, res) {
    try {
      const { streamId } = req.params;
      const { change } = req.body;

      const viewerCount = await Stream.updateViewerCount(streamId, change);

      res.json({ viewerCount });
    } catch (error) {
      logger.error('Error in updateViewerCount', error);
      res.status(500).json({ error: 'Failed to update viewer count' });
    }
  }

  /**
   * Send gift to stream
   */
  static async sendGift(req, res) {
    try {
      const { streamId } = req.params;
      const { giftId } = req.body;
      const userId = req.dbUserId;

      // TODO: Implement gift system with Transaction model
      // For now, just increment gift count

      const stream = await Stream.findById(streamId);
      if (!stream) {
        return res.status(404).json({ error: 'Stream not found' });
      }

      const giftValue = 10; // Placeholder - get from virtual_gifts table
      await Stream.addGift(streamId, giftValue);

      logger.logPayment('gift_sent', giftValue, userId, 'completed');

      res.json({ message: 'Gift sent successfully' });
    } catch (error) {
      logger.error('Error in sendGift', error);
      res.status(500).json({ error: 'Failed to send gift' });
    }
  }

  /**
   * Get reader's streams
   */
  static async getReaderStreams(req, res) {
    try {
      const { readerId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const result = await Stream.getReaderStreams(parseInt(readerId), {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json(result);
    } catch (error) {
      logger.error('Error in getReaderStreams', error);
      res.status(500).json({ error: 'Failed to get reader streams' });
    }
  }

  /**
   * Delete stream
   */
  static async deleteStream(req, res) {
    try {
      const { streamId } = req.params;
      const userId = req.dbUserId;

      const stream = await Stream.findById(streamId);

      if (!stream) {
        return res.status(404).json({ error: 'Stream not found' });
      }

      // Verify ownership
      if (stream.reader_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      await Stream.delete(streamId);

      res.json({ message: 'Stream deleted successfully' });
    } catch (error) {
      logger.error('Error in deleteStream', error);
      res.status(500).json({ error: 'Failed to delete stream' });
    }
  }
}

export default StreamController;