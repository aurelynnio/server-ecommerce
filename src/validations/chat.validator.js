const joi = require("joi");

const startConversationValidator = joi.object({
  shopId: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required(),
  productId: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional(),
});

const sendMessageValidator = joi.object({
  conversationId: joi
    .string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required(),
  content: joi.string().required(),
  attachments: joi.array().items(joi.string()).optional(),
});

module.exports = {
  startConversationValidator,
  sendMessageValidator,
};
