/**
 * User Model
 * Handles all user-related database operations
 */

import { query, transaction } from '../config/database.js';

class User {
  /**
   * Create a new user
   */
  static async create({ clerkId, email, role = 'client', displayName = null }) {
    const result = await query(
      `INSERT INTO users (clerk_id, email, role, display_name, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [clerkId, email, role, displayName]
    );
    return result.rows[0];
  }

  /**
   * Find user by Clerk ID
   */
  static async findByClerkId(clerkId) {
    const result = await query(
      'SELECT * FROM users WHERE clerk_id = $1',
      [clerkId]
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by database ID
   */
  static async findById(id) {
    const result = await query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Find user by email
   */
  static async findByEmail(email) {
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  /**
   * Update user profile
   */
  static async update(id, updates) {
    const allowedFields = ['email', 'display_name', 'profile_picture_url', 'phone_number'];
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [id, ...fields.map(field => updates[field])];

    const result = await query(
      `UPDATE users 
       SET ${setClause}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Get user balance
   */
  static async getBalance(userId) {
    const result = await query(
      'SELECT balance FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0]?.balance || 0;
  }

  /**
   * Update user balance
   */
  static async updateBalance(userId, amount, operation = 'add') {
    return await transaction(async (client) => {
      // Lock the user row for update
      const userResult = await client.query(
        'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
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
      } else {
        throw new Error('Invalid operation');
      }

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
   * Get user with reader profile if exists
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
       WHERE u.id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Delete user (soft delete)
   */
  static async delete(id) {
    const result = await query(
      `UPDATE users 
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all users with pagination
   */
  static async findAll({ limit = 50, offset = 0, role = null }) {
    let queryText = `
      SELECT u.*, 
             COUNT(*) OVER() as total_count
      FROM users u
      WHERE u.deleted_at IS NULL
    `;
    const params = [];

    if (role) {
      params.push(role);
      queryText += ` AND u.role = $${params.length}`;
    }

    queryText += ` ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
   * Search users by name or email
   */
  static async search(searchTerm, { limit = 20, offset = 0 }) {
    const result = await query(
      `SELECT u.*,
              COUNT(*) OVER() as total_count
       FROM users u
       WHERE u.deleted_at IS NULL
         AND (u.display_name ILIKE $1 OR u.email ILIKE $1)
       ORDER BY u.created_at DESC
       LIMIT $2 OFFSET $3`,
      [`%${searchTerm}%`, limit, offset]
    );

    return {
      users: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }
}

export default User;