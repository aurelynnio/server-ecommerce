const { StatusCodes } = require("http-status-codes");
const { sendFail } = require("../shared/res/formatResponse");
const User = require("../models/user.model");
const tokenService = require("../services/token.service");

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
        StatusCodes.UNAUTHORIZED,
      );
    }

    // Verify token
    const decoded = tokenService.verifyAccessToken(token);

    // Attach user info to request
    req.user = {
      // Keep both keys for backward compatibility across controllers.
      _id: decoded.userId,
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
      permissions: decoded.permissions || [],
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return sendFail(
        res,
        "Access token has expired. Please refresh your token.",
        StatusCodes.UNAUTHORIZED,
      );
    }

    if (error.name === "JsonWebTokenError") {
      return sendFail(
        res,
        "Invalid access token. Please login again.",
        StatusCodes.UNAUTHORIZED,
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

    const decoded = tokenService.verifyAccessToken(token);

    const user = await User.findById(decoded.userId).select("-password");
    req.user = user || null;
    next();
  } catch (_error) {
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

  return async (req, res, next) => {
    try {
      // Check if user is authenticated first
      if (!req.user) {
        return sendFail(
          res,
          "Authentication required",
          StatusCodes.UNAUTHORIZED,
        );
      }

      // Support both 'role' and 'roles' field (string or array)
      let userRoles = [];
      if (req.user.role) {
        userRoles = Array.isArray(req.user.role)
          ? req.user.role
          : [req.user.role];
      }
      if (req.user.roles) {
        const roles = Array.isArray(req.user.roles)
          ? req.user.roles
          : [req.user.roles];
        userRoles = [...userRoles, ...roles];
      }

      // If user already has any allowed role, skip extra lookups
      const alreadyAllowed = flatRoles.some((role) => userRoles.includes(role));
      if (alreadyAllowed) {
        return next();
      }

      // If checking for seller role and user has a shop, treat them as seller
      if (flatRoles.includes("seller") && !userRoles.includes("seller")) {
        try {
          const Shop = require("../models/shop.model");
          const shop = await Shop.findOne({ owner: req.user.userId });
          if (shop) {
            userRoles.push("seller");
          }
        } catch (_err) {
          return sendFail(
            res,
            "Error verifying seller role",
            StatusCodes.INTERNAL_SERVER_ERROR,
          );
        }
      }

      // Check if user has one of the allowed roles
      const hasRole = flatRoles.some((role) => userRoles.includes(role));

      if (!hasRole) {
        return sendFail(
          res,
          `Access denied. Required role: ${flatRoles.join(" or ")}`,
          StatusCodes.FORBIDDEN,
        );
      }

      next();
    } catch (_error) {
      return sendFail(
        res,
        "Authorization check failed",
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  };
};

module.exports = {
  verifyAccessToken,
  optionalAuth,
  requireRole,
};
