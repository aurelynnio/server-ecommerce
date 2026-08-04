const Joi = require('joi');
const { sanitizedString } = require('./sanitize');

const sessionId = Joi.string().uuid({ version: ['uuidv4'] });

const chatMessageValidator = Joi.object({
  message: sanitizedString().min(1).max(2000).required(),
  sessionId,
});

const sessionIdParamValidator = Joi.object({
  sessionId: sessionId.required(),
});

module.exports = {
  chatMessageValidator,
  sessionIdParamValidator,
};
