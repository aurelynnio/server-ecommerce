const Joi = require('joi');
const { objectId, pagination } = require('./common.validator');
const { sanitizedString } = require('./sanitize');

const createOrderValidator = Joi.object({
  cartItemIds: Joi.array().items(objectId).min(1).required(),
  addressId: objectId.required(),
  paymentMethod: Joi.string().valid('cod', 'vnpay', 'momo').default('cod'),
  platformVoucher: Joi.string().uppercase().trim().allow('', null),
  shopVouchers: Joi.array()
    .items(
      Joi.object({
        shopId: objectId.required(),
        code: Joi.string().uppercase().trim().required(),
      }),
    )
    .default([]),
  note: sanitizedString().allow(''),
});

const updateOrderStatusValidator = Joi.object({
  status: Joi.string()
    .valid('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned')
    .required(),
});

const orderIdParamValidator = Joi.object({
  orderId: objectId.required(),
});
const getOrdersQueryValidator = Joi.object({
  ...pagination,
  status: Joi.string().valid(
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'returned',
  ),
  paymentStatus: Joi.string().valid('unpaid', 'paid', 'refunded'),
  paymentMethod: Joi.string().valid('cod', 'vnpay', 'momo'),
  userId: objectId,
  shop: objectId,
});

module.exports = {
  createOrderValidator,
  updateOrderStatusValidator,
  orderIdParamValidator,
  getOrdersQueryValidator,
};
