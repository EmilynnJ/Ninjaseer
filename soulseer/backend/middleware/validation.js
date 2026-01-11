/**
 * Validation Middleware
 * Request validation using validators utility
 */

import {
  validateRequiredFields,
  isValidEmail,
  isValidPhone,
  isValidRating,
  isValidSessionType,
  isValidAmount,
  isValidRate,
  isValidDuration,
  isValidSpecialties
} from '../utils/validators.js';

/**
 * Validate required fields in request body
 */
export const validateRequired = (requiredFields) => {
  return (req, res, next) => {
    const { isValid, missing } = validateRequiredFields(req.body, requiredFields);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: {
          missing
        }
      });
    }

    next();
  };
};

/**
 * Validate email format
 */
export const validateEmail = (req, res, next) => {
  const { email } = req.body;

  if (email && !isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: {
        email: 'Invalid email format'
      }
    });
  }

  next();
};

/**
 * Validate phone format
 */
export const validatePhone = (req, res, next) => {
  const { phone } = req.body;

  if (phone && !isValidPhone(phone)) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: {
        phone: 'Invalid phone format'
      }
    });
  }

  next();
};

/**
 * Validate rating
 */
export const validateRating = (req, res, next) => {
  const { rating } = req.body;

  if (rating !== undefined && !isValidRating(rating)) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: {
        rating: 'Rating must be between 1 and 5'
      }
    });
  }

  next();
};

/**
 * Validate session type
 */
export const validateSessionType = (req, res, next) => {
  const { sessionType } = req.body;

  if (sessionType && !isValidSessionType(sessionType)) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: {
        sessionType: 'Session type must be chat, call, or video'
      }
    });
  }

  next();
};

/**
 * Validate amount
 */
export const validateAmount = (req, res, next) => {
  const { amount } = req.body;

  if (amount !== undefined && !isValidAmount(amount)) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: {
        amount: 'Amount must be a positive number'
      }
    });
  }

  next();
};

/**
 * Validate reader rates
 */
export const validateReaderRates = (req, res, next) => {
  const { chatRate, callRate, videoRate } = req.body;

  const errors = {};

  if (chatRate !== undefined && !isValidRate(chatRate)) {
    errors.chatRate = 'Chat rate must be between $0.50 and $100 per minute';
  }

  if (callRate !== undefined && !isValidRate(callRate)) {
    errors.callRate = 'Call rate must be between $0.50 and $100 per minute';
  }

  if (videoRate !== undefined && !isValidRate(videoRate)) {
    errors.videoRate = 'Video rate must be between $0.50 and $100 per minute';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

/**
 * Validate duration
 */
export const validateDuration = (req, res, next) => {
  const { durationMinutes } = req.body;

  if (durationMinutes !== undefined && !isValidDuration(durationMinutes)) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: {
        durationMinutes: 'Duration must be between 1 and 1440 minutes'
      }
    });
  }

  next();
};

/**
 * Validate reader specialties
 */
export const validateReaderSpecialties = (req, res, next) => {
  const { specialties } = req.body;

  if (specialties !== undefined && !isValidSpecialties(specialties)) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: {
        specialties: 'Invalid specialties. Valid options are: tarot, astrology, numerology, palmistry, mediumship, clairvoyance, energy_healing, dream_interpretation, love_relationships, career'
      }
    });
  }

  next();
};

/**
 * Validate user profile update
 */
export const validateUserProfile = [
  validateEmail,
  validatePhone,
  (req, res, next) => {
    const { displayName } = req.body;

    if (displayName !== undefined && (typeof displayName !== 'string' || displayName.length < 2)) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: {
          displayName: 'Display name must be at least 2 characters long'
        }
      });
    }

    next();
  }
];

/**
 * Validate reader profile creation
 */
export const validateReaderProfile = [
  validateRequired(['displayName', 'bio', 'chatRate', 'callRate', 'videoRate']),
  validateReaderRates,
  validateReaderSpecialties,
  (req, res, next) => {
    const { bio } = req.body;

    if (bio && typeof bio === 'string' && bio.length < 50) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: {
          bio: 'Bio must be at least 50 characters long'
        }
      });
    }

    next();
  }
];

/**
 * Validate session start
 */
export const validateSessionStart = [
  validateRequired(['readerId', 'sessionType']),
  validateSessionType
];

/**
 * Validate session end
 */
export const validateSessionEnd = [
  validateRequired(['durationMinutes']),
  validateDuration
];

/**
 * Validate review submission
 */
export const validateReview = [
  validateRequired(['rating']),
  validateRating,
  (req, res, next) => {
    const { reviewText } = req.body;

    if (reviewText !== undefined && typeof reviewText === 'string' && reviewText.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: {
          reviewText: 'Review text must be less than 1000 characters'
        }
      });
    }

    next();
  }
];

/**
 * Validate balance addition
 */
export const validateBalanceAdd = [
  validateRequired(['amount']),
  validateAmount,
  (req, res, next) => {
    const { amount } = req.body;

    if (amount < 10 || amount > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: {
          amount: 'Amount must be between $10 and $1000'
        }
      });
    }

    next();
  }
];

/**
 * Validate stream creation
 */
export const validateStreamCreate = [
  validateRequired(['title', 'description']),
  (req, res, next) => {
    const { title, description } = req.body;

    const errors = {};

    if (title.length < 5 || title.length > 100) {
      errors.title = 'Title must be between 5 and 100 characters';
    }

    if (description.length < 20 || description.length > 500) {
      errors.description = 'Description must be between 20 and 500 characters';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    next();
  }
];

/**
 * Validate forum post creation
 */
export const validatePostCreate = [
  validateRequired(['title', 'content', 'category']),
  (req, res, next) => {
    const { title, content } = req.body;

    const errors = {};

    if (title.length < 5 || title.length > 200) {
      errors.title = 'Title must be between 5 and 200 characters';
    }

    if (content.length < 20 || content.length > 5000) {
      errors.content = 'Content must be between 20 and 5000 characters';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    next();
  }
];

/**
 * Validate comment creation
 */
export const validateCommentCreate = [
  validateRequired(['content']),
  (req, res, next) => {
    const { content } = req.body;

    if (content.length < 1 || content.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: {
          content: 'Content must be between 1 and 1000 characters'
        }
      });
    }

    next();
  }
];

/**
 * Validate message sending
 */
export const validateMessageSend = [
  validateRequired(['receiverId', 'content']),
  (req, res, next) => {
    const { content } = req.body;

    if (content.length < 1 || content.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: {
          content: 'Content must be between 1 and 2000 characters'
        }
      });
    }

    next();
  }
];