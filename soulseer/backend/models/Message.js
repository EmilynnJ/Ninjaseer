/**
 * Message Model - Enterprise Level
 * Complete messaging system for SoulSeer platform
 * Handles direct messages, conversations, notifications, and real-time chat
 */

const { pool } = require('../config/database');
const { logger } = require('../utils/logger');

class Message {
  // ============================================
  // MESSAGE TYPES & STATUSES
  // ============================================
  
  static TYPES = {
    TEXT: 'text',
    IMAGE: 'image',
    FILE: 'file',
    AUDIO: 'audio',
    VIDEO: 'video',
    SYSTEM: 'system',
    READING_REQUEST: 'reading_request',
    READING_RESPONSE: 'reading_response',
    GIFT: 'gift',
    PAYMENT: 'payment'
  };

  static STATUSES = {
    SENT: 'sent',
    DELIVERED: 'delivered',
    READ: 'read',
    FAILED: 'failed',
    DELETED: 'deleted'
  };

  static CONVERSATION_TYPES = {
    DIRECT: 'direct',           // One-on-one conversation
    GROUP: 'group',             // Group conversation
    SUPPORT: 'support',         // Support ticket
    READING: 'reading',         // Reading session chat
    STREAM: 'stream'            // Stream chat
  };

  // ============================================
  // CONVERSATION MANAGEMENT
  // ============================================

  /**
   * Create or get existing conversation between users
   * @param {string} userId1 - First user ID
   * @param {string} userId2 - Second user ID
   * @returns {Object} Conversation
   */
  static async getOrCreateConversation(userId1, userId2) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check for existing conversation
      const existingQuery = `
        SELECT c.* FROM conversations c
        JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
        JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
        WHERE c.type = $1
          AND cp1.user_id = $2
          AND cp2.user_id = $3
        LIMIT 1
      `;

      const existingResult = await client.query(existingQuery, [
        this.CONVERSATION_TYPES.DIRECT,
        userId1,
        userId2
      ]);

      if (existingResult.rows.length > 0) {
        await client.query('COMMIT');
        return this.formatConversation(existingResult.rows[0]);
      }

      // Create new conversation
      const conversationQuery = `
        INSERT INTO conversations (type, created_at, updated_at)
        VALUES ($1, NOW(), NOW())
        RETURNING *
      `;

      const conversationResult = await client.query(conversationQuery, [
        this.CONVERSATION_TYPES.DIRECT
      ]);

      const conversation = conversationResult.rows[0];

      // Add participants
      await client.query(`
        INSERT INTO conversation_participants (conversation_id, user_id, joined_at)
        VALUES ($1, $2, NOW()), ($1, $3, NOW())
      `, [conversation.id, userId1, userId2]);

      await client.query('COMMIT');

      logger.info('Conversation created', { 
        conversationId: conversation.id, 
        participants: [userId1, userId2] 
      });

