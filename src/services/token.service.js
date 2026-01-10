const jwt = require("jsonwebtoken");
const permissionService = require("./permission.service");

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

  /**
   * Generate an access token with permissions included
   * @param {Object} user - User document or user object
   * @returns {string} Signed JWT access token with permissions
   */
  generateAccessTokenWithPermissions(user) {
    const permissions = permissionService.getUserPermissions(user);
    
    const payload = {
      userId: user._id || user.userId,
      username: user.username,
      email: user.email,
      role: user.roles || user.role,
      permissions: permissions,
    };

    return this.generateAccessToken(payload);
  }

  /**
   * Generate both access and refresh tokens with permissions
   * @param {Object} user - User document
   * @returns {Object} Object containing accessToken and refreshToken
   */
  generateTokensWithPermissions(user) {
    const permissions = permissionService.getUserPermissions(user);
    
    const payload = {
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.roles,
      permissions: permissions,
    };

    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken({ userId: user._id }),
    };
  }
}

module.exports = new TokenService();
