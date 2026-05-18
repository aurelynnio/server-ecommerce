const crypto = require('crypto');
const User = require('../repositories/user.repository');
const comparePassword = require('../utils/comparePassword');
const hashPassword = require('../utils/hashPasword');
const { getIO } = require('../socket/index');
const { StatusCodes } = require('http-status-codes');
const { ApiError } = require('../middlewares/errorHandler.middleware');
const {
  sendEmailVerificationCode,
  sendPasswordResetCode,
  sendTwoFactorCode,
} = require('./email.service');
const redisService = require('./redis.service');
const logger = require('../utils/logger');
const tokenService = require('./token.service');
const parseDurationMs = require('../utils/parseDurationMs');

/**
 * Service handling authentication logic
 * Includes registration, login, password management, and email verification
 */
class AuthService {
  /**
   * Generate a random 6-digit verification code
   * @private
   * @returns {string} 6-digit code
   */
  _generateVerificationCode() {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Hash token for safe storage
   * @param {string} token
   * @returns {string}
   */
  _hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Get refresh token expiration date
   * @returns {Date}
   */
  _getRefreshTokenExpiresAt() {
    const ttlMs = parseDurationMs(process.env.JWT_REFRESH_EXPIRES_IN, 16 * 24 * 60 * 60 * 1000);
    return new Date(Date.now() + ttlMs);
  }

  _sanitizeUser(user) {
    const {
      password: _password,
      codeVerifiEmail: _codeVerifiEmail,
      codeVerifiPassword: _codeVerifiPassword,
      refreshTokenHash: _refreshTokenHash,
      refreshTokenExpiresAt: _refreshTokenExpiresAt,
      ...userWithoutPassword
    } = user.toObject();

    return userWithoutPassword;
  }

  async _createAuthenticatedSession(user) {
    const permissions = tokenService.getPermissionsForUser(user);
    const tokens = tokenService.generateTokensWithPermissions(user);

    user.refreshTokenHash = this._hashToken(tokens.refreshToken);
    user.refreshTokenExpiresAt = this._getRefreshTokenExpiresAt();
    await user.save();

    return {
      user: {
        ...this._sanitizeUser(user),
        permissions,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async _sendLoginTwoFactorChallenge(user) {
    const challengeToken = crypto.randomBytes(32).toString('hex');
    const verificationCode = this._generateVerificationCode();
    const challengeKey = `2fa:login:challenge:${challengeToken}`;
    const codeKey = `otp:2fa:login:${user._id}`;

    await redisService.set(challengeKey, { userId: user._id.toString() }, 600);
    await redisService.set(codeKey, verificationCode, 600);

    try {
      await sendTwoFactorCode(user.email, verificationCode);
    } catch (_error) {
      await redisService.del(challengeKey);
      await redisService.del(codeKey);
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to send two-factor authentication code. Please try again.',
      );
    }

    return {
      requiresTwoFactor: true,
      challengeToken,
      email: user.email,
      expiresIn: '10 minutes',
    };
  }

  /**
   * Register a new user
   * @param {Object} data - User registration data
   * @param {string} data.username - User's username
   * @param {string} data.email - User's email
   * @param {string} data.password - User's password
   * @param {string} [data.provider] - Auth provider (local/google)
   * @returns {Promise<Object>} Created user object (without sensitive data)
   * @throws {Error} If email or username already exists
   */
  async register(data) {
    // Check if email already exists
    const existingUser = await User.findByEmail(data.email);
    if (existingUser) {
      throw new ApiError(StatusCodes.CONFLICT, 'Email already in use');
    }

    // Check if username already exists
    const existingUsername = await User.findByUsername(data.username);
    if (existingUsername) {
      throw new ApiError(StatusCodes.CONFLICT, 'Username already in use');
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create new user (without verification code)
    const newUser = User.build({
      username: data.username,
      email: data.email,
      password: hashedPassword,
      isVerifiedEmail: false,
      provider: data.provider || 'local',
    });

    await newUser.save();

    // Emit socket event
    try {
      const io = getIO();
      if (io) {
        io.emit('new_user', {
          username: newUser.username,
          _id: newUser._id,
        });
      }
    } catch (_error) {
      logger.warn('[AuthService] Socket not initialized, skipping emit');
    }

    // Send verification email
    try {
      logger.info(`[AuthService] Attempting to send verification email to ${data.email}`);
      await this.sendVerificationCode(data.email);
      logger.info(`[AuthService] Verification email sent successfully`);
    } catch (error) {
      logger.error('[AuthService] Failed to send verification email:', error);
      // Do not block registration if email fails, user can resend later
    }

    // Remove sensitive data
    const userObj = newUser.toObject();
    delete userObj.password;
    delete userObj.codeVerifiEmail;
    delete userObj.codeVerifiPassword;

    return userObj;
  }

  /**
   * Authenticate user and generate tokens
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @returns {Promise<Object>} Object containing user info, access token, and refresh token
   * @throws {Error} If credentials are invalid or email is not verified
   */
  async login(email, password) {
    const user = await User.findByEmail(email);
    if (!user) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid email or password');
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid email or password');
    }

    if (!user.isVerifiedEmail) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Please verify your email before logging in');
    }

    if (user.isTwoFactorEnabled) {
      return this._sendLoginTwoFactorChallenge(user);
    }

    return this._createAuthenticatedSession(user);
  }

  /**
   * Verify email using a code tied to the email address
   * @param {string} email - User email
   * @param {string} code - Verification code
   * @returns {Promise<{ user: Object }>} Verified user data
   * @throws {Error} If user not found, already verified, or code invalid/expired
   */
  async verifyEmail(email, code) {
    const user = await User.findByEmail(email);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }

    if (user.isVerifiedEmail) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Email already verified');
    }

    const cacheKey = `otp:email:${email}`;
    await this.ensureValidOtp(cacheKey, code);

    user.isVerifiedEmail = true;
    user.codeVerifiEmail = undefined;
    user.expiresCodeVerifiEmail = undefined;
    await user.save();
    await redisService.del(cacheKey);

    const {
      password: _password,
      codeVerifiEmail: _codeVerifiEmail,
      codeVerifiPassword: _codeVerifiPassword,
      ...userWithoutPassword
    } = user.toObject();
    return { user: userWithoutPassword };
  }

