const Joi = require('joi');
const { objectId } = require('./common.validator');

const startConversationValidator = Joi.object({
  shopId: objectId.required(),
  productId: objectId.optional(),
  message: Joi.string().optional(),
});

const sendMessageValidator = Joi.object({
  conversationId: objectId.required(),
  content: Joi.string().required(),
  attachments: Joi.array().items(Joi.string()).optional(),
  messageType: Joi.string().valid('text', 'image', 'product').default('text'),
  productRef: objectId.optional(),
});

module.exports = {
  startConversationValidator,
  sendMessageValidator,
};
