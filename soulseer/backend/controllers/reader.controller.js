/**
 * Reader Controller
 * Handles reader-related business logic
 */

import Reader from '../models/Reader.js';
import User from '../models/User.js';

class ReaderController {
  /**
   * Get all readers with filters
   */
  static async getAllReaders(req, res) {
    try {
      const {
        status = null,
        specialty = null,
        minRating = null,
        maxRate = null,
        limit = 50,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = req.query;

      const result = await Reader.findAll({
        status,
        specialty,
        minRating: minRating ? parseFloat(minRating) : null,
        maxRate: maxRate ? parseFloat(maxRate) : null,
        limit: parseInt(limit),
        offset: parseInt(offset),
        sortBy,
        sortOrder
      });

      res.json(result);
    } catch (error) {
      console.error('Error in getAllReaders:', error);
      res.status(500).json({ error: 'Failed to get readers' });
    }
  }

  /**
   * Get online readers
   */
  static async getOnlineReaders(req, res) {
    try {
      const { limit = 50, offset = 0 } = req.query;

      const result = await Reader.findOnline({
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json(result);
    } catch (error) {
      console.error('Error in getOnlineReaders:', error);
      res.status(500).json({ error: 'Failed to get online readers' });
    }
  }

  /**
   * Get reader by ID
   */
  static async getReaderById(req, res) {
    try {
      const { readerId } = req.params;

      const reader = await Reader.findByUserId(readerId);

      if (!reader) {
        return res.status(404).json({ error: 'Reader not found' });
      }

      res.json({ reader });
    } catch (error) {
      console.error('Error in getReaderById:', error);
      res.status(500).json({ error: 'Failed to get reader' });
    }
  }

  /**
   * Create reader profile
   */
  static async createReaderProfile(req, res) {
    try {
      const userId = req.dbUserId;
      const {
        displayName,
        bio,
        specialties,
        chatRate,
        callRate,
        videoRate,
        profilePictureUrl
      } = req.body;

      // Validate required fields
      if (!displayName || !bio || !chatRate || !callRate || !videoRate) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['displayName', 'bio', 'chatRate', 'callRate', 'videoRate']
        });
      }

      // Check if reader profile already exists
      const existingReader = await Reader.findByUserId(userId);
      if (existingReader) {
        return res.status(400).json({ error: 'Reader profile already exists' });
      }

      // Update user role to reader
      await User.update(userId, { role: 'reader' });

      // Create reader profile
      const reader = await Reader.create({
        userId,
        displayName,
        bio,
        specialties: specialties || [],
        chatRate: parseFloat(chatRate),
        callRate: parseFloat(callRate),
        videoRate: parseFloat(videoRate),
        profilePictureUrl
      });

      res.status(201).json({ 
        reader, 
        message: 'Reader profile created successfully' 
      });
    } catch (error) {
      console.error('Error in createReaderProfile:', error);
      res.status(500).json({ error: 'Failed to create reader profile' });
    }
  }

  /**
   * Update reader profile
   */
  static async updateReaderProfile(req, res) {
    try {
      const userId = req.dbUserId;
      const updates = req.body;

      const reader = await Reader.update(userId, updates);

      if (!reader) {
        return res.status(404).json({ error: 'Reader profile not found' });
      }

      res.json({ 
        reader, 
        message: 'Reader profile updated successfully' 
      });
    } catch (error) {
      console.error('Error in updateReaderProfile:', error);
      res.status(500).json({ error: 'Failed to update reader profile' });
    }
  }

  /**
   * Update reader online status
   */
  static async updateOnlineStatus(req, res) {
    try {
      const userId = req.dbUserId;
      const { isOnline, status } = req.body;

      if (typeof isOnline !== 'boolean') {
        return res.status(400).json({ error: 'isOnline must be a boolean' });
      }

      const reader = await Reader.updateOnlineStatus(userId, isOnline, status);

      if (!reader) {
        return res.status(404).json({ error: 'Reader profile not found' });
      }

      res.json({ 
        reader, 
        message: 'Online status updated successfully' 
      });
    } catch (error) {
      console.error('Error in updateOnlineStatus:', error);
      res.status(500).json({ error: 'Failed to update online status' });
    }
  }

  /**
   * Get reader earnings
   */
  static async getReaderEarnings(req, res) {
    try {
      const userId = req.dbUserId;
      const { startDate = null, endDate = null } = req.query;

      const earnings = await Reader.getEarnings(userId, {
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null
      });

      res.json({ earnings });
    } catch (error) {
      console.error('Error in getReaderEarnings:', error);
      res.status(500).json({ error: 'Failed to get reader earnings' });
    }
  }

  /**
   * Search readers
   */
  static async searchReaders(req, res) {
    try {
      const { q: searchTerm, limit = 20, offset = 0 } = req.query;

      if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required' });
      }

      const result = await Reader.search(searchTerm, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json(result);
    } catch (error) {
      console.error('Error in searchReaders:', error);
      res.status(500).json({ error: 'Failed to search readers' });
    }
  }

  /**
   * Get top rated readers
   */
  static async getTopRatedReaders(req, res) {
    try {
      const { limit = 10 } = req.query;

      const readers = await Reader.getTopRated(parseInt(limit));

      res.json({ readers });
    } catch (error) {
      console.error('Error in getTopRatedReaders:', error);
      res.status(500).json({ error: 'Failed to get top rated readers' });
    }
  }

  /**
   * Get reader availability
   */
  static async getReaderAvailability(req, res) {
    try {
      const { readerId } = req.params;

      const availability = await Reader.getAvailability(readerId);

      if (!availability) {
        return res.status(404).json({ error: 'Reader not found' });
      }

      res.json({ availability });
    } catch (error) {
      console.error('Error in getReaderAvailability:', error);
      res.status(500).json({ error: 'Failed to get reader availability' });
    }
  }

  /**
   * Get current reader profile
   */
  static async getCurrentReaderProfile(req, res) {
    try {
      const userId = req.dbUserId;

      const reader = await Reader.findByUserId(userId);

      if (!reader) {
        return res.status(404).json({ error: 'Reader profile not found' });
      }

      res.json({ reader });
    } catch (error) {
      console.error('Error in getCurrentReaderProfile:', error);
      res.status(500).json({ error: 'Failed to get reader profile' });
    }
  }
}

export default ReaderController;