const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('../middlewares/errorHandler.middleware');
const {
  COOKIE_NAME,
  createSessionId,
  verifyChatSession,
  setChatSessionCookie,
} = require('./chatSessionToken');

const resolveChatSession = (req, res, requestedSessionId) => {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    if (requestedSessionId) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Chat session ownership could not be verified');
    }

    const sessionId = createSessionId();
    setChatSessionCookie(res, sessionId);
    return sessionId;
  }

  const sessionId = verifyChatSession(token);
  if (requestedSessionId && requestedSessionId !== sessionId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Chat session ownership could not be verified');
  }
  return sessionId;
};

module.exports = { resolveChatSession };
