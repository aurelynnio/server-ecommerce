const { StatusCodes } = require("http-status-codes");
const { sendSuccess, sendFail } = require("../shared/res/formatResponse");
const permissionService = require("../services/permission.service");
const {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getAllPermissionsList,
  getPermissionsByResource,
  isValidPermission,
} = require("../configs/permission");
const logger = require("../utils/logger");

class PermissionController {
  async getAllPermissions(req, res) {
    try {
      const permissions = getAllPermissionsList();
      const groupedPermissions = getPermissionsByResource();

      return sendSuccess(
        res,
        {
          permissions,
          grouped: groupedPermissions,
          total: permissions.length,
        },
        "Permissions retrieved successfully",
      );
    } catch (error) {
      logger.error("Get all permissions error:", { error: error.message });
      return sendFail(res, error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async getRolePermissions(req, res) {
    try {
      return sendSuccess(
        res,
        { rolePermissions: ROLE_PERMISSIONS },
        "Role permissions retrieved successfully",
      );
    } catch (error) {
      logger.error("Get role permissions error:", { error: error.message });
      return sendFail(res, error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async getMyPermissions(req, res) {
    try {
      const permissions = permissionService.getUserPermissions(req.user);

      return sendSuccess(
        res,
        {
          permissions,
          role: req.user.roles || req.user.role,
          userSpecificPermissions: req.user.permissions || [],
        },
        "Your permissions retrieved successfully",
      );
    } catch (error) {
      logger.error("Get my permissions error:", { error: error.message });
      return sendFail(res, error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async getUserPermissions(req, res) {
    try {
      const { userId } = req.params;

      const result = await permissionService.getUserPermissionsSummary(userId);

      return sendSuccess(
        res,
        result,
        "User permissions retrieved successfully",
      );
    } catch (error) {
      logger.error("Get user permissions error:", { error: error.message });
      return sendFail(res, error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }

  async updateUserPermissions(req, res) {
    try {
      const { userId } = req.params;
      const { permissions } = req.body;

      if (!Array.isArray(permissions)) {
        return sendFail(
          res,
          "Permissions must be an array",
          StatusCodes.BAD_REQUEST,
        );
      }

      const invalidPerms = permissions.filter(
        (p) => !isValidPermission(p) && !p.startsWith("-"),
      );
      if (invalidPerms.length > 0) {
        return sendFail(
          res,
          `Invalid permissions: ${invalidPerms.join(", ")}`,
          StatusCodes.BAD_REQUEST,
        );
      }

      const adminId = req.user._id || req.user.userId;
      const user = await permissionService.updateUserPermissions(
        userId,
        permissions,
        adminId,
      );

      return sendSuccess(
        res,
        {
          user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            roles: user.roles,
            permissions: user.permissions,
          },
        },
        "User permissions updated successfully",
      );
    } catch (error) {
      logger.error("Update user permissions error:", { error: error.message });
      return sendFail(res, error.message, StatusCodes.BAD_REQUEST);
    }
  }

  async grantPermission(req, res) {
    try {
      const { userId } = req.params;
      const { permission } = req.body;

      if (!permission) {
        return sendFail(res, "Permission is required", StatusCodes.BAD_REQUEST);
      }

      const adminId = req.user._id || req.user.userId;
      const user = await permissionService.grantPermission(
        userId,
        permission,
        adminId,
      );

      return sendSuccess(
        res,
        {
          user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            permissions: user.permissions,
          },
        },
        "Permission granted successfully",
      );
    } catch (error) {
      logger.error("Grant permission error:", { error: error.message });
      return sendFail(res, error.message, StatusCodes.BAD_REQUEST);
    }
  }

  async revokePermission(req, res) {
    try {
      const { userId } = req.params;
      const { permission } = req.body;

      if (!permission) {
        return sendFail(res, "Permission is required", StatusCodes.BAD_REQUEST);
      }

      const adminId = req.user._id || req.user.userId;
      const user = await permissionService.revokePermission(
        userId,
        permission,
        adminId,
      );

      return sendSuccess(
        res,
        {
          user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            permissions: user.permissions,
          },
        },
        "Permission revoked successfully",
      );
    } catch (error) {
      logger.error("Revoke permission error:", { error: error.message });
      return sendFail(res, error.message, StatusCodes.BAD_REQUEST);
    }
  }

  async getAuditLogs(req, res) {
    try {
      const { page = 1, limit = 20, userId, action } = req.query;

      const result = await permissionService.getAuditLogs({
        page: parseInt(page),
        limit: parseInt(limit),
        userId,
        action,
      });

      return sendSuccess(res, result, "Audit logs retrieved successfully");
    } catch (error) {
      logger.error("Get audit logs error:", { error: error.message });
      return sendFail(res, error.message, StatusCodes.INTERNAL_SERVER_ERROR);
    }
  }
}

module.exports = new PermissionController();
