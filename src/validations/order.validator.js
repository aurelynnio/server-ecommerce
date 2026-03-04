const Joi = require('joi');
const { objectId, pagination } = require('./common.validator');
const { sanitizedString } = require('./sanitize');

const shippingAddressSchema = Joi.object({
  fullName: sanitizedString().min(2).max(100).required(),
  phone: Joi.string()
    .pattern(/^[0-9]{10,11}$/)
    .required(),
  address: sanitizedString().min(5).required(),
  city: sanitizedString().required(),
  district: sanitizedString().allow(''),
  ward: sanitizedString().allow(''),
  note: sanitizedString().allow(''),
});

const createOrderValidator = Joi.object({
  cartItemIds: Joi.array().items(objectId).min(1).required(),
  shippingAddress: shippingAddressSchema.required(),
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
