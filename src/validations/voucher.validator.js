const Joi = require('joi');
const { objectId, pagination } = require('./common.validator');

const createVoucherValidator = Joi.object({
  code: Joi.string().min(3).uppercase().trim().required(),
  name: Joi.string().required(),
  description: Joi.string().allow(''),
  type: Joi.string().valid('fixed_amount', 'percentage').required(),
  value: Joi.number().positive().required(),
  maxValue: Joi.number().positive().allow(null),
  scope: Joi.string().valid('shop', 'platform').default('shop'),
  shopId: Joi.when('scope', {
    is: 'shop',
    then: objectId.required(),
    otherwise: objectId.optional(),
  }),
  minOrderValue: Joi.number().min(0).default(0),
  usageLimit: Joi.number().integer().min(1).default(100),
  usageLimitPerUser: Joi.number().integer().min(1).default(1),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref('startDate')).required(),
  isActive: Joi.boolean().default(true),
});

const updateVoucherValidator = createVoucherValidator.fork(
  ['code', 'name', 'type', 'value', 'startDate', 'endDate'],
  (schema) => schema.optional(),
);

const voucherIdParamValidator = Joi.object({ id: objectId.required() });
const getVouchersQueryValidator = Joi.object({
  ...pagination,
  scope: Joi.string().valid('shop', 'platform', 'all'),
  isActive: Joi.boolean(),
});

module.exports = {
  createVoucherValidator,
  updateVoucherValidator,
  voucherIdParamValidator,
  getVouchersQueryValidator,
};
