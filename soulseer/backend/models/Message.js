/**
 * Message Model
 * Handles direct messaging operations
 */

import { query, transaction } from '../config/database.js';

class Message {
  /**
   * Send a message
   */
  static async create({ senderId, receiverId, content }) {
    const result = await query(
      `INSERT INTO messages (
        sender_id, receiver_id, content, is_read, created_at, updated_at
      )
      VALUES ($1, $2, $3, false, NOW(), NOW())
      RETURNING *`,
      [senderId, receiverId, content]
    );
    return result.rows[0];
  }

  /**
   * Find message by ID
   */
  static async findById(messageId) {
    const result = await query(
      `SELECT m.*,
              s.display_name as sender_name,
              s.profile_picture_url as sender_picture,
              r.display_name as receiver_name,
              r.profile_picture_url as receiver_picture
       FROM messages m
       JOIN users s ON m.sender_id = s.id
       JOIN users r ON m.receiver_id = r.id
       WHERE m.id = $1`,
      [messageId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update message (mark as read, etc.)
   */
  static async update(messageId, updates) {
    const allowedFields = ['is_read', 'content'];
    
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [messageId, ...fields.map(field => updates[field])];

    const result = await query(
      `UPDATE messages 
       SET ${setClause}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Mark message as read
   */
  static async markAsRead(messageId) {
    const result = await query(
      `UPDATE messages 
       SET is_read = true,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [messageId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get conversation between two users
   */
  static async getConversation(userId1, userId2, { limit = 50, offset = 0 }) {
    const result = await query(
      `SELECT m.*,
              s.display_name as sender_name,
              s.profile_picture_url as sender_picture,
              r.display_name as receiver_name,
              r.profile_picture_url as receiver_picture,
              COUNT(*) OVER() as total_count
       FROM messages m
       JOIN users s ON m.sender_id = s.id
       JOIN users r ON m.receiver_id = r.id
       WHERE (m.sender_id = $1 AND m.receiver_id = $2)
          OR (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.created_at ASC
       LIMIT $3 OFFSET $4`,
      [userId1, userId2, limit, offset]
    );

    return {
      messages: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Get user's conversations
   */
  static async getConversations(userId, { limit = 50, offset = 0 }) {
    const result = await query(
      `WITH last_messages AS (
        SELECT 
          CASE 
            WHEN sender_id = $1 THEN receiver_id
            ELSE sender_id
          END as other_user_id,
          content as last_message,
          created_at as last_message_time,
          ROW_NUMBER() OVER (
            PARTITION BY CASE 
              WHEN sender_id = $1 THEN receiver_id
              ELSE sender_id
            END
            ORDER BY created_at DESC
          ) as rn
        FROM messages
        WHERE sender_id = $1 OR receiver_id = $1
      )
      SELECT 
        lm.other_user_id,
        u.display_name as other_user_name,
        u.profile_picture_url as other_user_picture,
        lm.last_message,
        lm.last_message_time,
        COUNT(*) OVER() as total_count,
        (
          SELECT COUNT(*)
          FROM messages m
          WHERE m.receiver_id = $1 
            AND m.sender_id = lm.other_user_id
            AND m.is_read = false
        ) as unread_count
      FROM last_messages lm
      JOIN users u ON lm.other_user_id = u.id
      WHERE lm.rn = 1
      ORDER BY lm.last_message_time DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      conversations: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }

  /**
   * Mark all messages from a user as read
   */
  static async markConversationAsRead(senderId, receiverId) {
    const result = await query(
      `UPDATE messages 
       SET is_read = true,
           updated_at = NOW()
       WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false
       RETURNING *`,
      [senderId, receiverId]
    );
    return result.rows;
  }

  /**
   * Get unread message count
   */
  static async getUnreadCount(userId) {
    const result = await query(
      `SELECT COUNT(*) as count
       FROM messages
       WHERE receiver_id = $1 AND is_read = false`,
      [userId]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Delete a message
   */
  static async delete(messageId) {
    const result = await query(
      `DELETE FROM messages 
       WHERE id = $1
       RETURNING *`,
      [messageId]
    );
    return result.rows[0] || null;
  }

  /**
   * Delete conversation
   */
  static async deleteConversation(userId1, userId2) {
    const result = await query(
      `DELETE FROM messages 
       WHERE (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)
       RETURNING *`,
      [userId1, userId2]
    );
    return result.rows;
  }

  /**
   * Search messages
   */
  static async search(userId, searchTerm, { limit = 50, offset = 0 }) {
    const result = await query(
      `SELECT m.*,
              s.display_name as sender_name,
              r.display_name as receiver_name,
              COUNT(*) OVER() as total_count
       FROM messages m
       JOIN users s ON m.sender_id = s.id
       JOIN users r ON m.receiver_id = r.id
       WHERE (m.sender_id = $1 OR m.receiver_id = $1)
         AND m.content ILIKE $2
       ORDER BY m.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, `%${searchTerm}%`, limit, offset]
    );

    return {
      messages: result.rows,
      total: result.rows[0]?.total_count || 0,
      limit,
      offset
    };
  }
}

export default Message;