const Joi = require('joi');
const { objectId } = require('./common.validator');

const startConversationValidator = Joi.object({
  shopId: objectId.required(),
  productId: objectId.optional(),
  message: Joi.string().optional(),
});

const sendMessageValidator = Joi.object({
  conversationId: objectId.required(),
  content: Joi.string().allow('').required(),
  attachments: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().uri().required(),
        fileName: Joi.string().required(),
        mimeType: Joi.string().allow('').optional(),
        size: Joi.number().min(0).optional(),
        resourceType: Joi.string().allow('').optional(),
      }),
    )
    .optional(),
  messageType: Joi.string().valid('text', 'image', 'file', 'product').default('text'),
  productRef: objectId.optional(),
}).custom((value, helpers) => {
  if (!value.content?.trim() && !value.attachments?.length && !value.productRef) {
    return helpers.error('any.invalid');
  }

  return value;
}, 'chat message content validation');

module.exports = {
  startConversationValidator,
  sendMessageValidator,
};
