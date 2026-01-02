import pkg from 'agora-token';
const { RtcTokenBuilder, RtcRole, RtmTokenBuilder, RtmRole } = pkg;
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

class AgoraService {
  constructor() {
    this.activeSessions = new Map();
    this.sessionTimers = new Map();
  }

  // Generate RTC token for video/voice calls
  generateRTCToken(channelName, uid, role = 'publisher', expirationTimeInSeconds = 3600) {
    try {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

      const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

      const token = RtcTokenBuilder.buildTokenWithUid(
        APP_ID,
        APP_CERTIFICATE,
        channelName,
        uid,
        agoraRole,
        privilegeExpiredTs
      );

      return {
        token,
        appId: APP_ID,
        channelName,
        uid,
        expiresAt: privilegeExpiredTs
      };
    } catch (error) {
      console.error('Error generating RTC token:', error);
      throw error;
    }
  }

  // Generate RTM token for chat messaging
  generateRTMToken(userId, expirationTimeInSeconds = 3600) {
    try {
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

      const token = RtmTokenBuilder.buildToken(
        APP_ID,
        APP_CERTIFICATE,
        userId,
        RtmRole.Rtm_User,
        privilegeExpiredTs
      );

      return {
        token,
        appId: APP_ID,
        userId,
        expiresAt: privilegeExpiredTs
      };
    } catch (error) {
      console.error('Error generating RTM token:', error);
      throw error;
    }
  }

  // Create a new reading session
  createReadingSession(clientId, readerId, sessionType, ratePerMinute) {
    const sessionId = uuidv4();
    const channelName = `reading_${sessionId}`;
    
    const session = {
      sessionId,
      channelName,
      clientId,
      readerId,
      sessionType,
      ratePerMinute,
      startTime: new Date(),
      endTime: null,
      durationMinutes: 0,
      totalCost: 0,
      status: 'active',
      chatMessages: []
    };

    this.activeSessions.set(sessionId, session);
    
    // Start billing timer
    this.startBillingTimer(sessionId);

    // Generate tokens for both participants
    const clientUid = parseInt(clientId.replace(/-/g, '').substring(0, 8), 16);
    const readerUid = parseInt(readerId.replace(/-/g, '').substring(0, 8), 16);

    const clientRTCToken = this.generateRTCToken(channelName, clientUid, 'publisher');
    const readerRTCToken = this.generateRTCToken(channelName, readerUid, 'publisher');
    const clientRTMToken = this.generateRTMToken(clientId);
    const readerRTMToken = this.generateRTMToken(readerId);

    return {
      session,
      clientTokens: {
        rtc: clientRTCToken,
        rtm: clientRTMToken
      },
      readerTokens: {
        rtc: readerRTCToken,
        rtm: readerRTMToken
      }
    };
  }

  // Start billing timer (charges per minute)
  startBillingTimer(sessionId) {
    const timer = setInterval(() => {
      const session = this.activeSessions.get(sessionId);
      
      if (!session || session.status !== 'active') {
        this.stopBillingTimer(sessionId);
        return;
      }

      // Increment duration
      session.durationMinutes += 1;
      
      // Calculate cost
      session.totalCost = session.durationMinutes * session.ratePerMinute;

      console.log(`Session ${sessionId}: ${session.durationMinutes} minutes, $${session.totalCost.toFixed(2)}`);
    }, 60000); // Every minute

    this.sessionTimers.set(sessionId, timer);
  }

  // Stop billing timer
  stopBillingTimer(sessionId) {
    const timer = this.sessionTimers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.sessionTimers.delete(sessionId);
    }
  }

  // End a session
  endSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    // Stop billing
    this.stopBillingTimer(sessionId);

    // Update session
    session.endTime = new Date();
    session.status = 'completed';

    // Calculate final duration in minutes
    const durationMs = session.endTime - session.startTime;
    session.durationMinutes = Math.ceil(durationMs / 60000);
    session.totalCost = session.durationMinutes * session.ratePerMinute;

    return session;
  }

  // Get session details
  getSession(sessionId) {
    return this.activeSessions.get(sessionId);
  }

  // Add chat message to session
  addChatMessage(sessionId, message) {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    session.chatMessages.push({
      ...message,
      timestamp: new Date()
    });

    return session;
  }

  // Get chat transcript
  getChatTranscript(sessionId) {
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    return session.chatMessages;
  }

  // Check if user has sufficient balance
  async checkBalance(clientId, estimatedMinutes, ratePerMinute) {
    const { query } = await import('../config/database.js');
    
    const result = await query(
      'SELECT balance FROM users WHERE id = $1',
      [clientId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const balance = parseFloat(result.rows[0].balance);
    const estimatedCost = estimatedMinutes * ratePerMinute;

    return {
      hasBalance: balance >= estimatedCost,
      currentBalance: balance,
      estimatedCost
    };
  }

  // Generate token for live streaming (publisher)
  generateStreamToken(channelName, uid, expirationTimeInSeconds = 7200) {
    return this.generateRTCToken(channelName, uid, 'publisher', expirationTimeInSeconds);
  }

  // Generate token for viewer (subscriber)
  generateViewerToken(channelName, uid, expirationTimeInSeconds = 3600) {
    return this.generateRTCToken(channelName, uid, 'subscriber', expirationTimeInSeconds);
  }

  // Generate unique channel name
  generateChannelName(prefix, id) {
    return `${prefix}_${id}_${Date.now()}`;
  }

  // Validate channel name format
  isValidChannelName(channelName) {
    const regex = /^[a-zA-Z0-9_]{1,64}$/;
    return regex.test(channelName);
  }

  // Clean up old sessions
  cleanupOldSessions(hoursOld = 24) {
    const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.endTime && session.endTime < cutoffTime) {
        this.activeSessions.delete(sessionId);
        this.stopBillingTimer(sessionId);
      }
    }
  }
}

export default new AgoraService();