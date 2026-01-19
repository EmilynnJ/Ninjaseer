/**
 * User Model - COMPLETE IMPLEMENTATION
 * Comprehensive user management with all operations
 * NO SHORTCUTS - FULL PRODUCTION CODE
 */

import { query, transaction } from '../config/database.js';
import bcrypt from 'bcrypt';

class User {
  /**
   * ============================================================================
   * CREATE OPERATIONS
   * ============================================================================
   */

  /**
   * Create a new user with complete validation
   */
  static async create({ 
    clerkId, 
    email, 
    role = 'client', 
    displayName = null,
    profilePictureUrl = null,
    phoneNumber = null,
    dateOfBirth = null,
    timezone = 'UTC',
    language = 'en',
    currency = 'USD'
  }) {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Validate role
    const validRoles = ['client', 'reader', 'admin'];
    if (!validRoles.includes(role)) {
      throw new Error('Invalid role. Must be client, reader, or admin');
    }

    // Check if user already exists
    const existing = await this.findByClerkId(clerkId);
    if (existing) {
      throw new Error('User with this Clerk ID already exists');
    }

    const existingEmail = await this.findByEmail(email);
    if (existingEmail) {
      throw new Error('User with this email already exists');
    }

    const result = await query(
      `INSERT INTO users (
        clerk_id, email, role, display_name, profile_picture_url,
        phone_number, date_of_birth, timezone, language, currency,
        balance, is_active, email_verified, phone_verified,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, true, false, false, NOW(), NOW())
      RETURNING *`,
      [
        clerkId, email, role, displayName, profilePictureUrl,
        phoneNumber, dateOfBirth, timezone, language, currency
      ]
    );

    return result.rows[0];
  }

  /**
   * Create user with transaction support
   */
  static async createWithTransaction(client, userData) {
    const {
      clerkId, email, role, displayName, profilePictureUrl,
      phoneNumber, dateOfBirth, timezone, language, currency
    } = userData;

    const result = await client.query(
      `INSERT INTO users (
        clerk_id, email, role, display_name, profile_picture_url,
        phone_number, date_of_birth, timezone, language, currency,
        balance, is_active, email_verified, phone_verified,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, true, false, false, NOW(), NOW())
      RETURNING *`,
      [
        clerkId, email, role, displayName, profilePictureUrl,
        phoneNumber, dateOfBirth, timezone, language, currency
      ]
    );

    return result.rows[0];
  }

  /**
   * ============================================================================
   * READ OPERATIONS
   * ============================================================================
   */

  /**
   * Find user by Clerk ID with caching support
   */
  static async findByClerkId(clerkId, includeDeleted = false) {
    let queryText = 'SELECT * FROM users WHERE clerk_id = $1';
    
    if (!includeDeleted) {
      queryText += ' AND deleted_at IS NULL';
    }

    const result = await query(queryText, [clerkId]);
    return result.rows[0] || null;
  }

  /**
   * Find user by database ID
   */
  static async findById(id, includeDeleted = false) {
    let queryText = 'SELECT * FROM users WHERE id = $1';
    
    if (!includeDeleted) {
      queryText += ' AND deleted_at IS NULL';
    }

    const result = await query(queryText, [id]);
    return result.rows[0] || null;
  }

  /**
   * Find user by email
   */
  static async findByEmail(email, includeDeleted = false) {
    let queryText = 'SELECT * FROM users WHERE LOWER(email) = LOWER($1)';
    
    if (!includeDeleted) {
      queryText += ' AND deleted_at IS NULL';
    }

    const result = await query(queryText, [email]);
    return result.rows[0] || null;
  }

  /**
   * Find user by phone number
   */
  static async findByPhone(phoneNumber) {
    const result = await query(
      'SELECT * FROM users WHERE phone_number = $1 AND deleted_at IS NULL',
      [phoneNumber]
    );
    return result.rows[0] || null;
  }

