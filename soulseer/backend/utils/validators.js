/**
 * Validation Utilities
 * Common validation functions
 */

/**
 * Validate email format
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format
 */
export const isValidPhone = (phone) => {
  const phoneRegex = /^\+?[\d\s-()]+$/;
  return phoneRegex.test(phone);
};

/**
 * Validate URL format
 */
export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate rating (1-5)
 */
export const isValidRating = (rating) => {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
};

/**
 * Validate session type
 */
export const isValidSessionType = (type) => {
  return ['chat', 'call', 'video'].includes(type);
};

/**
 * Validate user role
 */
export const isValidRole = (role) => {
  return ['client', 'reader', 'admin'].includes(role);
};

/**
 * Validate amount (positive number)
 */
export const isValidAmount = (amount) => {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0;
};

/**
 * Validate pagination parameters
 */
export const validatePagination = (limit, offset) => {
  const parsedLimit = parseInt(limit);
  const parsedOffset = parseInt(offset);
  
  return {
    limit: !isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20,
    offset: !isNaN(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0
  };
};

/**
 * Sanitize string input
 */
export const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '');
};

/**
 * Validate required fields
 */
export const validateRequiredFields = (data, requiredFields) => {
  const missing = [];
  
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      missing.push(field);
    }
  }
  
  return {
    isValid: missing.length === 0,
    missing
  };
};

/**
 * Validate date range
 */
export const isValidDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  return !isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end;
};

/**
 * Validate specialties array
 */
export const isValidSpecialties = (specialties) => {
  if (!Array.isArray(specialties)) return false;
  if (specialties.length === 0) return false;
  
  const validSpecialties = [
    'tarot', 'astrology', 'numerology', 'palmistry', 
    'mediumship', 'clairvoyance', 'energy_healing', 
    'dream_interpretation', 'love_relationships', 'career'
  ];
  
  return specialties.every(s => validSpecialties.includes(s));
};

/**
 * Validate rate (must be positive and reasonable)
 */
export const isValidRate = (rate) => {
  const num = parseFloat(rate);
  return !isNaN(num) && num >= 0.5 && num <= 100; // $0.50 to $100 per minute
};

/**
 * Validate duration (in minutes)
 */
export const isValidDuration = (duration) => {
  const num = parseInt(duration);
  return !isNaN(num) && num > 0 && num <= 1440; // Max 24 hours
};

/**
 * Validate transaction type
 */
export const isValidTransactionType = (type) => {
  const validTypes = [
    'balance_add', 'session_payment', 'session_earning',
    'tip_payment', 'tip_earning', 'refund', 'withdrawal'
  ];
  return validTypes.includes(type);
};

/**
 * Validate transaction status
 */
export const isValidTransactionStatus = (status) => {
  const validStatuses = ['pending', 'completed', 'failed', 'refunded', 'cancelled'];
  return validStatuses.includes(status);
};