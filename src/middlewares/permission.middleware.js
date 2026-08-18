const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('./errorHandler.middleware');
const permissionService = require('../services/permission.service');
const logger = require('../utils/logger');
const { sendFail } = require('../shared/res/formatResponse');

// Giới hạn thời gian chờ bước lookup quyền tươi từ DB/Redis. Nếu Redis/DB chậm hoặc treo,
// không thể chặn toàn bộ request authorization — sau khoảng này ta fallback về quyền JWT.
const FRESHNESS_TIMEOUT_MS = Number(process.env.PERMISSION_LOOKUP_TIMEOUT_MS) || 1200;

/**
 * Race một promise với timeout. setInterval được clear khi có kết quả; Promise.race đã gắn
 * handler cho cả 2 nhánh nên promise chậm (nếu reject sau đó) không gây unhandledRejection.
 * @param {Promise<any>} promise
 * @param {number} ms
 * @param {string} tag
 * @returns {Promise<any>}
 */
const withTimeout = (promise, ms, tag) => {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${tag} timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
};

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

      // Ưu tiên đọc quyền tươi từ DB (cache 30s). Nếu lookup thất bại (null)
      // hoặc throw (Redis/DB sập, id không hợp lệ), fallback về quyền resolve
      // từ JWT claims để request không bị 500 hàng loạt. Fallback CHỈ dùng
      // nguyên bộ hiệu lực (role + permissions) chứ KHÔNG bỏ qua kiểm tra.
      let freshPermissions = null;
      try {
        freshPermissions = await withTimeout(
          permissionService.getEffectivePermissionsByUserId(userId),
          FRESHNESS_TIMEOUT_MS,
          'permission lookup',
        );
      } catch (error) {
        logger.warn('Permission freshness lookup failed, falling back to JWT claims', {
          name: error?.name,
          message: error?.message,
        });
      }

      const effectivePermissions =
        freshPermissions ?? permissionService.getUserPermissions(req.user);
      const userWithEffectivePermissions = { ...req.user, permissions: effectivePermissions };

      let hasPermission;
      if (mode === 'any') {
        hasPermission = permissionService.hasAnyPermission(userWithEffectivePermissions, permissions);
      } else {
        hasPermission = permissionService.hasAllPermissions(userWithEffectivePermissions, permissions);
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
