const Joi = require('joi');
const { objectId } = require('./common.validator');

module.exports = {
  createPaymentValidator: Joi.object({
    orderId: objectId.required(),
  }),
  paymentOrderIdParamValidator: Joi.object({
    orderId: objectId.required(),
  }),
};
