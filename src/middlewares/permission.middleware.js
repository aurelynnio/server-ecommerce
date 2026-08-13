const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('./errorHandler.middleware');
const permissionService = require('../services/permission.service');
const logger = require('../utils/logger');
const { sendFail } = require('../shared/res/formatResponse');

/**
 * Require permission
 * @param {any} requiredPermissions
 * @param {Object} options
 * @returns {any}
 */
const requirePermission = (requiredPermissions, options = { mode: 'all' }) => {
  const permissions = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];
  const mode = options?.mode === 'any' ? 'any' : 'all';

  return async (req, res, next) => {
    try {
      if (!req.user) {
        return sendFail(res, 'Authentication required', StatusCodes.UNAUTHORIZED);
      }

      const userId = req.user?._id || req.user?.userId;

      // Fetch fresh permissions from DB (cached briefly) instead of trusting
      // the possibly-stale permissions embedded in the JWT.
      const freshPermissions = await permissionService.getEffectivePermissionsByUserId(userId);
      const userWithFreshPermissions = { ...req.user, permissions: freshPermissions };

      let hasPermission;
      if (mode === 'any') {
        hasPermission = permissionService.hasAnyPermission(userWithFreshPermissions, permissions);
      } else {
        hasPermission = permissionService.hasAllPermissions(userWithFreshPermissions, permissions);
      }

      if (!hasPermission) {
        return sendFail(
          res,
          `Access denied. Required permission: ${permissions.join(', ')}`,
          StatusCodes.FORBIDDEN,
        );
      }

      return next();
    } catch (error) {
      logger.error('Permission check error', {
        name: error.name,
        message: error.message,
      });
      return next(new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Permission check failed'));
    }
  };
};

const requireAdminAccess = requirePermission('admin:access');
const requireSellerAccess = requirePermission('seller:access');

module.exports = {
  requirePermission,
  requireAdminAccess,
  requireSellerAccess,
};
