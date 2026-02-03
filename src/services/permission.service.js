const User = require("../models/user.model");
const PermissionAudit = require("../models/permission-audit.model");
const {
  ROLE_PERMISSIONS,
  getAllPermissionsList,
  isValidPermission,
  expandManagePermissions,
} = require("../configs/permission");
const logger = require("../utils/logger");
const { StatusCodes } = require("http-status-codes");
const { ApiError } = require("../middlewares/errorHandler.middleware");
const { getPaginationParams, buildPaginationResponse } = require("../utils/pagination");

class PermissionService {
  /**
   * Get user permissions
   * @param {any} user
   * @returns {any}
   */
  getUserPermissions(user) {
    if (!user) return [];

    const role = user.roles || user.role;
    const rolePermissions = ROLE_PERMISSIONS[role] || [];
    const userPermissions = user.permissions || [];

    if (rolePermissions.includes("*")) {
      return this.getAllPermissions();
    }

    const combined = new Set([...rolePermissions, ...userPermissions]);

    const positivePerms = [...combined].filter((p) => !p.startsWith("-"));
    const negativePerms = [...combined]
      .filter((p) => p.startsWith("-"))
      .map((p) => p.substring(1));

    const finalPerms = positivePerms.filter((p) => !negativePerms.includes(p));

    return expandManagePermissions(finalPerms);

  }

  /**
   * Get all permissions
   * @returns {any}
   */
  getAllPermissions() {
    return getAllPermissionsList();
  }

  /**
   * Has permission
   * @param {any} user
   * @param {any} permission
   * @returns {boolean}
   */
  hasPermission(user, permission) {

    if (!user || !permission) return false;

    const permissions = this.getUserPermissions(user);

    if (permissions.includes("*")) return true;
    if (permissions.includes(permission)) return true;
    const [resource] = permission.split(":");
    if (permissions.includes(`${resource}:manage`)) return true;

    return false;

  }

  /**
   * Has any permission
   * @param {any} user
   * @param {Array} permissions
   * @returns {boolean}
   */
  hasAnyPermission(user, permissions) {

    if (!user || !permissions || permissions.length === 0) return false;
    return permissions.some((p) => this.hasPermission(user, p));
  }

  /**
   * Has all permissions
   * @param {any} user
   * @param {Array} permissions
   * @returns {boolean}
   */
  hasAllPermissions(user, permissions) {

    if (!user || !permissions || permissions.length === 0) return false;
    return permissions.every((p) => this.hasPermission(user, p));
  }

  /**
   * Grant permission
   * @param {string} userId
   * @param {any} permission
   * @param {string} adminId
   * @returns {Promise<any>}
   */
  async grantPermission(userId, permission, adminId) {
    if (!isValidPermission(permission)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, `Invalid permission: ${permission}`);
    }



    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    if (user.permissions.includes(permission)) {
      throw new ApiError(StatusCodes.CONFLICT, "Permission already granted");
    }

    user.permissions.push(permission);
    await user.save();

    await this.logAudit("grant", adminId, userId, permission);

    return user;

  }

  /**
   * Revoke permission
   * @param {string} userId
   * @param {any} permission
   * @param {string} adminId
   * @returns {Promise<any>}
   */
  async revokePermission(userId, permission, adminId) {

    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    const permIndex = user.permissions.indexOf(permission);
    if (permIndex === -1) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Permission not found on user");
    }

    user.permissions.splice(permIndex, 1);
    await user.save();

    await this.logAudit("revoke", adminId, userId, permission);

    return user;

  }

  /**
   * Update user permissions
   * @param {string} userId
   * @param {Array} permissions
   * @param {string} adminId
   * @returns {Promise<any>}
   */
  async updateUserPermissions(userId, permissions, adminId) {
    const invalidPerms = permissions.filter(
      (p) => !isValidPermission(p) && !p.startsWith("-"),
    );

    if (invalidPerms.length > 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Invalid permissions: ${invalidPerms.join(", ")}`
      );
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { permissions },
      { new: true },
    );


    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }


    await this.logBulkUpdate(adminId, userId, permissions);


    return user;
  }

  /**
   * Log audit
   * @param {any} action
   * @param {string} adminId
   * @param {string} targetUserId
   * @param {any} permission
   * @returns {Promise<any>}
   */
  async logAudit(action, adminId, targetUserId, permission) {
    try {
      await PermissionAudit.create({
        action,
        adminId,
        targetUserId,
        permission,
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error("Failed to log permission audit:", { error: error.message });
    }
  }

  /**
   * Log bulk update
   * @param {string} adminId
   * @param {string} targetUserId
   * @param {Array} permissions
   * @returns {Promise<any>}
   */
  async logBulkUpdate(adminId, targetUserId, permissions) {
    try {
      await PermissionAudit.create({
        action: "bulk_update",
        adminId,
        targetUserId,
        permission: JSON.stringify(permissions),
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error("Failed to log bulk permission update:", {
        error: error.message,
      });
    }
  }

  /**
   * Get user permissions summary
   * @param {string} userId
   * @returns {Promise<any>}
   */
  async getUserPermissionsSummary(userId) {
    const user = await User.findById(userId).select("-password");
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User not found");
    }

    const effectivePermissions = this.getUserPermissions(user);
    const rolePermissions = ROLE_PERMISSIONS[user.roles] || [];

    return {
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        roles: user.roles,
      },
      effectivePermissions,
      userPermissions: user.permissions || [],
      rolePermissions,
    };
  }

  /**
   * Get audit logs
   * @param {Object} options
   * @returns {Promise<any>}
   */
  async getAuditLogs({ page = 1, limit = 20, userId, action }) {
    try {
      const query = {};
      if (userId) query.targetUserId = userId;
      if (action) query.action = action;

      const total = await PermissionAudit.countDocuments(query);
      const paginationParams = getPaginationParams(page, limit, total);

      const logs = await PermissionAudit.find(query)
        .sort({ timestamp: -1 })
        .skip(paginationParams.skip)
        .limit(paginationParams.limit)
        .populate("adminId", "username email")
        .populate("targetUserId", "username email");

      return buildPaginationResponse(logs, paginationParams);
    } catch (error) {
      logger.error("Failed to get audit logs:", { error: error.message });
      return buildPaginationResponse([], getPaginationParams(page, limit, 0));
    }
  }
}


module.exports = new PermissionService();
