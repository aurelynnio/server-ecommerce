const cookie = require("cookie");
const logger = require("../utils/logger");
const tokenService = require("../services/token.service");


/**
 * Socket auth middleware
 * @param {any} socket
 * @param {Function} next
 * @returns {any}
 */
const socketAuthMiddleware = (socket, next) => {
  try {
    // 1. Lấy token từ cookie hoặc header
    let token = null;

    // Thử lấy từ cookie (nếu client gửi cookie)
    if (socket.handshake.headers.cookie) {
      const cookies = cookie.parse(socket.handshake.headers.cookie);
      token = cookies.accessToken;
    }

    // Nếu không có cookie, thử lấy từ auth header (Bearer token)
    if (!token && socket.handshake.auth?.token) {
      token = socket.handshake.auth.token;
    }

    if (!token) {
      return next(new Error("Authentication error: Token not found"));
    }

    // 2. Verify token
    const decoded = tokenService.verifyAccessToken(token);


    // 3. Lưu thông tin user vào socket để dùng sau này
    socket.user = {
      id: decoded.userId, // Đảm bảo khớp với payload trong auth.service
      role: decoded.role,
    };

    next();
  } catch (error) {
    logger.error("Socket Auth Error:", { error: error.message });
    next(new Error("Authentication error: Invalid token"));
  }
};

module.exports = socketAuthMiddleware;
