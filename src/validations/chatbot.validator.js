const Joi = require('joi');
const { chatSanitizedString } = require('./sanitize');

const sessionId = Joi.string()
  .uuid({ version: ['uuidv4'] })
  .allow(null, '');

const chatMessageValidator = Joi.object({
  message: chatSanitizedString().min(1).max(2000).required(),
  sessionId,
});

const feedbackValidator = Joi.object({
  sessionId: Joi.string().uuid({ version: ['uuidv4'] }).required(),
  messageId: Joi.string().trim().min(1).max(100).required(),
  rating: Joi.string().valid('up', 'down').required(),
  comment: Joi.string().max(500).allow('').optional(),
});

const sessionIdParamValidator = Joi.object({
  sessionId: Joi.string().uuid({ version: ['uuidv4'] }).required(),
});

module.exports = {
  chatMessageValidator,
  feedbackValidator,
  sessionIdParamValidator,
};
