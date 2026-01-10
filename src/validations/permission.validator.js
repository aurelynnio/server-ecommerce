/**
 * Permission Validators
 * Joi validation schemas for permission API endpoints
 */

const Joi = require('joi');

/**
 * Validate MongoDB ObjectId in params
 */
const userIdParamValidator = Joi.object({
  userId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid user ID format',
      'any.required': 'User ID is required',
    }),
});

/**
 * Validate permissions array for bulk update
 */
const updatePermissionsValidator = Joi.object({
  permissions: Joi.array()
    .items(Joi.string().min(1))
    .required()
    .messages({
      'array.base': 'Permissions must be an array',
      'any.required': 'Permissions array is required',
    }),
});

/**
 * Validate single permission for grant/revoke
 */
const grantRevokePermissionValidator = Joi.object({
  permission: Joi.string()
    .min(1)
    .required()
    .messages({
      'string.empty': 'Permission cannot be empty',
      'any.required': 'Permission is required',
    }),
});

/**
 * Validate audit logs query parameters
 */
const auditLogsQueryValidator = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  userId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
  action: Joi.string().valid('grant', 'revoke', 'bulk_update').optional(),
});

module.exports = {
  userIdParamValidator,
  updatePermissionsValidator,
  grantRevokePermissionValidator,
  auditLogsQueryValidator,
};
