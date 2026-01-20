const Joi = require("joi");
const { objectId, pagination } = require("./common.validator");

module.exports = {
  userIdParamValidator: Joi.object({ userId: objectId.required() }),
  updatePermissionsValidator: Joi.object({
    permissions: Joi.array().items(Joi.string().min(1)).required(),
  }),
  grantRevokePermissionValidator: Joi.object({
    permission: Joi.string().min(1).required(),
  }),
  auditLogsQueryValidator: Joi.object({
    ...pagination,
    userId: objectId,
    action: Joi.string().valid("grant", "revoke", "bulk_update"),
  }),
};
