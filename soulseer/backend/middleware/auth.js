import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import dotenv from 'dotenv';

dotenv.config();

// Clerk authentication middleware
export const requireAuth = ClerkExpressRequireAuth({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Role-based authorization middleware
export const requireRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const { userId } = req.auth;
      
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get user role from database
      const { query } = await import('../config/database.js');
      const result = await query(
        'SELECT role FROM users WHERE clerk_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userRole = result.rows[0].role;

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'You do not have permission to access this resource'
        });
      }

      req.userRole = userRole;
      req.dbUserId = result.rows[0].id;
      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({ error: 'Authorization failed' });
    }
  };
};

// Check if user is a reader
export const requireReader = requireRole('reader', 'admin');

// Check if user is an admin
export const requireAdmin = requireRole('admin');

// Check if user is a client or admin
export const requireClient = requireRole('client', 'admin');

// Optional auth - doesn't fail if not authenticated
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return next();
    }

    // Try to authenticate but don't fail if it doesn't work
    const { userId } = req.auth || {};
    
    if (userId) {
      const { query } = await import('../config/database.js');
      const result = await query(
        'SELECT id, role FROM users WHERE clerk_id = $1',
        [userId]
      );

      if (result.rows.length > 0) {
        req.userRole = result.rows[0].role;
        req.dbUserId = result.rows[0].id;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};