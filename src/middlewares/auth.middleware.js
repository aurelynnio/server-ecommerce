const jwt = require("jsonwebtoken");
const { StatusCodes } = require("http-status-codes");
const { sendFail } = require("../shared/res/formatResponse");
const User = require("../models/user.model");

/**
 * Verify JWT access token from cookie or Authorization header
 * Attaches user info to req.user if valid
 */
const verifyAccessToken = (req, res, next) => {
  try {
    // Get token from cookie (priority) or Authorization header
    let token = req.cookies?.accessToken;

    // If not in cookie, check Authorization header
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7); // Remove "Bearer " prefix
      }
    }

    // No token found
    if (!token) {
      return sendFail(
        res,
        "Access token is required. Please login.",
        StatusCodes.UNAUTHORIZED
      );
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return sendFail(
        res,
        "Access token has expired. Please refresh your token.",
        StatusCodes.UNAUTHORIZED
      );
    }

    if (error.name === "JsonWebTokenError") {
      return sendFail(
        res,
        "Invalid access token. Please login again.",
        StatusCodes.UNAUTHORIZED
      );
    }

    return sendFail(res, "Authentication failed", StatusCodes.UNAUTHORIZED);
  }
};

/**
 * Authenticate user - attaches full user object to req.user
 */
const authenticate = async (req, res, next) => {
  try {
    let token = req.cookies?.accessToken;

    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return sendFail(
        res,
        "Access token is required. Please login.",
        StatusCodes.UNAUTHORIZED
      );
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    
    // Get full user from database
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return sendFail(res, "User not found", StatusCodes.UNAUTHORIZED);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return sendFail(
        res,
        "Access token has expired. Please refresh your token.",
        StatusCodes.UNAUTHORIZED
      );
    }
    return sendFail(res, "Authentication failed", StatusCodes.UNAUTHORIZED);
  }
};

/**
 * Optional authentication - doesn't fail if no token
 * Useful for routes that work for both guests and logged-in users
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.accessToken;

    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.userId).select("-password");
    req.user = user || null;
    next();
  } catch (error) {
    // Don't fail, just set user to null
    req.user = null;
    next();
  }
};

/**
 * Check if user has required role
 * @param {...string} allowedRoles - List of allowed roles (e.g., 'admin', 'user')
 */
const requireRole = (...allowedRoles) => {
  // Flatten in case allowedRoles is passed as array
  const flatRoles = allowedRoles.flat();
  
  return (req, res, next) => {
    // Check if user is authenticated first
    if (!req.user) {
      return sendFail(res, "Authentication required", StatusCodes.UNAUTHORIZED);
    }

    // Support both single role string and roles array
    const userRoles = Array.isArray(req.user.role) 
      ? req.user.role 
      : [req.user.role];
    
    // Check if user has one of the allowed roles
    const hasRole = flatRoles.some((role) => userRoles.includes(role));
    
    if (!hasRole) {
      return sendFail(
        res,
        `Access denied. Required role: ${flatRoles.join(" or ")}`,
        StatusCodes.FORBIDDEN
      );
    }

    next();
  };
};

/**
 * Authorization middleware - check if user has required roles
 * @param {...string} allowedRoles - List of allowed roles
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendFail(res, "Authentication required", StatusCodes.UNAUTHORIZED);
    }

    // Support both single role string and roles array
    const userRoles = Array.isArray(req.user.roles) 
      ? req.user.roles 
      : [req.user.role || req.user.roles];

    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return sendFail(
        res,
        `Access denied. Required role: ${allowedRoles.join(" or ")}`,
        StatusCodes.FORBIDDEN
      );
    }

    next();
  };
};

module.exports = {
  verifyAccessToken,
  authenticate,
  optionalAuth,
  requireRole,
  authorize,
};
