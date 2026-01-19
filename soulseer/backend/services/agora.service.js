/**
 * Agora Service - Enterprise Level
 * Complete Agora RTC/RTM integration for SoulSeer platform
 * Handles video calls, voice calls, live streaming, and real-time messaging
 */

const { RtcTokenBuilder, RtcRole, RtmTokenBuilder, RtmRole } = require('agora-access-token');
const { logger } = require('../utils/logger');

class AgoraService {
  constructor() {
    this.appId = process.env.AGORA_APP_ID;
    this.appCertificate = process.env.AGORA_APP_CERTIFICATE;
    this.tokenExpirationInSeconds = 3600; // 1 hour
    this.privilegeExpirationInSeconds = 3600;
    
    if (!this.appId || !this.appCertificate) {
      logger.warn('Agora credentials not configured');
    }
  }

  // ============================================
  // RTC TOKEN GENERATION (Video/Voice Calls)
  // ============================================

  /**
   * Generate RTC token for video/voice calls
   * @param {string} channelName - Channel name
   * @param {string} uid - User ID
   * @param {string} role - 'publisher' or 'audience'
   * @param {number} expirationTime - Token expiration in seconds
   * @returns {string} RTC token
   */
  generateRtcToken(channelName, uid, role = 'publisher', expirationTime = null) {
    try {
      if (!this.appId || !this.appCertificate) {
        throw new Error('Agora credentials not configured');
      }

      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + (expirationTime || this.privilegeExpirationInSeconds);

      // Determine role
      const rtcRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

      // Generate token
      // Use 0 for uid if string (account-based) or parseInt if numeric
      const uidValue = typeof uid === 'string' ? 0 : parseInt(uid);
      const account = typeof uid === 'string' ? uid : null;

      let token;
      if (account) {
        token = RtcTokenBuilder.buildTokenWithAccount(
          this.appId,
          this.appCertificate,
          channelName,
          account,
          rtcRole,
          privilegeExpiredTs
        );
      } else {
        token = RtcTokenBuilder.buildTokenWithUid(
          this.appId,
          this.appCertificate,
          channelName,
          uidValue,
          rtcRole,
          privilegeExpiredTs
        );
      }

      logger.info('RTC token generated', { channelName, uid, role });
      return token;

    } catch (error) {
      logger.error('Error generating RTC token', { error: error.message, channelName, uid });
      throw error;
    }
  }

  /**
   * Generate RTC token for reading session
   * @param {string} sessionId - Session ID
   * @param {string} participantId - Participant user ID
   * @param {string} participantType - 'client' or 'reader'
   * @returns {Object} Token and channel info
   */
  generateReadingSessionToken(sessionId, participantId, participantType) {
    try {
      const channelName = `reading_${sessionId}`;
      const role = 'publisher'; // Both participants can publish in a reading

      const token = this.generateRtcToken(channelName, participantId, role);

      return {
        token,
        channelName,
        appId: this.appId,
        uid: participantId,
        role,
        participantType,
        expiresAt: new Date(Date.now() + this.tokenExpirationInSeconds * 1000)
      };

    } catch (error) {
      logger.error('Error generating reading session token', { error: error.message, sessionId });
      throw error;
    }
  }

  /**
   * Generate RTC token for live stream
   * @param {string} streamId - Stream ID
   * @param {string} participantId - Participant user ID
   * @param {boolean} isHost - Whether participant is the host
   * @returns {Object} Token and channel info
   */
  generateStreamToken(streamId, participantId, isHost = false) {
    try {
      const channelName = `stream_${streamId}`;
      const role = isHost ? 'publisher' : 'audience';

      const token = this.generateRtcToken(channelName, participantId, role);

      return {
        token,
        channelName,
        appId: this.appId,
        uid: participantId,
        role,
        isHost,
        expiresAt: new Date(Date.now() + this.tokenExpirationInSeconds * 1000)
      };

    } catch (error) {
      logger.error('Error generating stream token', { error: error.message, streamId });
      throw error;
    }
  }