      return this.formatConversation(conversation);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating conversation', { error: error.message, userId1, userId2 });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create a group conversation
   * @param {Object} groupData - Group details
   * @returns {Object} Created conversation
   */
  static async createGroupConversation(groupData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const {
        name,
        description = null,
        creator_id,
        participant_ids,
        image_url = null,
        metadata = {}
      } = groupData;

      // Create conversation
      const conversationQuery = `
        INSERT INTO conversations (
          type, name, description, image_url, creator_id, metadata,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *
      `;

      const conversationResult = await client.query(conversationQuery, [
        this.CONVERSATION_TYPES.GROUP,
        name,
        description,
        image_url,
        creator_id,
        JSON.stringify(metadata)
      ]);

      const conversation = conversationResult.rows[0];

      // Add creator as admin
      await client.query(`
        INSERT INTO conversation_participants (
          conversation_id, user_id, role, joined_at
        ) VALUES ($1, $2, 'admin', NOW())
      `, [conversation.id, creator_id]);

      // Add other participants
      for (const participantId of participant_ids) {
        if (participantId !== creator_id) {
          await client.query(`
            INSERT INTO conversation_participants (
              conversation_id, user_id, role, joined_at
            ) VALUES ($1, $2, 'member', NOW())
          `, [conversation.id, participantId]);
        }
      }

      // Create system message
      await this.createMessage({
        conversation_id: conversation.id,
        sender_id: creator_id,
        type: this.TYPES.SYSTEM,
        content: 'Group created'
      }, client);

      await client.query('COMMIT');

      logger.info('Group conversation created', { 
        conversationId: conversation.id, 
        name,
        participantCount: participant_ids.length 
      });

      return this.getConversationById(conversation.id);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating group conversation', { error: error.message, groupData });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get conversation by ID with participants
   * @param {string} conversationId - Conversation ID
   * @returns {Object|null} Conversation or null
   */
  static async getConversationById(conversationId) {
    try {
      const conversationQuery = `
        SELECT c.*,
               (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
        FROM conversations c
        WHERE c.id = $1
      `;

      const conversationResult = await pool.query(conversationQuery, [conversationId]);

      if (conversationResult.rows.length === 0) {
        return null;
      }

      // Get participants
      const participantsQuery = `
        SELECT cp.*, u.display_name, u.profile_image_url, u.is_online
        FROM conversation_participants cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.conversation_id = $1
        ORDER BY cp.joined_at ASC
      `;

      const participantsResult = await pool.query(participantsQuery, [conversationId]);

      // Get last message
      const lastMessageQuery = `
        SELECT m.*, u.display_name as sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = $1
        ORDER BY m.created_at DESC
        LIMIT 1
      `;

      const lastMessageResult = await pool.query(lastMessageQuery, [conversationId]);

      return this.formatConversation({
        ...conversationResult.rows[0],
        participants: participantsResult.rows,
        last_message: lastMessageResult.rows[0] || null
      });

    } catch (error) {
      logger.error('Error getting conversation', { error: error.message, conversationId });
      throw error;
    }
  }

  /**
   * Get user's conversations
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated conversations
   */
  static async getUserConversations(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        type = null,
        search = null
      } = options;

      const offset = (page - 1) * limit;
      const conditions = ['cp.user_id = $1', 'cp.left_at IS NULL'];
      const values = [userId];
      let paramIndex = 2;

      if (type) {
        conditions.push(`c.type = $${paramIndex}`);
        values.push(type);
        paramIndex++;
      }

      if (search) {
        conditions.push(`(c.name ILIKE $${paramIndex} OR EXISTS (
          SELECT 1 FROM conversation_participants cp2
          JOIN users u ON cp2.user_id = u.id
          WHERE cp2.conversation_id = c.id AND u.display_name ILIKE $${paramIndex}
        ))`);
        values.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT c.id)
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE ${whereClause}
      `;
      const countResult = await pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // Get conversations with last message
      const query = `
        SELECT DISTINCT ON (c.id) c.*,
               cp.unread_count,
               cp.is_muted,
               cp.is_pinned,
               m.content as last_message_content,
               m.type as last_message_type,
               m.created_at as last_message_at,
               m.sender_id as last_message_sender_id,
               sender.display_name as last_message_sender_name
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        LEFT JOIN LATERAL (
          SELECT * FROM messages 
          WHERE conversation_id = c.id 
          ORDER BY created_at DESC 
          LIMIT 1
        ) m ON true
        LEFT JOIN users sender ON m.sender_id = sender.id
        WHERE ${whereClause}
        ORDER BY c.id, COALESCE(m.created_at, c.created_at) DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await pool.query(query, values);

      // Get participants for each conversation
      const conversations = await Promise.all(
        result.rows.map(async (conv) => {
          const participantsQuery = `
            SELECT cp.user_id, u.display_name, u.profile_image_url, u.is_online
            FROM conversation_participants cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.conversation_id = $1 AND cp.left_at IS NULL
          `;
          const participantsResult = await pool.query(participantsQuery, [conv.id]);
          
          return this.formatConversation({
            ...conv,
            participants: participantsResult.rows
          });
        })
      );

      // Sort by last message time
      conversations.sort((a, b) => {
        const timeA = a.lastMessage?.createdAt || a.createdAt;
        const timeB = b.lastMessage?.createdAt || b.createdAt;
        return new Date(timeB) - new Date(timeA);
      });

      return {
        conversations,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };

    } catch (error) {
      logger.error('Error getting user conversations', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update conversation
   * @param {string} conversationId - Conversation ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated conversation
   */
  static async updateConversation(conversationId, updates) {
    try {
      const allowedFields = ['name', 'description', 'image_url', 'metadata'];
      const setClause = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          if (key === 'metadata') {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(JSON.stringify(value));
          } else {
            setClause.push(`${key} = $${paramIndex}`);
            values.push(value);
          }
          paramIndex++;
        }
      }

      if (setClause.length === 0) {
        throw new Error('No valid fields to update');
      }

      setClause.push(`updated_at = NOW()`);
      values.push(conversationId);

      const query = `
        UPDATE conversations 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Conversation not found');
      }

      return this.getConversationById(conversationId);

    } catch (error) {
      logger.error('Error updating conversation', { error: error.message, conversationId });
      throw error;
    }
  }

  /**
   * Add participant to conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID to add
   * @param {string} addedBy - User ID who added
   * @returns {boolean} Success
   */
  static async addParticipant(conversationId, userId, addedBy) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if conversation is a group
      const convQuery = `SELECT type FROM conversations WHERE id = $1`;
      const convResult = await client.query(convQuery, [conversationId]);

      if (convResult.rows.length === 0) {
        throw new Error('Conversation not found');
      }

      if (convResult.rows[0].type !== this.CONVERSATION_TYPES.GROUP) {
        throw new Error('Can only add participants to group conversations');
      }

      // Check if already a participant
      const existingQuery = `
        SELECT id FROM conversation_participants 
        WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL
      `;
      const existingResult = await client.query(existingQuery, [conversationId, userId]);

      if (existingResult.rows.length > 0) {
        throw new Error('User is already a participant');
      }

      // Add participant
      await client.query(`
        INSERT INTO conversation_participants (
          conversation_id, user_id, role, added_by, joined_at
        ) VALUES ($1, $2, 'member', $3, NOW())
      `, [conversationId, userId, addedBy]);

      // Get user name for system message
      const userQuery = `SELECT display_name FROM users WHERE id = $1`;
      const userResult = await client.query(userQuery, [userId]);
      const userName = userResult.rows[0]?.display_name || 'User';

      // Create system message
      await this.createMessage({
        conversation_id: conversationId,
        sender_id: addedBy,
        type: this.TYPES.SYSTEM,
        content: `${userName} was added to the group`
      }, client);

      await client.query('COMMIT');

      logger.info('Participant added', { conversationId, userId, addedBy });
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error adding participant', { error: error.message, conversationId, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Remove participant from conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID to remove
   * @param {string} removedBy - User ID who removed (null if self-leave)
   * @returns {boolean} Success
   */
  static async removeParticipant(conversationId, userId, removedBy = null) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Update participant record
      await client.query(`
        UPDATE conversation_participants 
        SET left_at = NOW(), removed_by = $1
        WHERE conversation_id = $2 AND user_id = $3 AND left_at IS NULL
      `, [removedBy, conversationId, userId]);

      // Get user name for system message
      const userQuery = `SELECT display_name FROM users WHERE id = $1`;
      const userResult = await client.query(userQuery, [userId]);
      const userName = userResult.rows[0]?.display_name || 'User';

      // Create system message
      const messageContent = removedBy 
        ? `${userName} was removed from the group`
        : `${userName} left the group`;

      await this.createMessage({
        conversation_id: conversationId,
        sender_id: removedBy || userId,
        type: this.TYPES.SYSTEM,
        content: messageContent
      }, client);

      await client.query('COMMIT');

      logger.info('Participant removed', { conversationId, userId, removedBy });
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error removing participant', { error: error.message, conversationId, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  // ============================================
  // MESSAGE OPERATIONS
  // ============================================

  /**
   * Create a new message
   * @param {Object} messageData - Message details
   * @param {Object} client - Optional database client for transactions
   * @returns {Object} Created message
   */
  static async createMessage(messageData, client = null) {
    const dbClient = client || await pool.connect();
    const shouldRelease = !client;
    
    try {
      if (!client) await dbClient.query('BEGIN');

      const {
        conversation_id,
        sender_id,
        type = this.TYPES.TEXT,
        content,
        media_url = null,
        media_type = null,
        media_size = null,
        reply_to_id = null,
        metadata = {}
      } = messageData;

      // Verify sender is a participant (except for system messages)
      if (type !== this.TYPES.SYSTEM) {
        const participantQuery = `
          SELECT id FROM conversation_participants 
          WHERE conversation_id = $1 AND user_id = $2 AND left_at IS NULL
        `;
        const participantResult = await dbClient.query(participantQuery, [conversation_id, sender_id]);

        if (participantResult.rows.length === 0) {
          throw new Error('User is not a participant in this conversation');
        }
      }

      // Create message
      const messageQuery = `
        INSERT INTO messages (
          conversation_id, sender_id, type, content,
          media_url, media_type, media_size,
          reply_to_id, metadata, status,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10,
          NOW(), NOW()
        )
        RETURNING *
      `;

      const messageValues = [
        conversation_id, sender_id, type, content,
        media_url, media_type, media_size,
        reply_to_id, JSON.stringify(metadata), this.STATUSES.SENT
      ];

      const messageResult = await dbClient.query(messageQuery, messageValues);
      const message = messageResult.rows[0];

      // Update conversation last activity
      await dbClient.query(`
        UPDATE conversations SET updated_at = NOW() WHERE id = $1
      `, [conversation_id]);

      // Increment unread count for other participants
      await dbClient.query(`
        UPDATE conversation_participants 
        SET unread_count = unread_count + 1
        WHERE conversation_id = $1 AND user_id != $2 AND left_at IS NULL
      `, [conversation_id, sender_id]);

      if (!client) await dbClient.query('COMMIT');

      // Get sender info
      const senderQuery = `SELECT display_name, profile_image_url FROM users WHERE id = $1`;
      const senderResult = await dbClient.query(senderQuery, [sender_id]);

      logger.info('Message created', { 
        messageId: message.id, 
        conversationId: conversation_id,
        type 
      });

      return this.formatMessage({
        ...message,
        sender_name: senderResult.rows[0]?.display_name,
        sender_image: senderResult.rows[0]?.profile_image_url
      });

    } catch (error) {
      if (!client) await dbClient.query('ROLLBACK');
      logger.error('Error creating message', { error: error.message, messageData });
      throw error;
    } finally {
      if (shouldRelease) dbClient.release();
    }
  }

  /**
   * Get message by ID
   * @param {string} messageId - Message ID
   * @returns {Object|null} Message or null
   */
  static async getMessageById(messageId) {
    try {
      const query = `
        SELECT m.*,
               u.display_name as sender_name,
               u.profile_image_url as sender_image,
               rm.content as reply_to_content,
               ru.display_name as reply_to_sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        LEFT JOIN messages rm ON m.reply_to_id = rm.id
        LEFT JOIN users ru ON rm.sender_id = ru.id
        WHERE m.id = $1
      `;

      const result = await pool.query(query, [messageId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatMessage(result.rows[0]);

    } catch (error) {
      logger.error('Error getting message', { error: error.message, messageId });
      throw error;
    }
  }

  /**
   * Get messages in a conversation
   * @param {string} conversationId - Conversation ID
   * @param {Object} options - Query options
   * @returns {Object} Paginated messages
   */
  static async getConversationMessages(conversationId, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        before = null,
        after = null,
        type = null
      } = options;

      const conditions = ['m.conversation_id = $1', 'm.status != $2'];
      const values = [conversationId, this.STATUSES.DELETED];
      let paramIndex = 3;

      if (before) {
        conditions.push(`m.created_at < $${paramIndex}`);
        values.push(before);
        paramIndex++;
      }

      if (after) {
        conditions.push(`m.created_at > $${paramIndex}`);
        values.push(after);
        paramIndex++;
      }

      if (type) {
        conditions.push(`m.type = $${paramIndex}`);
        values.push(type);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM messages m WHERE ${whereClause}`;
      const countResult = await pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      // Get messages
      const query = `
        SELECT m.*,
               u.display_name as sender_name,
               u.profile_image_url as sender_image,
               rm.content as reply_to_content,
               ru.display_name as reply_to_sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        LEFT JOIN messages rm ON m.reply_to_id = rm.id
        LEFT JOIN users ru ON rm.sender_id = ru.id
        WHERE ${whereClause}
        ORDER BY m.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const offset = (page - 1) * limit;
      values.push(limit, offset);

      const result = await pool.query(query, values);

      return {
        messages: result.rows.reverse().map(m => this.formatMessage(m)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };

    } catch (error) {
      logger.error('Error getting conversation messages', { error: error.message, conversationId });
      throw error;
    }
  }

  /**
   * Update message
   * @param {string} messageId - Message ID
   * @param {string} userId - User ID (must be sender)
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated message
   */
  static async updateMessage(messageId, userId, updates) {
    try {
      // Verify ownership
      const message = await this.getMessageById(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      if (message.senderId !== userId) {
        throw new Error('Can only edit your own messages');
      }

      if (message.type === this.TYPES.SYSTEM) {
        throw new Error('Cannot edit system messages');
      }

      const allowedFields = ['content'];
      const setClause = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          setClause.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      if (setClause.length === 0) {
        throw new Error('No valid fields to update');
      }

      setClause.push(`edited_at = NOW()`);
      setClause.push(`updated_at = NOW()`);
      values.push(messageId);

      const query = `
        UPDATE messages 
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await pool.query(query, values);

      logger.info('Message updated', { messageId, userId });

      return this.getMessageById(messageId);

    } catch (error) {
      logger.error('Error updating message', { error: error.message, messageId });
      throw error;
    }
  }