  /**
   * Verify email using code only (no email required)
   * @param {string} code - Verification code
   * @returns {Promise<{ user: Object }>} Verified user data
   * @throws {Error} If code is invalid or email already verified
   */
  async verifyEmailByCode(code) {
    const user = await User.findByVerificationEmailCode(code);
    if (!user) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid verification code');
    }

    if (user.isVerifiedEmail) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Email already verified');
    }

    if (user.expiresCodeVerifiEmail && user.expiresCodeVerifiEmail < new Date()) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Verification code has expired');
    }

    user.isVerifiedEmail = true;
    user.codeVerifiEmail = undefined;
    user.expiresCodeVerifiEmail = undefined;
    await user.save();

    const {
      password: _password,
      codeVerifiEmail: _codeVerifiEmail,
      codeVerifiPassword: _codeVerifiPassword,
      ...userWithoutPassword
    } = user.toObject();
    return { user: userWithoutPassword };
  }

  /**
   * Send verification code to email (new or resend)
   * @param {string} email - User email
   * @returns {Promise<{ email: string, message: string, expiresIn: string }>}
   * @throws {Error} If user not found, already verified, or email sending fails
   */
  async sendVerificationCode(email) {
    const user = await User.findByEmail(email);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }

    if (user.isVerifiedEmail) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Email already verified');
    }

    const verificationCode = this._generateVerificationCode();

    await redisService.set(`otp:email:${email}`, verificationCode, 600);

    user.codeVerifiEmail = verificationCode;
    user.expiresCodeVerifiEmail = Date.now() + 10 * 60 * 1000;
    await user.save();

    try {
      await sendEmailVerificationCode(email, verificationCode);
    } catch (_error) {
      user.codeVerifiEmail = undefined;
      user.expiresCodeVerifiEmail = undefined;
      await user.save();
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to send verification email. Please try again.',
      );
    }

    return {
      email,
      message: 'Verification code sent successfully',
      expiresIn: '10 minutes',
    };
  }

  /**
   * Validate OTP code stored in cache
   * @param {string} cacheKey - Cache key for OTP
   * @param {string} code - OTP code
   * @returns {Promise<void>}
   * @throws {Error} If OTP is invalid or expired
   */
  async ensureValidOtp(cacheKey, code) {
    const storedCode = await redisService.get(cacheKey);

    if (!storedCode || storedCode !== code) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid or expired verification code');
    }
  }

  /**
   * Refresh access token using a refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<{ accessToken: string, permissions: string[] }>}
   * @throws {Error} If refresh token is invalid or user not found
   */
  async refreshAccessToken(refreshToken) {
    let payload;
    try {
      payload = tokenService.verifyRefreshToken(refreshToken);
    } catch (_error) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid or expired refresh token');
    }

    const user = await User.findByIdWithRefreshFields(payload.userId);
    if (!user) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'User not found');
    }

    const tokenHash = this._hashToken(refreshToken);
    if (user.refreshTokenHash && user.refreshTokenHash !== tokenHash) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid or revoked refresh token');
    }

    if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt < new Date()) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Refresh token has expired');
    }

    const permissions = tokenService.getPermissionsForUser(user);
    const tokens = tokenService.generateTokensWithPermissions(user);

    user.refreshTokenHash = this._hashToken(tokens.refreshToken);
    user.refreshTokenExpiresAt = this._getRefreshTokenExpiresAt();
    await user.save();

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      permissions,
    };
  }

  /**
   * Revoke refresh token (logout)
   * @param {string} refreshToken
   * @returns {Promise<void>}
   */
  async revokeRefreshToken(refreshToken) {
    try {
      const payload = tokenService.verifyRefreshToken(refreshToken);
      await User.clearRefreshToken(payload.userId);
    } catch (_error) {
      // Ignore invalid token on logout
    }
  }

  /**
   * Send password reset code to email
   * @param {string} email - User email
   * @returns {Promise<{ email: string }>}
   * @throws {Error} If user not found or email sending fails
   */
  async forgotPassword(email) {
    const user = await User.findByEmail(email);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }

    // Generate password reset code
    const resetCode = this._generateVerificationCode();

    // Save to Redis (expire in 1 hour)
    await redisService.set(`otp:reset-password:${email}`, resetCode, 3600);

    // Send reset code via email
    try {
      await sendPasswordResetCode(email, resetCode);
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      await redisService.del(`otp:reset-password:${email}`);
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to send password reset email. Please try again.',
      );
    }

    return { email };
  }

  /**
   * Reset password using verification code
   * @param {string} email - User email
   * @param {string} code - Reset code
   * @param {string} newPassword - New password
   * @returns {Promise<{ email: string }>}
   * @throws {Error} If user not found or code invalid
   */
  async resetPassword(email, code, newPassword) {
    const user = await User.findByEmail(email);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }

    const cacheKey = `otp:reset-password:${email}`;
    await this.ensureValidOtp(cacheKey, code);

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and clear reset code
    user.password = hashedPassword;
    await user.save();

    // Clear Redis OTP
    await redisService.del(cacheKey);

    return { email: user.email };
  }

  /**
   * Change password for authenticated user
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<{ userId: string }>}
   * @throws {Error} If user not found or current password invalid
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }

    // Verify current password
    const isMatch = await comparePassword(currentPassword, user.password);

    if (!isMatch) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Current password is incorrect');
    }

    // Hash and update new password
    const hashedPassword = await hashPassword(newPassword);

    user.password = hashedPassword;
    await user.save();

    return { userId: user._id };
  }

  async sendTwoFactorManagementCode(userId, action) {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }

    if (!user.isVerifiedEmail) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Please verify your email before enabling two-factor authentication',
      );
    }

    if (action === 'enable' && user.isTwoFactorEnabled) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Two-factor authentication is already enabled');
    }

    if (action === 'disable' && !user.isTwoFactorEnabled) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Two-factor authentication is not enabled');
    }

    const code = this._generateVerificationCode();
    const cacheKey = `otp:2fa:${action}:${userId}`;
    await redisService.set(cacheKey, code, 600);

    try {
      await sendTwoFactorCode(user.email, code);
    } catch (_error) {
      await redisService.del(cacheKey);
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to send two-factor authentication code. Please try again.',
      );
    }

    return {
      action,
      email: user.email,
      expiresIn: '10 minutes',
    };
  }

  async confirmTwoFactorManagement(userId, action, code) {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }

    const cacheKey = `otp:2fa:${action}:${userId}`;
    await this.ensureValidOtp(cacheKey, code);

    user.isTwoFactorEnabled = action === 'enable';
    await user.save();
    await redisService.del(cacheKey);

    return this._sanitizeUser(user);
  }

  async verifyLoginTwoFactor(challengeToken, code) {
    const challengeKey = `2fa:login:challenge:${challengeToken}`;
    const challenge = await redisService.get(challengeKey);

    if (!challenge?.userId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid or expired two-factor challenge');
    }

    const user = await User.findById(challenge.userId);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }

    await this.ensureValidOtp(`otp:2fa:login:${user._id}`, code);

    await redisService.del(challengeKey);
    await redisService.del(`otp:2fa:login:${user._id}`);

    return this._createAuthenticatedSession(user);
  }

  async resendLoginTwoFactorCode(challengeToken) {
    const challengeKey = `2fa:login:challenge:${challengeToken}`;
    const challenge = await redisService.get(challengeKey);

    if (!challenge?.userId) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid or expired two-factor challenge');
    }

    const user = await User.findById(challenge.userId);
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }

    const verificationCode = this._generateVerificationCode();
    const codeKey = `otp:2fa:login:${user._id}`;
    await redisService.set(codeKey, verificationCode, 600);

    try {
      await sendTwoFactorCode(user.email, verificationCode);
    } catch (_error) {
      await redisService.del(codeKey);
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to send two-factor authentication code. Please try again.',
      );
    }

    return {
      email: user.email,
      expiresIn: '10 minutes',
    };
  }
}

module.exports = new AuthService();
