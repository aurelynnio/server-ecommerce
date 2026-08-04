const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('../middlewares/errorHandler.middleware');

const COOKIE_NAME = 'chatSessionToken';
const TOKEN_PURPOSE = 'chat-session';
const TOKEN_TTL = '7d';
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const getSecret = () => {
  const secret = process.env.CHAT_SESSION_SECRET || process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Chat session is not configured');
  }
  return secret;
};

const createSessionId = () => crypto.randomUUID();

const signChatSession = (sessionId) =>
  jwt.sign({ sessionId, purpose: TOKEN_PURPOSE }, getSecret(), { expiresIn: TOKEN_TTL });

const verifyChatSession = (token) => {
  try {
    const payload = jwt.verify(token, getSecret());
    if (payload.purpose !== TOKEN_PURPOSE || !payload.sessionId) {
      throw new Error('Invalid chat session');
    }
    return payload.sessionId;
  } catch (_error) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Invalid or expired chat session');
  }
};

const setChatSessionCookie = (res, sessionId) => {
  res.cookie(COOKIE_NAME, signChatSession(sessionId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_MAX_AGE_MS,
  });
};

module.exports = {
  COOKIE_NAME,
  createSessionId,
  verifyChatSession,
  setChatSessionCookie,
};
