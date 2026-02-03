const Joi = require("joi");
const { objectId, pagination } = require("./common.validator");

const userIdParamValidator = Joi.object({ userId: objectId.required() });

const updatePermissionsValidator = Joi.object({
  permissions: Joi.array().items(Joi.string().min(1)).required(),
});

const grantRevokePermissionValidator = Joi.object({
  permission: Joi.string().min(1).required(),
});

const auditLogsQueryValidator = Joi.object({
  ...pagination,
  userId: objectId,
  action: Joi.string().valid("grant", "revoke", "bulk_update"),
});

module.exports = {
  userIdParamValidator,
  updatePermissionsValidator,
  grantRevokePermissionValidator,
  auditLogsQueryValidator,
};
