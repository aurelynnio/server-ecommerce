const jwt = require("jsonwebtoken");

/**
 * Service handling JWT token generation
 */
class TokenService {
  /**
   * Generate a refresh token
   * @param {Object} payload - Data to encode in the token
   * @returns {string} Signed JWT refresh token
   */
  generateRefreshToken(payload) {
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
    });
    return refreshToken;
  }

  /**
   * Generate an access token
   * @param {Object} payload - Data to encode in the token
   * @returns {string} Signed JWT access token
   */
  generateAccessToken(payload) {
    const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
    });
    return accessToken;
  }
}

module.exports = new TokenService();