  /**
   * Delete message (soft delete)
   * @param {string} messageId - Message ID
   * @param {string} userId - User ID
   * @returns {boolean} Success
   */
  static async deleteMessage(messageId, userId) {
    try {
      // Verify ownership
      const message = await this.getMessageById(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      if (message.senderId !== userId) {
        throw new Error('Can only delete your own messages');
      }

      await pool.query(`
        UPDATE messages 
        SET status = $1, deleted_at = NOW(), updated_at = NOW()
        WHERE id = $2
      `, [this.STATUSES.DELETED, messageId]);

      logger.info('Message deleted', { messageId, userId });
      return true;

    } catch (error) {
      logger.error('Error deleting message', { error: error.message, messageId });
      throw error;
    }
  }

  // ============================================
  // READ RECEIPTS & STATUS
  // ============================================

  /**
   * Mark messages as read
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {number} Number of messages marked as read
   */
  static async markAsRead(conversationId, userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Update message statuses
      const updateQuery = `
        UPDATE messages 
        SET status = $1, read_at = NOW(), updated_at = NOW()
        WHERE conversation_id = $2 
          AND sender_id != $3 
          AND status != $1
          AND status != $4
        RETURNING id
      `;

      const result = await client.query(updateQuery, [
        this.STATUSES.READ,
        conversationId,
        userId,
        this.STATUSES.DELETED
      ]);

      // Reset unread count for user
      await client.query(`
        UPDATE conversation_participants 
        SET unread_count = 0, last_read_at = NOW()
        WHERE conversation_id = $1 AND user_id = $2
      `, [conversationId, userId]);

      // Create read receipts
      for (const row of result.rows) {
        await client.query(`
          INSERT INTO message_read_receipts (message_id, user_id, read_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (message_id, user_id) DO NOTHING
        `, [row.id, userId]);
      }

      await client.query('COMMIT');

      logger.info('Messages marked as read', { 
        conversationId, 
        userId, 
        count: result.rows.length 
      });

      return result.rows.length;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error marking messages as read', { error: error.message, conversationId, userId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Mark messages as delivered
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {number} Number of messages marked as delivered
   */
  static async markAsDelivered(conversationId, userId) {
    try {
      const result = await pool.query(`
        UPDATE messages 
        SET status = $1, delivered_at = NOW(), updated_at = NOW()
        WHERE conversation_id = $2 
          AND sender_id != $3 
          AND status = $4
        RETURNING id
      `, [
        this.STATUSES.DELIVERED,
        conversationId,
        userId,
        this.STATUSES.SENT
      ]);

      return result.rows.length;

    } catch (error) {
      logger.error('Error marking messages as delivered', { error: error.message, conversationId });
      throw error;
    }
  }

  /**
   * Get read receipts for a message
   * @param {string} messageId - Message ID
   * @returns {Array} Read receipts
   */
  static async getReadReceipts(messageId) {
    try {
      const query = `
        SELECT mrr.*, u.display_name, u.profile_image_url
        FROM message_read_receipts mrr
        JOIN users u ON mrr.user_id = u.id
        WHERE mrr.message_id = $1
        ORDER BY mrr.read_at ASC
      `;

      const result = await pool.query(query, [messageId]);

      return result.rows.map(r => ({
        userId: r.user_id,
        displayName: r.display_name,
        profileImage: r.profile_image_url,
        readAt: r.read_at
      }));

    } catch (error) {
      logger.error('Error getting read receipts', { error: error.message, messageId });
      throw error;
    }
  }

  // ============================================
  // USER PREFERENCES
  // ============================================

  /**
   * Mute/unmute conversation for user
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @param {boolean} muted - Mute status
   * @returns {boolean} Success
   */
  static async setMuted(conversationId, userId, muted) {
    try {
      await pool.query(`
        UPDATE conversation_participants 
        SET is_muted = $1, muted_until = $2
        WHERE conversation_id = $3 AND user_id = $4
      `, [muted, muted ? null : null, conversationId, userId]);

      logger.info('Conversation mute status updated', { conversationId, userId, muted });
      return true;

    } catch (error) {
      logger.error('Error setting mute status', { error: error.message, conversationId, userId });
      throw error;
    }
  }

  /**
   * Pin/unpin conversation for user
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @param {boolean} pinned - Pin status
   * @returns {boolean} Success
   */
  static async setPinned(conversationId, userId, pinned) {
    try {
      await pool.query(`
        UPDATE conversation_participants 
        SET is_pinned = $1, pinned_at = $2
        WHERE conversation_id = $3 AND user_id = $4
      `, [pinned, pinned ? new Date() : null, conversationId, userId]);

      logger.info('Conversation pin status updated', { conversationId, userId, pinned });
      return true;

    } catch (error) {
      logger.error('Error setting pin status', { error: error.message, conversationId, userId });
      throw error;
    }
  }

  /**
   * Archive conversation for user
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @param {boolean} archived - Archive status
   * @returns {boolean} Success
   */
  static async setArchived(conversationId, userId, archived) {
    try {
      await pool.query(`
        UPDATE conversation_participants 
        SET is_archived = $1, archived_at = $2
        WHERE conversation_id = $3 AND user_id = $4
      `, [archived, archived ? new Date() : null, conversationId, userId]);

      logger.info('Conversation archive status updated', { conversationId, userId, archived });
      return true;

    } catch (error) {
      logger.error('Error setting archive status', { error: error.message, conversationId, userId });
      throw error;
    }
  }

  // ============================================
  // SEARCH & STATISTICS
  // ============================================

  /**
   * Search messages
   * @param {string} userId - User ID
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} Search results
   */
  static async searchMessages(userId, searchQuery, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        conversationId = null
      } = options;

      const offset = (page - 1) * limit;
      const conditions = [
        `m.content ILIKE $1`,
        `m.status != $2`,
        `EXISTS (
          SELECT 1 FROM conversation_participants cp 
          WHERE cp.conversation_id = m.conversation_id 
          AND cp.user_id = $3 
          AND cp.left_at IS NULL
        )`
      ];
      const values = [`%${searchQuery}%`, this.STATUSES.DELETED, userId];
      let paramIndex = 4;

      if (conversationId) {
        conditions.push(`m.conversation_id = $${paramIndex}`);
        values.push(conversationId);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      const countQuery = `SELECT COUNT(*) FROM messages m WHERE ${whereClause}`;
      const countResult = await pool.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count);

      const query = `
        SELECT m.*,
               u.display_name as sender_name,
               u.profile_image_url as sender_image,
               c.name as conversation_name,
               c.type as conversation_type
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        JOIN conversations c ON m.conversation_id = c.id
        WHERE ${whereClause}
        ORDER BY m.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      values.push(limit, offset);
      const result = await pool.query(query, values);

      return {
        messages: result.rows.map(m => ({
          ...this.formatMessage(m),
          conversationName: m.conversation_name,
          conversationType: m.conversation_type
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      };

    } catch (error) {
      logger.error('Error searching messages', { error: error.message, userId, searchQuery });
      throw error;
    }
  }

  /**
   * Get user's unread message count
   * @param {string} userId - User ID
   * @returns {Object} Unread counts
   */
  static async getUnreadCount(userId) {
    try {
      const query = `
        SELECT 
          SUM(unread_count) as total_unread,
          COUNT(CASE WHEN unread_count > 0 THEN 1 END) as conversations_with_unread
        FROM conversation_participants
        WHERE user_id = $1 AND left_at IS NULL AND is_archived = false
      `;

      const result = await pool.query(query, [userId]);

      return {
        totalUnread: parseInt(result.rows[0].total_unread) || 0,
        conversationsWithUnread: parseInt(result.rows[0].conversations_with_unread) || 0
      };

    } catch (error) {
      logger.error('Error getting unread count', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get messaging statistics for user
   * @param {string} userId - User ID
   * @returns {Object} Statistics
   */
  static async getUserStatistics(userId) {
    try {
      // Total conversations
      const conversationsQuery = `
        SELECT COUNT(*) FROM conversation_participants
        WHERE user_id = $1 AND left_at IS NULL
      `;
      const conversationsResult = await pool.query(conversationsQuery, [userId]);

      // Total messages sent
      const sentQuery = `
        SELECT COUNT(*) FROM messages
        WHERE sender_id = $1 AND status != $2
      `;
      const sentResult = await pool.query(sentQuery, [userId, this.STATUSES.DELETED]);

      // Total messages received
      const receivedQuery = `
        SELECT COUNT(*) FROM messages m
        JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
        WHERE cp.user_id = $1 AND m.sender_id != $1 AND m.status != $2
      `;
      const receivedResult = await pool.query(receivedQuery, [userId, this.STATUSES.DELETED]);

      // Messages by type
      const byTypeQuery = `
        SELECT type, COUNT(*) as count
        FROM messages
        WHERE sender_id = $1 AND status != $2
        GROUP BY type
      `;
      const byTypeResult = await pool.query(byTypeQuery, [userId, this.STATUSES.DELETED]);

      return {
        totalConversations: parseInt(conversationsResult.rows[0].count),
        messagesSent: parseInt(sentResult.rows[0].count),
        messagesReceived: parseInt(receivedResult.rows[0].count),
        messagesByType: byTypeResult.rows.reduce((acc, row) => {
          acc[row.type] = parseInt(row.count);
          return acc;
        }, {})
      };

    } catch (error) {
      logger.error('Error getting user statistics', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Format conversation for API response
   * @param {Object} conversation - Raw conversation data
   * @returns {Object} Formatted conversation
   */
  static formatConversation(conversation) {
    if (!conversation) return null;

    return {
      id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      description: conversation.description,
      imageUrl: conversation.image_url,
      creatorId: conversation.creator_id,
      metadata: typeof conversation.metadata === 'string'
        ? JSON.parse(conversation.metadata)
        : conversation.metadata,
      messageCount: conversation.message_count,
      unreadCount: conversation.unread_count || 0,
      isMuted: conversation.is_muted || false,
      isPinned: conversation.is_pinned || false,
      isArchived: conversation.is_archived || false,
      participants: conversation.participants?.map(p => ({
        userId: p.user_id,
        displayName: p.display_name,
        profileImage: p.profile_image_url,
        isOnline: p.is_online,
        role: p.role,
        joinedAt: p.joined_at
      })),
      lastMessage: conversation.last_message ? {
        content: conversation.last_message_content || conversation.last_message.content,
        type: conversation.last_message_type || conversation.last_message.type,
        senderId: conversation.last_message_sender_id || conversation.last_message.sender_id,
        senderName: conversation.last_message_sender_name || conversation.last_message.sender_name,
        createdAt: conversation.last_message_at || conversation.last_message.created_at
      } : null,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at
    };
  }

  /**
   * Format message for API response
   * @param {Object} message - Raw message data
   * @returns {Object} Formatted message
   */
  static formatMessage(message) {
    if (!message) return null;

    return {
      id: message.id,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      senderName: message.sender_name,
      senderImage: message.sender_image,
      type: message.type,
      content: message.content,
      mediaUrl: message.media_url,
      mediaType: message.media_type,
      mediaSize: message.media_size,
      replyToId: message.reply_to_id,
      replyTo: message.reply_to_content ? {
        content: message.reply_to_content,
        senderName: message.reply_to_sender_name
      } : null,
      metadata: typeof message.metadata === 'string'
        ? JSON.parse(message.metadata)
        : message.metadata,
      status: message.status,
      createdAt: message.created_at,
      updatedAt: message.updated_at,
      editedAt: message.edited_at,
      deliveredAt: message.delivered_at,
      readAt: message.read_at
    };
  }
}

module.exports = Message;