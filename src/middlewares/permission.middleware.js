const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("./errorHandler.middleware");
const permissionService = require("../services/permission.service");
const logger = require("../utils/logger");
const { sendFail } = require("../shared/res/formatResponse");

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
  const mode = options?.mode === "any" ? "any" : "all";

  return (req, res, next) => {
    try {
      if (!req.user) {
        return sendFail(
          res,
          "Authentication required",
          StatusCodes.UNAUTHORIZED,
        );
      }

      let hasPermission;
      if (mode === "any") {
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
        return sendFail(
          res,
          `Access denied. Required permission: ${permissions.join(", ")}`,
          StatusCodes.FORBIDDEN,
        );
      }

      return next();
    } catch (error) {
      logger.error("Permission check error", {
        name: error.name,
        message: error.message,
      });
      return next(
        new ApiError(
          StatusCodes.INTERNAL_SERVER_ERROR,
          "Permission check failed",
        ),
      );
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