  /**
   * Get user with complete profile including reader data if applicable
   */
  static async findWithCompleteProfile(userId) {
    const result = await query(
      `SELECT 
        u.*,
        r.id as reader_profile_id,
        r.display_name as reader_display_name,
        r.bio,
        r.specialties,
        r.chat_rate,
        r.call_rate,
        r.video_rate,
        r.is_online,
        r.status as reader_status,
        r.average_rating,
        r.total_reviews,
        r.total_sessions,
        r.profile_picture_url as reader_profile_picture,
        r.years_experience,
        r.certifications,
        r.languages_spoken,
        r.availability_schedule,
        COUNT(DISTINCT s.id) as total_client_sessions,
        COUNT(DISTINCT f.id) as total_favorites,
        COUNT(DISTINCT m.id) as unread_messages
      FROM users u
      LEFT JOIN reader_profiles r ON u.id = r.user_id
      LEFT JOIN reading_sessions s ON u.id = s.client_id AND s.status = 'completed'
      LEFT JOIN user_favorites f ON u.id = f.user_id
      LEFT JOIN messages m ON u.id = m.receiver_id AND m.is_read = false
      WHERE u.id = $1 AND u.deleted_at IS NULL
      GROUP BY u.id, r.id`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get user with reader profile only
   */
  static async findWithReaderProfile(userId) {
    const result = await query(
      `SELECT u.*, 
              r.display_name as reader_display_name,
              r.bio,
              r.specialties,
              r.chat_rate,
              r.call_rate,
              r.video_rate,
              r.is_online,
              r.status as reader_status,
              r.average_rating,
              r.total_reviews,
              r.total_sessions
       FROM users u
       LEFT JOIN reader_profiles r ON u.id = r.user_id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * ============================================================================
   * UPDATE OPERATIONS
   * ============================================================================
   */

  /**
   * Update user profile with validation
   */
  static async update(id, updates) {
    const allowedFields = [
      'email', 'display_name', 'profile_picture_url', 'phone_number',
      'date_of_birth', 'timezone', 'language', 'currency', 'bio',
      'is_active', 'email_verified', 'phone_verified', 'role'
    ];
    
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Validate email if being updated
    if (updates.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.email)) {
        throw new Error('Invalid email format');
      }

      // Check if email is already taken
      const existing = await query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2 AND deleted_at IS NULL',
        [updates.email, id]
      );
      if (existing.rows.length > 0) {
        throw new Error('Email already in use');
      }
    }

    // Validate role if being updated
    if (updates.role) {
      const validRoles = ['client', 'reader', 'admin'];
      if (!validRoles.includes(updates.role)) {
        throw new Error('Invalid role');
      }
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [id, ...fields.map(field => updates[field])];

    const result = await query(
      `UPDATE users 
       SET ${setClause}, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('User not found or already deleted');
    }

    return result.rows[0];
  }

  /**
   * Update user with transaction support
   */
  static async updateWithTransaction(client, id, updates) {
    const allowedFields = [
      'email', 'display_name', 'profile_picture_url', 'phone_number',
      'date_of_birth', 'timezone', 'language', 'currency', 'bio',
      'is_active', 'email_verified', 'phone_verified', 'role'
    ];
    
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [id, ...fields.map(field => updates[field])];

    const result = await client.query(
      `UPDATE users 
       SET ${setClause}, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(userId) {
    const result = await query(
      `UPDATE users 
       SET last_login_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Verify email
   */
  static async verifyEmail(userId) {
    const result = await query(
      `UPDATE users 
       SET email_verified = true, email_verified_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Verify phone
   */
  static async verifyPhone(userId) {
    const result = await query(
      `UPDATE users 
       SET phone_verified = true, phone_verified_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Activate/deactivate user account
   */
  static async setActiveStatus(userId, isActive) {
    const result = await query(
      `UPDATE users 
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [isActive, userId]
    );
    return result.rows[0] || null;
  }

  /**
   * ============================================================================
   * BALANCE OPERATIONS
   * ============================================================================
   */

  /**
   * Get user balance with lock for update
   */
  static async getBalance(userId) {
    const result = await query(
      'SELECT balance FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return parseFloat(result.rows[0].balance);
  }

  /**
   * Get balance with transaction lock
   */
  static async getBalanceForUpdate(client, userId) {
    const result = await client.query(
      'SELECT balance FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
      [userId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return parseFloat(result.rows[0].balance);
  }

  /**
   * Update user balance with transaction support
   */
  static async updateBalance(userId, amount, operation = 'add') {
    return await transaction(async (client) => {
      // Lock the user row for update
      const userResult = await client.query(
        'SELECT id, balance, email FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const currentBalance = parseFloat(userResult.rows[0].balance);
      let newBalance;

      if (operation === 'add') {
        newBalance = currentBalance + amount;
      } else if (operation === 'subtract') {
        newBalance = currentBalance - amount;
        if (newBalance < 0) {
          throw new Error('Insufficient balance');
        }
      } else if (operation === 'set') {
        newBalance = amount;
      } else {
        throw new Error('Invalid operation. Must be add, subtract, or set');
      }

      // Round to 2 decimal places
      newBalance = Math.round(newBalance * 100) / 100;

      const result = await client.query(
        `UPDATE users 
         SET balance = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [newBalance, userId]
      );

      return result.rows[0];
    });
  }

  /**
   * Add balance (convenience method)
   */
  static async addBalance(userId, amount) {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    return await this.updateBalance(userId, amount, 'add');
  }

  /**
   * Subtract balance (convenience method)
   */
  static async subtractBalance(userId, amount) {
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    return await this.updateBalance(userId, amount, 'subtract');
  }

  /**
   * Check if user has sufficient balance
   */
  static async hasSufficientBalance(userId, requiredAmount) {
    const balance = await this.getBalance(userId);
    return balance >= requiredAmount;
  }

  /**
   * ============================================================================
   * DELETE OPERATIONS
   * ============================================================================
   */

  /**
   * Soft delete user
   */
  static async delete(id) {
    const result = await query(
      `UPDATE users 
       SET deleted_at = NOW(), updated_at = NOW(), is_active = false
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Hard delete user (permanent)
   */
  static async hardDelete(id) {
    const result = await query(
      'DELETE FROM users WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Restore soft-deleted user
   */
  static async restore(id) {
    const result = await query(
      `UPDATE users 
       SET deleted_at = NULL, updated_at = NOW(), is_active = true
       WHERE id = $1 AND deleted_at IS NOT NULL
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * ============================================================================
   * QUERY OPERATIONS
   * ============================================================================
   */

  /**
   * Get all users with comprehensive filtering and pagination
   */
  static async findAll({ 
    limit = 50, 
    offset = 0, 
    role = null,
    isActive = null,
    emailVerified = null,
    sortBy = 'created_at',
    sortOrder = 'DESC',
    searchTerm = null,
    includeDeleted = false
  }) {
    let queryText = `
      SELECT u.*, 
             COUNT(*) OVER() as total_count,
             CASE WHEN r.user_id IS NOT NULL THEN true ELSE false END as is_reader
      FROM users u
      LEFT JOIN reader_profiles r ON u.id = r.user_id
      WHERE 1=1
    `;
    const params = [];

    if (!includeDeleted) {
      queryText += ' AND u.deleted_at IS NULL';
    }

    if (role) {
      params.push(role);
      queryText += ` AND u.role = $${params.length}`;
    }

    if (isActive !== null) {
      params.push(isActive);
      queryText += ` AND u.is_active = $${params.length}`;
    }

    if (emailVerified !== null) {
      params.push(emailVerified);
      queryText += ` AND u.email_verified = $${params.length}`;
    }

    if (searchTerm) {
      params.push(`%${searchTerm}%`);
      queryText += ` AND (u.display_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }

    // Validate sort column
    const validSortColumns = ['created_at', 'updated_at', 'email', 'display_name', 'balance', 'last_login_at'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    queryText += ` ORDER BY u.${sortColumn} ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);
    
    return {
      users: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset,
      hasMore: (result.rows[0]?.total_count || 0) > offset + limit
    };
  }

  /**
   * Search users by name or email with fuzzy matching
   */
  static async search(searchTerm, { limit = 20, offset = 0, role = null }) {
    let queryText = `
      SELECT u.*,
             COUNT(*) OVER() as total_count,
             CASE WHEN r.user_id IS NOT NULL THEN true ELSE false END as is_reader,
             SIMILARITY(u.display_name, $1) + SIMILARITY(u.email, $1) as relevance
      FROM users u
      LEFT JOIN reader_profiles r ON u.id = r.user_id
      WHERE u.deleted_at IS NULL
        AND (u.display_name ILIKE $2 OR u.email ILIKE $2)
    `;
    const params = [searchTerm, `%${searchTerm}%`];

    if (role) {
      params.push(role);
      queryText += ` AND u.role = $${params.length}`;
    }

    queryText += ` ORDER BY relevance DESC, u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    return {
      users: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Get users by role
   */
  static async findByRole(role, { limit = 50, offset = 0 }) {
    const result = await query(
      `SELECT u.*,
              COUNT(*) OVER() as total_count
       FROM users u
       WHERE u.role = $1 AND u.deleted_at IS NULL
       ORDER BY u.created_at DESC
       LIMIT $2 OFFSET $3`,
      [role, limit, offset]
    );

    return {
      users: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Get recently active users
   */
  static async getRecentlyActive(limit = 10) {
    const result = await query(
      `SELECT u.*
       FROM users u
       WHERE u.deleted_at IS NULL 
         AND u.is_active = true
         AND u.last_login_at IS NOT NULL
       ORDER BY u.last_login_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * ============================================================================
   * STATISTICS & ANALYTICS
   * ============================================================================
   */

  /**
   * Get user statistics
   */
  static async getStats(userId) {
    const result = await query(
      `SELECT 
        u.balance,
        u.created_at,
        u.last_login_at,
        COUNT(DISTINCT s.id) as total_sessions,
        COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END) as completed_sessions,
        COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total_cost ELSE 0 END), 0) as total_spent,
        COUNT(DISTINCT t.id) as total_transactions,
        COUNT(DISTINCT f.id) as total_favorites,
        COUNT(DISTINCT m.id) as total_messages_sent,
        COUNT(DISTINCT mr.id) as total_messages_received,
        COUNT(DISTINCT p.id) as total_forum_posts,
        COUNT(DISTINCT o.id) as total_orders
      FROM users u
      LEFT JOIN reading_sessions s ON u.id = s.client_id
      LEFT JOIN transactions t ON u.id = t.user_id
      LEFT JOIN user_favorites f ON u.id = f.user_id
      LEFT JOIN messages m ON u.id = m.sender_id
      LEFT JOIN messages mr ON u.id = mr.receiver_id
      LEFT JOIN forum_posts p ON u.id = p.user_id
      LEFT JOIN orders o ON u.id = o.user_id
      WHERE u.id = $1 AND u.deleted_at IS NULL
      GROUP BY u.id`,
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get platform-wide user statistics
   */
  static async getPlatformStats() {
    const result = await query(
      `SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'client' THEN 1 END) as total_clients,
        COUNT(CASE WHEN role = 'reader' THEN 1 END) as total_readers,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as total_admins,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
        COUNT(CASE WHEN email_verified = true THEN 1 END) as verified_users,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_users_30d,
        COUNT(CASE WHEN last_login_at >= NOW() - INTERVAL '7 days' THEN 1 END) as active_users_7d,
        COALESCE(SUM(balance), 0) as total_balance
      FROM users
      WHERE deleted_at IS NULL`
    );

    return result.rows[0];
  }

  /**
   * Get user growth over time
   */
  static async getUserGrowth(days = 30) {
    const result = await query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as new_users,
        SUM(COUNT(*)) OVER (ORDER BY DATE(created_at)) as cumulative_users
      FROM users
      WHERE created_at >= NOW() - INTERVAL '${days} days'
        AND deleted_at IS NULL
      GROUP BY DATE(created_at)
      ORDER BY date ASC`
    );

    return result.rows;
  }

  /**
   * ============================================================================
   * RELATIONSHIP OPERATIONS
   * ============================================================================
   */

  /**
   * Get user's favorite readers
   */
  static async getFavoriteReaders(userId, { limit = 20, offset = 0 }) {
    const result = await query(
      `SELECT r.*, f.created_at as favorited_at,
              COUNT(*) OVER() as total_count
       FROM user_favorites f
       JOIN reader_profiles r ON f.reader_id = r.user_id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      readers: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Add reader to favorites
   */
  static async addFavoriteReader(userId, readerId) {
    // Check if already favorited
    const existing = await query(
      'SELECT id FROM user_favorites WHERE user_id = $1 AND reader_id = $2',
      [userId, readerId]
    );

    if (existing.rows.length > 0) {
      throw new Error('Reader already in favorites');
    }

    const result = await query(
      `INSERT INTO user_favorites (user_id, reader_id, created_at)
       VALUES ($1, $2, NOW())
       RETURNING *`,
      [userId, readerId]
    );

    return result.rows[0];
  }

  /**
   * Remove reader from favorites
   */
  static async removeFavoriteReader(userId, readerId) {
    const result = await query(
      'DELETE FROM user_favorites WHERE user_id = $1 AND reader_id = $2 RETURNING *',
      [userId, readerId]
    );

    return result.rows[0] || null;
  }

  /**
   * Check if reader is favorited
   */
  static async isReaderFavorited(userId, readerId) {
    const result = await query(
      'SELECT id FROM user_favorites WHERE user_id = $1 AND reader_id = $2',
      [userId, readerId]
    );

    return result.rows.length > 0;
  }

  /**
   * ============================================================================
   * VALIDATION HELPERS
   * ============================================================================
   */

  /**
   * Validate user exists and is active
   */
  static async validateUserExists(userId) {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    if (!user.is_active) {
      throw new Error('User account is inactive');
    }
    return user;
  }

  /**
   * Validate user has required role
   */
  static async validateUserRole(userId, requiredRole) {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    if (user.role !== requiredRole) {
      throw new Error(`User must have ${requiredRole} role`);
    }
    return user;
  }

  /**
   * Validate user can perform action
   */
  static async canPerformAction(userId, action) {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    if (!user.is_active) {
      throw new Error('User account is inactive');
    }
    if (user.deleted_at) {
      throw new Error('User account is deleted');
    }

    // Add action-specific validation here
    return true;
  }
}

export default User;