/**
 * User Controller
 * Handles user-related business logic
 */

import User from '../models/User.js';
import Reader from '../models/Reader.js';

class UserController {
  /**
   * Get or create user from Clerk
   */
  static async getOrCreateUser(req, res) {
    try {
      const { userId: clerkId } = req.auth;
      const { emailAddress, firstName, lastName } = req.body;

      // Try to find existing user
      let user = await User.findByClerkId(clerkId);

      if (!user) {
        // Create new user
        const displayName = firstName && lastName ? `${firstName} ${lastName}` : null;
        user = await User.create({
          clerkId,
          email: emailAddress,
          displayName,
          role: 'client'
        });
      }

      res.json({ user });
    } catch (error) {
      console.error('Error in getOrCreateUser:', error);
      res.status(500).json({ error: 'Failed to get or create user' });
    }
  }

  /**
   * Get current user profile
   */
  static async getCurrentUser(req, res) {
    try {
      const userId = req.dbUserId;

      const user = await User.findWithReaderProfile(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user });
    } catch (error) {
      console.error('Error in getCurrentUser:', error);
      res.status(500).json({ error: 'Failed to get user profile' });
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(req, res) {
    try {
      const userId = req.dbUserId;
      const updates = req.body;

      const user = await User.update(userId, updates);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user, message: 'Profile updated successfully' });
    } catch (error) {
      console.error('Error in updateProfile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  /**
   * Get user balance
   */
  static async getBalance(req, res) {
    try {
      const userId = req.dbUserId;

      const balance = await User.getBalance(userId);

      res.json({ balance });
    } catch (error) {
      console.error('Error in getBalance:', error);
      res.status(500).json({ error: 'Failed to get balance' });
    }
  }

  /**
   * Search users
   */
  static async searchUsers(req, res) {
    try {
      const { q: searchTerm, limit = 20, offset = 0 } = req.query;

      if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required' });
      }

      const result = await User.search(searchTerm, { 
        limit: parseInt(limit), 
        offset: parseInt(offset) 
      });

      res.json(result);
    } catch (error) {
      console.error('Error in searchUsers:', error);
      res.status(500).json({ error: 'Failed to search users' });
    }
  }

  /**
   * Get all users (admin only)
   */
  static async getAllUsers(req, res) {
    try {
      const { limit = 50, offset = 0, role = null } = req.query;

      const result = await User.findAll({
        limit: parseInt(limit),
        offset: parseInt(offset),
        role
      });

      res.json(result);
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      res.status(500).json({ error: 'Failed to get users' });
    }
  }

  /**
   * Delete user account
   */
  static async deleteAccount(req, res) {
    try {
      const userId = req.dbUserId;

      const user = await User.delete(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      console.error('Error in deleteAccount:', error);
      res.status(500).json({ error: 'Failed to delete account' });
    }
  }
}

export default UserController;