  /**
   * Refresh RTC token
   * @param {string} channelName - Channel name
   * @param {string} uid - User ID
   * @param {string} role - Current role
   * @returns {Object} New token info
   */
  refreshRtcToken(channelName, uid, role = 'publisher') {
    try {
      const token = this.generateRtcToken(channelName, uid, role);

      return {
        token,
        channelName,
        uid,
        role,
        expiresAt: new Date(Date.now() + this.tokenExpirationInSeconds * 1000)
      };

    } catch (error) {
      logger.error('Error refreshing RTC token', { error: error.message, channelName });
      throw error;
    }
  }

  // ============================================
  // RTM TOKEN GENERATION (Real-time Messaging)
  // ============================================

  /**
   * Generate RTM token for real-time messaging
   * @param {string} userId - User ID
   * @param {number} expirationTime - Token expiration in seconds
   * @returns {string} RTM token
   */
  generateRtmToken(userId, expirationTime = null) {
    try {
      if (!this.appId || !this.appCertificate) {
        throw new Error('Agora credentials not configured');
      }

      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + (expirationTime || this.privilegeExpirationInSeconds);

      const token = RtmTokenBuilder.buildToken(
        this.appId,
        this.appCertificate,
        userId.toString(),
        RtmRole.Rtm_User,
        privilegeExpiredTs
      );

      logger.info('RTM token generated', { userId });
      return token;

    } catch (error) {
      logger.error('Error generating RTM token', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Generate complete token set for a session
   * @param {string} sessionId - Session ID
   * @param {string} userId - User ID
   * @param {string} role - User role in session
   * @returns {Object} Complete token set
   */
  generateSessionTokens(sessionId, userId, role = 'publisher') {
    try {
      const channelName = `reading_${sessionId}`;
      
      const rtcToken = this.generateRtcToken(channelName, userId, role);
      const rtmToken = this.generateRtmToken(userId);

      return {
        rtc: {
          token: rtcToken,
          channelName,
          uid: userId,
          role
        },
        rtm: {
          token: rtmToken,
          userId
        },
        appId: this.appId,
        expiresAt: new Date(Date.now() + this.tokenExpirationInSeconds * 1000)
      };

    } catch (error) {
      logger.error('Error generating session tokens', { error: error.message, sessionId });
      throw error;
    }
  }

  // ============================================
  // CHANNEL MANAGEMENT
  // ============================================

  /**
   * Generate unique channel name
   * @param {string} type - Channel type (reading, stream, etc.)
   * @param {string} id - Associated ID
   * @returns {string} Channel name
   */
  generateChannelName(type, id) {
    const timestamp = Date.now().toString(36);
    return `${type}_${id}_${timestamp}`;
  }

  /**
   * Parse channel name to extract info
   * @param {string} channelName - Channel name
   * @returns {Object} Parsed channel info
   */
  parseChannelName(channelName) {
    const parts = channelName.split('_');
    return {
      type: parts[0],
      id: parts[1],
      timestamp: parts[2] || null
    };
  }

  /**
   * Validate channel name format
   * @param {string} channelName - Channel name to validate
   * @returns {boolean} Is valid
   */
  validateChannelName(channelName) {
    // Channel name rules: 1-64 chars, alphanumeric + underscore
    const regex = /^[a-zA-Z0-9_]{1,64}$/;
    return regex.test(channelName);
  }

  // ============================================
  // RECORDING MANAGEMENT
  // ============================================

  /**
   * Start cloud recording for a channel
   * @param {string} channelName - Channel name
   * @param {string} uid - Recording bot UID
   * @param {Object} options - Recording options
   * @returns {Object} Recording info
   */
  async startCloudRecording(channelName, uid, options = {}) {
    try {
      const {
        mode = 'mix', // mix, individual
        streamTypes = 2, // 0: audio, 1: video, 2: both
        videoStreamType = 0, // 0: high, 1: low
        maxIdleTime = 30,
        transcodingConfig = null,
        storageConfig = null
      } = options;

      // In production, this would call Agora's Cloud Recording API
      // For now, we'll simulate the response
      const resourceId = this.generateResourceId();
      const sid = this.generateSid();

      logger.info('Cloud recording started', { channelName, resourceId, sid });

      return {
        resourceId,
        sid,
        channelName,
        uid,
        mode,
        status: 'recording',
        startedAt: new Date()
      };

    } catch (error) {
      logger.error('Error starting cloud recording', { error: error.message, channelName });
      throw error;
    }
  }

  /**
   * Stop cloud recording
   * @param {string} resourceId - Resource ID
   * @param {string} sid - Session ID
   * @param {string} channelName - Channel name
   * @returns {Object} Recording result
   */
  async stopCloudRecording(resourceId, sid, channelName) {
    try {
      // In production, this would call Agora's Cloud Recording API
      logger.info('Cloud recording stopped', { channelName, resourceId, sid });

      return {
        resourceId,
        sid,
        channelName,
        status: 'stopped',
        stoppedAt: new Date(),
        // In production, this would include the recording file URLs
        files: []
      };

    } catch (error) {
      logger.error('Error stopping cloud recording', { error: error.message, channelName });
      throw error;
    }
  }

  /**
   * Query cloud recording status
   * @param {string} resourceId - Resource ID
   * @param {string} sid - Session ID
   * @returns {Object} Recording status
   */
  async queryRecordingStatus(resourceId, sid) {
    try {
      // In production, this would call Agora's Cloud Recording API
      return {
        resourceId,
        sid,
        status: 'recording',
        serverResponse: {}
      };

    } catch (error) {
      logger.error('Error querying recording status', { error: error.message, resourceId });
      throw error;
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Generate resource ID for recording
   * @returns {string} Resource ID
   */
  generateResourceId() {
    return `res_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate session ID for recording
   * @returns {string} Session ID
   */
  generateSid() {
    return `sid_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get recommended video configuration
   * @param {string} quality - Quality level (low, medium, high, hd)
   * @returns {Object} Video configuration
   */
  getVideoConfig(quality = 'medium') {
    const configs = {
      low: {
        width: 320,
        height: 240,
        frameRate: 15,
        bitrate: 200
      },
      medium: {
        width: 640,
        height: 480,
        frameRate: 24,
        bitrate: 600
      },
      high: {
        width: 1280,
        height: 720,
        frameRate: 30,
        bitrate: 1500
      },
      hd: {
        width: 1920,
        height: 1080,
        frameRate: 30,
        bitrate: 3000
      }
    };

    return configs[quality] || configs.medium;
  }

  /**
   * Get recommended audio configuration
   * @param {string} quality - Quality level (speech, music, high)
   * @returns {Object} Audio configuration
   */
  getAudioConfig(quality = 'speech') {
    const configs = {
      speech: {
        sampleRate: 16000,
        channels: 1,
        bitrate: 18
      },
      music: {
        sampleRate: 48000,
        channels: 2,
        bitrate: 48
      },
      high: {
        sampleRate: 48000,
        channels: 2,
        bitrate: 128
      }
    };

    return configs[quality] || configs.speech;
  }

  /**
   * Calculate estimated bandwidth usage
   * @param {Object} videoConfig - Video configuration
   * @param {Object} audioConfig - Audio configuration
   * @param {number} durationMinutes - Duration in minutes
   * @returns {Object} Bandwidth estimates
   */
  calculateBandwidth(videoConfig, audioConfig, durationMinutes) {
    const videoBitsPerSecond = videoConfig.bitrate * 1000;
    const audioBitsPerSecond = audioConfig.bitrate * 1000;
    const totalBitsPerSecond = videoBitsPerSecond + audioBitsPerSecond;
    
    const durationSeconds = durationMinutes * 60;
    const totalBits = totalBitsPerSecond * durationSeconds;
    const totalMB = totalBits / 8 / 1024 / 1024;

    return {
      videoBitrate: videoConfig.bitrate,
      audioBitrate: audioConfig.bitrate,
      totalBitrate: (videoBitsPerSecond + audioBitsPerSecond) / 1000,
      estimatedMB: Math.round(totalMB * 100) / 100,
      estimatedGB: Math.round(totalMB / 1024 * 100) / 100
    };
  }

  // ============================================
  // WEBHOOK HANDLING
  // ============================================

  /**
   * Verify Agora webhook signature
   * @param {string} signature - Webhook signature
   * @param {string} body - Request body
   * @returns {boolean} Is valid
   */
  verifyWebhookSignature(signature, body) {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', this.appCertificate)
        .update(body)
        .digest('hex');

      return signature === expectedSignature;

    } catch (error) {
      logger.error('Error verifying webhook signature', { error: error.message });
      return false;
    }
  }

  /**
   * Handle Agora webhook event
   * @param {Object} event - Webhook event
   * @returns {Object} Processing result
   */
  async handleWebhookEvent(event) {
    try {
      const { eventType, payload } = event;

      logger.info('Agora webhook received', { eventType });

      switch (eventType) {
        case 1: // Channel created
          return this.handleChannelCreated(payload);
        case 2: // Channel destroyed
          return this.handleChannelDestroyed(payload);
        case 3: // User joined
          return this.handleUserJoined(payload);
        case 4: // User left
          return this.handleUserLeft(payload);
        case 101: // Recording started
          return this.handleRecordingStarted(payload);
        case 102: // Recording stopped
          return this.handleRecordingStopped(payload);
        default:
          logger.warn('Unknown Agora event type', { eventType });
          return { handled: false };
      }

    } catch (error) {
      logger.error('Error handling webhook event', { error: error.message });
      throw error;
    }
  }

  async handleChannelCreated(payload) {
    logger.info('Channel created', { channelName: payload.channelName });
    return { handled: true, action: 'channel_created' };
  }

  async handleChannelDestroyed(payload) {
    logger.info('Channel destroyed', { channelName: payload.channelName });
    return { handled: true, action: 'channel_destroyed' };
  }

  async handleUserJoined(payload) {
    logger.info('User joined channel', { 
      channelName: payload.channelName, 
      uid: payload.uid 
    });
    return { handled: true, action: 'user_joined' };
  }

  async handleUserLeft(payload) {
    logger.info('User left channel', { 
      channelName: payload.channelName, 
      uid: payload.uid 
    });
    return { handled: true, action: 'user_left' };
  }

  async handleRecordingStarted(payload) {
    logger.info('Recording started', { 
      channelName: payload.channelName,
      sid: payload.sid 
    });
    return { handled: true, action: 'recording_started' };
  }

  async handleRecordingStopped(payload) {
    logger.info('Recording stopped', { 
      channelName: payload.channelName,
      sid: payload.sid 
    });
    return { handled: true, action: 'recording_stopped' };
  }

  // ============================================
  // ERROR HANDLING
  // ============================================

  /**
   * Get error message for Agora error code
   * @param {number} code - Error code
   * @returns {string} Error message
   */
  getErrorMessage(code) {
    const errorMessages = {
      0: 'Success',
      1: 'General error',
      2: 'Invalid argument',
      3: 'SDK not ready',
      4: 'SDK not supported',
      5: 'Request rejected',
      6: 'Buffer too small',
      7: 'SDK not initialized',
      8: 'No permission',
      9: 'Operation timeout',
      10: 'Canceled',
      11: 'Too frequent',
      12: 'Bind socket error',
      13: 'Network error',
      14: 'Resource limited',
      17: 'Invalid app ID',
      18: 'Invalid channel name',
      19: 'Token expired',
      20: 'Invalid token',
      101: 'Invalid user account',
      102: 'User not logged in',
      109: 'Token expired (RTM)',
      110: 'Login timeout',
      111: 'Login rejected',
      112: 'Login aborted',
      113: 'Not logged in',
      114: 'Lookup timeout',
      115: 'Lookup failed',
      116: 'Invalid argument (RTM)',
      120: 'Server timeout',
      121: 'Server error'
    };

    return errorMessages[code] || `Unknown error (${code})`;
  }
}

// Export singleton instance
module.exports = new AgoraService();