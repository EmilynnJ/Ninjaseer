/**
 * Logger Utility
 * Centralized logging system
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

class Logger {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  /**
   * Format log message
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaString = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
    
    return `[${timestamp}] [${level}] ${message} ${metaString}`;
  }

  /**
   * Log error
   */
  error(message, error = null, meta = {}) {
    const logMessage = this.formatMessage(LOG_LEVELS.ERROR, message, meta);
    console.error(logMessage);
    
    if (error) {
      console.error('Error details:', error);
      if (this.isDevelopment && error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }
  }

  /**
   * Log warning
   */
  warn(message, meta = {}) {
    const logMessage = this.formatMessage(LOG_LEVELS.WARN, message, meta);
    console.warn(logMessage);
  }

  /**
   * Log info
   */
  info(message, meta = {}) {
    const logMessage = this.formatMessage(LOG_LEVELS.INFO, message, meta);
    console.log(logMessage);
  }

  /**
   * Log debug (only in development)
   */
  debug(message, meta = {}) {
    if (this.isDevelopment) {
      const logMessage = this.formatMessage(LOG_LEVELS.DEBUG, message, meta);
      console.log(logMessage);
    }
  }

  /**
   * Log API request
   */
  logRequest(req) {
    this.info('API Request', {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  }

  /**
   * Log API response
   */
  logResponse(req, res, duration) {
    this.info('API Response', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  }

  /**
   * Log database query
   */
  logQuery(query, duration, rows) {
    this.debug('Database Query', {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      rows
    });
  }

  /**
   * Log authentication event
   */
  logAuth(event, userId, success = true) {
    this.info('Authentication Event', {
      event,
      userId,
      success
    });
  }

  /**
   * Log payment event
   */
  logPayment(event, amount, userId, status) {
    this.info('Payment Event', {
      event,
      amount,
      userId,
      status
    });
  }

  /**
   * Log session event
   */
  logSession(event, sessionId, clientId, readerId) {
    this.info('Session Event', {
      event,
      sessionId,
      clientId,
      readerId
    });
  }
}

// Export singleton instance
export default new Logger();