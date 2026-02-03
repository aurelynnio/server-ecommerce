/**
 * Permission Routes
 * API endpoints for permission management
 */

const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permission.controller");
const {
  verifyAccessToken,
  requireRole,
} = require("../middlewares/auth.middleware");

const validate = require("../middlewares/validate.middleware");

const {
  userIdParamValidator,
  updatePermissionsValidator,
  grantRevokePermissionValidator,
  auditLogsQueryValidator,
} = require("../validations/permission.validator");
/**
 * Public Routes
 */
/**
 * @desc Get all available permissions
 * @accessPublic
 */

router.get("/", permissionController.getAllPermissions);
/**
 * @desc Get default permissions for each role
 * @accessPublic
 */

router.get("/roles", permissionController.getRolePermissions);
/**
 * Protected Routes (Authenticated users)
 */
/**
 * @desc Get current user's effective permissions
 * @accessPrivate (Authenticated users)
 */

router.get("/me", verifyAccessToken, permissionController.getMyPermissions);
/**
 * Admin Routes
 */
/**
 * @desc Get permission audit logs
 * @accessPrivate (Admin only)
 * @query   { page, limit, userId, action }
 */

router.get(
  "/audit",
  verifyAccessToken,
  requireRole("admin"),
  validate({ query: auditLogsQueryValidator }),
  permissionController.getAuditLogs,
);
/**
 * @desc Get specific user's permissions
 * @accessPrivate (Admin only)
 * @param   userId - User ID
 */

router.get(
  "/user/:userId",
  verifyAccessToken,
  requireRole("admin"),
  validate({ params: userIdParamValidator }),
  permissionController.getUserPermissions,
);
/**
 * @desc Update user's permissions
 * @accessPrivate (Admin only)
 * @param   userId - User ID
 * @body    { permissions: string[] }
 */

router.put(
  "/user/:userId",
  verifyAccessToken,
  requireRole("admin"),
  validate({ params: userIdParamValidator, body: updatePermissionsValidator }),
  permissionController.updateUserPermissions,
);
/**
 * @desc Grant single permission to user
 * @accessPrivate (Admin only)
 * @param   userId - User ID
 * @body    { permission: string }
 */

router.post(
  "/user/:userId/grant",
  verifyAccessToken,
  requireRole("admin"),
  validate({
    params: userIdParamValidator,
    body: grantRevokePermissionValidator,
  }),
  permissionController.grantPermission,
);
/**
 * @desc Revoke single permission from user
 * @accessPrivate (Admin only)
 * @param   userId - User ID
 * @body    { permission: string }
 */

router.post(
  "/user/:userId/revoke",
  verifyAccessToken,
  requireRole("admin"),
  validate({
    params: userIdParamValidator,
    body: grantRevokePermissionValidator,
  }),
  permissionController.revokePermission,
);

module.exports = router;
