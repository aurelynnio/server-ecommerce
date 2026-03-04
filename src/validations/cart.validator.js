const Joi = require('joi');
const { objectId } = require('./common.validator');

const addToCartValidator = Joi.object({
  productId: objectId.required(),
  shopId: objectId,
  modelId: objectId.allow('', null),
  variantId: objectId.allow('', null),
  size: Joi.string().max(20).allow('', null),
  quantity: Joi.number().integer().min(1).max(99).required(),
});

const updateCartItemValidator = Joi.object({
  quantity: Joi.number().integer().min(1).required(),
});

const cartItemIdValidator = Joi.object({
  itemId: objectId.required(),
});

module.exports = {
  addToCartValidator,
  updateCartItemValidator,
  cartItemIdValidator,
};
