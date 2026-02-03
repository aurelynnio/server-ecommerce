const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("./errorHandler.middleware");
const permissionService = require("../services/permission.service");
const logger = require("../utils/logger");

/**
 * Require permission
 * @param {any} requiredPermissions
 * @param {Object} options
 * @returns {any}
 */
const requirePermission = (requiredPermissions, options = { mode: "all" }) => {
  const permissions = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];

  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, "Authentication required");
      }

      let hasPermission;
      if (options.mode === "any") {
        hasPermission = permissionService.hasAnyPermission(
          req.user,
          permissions,
        );
      } else {
        hasPermission = permissionService.hasAllPermissions(
          req.user,
          permissions,
        );
      }

      if (!hasPermission) {
        throw new ApiError(
          StatusCodes.FORBIDDEN,
          `Access denied. Required permission: ${permissions.join(", ")}`,
        );
      }

      next();
    } catch (error) {
      logger.error("Permission check error:", { error });
      next(error);
    }
  };
};

const requireAdminAccess = requirePermission("admin:access");
const requireSellerAccess = requirePermission("seller:access");

module.exports = {
  requirePermission,
  requireAdminAccess,
  requireSellerAccess,
};

