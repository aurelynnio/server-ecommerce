const { StatusCodes } = require('http-status-codes');
const catchAsync = require('../configs/catchAsync');
const { sendSuccess, sendFail } = require('../shared/res/formatResponse');
const permissionService = require('../services/permission.service');
const {
  ROLE_PERMISSIONS,
  getAllPermissionsList,
  getPermissionsByResource,
  isValidPermission,
} = require('../configs/permission');

const getAdminId = (user) => user._id || user.userId;

const mapUserResponse = (user) => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  roles: user.roles,
  permissions: user.permissions,
});

const parsePagination = (query) => ({
  page: Number.parseInt(query.page, 10) || 1,
  limit: Number.parseInt(query.limit, 10) || 20,
  userId: query.userId,
  action: query.action,
});

const PermissionController = {
  getAllPermissions: catchAsync(async (_req, res) => {
    const permissions = getAllPermissionsList();
    const groupedPermissions = getPermissionsByResource();

    return sendSuccess(
      res,
      {
        permissions,
        grouped: groupedPermissions,
        total: permissions.length,
      },
      'Permissions retrieved successfully',
    );
  }),

  getRolePermissions: catchAsync(async (_req, res) => {
    return sendSuccess(
      res,
      { rolePermissions: ROLE_PERMISSIONS },
      'Role permissions retrieved successfully',
    );
  }),

  getMyPermissions: catchAsync(async (req, res) => {
    const permissions = permissionService.getUserPermissions(req.user);

    return sendSuccess(
      res,
      {
        permissions,
        role: req.user.roles || req.user.role,
        userSpecificPermissions: req.user.permissions || [],
      },
      'Your permissions retrieved successfully',
    );
  }),

  getUserPermissions: catchAsync(async (req, res) => {
    const { userId } = req.params;
    const result = await permissionService.getUserPermissionsSummary(userId);

    return sendSuccess(res, result, 'User permissions retrieved successfully');
  }),

  updateUserPermissions: catchAsync(async (req, res) => {
    const { userId } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return sendFail(res, 'Permissions must be an array', StatusCodes.BAD_REQUEST);
    }

    const invalidPerms = permissions.filter(
      (permission) => !isValidPermission(permission) && !permission.startsWith('-'),
    );
    if (invalidPerms.length > 0) {
      return sendFail(
        res,
        `Invalid permissions: ${invalidPerms.join(', ')}`,
        StatusCodes.BAD_REQUEST,
      );
    }

    const user = await permissionService.updateUserPermissions(
      userId,
      permissions,
      getAdminId(req.user),
    );

    return sendSuccess(
      res,
      { user: mapUserResponse(user) },
      'User permissions updated successfully',
    );
  }),

  grantPermission: catchAsync(async (req, res) => {
    const { userId } = req.params;
    const { permission } = req.body;

    if (!permission) {
      return sendFail(res, 'Permission is required', StatusCodes.BAD_REQUEST);
    }

    const user = await permissionService.grantPermission(userId, permission, getAdminId(req.user));

    return sendSuccess(res, { user: mapUserResponse(user) }, 'Permission granted successfully');
  }),

  revokePermission: catchAsync(async (req, res) => {
    const { userId } = req.params;
    const { permission } = req.body;

    if (!permission) {
      return sendFail(res, 'Permission is required', StatusCodes.BAD_REQUEST);
    }

    const user = await permissionService.revokePermission(userId, permission, getAdminId(req.user));

    return sendSuccess(res, { user: mapUserResponse(user) }, 'Permission revoked successfully');
  }),

  getAuditLogs: catchAsync(async (req, res) => {
    const result = await permissionService.getAuditLogs(parsePagination(req.query));
    return sendSuccess(res, result, 'Audit logs retrieved successfully');
  }),
};

module.exports = PermissionController;
