/**
 * Permission Middleware
 * Middleware functions for checking user permissions on API endpoints
 */

const { StatusCodes } = require('http-status-codes');
const { sendFail } = require('../shared/res/formatResponse');
const permissionService = require('../services/permission.service');

/**
 * Middleware to check if user has required permission(s)
 * @param {string|string[]} requiredPermissions - Single permission or array of permissions
 * @param {Object} options - Options for permission checking
 * @param {string} options.mode - 'all' (AND logic) or 'any' (OR logic), default: 'all'
 * @returns {Function} Express middleware function
 */
const requirePermission = (requiredPermissions, options = { mode: 'all' }) => {
  // Normalize to array
  const permissions = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];

  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return sendFail(
          res,
          'Authentication required',
          StatusCodes.UNAUTHORIZED
        );
      }

      // Check permissions based on mode
      let hasPermission;
      if (options.mode === 'any') {
        hasPermission = permissionService.hasAnyPermission(req.user, permissions);
      } else {
        hasPermission = permissionService.hasAllPermissions(req.user, permissions);
      }

      if (!hasPermission) {
        return sendFail(
          res,
          `Access denied. Required permission: ${permissions.join(', ')}`,
          StatusCodes.FORBIDDEN
        );
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return sendFail(
        res,
        'Permission check failed',
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };
};

/**
 * Middleware to check permission with ownership verification
 * Combines permission check with ownership verification for resource-specific access
 * @param {string} permission - Required permission
 * @param {Function} ownershipCheck - Async function that returns boolean for ownership
 * @returns {Function} Express middleware function
 */
const requirePermissionWithOwnership = (permission, ownershipCheck) => {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return sendFail(
          res,
          'Authentication required',
          StatusCodes.UNAUTHORIZED
        );
      }

      // Admin bypasses ownership check
      const role = req.user.roles || req.user.role;
      if (role === 'admin') {
        // Admin still needs the permission
        if (!permissionService.hasPermission(req.user, permission)) {
          return sendFail(
            res,
            `Access denied. Required permission: ${permission}`,
            StatusCodes.FORBIDDEN
          );
        }
        return next();
      }

      // Check permission first
      if (!permissionService.hasPermission(req.user, permission)) {
        return sendFail(
          res,
          `Access denied. Required permission: ${permission}`,
          StatusCodes.FORBIDDEN
        );
      }

      // Check ownership for non-admin users
      const isOwner = await ownershipCheck(req);
      if (!isOwner) {
        return sendFail(
          res,
          'You can only access your own resources',
          StatusCodes.FORBIDDEN
        );
      }

      next();
    } catch (error) {
      console.error('Permission with ownership check error:', error);
      return sendFail(
        res,
        'Permission check failed',
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  };
};

/**
 * Middleware to check if user has admin access
 * Shorthand for requirePermission('admin:access')
 */
const requireAdminAccess = requirePermission('admin:access');

/**
 * Middleware to check if user has seller access
 * Shorthand for requirePermission('seller:access')
 */
const requireSellerAccess = requirePermission('seller:access');

/**
 * Middleware to check resource-specific permission
 * @param {string} resource - Resource name (e.g., 'product', 'order')
 * @param {string} action - Action name (e.g., 'create', 'read', 'update', 'delete')
 * @returns {Function} Express middleware function
 */
const requireResourcePermission = (resource, action) => {
  return requirePermission(`${resource}:${action}`);
};

/**
 * Middleware to check if user can manage a resource (has manage or all CRUD permissions)
 * @param {string} resource - Resource name
 * @returns {Function} Express middleware function
 */
const requireResourceManage = (resource) => {
  return requirePermission(`${resource}:manage`);
};

module.exports = {
  requirePermission,
  requirePermissionWithOwnership,
  requireAdminAccess,
  requireSellerAccess,
  requireResourcePermission,
  requireResourceManage,
};
