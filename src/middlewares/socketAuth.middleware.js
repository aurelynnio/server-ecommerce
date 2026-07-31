const cookie = require('cookie');
const logger = require('../utils/logger');
const tokenService = require('../services/token.service');

/**
 * Socket auth middleware
 * @param {any} socket
 * @param {Function} next
 * @returns {any}
 */
const socketAuthMiddleware = (socket, next) => {
  try {
    // 1. Lấy token từ cookie (cookie-only auth)
    let token = null;

    if (socket.handshake.headers.cookie) {
      const cookies = cookie.parse(socket.handshake.headers.cookie);
      token = cookies.accessToken;
    }

    if (!token) {
      return next(new Error('Authentication error: Token not found'));
    }

    const decoded = tokenService.verifyAccessToken(token);

    socket.user = {
      id: decoded.userId, // Đảm bảo khớp với payload trong auth.service
      role: decoded.role,
    };

    next();
  } catch (error) {
    logger.error('Socket Auth Error:', { error: error.message });
    next(new Error('Authentication error: Invalid token'));
  }
};

module.exports = socketAuthMiddleware;
