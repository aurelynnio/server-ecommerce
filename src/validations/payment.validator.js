const Joi = require('joi');
const { objectId } = require('./common.validator');

module.exports = {
  createPaymentValidator: Joi.object({
    orderId: objectId,
    orderGroupId: objectId,
  }).xor('orderId', 'orderGroupId'),
  paymentOrderIdParamValidator: Joi.object({
    orderId: objectId.required(),
  }),
  paymentOrderGroupIdParamValidator: Joi.object({
    orderGroupId: objectId.required(),
  }),
};
