const { sendFail } = require('../shared/res/formatResponse');
const { StatusCodes } = require('http-status-codes');

const MAX_MESSAGE_LENGTH = 2000;

// Strip control chars except newline + tab, collapse blank lines, trim.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
const MULTI_NEWLINE = /\n{3,}/g;

const chatSanitize = (req, res, next) => {
  const { message } = req.body || {};

  if (typeof message !== 'string') {
    return sendFail(res, 'Message must be a string', StatusCodes.BAD_REQUEST);
  }

  let cleaned = message.replace(CONTROL_CHARS, '');
  cleaned = cleaned.replace(MULTI_NEWLINE, '\n\n').trim();

  if (cleaned.length === 0) {
    return sendFail(res, 'Message is required', StatusCodes.BAD_REQUEST);
  }

  if (cleaned.length > MAX_MESSAGE_LENGTH) {
    return sendFail(
      res,
      `Message exceeds ${MAX_MESSAGE_LENGTH} characters`,
      StatusCodes.PAYLOAD_TOO_LARGE,
    );
  }

  req.body.message = cleaned;
  return next();
};

module.exports = chatSanitize;
